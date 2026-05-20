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

export interface ISyncClientState {
  lastMutationId: number;
}

export interface ISyncClientsRepository {
  /** Idempotently ensure the (userId, clientId) row exists with `lastMutationId = 0`. */
  ensureExists(userId: string, clientId: string, tx: ITxContext): Promise<void>;
  findOne(userId: string, clientId: string, tx?: ITxContext): Promise<ISyncClientState | null>;
  update(
    userId: string,
    clientId: string,
    lastMutationId: number,
    lastSeenAt: Date,
    tx: ITxContext
  ): Promise<void>;
  touchLastSeen(userId: string, clientId: string, lastSeenAt: Date, tx: ITxContext): Promise<void>;
}

export const ISyncClientsRepository = createIdentifier<ISyncClientsRepository>('database.sync-clients-repository');
