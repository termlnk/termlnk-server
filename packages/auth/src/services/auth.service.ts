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

import type { ITxContext } from '@termlnk-server/database';
import type { IUserRow } from '@termlnk-server/database/repositories';
import type { IDevice, IE2EStatus, IUserAccount } from '@termlnk-server/protocol';
import type { IAuthPluginConfig } from '../config.schema';
import type { IGoogleUserInfo } from './google-oauth.service';
import { createIdentifier, IConfigService } from '@termlnk-server/core';
import { IHmacService, IJwtService } from '@termlnk-server/crypto';
import { IDBAdaptorService } from '@termlnk-server/database';
import { IOAuthIdentitiesRepository, IRefreshTokensRepository, ISrpCredentialsRepository, IUsersRepository, UniqueViolationError } from '@termlnk-server/database/repositories';
import { HttpError } from '@termlnk-server/rpc-server';
import { AUTH_PLUGIN_CONFIG_KEY } from '../config.schema';

export interface ITokenBundle {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export interface IDeviceMeta {
  deviceName: string | null;
  userAgent: string | null;
}

export interface IRegisterParams {
  email: string;
  displayName?: string;
  argon2SaltB64: string;
  srpSalt: string;
  srpVerifier: string;
  device: IDeviceMeta;
}

export interface IAuthService {
  register(params: IRegisterParams): Promise<{ user: IUserAccount; tokens: ITokenBundle }>;
  lookupSrpCredentialOrDecoy(email: string): Promise<{
    argon2SaltB64: string;
    srpSalt: string;
    srpVerifier: string;
    isDecoy: boolean;
  }>;
  loginAfterSrpVerify(
    email: string,
    device: IDeviceMeta
  ): Promise<{ user: IUserAccount; tokens: ITokenBundle }>;
  refresh(refreshToken: string, device: IDeviceMeta): Promise<ITokenBundle>;
  findUser(userId: string): Promise<IUserAccount | null>;
  listDevices(userId: string, currentJti: string): Promise<IDevice[]>;
  revokeDevice(userId: string, jti: string): Promise<void>;
  logoutAll(userId: string): Promise<void>;

  /**
   * Resolve a Google identity to a local user (find by provider id, else by
   * verified email, else create) and refresh the stored identity profile. No
   * tokens are issued here — that happens at claim time so the device row
   * reflects the desktop, not the browser.
   */
  resolveGoogleIdentity(identity: IGoogleUserInfo): Promise<IUserAccount>;
  /** Issue a session for an already-resolved user (used by the Google claim step). */
  issueSession(userId: string, device: IDeviceMeta): Promise<{ user: IUserAccount; tokens: ITokenBundle }>;
  getE2EStatus(userId: string): Promise<IE2EStatus>;
  setupE2E(userId: string, argon2SaltB64: string, srpSalt: string, srpVerifier: string): Promise<IE2EStatus>;
}

export const IAuthService = createIdentifier<IAuthService>('auth.service');

export class AuthService implements IAuthService {
  constructor(
    @IDBAdaptorService private readonly _db: IDBAdaptorService,
    @IUsersRepository private readonly _usersRepo: IUsersRepository,
    @IRefreshTokensRepository private readonly _refreshTokens: IRefreshTokensRepository,
    @ISrpCredentialsRepository private readonly _srpCredentials: ISrpCredentialsRepository,
    @IOAuthIdentitiesRepository private readonly _oauthIdentities: IOAuthIdentitiesRepository,
    @IJwtService private readonly _jwt: IJwtService,
    @IHmacService private readonly _hmac: IHmacService,
    @IConfigService private readonly _configService: IConfigService
  ) {

  }

  async register(params: IRegisterParams): Promise<{ user: IUserAccount; tokens: ITokenBundle }> {
    const config = this._configService.getConfig<IAuthPluginConfig>(AUTH_PLUGIN_CONFIG_KEY);
    if (!config?.allowOpenRegistration) {
      throw new HttpError(403, 'registration_closed', 'open registration is disabled on this server');
    }

    const email = params.email.trim().toLowerCase();
    const userRow = await this._db.transaction(async (tx) => {
      try {
        const u = await this._usersRepo.insert({
          email,
          displayName: params.displayName ?? null,
          avatarUrl: null,
          emailVerified: !config?.requireEmailVerification,
        }, tx);
        await this._srpCredentials.insert({
          userId: u.id,
          argon2SaltB64: params.argon2SaltB64,
          srpSalt: params.srpSalt,
          srpVerifier: params.srpVerifier,
        }, tx);
        return u;
      } catch (err) {
        if (err instanceof UniqueViolationError) {
          throw new HttpError(409, 'email_already_registered');
        }
        throw err;
      }
    });
    const tokens = await this._issueTokens(userRow.id, userRow.email, params.device);
    return { user: toUserAccount(userRow), tokens };
  }

