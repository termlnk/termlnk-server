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

import type { IAccessClaims, IJwtConfig, IJwtService, IRefreshClaims } from '../services/jwt.service';
import { jwtVerify, SignJWT } from 'jose';

/**
 * HS256 JWT sign/verify backed by `jose`, which uses the global
 * `crypto.subtle` available on Node 22+.
 */
export class JoseJwtService implements IJwtService {
  private readonly _accessKey: Uint8Array;
  private readonly _refreshKey: Uint8Array;
  private readonly _accessTtl: number;
  private readonly _refreshTtl: number;

  constructor(config: IJwtConfig) {
    this._accessKey = new TextEncoder().encode(config.accessSecret);
    this._refreshKey = new TextEncoder().encode(config.refreshSecret);
    this._accessTtl = config.accessTtl;
    this._refreshTtl = config.refreshTtl;
  }

  computeAccessExpiresAt(now: number = Date.now()): number {
    return now + this._accessTtl * 1000;
  }

  computeRefreshExpiresAt(now: number = Date.now()): number {
    return now + this._refreshTtl * 1000;
  }

  async signAccess(claims: IAccessClaims): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(`${this._accessTtl}s`)
      .sign(this._accessKey);
  }

  async signRefresh(claims: IRefreshClaims): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(`${this._refreshTtl}s`)
      .sign(this._refreshKey);
  }

  async verifyAccess(token: string): Promise<IAccessClaims> {
    const { payload } = await jwtVerify<IAccessClaims>(token, this._accessKey);
    return payload;
  }

  async verifyRefresh(token: string): Promise<IRefreshClaims> {
    const { payload } = await jwtVerify<IRefreshClaims>(token, this._refreshKey);
    return payload;
  }
}
