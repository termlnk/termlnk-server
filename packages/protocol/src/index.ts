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
 * @termlnk-server/protocol — single source of truth for cloud wire format.
 *
 * Compatibility rule (cloud-sync-architecture.md §2.3, paseo CLAUDE.md):
 *   - new fields MUST be `.optional()`
 *   - never delete fields
 *   - never narrow types
 * Both desktop client and server depend on this package; bumping the major version
 * means breaking the wire — needs coordinated rollout.
 */

export * from './auth.js';
export * from './collab.js';
export * from './multiplayer.js';
export * from './push.js';
export * from './sync.js';
export const PROTOCOL_VERSION = 1;
