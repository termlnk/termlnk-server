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
import { announceMultiplayerSessionRequestSchema, errorResponseSchema, listMultiplayerSessionsResponseSchema } from '@termlnk-server/protocol';

const tags = ['Multiplayer'];

const errorJson = {
  content: { 'application/json': { schema: errorResponseSchema } },
};

const sessionIdParamsSchema = z.object({
  sessionId: z.string().min(1).max(256),
});

export const announce = createRoute({
  method: 'post',
  path: '/announce',
  tags,
  summary: 'Announce / heartbeat a same-account shared terminal session',
  description: 'Idempotent upsert — the device calls this when it starts sharing and re-calls every 30s to keep the row fresh. Server treats it as both insert and heartbeat.',
  security: [{ Bearer: [] }],
  request: {
    body: { content: { 'application/json': { schema: announceMultiplayerSessionRequestSchema } } },
  },
  responses: {
    204: { description: 'Announcement accepted' },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const retract = createRoute({
  method: 'delete',
  path: '/announce/{sessionId}',
  tags,
  summary: 'Stop announcing a previously announced session',
  description: 'Called by the device when it stops sharing. The server-side TTL sweep also drops stale rows after 90 s without an explicit retract.',
  security: [{ Bearer: [] }],
  request: { params: sessionIdParamsSchema },
  responses: {
    204: { description: 'Retracted (or already absent)' },
    400: { description: 'Invalid session id', ...errorJson },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const list = createRoute({
  method: 'get',
  path: '/sessions',
  tags,
  summary: 'List active same-account sessions announced by the user\'s other devices',
  description: 'Fresh-only — excludes rows whose last_heartbeat_at is older than the freshness window (default 90 s). Requesters can pass `?excludeDevice=<id>` to filter out their own device.',
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      excludeDevice: z.string().min(1).max(128).optional(),
    }),
  },
  responses: {
    200: { description: 'Active announcements', content: { 'application/json': { schema: listMultiplayerSessionsResponseSchema } } },
    401: { description: 'Unauthorized', ...errorJson },
  },
});
