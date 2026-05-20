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

export interface ISyncGlobalVersionRepository {
  /** Idempotently ensure the per-user row exists with `current = 0`. */
  ensureExists(userId: string, tx: ITxContext): Promise<void>;
  /**
   * Lock the per-user row and return its current version via `SELECT ... FOR
   * UPDATE`. Returns 0 when the row was just-inserted by `ensureExists`.
   */
  findCurrentForUpdate(userId: string, tx: ITxContext): Promise<number>;
  /** Non-transactional read of the current version. Returns 0 when no row exists. */
  findCurrent(userId: string, tx?: ITxContext): Promise<number>;
  update(userId: string, current: number, tx: ITxContext): Promise<void>;
}

export const ISyncGlobalVersionRepository = createIdentifier<ISyncGlobalVersionRepository>(
  'database.sync-global-version-repository'
);
