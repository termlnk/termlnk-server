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

import type { ITxContext } from '../services/db-adaptor.service';
import { createIdentifier } from '@termlnk-server/core';

export interface ISrpCredentialInsertParams {
  userId: string;
  argon2SaltB64: string;
  srpSalt: string;
  srpVerifier: string;
}

export interface ISrpCredentialView {
  argon2SaltB64: string;
  srpSalt: string;
  srpVerifier: string;
}

export interface ISrpCredentialsRepository {
  insert(values: ISrpCredentialInsertParams, tx?: ITxContext): Promise<void>;
  /** Insert, or replace the SRP triple on `userId` conflict (re-keying / OAuth setup). */
  upsert(values: ISrpCredentialInsertParams, tx?: ITxContext): Promise<void>;
  /**
   * Resolve the SRP triple for a user identified by email — server-side join so
   * the dialect's join planner can do the lookup in one round trip.
   */
  findByEmail(email: string, tx?: ITxContext): Promise<ISrpCredentialView | null>;
  /** Direct lookup by userId — used to decide whether a password is already set. */
  findByUserId(userId: string, tx?: ITxContext): Promise<ISrpCredentialView | null>;
}

export const ISrpCredentialsRepository = createIdentifier<ISrpCredentialsRepository>('database.srp-credentials-repository');
