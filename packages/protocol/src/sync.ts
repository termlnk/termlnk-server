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
 * Sync wire format — mirror of the desktop client's @termlnk/sync-core HTTP transport.
 *
 * Sources of truth (do not drift):
 *   - termlnk/packages/sync-core/src/services/http-transport.service.ts (push / pull / poke)
 *   - termlnk/packages/sync/src/common/constants.ts (SYNC_RESOURCES)
 *   - termlnk/packages/sync/src/models/mutation.ts (ISyncMutation / ISyncPatchItem)
 *
 * Wire encoding rule: payload is `Uint8Array` on the client; transmitted as base64 string
 * (or null for deletes/clears). Server stores the raw bytes; never decrypts (zero-knowledge).
 */

import { z } from 'zod';

export const SYNC_RESOURCES = ['host', 'config', 'ai_provider', 'mcp_server', 'skill'] as const;
export const syncResourceIdSchema = z.enum(SYNC_RESOURCES);
export type SyncResourceId = (typeof SYNC_RESOURCES)[number];

const base64OrNull = z.union([z.string().min(0), z.null()]);

/* ───── push ───── */

export const syncMutationSchema = z.object({
  /** per-client monotonic id */
  id: z.number().int().nonnegative(),
  resource: syncResourceIdSchema,
  op: z.enum(['upsert', 'delete']),
  entityId: z.string().min(1),
  /** base64 of encrypted payload; null for delete */
  payload: base64OrNull,
  /** baseVersion at write time; null for first write */
  baseVersion: z.number().int().nonnegative().nullable(),
  /** ms epoch */
  createdAt: z.number().int().nonnegative(),
});
export type ISyncMutation = z.infer<typeof syncMutationSchema>;

export const pushRequestSchema = z.object({
  clientId: z.string().min(1),
  mutations: z.array(syncMutationSchema),
});
export type IPushRequest = z.infer<typeof pushRequestSchema>;

export const pushAcceptedDetailSchema = z.object({
  /** per-client monotonic id, echoes the mutation that produced this row */
  id: z.number().int().nonnegative(),
  resource: syncResourceIdSchema,
  entityId: z.string().min(1),
  /** server-assigned version after applying this mutation; clients write into sync_row_meta */
  version: z.number().int().nonnegative(),
});
export type IPushAcceptedDetail = z.infer<typeof pushAcceptedDetailSchema>;

export const pushResponseSchema = z.object({
  /**
   * Legacy field kept for old clients: ids of the mutations accepted in this batch.
   * New clients prefer `acceptedDetails` to learn the per-mutation server version and
   * update local sync_row_meta on ack — without it, meta is only refreshed when the
   * client later pulls its own echo, which can be skipped if the cursor has moved on.
   */
  accepted: z.array(z.number().int().nonnegative()),
  /**
   * Per-mutation acceptance detail with server-assigned version. Optional so the schema
   * stays back-compatible with clients on older protocol revs (they read only `accepted`).
   * Idempotent skips (`mutation.id <= lastMutationId`) are included with the current
   * persisted version so the client can still reconcile local meta on retry batches.
   */
  acceptedDetails: z.array(pushAcceptedDetailSchema).optional(),
  rejected: z.array(z.object({
    id: z.number().int().nonnegative(),
    reason: z.string(),
  })),
  /** server-side global version after this push (debug / monitoring) */
  lastServerVersion: z.number().int().nonnegative(),
});
export type IPushResponse = z.infer<typeof pushResponseSchema>;

/* ───── pull ───── */

export const pullRequestSchema = z.object({
  clientId: z.string().min(1),
  resource: syncResourceIdSchema,
  /** opaque cursor; null on first pull */
  cursor: z.string().nullable(),
});
export type IPullRequest = z.infer<typeof pullRequestSchema>;

export const syncPatchItemSchema = z.object({
  op: z.enum(['put', 'del', 'clear']),
  resource: syncResourceIdSchema,
  /** null for clear */
  entityId: z.string().nullable(),
  /** base64 ciphertext; null for del/clear */
  payload: base64OrNull,
  /** server-assigned monotonic version */
  version: z.number().int().nonnegative(),
});
export type ISyncPatchItem = z.infer<typeof syncPatchItemSchema>;

export const pullResponseSchema = z.object({
  cursor: z.string(),
  patch: z.array(syncPatchItemSchema),
  /** highest mutation id from this client that has been durably applied */
  lastMutationId: z.number().int().nonnegative(),
});
export type IPullResponse = z.infer<typeof pullResponseSchema>;

/* ───── poke (WebSocket) ───── */

export const pokeMessageSchema = z.object({
  type: z.literal('poke'),
  resource: syncResourceIdSchema,
  cursor: z.string(),
});
export type IPokeMessage = z.infer<typeof pokeMessageSchema>;

export const pingMessageSchema = z.object({
  type: z.literal('ping'),
});
export type IPingMessage = z.infer<typeof pingMessageSchema>;

export const pongMessageSchema = z.object({
  type: z.literal('pong'),
});
export type IPongMessage = z.infer<typeof pongMessageSchema>;
