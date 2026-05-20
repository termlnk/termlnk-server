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
 * termlnk-server Node entrypoint — assembles the Core + plugin chain.
 *
 *   loadEnv  →  build adaptors  →  Core.registerPlugins(...)  →  Core.start()
 *
 * Plugin order at registration time doesn't matter — `@DependentOn` ensures
 * RpcServerPlugin and DatabasePlugin boot before the feature plugins. After
 * `core.start()` the root Hono app is ready (every feature plugin mounted its
 * router in onReady), and we hand it to @hono/node-server.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { AuthPlugin } from '@termlnk-server/auth';
import { CollabPlugin } from '@termlnk-server/collab';
import { Core, LogLevel } from '@termlnk-server/core';
import { IHmacService, IJwtService, ISrpService, JoseJwtService, WebCryptoHmacService } from '@termlnk-server/crypto';
import { NodeSrpService } from '@termlnk-server/crypto/node-srp';
import { DatabasePlugin } from '@termlnk-server/database';
import { NodePgAdaptor } from '@termlnk-server/database/node-pg';
import { IKVStore } from '@termlnk-server/kv';
import { IoredisKVStore } from '@termlnk-server/kv/ioredis';
import { MultiplayerPlugin } from '@termlnk-server/multiplayer';
import { PushPlugin } from '@termlnk-server/push';
import { IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { pinoLogger } from '@termlnk-server/rpc-server/pino-logger';
import { SharedTerminalPlugin } from '@termlnk-server/shared-terminal';
import { ISyncService, SyncPlugin } from '@termlnk-server/sync';
import { ISyncBroadcaster } from '@termlnk-server/sync-broadcast';
import { RedisSyncBroadcaster } from '@termlnk-server/sync-broadcast/redis';
import { WebSocketServer } from 'ws';
import { loadEnv } from './env.js';
import { mountPokeWebsocket } from './ws/poke.ws.js';

function loadDotenvIfPresent(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '..', '.env'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      process.loadEnvFile(path);
    }
  }
}

function locateMigrationsFolder(here: string): string {
  const candidates = [
    resolve(here, './migrations'),
    resolve(here, '../../../packages/database/src/migrations'),
    resolve(process.cwd(), '../../packages/database/src/migrations'),
    resolve(process.cwd(), 'packages/database/src/migrations'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }
  throw new Error(`[apps/server] cannot locate migrations folder; tried:\n  - ${candidates.join('\n  - ')}`);
}

async function main(): Promise<void> {
  loadDotenvIfPresent();
  const config = loadEnv();
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = locateMigrationsFolder(__dirname);

  // -- adaptors (one each per process)
  const dbAdaptor = new NodePgAdaptor({
    connectionString: config.databaseUrl,
    migrationsFolder,
  });
  await dbAdaptor.initialize();
  await dbAdaptor.runMigrations();
  console.log('[termlnk-server] migrations applied');

  const kv = new IoredisKVStore({ url: config.redisUrl });
  const broadcaster = new RedisSyncBroadcaster({ client: kv.client });

  // -- Core + plugin chain
  const core = new Core({ logLevel: LogLevel.INFO });
  const injector = core.getInjector();
  // Pre-bind cross-cutting services that plugins consume but don't own (the
  // adaptors above are stateful and constructed in this entrypoint, so we
  // register them by value before any plugin's onStarting can ask for them).
  injector.add([IKVStore, { useValue: kv }]);
  injector.add([ISyncBroadcaster, { useValue: broadcaster }]);
  injector.add([IJwtService, {
    useValue: new JoseJwtService({
      accessSecret: config.jwtAccessSecret,
      refreshSecret: config.jwtRefreshSecret,
      accessTtl: config.jwtAccessTtlSeconds,
      refreshTtl: config.jwtRefreshTtlSeconds,
    }),
  }]);
  injector.add([IHmacService, { useClass: WebCryptoHmacService }]);
  injector.add([ISrpService, { useClass: NodeSrpService }]);

  core.registerPlugins([
    [RpcServerPlugin, {
      corsOrigins: [...config.corsOrigins],
      loggerMiddleware: () => pinoLogger(process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
      openapi: {
        title: 'termlnk-server',
        version: '0.1.0',
        description: 'Termlnk cloud backend — zero-knowledge auth + sync API.',
      },
    }],
    [DatabasePlugin, { dbAdaptor, autoInitialize: false }],
    [AuthPlugin, {
      allowOpenRegistration: config.allowOpenRegistration,
      requireEmailVerification: config.requireEmailVerification,
    }],
    [SyncPlugin, {}],
    [PushPlugin, {}],
    [CollabPlugin, {}],
    [SharedTerminalPlugin, { redis: kv.client }],
    [MultiplayerPlugin, { redis: kv.client }],
  ]);

  core.start();

  // -- Node-specific wiring (HTTP server, WebSocket adaptors, /health)
  const appService = injector.get(IAppService);
  const syncService = injector.get(ISyncService);
  const jwt = injector.get(IJwtService);
  appService.app.get('/health', (c) => c.json({ ok: true }));

  mountPokeWebsocket(appService.app, { jwt, syncService });

  const wss = new WebSocketServer({ noServer: true });
  const server = serve(
    {
      fetch: appService.app.fetch,
      port: config.port,
      hostname: config.host,
      websocket: { server: wss },
    },
    (info) => {
      console.log(`[termlnk-server] listening on http://${info.address}:${info.port}`);
    }
  );

  // graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[termlnk-server] received ${signal}, shutting down`);
    wss.clients.forEach((client) => client.close(1001, 'server shutting down'));
    wss.close();
    server.close();
    core.dispose();
    await Promise.allSettled([dbAdaptor.close()]);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((err) => {
  console.error('[termlnk-server] fatal:', err);
  process.exit(1);
});
