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

import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Mobile push notification registrations (P6.8).
 *
 * One row per (userId, deviceToken) — deviceToken is unique globally (APNs / FCM /
 * Expo Push tokens are device-scoped) so re-registering the same token from a
 * different account silently re-assigns it. The pair `(user_id, platform)` is the
 * canonical fan-out address: "every iOS device of user X" / "every Android device".
 *
 * Server is responsible for delivering invite notifications via the configured push
 * provider; this table is the address book. No payloads land here.
 */
export const pushTokens = pgTable('push_tokens', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Opaque device token: Expo Push Token (`ExponentPushToken[...]`), FCM, or APNs. */
  deviceToken: text('device_token').notNull(),
  /** 'ios' | 'android' | 'web' — platform-specific delivery routing. */
  platform: text('platform').notNull(),
  /** Optional UA / app version for diagnostics; never used for routing. */
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.deviceToken] }),
  /** `WHERE user_id=? AND platform=?` for invite-notification fan-out. */
  userPlatformIdx: index('push_tokens_user_platform_idx').on(t.userId, t.platform),
}));
