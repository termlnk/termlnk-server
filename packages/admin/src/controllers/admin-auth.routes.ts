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

const tags = ['Admin Auth'];

const errorJson = {
  content: { 'application/json': { schema: z.object({ code: z.string(), message: z.string().optional() }) } },
};

const adminAccountSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  lastLoginAt: z.string().optional(),
});

export const login = createRoute({
  method: 'post',
  path: '/auth/login',
  tags,
  summary: 'Admin login with email + password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            password: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: z.object({
            admin: adminAccountSchema,
            token: z.string(),
            expiresAt: z.number(),
          }),
        },
      },
    },
    401: { description: 'Invalid credentials', ...errorJson },
    403: { description: 'Account disabled', ...errorJson },
  },
});

export const me = createRoute({
  method: 'get',
  path: '/auth/me',
  tags,
  summary: 'Get current admin user',
  security: [{ AdminBearer: [] }],
  responses: {
    200: {
      description: 'Current admin',
      content: { 'application/json': { schema: z.object({ admin: adminAccountSchema }) } },
    },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const changePassword = createRoute({
  method: 'post',
  path: '/auth/change-password',
  tags,
  summary: 'Change current admin password',
  security: [{ AdminBearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            currentPassword: z.string().min(1),
            newPassword: z.string().min(8),
          }),
        },
      },
    },
  },
  responses: {
    204: { description: 'Password changed' },
    401: { description: 'Invalid current password', ...errorJson },
  },
});
