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

/**
 * Public surface of @termlnk-server/database.
 *
 * The Postgres adaptor is NOT re-exported from the root entry — `pg` is a
 * Node-only driver. Import it by subpath:
 *
 *   import { NodePgAdaptor } from '@termlnk-server/database/node-pg';
 *
 * Schema entities and repository interfaces also live behind subpaths so the
 * root entry stays free of drizzle-orm pg-core type imports.
 */

export { DATABASE_PLUGIN_CONFIG_KEY } from './config.schema';
export type { IDatabaseConfig } from './config.schema';
export { DATABASE_PLUGIN_NAME, DatabasePlugin } from './plugin';
export type { ITxContext } from './services/db-adaptor.service';
export { IDBAdaptorService } from './services/db-adaptor.service';
export type { IMigrationRunner } from './services/migration-runner.service';
