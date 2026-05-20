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

/**
 * One poke event published to a single user's WebSocket fanout.
 *
 * `originClientId` lets subscribers skip echoes — the client that just pushed
 * doesn't need its own poke to come back over WS, it already advanced its cursor
 * locally via the push response.
 */
export interface IPokeEnvelope<TResource extends string = string> {
  resource: TResource;
  /** opaque cursor — stringified bigint of the per-user global version after this write */
  cursor: string;
  originClientId: string;
}

export type PokeHandler<TResource extends string = string> = (env: IPokeEnvelope<TResource>) => void;

/**
 * Cross-instance fanout for sync pokes.
 *
 *   - Multiple server replicas share state via Redis pub/sub: a write on
 *     instance A publishes to a channel; instance B forwards to its WS clients.
 *   - Single-process self-host (and tests) skip Redis and use the in-process
 *     EventEmitter adaptor.
 */
export interface ISyncBroadcaster {
  publish<TResource extends string>(userId: string, envelope: IPokeEnvelope<TResource>): Promise<void>;
  /** Returns an unsubscribe function. */
  subscribe<TResource extends string>(userId: string, handler: PokeHandler<TResource>): () => void;
}

export const ISyncBroadcaster = createIdentifier<ISyncBroadcaster>('sync.broadcaster');
