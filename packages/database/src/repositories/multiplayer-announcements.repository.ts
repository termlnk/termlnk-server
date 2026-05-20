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

import type { multiplayerAnnouncements } from '../entities';
import type { ITxContext } from '../services/db-adaptor.service';
import { createIdentifier } from '@termlnk-server/core';

export type IMultiplayerAnnouncementRow = typeof multiplayerAnnouncements.$inferSelect;

export interface IMultiplayerAnnouncementUpsertParams {
  userId: string;
  deviceId: string;
  sessionId: string;
  title: string;
  cols: number;
  rows: number;
  /** ms epoch on the announcing device, monotonic per device. */
  deviceClock: number;
}

/**
 * Same-account multi-device announcements (M7).
 *
 * Repository is driver-agnostic; PG implementation lives under
 * `implementations/multiplayer-announcements.repository.ts`.
 *
 * Heartbeat semantics:
 *   - `upsert` either inserts a new row or updates an existing one (idempotent),
 *     refreshing `last_heartbeat_at` on every call.
 *   - `listFresh` returns rows whose heartbeat is newer than `freshSinceMs` —
 *     callers compute `Date.now() - 90_000` and pass it.
 *   - `sweepStale` deletes rows older than `staleBeforeMs`; the multiplayer plugin
 *     schedules a periodic sweep (60s) so heartbeat-loss-on-process-crash doesn't
 *     leak dead rows forever.
 */
export interface IMultiplayerAnnouncementsRepository {
  upsert(values: IMultiplayerAnnouncementUpsertParams, tx?: ITxContext): Promise<void>;
  /** Delete a single announcement. Idempotent — silently no-op when absent. */
  delete(userId: string, deviceId: string, sessionId: string, tx?: ITxContext): Promise<void>;
  /** Drop every row this device announced (called when a device retires). */
  deleteAllByDevice(userId: string, deviceId: string, tx?: ITxContext): Promise<void>;
  /**
   * List announcements still fresh for the given user. Caller passes the cutoff
   * timestamp (e.g. now - 90s).
   *
   * `excludeDeviceId` is optional — typically the requester's own deviceId so the
   * UI doesn't show itself as a "remote device".
   */
  listFresh(
    userId: string,
    freshSince: Date,
    excludeDeviceId?: string,
    tx?: ITxContext
  ): Promise<IMultiplayerAnnouncementRow[]>;
  /** Maintenance sweep: drop every row older than `staleBefore`. Returns affected count. */
  sweepStale(staleBefore: Date, tx?: ITxContext): Promise<number>;
}

export const IMultiplayerAnnouncementsRepository = createIdentifier<IMultiplayerAnnouncementsRepository>(
  'database.multiplayer-announcements-repository'
);
