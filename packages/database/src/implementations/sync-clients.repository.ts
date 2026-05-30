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

import type { ISyncClientsRepository, ISyncClientState } from '../repositories/sync-clients.repository';
import type { ITxContext } from '../services/db-adaptor.service';
import { and, eq } from 'drizzle-orm';
import { syncClients } from '../entities';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { pgExec } from './_helpers';

export class PgSyncClientsRepository implements ISyncClientsRepository {
  constructor(
    @IDBAdaptorService private readonly _adaptor: IDBAdaptorService
  ) {}

  async ensureExists(userId: string, clientId: string, tx: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db.insert(syncClients).values({ userId, clientId, lastMutationId: 0 }).onConflictDoNothing();
  }

  async findOne(userId: string, clientId: string, tx?: ITxContext): Promise<ISyncClientState | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .select({ lastMutationId: syncClients.lastMutationId })
      .from(syncClients)
      .where(and(eq(syncClients.userId, userId), eq(syncClients.clientId, clientId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async update(
    userId: string,
    clientId: string,
    lastMutationId: number,
    lastSeenAt: Date,
    tx: ITxContext
  ): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .update(syncClients)
      .set({ lastMutationId, lastSeenAt })
      .where(and(eq(syncClients.userId, userId), eq(syncClients.clientId, clientId)));
  }

  async touchLastSeen(userId: string, clientId: string, lastSeenAt: Date, tx: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .update(syncClients)
      .set({ lastSeenAt })
      .where(and(eq(syncClients.userId, userId), eq(syncClients.clientId, clientId)));
  }
}
