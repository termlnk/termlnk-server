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

import { bigint, index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Same-account multi-device share announcements (M7).
 *
 * Each signed-in device POSTs `/v1/multiplayer/announce` whenever it starts sharing
 * a session, then heartbeats every 30s to refresh `last_heartbeat_at`. Other devices
 * on the same account GET `/v1/multiplayer/sessions` and see the rows whose
 * heartbeat is fresh enough (< 90 s). A staleness sweep clears the rest.
 *
 * Composite PK `(user_id, device_id, session_id)` keeps multiple sessions per
 * device announce-able simultaneously (e.g. one Mac sharing two SSH tabs).
 *
 * No ciphertext lives in this table — it's just the index that lets one device's
 * UI discover what another device is hosting. The actual PTY stream is still
 * served by the shared-terminal relay (E2EE), this table only carries the
 * metadata needed for one-click "join from this device".
 */
export const multiplayerAnnouncements = pgTable('multiplayer_announcements', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Stable per-device identifier emitted by the desktop's AuthCorePlugin. */
  deviceId: text('device_id').notNull(),
  /** termlnk-side session id (matches SSH/PTY session id used in the relay). */
  sessionId: text('session_id').notNull(),
  /** Human-friendly label for the joiner's UI — host label or "ssh:<prefix>". */
  title: text('title').notNull(),
  cols: integer('cols').notNull(),
  rows: integer('rows').notNull(),
  /** Initial announcement time. */
  announcedAt: timestamp('announced_at', { withTimezone: true }).notNull().defaultNow(),
  /** Latest heartbeat. The TTL sweep deletes rows whose value is older than 90 s. */
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * ms epoch of the announcement on the announcing device — kept as bigint so the
   * sync_global_version-style monotonic ordering is preserved across instances.
   */
  deviceClock: bigint('device_clock', { mode: 'number' }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.deviceId, t.sessionId] }),
  /** `WHERE user_id=? AND last_heartbeat_at > now() - 90s` powers the discovery list. */
  freshByUserIdx: index('multiplayer_announcements_user_heartbeat_idx').on(t.userId, t.lastHeartbeatAt),
  /** TTL sweep input: `WHERE last_heartbeat_at < now() - 90s`. */
  staleSweepIdx: index('multiplayer_announcements_heartbeat_idx').on(t.lastHeartbeatAt),
}));
