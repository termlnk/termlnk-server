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

import type { EmptyRelations } from 'drizzle-orm';
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { IDBAdaptorService, ITxContext } from '../services/db-adaptor.service';

/**
 * Lowest-common-denominator drizzle handle the repositories work against.
 * `NodePgAdaptor.db` returns a subtype of this. Repositories only need the
 * imperative builder surface, so this is the right common ground.
 */
export type PgDb = PgAsyncDatabase<PgQueryResultHKT, EmptyRelations>;

interface IPgAdaptorWithDb {
  readonly db: PgDb;
}

/**
 * Resolve the drizzle executor — the active transaction handle if one is
 * passed, otherwise the adaptor's default pool-backed handle.
 *
 * The cast is the seam between the opaque `ITxContext` on the repository
 * interface and the concrete `PgTransaction` (a subtype of `PgDb`) that drizzle
 * hands back inside `db.transaction()`.
 */
export function pgExec(adaptor: IDBAdaptorService, tx?: ITxContext): PgDb {
  if (tx !== undefined) {
    return tx as unknown as PgDb;
  }
  return (adaptor as unknown as IPgAdaptorWithDb).db;
}

/** PG SQLSTATE `23505` = unique_violation. */
export function isPgUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const cause = err.cause;
  if (!cause || typeof cause !== 'object' || !('code' in cause)) {
    return false;
  }
  return (cause as { code: unknown }).code === '23505';
}
