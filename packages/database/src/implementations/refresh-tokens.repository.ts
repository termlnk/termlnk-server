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

import type { IRefreshTokenInsertParams, IRefreshTokenRow, IRefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import type { ITxContext } from '../services/db-adaptor.service';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { refreshTokens } from '../entities';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { pgExec } from './_helpers';

export class PgRefreshTokensRepository implements IRefreshTokensRepository {
  constructor(
    @IDBAdaptorService private readonly _adaptor: IDBAdaptorService
  ) {

  }

  async insertReturningJti(values: IRefreshTokenInsertParams, tx?: ITxContext): Promise<{ jti: string }> {
    const db = pgExec(this._adaptor, tx);
    const [row] = await db.insert(refreshTokens).values({
      userId: values.userId,
      expiresAt: values.expiresAt,
      deviceName: values.deviceName,
      userAgent: values.userAgent,
    }).returning({ jti: refreshTokens.jti });
    if (!row) {
      throw new Error('[PgRefreshTokensRepository.insertReturningJti] returning() yielded no row');
    }
    return row;
  }

  async findActiveByJti(jti: string, tx?: ITxContext): Promise<IRefreshTokenRow | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.jti, jti), isNull(refreshTokens.revokedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async revokeByJti(jti: string, revokedAt: Date, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db.update(refreshTokens).set({ revokedAt }).where(eq(refreshTokens.jti, jti));
  }

  async listActiveByUserId(userId: string, now: Date, tx?: ITxContext): Promise<IRefreshTokenRow[]> {
    const db = pgExec(this._adaptor, tx);
    return db
      .select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, now)
      ))
      .orderBy(desc(refreshTokens.lastSeenAt));
  }

  async revokeOneByUserId(userId: string, jti: string, revokedAt: Date, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .update(refreshTokens)
      .set({ revokedAt })
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.jti, jti),
        isNull(refreshTokens.revokedAt)
      ));
  }

  async revokeAllByUserId(userId: string, revokedAt: Date, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .update(refreshTokens)
      .set({ revokedAt })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }
}
