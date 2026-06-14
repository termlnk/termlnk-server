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

import type { Context, MiddlewareHandler } from 'hono';
import type { IAdminAuthService, IAdminTokenClaims } from '../services/admin-auth.service';
import { HttpError } from '@termlnk-server/rpc-server';

const ADMIN_CLAIMS_VAR = 'adminClaims';

export function requireAdminAuth(authService: IAdminAuthService): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new HttpError(401, 'unauthorized', 'missing or malformed Authorization header');
    }
    const token = header.slice(7);
    const claims = await authService.verifyToken(token);

    const admin = await authService.findAdmin(claims.sub);
    if (!admin || !admin.isActive) {
      throw new HttpError(401, 'unauthorized', 'admin account disabled or not found');
    }

    c.set(ADMIN_CLAIMS_VAR as never, claims as never);
    await next();
  };
}

export function getAdminClaims(c: Context): IAdminTokenClaims {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claims = (c as any).get(ADMIN_CLAIMS_VAR) as IAdminTokenClaims | undefined;
  if (!claims) {
    throw new HttpError(401, 'unauthorized', 'admin auth required');
  }
  return claims;
}
