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

import type { ILogService } from '@termlnk-server/core';
import type { ISignalEnvelope } from '@termlnk-server/protocol';
import type Redis from 'ioredis';
import type { IIceServerConfig } from '../config.schema';
import { createIdentifier } from '@termlnk-server/core';

/**
 * Minimal WebSocket abstraction used by the signaling controller — mirrors the
 * shape used by IRelayConnection so the same upgradeWebSocket adapter wiring works.
 */
export interface ISignalConnection {
  send(data: string): void;
  close(code: number, reason?: string): void;
}

export interface ISignalAttachOptions {
  /** Authenticated user id; signaling is scoped to the user (same-account only). */
  readonly userId: string;
  /** Session id the two peers are negotiating around — same id as the relay/share. */
  readonly sessionId: string;
  /** Per-device random peerId; each direction learns the other's peerId via 'hello'. */
  readonly peerId: string;
}

export interface ISignalHandle {
  onMessage(raw: string): void;
  onClose(): void;
}

/**
 * WebRTC signalling coordinator (M5 server side).
 *
 * Server is a dumb pipe: it does not parse SDP / ICE content. Envelopes are routed
 * by `(sessionId, peerId)`:
 *   - If `to` is set, deliver to that peerId only.
 *   - If `to` is omitted, broadcast to every other peer on the session.
 *
 * Cross-instance: when the recipient peer is connected to a different server process,
 * the envelope is published to Redis (`mp:signal:${userId}:${sessionId}`). Peers on
 * other instances subscribe to the same channel and deliver to their local peer if
 * the target lives there. `originInstanceId` lets the publisher skip its own echo.
 *
 * Authorisation: connections must share the same `userId` (the WS auth middleware
 * lifts userId from the JWT). Two devices belonging to different accounts can't sit
 * on the same signaling channel even if they guess the sessionId — they live in
 * different `(userId, sessionId)` buckets.
 *
 * Capacity guards:
 *   - Per-session peer cap (32): a sane upper bound; multiplayer sessions are
 *     small-group by design.
 *   - Per-message payload cap is enforced by the Zod schema upstream.
 */
export interface ISignalingService {
  attach(conn: ISignalConnection, options: ISignalAttachOptions): ISignalHandle;
}

export const ISignalingService = createIdentifier<ISignalingService>('multiplayer.signaling-service');

interface ISignalSession {
  readonly userId: string;
  readonly sessionId: string;
  /** peerId → local connection. Remote-instance peers don't show up here. */
  readonly peers: Map<string, ISignalConnection>;
  unsubscribeRedis: (() => void) | null;
}

interface ISignalPubEnvelope {
  readonly originInstanceId: string;
  readonly envelope: ISignalEnvelope;
}

const MAX_PEERS_PER_SESSION = 32;

function pubsubChannel(userId: string, sessionId: string): string {
  return `mp:signal:${userId}:${sessionId}`;
}

function sessionKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

function randomBase64Url(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    s += String.fromCharCode(buf[i]!);
  }
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function createSubscriber(parent: Redis, channel: string, handler: (message: string) => void): () => void {
  const sub = parent.duplicate();
  void sub.subscribe(channel).catch(() => undefined);
  sub.on('message', (_channel, message) => handler(message));
  return () => {
    void sub.unsubscribe(channel).catch(() => undefined);
    void sub.quit().catch(() => undefined);
  };
}

export class SignalingService implements ISignalingService {
  private readonly _instanceId = randomBase64Url(16);
  private readonly _sessions = new Map<string, ISignalSession>();

  constructor(
    private readonly _logService: ILogService,
    private readonly _redis: Redis | null,
    /** ICE servers shipped to each new peer via the `ready` envelope. */
    private readonly _iceServers: readonly IIceServerConfig[]
  ) {}

