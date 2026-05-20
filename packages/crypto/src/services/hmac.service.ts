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

import { createIdentifier } from '@termlnk-server/core';

/**
 * Keyed HMAC — used by @termlnk-server/auth to generate deterministic decoy SRP salts /
 * verifiers when the requested account doesn't exist (timing-equalization). The
 * key is fixed per-deployment and never rotates; it's purely to make decoy
 * values look distinct per-email rather than producing a single constant.
 *
 * Two implementations under the hood: Node `node:crypto` for the Node adaptor,
 * WebCrypto `crypto.subtle.sign('HMAC', …)` for the edge adaptor.
 */
export interface IHmacService {
  /** Returns the SHA-256 HMAC of `message`. */
  sha256(key: string, message: string): Promise<Uint8Array>;
}

export const IHmacService = createIdentifier<IHmacService>('crypto.hmac');
