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
import type { IAuthPluginConfig } from '../config.schema';
import { Disposable, IConfigService, Optional } from '@termlnk-server/core';
import { IJwtService } from '@termlnk-server/crypto';
import { HttpError, requireAuth } from '@termlnk-server/rpc-server';
import { AUTH_PLUGIN_CONFIG_KEY } from '../config.schema';
import { IAuthService } from '../services/auth.service';
import { IGoogleOAuthService } from '../services/google-oauth.service';
import { randomBase64Url } from '../services/oauth-encoding';
import { IOAuthFlowStore, WEB_RELAY_TTL_SECONDS } from '../services/oauth-flow-store.service';
import { ISrpSessionService } from '../services/srp-session.service';
import * as routes from './auth.routes';
import { OAuthLandingController } from './oauth-landing.controller';

function deviceMeta(c: Context): { deviceName: string | null; userAgent: string | null } {
  return { deviceName: null, userAgent: c.req.header('User-Agent') ?? null };
}

/**
 * The Google + E2E surface (`_google` / `_flow` / `_desktopCallbackUrl`) is
 * wired only when Google OAuth is enabled in the plugin config; otherwise these
 * are null and `registerRoutes` skips mounting those routes. Constructed via a
 * factory in the plugin (no DI decorators) so the optional trio can be passed
 * conditionally.
 */
export class AuthController extends Disposable {
  constructor(
    @IAuthService private readonly _authService: IAuthService,
    @ISrpSessionService private readonly _srpSession: ISrpSessionService,
    @IJwtService private readonly _jwt: IJwtService,
    @IConfigService private readonly _configService: IConfigService,
    @Optional(IGoogleOAuthService) private readonly _google?: IGoogleOAuthService,
    @Optional(IOAuthFlowStore) private readonly _flow?: IOAuthFlowStore
  ) {
    super();
  }

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
      .openapi(routes.logout, this._logout)
      .openapi(routes.capabilities, this._capabilities);

