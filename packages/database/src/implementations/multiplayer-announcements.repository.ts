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

import type { IMultiplayerAnnouncementRow, IMultiplayerAnnouncementsRepository, IMultiplayerAnnouncementUpsertParams } from '../repositories/multiplayer-announcements.repository';
import type { ITxContext } from '../services/db-adaptor.service';
import { and, desc, eq, gte, lt, ne } from 'drizzle-orm';
import { multiplayerAnnouncements } from '../entities';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { pgExec } from './_helpers';

export class PgMultiplayerAnnouncementsRepository implements IMultiplayerAnnouncementsRepository {
  constructor(
    @IDBAdaptorService private readonly _adaptor: IDBAdaptorService
  ) {}

  async upsert(values: IMultiplayerAnnouncementUpsertParams, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    const now = new Date();
    await db
      .insert(multiplayerAnnouncements)
      .values({
        userId: values.userId,
        deviceId: values.deviceId,
        sessionId: values.sessionId,
        title: values.title,
        cols: values.cols,
        rows: values.rows,
        announcedAt: now,
        lastHeartbeatAt: now,
        deviceClock: values.deviceClock,
      })
      .onConflictDoUpdate({
        target: [
          multiplayerAnnouncements.userId,
          multiplayerAnnouncements.deviceId,
          multiplayerAnnouncements.sessionId,
        ],
        set: {
          title: values.title,
          cols: values.cols,
          rows: values.rows,
          lastHeartbeatAt: now,
          deviceClock: values.deviceClock,
        },
      });
  }

  async delete(userId: string, deviceId: string, sessionId: string, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .delete(multiplayerAnnouncements)
      .where(and(
        eq(multiplayerAnnouncements.userId, userId),
        eq(multiplayerAnnouncements.deviceId, deviceId),
        eq(multiplayerAnnouncements.sessionId, sessionId)
      ));
  }

  async deleteAllByDevice(userId: string, deviceId: string, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .delete(multiplayerAnnouncements)
      .where(and(
        eq(multiplayerAnnouncements.userId, userId),
        eq(multiplayerAnnouncements.deviceId, deviceId)
      ));
  }

  async listFresh(
    userId: string,
    freshSince: Date,
    excludeDeviceId?: string,
    tx?: ITxContext
  ): Promise<IMultiplayerAnnouncementRow[]> {
    const db = pgExec(this._adaptor, tx);
    const conditions = [
      eq(multiplayerAnnouncements.userId, userId),
      gte(multiplayerAnnouncements.lastHeartbeatAt, freshSince),
    ];
    if (excludeDeviceId) {
      conditions.push(ne(multiplayerAnnouncements.deviceId, excludeDeviceId));
    }
    return db
      .select()
      .from(multiplayerAnnouncements)
      .where(and(...conditions))
      .orderBy(desc(multiplayerAnnouncements.lastHeartbeatAt));
  }

  async sweepStale(staleBefore: Date, tx?: ITxContext): Promise<number> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .delete(multiplayerAnnouncements)
      .where(lt(multiplayerAnnouncements.lastHeartbeatAt, staleBefore))
      .returning({ sessionId: multiplayerAnnouncements.sessionId });
    return rows.length;
  }
}
