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
 * Multiplayer wire format — same-account device announcement + WebRTC signalling.
 *
 * Two surfaces:
 *   1. Announce/sessions (REST): same-account device discovery. A device POSTs an
 *      announcement when it starts sharing a terminal; siblings GET the list to
 *      render one-click join entries. Heartbeated; the server expires stale rows.
 *   2. Signal (WS): SDP / ICE candidate forwarding for the WebRTC composite
 *      transport. Server is a dumb pipe — opaque base64 envelope, no inspection.
 *
 * Mirror of the desktop client's DevicePairingService + WebRTCTransportService
 * (M5 / M7). The relay endpoint stays the existing /v1/shared-terminal/.
 */

import { z } from 'zod';

/* ───── REST: announce / sessions / retract ───── */

export const announceMultiplayerSessionRequestSchema = z.object({
  /** Stable identifier of the announcing device (same id used by AuthCorePlugin). */
  deviceId: z.string().min(1).max(128),
  /** Session id within the announcing device — matches the relay sessionId. */
  sessionId: z.string().min(1).max(256),
  /** Friendly label for the joiner's UI. */
  title: z.string().min(1).max(160),
  cols: z.number().int().min(1).max(10_000),
  rows: z.number().int().min(1).max(10_000),
  /** Monotonic per-device ms clock — orders concurrent announcements deterministically. */
  deviceClock: z.number().int().nonnegative(),
});
export type IAnnounceMultiplayerSessionRequest = z.infer<typeof announceMultiplayerSessionRequestSchema>;

export const remoteAnnouncedSessionSchema = z.object({
  sessionId: z.string().min(1),
  deviceId: z.string().min(1),
  /** Best-effort device label; the announcer chooses (e.g. macOS hostname). */
  deviceName: z.string().min(1),
  title: z.string().min(1),
  cols: z.number().int(),
  rows: z.number().int(),
  /** ms epoch when the row was first announced (server-side timestamp). */
  announcedAt: z.number().int(),
});
export type IRemoteAnnouncedSession = z.infer<typeof remoteAnnouncedSessionSchema>;

export const listMultiplayerSessionsResponseSchema = z.object({
  sessions: z.array(remoteAnnouncedSessionSchema),
});
export type IListMultiplayerSessionsResponse = z.infer<typeof listMultiplayerSessionsResponseSchema>;

/* ───── WS: signaling ─────
 *
 * Envelope routed by (sessionId, peerId). Client connects:
 *   wss://<host>/v1/multiplayer/signal?sessionId=<sid>&peerId=<pid>
 *
 * peerId is per-device random 16 bytes base64url; each side learns the other's
 * peerId via the first envelope and addresses subsequent envelopes accordingly.
 */

export const signalEnvelopeTypes = ['hello', 'offer', 'answer', 'ice', 'bye'] as const;
export const signalEnvelopeTypeSchema = z.enum(signalEnvelopeTypes);
export type SignalEnvelopeType = (typeof signalEnvelopeTypes)[number];

export const signalEnvelopeSchema = z.object({
  type: signalEnvelopeTypeSchema,
  /** Sender peerId; server fills this server-side from the WS upgrade query. */
  from: z.string().min(8).max(64),
  /** Target peerId; if omitted server broadcasts to all peers on the session. */
  to: z.string().min(8).max(64).optional(),
  /**
   * Opaque base64url payload — server never decodes. For 'offer' / 'answer' this is the
   * SDP string; for 'ice' it's the candidate; for 'hello' / 'bye' it can be empty.
   */
  payload: z.string().max(64 * 1024).optional(),
});
export type ISignalEnvelope = z.infer<typeof signalEnvelopeSchema>;
