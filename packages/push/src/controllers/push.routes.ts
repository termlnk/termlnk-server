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

import { createRoute } from '@hono/zod-openapi';
import {
  errorResponseSchema,
  pushRegisterRequestSchema,
  pushRegisterResponseSchema,
  pushUnregisterRequestSchema,
} from '@termlnk-server/protocol';

const tags = ['Push'];

const errorJson = {
  content: { 'application/json': { schema: errorResponseSchema } },
};

export const register = createRoute({
  method: 'post',
  path: '/register',
  tags,
  summary: 'Register a mobile push token (Expo / APNs / FCM)',
  security: [{ Bearer: [] }],
  request: { body: { content: { 'application/json': { schema: pushRegisterRequestSchema } } } },
  responses: {
    200: { description: 'Registered', content: { 'application/json': { schema: pushRegisterResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const unregister = createRoute({
  method: 'delete',
  path: '/register',
  tags,
  summary: 'Unregister a previously-registered push token',
  security: [{ Bearer: [] }],
  request: { body: { content: { 'application/json': { schema: pushUnregisterRequestSchema } } } },
  responses: {
    204: { description: 'Unregistered (or missing — succeeds silently)' },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Unauthorized', ...errorJson },
  },
});
