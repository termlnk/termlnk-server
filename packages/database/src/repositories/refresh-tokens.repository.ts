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

import type { refreshTokens } from '../entities';
import type { ITxContext } from '../services/db-adaptor.service';
import { createIdentifier } from '@termlnk-server/core';

export type IRefreshTokenRow = typeof refreshTokens.$inferSelect;

export interface IRefreshTokenInsertParams {
  userId: string;
  expiresAt: Date;
  deviceName: string | null;
  userAgent: string | null;
}

export interface IRefreshTokensRepository {
  /** Insert and return the generated jti (the only column the caller needs back). */
  insertReturningJti(values: IRefreshTokenInsertParams, tx?: ITxContext): Promise<{ jti: string }>;
  /** Lookup by jti, filtering rows with `revoked_at IS NOT NULL`. Expiry is left to the caller. */
  findActiveByJti(jti: string, tx?: ITxContext): Promise<IRefreshTokenRow | null>;
  /** Revoke a single token by jti. No-op if already revoked. */
  revokeByJti(jti: string, revokedAt: Date, tx?: ITxContext): Promise<void>;
  /** List the user's non-revoked, non-expired tokens, newest-touched first. */
  listActiveByUserId(userId: string, now: Date, tx?: ITxContext): Promise<IRefreshTokenRow[]>;
  /** Revoke a single token scoped to userId — used by the device-list UI. */
  revokeOneByUserId(userId: string, jti: string, revokedAt: Date, tx?: ITxContext): Promise<void>;
  /** Revoke every non-revoked token of the user — `logoutAll`. */
  revokeAllByUserId(userId: string, revokedAt: Date, tx?: ITxContext): Promise<void>;
}

export const IRefreshTokensRepository = createIdentifier<IRefreshTokensRepository>('database.refresh-tokens-repository');
