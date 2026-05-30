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
import { IKVStore } from '@termlnk-server/kv';
import { randomBase64Url } from './oauth-encoding';

// The pending window covers the time the user spends on Google's consent screen.
const PENDING_TTL_SECONDS = 10 * 60;
// The relay window is the hop from the browser's 302 to the desktop's claim — short.
const RELAY_TTL_SECONDS = 2 * 60;

function pendingKey(state: string): string {
  return `oauth:google:pending:${state}`;
}

function relayKey(code: string): string {
  return `oauth:google:relay:${code}`;
}

/** Resolved sign-in held between the browser callback and the desktop claim. */
export interface IOAuthRelayPayload {
  userId: string;
}

/**
 * Two short-lived KV namespaces backing the server-driven Google flow:
 *   - pending: `state` → PKCE `codeVerifier`, written on /start, consumed on /callback
 *   - relay:   one-time `relayCode` → resolved userId, written on /callback, consumed on /claim
 * Both are one-shot (consumed on read) so a replayed state or relay code is rejected.
 */
export interface IOAuthFlowStore {
  savePending(state: string, codeVerifier: string): Promise<void>;
  consumePending(state: string): Promise<string | null>;
  saveRelay(payload: IOAuthRelayPayload): Promise<string>;
  consumeRelay(relayCode: string): Promise<IOAuthRelayPayload | null>;
}

export const IOAuthFlowStore = createIdentifier<IOAuthFlowStore>('auth.oauth-flow-store');

export class OAuthFlowStore implements IOAuthFlowStore {
  constructor(
    @IKVStore private readonly _kv: IKVStore
  ) {}

  async savePending(state: string, codeVerifier: string): Promise<void> {
    await this._kv.set(pendingKey(state), codeVerifier, { ttlSeconds: PENDING_TTL_SECONDS });
  }

  async consumePending(state: string): Promise<string | null> {
    // Atomic read-and-delete: a replayed state can't pass twice even under a race.
    return this._kv.getdel(pendingKey(state));
  }

  async saveRelay(payload: IOAuthRelayPayload): Promise<string> {
    const relayCode = randomBase64Url(32);
    await this._kv.set(relayKey(relayCode), JSON.stringify(payload), { ttlSeconds: RELAY_TTL_SECONDS });
    return relayCode;
  }

  async consumeRelay(relayCode: string): Promise<IOAuthRelayPayload | null> {
    const raw = await this._kv.getdel(relayKey(relayCode));
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as IOAuthRelayPayload;
    } catch {
      return null;
    }
  }
}
