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

/**
 * Termlnk server pg-core schema (drizzle-orm/node-postgres).
 *
 * Server is **zero-knowledge** for sync payloads: bytea is opaque ciphertext,
 * never decrypted.
 *
 * NOTE: only tables are re-exported here. The `bytea` helper from ./base lives
 * outside this barrel because drizzle 1.0's relational schema inference rejects
 * non-table identifiers in the schema object (`bytea` is a customType factory,
 * not a `PgTable`). Import it directly via `@termlnk-server/database/entities/base`
 * when defining a new entity with bytea columns.
 */

export { adminUsers } from './admin-users';
export { collabInvites } from './collab-invites';
export { multiplayerAnnouncements } from './multiplayer-announcements';
export { oauthIdentities } from './oauth-identities';
export { pushTokens } from './push-tokens';
export { refreshTokens } from './refresh-tokens';
export { srpCredentials } from './srp-credentials';
export { syncClients, syncGlobalVersion, syncObjects } from './sync';
export { users } from './users';
