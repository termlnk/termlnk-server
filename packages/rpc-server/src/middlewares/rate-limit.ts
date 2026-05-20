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
 * 20 requests / minute on the entire /v1/auth/* surface — enough for normal
 * login but enough friction to slow brute-force enumeration of SRP responses.
 */
export const authRateLimit = createRateLimiter({ windowMs: 60_000, limit: 20 });
