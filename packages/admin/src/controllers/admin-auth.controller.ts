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

import type { AppOpenAPI, AppRouteHandler } from '@termlnk-server/rpc-server';
import { HttpError } from '@termlnk-server/rpc-server';
import { getAdminClaims, requireAdminAuth } from '../middlewares/require-admin-auth';
import { IAdminAuthService } from '../services/admin-auth.service';
import * as routes from './admin-auth.routes';

export class AdminAuthController {
  constructor(
    @IAdminAuthService private readonly _authService: IAdminAuthService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    const auth = requireAdminAuth(this._authService);
    router.use('/auth/me', auth);
    router.use('/auth/change-password', auth);

    router
      .openapi(routes.login, this._login)
      .openapi(routes.me, this._me)
      .openapi(routes.changePassword, this._changePassword);
  }

  private _login: AppRouteHandler<typeof routes.login> = async (c) => {
    const { email, password } = c.req.valid('json');
    const result = await this._authService.login(email, password);
    return c.json(result, 200);
  };

  private _me: AppRouteHandler<typeof routes.me> = async (c) => {
    const claims = getAdminClaims(c);
    const admin = await this._authService.findAdmin(claims.sub);
    if (!admin) {
      throw new HttpError(401, 'admin_not_found');
    }
    return c.json({ admin }, 200);
  };

  private _changePassword: AppRouteHandler<typeof routes.changePassword> = async (c) => {
    const claims = getAdminClaims(c);
    const { currentPassword, newPassword } = c.req.valid('json');
    await this._authService.changePassword(claims.sub, currentPassword, newPassword);
    return c.body(null, 204);
  };
}
