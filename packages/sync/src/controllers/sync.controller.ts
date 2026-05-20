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
import { IJwtService } from '@termlnk-server/crypto';
import { requireAuth } from '@termlnk-server/rpc-server';
import { ISyncService } from '../services/sync.service';
import * as routes from './sync.routes';

export class SyncController {
  constructor(
    @ISyncService private readonly _syncService: ISyncService,
    @IJwtService private readonly _jwt: IJwtService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    router.use('*', requireAuth(this._jwt));
    router
      .openapi(routes.push, this._push)
      .openapi(routes.pull, this._pull);
  }

  private _push: AppRouteHandler<typeof routes.push> = async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    return c.json(await this._syncService.push(userId, body), 200);
  };

  private _pull: AppRouteHandler<typeof routes.pull> = async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    return c.json(await this._syncService.pull(userId, body), 200);
  };
}
