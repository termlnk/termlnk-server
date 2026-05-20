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
  pullRequestSchema,
  pullResponseSchema,
  pushRequestSchema,
  pushResponseSchema,
} from '@termlnk-server/protocol';

const tags = ['Sync'];

const errorJson = {
  content: { 'application/json': { schema: errorResponseSchema } },
};

export const push = createRoute({
  method: 'post',
  path: '/push',
  tags,
  summary: 'Submit a batch of mutations; receive accept/reject verdicts',
  security: [{ Bearer: [] }],
  request: {
    body: { content: { 'application/json': { schema: pushRequestSchema } } },
  },
  responses: {
    200: { description: 'Verdicts + new server version', content: { 'application/json': { schema: pushResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const pull = createRoute({
  method: 'post',
  path: '/pull',
  tags,
  summary: 'Pull patches for a resource since the given cursor',
  security: [{ Bearer: [] }],
  request: {
    body: { content: { 'application/json': { schema: pullRequestSchema } } },
  },
  responses: {
    200: { description: 'Patch list + new cursor', content: { 'application/json': { schema: pullResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Unauthorized', ...errorJson },
  },
});
