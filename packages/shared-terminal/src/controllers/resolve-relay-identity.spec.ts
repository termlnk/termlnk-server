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

import type { IAccessClaims, IJwtService } from '@termlnk-server/crypto';
import type { IRelayClaimTokenPayload, IRelayClaimTokenService } from '../services/relay-claim-token.service';
import { HttpError } from '@termlnk-server/rpc-server';
import { describe, expect, it, vi } from 'vitest';
import { resolveRelayIdentity } from './resolve-relay-identity';

const VALID_JWT = 'valid-jwt';
const JWT_SUB = 'user-1';

function makeJwt(): IJwtService {
  return {
    computeAccessExpiresAt: vi.fn(),
    computeRefreshExpiresAt: vi.fn(),
    signAccess: vi.fn(),
    signRefresh: vi.fn(),
    verifyAccess: vi.fn(async (token: string) => {
      if (token !== VALID_JWT) {
        throw new Error('bad token');
      }
      return { sub: JWT_SUB, email: 'u@example.test', jti: 'jti-1' } as IAccessClaims;
    }),
    verifyRefresh: vi.fn(),
  };
}

function makeTokenService(payloads: Record<string, IRelayClaimTokenPayload>): IRelayClaimTokenService {
  return {
    sign: vi.fn(),
    verify: vi.fn(async (token: string) => {
      const payload = payloads[token];
      if (!payload) {
        throw new Error('[RelayClaimToken] signature mismatch');
      }
      return payload;
    }),
  };
}

function payload(overrides: Partial<IRelayClaimTokenPayload> = {}): IRelayClaimTokenPayload {
  return {
    ownerUserId: 'owner-1',
    joinerUserId: 'anon-abc123',
    sessionId: 'session-1',
    inviteId: 'invite-1',
    connectionId: 'conn-1',
    exp: Date.now() + 60_000,
    ...overrides,
  };
}

function input(overrides: Partial<Parameters<typeof resolveRelayIdentity>[0]> = {}): Parameters<typeof resolveRelayIdentity>[0] {
  return {
    subprotocolHeader: undefined,
    mode: 'client',
    sessionId: 'session-1',
    connectionId: 'conn-1',
    ...overrides,
  };
}

async function rejectsHttp(promise: Promise<unknown>, status: number, code: string): Promise<void> {
  const err = await promise.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
  expect((err as HttpError).code).toBe(code);
}

describe('resolveRelayIdentity — signed-in (Bearer) path', () => {
  it('resolves the JWT subject with no relay token', async () => {
    const identity = await resolveRelayIdentity(
      input({ subprotocolHeader: `Bearer.${VALID_JWT}` }),
      makeJwt(),
      makeTokenService({})
    );
    expect(identity).toEqual({ userId: JWT_SUB });
  });

  it('rejects an invalid JWT with 401 even when a valid relay token accompanies it', async () => {
    const tokens = makeTokenService({ t1: payload({ joinerUserId: JWT_SUB }) });
    await rejectsHttp(
      resolveRelayIdentity(
        input({ subprotocolHeader: 'Bearer.garbage, RelayToken.t1' }),
        makeJwt(),
        tokens
      ),
      401,
      'unauthorized'
    );
  });

  it('routes into the owner bucket when the relay token pins to the JWT subject', async () => {
    const tokens = makeTokenService({ t1: payload({ joinerUserId: JWT_SUB }) });
    const identity = await resolveRelayIdentity(
      input({ subprotocolHeader: `Bearer.${VALID_JWT}, RelayToken.t1` }),
      makeJwt(),
      tokens
    );
    expect(identity).toEqual({ userId: JWT_SUB, ownerUserId: 'owner-1' });
  });

  it('rejects a relay token minted for another subject (403 subject mismatch)', async () => {
    const tokens = makeTokenService({ t1: payload({ joinerUserId: 'user-2' }) });
    await rejectsHttp(
      resolveRelayIdentity(
        input({ subprotocolHeader: `Bearer.${VALID_JWT}, RelayToken.t1` }),
        makeJwt(),
        tokens
      ),
      403,
      'relay_token_subject_mismatch'
    );
  });

  it('rejects a relay token whose sessionId does not match the query', async () => {
    const tokens = makeTokenService({ t1: payload({ joinerUserId: JWT_SUB, sessionId: 'other' }) });
    await rejectsHttp(
      resolveRelayIdentity(
        input({ subprotocolHeader: `Bearer.${VALID_JWT}, RelayToken.t1` }),
        makeJwt(),
        tokens
      ),
      403,
      'relay_token_session_mismatch'
    );
  });

  it('ignores the relay token entirely in daemon mode', async () => {
    const tokens = makeTokenService({ t1: payload({ joinerUserId: JWT_SUB }) });
    const identity = await resolveRelayIdentity(
      input({ subprotocolHeader: `Bearer.${VALID_JWT}, RelayToken.t1`, mode: 'daemon' }),
      makeJwt(),
      tokens
    );
    expect(identity).toEqual({ userId: JWT_SUB });
    expect(tokens.verify).not.toHaveBeenCalled();
  });
});

