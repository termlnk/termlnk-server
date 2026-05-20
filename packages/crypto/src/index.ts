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

/**
 * @termlnk-server/crypto — three contracts:
 *   ISrpService   — SRP6a server primitives (stateless; pending sessions live in KV)
 *   IJwtService   — HS256 sign / verify (jose)
 *   IHmacService  — Keyed HMAC-SHA-256 for decoy salts in auth (timing equalization)
 *
 * Implementations:
 *   JoseJwtService        — jose-based HS256
 *   WebCryptoHmacService  — WebCrypto HMAC (built-in `crypto.subtle`)
 *   NodeSrpService        — `secure-remote-password/server`, imported via subpath
 *                           so consumers that don't need SRP can skip the peer dep:
 *                           import { NodeSrpService } from '@termlnk-server/crypto/node-srp';
 */

export { JoseJwtService } from './implementations/jose-jwt.service';
export { WebCryptoHmacService } from './implementations/webcrypto-hmac.service';
export { IHmacService } from './services/hmac.service';
export type { IAccessClaims, IJwtClaims, IJwtConfig, IRefreshClaims } from './services/jwt.service';
export { IJwtService } from './services/jwt.service';
export type { ISrpBeginResult, ISrpVerifyOk } from './services/srp.service';
export { ISrpService } from './services/srp.service';
