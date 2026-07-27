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

import type { Context, MiddlewareHandler } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { HttpError } from '../utils/http-error';

function keyByForwardedFor(c: Context): string {
  return c.req.header('x-forwarded-for')
    ?? c.req.header('x-real-ip')
    ?? 'anonymous';
}

export interface IRateLimitOptions {
  windowMs: number;
  limit: number;
}

/**
 * In-process rate limiter (memory store) — a floor on burst credential guessing
 * even on a bare Node instance. Multi-replica deployments should swap this for a
 * Redis-backed store (the library supports custom stores via the `store` option;
 * see hono-rate-limiter docs).
 */
export function createRateLimiter({ windowMs, limit }: IRateLimitOptions): MiddlewareHandler {
  return rateLimiter({
    windowMs,
    limit,
    standardHeaders: 'draft-6',
    keyGenerator: keyByForwardedFor,
    handler: () => {
      throw new HttpError(429, 'too_many_requests', 'rate limit exceeded — retry after the window resets');
    },
  });
}

/**
 * Rate-limit policy for the whole `/v1/auth/*` surface, keyed on the caller's IP.
 *
 * Credential endpoints share a tight bucket — 20 requests / minute is plenty for a human
 * signing in and enough friction to slow brute-force enumeration of SRP responses.
 *
 * Token renewal gets its own, much larger bucket. It is machine-driven rather than
 * user-driven: every signed-in device refreshes once per access-token lifetime, and
 * several devices legitimately share one public IP (NAT, office, household). Bucketing it
 * with credential attempts let a busy egress IP answer `/auth/refresh` with 429, which a
 * client cannot tell apart from a revoked token — ending an otherwise valid 30-day session.
 */
export function createAuthSurfaceRateLimit(routePrefix: string): MiddlewareHandler {
  const credentials = createRateLimiter({ windowMs: 60_000, limit: 20 });
  const refresh = createRateLimiter({ windowMs: 60_000, limit: 120 });
  const refreshPath = `${routePrefix.replace(/\/+$/, '')}/refresh`;

  return async (c, next) => {
    if (c.req.path === refreshPath) {
      return refresh(c, next);
    }
    return credentials(c, next);
  };
}
