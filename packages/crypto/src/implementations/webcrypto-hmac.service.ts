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

import type { IHmacService } from '../services/hmac.service';

/**
 * WebCrypto HMAC-SHA-256. Uses the global `crypto.subtle` available on
 * Node 22+.
 */
export class WebCryptoHmacService implements IHmacService {
  async sha256(key: string, message: string): Promise<Uint8Array> {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
    return new Uint8Array(sig);
  }
}