    const config = this._configService.getConfig<IAuthPluginConfig>(AUTH_PLUGIN_CONFIG_KEY);
    if (this._google && this._flow && config?.google?.desktopCallbackUrl) {
      this._registerGoogleRoutes(router, this._google, this._flow, config.google.desktopCallbackUrl);
    }
  }

  private _registerGoogleRoutes(
    router: AppOpenAPI,
    google: IGoogleOAuthService,
    flow: IOAuthFlowStore,
    desktopCallbackUrl: string
  ): void {
    const auth = requireAuth(this._jwt);
    router.use('/e2e/setup', auth);

    // Completion bridge pages. Desktop hands the relay code (success) or the error
    // (failure) to the `termlnk://` deep link; the web popup just shows "you can
    // close this" because the client polls the outcome out-of-band (see /google/web/*).
    const landing = new OAuthLandingController({ desktopCallbackUrl });

    // Desktop browser-navigation start: a 302 hop into Google. Web clients use
    // /google/web/begin instead (it returns the URL as JSON so the client can
    // open it itself and hold a device code for polling).
    router.get('/google/start', async (c) => {
      const session = await google.createAuthSession();
      await flow.savePending(session.state, { isWeb: false, codeVerifier: session.codeVerifier });
      return c.redirect(session.authorizeUrl);
    });

    // Web begin: the self-hosted client's backend (BFF) calls this server-to-server.
    // We can't know the client's domain (Google forbids arbitrary redirect URIs),
    // so instead of redirecting back we mint a device code; the callback maps the
    // relay code to it and the client polls /google/web/poll for it.
    router.post('/google/web/begin', async (c) => {
      const session = await google.createAuthSession();
      const deviceCode = randomBase64Url(32);
      await flow.savePending(session.state, { isWeb: true, codeVerifier: session.codeVerifier, deviceCode });
      return c.json({ authorizeUrl: session.authorizeUrl, deviceCode }, 200);
    });

    // Web poll: BFF exchanges its device code for the relay code once the popup
    // has completed. One-shot — a consumed or unknown device code reads pending.
    router.post('/google/web/poll', async (c) => {
      const body = await c.req.json().catch(() => null) as { deviceCode?: unknown } | null;
      const deviceCode = body?.deviceCode;
      if (typeof deviceCode !== 'string' || deviceCode.length === 0) {
        return c.json({ error: 'invalid_request' }, 400);
      }
      // Three terminal states for the client's backend: keep polling, claim this
      // relay code, or stop because the flow failed.
      const outcome = await flow.consumeWebOutcome(deviceCode);
      if (outcome === null) {
        return c.json({ status: 'pending' }, 200);
      }
      if (outcome.status === 'error') {
        return c.json({ status: 'error', error: outcome.error }, 200);
      }
      return c.json({ status: 'success', relayCode: outcome.relayCode }, 200);
    });

    router.get('/google/callback', async (c) => {
      const code = c.req.query('code');
      const state = c.req.query('state');
      const oauthError = c.req.query('error');

      // Without state the pending record can't be resolved, so the client kind is
      // unknown — render the desktop error page (it also relays the error to the deep link).
      if (!state) {
        return landing.renderError(oauthError ?? 'invalid_request');
      }
      const pending = await flow.consumePending(state);
      if (!pending) {
        return landing.renderError('invalid_state');
      }

      // One failure path for both client kinds: a web client gets a terminal error
      // parked for its poll; a desktop client gets it handed back via the deep link.
      const fail = async (errorCode: string): Promise<Response> => {
        if (pending.isWeb) {
          await flow.saveWebOutcome(pending.deviceCode, { status: 'error', error: errorCode });
          return landing.renderWebError(errorCode);
        }
        return landing.renderError(errorCode);
      };

      if (oauthError || !code) {
        return fail(oauthError ?? 'invalid_request');
      }
      try {
        const identity = await google.exchangeCode(code, pending.codeVerifier);
        const user = await this._authService.resolveGoogleIdentity(identity);
        if (pending.isWeb) {
          const relayCode = await flow.saveRelay({ userId: user.id }, WEB_RELAY_TTL_SECONDS);
          await flow.saveWebOutcome(pending.deviceCode, { status: 'success', relayCode });
          return landing.renderWebComplete();
        }
        const relayCode = await flow.saveRelay({ userId: user.id });
        return landing.renderSuccess(relayCode);
      } catch (err) {
        const errCode = err instanceof HttpError ? err.code : 'server_error';
        return fail(errCode);
      }
    });

    router
      .openapi(routes.googleClaim, async (c) => {
        const { relayCode, deviceName } = c.req.valid('json');
        const payload = await flow.consumeRelay(relayCode);
        if (!payload) {
          throw new HttpError(401, 'invalid_relay', 'relay code invalid or expired');
        }
        const device = { deviceName: deviceName ?? null, userAgent: c.req.header('User-Agent') ?? null };
        const { user, tokens } = await this._authService.issueSession(payload.userId, device);
        const e2e = await this._authService.getE2EStatus(payload.userId);
        return c.json({ user, ...tokens, e2e }, 200);
      })
      .openapi(routes.e2eSetup, this._e2eSetup);
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
    const e2e = await this._authService.getE2EStatus(userId);
    return c.json({ user, e2e }, 200);
  };

  // Public: lets the desktop hide the "Continue with Google" button on a server
  // where Google OAuth isn't configured (the trio is null unless enabled).
  private _capabilities: AppRouteHandler<typeof routes.capabilities> = (c) => {
    return c.json({ googleOAuth: this._google !== null }, 200);
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

  private _e2eSetup: AppRouteHandler<typeof routes.e2eSetup> = async (c) => {
    const userId = c.get('userId');
    const { argon2SaltB64, srpSalt, srpVerifier } = c.req.valid('json');
    const status = await this._authService.setupE2E(userId, argon2SaltB64, srpSalt, srpVerifier);
    return c.json(status, 200);
  };
}
