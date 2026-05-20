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
 * Collaboration invite wire format — mirror of the desktop client's
 * @termlnk/shared-terminal-core HTTP transport (P5.5.2).
 *
 * Sources of truth (do not drift):
 *   - termlnk/packages/shared-terminal-core/src/services/http-collab-invite-transport.service.ts
 *   - termlnk/packages/shared-terminal/src/services/collab-invite-transport.service.ts
 *   - termlnk/packages/shared-terminal/src/models/invite.ts (ICapability / IInviteTokenState)
 *
 * Zero-knowledge guarantee: the server only stores invite metadata + the ephemeral X25519
 * public key + a sha256 capability hash. The ephemeral private key lives in the owner's
 * URL fragment and NEVER reaches the server.
 */

import { z } from 'zod';

/** Cross-account collaboration roles (mirror of SharedTerminalRole). */
export const COLLAB_INVITE_ROLES = ['owner', 'co-pilot', 'observer', 'auditor'] as const;
export const collabInviteRoleSchema = z.enum(COLLAB_INVITE_ROLES);
export type CollabInviteRole = (typeof COLLAB_INVITE_ROLES)[number];

/** Lifecycle states (mirror of CollabInviteStatus). */
export const COLLAB_INVITE_STATUSES = ['active', 'consumed', 'revoked', 'expired'] as const;
export const collabInviteStatusSchema = z.enum(COLLAB_INVITE_STATUSES);
export type CollabInviteStatus = (typeof COLLAB_INVITE_STATUSES)[number];

/**
 * Capability claim — embedded in the URL fragment and persisted server-side as a hash
 * for opaque dedupe.
 */
export const collabCapabilitySchema = z.object({
  v: z.number().int().nonnegative(),
  sid: z.string().min(1).max(256),
  role: collabInviteRoleSchema,
  exp: z.number().int().nonnegative(),
  nonce: z.string().min(1).max(256),
});
export type ICollabCapability = z.infer<typeof collabCapabilitySchema>;

/* ───── POST /v1/collab/invite ───── */

export const createCollabInviteRequestSchema = z.object({
  /** base64url 24 bytes; client-generated; unique per user. */
  inviteId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, 'invite_id must be base64url'),
  sessionId: z.string().min(1).max(256),
  role: collabInviteRoleSchema,
  capability: collabCapabilitySchema,
  /** sha256(canonical(capability)) — base64url; opaque to server. */
  capabilityHash: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/, 'capability_hash must be base64url'),
  /** base64url X25519 public key — server stores so /claim can validate envelope (P5.5.3). */
  ephPubB64: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/, 'eph_pub must be base64url'),
  /** ms epoch — capability.exp mirrored for index efficiency. */
  exp: z.number().int().nonnegative(),
  singleUse: z.boolean(),
  /** Owner-supplied label (optional). */
  note: z.string().min(1).max(200).optional(),
});
export type ICreateCollabInviteRequest = z.infer<typeof createCollabInviteRequestSchema>;

/**
 * Server-side view of an invite. ISO timestamps for cross-language convenience (matches
 * the auth deviceSchema convention).
 */
export const collabInviteServerViewSchema = z.object({
  inviteId: z.string().min(1),
  sessionId: z.string().min(1),
  role: collabInviteRoleSchema,
  capabilityHash: z.string().min(1),
  exp: z.number().int().nonnegative(),
  singleUse: z.boolean(),
  status: collabInviteStatusSchema,
  createdAt: z.string(),
  consumedAt: z.string().optional(),
  revokedAt: z.string().optional(),
});
export type ICollabInviteServerView = z.infer<typeof collabInviteServerViewSchema>;

export const createCollabInviteResponseSchema = z.object({
  invite: collabInviteServerViewSchema,
});
export type ICreateCollabInviteResponse = z.infer<typeof createCollabInviteResponseSchema>;

/* ───── POST /v1/collab/invite/:inviteId/revoke ───── */
/* Empty body; the path parameter (invite_id) identifies the row. Server soft-transitions
 * status to 'revoked' and responds 204; clients refresh via `GET /invite` if they need
 * the post-revoke view. */

/* ───── GET /v1/collab/invite ───── */

export const listCollabInvitesResponseSchema = z.object({
  invites: z.array(collabInviteServerViewSchema),
});
export type IListCollabInvitesResponse = z.infer<typeof listCollabInvitesResponseSchema>;

/* ───── POST /v1/collab/invite/:inviteId/claim ─────
 *
 * Joiner-side endpoint. Receiver of the invite presents its own bearer token plus the
 * capability hash from the URL fragment; server validates the hash matches the stored
 * row, marks status='consumed' (single-use enforced atomically), and returns the public
 * metadata the joiner needs to connect to the relay. ephPriv NEVER hits this endpoint —
 * the joiner derives sharedKey locally from URL fragment + the server-published ephPub
 * (or the daemon-pub in capability), so server only authenticates lifecycle, never sees
 * key material.
 */
export const claimCollabInviteRequestSchema = z.object({
  /**
   * sha256(canonical(capability)) base64url. Must match the row the server stored when
   * the owner POSTed /invite. Mismatch ⇒ 400 invalid_capability_hash.
   */
  capabilityHash: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/),
  /** Joiner-supplied display name shown to the owner in participants$. */
  displayName: z.string().min(1).max(80).optional(),
});
export type IClaimCollabInviteRequest = z.infer<typeof claimCollabInviteRequestSchema>;

export const claimCollabInviteResponseSchema = z.object({
  /**
   * Owner-scoped session id (same as `capability.sid`). Joiner uses this to open the
   * relay socket via `?mode=client&sessionId=<sid>`.
   */
  sessionId: z.string().min(1),
  /** base64url X25519 ephemeral public key the owner published with the invite. */
  ephPubB64: z.string().min(8).max(128),
  role: collabInviteRoleSchema,
  /**
   * Server-assigned 16-byte base64url connection id. The joiner echoes this to the relay
   * (`?connectionId=<id>`) so the owner-side PtyMultiplexer can address frames back.
   */
  connectionId: z.string().min(8).max(64),
  /**
   * ISO timestamp the server marked the invite consumed — owner UI uses this as the
   * "consumed_at" label without doing its own clock guesses.
   */
  consumedAt: z.string(),
});
export type IClaimCollabInviteResponse = z.infer<typeof claimCollabInviteResponseSchema>;
