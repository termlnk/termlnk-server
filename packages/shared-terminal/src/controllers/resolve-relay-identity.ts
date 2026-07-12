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

import type { IJwtService } from '@termlnk-server/crypto';
import type { IRelayClaimTokenService } from '../services/relay-claim-token.service';
import { HttpError } from '@termlnk-server/rpc-server';
import { isAnonymousJoinerId } from '../common/anonymous-joiner';

/**
 * Relay attach authentication — either-or over the two WS subprotocol
 * credentials (browsers can't set arbitrary headers on WS upgrades, so both
 * ride `sec-websocket-protocol`):
 *
 *   1. `Bearer.<jwt>` — signed-in path (the pre-existing behavior). The JWT
 *      subject keys the relay bucket. A `RelayToken.<t>` may accompany it for
 *      cross-account joins; its `joinerUserId` is pinned to the JWT subject so
 *      a stolen token can't be replayed under another account.
 *   2. `RelayToken.<t>` alone — ANONYMOUS client attach. Accepted only when
 *      the token's `joinerUserId` carries the `anon-` prefix (a token minted
 *      for a signed-in joiner can never take this path, keeping pin #1
 *      meaningful) and only in client mode. Because there is no JWT to pin
 *      against, the binding is `connectionId`: the query MUST carry the exact
 *      connectionId the claim flow issued inside the token.
 *
 * Daemon mode (the owner's side) always requires the JWT.
 *
 * Extracted as a pure function so every branch is unit-testable without the
 * Hono upgrade dance.
 */

export interface IRelayIdentity {
  /** userId that keys relay audit/routing — JWT sub, or the token's anon- id. */
  readonly userId: string;
  /** When set, the relay routes the attach into this owner's session bucket. */
  readonly ownerUserId?: string;
}

export interface IResolveRelayIdentityInput {
  readonly subprotocolHeader: string | null | undefined;
  readonly mode: 'daemon' | 'client';
  readonly sessionId: string;
  readonly connectionId?: string;
}

export async function resolveRelayIdentity(
  input: IResolveRelayIdentityInput,
  jwt: IJwtService,
  relayClaimToken: IRelayClaimTokenService
): Promise<IRelayIdentity> {
  const protocols = (input.subprotocolHeader ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const bearer = protocols.find((p) => p.startsWith('Bearer.'))?.slice('Bearer.'.length);
  const relayToken = protocols.find((p) => p.startsWith('RelayToken.'))?.slice('RelayToken.'.length);

  if (bearer !== undefined) {
    return await resolveSignedIn(bearer, relayToken, input, jwt, relayClaimToken);
  }
  if (input.mode !== 'client' || relayToken === undefined) {
    throw new HttpError(401, 'unauthorized', 'missing Bearer in sec-websocket-protocol');
  }
  return await resolveAnonymous(relayToken, input, relayClaimToken);
}

async function resolveSignedIn(
  bearer: string,
  relayToken: string | undefined,
  input: IResolveRelayIdentityInput,
  jwt: IJwtService,
  relayClaimToken: IRelayClaimTokenService
): Promise<IRelayIdentity> {
  let userId: string;
  try {
    const claims = await jwt.verifyAccess(bearer);
    userId = claims.sub;
  } catch {
    throw new HttpError(401, 'unauthorized', 'invalid or expired token');
  }
  // Daemon-mode attaches ignore relay-claim tokens entirely — the owner's own
  // JWT IS the bucket key, and honoring an ownerUserId override here would let
  // a daemon plant itself in another user's bucket.
  if (input.mode !== 'client' || relayToken === undefined) {
    return { userId };
  }
  const payload = await verifyOrReject(relayToken, relayClaimToken);
  if (payload.joinerUserId !== userId) {
    throw new HttpError(403, 'relay_token_subject_mismatch', 'relay-claim token joiner does not match ws subject');
  }
  requireSessionMatch(payload.sessionId, input.sessionId);
  if (input.connectionId && payload.connectionId !== input.connectionId) {
    throw new HttpError(403, 'relay_token_connection_mismatch', 'relay-claim token connectionId does not match query');
  }
  return { userId, ownerUserId: payload.ownerUserId };
}

async function resolveAnonymous(
  relayToken: string,
  input: IResolveRelayIdentityInput,
  relayClaimToken: IRelayClaimTokenService
): Promise<IRelayIdentity> {
  const payload = await verifyOrReject(relayToken, relayClaimToken);
  if (!isAnonymousJoinerId(payload.joinerUserId)) {
    // A token minted for a signed-in joiner must come WITH that joiner's JWT
    // (path above) — accepting it bare would void the subject pin.
    throw new HttpError(403, 'relay_token_requires_bearer', 'relay-claim token was minted for a signed-in joiner');
  }
  requireSessionMatch(payload.sessionId, input.sessionId);
  // No JWT to pin against, so the connectionId issued at claim time is the
  // binding — mandatory here, unlike the conditional check on the signed-in path.
  if (!input.connectionId || payload.connectionId !== input.connectionId) {
    throw new HttpError(403, 'relay_token_connection_mismatch', 'anonymous attach requires the claimed connectionId');
  }
  return { userId: payload.joinerUserId, ownerUserId: payload.ownerUserId };
}

async function verifyOrReject(
  token: string,
  relayClaimToken: IRelayClaimTokenService
): Promise<Awaited<ReturnType<IRelayClaimTokenService['verify']>>> {
  try {
    return await relayClaimToken.verify(token);
  } catch {
    // Do not surface verify()'s internal message — it would let probers
    // distinguish "expired" from "signature mismatch" from "malformed".
    throw new HttpError(401, 'invalid_relay_token', 'relay claim token rejected');
  }
}

function requireSessionMatch(tokenSessionId: string, querySessionId: string): void {
  if (tokenSessionId !== querySessionId) {
    throw new HttpError(403, 'relay_token_session_mismatch', 'relay-claim token sessionId does not match query');
  }
}
