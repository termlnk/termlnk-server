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
 */

// Generic "node + Vite SSR pipeline" runner — replaces `tsx <entry>`.
// The child process spawned by scripts/dev.mjs uses this to actually load the
// entry through Vite's plugin pipeline (per-file tsconfig resolution, monorepo
// source imports inlined via ssr.noExternal in vite.config.ts).

import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';
import { createServer } from 'vite';

const entry = process.argv[2];
if (!entry) {
  console.error('Usage: node scripts/run.mjs <entry.ts>');
  process.exit(1);
}

const root = process.cwd();
const entryPath = isAbsolute(entry) ? entry : resolve(root, entry);

const vite = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});

const ssrEnv = vite.environments.ssr;
if (ssrEnv && 'runner' in ssrEnv && ssrEnv.runner) {
  await ssrEnv.runner.import(entryPath);
} else {
  await vite.ssrLoadModule(entryPath);
}
