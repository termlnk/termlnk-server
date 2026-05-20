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

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const srpCredentials = pgTable('srp_credentials', {
  userId: uuid('user_id').notNull().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  /** base64 of the random portion of the Argon2id salt */
  argon2SaltB64: text('argon2_salt_b64').notNull(),
  /** SRP6a salt (hex) */
  srpSalt: text('srp_salt').notNull(),
  /** SRP6a verifier (hex); zero-knowledge — server cannot derive password from this */
  srpVerifier: text('srp_verifier').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
