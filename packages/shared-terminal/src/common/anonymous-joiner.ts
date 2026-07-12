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
 * Anonymous joiner identity — shared between the collab claim flow (mints the
 * id into the relay-claim token) and the relay controller (accepts token-only
 * attaches ONLY for ids carrying this prefix).
 *
 * The prefix partitions the userId namespace: real account ids never start
 * with `anon-`, so a relay-claim token minted for a signed-in joiner can never
 * be replayed through the anonymous (no-JWT) relay path — that path rejects
 * non-prefixed joiner ids, keeping the existing joinerUserId==JWT.sub pin
 * meaningful for signed-in users.
 */
export const ANONYMOUS_JOINER_ID_PREFIX = 'anon-';

export function isAnonymousJoinerId(userId: string): boolean {
  return userId.startsWith(ANONYMOUS_JOINER_ID_PREFIX);
}

/** `anon-` + base64url(16 random bytes) — collision-safe per-claim ephemeral id. */
export function generateAnonymousJoinerId(): string {
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    s += String.fromCharCode(buf[i]!);
  }
  const b64url = btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${ANONYMOUS_JOINER_ID_PREFIX}${b64url}`;
}
