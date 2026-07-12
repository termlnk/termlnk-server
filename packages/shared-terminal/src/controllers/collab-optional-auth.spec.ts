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
 * Behavior tests for the optionalAuth middleware live here (its consumer)
 * because @termlnk-server/rpc-server has no vitest harness of its own. The
 * contract under test is exactly what the anonymous collab claim relies on:
 * no header → pass through unauthenticated, valid header → claims set,
 * bad header → 401 (never a silent downgrade to anonymous).
 */

import type { IAccessClaims, IJwtService } from '@termlnk-server/crypto';
import { createRouter, jsonError, optionalAuth } from '@termlnk-server/rpc-server';
import { describe, expect, it, vi } from 'vitest';

const VALID_JWT = 'valid-jwt';

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

function makeApp(): ReturnType<typeof createRouter> {
  const app = createRouter();
  app.onError((err, c) => jsonError(c, err));
  app.use('/probe', optionalAuth(makeJwt()));
  app.get('/probe', (c) => c.json({ userId: c.get('userId') ?? null }));
  return app;
}

describe('optionalAuth', () => {
  it('passes through without an Authorization header, leaving userId unset', async () => {
    const res = await makeApp().request('/probe');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: null });
  });

  it('sets the claims for a valid Bearer token', async () => {
    const res = await makeApp().request('/probe', {
      headers: { Authorization: `Bearer ${VALID_JWT}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user-1' });
  });

  it('rejects a bad Bearer token with 401 instead of downgrading to anonymous', async () => {
    const res = await makeApp().request('/probe', {
      headers: { Authorization: 'Bearer garbage' },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  it('ignores non-Bearer Authorization schemes (passes through unauthenticated)', async () => {
    const res = await makeApp().request('/probe', {
      headers: { Authorization: 'Basic dXNlcjpwdw==' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: null });
  });
});
