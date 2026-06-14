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

import type { IAdminPluginConfig } from '../config.schema';
import type { IAdminUserRow, IAdminUsersRepository } from '../repositories/admin-users.repository';
import { hash, verify } from '@node-rs/argon2';
import { createIdentifier, IConfigService, ILogService } from '@termlnk-server/core';
import { UniqueViolationError } from '@termlnk-server/database/repositories';
import { HttpError } from '@termlnk-server/rpc-server';
import { jwtVerify, SignJWT } from 'jose';
import { ADMIN_PLUGIN_CONFIG_KEY } from '../config.schema';
import { IAdminUsersRepository as AdminUsersRepositoryId } from '../repositories/admin-users.repository';

export interface IAdminAccount {
  id: string;
  email: string;
  displayName: string | undefined;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | undefined;
}

export interface IAdminLoginResult {
  admin: IAdminAccount;
  token: string;
  expiresAt: number;
}

export interface IAdminTokenClaims {
  sub: string;
  email: string;
  role: 'admin';
}

export interface IAdminAuthService {
  login(email: string, password: string): Promise<IAdminLoginResult>;
  verifyToken(token: string): Promise<IAdminTokenClaims>;
  findAdmin(id: string): Promise<IAdminAccount | null>;
  changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<void>;
  seedIfEmpty(): Promise<void>;
}

export const IAdminAuthService = createIdentifier<IAdminAuthService>('admin.auth-service');

export const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

export class AdminAuthService implements IAdminAuthService {
  private _encodedSecret: Uint8Array | null = null;

  constructor(
    @AdminUsersRepositoryId private readonly _adminUsers: IAdminUsersRepository,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {}

  async login(email: string, password: string): Promise<IAdminLoginResult> {
    const lookup = email.trim().toLowerCase();
    const row = await this._adminUsers.findByEmail(lookup);
    if (!row) {
      throw new HttpError(401, 'invalid_credentials', 'invalid email or password');
    }
    if (!row.isActive) {
      throw new HttpError(403, 'account_disabled', 'admin account is disabled');
    }

    const valid = await verify(row.passwordHash, password);
    if (!valid) {
      throw new HttpError(401, 'invalid_credentials', 'invalid email or password');
    }

    await this._adminUsers.updateLastLoginAt(row.id);

    const config = this._config();
    const now = Math.floor(Date.now() / 1000);
    const ttl = config.jwtTtlSeconds ?? 3600;
    const expiresAt = (now + ttl) * 1000;

    const secret = this._getEncodedSecret();
    const token = await new SignJWT({ email: row.email, role: 'admin' as const })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(row.id)
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .sign(secret);

    return { admin: toAdminAccount(row), token, expiresAt };
  }

  async verifyToken(token: string): Promise<IAdminTokenClaims> {
    const secret = this._getEncodedSecret();
    try {
      const { payload } = await jwtVerify(token, secret);
      if (payload.role !== 'admin' || !payload.sub || !payload.email) {
        throw new HttpError(401, 'invalid_token', 'invalid admin token');
      }
      return { sub: payload.sub, email: payload.email as string, role: 'admin' };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(401, 'invalid_token', 'admin token invalid or expired');
    }
  }

  async findAdmin(id: string): Promise<IAdminAccount | null> {
    const row = await this._adminUsers.findById(id);
    return row ? toAdminAccount(row) : null;
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<void> {
    const row = await this._adminUsers.findById(adminId);
    if (!row) {
      throw new HttpError(401, 'admin_not_found');
    }

    const valid = await verify(row.passwordHash, currentPassword);
    if (!valid) {
      throw new HttpError(401, 'invalid_credentials', 'current password is incorrect');
    }

    const passwordHash = await hash(newPassword, ARGON2_OPTIONS);
    await this._adminUsers.updatePasswordHash(adminId, passwordHash);
  }

  async seedIfEmpty(): Promise<void> {
    const config = this._config();
    if (!config.seedEmail || !config.seedPassword) return;

    const count = await this._adminUsers.count();
    if (count > 0) return;

    const passwordHash = await hash(config.seedPassword, ARGON2_OPTIONS);
    try {
      await this._adminUsers.insert({
        email: config.seedEmail.trim().toLowerCase(),
        passwordHash,
        displayName: 'Admin',
      });
      this._logService.log('[AdminAuthService] seed admin created');
    } catch (err) {
      if (err instanceof UniqueViolationError) {
        this._logService.log('[AdminAuthService] seed admin already exists (concurrent insert)');
        return;
      }
      throw err;
    }
  }

  private _getEncodedSecret(): Uint8Array {
    if (!this._encodedSecret) {
      this._encodedSecret = new TextEncoder().encode(this._config().jwtSecret);
    }
    return this._encodedSecret;
  }

  private _config(): IAdminPluginConfig {
    const config = this._configService.getConfig<IAdminPluginConfig>(ADMIN_PLUGIN_CONFIG_KEY);
    if (!config) throw new Error('admin config not found');
    return config;
  }
}

function toAdminAccount(row: IAdminUserRow): IAdminAccount {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString(),
  };
}
