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

import type { oauthIdentities } from '../entities';
import type { ITxContext } from '../services/db-adaptor.service';
import { createIdentifier } from '@termlnk-server/core';

export type IOAuthIdentityRow = typeof oauthIdentities.$inferSelect;

export interface IOAuthIdentityUpsertParams {
  provider: string;
  providerUserId: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface IOAuthIdentitiesRepository {
  findByProviderUserId(provider: string, providerUserId: string, tx?: ITxContext): Promise<IOAuthIdentityRow | null>;
  /** Insert, or refresh the denormalized profile fields on `(provider, providerUserId)` conflict. */
  upsert(values: IOAuthIdentityUpsertParams, tx?: ITxContext): Promise<void>;
}

export const IOAuthIdentitiesRepository = createIdentifier<IOAuthIdentitiesRepository>('database.oauth-identities-repository');
