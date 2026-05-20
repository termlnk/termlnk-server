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

/**
 * In-process broadcaster — single map of per-user listener sets. Use for:
 *   - Tests
 *   - Single-process self-host (no Redis dependency)
 *
 * Multi-replica deployments MUST use Redis or a Durable Object, otherwise pokes
 * stay confined to the instance that received the push.
 */
export class MemorySyncBroadcaster extends Disposable implements ISyncBroadcaster {
  private readonly _listeners = new Map<string, Set<PokeHandler<string>>>();

  async publish<TResource extends string>(userId: string, envelope: IPokeEnvelope<TResource>): Promise<void> {
    const set = this._listeners.get(userId);
    if (!set) {
      return;
    }
    for (const handler of set) {
      try {
        (handler as PokeHandler<TResource>)(envelope);
      } catch {
        // ignore handler failures — don't let one subscriber's bug block fanout
      }
    }
  }

  subscribe<TResource extends string>(userId: string, handler: PokeHandler<TResource>): () => void {
    let set = this._listeners.get(userId);
    if (!set) {
      set = new Set();
      this._listeners.set(userId, set);
    }
    set.add(handler as PokeHandler<string>);
    return () => {
      const s = this._listeners.get(userId);
      s?.delete(handler as PokeHandler<string>);
      if (s && s.size === 0) {
        this._listeners.delete(userId);
      }
    };
  }

  override dispose(): void {
    super.dispose();
    this._listeners.clear();
  }
}
