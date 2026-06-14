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
import { requireAdminAuth } from '../middlewares/require-admin-auth';
import { IAdminAuthService } from '../services/admin-auth.service';
import { IAdminQueryService } from '../services/admin-query.service';
import * as routes from './admin-stats.routes';

export class AdminStatsController {
  constructor(
    @IAdminQueryService private readonly _queryService: IAdminQueryService,
    @IAdminAuthService private readonly _authService: IAdminAuthService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    const auth = requireAdminAuth(this._authService);
    router.use('/stats/*', auth);

    router
      .openapi(routes.overview, this._overview)
      .openapi(routes.syncStats, this._syncStats);
  }

  private _overview: AppRouteHandler<typeof routes.overview> = async (c) => {
    const stats = await this._queryService.getStatsOverview();
    return c.json(stats, 200);
  };

  private _syncStats: AppRouteHandler<typeof routes.syncStats> = async (c) => {
    const stats = await this._queryService.getSyncStats();
    return c.json(stats, 200);
  };
}
