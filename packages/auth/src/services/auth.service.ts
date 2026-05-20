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

import type { IHmacService, IJwtService } from '@termlnk-server/crypto';
import type { IDBAdaptorService, ITxContext } from '@termlnk-server/database';
import type {
  IRefreshTokensRepository,
  ISrpCredentialsRepository,
  IUserRow,
  IUsersRepository,
} from '@termlnk-server/database/repositories';
import type { IDevice, IUserAccount } from '@termlnk-server/protocol';
import { createIdentifier } from '@termlnk-server/core';
import { UniqueViolationError } from '@termlnk-server/database/repositories';
import { HttpError } from '@termlnk-server/rpc-server';

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

export interface IAuthServiceConfig {
  allowOpenRegistration: boolean;
  requireEmailVerification: boolean;
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
}

export const IAuthService = createIdentifier<IAuthService>('auth.service');

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

export class AuthService implements IAuthService {
  constructor(
    private readonly _db: IDBAdaptorService,
    private readonly _users: IUsersRepository,
    private readonly _refreshTokens: IRefreshTokensRepository,
    private readonly _srpCredentials: ISrpCredentialsRepository,
    private readonly _jwt: IJwtService,
    private readonly _hmac: IHmacService,
    private readonly _config: IAuthServiceConfig
  ) {}

  async register(params: IRegisterParams): Promise<{ user: IUserAccount; tokens: ITokenBundle }> {
    if (!this._config.allowOpenRegistration) {
      throw new HttpError(403, 'registration_closed', 'open registration is disabled on this server');
    }
    const email = params.email.trim().toLowerCase();
    const userRow = await this._db.transaction(async (tx) => {
      try {
        const u = await this._users.insert({
          email,
          displayName: params.displayName ?? null,
          emailVerified: !this._config.requireEmailVerification,
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
    const user = await this._users.findByEmail(lookup);
    if (!user) {
      throw new HttpError(401, 'invalid_credentials');
    }
    if (this._config.requireEmailVerification && !user.emailVerified) {
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
      const user = await this._users.findById(existing.userId, tx);
      if (!user) {
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
    const row = await this._users.findById(userId);
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
