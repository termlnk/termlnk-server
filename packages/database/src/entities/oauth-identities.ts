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

import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Links a third-party identity (e.g. Google) to a local user. Identity only —
 * the encryption root lives in `srp_credentials`, never here. One user may
 * accumulate several rows (one per provider); `(provider, providerUserId)` is
 * the natural key the login flow resolves on.
 */
export const oauthIdentities = pgTable('oauth_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** OAuth provider key, e.g. 'google' */
  provider: text('provider').notNull(),
  /** Stable subject id from the provider (Google `sub`) */
  providerUserId: text('provider_user_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Provider-reported email at last login; `users.email` stays canonical */
  email: text('email'),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerUserUnique: uniqueIndex('oauth_identities_provider_user_unique').on(t.provider, t.providerUserId),
  userIdx: index('oauth_identities_user_idx').on(t.userId),
}));
