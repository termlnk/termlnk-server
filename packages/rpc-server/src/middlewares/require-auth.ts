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
import type { MiddlewareHandler } from 'hono';
import type { IAuthVariables } from '../common/types';
import { HttpError } from '../utils/http-error';

/**
 * Bearer-token middleware factory. Pulls the access token from the
 * `Authorization: Bearer …` header, verifies it via `IJwtService`, and stashes
 * the claims on the context (`c.get('userId')` / `email` / `currentJti`).
 *
 * The service is injected explicitly rather than retrieved from the DI container
 * here so the middleware stays a plain Hono function (testable in isolation).
 */
export function requireAuth(jwt: IJwtService): MiddlewareHandler<{ Variables: IAuthVariables }> {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header || !header.startsWith('Bearer ')) {
      throw new HttpError(401, 'unauthorized', 'missing Bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const claims = await jwt.verifyAccess(token);
      c.set('userId', claims.sub);
      c.set('email', claims.email);
      c.set('currentJti', claims.jti);
    } catch {
      throw new HttpError(401, 'unauthorized', 'invalid or expired access token');
    }
    await next();
  };
}
