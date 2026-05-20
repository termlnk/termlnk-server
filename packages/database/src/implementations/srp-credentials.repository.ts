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
  ISrpCredentialInsertParams,
  ISrpCredentialsRepository,
  ISrpCredentialView,
} from '../repositories/srp-credentials.repository';
import type { IDBAdaptorService, ITxContext } from '../services/db-adaptor.service';
import { eq } from 'drizzle-orm';
import { srpCredentials, users } from '../entities';
import { pgExec } from './_helpers';

export class PgSrpCredentialsRepository implements ISrpCredentialsRepository {
  constructor(private readonly _adaptor: IDBAdaptorService) {}

  async insert(values: ISrpCredentialInsertParams, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db.insert(srpCredentials).values({
      userId: values.userId,
      argon2SaltB64: values.argon2SaltB64,
      srpSalt: values.srpSalt,
      srpVerifier: values.srpVerifier,
    });
  }

  async findByEmail(email: string, tx?: ITxContext): Promise<ISrpCredentialView | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .select({
        argon2SaltB64: srpCredentials.argon2SaltB64,
        srpSalt: srpCredentials.srpSalt,
        srpVerifier: srpCredentials.srpVerifier,
      })
      .from(srpCredentials)
      .innerJoin(users, eq(srpCredentials.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);
    return rows[0] ?? null;
  }
}
