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
 * Runtime configuration — Zod-validated.
 *
 * `loadEnv(source)` takes a plain dictionary (defaulting to `process.env`) and
 * returns a fully-typed `IRuntimeConfig` or throws with precise field-level
 * errors. The entrypoint loads the `.env` file before calling this.
 */

import { z } from 'zod';

const booleanLike = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const secret = z
  .string()
  .min(32, 'must be at least 32 characters of entropy')
  .refine((v) => !v.includes('changeme'), 'placeholder secrets are not allowed');

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default('postgres://termlnk:termlnk@localhost:5432/termlnk_server'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_ACCESS_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(30 * 24 * 60 * 60),
  /**
   * Relay claim token TTL. The token is one-shot, short-lived, and signed
   * with JWT_ACCESS_SECRET (HMAC over a custom envelope shape that can't
   * collide with JWT verification). A separate secret would not increase
   * security: if JWT_ACCESS_SECRET leaks the attacker can already forge any
   * user's access token and join any session directly.
   */
  RELAY_CLAIM_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(5 * 60),
  ALLOW_OPEN_REGISTRATION: booleanLike.default(true),
  REQUIRE_EMAIL_VERIFICATION: booleanLike.default(false),
  CORS_ORIGINS: z
    .string()
    .default('*')
    .transform((v) => (v === '*' ? ['*'] : v.split(',').map((s) => s.trim()).filter(Boolean))),
});

export interface IRuntimeConfig {
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly host: string;
  readonly port: number;
  readonly jwtAccessSecret: string;
  readonly jwtRefreshSecret: string;
  readonly jwtAccessTtlSeconds: number;
  readonly jwtRefreshTtlSeconds: number;
  readonly relayClaimTokenTtlSeconds: number;
  readonly allowOpenRegistration: boolean;
  readonly requireEmailVerification: boolean;
  readonly corsOrigins: readonly string[];
}

export function loadEnv(source: Record<string, string | undefined> = process.env): IRuntimeConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`[env] invalid runtime configuration:\n${issues}`);
  }
  const v = parsed.data;
  return {
    databaseUrl: v.DATABASE_URL,
    redisUrl: v.REDIS_URL,
    host: v.HOST,
    port: v.PORT,
    jwtAccessSecret: v.JWT_ACCESS_SECRET,
    jwtRefreshSecret: v.JWT_REFRESH_SECRET,
    jwtAccessTtlSeconds: v.JWT_ACCESS_TTL_SECONDS,
    jwtRefreshTtlSeconds: v.JWT_REFRESH_TTL_SECONDS,
    relayClaimTokenTtlSeconds: v.RELAY_CLAIM_TOKEN_TTL_SECONDS,
    allowOpenRegistration: v.ALLOW_OPEN_REGISTRATION,
    requireEmailVerification: v.REQUIRE_EMAIL_VERIFICATION,
    corsOrigins: v.CORS_ORIGINS,
  };
}
