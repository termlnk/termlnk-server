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

// base64url codec (RFC 4648 §5, unpadded) + random-token helper shared by the
// Google OAuth flow. WebCrypto + btoa/atob keep this runtime-agnostic (Node / edge).

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function base64UrlDecodeToString(segment: string): string {
  let padded = segment.replaceAll('-', '+').replaceAll('_', '/');
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** Cryptographically-random, unpadded base64url token of `byteLength` random bytes. */
export function randomBase64Url(byteLength: number): string {
  const buf = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}
