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

import { describe, expect, it } from 'vitest';
import {
  meResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
  srpInitRequestSchema,
  srpVerifyRequestSchema,
  srpVerifyResponseSchema,
} from './auth.js';

describe('auth schemas', () => {
  it('registerRequest accepts well-formed body', () => {
    const ok = registerRequestSchema.safeParse({
      email: 'a@b.co',
      argon2SaltB64: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
      srpSalt: 'deadbeef',
      srpVerifier: '0123abcd',
      displayName: 'Alice',
    });
    expect(ok.success).toBe(true);
  });

  it('registerRequest rejects non-hex srpSalt', () => {
    const bad = registerRequestSchema.safeParse({
      email: 'a@b.co',
      argon2SaltB64: 'YWFhYQ==',
      srpSalt: 'not-hex',
      srpVerifier: '0123',
    });
    expect(bad.success).toBe(false);
  });

  it('registerResponse requires user + token pair fields', () => {
    const ok = registerResponseSchema.safeParse({
      user: {
        id: 'u1',
        email: 'a@b.co',
        emailVerified: false,
        createdAt: '2026-05-09T00:00:00Z',
        updatedAt: '2026-05-09T00:00:00Z',
      },
      accessToken: 'at',
      refreshToken: 'rt',
      accessTokenExpiresAt: 1,
      refreshTokenExpiresAt: 2,
    });
    expect(ok.success).toBe(true);
  });

  it('srpInitRequest requires email', () => {
    expect(srpInitRequestSchema.safeParse({}).success).toBe(false);
    expect(srpInitRequestSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
  });

  it('srpVerifyRequest requires hex ephemeral and proof', () => {
    expect(srpVerifyRequestSchema.safeParse({
      email: 'a@b.co',
      clientPublicEphemeral: 'deadbeef',
      clientSessionProof: '0123',
    }).success).toBe(true);
  });

  it('srpVerifyResponse must include serverSessionProof and tokens', () => {
    const ok = srpVerifyResponseSchema.safeParse({
      serverSessionProof: 'cafebabe',
      user: {
        id: 'u1',
        email: 'a@b.co',
        emailVerified: false,
        createdAt: '2026-05-09T00:00:00Z',
        updatedAt: '2026-05-09T00:00:00Z',
      },
      accessToken: 'at',
      refreshToken: 'rt',
      accessTokenExpiresAt: 1,
      refreshTokenExpiresAt: 2,
    });
    expect(ok.success).toBe(true);
  });

  it('meResponse requires a user object', () => {
    const ok = meResponseSchema.safeParse({
      user: {
        id: 'u1',
        email: 'a@b.co',
        emailVerified: true,
        createdAt: '2026-05-09T00:00:00Z',
        updatedAt: '2026-05-09T00:00:00Z',
      },
      e2e: { configured: false },
    });
    expect(ok.success).toBe(true);
    expect(meResponseSchema.safeParse({}).success).toBe(false);
  });

  it('refresh round-trips', () => {
    expect(refreshRequestSchema.safeParse({ refreshToken: 'r' }).success).toBe(true);
    expect(refreshResponseSchema.safeParse({
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresAt: 1,
      refreshTokenExpiresAt: 2,
    }).success).toBe(true);
  });
});
