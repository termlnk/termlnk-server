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

import type { ITxContext } from '@termlnk-server/database';
import type { ISyncClientsRepository, ISyncGlobalVersionRepository, ISyncObjectRow, ISyncObjectsRepository, ISyncObjectWriteParams } from '@termlnk-server/database/repositories';
import type { ISyncMutation } from '@termlnk-server/protocol';
import { describe, expect, it } from 'vitest';
import { SyncService } from './sync.service';

const USER = 'user-1';
const CLIENT = 'client-1';

function rowKey(resource: string, entityId: string): string {
  return `${resource}::${entityId}`;
}

/**
 * In-memory stand-ins for the three repositories `SyncService.push` touches. The real
 * per-user serialization comes from `SELECT … FOR UPDATE`; these tests exercise the
 * single-transaction logic, so a plain map is equivalent.
 */
function createHarness() {
  const objects = new Map<string, ISyncObjectRow>();
  let globalVersion = 0;
  // Keyed by clientId, mirroring the real `sync_clients` PK (userId, clientId).
  const lastMutationIds = new Map<string, number>();

  const objectsRepo: ISyncObjectsRepository = {
    async findOne(_userId, resource, entityId) {
      return objects.get(rowKey(resource, entityId)) ?? null;
    },
    async listActiveByResource(_userId, resource) {
      return [...objects.values()].filter((o) => o.resource === resource && !o.deleted);
    },
    async listByResourceAfterVersion(_userId, resource, cursorVersion) {
      return [...objects.values()]
        .filter((o) => o.resource === resource && o.version > cursorVersion)
        .sort((a, b) => a.version - b.version);
    },
    async insert(values: ISyncObjectWriteParams) {
      objects.set(rowKey(values.resource, values.entityId), { ...values, updatedAt: new Date(0) });
    },
    async update(values) {
      objects.set(rowKey(values.resource, values.entityId), { ...values });
    },
  };

  const versionsRepo: ISyncGlobalVersionRepository = {
    async ensureExists() {},
    async findCurrentForUpdate() {
      return globalVersion;
    },
    async findCurrent() {
      return globalVersion;
    },
    async update(_userId, current) {
      globalVersion = current;
    },
  };

  const clientsRepo: ISyncClientsRepository = {
    async ensureExists() {},
    async findOne(_userId, clientId) {
      return { lastMutationId: lastMutationIds.get(clientId) ?? 0 };
    },
    async update(_userId, clientId, nextId) {
      lastMutationIds.set(clientId, nextId);
    },
    async touchLastSeen() {},
  };

  const db = {
    async transaction<T>(fn: (tx: ITxContext) => Promise<T>): Promise<T> {
      return fn({} as ITxContext);
    },
  };

  const broadcaster = {
    async publish() {},
    subscribe: () => () => {},
  };

  return {
    service: new SyncService(
      db as never,
      versionsRepo,
      clientsRepo,
      objectsRepo,
      broadcaster as never
    ),
    objects,
    getLastMutationId: (clientId: string = CLIENT) => lastMutationIds.get(clientId) ?? 0,
  };
}

function upsert(id: number, entityId: string, body: string, baseVersion: number | null): ISyncMutation {
  return {
    id,
    resource: 'host',
    op: 'upsert',
    entityId,
    payload: Buffer.from(body).toString('base64'),
    baseVersion,
    createdAt: id,
  } as ISyncMutation;
}

function payloadOf(objects: Map<string, ISyncObjectRow>, entityId: string): string | null {
  const row = objects.get(rowKey('host', entityId));
  return row?.payload ? Buffer.from(row.payload).toString() : null;
}

describe('syncService.push idempotency watermark', () => {
  it('advances the watermark across a fully accepted batch', async () => {
    const h = createHarness();

    await h.service.push(USER, {
      clientId: CLIENT,
      mutations: [upsert(1, 'A', 'a1', null), upsert(2, 'B', 'b1', null)],
    });

    expect(h.getLastMutationId()).toBe(2);
    expect(payloadOf(h.objects, 'A')).toBe('a1');
    expect(payloadOf(h.objects, 'B')).toBe('b1');
  });

  it('skips a replayed mutation that really was applied', async () => {
    const h = createHarness();
    await h.service.push(USER, { clientId: CLIENT, mutations: [upsert(1, 'A', 'a1', null)] });

    // Client never saw the ack and retries; the server must not apply it twice.
    const replay = await h.service.push(USER, {
      clientId: CLIENT,
      mutations: [upsert(1, 'A', 'a1', null)],
    });

    expect(replay.accepted).toEqual([1]);
    expect(replay.acceptedDetails[0]?.version).toBe(1);
    expect(h.objects.get(rowKey('host', 'A'))?.version).toBe(1);
  });

  /**
   * Regression: the watermark used to advance to the highest accepted id regardless of
   * rejections earlier in the batch. The rejected mutation's retry then fell into the
   * idempotent-skip branch — reported as accepted, never written. The client acked it and
   * dropped it from the outbox, silently losing the edit while its sync_row_meta claimed
   * the row was in sync.
   */
  it('does not advance the watermark past a rejected mutation', async () => {
    const h = createHarness();

    // Another device already moved host A to version 1.
    await h.service.push(USER, {
      clientId: 'other-device',
      mutations: [upsert(1, 'A', 'remote', null)],
    });

    // Our batch: id=5 carries a stale baseVersion for A (rejected), id=6 touches B (accepted).
    const first = await h.service.push(USER, {
      clientId: CLIENT,
      mutations: [upsert(5, 'A', 'local-A', 99), upsert(6, 'B', 'local-B', null)],
    });

    expect(first.rejected.map((r) => r.id)).toEqual([5]);
    expect(first.accepted).toEqual([6]);
    expect(h.getLastMutationId()).toBe(0);

    // Client rebases id=5 onto the current version and retries it.
    const retry = await h.service.push(USER, {
      clientId: CLIENT,
      mutations: [upsert(5, 'A', 'local-A', 1)],
    });

    expect(retry.accepted).toEqual([5]);
    expect(retry.rejected).toEqual([]);
    expect(payloadOf(h.objects, 'A')).toBe('local-A');
  });

  it('keeps the watermark sealed for accepted ids that follow a rejection', async () => {
    const h = createHarness();
    await h.service.push(USER, {
      clientId: 'other-device',
      mutations: [upsert(1, 'A', 'remote', null)],
    });

    await h.service.push(USER, {
      clientId: CLIENT,
      mutations: [
        upsert(5, 'A', 'local-A', 99), // rejected -> seals
        upsert(6, 'B', 'local-B', null),
        upsert(7, 'C', 'local-C', null),
      ],
    });

    // 6 and 7 were applied but must stay outside the watermark, or 5's retry is swallowed.
    expect(h.getLastMutationId()).toBe(0);
    expect(payloadOf(h.objects, 'B')).toBe('local-B');
    expect(payloadOf(h.objects, 'C')).toBe('local-C');
  });
});
