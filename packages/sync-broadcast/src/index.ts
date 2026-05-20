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
 * @termlnk-server/sync-broadcast — ISyncBroadcaster + two adaptors.
 *
 * Adaptors are subpath imports so consumers only pay for the driver they need:
 *   import { RedisSyncBroadcaster }  from '@termlnk-server/sync-broadcast/redis';   // multi-replica
 *   import { MemorySyncBroadcaster } from '@termlnk-server/sync-broadcast/memory';  // tests / single-process
 */

export type { IPokeEnvelope, PokeHandler } from './services/sync-broadcaster.service';
export { ISyncBroadcaster } from './services/sync-broadcaster.service';
