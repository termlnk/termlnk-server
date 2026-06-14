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

import { createRoute, z } from '@hono/zod-openapi';

const tags = ['Admin Users'];

const errorJson = {
  content: { 'application/json': { schema: z.object({ code: z.string(), message: z.string().optional() }) } },
};

const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  emailVerified: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const userDetailSchema = userSchema.extend({
  hasEncryptionPassword: z.boolean(),
});

const deviceSchema = z.object({
  jti: z.string().uuid(),
  deviceName: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string(),
});

const oauthIdentitySchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  providerUserId: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
});

const userIdParam = z.object({
  id: z.string().uuid(),
});

const deviceRevokeParam = z.object({
  id: z.string().uuid(),
  jti: z.string().uuid(),
});

export const listUsers = createRoute({
  method: 'get',
  path: '/users',
  tags,
  summary: 'List users with pagination and search',
  security: [{ AdminBearer: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      q: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Paginated user list',
      content: {
        'application/json': {
          schema: z.object({
            users: z.array(userSchema),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
          }),
        },
      },
    },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const getUser = createRoute({
  method: 'get',
  path: '/users/{id}',
  tags,
  summary: 'Get user detail',
  security: [{ AdminBearer: [] }],
  request: { params: userIdParam },
  responses: {
    200: {
      description: 'User detail',
      content: { 'application/json': { schema: z.object({ user: userDetailSchema }) } },
    },
    401: { description: 'Unauthorized', ...errorJson },
    404: { description: 'User not found', ...errorJson },
  },
});

export const getUserDevices = createRoute({
  method: 'get',
  path: '/users/{id}/devices',
  tags,
  summary: 'List active devices for a user',
  security: [{ AdminBearer: [] }],
  request: { params: userIdParam },
  responses: {
    200: {
      description: 'Device list',
      content: { 'application/json': { schema: z.object({ devices: z.array(deviceSchema) }) } },
    },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const revokeDevice = createRoute({
  method: 'post',
  path: '/users/{id}/devices/{jti}/revoke',
  tags,
  summary: 'Revoke a specific device session',
  security: [{ AdminBearer: [] }],
  request: { params: deviceRevokeParam },
  responses: {
    204: { description: 'Revoked' },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const revokeAllDevices = createRoute({
  method: 'post',
  path: '/users/{id}/revoke-all',
  tags,
  summary: 'Revoke all device sessions for a user',
  security: [{ AdminBearer: [] }],
  request: { params: userIdParam },
  responses: {
    204: { description: 'All sessions revoked' },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const getUserOAuthIdentities = createRoute({
  method: 'get',
  path: '/users/{id}/oauth-identities',
  tags,
  summary: 'List OAuth identities linked to a user',
  security: [{ AdminBearer: [] }],
  request: { params: userIdParam },
  responses: {
    200: {
      description: 'OAuth identities',
      content: { 'application/json': { schema: z.object({ identities: z.array(oauthIdentitySchema) }) } },
    },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const getUserSyncStats = createRoute({
  method: 'get',
  path: '/users/{id}/sync-stats',
  tags,
  summary: 'Get sync data statistics for a user',
  security: [{ AdminBearer: [] }],
  request: { params: userIdParam },
  responses: {
    200: {
      description: 'User sync stats',
      content: {
        'application/json': {
          schema: z.object({
            perResource: z.array(z.object({ resource: z.string(), count: z.number() })),
            syncClients: z.array(z.object({ clientId: z.string(), lastSeenAt: z.string() })),
            totalSyncObjects: z.number(),
          }),
        },
      },
    },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const disableUser = createRoute({
  method: 'post',
  path: '/users/{id}/disable',
  tags,
  summary: 'Disable a user account and revoke all sessions',
  security: [{ AdminBearer: [] }],
  request: { params: userIdParam },
  responses: {
    204: { description: 'User disabled' },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const enableUser = createRoute({
  method: 'post',
  path: '/users/{id}/enable',
  tags,
  summary: 'Enable a previously disabled user account',
  security: [{ AdminBearer: [] }],
  request: { params: userIdParam },
  responses: {
    204: { description: 'User enabled' },
    401: { description: 'Unauthorized', ...errorJson },
  },
});
