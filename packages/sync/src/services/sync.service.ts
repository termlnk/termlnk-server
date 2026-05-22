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

import type { IDBAdaptorService, ITxContext } from '@termlnk-server/database';
import type { ISyncClientsRepository, ISyncGlobalVersionRepository, ISyncObjectsRepository } from '@termlnk-server/database/repositories';
import type { IPullRequest, IPullResponse, IPushAcceptedDetail, IPushRequest, IPushResponse, ISyncMutation, ISyncPatchItem, SyncResourceId } from '@termlnk-server/protocol';
import type { IPokeEnvelope, ISyncBroadcaster } from '@termlnk-server/sync-broadcast';
import { createIdentifier } from '@termlnk-server/core';

export interface ISyncService {
  push(userId: string, req: IPushRequest): Promise<IPushResponse>;
  pull(userId: string, req: IPullRequest): Promise<IPullResponse>;
  /** Subscribe to poke events for a user. Returns an unsubscribe function. */
  subscribe(userId: string, handler: (env: IPokeEnvelope<SyncResourceId>) => void): () => void;
}

export const ISyncService = createIdentifier<ISyncService>('sync.service');

/**
 * Sync engine — server-authoritative version assignment + per-row LWW + idempotent push.
 *
 * Cursor encoding: opaque to the client; server uses the per-user global version as the
 * cursor value (stringified bigint). Pull returns rows where `version > cursor` for the
 * given resource.
 *
 * Idempotency: each (clientId, mutationId) is consumed at most once. We track the highest
 * applied id per (user, client) in `sync_clients`. Push processes mutations in id order;
 * any mutation with id <= lastMutationId is silently treated as accepted.
 *
 * Optimistic concurrency: a mutation carries `baseVersion` (the version the client thought
 * was current when it wrote). The server compares against the current row version; on
 * mismatch the mutation is rejected and the client must pull + retry.
 *
 * Concurrency model: per-user serialization is delegated to the repository
 * layer via `SELECT … FOR UPDATE` on `sync_global_version`.
 *
 * Cross-instance fanout: every accepted push publishes a poke envelope via the
 * `ISyncBroadcaster` abstraction so other instances forward it to connected WS clients.
 */
export class SyncService implements ISyncService {
  constructor(
    private readonly _db: IDBAdaptorService,
    private readonly _versions: ISyncGlobalVersionRepository,
    private readonly _clients: ISyncClientsRepository,
    private readonly _objects: ISyncObjectsRepository,
    private readonly _broadcaster: ISyncBroadcaster
  ) {}

  async push(userId: string, req: IPushRequest): Promise<IPushResponse> {
    const result = await this._db.transaction(async (tx) => {
      await this._versions.ensureExists(userId, tx);
      const versionBefore = await this._versions.findCurrentForUpdate(userId, tx);
      let currentVersion = versionBefore;

      await this._clients.ensureExists(userId, req.clientId, tx);
      const clientState = await this._clients.findOne(userId, req.clientId, tx);
      const lastMutationIdBefore = clientState?.lastMutationId ?? 0;
      let lastMutationId = lastMutationIdBefore;

      const accepted: number[] = [];
      const acceptedDetails: IPushAcceptedDetail[] = [];
      const rejected: { id: number; reason: string }[] = [];
      const touchedResources = new Set<SyncResourceId>();

      const sorted = [...req.mutations].sort((a, b) => a.id - b.id);
      for (const m of sorted) {
        if (m.id <= lastMutationId) {
          // Idempotent skip: this mutation was applied in a previous push round (the client
          // is retrying because it never saw the ack). Return the row's current server
          // version so the client can still write sync_row_meta and stop looping.
          accepted.push(m.id);
          const existing = await this._objects.findOne(userId, m.resource, m.entityId, tx);
          if (existing) {
            acceptedDetails.push({
              id: m.id,
              resource: m.resource,
              entityId: m.entityId,
              version: existing.version,
            });
          }
          continue;
        }
        const verdict = await applyMutation(this._objects, tx, userId, m, currentVersion);
        if (verdict.kind === 'accepted') {
          currentVersion = verdict.newVersion;
          lastMutationId = m.id;
          accepted.push(m.id);
          acceptedDetails.push({
            id: m.id,
            resource: m.resource,
            entityId: m.entityId,
            version: verdict.newVersion,
          });
          touchedResources.add(m.resource);
        } else {
          rejected.push({ id: m.id, reason: verdict.reason });
        }
      }

      if (currentVersion !== versionBefore) {
        await this._versions.update(userId, currentVersion, tx);
      }
      const now = new Date();
      if (lastMutationId !== lastMutationIdBefore) {
        await this._clients.update(userId, req.clientId, lastMutationId, now, tx);
      } else {
        await this._clients.touchLastSeen(userId, req.clientId, now, tx);
      }

      return { accepted, acceptedDetails, rejected, currentVersion, touchedResources };
    });

    const cursor = String(result.currentVersion);
    for (const resource of result.touchedResources) {
      const envelope: IPokeEnvelope<SyncResourceId> = { resource, cursor, originClientId: req.clientId };
      // Fire-and-forget — a publish failure shouldn't fail the write that already committed.
      void this._broadcaster.publish<SyncResourceId>(userId, envelope).catch(() => undefined);
    }

    return {
      accepted: result.accepted,
      acceptedDetails: result.acceptedDetails,
      rejected: result.rejected,
      lastServerVersion: result.currentVersion,
    };
  }