  attach(conn: ISignalConnection, options: ISignalAttachOptions): ISignalHandle {
    const session = this._getOrCreateSession(options.userId, options.sessionId);
    if (session.peers.size >= MAX_PEERS_PER_SESSION) {
      conn.close(4002, 'session_peer_cap');
      return { onMessage: () => undefined, onClose: () => undefined };
    }

    // Replace any prior local connection sharing the same peerId. This lets clients
    // reconnect on flaky links without leaking dead sockets.
    const prior = session.peers.get(options.peerId);
    if (prior && prior !== conn) {
      prior.close(4003, 'peer_replaced');
    }
    session.peers.set(options.peerId, conn);

    // Tell the joiner who else is on the session so it can decide whether to send
    // offers (typical pattern: the late joiner picks one peer at random and sends
    // hello; the earlier peer responds with offer). Also ship the configured
    // ICE servers so the peer doesn't need a separate STUN/TURN discovery.
    const otherPeers = [...session.peers.keys()].filter((p) => p !== options.peerId);
    conn.send(JSON.stringify({
      type: 'ready',
      peerId: options.peerId,
      peers: otherPeers,
      iceServers: this._iceServers,
    }));

    return {
      onMessage: (raw) => this._handleInbound(session, options.peerId, raw),
      onClose: () => this._detach(session, options.peerId, conn),
    };
  }

  private _handleInbound(session: ISignalSession, fromPeerId: string, raw: string): void {
    let envelope: ISignalEnvelope;
    try {
      const parsed = JSON.parse(raw) as ISignalEnvelope;
      envelope = { ...parsed, from: fromPeerId };
    } catch {
      const local = session.peers.get(fromPeerId);
      local?.send(JSON.stringify({ type: 'error', reason: 'invalid_json' }));
      return;
    }

    if (envelope.to) {
      const target = session.peers.get(envelope.to);
      if (target) {
        target.send(JSON.stringify(envelope));
        return;
      }
      // Target peer isn't on this instance — try Redis.
      this._publish(session, envelope);
      return;
    }
    // Broadcast to local peers (skip sender).
    for (const [peerId, peerConn] of session.peers) {
      if (peerId === fromPeerId) {
        continue;
      }
      peerConn.send(JSON.stringify(envelope));
    }
    this._publish(session, envelope);
  }

  private _detach(session: ISignalSession, peerId: string, conn: ISignalConnection): void {
    const current = session.peers.get(peerId);
    if (current !== conn) {
      // Already replaced by a newer connection; nothing to clean up.
      return;
    }
    session.peers.delete(peerId);

    // Tell remaining local peers that this peerId is gone so they can tear down
    // their half of the RTCPeerConnection promptly instead of waiting on ICE timeout.
    const bye: ISignalEnvelope = { type: 'bye', from: peerId };
    for (const peer of session.peers.values()) {
      peer.send(JSON.stringify(bye));
    }
    this._publish(session, bye);

    if (session.peers.size === 0) {
      session.unsubscribeRedis?.();
      session.unsubscribeRedis = null;
      this._sessions.delete(sessionKey(session.userId, session.sessionId));
    }
  }

  private _getOrCreateSession(userId: string, sessionId: string): ISignalSession {
    const key = sessionKey(userId, sessionId);
    const existing = this._sessions.get(key);
    if (existing) {
      return existing;
    }
    const created: ISignalSession = {
      userId,
      sessionId,
      peers: new Map(),
      unsubscribeRedis: null,
    };
    this._sessions.set(key, created);

    if (this._redis) {
      created.unsubscribeRedis = createSubscriber(
        this._redis,
        pubsubChannel(userId, sessionId),
        (msg) => this._handleRedisEnvelope(created, msg)
      );
    }
    return created;
  }

  private _publish(session: ISignalSession, envelope: ISignalEnvelope): void {
    if (!this._redis) {
      return;
    }
    const payload: ISignalPubEnvelope = {
      originInstanceId: this._instanceId,
      envelope,
    };
    this._redis
      .publish(pubsubChannel(session.userId, session.sessionId), JSON.stringify(payload))
      .catch((err) => this._logService.warn('[SignalingService] publish failed:', err));
  }

  private _handleRedisEnvelope(session: ISignalSession, raw: string): void {
    let payload: ISignalPubEnvelope;
    try {
      payload = JSON.parse(raw) as ISignalPubEnvelope;
    } catch {
      return;
    }
    if (payload.originInstanceId === this._instanceId) {
      return;
    }
    const env = payload.envelope;
    if (env.to) {
      const target = session.peers.get(env.to);
      target?.send(JSON.stringify(env));
      return;
    }
    // Broadcast — deliver to every local peer (sender lives on a different instance,
    // so no `skip self` needed).
    for (const peer of session.peers.values()) {
      peer.send(JSON.stringify(env));
    }
  }
}