  async lookupSrpCredentialOrDecoy(email: string): Promise<{
    argon2SaltB64: string;
    srpSalt: string;
    srpVerifier: string;
    isDecoy: boolean;
  }> {
    const lookup = email.trim().toLowerCase();
    const cred = await this._srpCredentials.findByEmail(lookup);
    if (cred) {
      return { ...cred, isDecoy: false };
    }
    return {
      argon2SaltB64: await this._decoyBase64(lookup, 32),
      srpSalt: await this._decoyHex(lookup, 32),
      srpVerifier: await this._decoyHex(`${lookup}:v`, 256),
      isDecoy: true,
    };
  }

  async loginAfterSrpVerify(email: string, device: IDeviceMeta): Promise<{ user: IUserAccount; tokens: ITokenBundle }> {
    const lookup = email.trim().toLowerCase();
    const user = await this._usersRepo.findByEmail(lookup);
    if (!user) {
      throw new HttpError(401, 'invalid_credentials');
    }
    if (!user.isActive) {
      throw new HttpError(403, 'account_disabled', 'account is disabled');
    }

    const config = this._configService.getConfig<IAuthPluginConfig>(AUTH_PLUGIN_CONFIG_KEY);
    if (config?.requireEmailVerification && !user.emailVerified) {
      throw new HttpError(403, 'email_not_verified');
    }
    const tokens = await this._issueTokens(user.id, user.email, device);
    return { user: toUserAccount(user), tokens };
  }

  async refresh(refreshToken: string, device: IDeviceMeta): Promise<ITokenBundle> {
    let claims;
    try {
      claims = await this._jwt.verifyRefresh(refreshToken);
    } catch {
      throw new HttpError(401, 'invalid_refresh', 'refresh token invalid or expired');
    }
    const result = await this._db.transaction(async (tx) => {
      const existing = await this._refreshTokens.findActiveByJti(claims.jti, tx);
      if (!existing || existing.expiresAt.getTime() < Date.now()) {
        return null;
      }
      await this._refreshTokens.revokeByJti(claims.jti, new Date(), tx);
      const user = await this._usersRepo.findById(existing.userId, tx);
      if (!user || !user.isActive) {
        return null;
      }
      return this._issueTokensTx(tx, user.id, user.email, {
        deviceName: existing.deviceName,
        userAgent: device.userAgent ?? existing.userAgent,
      });
    });
    if (!result) {
      throw new HttpError(401, 'invalid_refresh', 'refresh token invalid or expired');
    }
    return result;
  }

  async findUser(userId: string): Promise<IUserAccount | null> {
    const row = await this._usersRepo.findById(userId);
    return row ? toUserAccount(row) : null;
  }

  async listDevices(userId: string, currentJti: string): Promise<IDevice[]> {
    const rows = await this._refreshTokens.listActiveByUserId(userId, new Date());
    return rows.map((r) => ({
      id: r.jti,
      deviceName: r.deviceName,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      isCurrent: r.jti === currentJti,
    }));
  }

  async revokeDevice(userId: string, jti: string): Promise<void> {
    await this._refreshTokens.revokeOneByUserId(userId, jti, new Date());
  }

  async logoutAll(userId: string): Promise<void> {
    await this._refreshTokens.revokeAllByUserId(userId, new Date());
  }

  async resolveGoogleIdentity(identity: IGoogleUserInfo): Promise<IUserAccount> {
    if (!identity.emailVerified) {
      // Linking or creating by email is only safe when Google asserts the email is verified.
      throw new HttpError(403, 'email_not_verified', 'google account email is not verified');
    }
    const email = identity.email.trim().toLowerCase();
    const userRow = await this._db.transaction(async (tx) => {
      const existing = await this._oauthIdentities.findByProviderUserId('google', identity.sub, tx);
      let user = existing ? await this._usersRepo.findById(existing.userId, tx) : null;
      if (!user) {
        // Auto-link to an existing account with the same Google-verified email. Safe under the
        // decoupled-vault model: the session this grants carries no data access on its own — the
        // encryption password (which is also the SRP login password) must still be entered to
        // unlock the vault. So an existing email+password user proves ownership simply by
        // unlocking with their original password; no separate "link Google" step is needed.
        user = await this._usersRepo.findByEmail(email, tx);
      }
      if (!user) {
        const config = this._configService.getConfig<IAuthPluginConfig>(AUTH_PLUGIN_CONFIG_KEY);
        if (!config?.allowOpenRegistration) {
          throw new HttpError(403, 'registration_closed', 'open registration is disabled on this server');
        }

        user = await this._usersRepo.insert({
          email,
          displayName: identity.name ?? null,
          avatarUrl: identity.picture ?? null,
          emailVerified: true,
        }, tx);
      } else {
        if (!user.isActive) {
          throw new HttpError(403, 'account_disabled', 'account is disabled');
        }
        const profilePatch: { displayName?: string; avatarUrl?: string } = {};
        if (!user.displayName && identity.name) {
          profilePatch.displayName = identity.name;
        }
        if (!user.avatarUrl && identity.picture) {
          profilePatch.avatarUrl = identity.picture;
        }
        if (Object.keys(profilePatch).length > 0) {
          user = await this._usersRepo.updateProfile(user.id, profilePatch, tx);
        }
      }

      await this._oauthIdentities.upsert({
        provider: 'google',
        providerUserId: identity.sub,
        userId: user.id,
        email: identity.email,
        displayName: identity.name ?? null,
        avatarUrl: identity.picture ?? null,
      }, tx);

      return user;
    });

    return toUserAccount(userRow);
  }

