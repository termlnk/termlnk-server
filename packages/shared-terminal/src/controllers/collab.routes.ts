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
import {
  claimCollabInviteRequestSchema,
  claimCollabInviteResponseSchema,
  createCollabInviteRequestSchema,
  createCollabInviteResponseSchema,
  errorResponseSchema,
  listCollabInvitesResponseSchema,
} from '@termlnk-server/protocol';

const tags = ['Collab'];

const errorJson = {
  content: { 'application/json': { schema: errorResponseSchema } },
};

const inviteIdParamsSchema = z.object({
  inviteId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

/**
 * OpenAPI "optional security" idiom: the empty object entry means "no auth is
 * also acceptable". Hoisted with an explicit annotation because inlining the
 * literal into createRoute() degrades the whole route's type inference
 * (request/response payloads collapse to never). The optionalAuth middleware
 * remains the runtime source of truth.
 */
const optionalBearerSecurity: Record<string, string[]>[] = [{ Bearer: [] }, {}];

export const create = createRoute({
  method: 'post',
  path: '/invite',
  tags,
  summary: 'Persist a collaboration invite (capability metadata only)',
  security: [{ Bearer: [] }],
  request: { body: { content: { 'application/json': { schema: createCollabInviteRequestSchema } } } },
  responses: {
    200: { description: 'Invite stored', content: { 'application/json': { schema: createCollabInviteResponseSchema } } },
    400: { description: 'Invalid request', ...errorJson },
    401: { description: 'Unauthorized', ...errorJson },
    409: { description: 'Invite id already exists for this user', ...errorJson },
  },
});

export const revoke = createRoute({
  method: 'post',
  path: '/invite/{inviteId}/revoke',
  tags,
  summary: 'Revoke an active invite',
  security: [{ Bearer: [] }],
  request: { params: inviteIdParamsSchema },
  responses: {
    204: { description: 'Revoked' },
    400: { description: 'Invalid invite id', ...errorJson },
    401: { description: 'Unauthorized', ...errorJson },
    404: { description: 'Invite not found', ...errorJson },
  },
});

export const list = createRoute({
  method: 'get',
  path: '/invite',
  tags,
  summary: 'List the authenticated user\'s invites (every status)',
  security: [{ Bearer: [] }],
  responses: {
    200: { description: 'Invites', content: { 'application/json': { schema: listCollabInvitesResponseSchema } } },
    401: { description: 'Unauthorized', ...errorJson },
  },
});

export const claim = createRoute({
  method: 'post',
  path: '/invite/{inviteId}/claim',
  tags,
  summary: 'Receiver-side claim: validate capability + atomically consume the invite',
  description: 'Called by the invited device (not the owner). Server checks capability hash + atomically transitions status to consumed, returning the connection metadata needed to attach to the shared-terminal relay. Auth is OPTIONAL: anonymous callers are admitted on invite possession alone and receive an ephemeral anon- identity inside the relay-claim token.',
  security: optionalBearerSecurity,
  request: {
    params: inviteIdParamsSchema,
    body: { content: { 'application/json': { schema: claimCollabInviteRequestSchema } } },
  },
  responses: {
    200: { description: 'Claim accepted', content: { 'application/json': { schema: claimCollabInviteResponseSchema } } },
    400: { description: 'Invalid request / capability hash mismatch', ...errorJson },
    401: { description: 'Authorization header present but invalid', ...errorJson },
    404: { description: 'Invite not found', ...errorJson },
    410: { description: 'Invite expired or already consumed/revoked', ...errorJson },
    503: { description: 'Anonymous join unavailable (relay-claim token secret not configured)', ...errorJson },
  },
});
