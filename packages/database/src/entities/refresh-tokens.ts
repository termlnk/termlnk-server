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

import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const refreshTokens = pgTable('refresh_tokens', {
  /** opaque token id (jti claim of the refresh JWT); used for rotation lookup; also surfaces to clients as the "device id" in the device-list UI */
  jti: uuid('jti').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** ms epoch */
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /** non-null = revoked at this time; lookup-and-clear on rotate */
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  /** human label supplied by the client (typically `os.hostname()`); shown in the device list */
  deviceName: text('device_name'),
  /** raw User-Agent header captured at issue time; coarse fingerprint for the device list */
  userAgent: text('user_agent'),
  /** bumped on /auth/refresh; lets the device-list UI sort by recency */
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('refresh_tokens_user_idx').on(t.userId),
}));
