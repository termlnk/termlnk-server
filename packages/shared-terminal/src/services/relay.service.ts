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
 * Shared-terminal relay — cross-instance via Redis pub/sub.
 *
 * One in-memory registry per process maps (userId, sessionId) → local connections.
 * The first local connection of a session subscribes the channel
 * `relay:${userId}:${sessionId}`; the last one to leave unsubscribes. Daemon→client
 * (target) and daemon→broadcast frames are delivered locally when the target is in
 * this process; otherwise they are published so peer instances can deliver. Every
 * envelope carries `originInstanceId` so the publisher skips its own echo.
 */

import type Redis from 'ioredis';
import { createIdentifier } from '@termlnk-server/core';

/**
 * Grace window before a closed client connection is reported to the daemon as
 * `peer_left`. The joiner-side RelayTransport reconnects transparently on a
 * transient ws blip WITHOUT re-sending client_join, so an immediate peer_left
 * would evict a joiner that is about to reconnect. We hold the notice for this
 * window and cancel it if the same connectionId re-attaches — locally, or
 * across pods via a `peer_rejoined` pub/sub event. Sized at/above the client's
 * first reconnect backoff so a normal blip is always covered.
 */
const PEER_LEFT_GRACE_MS = 5000;

function createSubscriber(parent: Redis, channel: string, handler: (message: string) => void): () => void {
  const sub = parent.duplicate();
  void sub.subscribe(channel).catch(() => undefined);
  sub.on('message', (_channel, message) => handler(message));
  return () => {
    void sub.unsubscribe(channel).catch(() => undefined);
    void sub.quit().catch(() => undefined);
  };
}

export interface IRelayConnection {
  send(data: string): void;
  close(code: number, reason?: string): void;
}

export interface IRelayAttachOptions {
  readonly userId: string;
  readonly sessionId: string;
  readonly mode: 'daemon' | 'client';
  readonly connectionId?: string;
  /**
   * When set, the relay routes this attach into the bucket keyed by
   * `ownerUserId:sessionId` instead of the JWT-derived `userId:sessionId`.
   * Cross-account joiners need this — the collab claim flow mints a
   * relay-claim token containing the owner's userId, and the controller
   * passes that owner here on attach.
   */
  readonly ownerUserId?: string;
}

export interface IRelayHandle {
  /** Forward an incoming WS message string into the relay. */
  onMessage(message: string): void;
  /** Notify the relay that the underlying connection has closed. */
  onClose(): void;
}

export interface IRelayService {
  attach(conn: IRelayConnection, options: IRelayAttachOptions): IRelayHandle;
}
export const IRelayService = createIdentifier<IRelayService>('shared-terminal.relay');

interface ILocalClient {
  readonly connectionId: string;
  readonly conn: IRelayConnection;
}

interface ILocalSession {
  readonly userId: string;
  readonly sessionId: string;
  daemon: IRelayConnection | null;
  readonly clients: Map<string, ILocalClient>;
  /** Per-connectionId debounce timers for not-yet-emitted `peer_left` notices. */
  readonly pendingLeaves: Map<string, ReturnType<typeof setTimeout>>;
  unsubscribeRedis: (() => void) | null;
}

interface IRelayPubEnvelope {
  readonly originInstanceId: string;
  /**
   * When set, this is a control event rather than a frame relay. The
   * source/target/payload fields are ignored for events.
   *   - `evict_clients`: a daemon detached/shutdown — peer pods drop local clients.
   *   - `peer_left`: a client connection closed — the pod holding the daemon
   *     forwards it to the daemon (carries `connectionId`).
   *   - `peer_rejoined`: a client re-attached within the grace window — peer
   *     pods cancel any pending `peer_left` for that `connectionId`.
   */
  readonly event?: 'evict_clients' | 'peer_left' | 'peer_rejoined';
  readonly reason?: string;
  /** The client connectionId carried by `peer_left` / `peer_rejoined` events. */
  readonly connectionId?: string;
  readonly source?: 'daemon' | string;
  readonly target?: 'daemon' | 'broadcast' | string;
  readonly payload?: string;
}

