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

import type { IJwtService } from '@termlnk-server/crypto';

/**
 * WebSocket Bearer auth — the desktop client smuggles its access token through
 * `sec-websocket-protocol: Bearer.<token>` because browser WebSocket APIs don't
 * let JS set arbitrary headers. RFC 6455 echoes accepted subprotocols back; we
 * just verify and never select one (the client doesn't read it).
 *
 * Returned in a runtime-agnostic shape so both the Node `@hono/node-server`
 * upgrade flow and the edge Durable Object `fetch` handler can call it.
 *
 * The Hono middleware variant (`createWsBearerAuthMiddleware`) lives in
 * `@termlnk-server/rpc-server` so we don't drag Hono into the runtime-agnostic
 * sync layer.
 */
export interface IWsAuthClaims {
  userId: string;
  email: string;
  /** jti of the refresh token that issued this access token */
  jti: string;
}

export function extractWebsocketBearer(header: string | null | undefined): string | null {
  if (!header) {
    return null;
  }
  const protocols = header.split(',').map((s) => s.trim()).filter(Boolean);
  const bearerProto = protocols.find((p) => p.startsWith('Bearer.'));
  return bearerProto?.slice('Bearer.'.length) ?? null;
}

/**
 * Verify a WS upgrade request against the JWT service.
 * Returns claims on success, `null` on missing / invalid / expired token —
 * callers decide whether to send 401 (HTTP path) or close the socket (DO path).
 */
export async function authenticateWsUpgrade(
  jwt: IJwtService,
  secWebSocketProtocol: string | null | undefined
): Promise<IWsAuthClaims | null> {
  const token = extractWebsocketBearer(secWebSocketProtocol);
  if (!token) {
    return null;
  }
  try {
    const claims = await jwt.verifyAccess(token);
    return { userId: claims.sub, email: claims.email, jti: claims.jti };
  } catch {
    return null;
  }
}
