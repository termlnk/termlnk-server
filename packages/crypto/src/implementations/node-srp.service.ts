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

import type { ISrpBeginResult, ISrpService, ISrpVerifyOk } from '../services/srp.service';
import * as srp from 'secure-remote-password/server';

/**
 * `secure-remote-password/server` (RFC 5054 group + SHA-1 by default). Matches
 * the desktop client's `secure-remote-password/client`. Uses Node `Buffer` +
 * `crypto.randomBytes` internally.
 */
export class NodeSrpService implements ISrpService {
  generateEphemeral(srpVerifier: string): ISrpBeginResult {
    const eph = srp.generateEphemeral(srpVerifier);
    return { serverPublicEphemeral: eph.public, serverSecretEphemeral: eph.secret };
  }

  deriveSession(
    serverSecretEphemeral: string,
    clientPublicEphemeral: string,
    srpSalt: string,
    email: string,
    srpVerifier: string,
    clientSessionProof: string
  ): ISrpVerifyOk {
    const session = srp.deriveSession(
      serverSecretEphemeral,
      clientPublicEphemeral,
      srpSalt,
      email,
      srpVerifier,
      clientSessionProof
    );
    return { serverProof: session.proof, sessionKey: session.key };
  }
}
