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

import type { JWTPayload } from 'jose';
import { createIdentifier } from '@termlnk-server/core';

export interface IJwtClaims extends JWTPayload {
  sub: string;
  jti: string;
}

export interface IAccessClaims extends IJwtClaims {
  email: string;
}

export interface IRefreshClaims extends IJwtClaims {}

export interface IJwtConfig {
  accessSecret: string;
  refreshSecret: string;
  /** in seconds */
  accessTtl: number;
  /** in seconds */
  refreshTtl: number;
}

/**
 * HS256 JWT signing & verification — `jose` under the hood, edge-safe.
 *
 * Access and refresh tokens MUST use distinct secrets so a stolen access token
 * can never be replayed as a refresh token. The refresh `jti` is also recorded
 * in `refresh_tokens`; rotation revokes the old jti and issues a new one.
 */
export interface IJwtService {
  computeAccessExpiresAt(now?: number): number;
  computeRefreshExpiresAt(now?: number): number;
  signAccess(claims: IAccessClaims): Promise<string>;
  signRefresh(claims: IRefreshClaims): Promise<string>;
  verifyAccess(token: string): Promise<IAccessClaims>;
  verifyRefresh(token: string): Promise<IRefreshClaims>;
}

export const IJwtService = createIdentifier<IJwtService>('crypto.jwt');
