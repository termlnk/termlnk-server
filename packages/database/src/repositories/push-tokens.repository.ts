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

export interface IPushTokenInsertParams {
  userId: string;
  deviceToken: string;
  platform: string;
  userAgent: string | null;
}

export interface IPushTokensRepository {
  /**
   * Soft re-assignment: drop any prior row for `deviceToken` (across users) and
   * insert the new owner. Caller wraps this in a transaction so the swap is atomic.
   */
  deleteByDeviceToken(deviceToken: string, tx: ITxContext): Promise<void>;
  insert(values: IPushTokenInsertParams, tx: ITxContext): Promise<void>;
  /** Hard delete a specific (userId, deviceToken) registration. */
  delete(userId: string, deviceToken: string, tx?: ITxContext): Promise<void>;
}

export const IPushTokensRepository = createIdentifier<IPushTokensRepository>('database.push-tokens-repository');