describe('resolveRelayIdentity — anonymous (RelayToken-only) path', () => {
  it('resolves an anon- joiner into the owner bucket', async () => {
    const tokens = makeTokenService({ t1: payload() });
    const identity = await resolveRelayIdentity(
      input({ subprotocolHeader: 'RelayToken.t1' }),
      makeJwt(),
      tokens
    );
    expect(identity).toEqual({ userId: 'anon-abc123', ownerUserId: 'owner-1' });
  });

  it('rejects a token minted for a signed-in joiner (no anon- prefix)', async () => {
    const tokens = makeTokenService({ t1: payload({ joinerUserId: 'user-2' }) });
    await rejectsHttp(
      resolveRelayIdentity(input({ subprotocolHeader: 'RelayToken.t1' }), makeJwt(), tokens),
      403,
      'relay_token_requires_bearer'
    );
  });

  it('requires the query connectionId to match the token exactly', async () => {
    const tokens = makeTokenService({ t1: payload() });
    await rejectsHttp(
      resolveRelayIdentity(
        input({ subprotocolHeader: 'RelayToken.t1', connectionId: 'conn-other' }),
        makeJwt(),
        tokens
      ),
      403,
      'relay_token_connection_mismatch'
    );
  });

  it('rejects when the query carries no connectionId at all', async () => {
    const tokens = makeTokenService({ t1: payload() });
    const { connectionId: _omitted, ...rest } = input({ subprotocolHeader: 'RelayToken.t1' });
    await rejectsHttp(
      resolveRelayIdentity(rest, makeJwt(), tokens),
      403,
      'relay_token_connection_mismatch'
    );
  });

  it('rejects a sessionId mismatch', async () => {
    const tokens = makeTokenService({ t1: payload({ sessionId: 'other' }) });
    await rejectsHttp(
      resolveRelayIdentity(input({ subprotocolHeader: 'RelayToken.t1' }), makeJwt(), tokens),
      403,
      'relay_token_session_mismatch'
    );
  });

  it('rejects an unverifiable token with an opaque 401', async () => {
    await rejectsHttp(
      resolveRelayIdentity(input({ subprotocolHeader: 'RelayToken.forged' }), makeJwt(), makeTokenService({})),
      401,
      'invalid_relay_token'
    );
  });

  it('rejects daemon mode without a Bearer (token-only attach is client-only)', async () => {
    const tokens = makeTokenService({ t1: payload() });
    await rejectsHttp(
      resolveRelayIdentity(
        input({ subprotocolHeader: 'RelayToken.t1', mode: 'daemon' }),
        makeJwt(),
        tokens
      ),
      401,
      'unauthorized'
    );
  });
});

describe('resolveRelayIdentity — no credentials', () => {
  it('rejects an empty subprotocol header', async () => {
    await rejectsHttp(
      resolveRelayIdentity(input({ subprotocolHeader: undefined }), makeJwt(), makeTokenService({})),
      401,
      'unauthorized'
    );
    await rejectsHttp(
      resolveRelayIdentity(input({ subprotocolHeader: '' }), makeJwt(), makeTokenService({})),
      401,
      'unauthorized'
    );
  });

  it('rejects unrelated subprotocols', async () => {
    await rejectsHttp(
      resolveRelayIdentity(input({ subprotocolHeader: 'graphql-ws' }), makeJwt(), makeTokenService({})),
      401,
      'unauthorized'
    );
  });
});
