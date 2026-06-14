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

const tags = ['Admin Stats'];

export const overview = createRoute({
  method: 'get',
  path: '/stats/overview',
  tags,
  summary: 'Dashboard statistics overview',
  security: [{ AdminBearer: [] }],
  responses: {
    200: {
      description: 'Stats overview',
      content: {
        'application/json': {
          schema: z.object({
            totalUsers: z.number(),
            activeUsers30d: z.number(),
            newUsers7d: z.number(),
            totalDevices: z.number(),
            totalOAuthIdentities: z.number(),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
});

export const syncStats = createRoute({
  method: 'get',
  path: '/stats/sync',
  tags,
  summary: 'Sync data statistics',
  security: [{ AdminBearer: [] }],
  responses: {
    200: {
      description: 'Sync stats',
      content: {
        'application/json': {
          schema: z.object({
            totalSyncObjects: z.number(),
            totalSyncClients: z.number(),
            perResource: z.array(z.object({
              resource: z.string(),
              count: z.number(),
            })),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
});
