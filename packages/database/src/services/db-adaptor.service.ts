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

import { createIdentifier } from '@termlnk-server/core';

declare const TxBrand: unique symbol;

/**
 * Opaque transaction handle. Repositories cast this back to drizzle's
 * `PgTransaction` before issuing queries. Service-layer code never inspects
 * it; it only routes it from `IDBAdaptorService.transaction()` into repository
 * methods.
 */
export interface ITxContext {
  readonly [TxBrand]: never;
}

/**
 * Lifecycle + transaction surface for the Postgres adaptor. The concrete
 * `NodePgAdaptor` extends this with a `db` field repository implementations
 * read directly.
 */
export interface IDBAdaptorService {
  initialize(): Promise<void>;
  close(): Promise<void>;
  /**
   * Run `work` inside a single transaction. The handle is opaque at this
   * layer — repositories cast it to drizzle's `PgTransaction` to issue queries.
   */
  transaction<T>(work: (tx: ITxContext) => Promise<T>): Promise<T>;
}

export const IDBAdaptorService = createIdentifier<IDBAdaptorService>('database.db-adaptor-service');
