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

import type { Ctor } from '@termlnk-server/core';
import type { IDBAdaptorService } from './services/db-adaptor.service';

export const DATABASE_PLUGIN_CONFIG_KEY = 'database.config';

/** A constructor that produces a connected `IDBAdaptorService`. */
export type DBAdaptorCtor = Ctor<IDBAdaptorService>;

export interface IDatabaseConfig {
  /**
   * The adaptor instance to drive Drizzle. Constructed in the entrypoint
   * (apps/server) where the Postgres connection string is environment-specific.
   */
  dbAdaptor?: IDBAdaptorService;
  /** When false, skip `initialize()` (caller already initialized externally). */
  autoInitialize?: boolean;
}

export const defaultPluginConfig: IDatabaseConfig = {
  autoInitialize: true,
};
