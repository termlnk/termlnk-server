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

import type {
  ISyncObjectRow,
  ISyncObjectsRepository,
  ISyncObjectWriteParams,
} from '../repositories/sync-objects.repository';
import type { IDBAdaptorService, ITxContext } from '../services/db-adaptor.service';
import { and, eq, gt } from 'drizzle-orm';
import { syncObjects } from '../entities';
import { pgExec } from './_helpers';

export class PgSyncObjectsRepository implements ISyncObjectsRepository {
  constructor(private readonly _adaptor: IDBAdaptorService) {}

  async findOne(userId: string, resource: string, entityId: string, tx: ITxContext): Promise<ISyncObjectRow | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .select()
      .from(syncObjects)
      .where(and(
        eq(syncObjects.userId, userId),
        eq(syncObjects.resource, resource),
        eq(syncObjects.entityId, entityId)
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByResourceAfterVersion(
    userId: string,
    resource: string,
    cursorVersion: number,
    tx?: ITxContext
  ): Promise<ISyncObjectRow[]> {
    const db = pgExec(this._adaptor, tx);
    return db
      .select()
      .from(syncObjects)
      .where(and(
        eq(syncObjects.userId, userId),
        eq(syncObjects.resource, resource),
        gt(syncObjects.version, cursorVersion)
      ))
      .orderBy(syncObjects.version);
  }

  async insert(values: ISyncObjectWriteParams, tx: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db.insert(syncObjects).values({
      userId: values.userId,
      resource: values.resource,
      entityId: values.entityId,
      payload: values.payload,
      version: values.version,
      deleted: values.deleted,
    });
  }

  async update(
    values: ISyncObjectWriteParams & { updatedAt: Date },
    tx: ITxContext
  ): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .update(syncObjects)
      .set({
        payload: values.payload,
        version: values.version,
        deleted: values.deleted,
        updatedAt: values.updatedAt,
      })
      .where(and(
        eq(syncObjects.userId, values.userId),
        eq(syncObjects.resource, values.resource),
        eq(syncObjects.entityId, values.entityId)
      ));
  }
}
