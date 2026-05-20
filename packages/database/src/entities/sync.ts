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

import { bigint, boolean, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bytea } from './base';
import { users } from './users';

/**
 * Per-user global version sequence.
 *
 * Centralizing the sequence in one row per user means every sync write needs a row-level lock
 * (`SELECT … FOR UPDATE`) on this table inside the transaction. That serializes writes per user,
 * which is what we want — there is no parallelism gain from interleaving a single user's mutations.
 */
export const syncGlobalVersion = pgTable('sync_global_version', {
  userId: uuid('user_id').notNull().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  /** monotonically increasing; allocated by SELECT … FOR UPDATE; UPDATE … RETURNING */
  current: bigint('current', { mode: 'number' }).notNull().default(0),
});

export const syncObjects = pgTable('sync_objects', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resource: text('resource').notNull(),
  entityId: text('entity_id').notNull(),
  /** opaque ciphertext from the client; null when the row is logically deleted */
  payload: bytea('payload'),
  /** server-assigned monotonic version; matches syncGlobalVersion.current at write time */
  version: bigint('version', { mode: 'number' }).notNull(),
  /** soft-delete tombstone — the row remains so older clients still receive a 'del' patch */
  deleted: boolean('deleted').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.resource, t.entityId] }),
  /**
   * Pull is `WHERE user_id=? AND resource=? AND version > cursor ORDER BY version`.
   * (user_id, resource, version) covers it perfectly.
   */
  pullIdx: index('sync_objects_pull_idx').on(t.userId, t.resource, t.version),
}));

export const syncClients = pgTable('sync_clients', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  /** highest mutation_id from this client that has been durably applied */
  lastMutationId: bigint('last_mutation_id', { mode: 'number' }).notNull().default(0),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.clientId] }),
}));
