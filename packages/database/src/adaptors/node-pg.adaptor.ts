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

import type { Nullable } from '@termlnk-server/core';
import type { EmptyRelations } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PoolConfig } from 'pg';
import type { IDBAdaptorService, ITxContext } from '../services/db-adaptor.service';
import type { IMigrationRunner } from '../services/migration-runner.service';
import { Disposable } from '@termlnk-server/core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export type NodePgDrizzle = NodePgDatabase<EmptyRelations>;

export interface INodePgAdaptorOptions {
  connectionString: string;
  /** Default 20 — same as the legacy apps/server config. */
  max?: number;
  /** drizzle-kit output folder. Required for `runMigrations()`. */
  migrationsFolder?: string;
  /** Override the migrations table; default `__drizzle_migrations`. */
  migrationsTable?: string;
  /** Pass-through for any `pg.Pool` knob not surfaced above. */
  pool?: Omit<PoolConfig, 'connectionString' | 'max'>;
}

/**
 * Node-only adaptor: classic `pg.Pool` driving drizzle-orm/node-postgres.
 *
 * This is the default for self-hosted Node deployments. Uses pooled connections,
 * supports advisory locks / LISTEN / NOTIFY / `SELECT FOR UPDATE` — i.e. the full
 * Postgres feature surface that the sync engine relies on.
 */
export class NodePgAdaptor extends Disposable implements IDBAdaptorService, IMigrationRunner {
  private _pool: Nullable<Pool>;
  private _db: Nullable<NodePgDrizzle>;

  constructor(private readonly _options: INodePgAdaptorOptions) {
    super();
  }

  get db(): NodePgDrizzle {
    if (!this._db) {
      throw new Error('[NodePgAdaptor] Database not initialized. Call initialize() first.');
    }
    return this._db;
  }

  async initialize(): Promise<void> {
    if (this._db) {
      return;
    }
    this._pool = new Pool({
      connectionString: this._options.connectionString,
      max: this._options.max ?? 20,
      ...this._options.pool,
    });
    this._db = drizzle({ client: this._pool }) as unknown as NodePgDrizzle;
  }

  async close(): Promise<void> {
    if (this._pool) {
      await this._pool.end();
      this._pool = null;
      this._db = null;
    }
  }

  override dispose(): void {
    super.dispose();
    void this.close();
  }

  async transaction<T>(work: (tx: ITxContext) => Promise<T>): Promise<T> {
    return this.db.transaction(async (drizzleTx) => work(drizzleTx as unknown as ITxContext));
  }

  /** Apply outstanding migrations. Caller must have called `initialize()` first. */
  async runMigrations(): Promise<void> {
    if (!this._options.migrationsFolder) {
      throw new Error('[NodePgAdaptor] migrationsFolder is required for runMigrations()');
    }
    await migrate(this.db, {
      migrationsFolder: this._options.migrationsFolder,
      migrationsTable: this._options.migrationsTable,
    });
  }
}
