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

import { createIdentifier } from '@termlnk-server/core';

export interface IKVSetOptions {
  /** Time-to-live in seconds. Omit for a permanent key. */
  ttlSeconds?: number;
}

/**
 * Key-value store with TTL. Three known consumers on the server:
 *   - SRP pending session (5 min TTL) — see @termlnk-server/auth
 *   - HTTP rate limiter counters — see rpc-server
 *   - Anywhere else short-lived state needs to survive cross-instance
 *
 * The contract intentionally avoids streaming / pub-sub / sorted-set primitives.
 * Sync fanout sits behind its own abstraction (`@termlnk-server/sync-broadcast`)
 * which uses Redis pub/sub.
 */
export interface IKVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: IKVSetOptions): Promise<void>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  /** Atomic increment. If `ttlSeconds` is set AND the key is new, applies the TTL. */
  incr(key: string, options?: IKVSetOptions): Promise<number>;
}

export const IKVStore = createIdentifier<IKVStore>('kv.store');
