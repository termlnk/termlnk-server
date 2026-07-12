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
 * Route-level auth boundary tests for CollabController. The controller moved
 * from a blanket `use('*', requireAuth)` to per-path mounting so the claim
 * route can serve anonymous callers — these tests pin the resulting matrix
 * (owner routes stay 401 without a token, claim does not) against the actual
 * Hono path-matching semantics rather than assumptions about them.
 */

import type { IAccessClaims } from '@termlnk-server/crypto';
import type { IClaimInviteParams } from '../services/collab.service';
import { Injector } from '@termlnk-server/core';
import { IJwtService } from '@termlnk-server/crypto';
import { createRouter, jsonError } from '@termlnk-server/rpc-server';
import { describe, expect, it, vi } from 'vitest';
import { ICollabService } from '../services/collab.service';
import { CollabController } from './collab.controller';

const VALID_JWT = 'valid-jwt';
const INVITE_ID = 'invite-12345678';

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
      return { sub: 'user-1', email: 'u@example.test', jti: 'jti-1' } as IAccessClaims;
    }),
    verifyRefresh: vi.fn(),
  };
}

function makeCollabService(): ICollabService & { claims: IClaimInviteParams[] } {
  const claims: IClaimInviteParams[] = [];
  return {
    claims,
    create: vi.fn(),
    revoke: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
    claim: vi.fn(async (params: IClaimInviteParams) => {
      claims.push(params);
      return {
        sessionId: 'session-1',
        ephPubB64: 'eph-pub',
        role: 'observer' as const,
        connectionId: 'conn-1',
        consumedAt: new Date().toISOString(),
      };
    }),
  };
}

function makeApp(collab: ICollabService): ReturnType<typeof createRouter> {
  const injector = new Injector([
    [ICollabService, { useValue: collab }],
    [IJwtService, { useValue: makeJwt() }],
    [CollabController],
  ]);
  const router = createRouter();
  router.onError((err, c) => jsonError(c, err));
  injector.get(CollabController).registerRoutes(router);
  return router;
}

function claimRequest(headers: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ capabilityHash: 'hash-12345678' }),
  };
}

describe('collabController route auth boundaries', () => {
  it('claim accepts anonymous callers and passes claimantUserId=null', async () => {
    const collab = makeCollabService();
    const res = await makeApp(collab).request(`/invite/${INVITE_ID}/claim`, claimRequest());
    expect(res.status).toBe(200);
    expect(collab.claims).toHaveLength(1);
    expect(collab.claims[0]!.claimantUserId).toBeNull();
  });

  it('claim forwards the JWT subject when a valid token is presented', async () => {
    const collab = makeCollabService();
    const res = await makeApp(collab).request(
      `/invite/${INVITE_ID}/claim`,
      claimRequest({ Authorization: `Bearer ${VALID_JWT}` })
    );
    expect(res.status).toBe(200);
    expect(collab.claims[0]!.claimantUserId).toBe('user-1');
  });

  it('claim rejects a bad token with 401 instead of downgrading to anonymous', async () => {
    const collab = makeCollabService();
    const res = await makeApp(collab).request(
      `/invite/${INVITE_ID}/claim`,
      claimRequest({ Authorization: 'Bearer garbage' })
    );
    expect(res.status).toBe(401);
    expect(collab.claims).toHaveLength(0);
  });

  it('create (POST /invite) still requires auth', async () => {
    const res = await makeApp(makeCollabService()).request('/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('list (GET /invite) still requires auth', async () => {
    const res = await makeApp(makeCollabService()).request('/invite');
    expect(res.status).toBe(401);
  });

  it('revoke still requires auth', async () => {
    const collab = makeCollabService();
    const res = await makeApp(collab).request(`/invite/${INVITE_ID}/revoke`, { method: 'POST' });
    expect(res.status).toBe(401);
    expect(collab.revoke).not.toHaveBeenCalled();
  });
});
