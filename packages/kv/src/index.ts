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
 * @termlnk-server/kv — TTL-aware key-value abstraction.
 *
 * Adaptors live behind subpath imports so the root entry stays driver-free:
 *   import { IoredisKVStore } from '@termlnk-server/kv/ioredis';   // production
 *   import { MemoryKVStore }  from '@termlnk-server/kv/memory';    // tests / single-process
 */

export type { IKVSetOptions } from './services/kv-store.service';
export { IKVStore } from './services/kv-store.service';
