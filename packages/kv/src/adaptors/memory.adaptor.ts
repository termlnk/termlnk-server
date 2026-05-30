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

import type { IKVSetOptions, IKVStore } from '../services/kv-store.service';
import { Disposable } from '@termlnk-server/core';

interface IEntry {
  value: string;
  /** ms epoch — Infinity for non-expiring keys */
  expiresAt: number;
}

/**
 * Process-local KV. For tests and small single-process self-host deployments
 * where running Redis is overkill.
 *
 * Caveats:
 *   - State lives in the JS heap; restart drops everything.
 *   - Not safe across processes / replicas — a multi-instance deploy MUST use
 *     Ioredis or Upstash to avoid divergent SRP state.
 *   - TTL is enforced lazily on read, so the heap can hold expired entries
 *     until something touches them. Negligible for the sub-MB working sets
 *     this is intended for.
 */
export class MemoryKVStore extends Disposable implements IKVStore {
  private readonly _store = new Map<string, IEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this._store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, options?: IKVSetOptions): Promise<void> {
    const expiresAt = options?.ttlSeconds && options.ttlSeconds > 0
      ? Date.now() + options.ttlSeconds * 1000
      : Number.POSITIVE_INFINITY;
    this._store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<number> {
    return this._store.delete(key) ? 1 : 0;
  }

  async getdel(key: string): Promise<string | null> {
    // Single-threaded event loop: read + delete is atomic with respect to other
    // awaiting callers, matching Redis GETDEL one-shot semantics.
    const value = await this.get(key);
    if (value !== null) {
      this._store.delete(key);
    }
    return value;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async incr(key: string, options?: IKVSetOptions): Promise<number> {
    const current = await this.get(key);
    const next = current === null ? 1 : Number.parseInt(current, 10) + 1;
    const isNew = current === null;
    await this.set(
      key,
      String(next),
      isNew && options?.ttlSeconds ? { ttlSeconds: options.ttlSeconds } : undefined
    );
    return next;
  }

  override dispose(): void {
    super.dispose();
    this._store.clear();
  }
}