  async pull(userId: string, req: IPullRequest): Promise<IPullResponse> {
    const cursorVersion = req.cursor === null ? 0 : Number.parseInt(req.cursor, 10);
    if (!Number.isFinite(cursorVersion) || cursorVersion < 0) {
      throw new Error(`invalid cursor: ${req.cursor}`);
    }

    const rows = await this._objects.listByResourceAfterVersion(userId, req.resource, cursorVersion);

    const patch: ISyncPatchItem[] = rows.map((row) => ({
      op: row.deleted ? 'del' : 'put',
      resource: row.resource as SyncResourceId,
      entityId: row.entityId,
      payload: row.payload && !row.deleted ? Buffer.from(row.payload).toString('base64') : null,
      version: row.version,
    }));

    let newCursor: string;
    if (rows.length > 0) {
      newCursor = String(rows[rows.length - 1]!.version);
    } else {
      newCursor = String(await this._versions.findCurrent(userId));
    }

    const clientState = await this._clients.findOne(userId, req.clientId);

    return {
      cursor: newCursor,
      patch,
      lastMutationId: clientState?.lastMutationId ?? 0,
    };
  }

  subscribe(userId: string, handler: (env: IPokeEnvelope<SyncResourceId>) => void): () => void {
    return this._broadcaster.subscribe<SyncResourceId>(userId, handler);
  }
}

type ApplyVerdict =
  | { kind: 'accepted'; newVersion: number }
  | { kind: 'rejected'; reason: string };

async function applyMutation(
  objects: ISyncObjectsRepository,
  tx: ITxContext,
  userId: string,
  m: ISyncMutation,
  currentVersion: number
): Promise<ApplyVerdict> {
  const existing = await objects.findOne(userId, m.resource, m.entityId, tx);

  if (m.baseVersion !== null && existing && existing.version !== m.baseVersion) {
    return { kind: 'rejected', reason: 'baseVersion mismatch' };
  }

  const newVersion = currentVersion + 1;
  const payloadBuf = m.payload === null ? null : Buffer.from(m.payload, 'base64');

  if (m.op === 'delete') {
    if (!existing) {
      await objects.insert({
        userId,
        resource: m.resource,
        entityId: m.entityId,
        payload: null,
        version: newVersion,
        deleted: true,
      }, tx);
    } else {
      await objects.update({
        userId,
        resource: m.resource,
        entityId: m.entityId,
        payload: null,
        version: newVersion,
        deleted: true,
        updatedAt: new Date(),
      }, tx);
    }
    return { kind: 'accepted', newVersion };
  }

  if (existing) {
    await objects.update({
      userId,
      resource: m.resource,
      entityId: m.entityId,
      payload: payloadBuf,
      version: newVersion,
      deleted: false,
      updatedAt: new Date(),
    }, tx);
  } else {
    await objects.insert({
      userId,
      resource: m.resource,
      entityId: m.entityId,
      payload: payloadBuf,
      version: newVersion,
      deleted: false,
    }, tx);
  }
  return { kind: 'accepted', newVersion };
}
