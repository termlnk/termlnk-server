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

import type { IUserInsertParams, IUserRow, IUsersRepository } from '../repositories/users.repository';
import type { ITxContext } from '../services/db-adaptor.service';
import { eq } from 'drizzle-orm';
import { users } from '../entities';
import { UniqueViolationError } from '../repositories/errors';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { isPgUniqueViolation, pgExec } from './_helpers';

export class PgUsersRepository implements IUsersRepository {
  constructor(
    @IDBAdaptorService private readonly _adaptor: IDBAdaptorService
  ) {

  }

  async insert(values: IUserInsertParams, tx?: ITxContext): Promise<IUserRow> {
    const db = pgExec(this._adaptor, tx);
    try {
      const [row] = await db.insert(users).values({
        email: values.email,
        displayName: values.displayName,
        emailVerified: values.emailVerified,
      }).returning();
      if (!row) {
        throw new Error('[PgUsersRepository.insert] returning() yielded no row');
      }
      return row;
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        throw new UniqueViolationError('users', { cause: err });
      }
      throw err;
    }
  }

  async findById(id: string, tx?: ITxContext): Promise<IUserRow | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByEmail(email: string, tx?: ITxContext): Promise<IUserRow | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ?? null;
  }
}
