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
 */

import type { AppOpenAPI } from '@termlnk-server/rpc-server';
import type { IRelayConnection, IRelayHandle } from '../services/relay.service';
import { upgradeWebSocket } from '@hono/node-server';
import { z } from '@hono/zod-openapi';
import { IRelayClaimTokenService } from '@termlnk-server/collab';
import { IJwtService } from '@termlnk-server/crypto';
import { createWsBearerAuthMiddleware, HttpError } from '@termlnk-server/rpc-server';
import { IRelayService } from '../services/relay.service';

const querySchema = z.object({
  mode: z.enum(['daemon', 'client']),
  sessionId: z.string().min(1).max(256),
  connectionId: z.string().min(1).max(256).optional(),
});

export class SharedTerminalController {
  constructor(
    @IJwtService private readonly _jwt: IJwtService,
    @IRelayService private readonly _relay: IRelayService,
    @IRelayClaimTokenService private readonly _relayClaimToken: IRelayClaimTokenService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    router.get(
      '/',
      createWsBearerAuthMiddleware(this._jwt),
      upgradeWebSocket(async (c) => {
        const userId = c.get('userId') as string;
        const parsed = querySchema.safeParse({
          mode: c.req.query('mode'),
          sessionId: c.req.query('sessionId'),
          connectionId: c.req.query('connectionId'),
        });
        if (!parsed.success) {
          throw new HttpError(400, 'invalid_request', 'missing or invalid relay query parameters');
        }
        const query = parsed.data;

        // Optional cross-account attach: client may present a short-lived
        // relay-claim token (minted by /v1/collab/invite/:id/claim) via the
        // `sec-websocket-protocol: RelayToken.<token>` subprotocol. We verify
        // the HMAC + expiry + that the token's joinerUserId matches the WS
        // JWT subject (so a stolen token can't be used under another account).
        // On success the relay routes this WS into the OWNER's session bucket
        // instead of the joiner's own. Daemon-mode attaches ignore relay-claim
        // tokens entirely.
        let ownerUserId: string | undefined;
        if (query.mode === 'client') {
          ownerUserId = await this._extractOwnerUserId(
            c.req.header('sec-websocket-protocol'),
            userId,
            query
          );
        }

        let handle: IRelayHandle | null = null;
        return {
          onOpen: (_evt, ws) => {
            const conn: IRelayConnection = {
              send: (data) => ws.send(data),
              close: (code, reason) => ws.close(code, reason),
            };
            const opts: { userId: string; sessionId: string; mode: 'daemon' | 'client'; connectionId?: string; ownerUserId?: string } = {
              userId,
              sessionId: query.sessionId,
              mode: query.mode,
            };
            if (query.connectionId !== undefined) {
              opts.connectionId = query.connectionId;
            }
            if (ownerUserId !== undefined) {
              opts.ownerUserId = ownerUserId;
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

  private async _extractOwnerUserId(
    headerValue: string | null | undefined,
    wsUserId: string,
    query: { sessionId: string; connectionId?: string }
  ): Promise<string | undefined> {
    if (!headerValue) {
      return undefined;
    }
    const protocols = headerValue.split(',').map((s) => s.trim()).filter(Boolean);
    const relayProto = protocols.find((p) => p.startsWith('RelayToken.'));
    if (!relayProto) {
      return undefined;
    }
    const token = relayProto.slice('RelayToken.'.length);
    let payload;
    try {
      payload = await this._relayClaimToken.verify(token);
    } catch {
      // Do not surface verify()'s internal message — it would let probers
      // distinguish "expired" from "signature mismatch" from "malformed".
      throw new HttpError(401, 'invalid_relay_token', 'relay claim token rejected');
    }
    if (payload.joinerUserId !== wsUserId) {
      throw new HttpError(403, 'relay_token_subject_mismatch', 'relay-claim token joiner does not match ws subject');
    }
    if (payload.sessionId !== query.sessionId) {
      throw new HttpError(403, 'relay_token_session_mismatch', 'relay-claim token sessionId does not match query');
    }
    if (query.connectionId && payload.connectionId !== query.connectionId) {
      throw new HttpError(403, 'relay_token_connection_mismatch', 'relay-claim token connectionId does not match query');
    }
    return payload.ownerUserId;
  }
}
