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
 * WS endpoint mounted at the plugin's routePrefix (default `/v1/shared-terminal`).
 * Uses `@hono/node-server`'s `upgradeWebSocket` for the upgrade dance.
 *
 * Auth is either-or (see resolve-relay-identity.ts): a JWT via
 * `sec-websocket-protocol: Bearer.<jwt>` (signed-in, optionally accompanied by
 * a RelayToken for cross-account routing), or a bare `RelayToken.<t>` minted
 * by the collab claim flow (anonymous joiner).
 */

import type { AppOpenAPI } from '@termlnk-server/rpc-server';
import type { IRelayConnection, IRelayHandle } from '../services/relay.service';
import { upgradeWebSocket } from '@hono/node-server';
import { z } from '@hono/zod-openapi';
import { IJwtService } from '@termlnk-server/crypto';
import { HttpError } from '@termlnk-server/rpc-server';
import { IRelayClaimTokenService } from '../services/relay-claim-token.service';
import { IRelayService } from '../services/relay.service';
import { resolveRelayIdentity } from './resolve-relay-identity';

const querySchema = z.object({
  mode: z.enum(['daemon', 'client']),
  sessionId: z.string().min(1).max(256),
  connectionId: z.string().min(1).max(256).optional(),
});

export class RelayController {
  constructor(
    @IJwtService private readonly _jwt: IJwtService,
    @IRelayService private readonly _relay: IRelayService,
    @IRelayClaimTokenService private readonly _relayClaimToken: IRelayClaimTokenService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    router.get(
      '/',
      upgradeWebSocket(async (c) => {
        const parsed = querySchema.safeParse({
          mode: c.req.query('mode'),
          sessionId: c.req.query('sessionId'),
          connectionId: c.req.query('connectionId'),
        });
        if (!parsed.success) {
          throw new HttpError(400, 'invalid_request', 'missing or invalid relay query parameters');
        }
        const query = parsed.data;

        // Throwing here rejects the upgrade (same surface the previous
        // middleware + _extractOwnerUserId combination exposed).
        const identity = await resolveRelayIdentity(
          {
            subprotocolHeader: c.req.header('sec-websocket-protocol'),
            mode: query.mode,
            sessionId: query.sessionId,
            ...(query.connectionId !== undefined ? { connectionId: query.connectionId } : {}),
          },
          this._jwt,
          this._relayClaimToken
        );

        let handle: IRelayHandle | null = null;
        return {
          onOpen: (_evt, ws) => {
            const conn: IRelayConnection = {
              send: (data) => ws.send(data),
              close: (code, reason) => ws.close(code, reason),
            };
            const opts: { userId: string; sessionId: string; mode: 'daemon' | 'client'; connectionId?: string; ownerUserId?: string } = {
              userId: identity.userId,
              sessionId: query.sessionId,
              mode: query.mode,
            };
            if (query.connectionId !== undefined) {
              opts.connectionId = query.connectionId;
            }
            if (identity.ownerUserId !== undefined) {
              opts.ownerUserId = identity.ownerUserId;
            }
            handle = this._relay.attach(conn, opts);
          },
          onMessage: (evt) => {
            const data = typeof evt.data === 'string'
              ? evt.data
              : new TextDecoder().decode(evt.data as ArrayBuffer);
            handle?.onMessage(data);
          },
          onClose: () => {
            handle?.onClose();
            handle = null;
          },
          onError: () => {
            handle?.onClose();
            handle = null;
          },
        };
      })
    );
  }
}
