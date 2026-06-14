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
import { requireAdminAuth } from '../middlewares/require-admin-auth';
import { IAdminAuthService } from '../services/admin-auth.service';
import { IAdminQueryService } from '../services/admin-query.service';
import * as routes from './admin-users.routes';

export class AdminUsersController {
  constructor(
    @IAdminQueryService private readonly _queryService: IAdminQueryService,
    @IAdminAuthService private readonly _authService: IAdminAuthService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    const auth = requireAdminAuth(this._authService);
    router.use('/users', auth);
    router.use('/users/*', auth);

    router
      .openapi(routes.listUsers, this._listUsers)
      .openapi(routes.getUser, this._getUser)
      .openapi(routes.getUserDevices, this._getUserDevices)
      .openapi(routes.revokeDevice, this._revokeDevice)
      .openapi(routes.revokeAllDevices, this._revokeAllDevices)
      .openapi(routes.getUserOAuthIdentities, this._getUserOAuthIdentities)
      .openapi(routes.getUserSyncStats, this._getUserSyncStats)
      .openapi(routes.disableUser, this._disableUser)
      .openapi(routes.enableUser, this._enableUser);
  }

  private _listUsers: AppRouteHandler<typeof routes.listUsers> = async (c) => {
    const { page, limit, q } = c.req.valid('query');
    const result = await this._queryService.listUsers(page, limit, q);
    return c.json(result, 200);
  };

  private _getUser: AppRouteHandler<typeof routes.getUser> = async (c) => {
    const { id } = c.req.valid('param');
    const user = await this._queryService.getUserDetail(id);
    if (!user) {
      throw new HttpError(404, 'user_not_found');
    }
    return c.json({ user }, 200);
  };

  private _getUserDevices: AppRouteHandler<typeof routes.getUserDevices> = async (c) => {
    const { id } = c.req.valid('param');
    const devices = await this._queryService.getUserDevices(id);
    return c.json({ devices }, 200);
  };

  private _revokeDevice: AppRouteHandler<typeof routes.revokeDevice> = async (c) => {
    const { id, jti } = c.req.valid('param');
    await this._queryService.revokeDevice(id, jti);
    return c.body(null, 204);
  };

  private _revokeAllDevices: AppRouteHandler<typeof routes.revokeAllDevices> = async (c) => {
    const { id } = c.req.valid('param');
    await this._queryService.revokeAllDevices(id);
    return c.body(null, 204);
  };

  private _getUserOAuthIdentities: AppRouteHandler<typeof routes.getUserOAuthIdentities> = async (c) => {
    const { id } = c.req.valid('param');
    const identities = await this._queryService.getUserOAuthIdentities(id);
    return c.json({ identities }, 200);
  };

  private _getUserSyncStats: AppRouteHandler<typeof routes.getUserSyncStats> = async (c) => {
    const { id } = c.req.valid('param');
    const stats = await this._queryService.getUserSyncStats(id);
    return c.json(stats, 200);
  };

  private _disableUser: AppRouteHandler<typeof routes.disableUser> = async (c) => {
    const { id } = c.req.valid('param');
    await this._queryService.setUserActive(id, false);
    return c.body(null, 204);
  };

  private _enableUser: AppRouteHandler<typeof routes.enableUser> = async (c) => {
    const { id } = c.req.valid('param');
    await this._queryService.setUserActive(id, true);
    return c.body(null, 204);
  };
}