  async issueSession(userId: string, device: IDeviceMeta): Promise<{ user: IUserAccount; tokens: ITokenBundle }> {
    const user = await this._usersRepo.findById(userId);
    if (!user) {
      throw new HttpError(401, 'invalid_credentials');
    }
    if (!user.isActive) {
      throw new HttpError(403, 'account_disabled', 'account is disabled');
    }
    const tokens = await this._issueTokens(user.id, user.email, device);
    return { user: toUserAccount(user), tokens };
  }

  async getE2EStatus(userId: string): Promise<IE2EStatus> {
    // A password is "configured" iff an SRP credential exists — the single source
    // of truth for both password-registered and OAuth-with-encryption-password
    // accounts. An OAuth user who already registered with email+password thus sees
    // configured=true and unlocks with that password rather than setting a new one.
    const row = await this._srpCredentials.findByUserId(userId);
    if (!row) {
      return { configured: false };
    }
    return { configured: true, argon2SaltB64: row.argon2SaltB64 };
  }

  async setupE2E(userId: string, argon2SaltB64: string, srpSalt: string, srpVerifier: string): Promise<IE2EStatus> {
    // Refuse to overwrite an existing password — an account that already has one
    // (email+password registration, or a prior setup) must unlock with it, not reset.
    const existing = await this._srpCredentials.findByUserId(userId);
    if (existing) {
      throw new HttpError(409, 'password_already_set', 'an encryption password is already set for this account');
    }
    try {
      await this._srpCredentials.insert({ userId, argon2SaltB64, srpSalt, srpVerifier });
    } catch (err) {
      if (err instanceof UniqueViolationError) {
        // Lost the race against a concurrent first-setup — same outcome as the check above.
        throw new HttpError(409, 'password_already_set', 'an encryption password is already set for this account');
      }
      throw err;
    }
    return { configured: true, argon2SaltB64 };
  }

  private async _issueTokensTx(tx: ITxContext, userId: string, email: string, device: IDeviceMeta): Promise<ITokenBundle> {
    const now = Date.now();
    const accessTokenExpiresAt = this._jwt.computeAccessExpiresAt(now);
    const refreshTokenExpiresAt = this._jwt.computeRefreshExpiresAt(now);
    const { jti } = await this._refreshTokens.insertReturningJti({
      userId,
      expiresAt: new Date(refreshTokenExpiresAt),
      deviceName: device.deviceName,
      userAgent: device.userAgent,
    }, tx);
    const accessToken = await this._jwt.signAccess({ sub: userId, email, jti });
    const refreshToken = await this._jwt.signRefresh({ sub: userId, jti });
    return { accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt };
  }

  private _issueTokens(userId: string, email: string, device: IDeviceMeta): Promise<ITokenBundle> {
    return this._db.transaction((tx) => this._issueTokensTx(tx, userId, email, device));
  }

  /**
   * Deterministic decoy values for unknown accounts — keep the (init → verify)
   * timing distribution indistinguishable from the real path. Same HMAC key
   * across requests so the same unknown email always sees the same decoy
   * (mirrors real accounts where credentials don't change between probes).
   */
  private async _decoyBase64(seed: string, bytes: number): Promise<string> {
    const h = await this._hmac.sha256('termlnk-fake-base64', seed);
    return uint8ToBase64(repeatTo(h, bytes));
  }

  private async _decoyHex(seed: string, bytes: number): Promise<string> {
    const h = await this._hmac.sha256('termlnk-fake-hex', seed);
    return uint8ToHex(repeatTo(h, bytes));
  }
}

function repeatTo(src: Uint8Array, target: number): Uint8Array {
  if (src.length >= target) {
    return src.subarray(0, target);
  }
  const out = new Uint8Array(target);
  for (let i = 0; i < target; i++) {
    out[i] = src[i % src.length]!;
  }
  return out;
}

function uint8ToHex(u: Uint8Array): string {
  let out = '';
  for (let i = 0; i < u.length; i++) {
    out += u[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

function uint8ToBase64(u: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(u).toString('base64');
  }
  let bin = '';
  for (let i = 0; i < u.length; i++) {
    bin += String.fromCharCode(u[i]!);
  }
  // btoa is available in both edge runtimes and Node 16+
  return btoa(bin);
}

function toUserAccount(row: IUserRow): IUserAccount {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName ?? undefined,
    avatarUrl: row.avatarUrl ?? undefined,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
