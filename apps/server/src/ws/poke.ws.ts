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
 * Sync poke WebSocket handler — server → client `{type:"poke", resource, cursor}`
 * fires on every push for this user. Cross-instance fanout goes through the
 * sync engine's ISyncBroadcaster (Redis on Node).
 *
 * Auth: the desktop client smuggles its access token through the
 * `sec-websocket-protocol: Bearer.<token>` subprotocol header (browsers can't set
 * arbitrary headers on WebSocket).
 */

import type { IJwtService } from '@termlnk-server/crypto';
import type { AppOpenAPI } from '@termlnk-server/rpc-server';
import type { ISyncService } from '@termlnk-server/sync';
import { upgradeWebSocket } from '@hono/node-server';
import { HttpError } from '@termlnk-server/rpc-server';
import { authenticateWsUpgrade } from '@termlnk-server/sync';
import { createMiddleware } from 'hono/factory';

export interface IPokeWsDeps {
  jwt: IJwtService;
  syncService: ISyncService;
}

function wsBearerAuth(jwt: IJwtService) {
  return createMiddleware<{ Variables: { userId: string; email: string; currentJti: string } }>(async (c, next) => {
    const claims = await authenticateWsUpgrade(jwt, c.req.header('sec-websocket-protocol'));
    if (!claims) {
      throw new HttpError(401, 'unauthorized', 'invalid or missing Bearer in sec-websocket-protocol');
    }
    c.set('userId', claims.userId);
    c.set('email', claims.email);
    c.set('currentJti', claims.jti);
    await next();
  });
}

export function mountPokeWebsocket(app: AppOpenAPI, deps: IPokeWsDeps): void {
  app.get(
    '/v1/sync/poke',
    wsBearerAuth(deps.jwt),
    upgradeWebSocket((c) => {
      const userId = c.get('userId');
      let unsubscribe: (() => void) | null = null;
      return {
        onOpen: (_evt, ws) => {
          unsubscribe = deps.syncService.subscribe(userId, (env) => {
            if (ws.readyState !== 1) {
              return;
            }
            ws.send(JSON.stringify({ type: 'poke', resource: env.resource, cursor: env.cursor }));
          });
        },
        onMessage: (evt, ws) => {
          try {
            const data = typeof evt.data === 'string'
              ? evt.data
              : new TextDecoder().decode(evt.data as ArrayBuffer);
            const msg = JSON.parse(data);
            if (msg && msg.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
          } catch {
            // ignore malformed
          }
        },
        onClose: () => {
          unsubscribe?.();
          unsubscribe = null;
        },
        onError: () => {
          unsubscribe?.();
          unsubscribe = null;
        },
      };
    })
  );
}
