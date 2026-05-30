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

import type { RedisOptions } from 'ioredis';
import type { IKVSetOptions, IKVStore } from '../services/kv-store.service';
import { Disposable } from '@termlnk-server/core';
import Redis from 'ioredis';

export interface IIoredisKVOptions {
  /** Either a redis:// URL or an explicit ioredis options object. */
  url?: string;
  redisOptions?: RedisOptions;
}

/**
 * Node adaptor — ioredis-backed KV. Wraps a single connection; commands and
 * subscriptions are exclusive on ioredis, so this client must NOT be reused as a
 * pub/sub subscriber. Sync fanout owns its own connections via the sync-broadcast
 * adaptor.
 */
export class IoredisKVStore extends Disposable implements IKVStore {
  private readonly _client: Redis;

  constructor(options: IIoredisKVOptions) {
    super();
    this._client = options.url
      ? new Redis(options.url, { lazyConnect: false })
      : new Redis({ lazyConnect: false, ...options.redisOptions });
  }

  /** Expose the underlying client for callers that need raw pub/sub or pipelines. */
  get client(): Redis {
    return this._client;
  }

  async get(key: string): Promise<string | null> {
    return this._client.get(key);
  }

  async set(key: string, value: string, options?: IKVSetOptions): Promise<void> {
    if (options?.ttlSeconds && options.ttlSeconds > 0) {
      await this._client.set(key, value, 'EX', options.ttlSeconds);
    } else {
      await this._client.set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    return this._client.del(key);
  }

  async getdel(key: string): Promise<string | null> {
    // GETDEL is atomic server-side (Redis >= 6.2).
    return this._client.getdel(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this._client.exists(key)) === 1;
  }

  async incr(key: string, options?: IKVSetOptions): Promise<number> {
    const value = await this._client.incr(key);
    // Apply TTL only on first increment (= when value is 1) — race-tolerant: a
    // second incrementer might see 1 too if interleaved, but the EXPIRE is
    // idempotent so this is safe.
    if (value === 1 && options?.ttlSeconds && options.ttlSeconds > 0) {
      await this._client.expire(key, options.ttlSeconds);
    }
    return value;
  }

  override dispose(): void {
    super.dispose();
    void this._client.quit().catch(() => undefined);
  }
}
