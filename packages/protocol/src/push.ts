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

import { z } from 'zod';

// POST /v1/push/register
//
// Mobile clients call this on launch (and whenever the OS rotates the push token) to
// register their APNs / FCM / Expo Push token with the server. The same token registered
// from a different account replaces the existing row — push tokens are device-scoped,
// not user-scoped, so we cannot fan-out invites to a stale account once the user signs
// out and another account signs in on the same device.
//
// `platform` is an open string ('ios' / 'android' / 'web') rather than an enum to keep
// future targets (e.g. desktop tray notifications) additive without a major bump.
export const pushRegisterRequestSchema = z.object({
  deviceToken: z.string().min(1).max(2048),
  platform: z.enum(['ios', 'android', 'web']),
  // Optional fingerprint for diagnostics; server ignores it for routing.
  userAgent: z.string().max(512).optional(),
});

export type IPushRegisterRequest = z.infer<typeof pushRegisterRequestSchema>;

// Response is intentionally minimal — the device only needs to know it landed (200) or
// the token was rejected (4xx). Returning the userId would leak it to anyone holding the
// JWT, which would defeat the device-scoped routing guarantee.
export const pushRegisterResponseSchema = z.object({
  registered: z.literal(true),
});

export type IPushRegisterResponse = z.infer<typeof pushRegisterResponseSchema>;

// DELETE /v1/push/register
//
// Called on sign-out and when the OS reports the push token has been invalidated. The
// server removes the (userId, deviceToken) row; missing rows succeed silently to avoid
// 404 noise during retries.
export const pushUnregisterRequestSchema = z.object({
  deviceToken: z.string().min(1).max(2048),
});

export type IPushUnregisterRequest = z.infer<typeof pushUnregisterRequestSchema>;
