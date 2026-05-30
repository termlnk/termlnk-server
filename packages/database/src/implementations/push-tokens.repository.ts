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

import type { IPushTokenInsertParams, IPushTokensRepository } from '../repositories/push-tokens.repository';
import type { ITxContext } from '../services/db-adaptor.service';
import { and, eq } from 'drizzle-orm';
import { pushTokens } from '../entities';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { pgExec } from './_helpers';

export class PgPushTokensRepository implements IPushTokensRepository {
  constructor(
    @IDBAdaptorService private readonly _adaptor: IDBAdaptorService
  ) {}

  async deleteByDeviceToken(deviceToken: string, tx: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db.delete(pushTokens).where(eq(pushTokens.deviceToken, deviceToken));
  }

  async insert(values: IPushTokenInsertParams, tx: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db.insert(pushTokens).values({
      userId: values.userId,
      deviceToken: values.deviceToken,
      platform: values.platform,
      userAgent: values.userAgent,
    });
  }

  async delete(userId: string, deviceToken: string, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .delete(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.deviceToken, deviceToken)));
  }
}
