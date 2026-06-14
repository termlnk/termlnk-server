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

import type { Plugin } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

function copyMigrations(): Plugin {
  return {
    name: 'termlnk:copy-migrations',
    apply: 'build',
    writeBundle(options) {
      const src = resolve(import.meta.dirname, '../../packages/database/src/migrations');
      const dest = resolve(options.dir ?? 'dist', 'migrations');
      cpSync(src, dest, { recursive: true });
    },
  };
}

function copyAdminSpa(): Plugin {
  return {
    name: 'termlnk:copy-admin-spa',
    apply: 'build',
    writeBundle(options) {
      const src = resolve(import.meta.dirname, '../admin-ui/dist');
      const dest = resolve(options.dir ?? 'dist', 'admin-ui');
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  build: {
    ssr: true,
    target: 'node22',
    outDir: 'dist',
    minify: false,
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        migrate: resolve(import.meta.dirname, 'src/db/migrate.ts'),
        'reset-admin-password': resolve(import.meta.dirname, 'src/cli/reset-admin-password.ts'),
      },
      output: {
        format: 'esm',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
  ssr: {
    // workspace packages export raw .ts source → inline them so Vite transforms
    // each file using its own package's tsconfig (the very thing tsx couldn't
    // do in monorepos).
    noExternal: [/^@termlnk-server\//, /^@termlnk\//],
    // pino loads transports (pino-pretty etc.) by inspecting the caller stack;
    // Vite's SSR module wrapper rewrites the stack so pino can't resolve them.
    // Force pino + its transports + thread-stream to Node's native resolver.
    external: ['pino', 'pino-pretty', 'thread-stream', 'pino-worker', 'pino-file'],
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [copyMigrations(), copyAdminSpa()],
});
