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

export interface ISrpBeginResult {
  /** ephemeral public key — sent to the client */
  serverPublicEphemeral: string;
  /** ephemeral secret key — keep server-side; usually persisted to KV under (email, ttl=5min) */
  serverSecretEphemeral: string;
}

export interface ISrpVerifyOk {
  /** SRP-M2 server proof — sent back to client so it can authenticate the server */
  serverProof: string;
  /** session key — shared between client and server, currently unused but kept for future MAC */
  sessionKey: string;
}

/**
 * Stateless SRP6a server primitives.
 *
 * The "stateful" pieces — pending ephemerals, salts and verifiers between the
 * init and verify steps — live in the KV store, not inside this service. That
 * way a server can scale horizontally without sticky sessions.
 *
 * The server's SRP "password" input is `IMasterKey.authKey` hex from the client
 * (never the real password). Two server implementations must agree on RFC 5054
 * group + SHA-1 (the client's chosen defaults).
 */
export interface ISrpService {
  /** Step 2: mint a server ephemeral keyed by the verifier. Stateless — caller persists the secret. */
  generateEphemeral(srpVerifier: string): ISrpBeginResult;

  /** Step 4: derive session given previously-minted server secret + client public + client proof. */
  deriveSession(
    serverSecretEphemeral: string,
    clientPublicEphemeral: string,
    srpSalt: string,
    email: string,
    srpVerifier: string,
    clientSessionProof: string
  ): ISrpVerifyOk;
}

export const ISrpService = createIdentifier<ISrpService>('crypto.srp');
