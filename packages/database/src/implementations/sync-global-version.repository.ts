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

import type { ISyncGlobalVersionRepository } from '../repositories/sync-global-version.repository';
import type { ITxContext } from '../services/db-adaptor.service';
import { eq } from 'drizzle-orm';
import { syncGlobalVersion } from '../entities';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { pgExec } from './_helpers';

export class PgSyncGlobalVersionRepository implements ISyncGlobalVersionRepository {
  constructor(
    @IDBAdaptorService private readonly _adaptor: IDBAdaptorService
  ) {}

  async ensureExists(userId: string, tx: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db.insert(syncGlobalVersion).values({ userId, current: 0 }).onConflictDoNothing();
  }

  async findCurrentForUpdate(userId: string, tx: ITxContext): Promise<number> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .select()
      .from(syncGlobalVersion)
      .where(eq(syncGlobalVersion.userId, userId))
      .for('update')
      .limit(1);
    return rows[0]?.current ?? 0;
  }

  async findCurrent(userId: string, tx?: ITxContext): Promise<number> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .select({ current: syncGlobalVersion.current })
      .from(syncGlobalVersion)
      .where(eq(syncGlobalVersion.userId, userId))
      .limit(1);
    return rows[0]?.current ?? 0;
  }

  async update(userId: string, current: number, tx: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .update(syncGlobalVersion)
      .set({ current })
      .where(eq(syncGlobalVersion.userId, userId));
  }
}
