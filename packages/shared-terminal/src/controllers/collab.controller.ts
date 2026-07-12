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
import { optionalAuth, requireAuth } from '@termlnk-server/rpc-server';
import { ICollabService } from '../services/collab.service';
import * as routes from './collab.routes';

export class CollabController {
  constructor(
    @ICollabService private readonly _collabService: ICollabService,
    @IJwtService private readonly _jwt: IJwtService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    // Auth is mounted per-path, NOT `use('*')`: claim must accept anonymous
    // callers (invite link = admission proof; the relay-claim token routes
    // them), while every owner-side route stays behind requireAuth. A new
    // collab route MUST explicitly pick one of the two middlewares here.
    const auth = requireAuth(this._jwt);
    router.use('/invite', auth); // create (POST) + list (GET)
    router.use('/invite/:inviteId/revoke', auth);
    router.use('/invite/:inviteId/claim', optionalAuth(this._jwt));
    router
      .openapi(routes.create, this._create)
      .openapi(routes.revoke, this._revoke)
      .openapi(routes.list, this._list)
      .openapi(routes.claim, this._claim);
  }

  private _create: AppRouteHandler<typeof routes.create> = async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const view = await this._collabService.create({
      userId,
      inviteId: body.inviteId,
      sessionId: body.sessionId,
      role: body.role,
      capabilityHash: body.capabilityHash,
      capabilityVersion: body.capability.v,
      ephPubB64: body.ephPubB64,
      exp: body.exp,
      singleUse: body.singleUse,
      note: body.note ?? null,
    });
    return c.json({ invite: view }, 200);
  };

  private _revoke: AppRouteHandler<typeof routes.revoke> = async (c) => {
    const userId = c.get('userId');
    const { inviteId } = c.req.valid('param');
    await this._collabService.revoke(userId, inviteId);
    return c.body(null, 204);
  };

  private _list: AppRouteHandler<typeof routes.list> = async (c) => {
    const userId = c.get('userId');
    const invites = await this._collabService.list(userId);
    return c.json({ invites }, 200);
  };

  private _claim: AppRouteHandler<typeof routes.claim> = async (c) => {
    // optionalAuth leaves userId unset for anonymous callers; normalize the
    // resulting `undefined` to the service contract's explicit null.
    const claimantUserId = c.get('userId') ?? null;
    const { inviteId } = c.req.valid('param');
    const body = c.req.valid('json');
    const result = await this._collabService.claim({
      claimantUserId,
      inviteId,
      capabilityHash: body.capabilityHash,
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
    });
    return c.json(result, 200);
  };
}
