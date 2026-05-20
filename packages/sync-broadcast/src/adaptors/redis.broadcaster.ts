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

import type { IPokeEnvelope, ISyncBroadcaster, PokeHandler } from '../services/sync-broadcaster.service';
import { Disposable } from '@termlnk-server/core';
import Redis from 'ioredis';

export interface IRedisBroadcasterOptions {
  /**
   * Either an existing `Redis` instance OR a redis:// URL. When passing a URL,
   * this adaptor will create a *new* connection (it must own its publisher to
   * issue `publish`, and a separate `.duplicate()` for each subscription
   * because ioredis can't interleave command-mode and subscribe-mode).
   */
  client?: Redis;
  url?: string;
}

function pokeChannel(userId: string): string {
  return `sync:poke:${userId}`;
}

/**
 * Node adaptor — Redis pub/sub fanout. One owned publisher connection plus one
 * `.duplicate()` per subscriber (ioredis pub/sub limitation).
 */
export class RedisSyncBroadcaster extends Disposable implements ISyncBroadcaster {
  private readonly _publisher: Redis;
  /** Subscribers created via `subscribe()`; closed on dispose. */
  private readonly _subscriptions = new Set<Redis>();
  private readonly _ownsPublisher: boolean;

  constructor(options: IRedisBroadcasterOptions) {
    super();
    if (options.client) {
      this._publisher = options.client;
      this._ownsPublisher = false;
    } else if (options.url) {
      this._publisher = new Redis(options.url, { lazyConnect: false });
      this._ownsPublisher = true;
    } else {
      throw new Error('[RedisSyncBroadcaster] either `client` or `url` is required');
    }
  }

  async publish<TResource extends string>(userId: string, envelope: IPokeEnvelope<TResource>): Promise<void> {
    await this._publisher.publish(pokeChannel(userId), JSON.stringify(envelope));
  }

  subscribe<TResource extends string>(userId: string, handler: PokeHandler<TResource>): () => void {
    const sub = this._publisher.duplicate();
    this._subscriptions.add(sub);
    void sub.subscribe(pokeChannel(userId)).catch(() => undefined);
    sub.on('message', (_channel, message) => {
      try {
        handler(JSON.parse(message) as IPokeEnvelope<TResource>);
      } catch {
        // ignore malformed
      }
    });
    return () => {
      this._subscriptions.delete(sub);
      void sub.unsubscribe(pokeChannel(userId)).catch(() => undefined);
      void sub.quit().catch(() => undefined);
    };
  }

  override dispose(): void {
    super.dispose();
    for (const sub of this._subscriptions) {
      void sub.quit().catch(() => undefined);
    }
    this._subscriptions.clear();
    if (this._ownsPublisher) {
      void this._publisher.quit().catch(() => undefined);
    }
  }
}
