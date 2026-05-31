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
// Desktop relay: the hop from the success landing page's deep link to the claim — short.
const RELAY_TTL_SECONDS = 2 * 60;
// Web relay: the outcome reaches the client's backend via a poll and only then gets
// claimed, so its window must cover the polling hop on top of the claim.
export const WEB_RELAY_TTL_SECONDS = 5 * 60;

function pendingKey(state: string): string {
  return `oauth:google:pending:${state}`;
}

function relayKey(code: string): string {
  return `oauth:google:relay:${code}`;
}

function webOutcomeKey(deviceCode: string): string {
  return `oauth:google:web:${deviceCode}`;
}

/** Resolved sign-in held between the browser callback and the desktop claim. */
export interface IOAuthRelayPayload {
  userId: string;
}

/**
 * Pending state recorded on /start (desktop) or /web/begin, consumed on
 * /callback. Carries the PKCE verifier plus how to hand the user back: a desktop
 * client bounces through the success landing page's deep link, while a web client
 * is identified by the `deviceCode` its backend polls with (the client domain is
 * never known to us). A discriminated union so `isWeb` guarantees the `deviceCode`.
 */
export type IOAuthPendingPayload =
  | { isWeb: false; codeVerifier: string }
  | { isWeb: true; codeVerifier: string; deviceCode: string };

/**
 * Terminal outcome of a web callback, parked under the client's `deviceCode` for
 * its backend to poll once: the one-time `relayCode` to claim, or the failure that
 * ended the flow so the client can stop polling instead of hanging.
 */
export type IOAuthWebOutcome =
  | { status: 'success'; relayCode: string }
  | { status: 'error'; error: string };

/**
 * Three short-lived KV namespaces backing the server-driven Google flow:
 *   - pending: `state` → PKCE verifier + flow target, written on /start|/web/begin, consumed on /callback
 *   - relay:   one-time `relayCode` → resolved userId, written on /callback, consumed on /claim
 *   - web:     `deviceCode` → terminal outcome (relayCode | error), written on /callback (web), consumed by /web/poll
 * All are one-shot (consumed on read) so a replayed state, relay code, or device code is rejected.
 */
export interface IOAuthFlowStore {
  savePending(state: string, payload: IOAuthPendingPayload): Promise<void>;
  consumePending(state: string): Promise<IOAuthPendingPayload | null>;
  saveRelay(payload: IOAuthRelayPayload, ttlSeconds?: number): Promise<string>;
  consumeRelay(relayCode: string): Promise<IOAuthRelayPayload | null>;
  saveWebOutcome(deviceCode: string, outcome: IOAuthWebOutcome): Promise<void>;
  consumeWebOutcome(deviceCode: string): Promise<IOAuthWebOutcome | null>;
}

export const IOAuthFlowStore = createIdentifier<IOAuthFlowStore>('auth.oauth-flow-store');

export class OAuthFlowStore implements IOAuthFlowStore {
  constructor(
    @IKVStore private readonly _kv: IKVStore
  ) {}

  async savePending(state: string, payload: IOAuthPendingPayload): Promise<void> {
    await this._kv.set(pendingKey(state), JSON.stringify(payload), { ttlSeconds: PENDING_TTL_SECONDS });
  }

  async consumePending(state: string): Promise<IOAuthPendingPayload | null> {
    // Atomic read-and-delete: a replayed state can't pass twice even under a race.
    const raw = await this._kv.getdel(pendingKey(state));
    if (raw === null) {
      return null;
    }
    try {
      const payload = JSON.parse(raw) as IOAuthPendingPayload;
      // A web pending is meaningless without the deviceCode its poll keys on; reject a
      // tampered/legacy blob rather than silently treating it as a desktop flow.
      if (payload.isWeb && typeof payload.deviceCode !== 'string') {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async saveRelay(payload: IOAuthRelayPayload, ttlSeconds: number = RELAY_TTL_SECONDS): Promise<string> {
    const relayCode = randomBase64Url(32);
    await this._kv.set(relayKey(relayCode), JSON.stringify(payload), { ttlSeconds });
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

  async saveWebOutcome(deviceCode: string, outcome: IOAuthWebOutcome): Promise<void> {
    await this._kv.set(webOutcomeKey(deviceCode), JSON.stringify(outcome), { ttlSeconds: WEB_RELAY_TTL_SECONDS });
  }

  async consumeWebOutcome(deviceCode: string): Promise<IOAuthWebOutcome | null> {
    const raw = await this._kv.getdel(webOutcomeKey(deviceCode));
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as IOAuthWebOutcome;
    } catch {
      return null;
    }
  }
}
