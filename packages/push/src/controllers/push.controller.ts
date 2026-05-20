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
import { IPushService } from '../services/push.service';
import * as routes from './push.routes';

export class PushController {
  constructor(
    @IPushService private readonly _pushService: IPushService,
    @IJwtService private readonly _jwt: IJwtService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    router.use('*', requireAuth(this._jwt));
    router
      .openapi(routes.register, this._register)
      .openapi(routes.unregister, this._unregister);
  }

  private _register: AppRouteHandler<typeof routes.register> = async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    await this._pushService.register({
      userId,
      deviceToken: body.deviceToken,
      platform: body.platform,
      userAgent: body.userAgent ?? null,
    });
    return c.json({ registered: true as const }, 200);
  };

  private _unregister: AppRouteHandler<typeof routes.unregister> = async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    await this._pushService.unregister(userId, body.deviceToken);
    return c.body(null, 204);
  };
}
