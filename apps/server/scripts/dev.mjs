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

// Dev supervisor — watches monorepo sources and respawns the entry on change.
// The supervisor itself loads no project code; it only forks `scripts/run.mjs`
// children, so HTTP ports, DB pools, and WebSocket connections are guaranteed
// fresh on every restart (no in-place HMR side effects to debug).

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(__dirname, '..');
const monorepoRoot = resolve(serverRoot, '../..');
const runScript = resolve(__dirname, 'run.mjs');
const entry = process.argv[2] ?? 'src/index.ts';

const debounceMs = 150;
const killTimeoutMs = 3000;

let child = null;
let restartTimer = null;
let killTimer = null;
let pendingRestart = false;
let shuttingDown = false;

function spawnChild() {
  child = spawn(
    process.execPath,
    ['--enable-source-maps', runScript, entry],
    { stdio: 'inherit', cwd: serverRoot }
  );
  child.on('exit', () => {
    clearTimeout(killTimer);
    child = null;
    if (shuttingDown) return;
    if (pendingRestart) {
      pendingRestart = false;
      spawnChild();
    }
  });
}

function restart() {
  if (shuttingDown) return;
  if (!child) {
    spawnChild();
    return;
  }
  pendingRestart = true;
  child.kill('SIGTERM');
  killTimer = setTimeout(() => {
    if (child) child.kill('SIGKILL');
  }, killTimeoutMs);
}

function scheduleRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(restart, debounceMs);
}

const watcher = chokidar.watch(
  [
    resolve(serverRoot, 'src'),
    resolve(monorepoRoot, 'packages'),
    resolve(monorepoRoot, 'internal/shared'),
  ],
  {
    ignoreInitial: true,
    ignored: (path) => /node_modules|[\\/]dist[\\/]|\.sql$|[\\/]migrations[\\/]/.test(path),
  }
);
watcher.on('all', scheduleRestart);

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  watcher.close();
  if (child) child.kill(signal);
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

spawnChild();
