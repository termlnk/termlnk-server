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
import { ISrpService } from '@termlnk-server/crypto';
import { IKVStore } from '@termlnk-server/kv';

const PENDING_TTL_SECONDS = 5 * 60;

function pendingKey(email: string): string {
  return `srp:pending:${email}`;
}

interface IPendingSession {
  serverSecretEphemeral: string;
  /** echoed back from the init step so verify doesn't need another DB hit for the verifier */
  srpVerifier: string;
  srpSalt: string;
}

export interface ISrpSessionService {
  begin(email: string, srpSalt: string, srpVerifier: string): Promise<{ serverPublicEphemeral: string }>;
  verifyAndConsume(
    email: string,
    clientPublicEphemeral: string,
    clientSessionProof: string
  ): Promise<{ serverProof: string; sessionKey: string } | null>;
}

export const ISrpSessionService = createIdentifier<ISrpSessionService>('auth.srp-session');

/**
 * SRP pending-session state, persisted in the KV (5 min TTL). The pure SRP6a
 * math is in `ISrpService` (crypto package) — this class only owns the (email →
 * serverSecret, salt, verifier) bookkeeping between init and verify.
 *
 * Why key by email alone, not (email, serverPublicEphemeral): the client never
 * echoes the server ephemeral back, so a (email, …) tuple would never match.
 * We accept that one in-flight SRP attempt per email is the right granularity
 * (concurrent attempts from the same account are racy by definition).
 */
export class SrpSessionService implements ISrpSessionService {
  constructor(
    @ISrpService private readonly _srpService: ISrpService,
    @IKVStore private readonly _kvService: IKVStore
  ) {}

  async begin(email: string, srpSalt: string, srpVerifier: string): Promise<{ serverPublicEphemeral: string }> {
    const ephemeral = this._srpService.generateEphemeral(srpVerifier);
    const stored: IPendingSession = {
      serverSecretEphemeral: ephemeral.serverSecretEphemeral,
      srpVerifier,
      srpSalt,
    };
    await this._kvService.set(pendingKey(email), JSON.stringify(stored), { ttlSeconds: PENDING_TTL_SECONDS });
    return { serverPublicEphemeral: ephemeral.serverPublicEphemeral };
  }

  async verifyAndConsume(email: string, clientPublicEphemeral: string, clientSessionProof: string): Promise<{ serverProof: string; sessionKey: string } | null> {
    const raw = await this._kvService.get(pendingKey(email));
    if (!raw) {
      return null;
    }
    // one-shot: drop the pending record before consuming so a pipelined duplicate verify can't reuse it.
    await this._kvService.del(pendingKey(email));

    const stored = JSON.parse(raw) as IPendingSession;
    try {
      return this._srpService.deriveSession(
        stored.serverSecretEphemeral,
        clientPublicEphemeral,
        stored.srpSalt,
        email,
        stored.srpVerifier,
        clientSessionProof
      );
    } catch {
      return null;
    }
  }
}
