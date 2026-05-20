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

/**
 * Row shape for sync objects. The `payload` column is `bytea` in Postgres and
 * surfaces as `Buffer` here.
 */
export interface ISyncObjectRow {
  userId: string;
  resource: string;
  entityId: string;
  payload: Buffer | null;
  version: number;
  deleted: boolean;
  updatedAt: Date;
}

export interface ISyncObjectWriteParams {
  userId: string;
  resource: string;
  entityId: string;
  payload: Buffer | null;
  version: number;
  deleted: boolean;
}

export interface ISyncObjectsRepository {
  findOne(userId: string, resource: string, entityId: string, tx: ITxContext): Promise<ISyncObjectRow | null>;
  /** Pull: ORDER BY version, WHERE version > cursorVersion. */
  listByResourceAfterVersion(
    userId: string,
    resource: string,
    cursorVersion: number,
    tx?: ITxContext
  ): Promise<ISyncObjectRow[]>;
  insert(values: ISyncObjectWriteParams, tx: ITxContext): Promise<void>;
  update(values: ISyncObjectWriteParams & { updatedAt: Date }, tx: ITxContext): Promise<void>;
}

export const ISyncObjectsRepository = createIdentifier<ISyncObjectsRepository>('database.sync-objects-repository');
