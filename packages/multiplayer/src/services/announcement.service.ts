/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { ILogService } from '@termlnk-server/core';
import type {
  IMultiplayerAnnouncementRow,
  IMultiplayerAnnouncementsRepository,
} from '@termlnk-server/database/repositories';
import type { IRemoteAnnouncedSession } from '@termlnk-server/protocol';
import type Redis from 'ioredis';
import { createIdentifier } from '@termlnk-server/core';

/**
 * Same-account device announcement coordinator (M7 server side).
 *
 * The announcement table is the durable source of truth; Redis is an optional
 * change-event channel. When a device announces / heartbeats / retracts, the
 * plugin publishes a small `announcement.changed` envelope so peers can refresh
 * without waiting for the next 60s poll. Subscribers are scoped per `(userId)`
 * so we never broadcast across accounts.
 *
 * The plugin schedules `sweepStale` every `sweepIntervalMs`; the renderer's
 * `listFresh` query uses the same freshness cutoff so a stopped device disappears
 * within ~90 s without explicit retract calls.
 */
export interface IAnnouncementService {
  upsert(params: {
    userId: string;
    deviceId: string;
    sessionId: string;
    title: string;
    cols: number;
    rows: number;
    deviceClock: number;
  }): Promise<void>;

  retract(userId: string, deviceId: string, sessionId: string): Promise<void>;

  listFresh(userId: string, excludeDeviceId?: string): Promise<IRemoteAnnouncedSession[]>;

  /** Run a one-shot stale row sweep. Returns the count of rows dropped. */
  sweep(): Promise<number>;

  dispose(): void;
}

export const IAnnouncementService = createIdentifier<IAnnouncementService>('multiplayer.announcement-service');

interface IAnnouncementChangeEnvelope {
  readonly originInstanceId: string;
  readonly userId: string;
  readonly type: 'upsert' | 'retract';
  readonly deviceId: string;
  readonly sessionId: string;
}

/**
 * Channel name for the cross-instance change feed. The renderer doesn't subscribe
 * to this — it's used by other server processes to invalidate their cached views
 * (we don't currently cache, but the hook is here so future work doesn't have to
 * touch every announcement call site).
 */
const PUB_SUB_CHANNEL_PREFIX = 'mp:announce:';

function randomBase64Url(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    s += String.fromCharCode(buf[i]!);
  }
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function deviceNameFromDeviceId(deviceId: string): string {
  // Best-effort label: until the AuthPlugin surfaces device user-agent metadata, the
  // renderer just shows the first 8 characters of the opaque id so the user has *some*
  // way to distinguish "MacBook" from "iPad". A future iteration can JOIN against the
  // refresh_tokens table to surface the device's user_agent string.
  return `device:${deviceId.slice(0, 8)}`;
}

function toRemoteSession(row: IMultiplayerAnnouncementRow): IRemoteAnnouncedSession {
  return {
    sessionId: row.sessionId,
    deviceId: row.deviceId,
    deviceName: deviceNameFromDeviceId(row.deviceId),
    title: row.title,
    cols: row.cols,
    rows: row.rows,
    announcedAt: row.announcedAt.getTime(),
  };
}

export class AnnouncementService implements IAnnouncementService {
  private readonly _instanceId = randomBase64Url(16);
  private readonly _subscribers = new Map<string, () => void>();
  private _sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly _repo: IMultiplayerAnnouncementsRepository,
    private readonly _logService: ILogService,
    private readonly _freshnessWindowMs: number,
    sweepIntervalMs: number,
    private readonly _redis: Redis | null = null
  ) {
    // Drive the staleness sweep here so the plugin doesn't need a separate timer
    // controller. Unref so the interval doesn't hold a Node process alive during
    // graceful shutdown — Core.dispose() calls dispose() which clears it explicitly.
    this._sweepTimer = setInterval(() => {
      void this.sweep().catch((err) => {
        this._logService.warn('[AnnouncementService] sweep failed:', err);
      });
    }, sweepIntervalMs);
    if (typeof this._sweepTimer === 'object' && this._sweepTimer !== null && 'unref' in this._sweepTimer) {
      (this._sweepTimer as { unref: () => void }).unref();
    }
  }

  async upsert(params: {
    userId: string;
    deviceId: string;
    sessionId: string;
    title: string;
    cols: number;
    rows: number;
    deviceClock: number;
  }): Promise<void> {
    await this._repo.upsert(params);
    this._publishChange({
      originInstanceId: this._instanceId,
      userId: params.userId,
      type: 'upsert',
      deviceId: params.deviceId,
      sessionId: params.sessionId,
    });
  }

  async retract(userId: string, deviceId: string, sessionId: string): Promise<void> {
    await this._repo.delete(userId, deviceId, sessionId);
    this._publishChange({
      originInstanceId: this._instanceId,
      userId,
      type: 'retract',
      deviceId,
      sessionId,
    });
  }

  async listFresh(userId: string, excludeDeviceId?: string): Promise<IRemoteAnnouncedSession[]> {
    const cutoff = new Date(Date.now() - this._freshnessWindowMs);
    const rows = await this._repo.listFresh(userId, cutoff, excludeDeviceId);
    return rows.map(toRemoteSession);
  }

  async sweep(): Promise<number> {
    const cutoff = new Date(Date.now() - this._freshnessWindowMs);
    return this._repo.sweepStale(cutoff);
  }

  dispose(): void {
    if (this._sweepTimer) {
      clearInterval(this._sweepTimer);
      this._sweepTimer = null;
    }
    for (const off of this._subscribers.values()) {
      try {
        off();
      } catch {
        // best-effort
      }
    }
    this._subscribers.clear();
  }

  private _publishChange(envelope: IAnnouncementChangeEnvelope): void {
    if (!this._redis) {
      return;
    }
    const channel = `${PUB_SUB_CHANNEL_PREFIX}${envelope.userId}`;
    this._redis.publish(channel, JSON.stringify(envelope)).catch((err) => {
      this._logService.warn('[AnnouncementService] publish failed:', err);
    });
  }
}
