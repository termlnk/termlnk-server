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

import type { IOAuthIdentitiesRepository, IOAuthIdentityRow, IOAuthIdentityUpsertParams } from '../repositories/oauth-identities.repository';
import type { ITxContext } from '../services/db-adaptor.service';
import { and, eq } from 'drizzle-orm';
import { oauthIdentities } from '../entities';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { pgExec } from './_helpers';

export class PgOAuthIdentitiesRepository implements IOAuthIdentitiesRepository {
  constructor(
    @IDBAdaptorService private readonly _adaptor: IDBAdaptorService
  ) {}

  async findByProviderUserId(provider: string, providerUserId: string, tx?: ITxContext): Promise<IOAuthIdentityRow | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .select()
      .from(oauthIdentities)
      .where(and(eq(oauthIdentities.provider, provider), eq(oauthIdentities.providerUserId, providerUserId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsert(values: IOAuthIdentityUpsertParams, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .insert(oauthIdentities)
      .values({
        provider: values.provider,
        providerUserId: values.providerUserId,
        userId: values.userId,
        email: values.email,
        displayName: values.displayName,
        avatarUrl: values.avatarUrl,
      })
      .onConflictDoUpdate({
        target: [oauthIdentities.provider, oauthIdentities.providerUserId],
        set: {
          email: values.email,
          displayName: values.displayName,
          avatarUrl: values.avatarUrl,
          updatedAt: new Date(),
        },
      });
  }
}
