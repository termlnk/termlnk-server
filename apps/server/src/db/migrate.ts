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
 * Standalone migration runner — invoked by `pnpm db:migrate`. Production
 * deployments typically let `apps/server/src/index.ts` run migrations on boot;
 * this CLI exists for CI / ops "apply schema before traffic" workflows.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { NodePgAdaptor } from '@termlnk-server/database/node-pg';

function locateMigrationsFolder(here: string): string {
  const candidates = [
    resolve(here, './migrations'),
    resolve(here, '../../../../packages/database/src/migrations'),
    resolve(process.cwd(), '../../packages/database/src/migrations'),
    resolve(process.cwd(), 'packages/database/src/migrations'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return p;
    }
  }
  throw new Error(`[migrate] cannot locate migrations folder; tried:\n  - ${candidates.join('\n  - ')}`);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL env is required');
    process.exit(1);
  }
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = locateMigrationsFolder(__dirname);
  const adaptor = new NodePgAdaptor({ connectionString: url, migrationsFolder });
  try {
    await adaptor.initialize();
    await adaptor.runMigrations();
    console.log('[migrate] applied');
  } finally {
    await adaptor.close();
  }
}

void main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
