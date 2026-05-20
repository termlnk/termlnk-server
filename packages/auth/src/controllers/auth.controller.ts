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
import type { Context } from 'hono';
import { IJwtService } from '@termlnk-server/crypto';
import { HttpError, requireAuth } from '@termlnk-server/rpc-server';
import { IAuthService } from '../services/auth.service';
import { ISrpSessionService } from '../services/srp-session.service';
import * as routes from './auth.routes';

function deviceMeta(c: Context): { deviceName: string | null; userAgent: string | null } {
  return { deviceName: null, userAgent: c.req.header('User-Agent') ?? null };
}

export class AuthController {
  constructor(
    @IAuthService private readonly _authService: IAuthService,
    @ISrpSessionService private readonly _srpSession: ISrpSessionService,
    @IJwtService private readonly _jwt: IJwtService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    const auth = requireAuth(this._jwt);
    router.use('/me', auth);
    router.use('/devices', auth);
    router.use('/devices/*', auth);
    router.use('/logout', auth);

    router
      .openapi(routes.register, this._register)
      .openapi(routes.srpInit, this._srpInit)
      .openapi(routes.srpVerify, this._srpVerify)
      .openapi(routes.refresh, this._refresh)
      .openapi(routes.me, this._me)
      .openapi(routes.devices, this._devices)
      .openapi(routes.revokeDevice, this._revokeDevice)
      .openapi(routes.logout, this._logout);
  }

  private _register: AppRouteHandler<typeof routes.register> = async (c) => {
    const body = c.req.valid('json');
    const { user, tokens } = await this._authService.register({
      email: body.email,
      displayName: body.displayName ?? undefined,
      argon2SaltB64: body.argon2SaltB64,
      srpSalt: body.srpSalt,
      srpVerifier: body.srpVerifier,
      device: { deviceName: body.deviceName ?? null, userAgent: c.req.header('User-Agent') ?? null },
    });
    return c.json({ user, ...tokens }, 200);
  };

  private _srpInit: AppRouteHandler<typeof routes.srpInit> = async (c) => {
    const { email } = c.req.valid('json');
    const lookup = email.trim().toLowerCase();
    const cred = await this._authService.lookupSrpCredentialOrDecoy(lookup);
    const { serverPublicEphemeral } = await this._srpSession.begin(lookup, cred.srpSalt, cred.srpVerifier);
    return c.json({
      argon2SaltB64: cred.argon2SaltB64,
      srpSalt: cred.srpSalt,
      srpServerEphemeralPublic: serverPublicEphemeral,
    }, 200);
  };

  private _srpVerify: AppRouteHandler<typeof routes.srpVerify> = async (c) => {
    const body = c.req.valid('json');
    const email = body.email.trim().toLowerCase();
    const ok = await this._srpSession.verifyAndConsume(email, body.clientPublicEphemeral, body.clientSessionProof);
    if (!ok) {
      throw new HttpError(401, 'invalid_credentials', 'login failed');
    }
    const { user, tokens } = await this._authService.loginAfterSrpVerify(email, {
      deviceName: body.deviceName ?? null,
      userAgent: c.req.header('User-Agent') ?? null,
    });
    return c.json({ serverSessionProof: ok.serverProof, user, ...tokens }, 200);
  };

  private _refresh: AppRouteHandler<typeof routes.refresh> = async (c) => {
    const { refreshToken } = c.req.valid('json');
    const tokens = await this._authService.refresh(refreshToken, deviceMeta(c));
    return c.json(tokens, 200);
  };

  private _me: AppRouteHandler<typeof routes.me> = async (c) => {
    const userId = c.get('userId');
    const user = await this._authService.findUser(userId);
    if (!user) {
      throw new HttpError(401, 'user_not_found');
    }
    return c.json({ user }, 200);
  };

  private _devices: AppRouteHandler<typeof routes.devices> = async (c) => {
    const userId = c.get('userId');
    const currentJti = c.get('currentJti');
    const deviceList = await this._authService.listDevices(userId, currentJti);
    return c.json({ devices: deviceList }, 200);
  };

  private _revokeDevice: AppRouteHandler<typeof routes.revokeDevice> = async (c) => {
    const userId = c.get('userId');
    const { id: targetJti } = c.req.valid('param');
    await this._authService.revokeDevice(userId, targetJti);
    return c.body(null, 204);
  };

  private _logout: AppRouteHandler<typeof routes.logout> = async (c) => {
    const userId = c.get('userId');
    await this._authService.logoutAll(userId);
    return c.body(null, 204);
  };
}
