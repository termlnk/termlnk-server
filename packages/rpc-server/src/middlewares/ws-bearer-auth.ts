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
import type { IAuthVariables } from '../common/types';
import { createMiddleware } from 'hono/factory';
import { HttpError } from '../utils/http-error';

/**
 * WebSocket Bearer auth middleware — mirrors `requireAuth` but reads the access
 * token from `sec-websocket-protocol: Bearer.<token>` instead of `Authorization`.
 * Browsers can't set arbitrary headers on WS upgrades, so the desktop client
 * smuggles its token through a subprotocol token.
 *
 * Every WS controller (shared-terminal relay + multiplayer signaling) used to
 * inline its own copy of this dance — extracted here so the duplication is gone
 * and the auth surface is single-source-of-truth alongside `requireAuth`.
 */
export function createWsBearerAuthMiddleware(jwt: IJwtService) {
  return createMiddleware<{ Variables: IAuthVariables }>(async (c, next) => {
    const protocol = c.req.header('sec-websocket-protocol');
    const token = extractWebsocketBearer(protocol);
    if (!token) {
      throw new HttpError(401, 'unauthorized', 'invalid or missing Bearer in sec-websocket-protocol');
    }
    try {
      const claims = await jwt.verifyAccess(token);
      c.set('userId', claims.sub);
      c.set('email', claims.email);
      c.set('currentJti', claims.jti);
    } catch {
      throw new HttpError(401, 'unauthorized', 'invalid or expired token');
    }
    await next();
  });
}

function extractWebsocketBearer(header: string | null | undefined): string | null {
  if (!header) {
    return null;
  }
  const protocols = header.split(',').map((s) => s.trim()).filter(Boolean);
  const bearerProto = protocols.find((p) => p.startsWith('Bearer.'));
  return bearerProto?.slice('Bearer.'.length) ?? null;
}
