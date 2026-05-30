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
 * /v1/auth/* OpenAPI route definitions.
 *
 * Authoritative request/response shapes live in @termlnk-server/protocol. We do NOT
 * mutate those schemas with `.openapi()` extensions inside this file — the
 * desktop client imports them too and shipping openapi-extra metadata
 * downstream is wasteful. OpenAPI metadata (description, tags, security) lives
 * at the `createRoute(...)` level here.
 */

import { createRoute, z } from '@hono/zod-openapi';
import { authCapabilitiesResponseSchema, deviceListResponseSchema, e2eSetupRequestSchema, e2eSetupResponseSchema, errorResponseSchema, googleClaimRequestSchema, googleClaimResponseSchema, meResponseSchema, refreshRequestSchema, refreshResponseSchema, registerRequestSchema, registerResponseSchema, srpInitRequestSchema, srpInitResponseSchema, srpVerifyRequestSchema, srpVerifyResponseSchema } from '@termlnk-server/protocol';

const tags = ['Auth'];

const deviceIdParamsSchema = z.object({
  id: z.string().uuid().describe('refresh-token jti — the device id surfaced by GET /devices'),
});

const errorJson = {
  content: { 'application/json': { schema: errorResponseSchema } },
};

export const register = createRoute({
  method: 'post',
  path: '/register',
  tags,
  summary: 'Create a new account',
  request: { body: { content: { 'application/json': { schema: registerRequestSchema } } } },
  responses: {
    200: { description: 'Account created; tokens issued', content: { 'application/json': { schema: registerResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
    403: { description: 'Open registration disabled', ...errorJson },
    409: { description: 'Email already registered', ...errorJson },
  },
});

export const srpInit = createRoute({
  method: 'post',
  path: '/srp/init',
  tags,
  summary: 'Start SRP6a authentication — server returns salt + ephemeral B',
  request: { body: { content: { 'application/json': { schema: srpInitRequestSchema } } } },
  responses: {
    200: { description: 'SRP challenge', content: { 'application/json': { schema: srpInitResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
  },
});

export const srpVerify = createRoute({
  method: 'post',
  path: '/srp/verify',
  tags,
  summary: 'Finish SRP6a authentication — client proof in, tokens out',
  request: { body: { content: { 'application/json': { schema: srpVerifyRequestSchema } } } },
  responses: {
    200: { description: 'Logged in; tokens issued', content: { 'application/json': { schema: srpVerifyResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Wrong password / unknown account / pending challenge expired', ...errorJson },
    403: { description: 'Email verification required', ...errorJson },
  },
});

export const refresh = createRoute({
  method: 'post',
  path: '/refresh',
  tags,
  summary: 'Rotate refresh token; returns a new (access, refresh) pair',
  request: { body: { content: { 'application/json': { schema: refreshRequestSchema } } } },
  responses: {
    200: { description: 'Rotated', content: { 'application/json': { schema: refreshResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Refresh token invalid / expired / replayed', ...errorJson },
  },
});

export const me = createRoute({
  method: 'get',
  path: '/me',
  tags,
  summary: 'Self-lookup of the authenticated user',
  security: [{ Bearer: [] }],
  responses: {
    200: { description: 'Canonical user record', content: { 'application/json': { schema: meResponseSchema } } },
    401: { description: 'Unauthorized — token invalid OR account deleted', ...errorJson },
  },
});

export const devices = createRoute({
  method: 'get',
  path: '/devices',
  tags,
  summary: 'List active refresh tokens (one per signed-in device)',
  security: [{ Bearer: [] }],
  responses: {
    200: { description: 'Devices', content: { 'application/json': { schema: deviceListResponseSchema } } },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const revokeDevice = createRoute({
  method: 'post',
  path: '/devices/{id}/revoke',
  tags,
  summary: 'Revoke a specific device (refresh token jti)',
  security: [{ Bearer: [] }],
  request: { params: deviceIdParamsSchema },
  responses: {
    204: { description: 'Revoked (or already revoked / nonexistent)' },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const logout = createRoute({
  method: 'post',
  path: '/logout',
  tags,
  summary: 'Revoke every refresh token for the authenticated user',
  security: [{ Bearer: [] }],
  responses: {
    204: { description: 'All sessions revoked' },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const capabilities = createRoute({
  method: 'get',
  path: '/capabilities',
  tags,
  summary: 'Advertise which optional sign-in methods this deployment has enabled',
  responses: {
    200: { description: 'Capabilities', content: { 'application/json': { schema: authCapabilitiesResponseSchema } } },
  },
});

/* ───── Google OAuth (identity) ─────
 * GET /google/start and GET /google/callback are browser-navigation endpoints
 * (302 redirects) registered as plain Hono routes in the controller, not here.
 * Only the JSON claim below is an OpenAPI route. */

export const googleClaim = createRoute({
  method: 'post',
  path: '/google/claim',
  tags,
  summary: 'Exchange the one-time relay code (from the deep link) for a token bundle',
  request: { body: { content: { 'application/json': { schema: googleClaimRequestSchema } } } },
  responses: {
    200: { description: 'Logged in; tokens + e2e status', content: { 'application/json': { schema: googleClaimResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Relay code invalid / expired / replayed', ...errorJson },
  },
});

/* ───── E2E encryption password (enrolls an SRP credential) ───── */

export const e2eSetup = createRoute({
  method: 'post',
  path: '/e2e/setup',
  tags,
  summary: 'Set the encryption password (first time) — enrolls it as an SRP credential',
  security: [{ Bearer: [] }],
  request: { body: { content: { 'application/json': { schema: e2eSetupRequestSchema } } } },
  responses: {
    200: { description: 'Stored; returns the new e2e status', content: { 'application/json': { schema: e2eSetupResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Unauthorized', ...errorJson },
    409: { description: 'A password is already set (unlock with it instead)', ...errorJson },
  },
});