interface IRelayInboundEnvelope {
  readonly type?: string;
  readonly target?: string;
  readonly payload?: string;
  readonly connectionId?: string;
}

function sessionKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

function pubsubChannel(userId: string, sessionId: string): string {
  return `relay:${userId}:${sessionId}`;
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

export class RelayService implements IRelayService {
  private readonly _sessions = new Map<string, ILocalSession>();
  private readonly _instanceId = randomBase64Url(16);

  constructor(private readonly _redis: Redis | null = null) {}

  attach(conn: IRelayConnection, options: IRelayAttachOptions): IRelayHandle {
    if (options.mode === 'daemon' && options.ownerUserId !== undefined) {
      // Daemon represents the session owner — its JWT userId IS the bucket
      // key. An ownerUserId override on daemon attach would either be a
      // controller bug or a forged path that lets a daemon plant itself in
      // another user's bucket. Fail closed.
      throw new Error('[RelayService] ownerUserId must not be set on daemon attach');
    }
    // Pick which userId keys the session bucket. For same-account attaches the
    // joiner's own JWT-derived userId is correct (it equals the owner's). For
    // cross-account joiners (collab claim flow), the controller passes the
    // owner's userId via `ownerUserId` and we route into THAT bucket — the
    // joiner sits in the owner's session even though their JWT identifies a
    // different account.
    const routingUserId = options.ownerUserId ?? options.userId;
    const session = this._getOrCreateSession(routingUserId, options.sessionId);

    let myConnectionId: string;
    if (options.mode === 'daemon') {
      if (session.daemon && session.daemon !== conn) {
        session.daemon.close(4000, 'daemon replaced');
      }
      session.daemon = conn;
      myConnectionId = 'daemon';
      conn.send(JSON.stringify({ type: 'ready' }));
    } else {
      myConnectionId = options.connectionId ?? randomBase64Url(16);
      session.clients.set(myConnectionId, { connectionId: myConnectionId, conn });
      // A reconnect within the grace window must cancel the pending peer_left
      // so the daemon never reads a transient blip as a departure. Cancel
      // locally and broadcast so the pod that armed it (if different) cancels too.
      this._cancelPendingLeave(session, myConnectionId);
      this._publish(session, {
        originInstanceId: this._instanceId,
        event: 'peer_rejoined',
        connectionId: myConnectionId,
      });
      conn.send(JSON.stringify({ type: 'ready', connectionId: myConnectionId }));
    }

    return {
      onMessage: (msg) => this._handleInbound(session, options.mode, myConnectionId, conn, msg),
      onClose: () => this._detach(session, options.mode, myConnectionId, conn),
    };
  }

  private _handleInbound(
    session: ILocalSession,
    mode: 'daemon' | 'client',
    myConnectionId: string,
    conn: IRelayConnection,
    raw: string
  ): void {
    let envelope: IRelayInboundEnvelope;
    try {
      envelope = JSON.parse(raw) as IRelayInboundEnvelope;
    } catch {
      conn.send(JSON.stringify({ type: 'error', reason: 'invalid_json' }));
      return;
    }

    if (envelope.type === 'ping') {
      conn.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    if (envelope.type === 'shutdown' && mode === 'daemon') {
      // Explicit owner-initiated shutdown — distinct from a daemon WebSocket
      // close caused by a transient network blip. Evict every client so the
      // joiner UI doesn't sit on a "Connected" tab with no data, and forbid
      // any further client attaches to this bucket by GC'ing it below once
      // the daemon's own close event lands.
      this._evictClientsLocally(session, 'owner_left');
      this._publish(session, {
        originInstanceId: this._instanceId,
        event: 'evict_clients',
        reason: 'owner_left',
      });
      return;
    }
    if (envelope.type === 'revoke' && mode === 'daemon' && envelope.connectionId) {
      const target = session.clients.get(envelope.connectionId);
      if (target) {
        target.conn.close(4001, 'revoked');
        session.clients.delete(envelope.connectionId);
      }
      return;
    }
    if (envelope.type !== 'frame' || !envelope.payload) {
      return;
    }

    if (mode === 'client') {
      if (!session.daemon) {
        conn.send(JSON.stringify({ type: 'error', reason: 'daemon_unavailable' }));
        return;
      }
      session.daemon.send(JSON.stringify({
        type: 'frame',
        source: myConnectionId,
        target: 'daemon',
        payload: envelope.payload,
      }));
      return;
    }

    if (envelope.target === 'broadcast') {
      for (const client of session.clients.values()) {
        client.conn.send(JSON.stringify({
          type: 'frame',
          source: 'daemon',
          target: client.connectionId,
          payload: envelope.payload,
        }));
      }
      this._publish(session, {
        originInstanceId: this._instanceId,
        source: 'daemon',
        target: 'broadcast',
        payload: envelope.payload,
      });
      return;
    }
    if (envelope.target) {
      const local = session.clients.get(envelope.target);
      if (local) {
        local.conn.send(JSON.stringify({
          type: 'frame',
          source: 'daemon',
          target: envelope.target,
          payload: envelope.payload,
        }));
      } else {
        this._publish(session, {
          originInstanceId: this._instanceId,
          source: 'daemon',
          target: envelope.target,
          payload: envelope.payload,
        });
      }
    }
  }

  private _detach(
    session: ILocalSession,
    mode: 'daemon' | 'client',
    myConnectionId: string,
    conn: IRelayConnection
  ): void {
    if (mode === 'daemon' && session.daemon === conn) {
      // Bare daemon socket close (network blip, server restart, etc.) — do NOT
      // evict clients here. Owner-initiated tear-down sends an explicit
      // `{type:'shutdown'}` envelope BEFORE disconnecting (handled in
      // _handleInbound), which is the path that actually evicts. Without this
      // separation a flaky daemon link would yank every joiner on every blip.
      session.daemon = null;
    }
    if (mode === 'client') {
      session.clients.delete(myConnectionId);
      // Defer the daemon notification: the joiner-side transport reconnects
      // transparently (no fresh client_join), so a transient blip must not read
      // as a departure. _schedulePeerLeft holds the notice for a grace window;
      // a re-attach of the same connectionId cancels it.
      this._schedulePeerLeft(session, myConnectionId);
    }

    this._maybeGcSession(session);
  }

  /**
   * Arm a debounced `peer_left` for a closed client connection. Fires after
   * PEER_LEFT_GRACE_MS unless cancelled by a re-attach. Replaces any existing
   * timer for the same connectionId so a duplicate close cannot stack them.
   */
  private _schedulePeerLeft(session: ILocalSession, connectionId: string): void {
    this._cancelPendingLeave(session, connectionId);
    const timer = setTimeout(() => {
      session.pendingLeaves.delete(connectionId);
      this._emitPeerLeft(session, connectionId);
      this._maybeGcSession(session);
    }, PEER_LEFT_GRACE_MS);
    session.pendingLeaves.set(connectionId, timer);
  }

  private _cancelPendingLeave(session: ILocalSession, connectionId: string): void {
    const timer = session.pendingLeaves.get(connectionId);
    if (timer === undefined) {
      return;
    }
    clearTimeout(timer);
    session.pendingLeaves.delete(connectionId);
  }

  /**
   * Tell the daemon a client departed. Delivered locally when the daemon shares
   * this pod; otherwise published so the pod holding the daemon forwards it
   * (mirrors the broadcast / evict_clients fan-out).
   */
  private _emitPeerLeft(session: ILocalSession, connectionId: string): void {
    if (session.daemon) {
      session.daemon.send(JSON.stringify({ type: 'peer_left', connectionId }));
    }
    this._publish(session, {
      originInstanceId: this._instanceId,
      event: 'peer_left',
      connectionId,
    });
  }

  /**
   * GC the session once nothing references it. Pending peer_left timers count
   * as references — they need the session live to deliver/forward on fire.
   */
  private _maybeGcSession(session: ILocalSession): void {
    if (session.daemon || session.clients.size > 0 || session.pendingLeaves.size > 0) {
      return;
    }
    session.unsubscribeRedis?.();
    session.unsubscribeRedis = null;
    this._sessions.delete(sessionKey(session.userId, session.sessionId));
  }

  private _evictClientsLocally(session: ILocalSession, reason: string): void {
    for (const client of session.clients.values()) {
      try {
        client.conn.close(4002, reason);
      } catch {
        // Best-effort: the underlying transport may already be torn down.
      }
    }
    session.clients.clear();
    // Owner is gone — armed peer_left timers are moot. Drop them so they neither
    // fire stale notices nor keep the session pinned in _maybeGcSession.
    for (const timer of session.pendingLeaves.values()) {
      clearTimeout(timer);
    }
    session.pendingLeaves.clear();
  }

  private _getOrCreateSession(userId: string, sessionId: string): ILocalSession {
    const key = sessionKey(userId, sessionId);
    const existing = this._sessions.get(key);
    if (existing) {
      return existing;
    }
    const created: ILocalSession = {
      userId,
      sessionId,
      daemon: null,
      clients: new Map(),
      pendingLeaves: new Map(),
      unsubscribeRedis: null,
    };
    this._sessions.set(key, created);

    if (this._redis) {
      created.unsubscribeRedis = createSubscriber(
        this._redis,
        pubsubChannel(userId, sessionId),
        (message) => this._handleRedisEnvelope(created, message)
      );
    }
    return created;
  }

  private _publish(session: ILocalSession, envelope: IRelayPubEnvelope): void {
    if (!this._redis) {
      return;
    }
    this._redis
      .publish(pubsubChannel(session.userId, session.sessionId), JSON.stringify(envelope))
      .catch(() => undefined);
  }

  private _handleRedisEnvelope(session: ILocalSession, message: string): void {
    let envelope: IRelayPubEnvelope;
    try {
      envelope = JSON.parse(message) as IRelayPubEnvelope;
    } catch {
      return;
    }
    if (envelope.originInstanceId === this._instanceId) {
      return;
    }

    if (envelope.event === 'evict_clients') {
      this._evictClientsLocally(session, envelope.reason ?? 'owner_left');
      this._maybeGcSession(session);
      return;
    }
    if (envelope.event === 'peer_left') {
      // Only the pod holding the daemon delivers; others have no daemon and ignore.
      if (session.daemon && envelope.connectionId) {
        session.daemon.send(JSON.stringify({ type: 'peer_left', connectionId: envelope.connectionId }));
      }
      return;
    }
    if (envelope.event === 'peer_rejoined') {
      // A re-attach landed on a peer pod — cancel any pending peer_left we armed,
      // then GC: cancelling may have emptied this pod's last reference to the
      // session (no local connection, no pending timer), and only this path
      // would otherwise leave the session + its Redis subscription stranded.
      if (envelope.connectionId) {
        this._cancelPendingLeave(session, envelope.connectionId);
        this._maybeGcSession(session);
      }
      return;
    }

    if (!envelope.target || !envelope.payload) {
      return;
    }

    if (envelope.target === 'broadcast') {
      for (const client of session.clients.values()) {
        client.conn.send(JSON.stringify({
          type: 'frame',
          source: 'daemon',
          target: client.connectionId,
          payload: envelope.payload,
        }));
      }
      return;
    }
    if (envelope.target === 'daemon') {
      if (session.daemon) {
        session.daemon.send(JSON.stringify({
          type: 'frame',
          source: envelope.source,
          target: 'daemon',
          payload: envelope.payload,
        }));
      }
      return;
    }
    const local = session.clients.get(envelope.target);
    if (local) {
      local.conn.send(JSON.stringify({
        type: 'frame',
        source: 'daemon',
        target: envelope.target,
        payload: envelope.payload,
      }));
    }
  }
}
