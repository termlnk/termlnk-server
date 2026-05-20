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
import { users } from './users';

/**
 * Per-user collaboration invite tokens (P5.5.2).
 *
 * Server stores opaque metadata + capability hash + ephemeral X25519 public key. The
 * ephemeral PRIVATE key NEVER reaches the server (it lives in the owner's URL fragment).
 * The PK is `(user_id, invite_id)` so the same invite_id never collides across users; the
 * client-side invite_id is unique per user by construction (24 random bytes).
 */
export const collabInvites = pgTable('collab_invites', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** base64url 24 bytes — client-generated; mirrors collab_invite_token.invite_id on the desktop. */
  inviteId: text('invite_id').notNull(),
  sessionId: text('session_id').notNull(),
  /** SharedTerminalRole as text — kept open to allow new roles without enum migrations. */
  role: text('role').notNull(),
  /** sha256(canonical(capability)) base64url — opaque dedupe handle. */
  capabilityHash: text('capability_hash').notNull(),
  capabilityVersion: bigint('capability_version', { mode: 'number' }).notNull(),
  /** base64url X25519 ephemeral public key. */
  ephPubB64: text('eph_pub_b64').notNull(),
  /** ms epoch — capability.exp. */
  exp: bigint('exp', { mode: 'number' }).notNull(),
  singleUse: boolean('single_use').notNull(),
  /** 'active' | 'consumed' | 'revoked' | 'expired' */
  status: text('status').notNull().default('active'),
  /** Owner-supplied human label (optional). */
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.inviteId] }),
  /**
   * `WHERE user_id=? ORDER BY created_at DESC` powers GET /v1/collab/invite. The
   * inviteId is the PK so /:inviteId/revoke uses the primary-key path.
   */
  userListIdx: index('collab_invites_user_created_idx').on(t.userId, t.createdAt),
  /** Used by the expiry sweep: `WHERE status='active' AND exp < now()`. */
  expirySweepIdx: index('collab_invites_status_exp_idx').on(t.status, t.exp),
}));
