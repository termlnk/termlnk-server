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

import type { ITxContext } from '@termlnk-server/database';
import { createIdentifier } from '@termlnk-server/core';
import { IDBAdaptorService } from '@termlnk-server/database';
import { adminUsers } from '@termlnk-server/database/entities';
import { isPgUniqueViolation, pgExec } from '@termlnk-server/database/helpers';
import { UniqueViolationError } from '@termlnk-server/database/repositories';
import { eq, sql } from 'drizzle-orm';

export type IAdminUserRow = typeof adminUsers.$inferSelect;

export interface IAdminUserInsertParams {
  email: string;
  passwordHash: string;
  displayName: string | null;
}

export interface IAdminUsersRepository {
  insert(values: IAdminUserInsertParams, tx?: ITxContext): Promise<IAdminUserRow>;
  findByEmail(email: string, tx?: ITxContext): Promise<IAdminUserRow | null>;
  findById(id: string, tx?: ITxContext): Promise<IAdminUserRow | null>;
  count(tx?: ITxContext): Promise<number>;
  updateLastLoginAt(id: string, tx?: ITxContext): Promise<void>;
  updatePasswordHash(id: string, passwordHash: string, tx?: ITxContext): Promise<void>;
}

export const IAdminUsersRepository = createIdentifier<IAdminUsersRepository>('admin.admin-users-repository');

export class PgAdminUsersRepository implements IAdminUsersRepository {
  constructor(
    @IDBAdaptorService private readonly _adaptor: IDBAdaptorService
  ) {}

  async insert(values: IAdminUserInsertParams, tx?: ITxContext): Promise<IAdminUserRow> {
    const db = pgExec(this._adaptor, tx);
    try {
      const [row] = await db.insert(adminUsers).values({
        email: values.email,
        passwordHash: values.passwordHash,
        displayName: values.displayName,
      }).returning();
      if (!row) {
        throw new Error('[PgAdminUsersRepository.insert] returning() yielded no row');
      }
      return row;
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        throw new UniqueViolationError('admin_users', { cause: err });
      }
      throw err;
    }
  }

  async findByEmail(email: string, tx?: ITxContext): Promise<IAdminUserRow | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    return rows[0] ?? null;
  }

  async findById(id: string, tx?: ITxContext): Promise<IAdminUserRow | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async count(tx?: ITxContext): Promise<number> {
    const db = pgExec(this._adaptor, tx);
    const [result] = await db.select({ value: sql<number>`count(*)::int` }).from(adminUsers);
    return result?.value ?? 0;
  }

  async updateLastLoginAt(id: string, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, id));
  }

  async updatePasswordHash(id: string, passwordHash: string, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db.update(adminUsers).set({ passwordHash, updatedAt: new Date() }).where(eq(adminUsers.id, id));
  }
}
