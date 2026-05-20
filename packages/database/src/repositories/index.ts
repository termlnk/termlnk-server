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
 * Repository identifiers + interface + DTO surface. Service-layer code imports
 * from here exclusively — never from `entities`. Repository interfaces stay
 * driver-agnostic so service code reads as plain DTO calls.
 */

export type { ICollabInviteInsertParams, ICollabInviteRow } from './collab-invites.repository';

export { ICollabInvitesRepository } from './collab-invites.repository';
export { UniqueViolationError } from './errors';

export type {
  IMultiplayerAnnouncementRow,
  IMultiplayerAnnouncementUpsertParams,
} from './multiplayer-announcements.repository';
export { IMultiplayerAnnouncementsRepository } from './multiplayer-announcements.repository';

export type { IPushTokenInsertParams } from './push-tokens.repository';
export { IPushTokensRepository } from './push-tokens.repository';

export type { IRefreshTokenInsertParams, IRefreshTokenRow } from './refresh-tokens.repository';
export { IRefreshTokensRepository } from './refresh-tokens.repository';

export type { ISrpCredentialInsertParams, ISrpCredentialView } from './srp-credentials.repository';
export { ISrpCredentialsRepository } from './srp-credentials.repository';

export { ISyncClientsRepository } from './sync-clients.repository';
export type { ISyncClientState } from './sync-clients.repository';

export { ISyncGlobalVersionRepository } from './sync-global-version.repository';

export type { ISyncObjectRow, ISyncObjectWriteParams } from './sync-objects.repository';
export { ISyncObjectsRepository } from './sync-objects.repository';

export type { IUserInsertParams, IUserRow } from './users.repository';
export { IUsersRepository } from './users.repository';
