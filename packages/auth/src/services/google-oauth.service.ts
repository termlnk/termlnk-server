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

import type { Nullable } from '@termlnk-server/core';
import type { IAuthPluginConfig, IGoogleOAuthPluginConfig } from '../config.schema';
import { createIdentifier, IConfigService } from '@termlnk-server/core';
import { HttpError } from '@termlnk-server/rpc-server';
import { AUTH_PLUGIN_CONFIG_KEY } from '../config.schema';
import { base64UrlDecodeToString, base64UrlEncode, randomBase64Url } from './oauth-encoding';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export interface IGoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Server callback registered in the Google console — the redirect_uri Google posts the code back to. */
  redirectUri: string;
}

export interface IGoogleAuthSession {
  /** URL the browser is navigated to. */
  authorizeUrl: string;
  /** CSRF nonce — persist server-side and match it on callback. */
  state: string;
  /** PKCE verifier — persist server-side and send it to the token endpoint on exchange. */
  codeVerifier: string;
}

export interface IGoogleUserInfo {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface IGoogleOAuthService {
  /** Build a fresh authorize URL with state + PKCE challenge. */
  createAuthSession(): Promise<IGoogleAuthSession>;
  /** Exchange the auth code (with its PKCE verifier) for the verified user identity. */
  exchangeCode(code: string, codeVerifier: string): Promise<IGoogleUserInfo>;
}
export const IGoogleOAuthService = createIdentifier<IGoogleOAuthService>('auth.google-oauth');

interface IGoogleIdTokenClaims {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

/**
 * Google OIDC authorization-code flow with PKCE. The client secret lives only
 * here (server-side); the desktop never sees it. The id_token is read straight
 * from the token endpoint's TLS response, so signature verification is
 * redundant (OIDC core §3.1.3.7) — we still pin issuer + audience so a token
 * minted for a different client can't be replayed.
 */
export class GoogleOAuthService implements IGoogleOAuthService {
  constructor(
    @IConfigService private readonly _configService: IConfigService
  ) {

  }

  async createAuthSession(): Promise<IGoogleAuthSession> {
    const config = this._oauthConfig();
    if (!config) {
      throw new Error('Google OAuth configuration not found');
    }

    const state = randomBase64Url(32);
    const codeVerifier = randomBase64Url(32);
    const codeChallenge = await this._deriveCodeChallenge(codeVerifier);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return { authorizeUrl: `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`, state, codeVerifier };
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<IGoogleUserInfo> {
    const config = this._oauthConfig();
    if (!config) {
      throw new Error('Google OAuth configuration not found');
    }

    let resp: Response;
    try {
      resp = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }).toString(),
      });
    } catch {
      throw new HttpError(502, 'oauth_provider_unreachable', 'failed to reach the Google token endpoint');
    }
    if (!resp.ok) {
      throw new HttpError(401, 'invalid_credentials', 'google token exchange failed');
    }
    const data = (await resp.json()) as { id_token?: string };
    if (!data.id_token) {
      throw new HttpError(502, 'oauth_provider_invalid_response', 'google response missing id_token');
    }

    const claims = this._decodeIdToken(data.id_token);
    this._assertClaims(claims);

    return {
      sub: claims.sub!,
      email: claims.email!,
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
      name: claims.name,
      picture: claims.picture,
    };
  }

  private async _deriveCodeChallenge(verifier: string): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64UrlEncode(new Uint8Array(digest));
  }

  private _decodeIdToken(idToken: string): IGoogleIdTokenClaims {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new HttpError(502, 'oauth_provider_invalid_response', 'malformed id_token');
    }
    try {
      return JSON.parse(base64UrlDecodeToString(parts[1]!)) as IGoogleIdTokenClaims;
    } catch {
      throw new HttpError(502, 'oauth_provider_invalid_response', 'unparseable id_token');
    }
  }

  private _assertClaims(claims: IGoogleIdTokenClaims): void {
    if (!claims.iss || !GOOGLE_ISSUERS.has(claims.iss)) {
      throw new HttpError(401, 'invalid_credentials', 'unexpected id_token issuer');
    }

    const config = this._oauthConfig();
    if (!config) {
      throw new HttpError(401, 'Google OAuth configuration not found');
    }

    // `aud` may be a string or an array (OIDC core §2). Our client id must be the
    // audience; when several are present, `azp` must single out our client.
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(config.clientId)) {
      throw new HttpError(401, 'invalid_credentials', 'id_token audience mismatch');
    }
    if (audiences.length > 1 && claims.azp !== config.clientId) {
      throw new HttpError(401, 'invalid_credentials', 'id_token authorized-party mismatch');
    }
    // Reject a missing/non-numeric exp as well as an expired one: the token is trusted
    // via TLS without signature verification, so an absent expiry must not read as
    // "never expires".
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) {
      throw new HttpError(401, 'invalid_credentials', 'id_token expired or missing exp');
    }
    if (!claims.sub || !claims.email) {
      throw new HttpError(401, 'invalid_credentials', 'id_token missing sub/email');
    }
  }

  private _oauthConfig(): Nullable<IGoogleOAuthPluginConfig> {
    const config = this._configService.getConfig<IAuthPluginConfig>(AUTH_PLUGIN_CONFIG_KEY);
    return config?.google;
  }
}
