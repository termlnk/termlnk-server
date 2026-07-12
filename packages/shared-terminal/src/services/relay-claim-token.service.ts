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

import type { IHmacService } from '@termlnk-server/crypto';
import { createIdentifier } from '@termlnk-server/core';

/**
 * Short-lived bearer that the collab claim flow mints for a successful joiner
 * so they can attach to the OWNER's relay bucket even when their JWT has a
 * different `sub`. Without this, the relay's `sessionKey(userId, sessionId)`
 * routing places cross-account joiners into an isolated empty bucket — they
 * never reach the owner's daemon.
 *
 * Wire format: `{base64url(payloadJson)}.{base64url(hmacSha256(payloadBody))}`.
 * The payload contains both the OWNER and JOINER userIds, the
 * session/invite/connection ids, and an absolute expiry timestamp. Anyone with
 * the secret can mint a token; anyone WITHOUT it can't forge one.
 *
 * Replay semantics: the token is NOT single-use, and its TTL is a reconnect
 * window rather than a replay bound — the joiner's transport re-presents it on
 * every WS reconnect. Misuse is constrained by the attach-time bindings
 * instead: the relay controller pins `payload.joinerUserId` to the verifying
 * JWT's userId for signed-in joiners (token theft does not let a third party
 * impersonate the original joiner), and pins the claimed `connectionId` for
 * anonymous (`anon-` prefixed) joiners. The token is never persisted
 * server-side — the HMAC + pins are the proof.
 */
export interface IRelayClaimTokenPayload {
  /** Owner userId — the relay should attach this joiner to the owner's bucket. */
  readonly ownerUserId: string;
  /** Joiner userId — keeps the relay's audit trail (frame `source` etc). */
  readonly joinerUserId: string;
  /** Session id the joiner is joining. */
  readonly sessionId: string;
  /** Invite id the joiner consumed; lets relay correlate with collab logs. */
  readonly inviteId: string;
  /** Server-issued connectionId the joiner should use on relay attach. */
  readonly connectionId: string;
  /** Absolute expiry, ms since epoch. */
  readonly exp: number;
}

export interface IRelayClaimTokenService {
  /**
   * Sign a relay claim token. Pure function — no DB writes. Caller must
   * persist any single-use state separately (collab does this via the
   * `consumed` invite row).
   */
  sign(payload: IRelayClaimTokenPayload): Promise<string>;

  /**
   * Verify + parse a relay claim token. Throws on invalid signature,
   * malformed payload, or expired token. Callers that need stronger binding
   * (e.g. ws JWT == payload.joinerUserId) must enforce it themselves.
   */
  verify(token: string): Promise<IRelayClaimTokenPayload>;
}

export const IRelayClaimTokenService = createIdentifier<IRelayClaimTokenService>(
  'shared-terminal.relay-claim-token-service'
);

/**
 * Clock skew leeway for `exp` checks — tolerates small drift between the
 * mint-side and verify-side server clocks in multi-region deployments.
 */
const CLOCK_SKEW_LEEWAY_MS = 30_000;

export class RelayClaimTokenService implements IRelayClaimTokenService {
  constructor(
    private readonly _hmac: IHmacService,
    private readonly _secret: string,
    private readonly _ttlMs: number
  ) {}

  async sign(payload: IRelayClaimTokenPayload): Promise<string> {
    const body = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const sig = encodeBase64Url(await this._hmac.sha256(this._secret, body));
    return `${body}.${sig}`;
  }

  async verify(token: string): Promise<IRelayClaimTokenPayload> {
    const dot = token.indexOf('.');
    if (dot < 0) {
      throw new Error('[RelayClaimToken] malformed token (no separator)');
    }
    const body = token.slice(0, dot);
    const givenSig = token.slice(dot + 1);
    const expectedSig = encodeBase64Url(await this._hmac.sha256(this._secret, body));
    if (!constantTimeEqual(givenSig, expectedSig)) {
      throw new Error('[RelayClaimToken] signature mismatch');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(body)));
    } catch {
      throw new Error('[RelayClaimToken] malformed payload');
    }
    if (!isRelayClaimTokenPayload(parsed)) {
      throw new Error('[RelayClaimToken] malformed payload');
    }
    if (parsed.exp + CLOCK_SKEW_LEEWAY_MS < Date.now()) {
      throw new Error('[RelayClaimToken] token expired');
    }
    return parsed;
  }

  /** Helper for callers that want to mint with this service's default TTL. */
  defaultExp(): number {
    return Date.now() + this._ttlMs;
  }
}

function isRelayClaimTokenPayload(value: unknown): value is IRelayClaimTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.ownerUserId === 'string'
    && typeof v.joinerUserId === 'string'
    && typeof v.sessionId === 'string'
    && typeof v.inviteId === 'string'
    && typeof v.connectionId === 'string'
    && typeof v.exp === 'number'
    && Number.isFinite(v.exp)
  );
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? padded : padded + '='.repeat(4 - (padded.length % 4));
  const binary = globalThis.atob(pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
