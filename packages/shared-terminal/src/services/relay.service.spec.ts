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

import type { IRelayConnection } from './relay.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayService } from './relay.service';

class FakeConn implements IRelayConnection {
  readonly sent: string[] = [];
  readonly close = vi.fn();
  send(data: string): void {
    this.sent.push(data);
  }
}

describe('relayService — single instance (Redis disabled)', () => {
  let relay: RelayService;

  beforeEach(() => {
    relay = new RelayService(null);
  });

  it('routes client frame to daemon and daemon frame to a targeted client', () => {
    const daemon = new FakeConn();
    const client = new FakeConn();

    relay.attach(daemon, { userId: 'u1', mode: 'daemon', sessionId: 's1' });
    const handle = relay.attach(client, {
      userId: 'u1',
      mode: 'client',
      sessionId: 's1',
      connectionId: 'c1',
    });

    handle.onMessage(JSON.stringify({ type: 'frame', target: 'daemon', payload: 'abc' }));
    expect(daemon.sent.at(-1)).toContain('"source":"c1"');
    expect(daemon.sent.at(-1)).toContain('"payload":"abc"');

    const daemonRelay = relay.attach(daemon, { userId: 'u1', mode: 'daemon', sessionId: 's1' });
    daemonRelay.onMessage(JSON.stringify({ type: 'frame', target: 'c1', payload: 'def' }));
    expect(client.sent.at(-1)).toContain('"source":"daemon"');
    expect(client.sent.at(-1)).toContain('"payload":"def"');
  });

  it('broadcasts daemon frame to all clients in the same session', () => {
    const daemon = new FakeConn();
    const a = new FakeConn();
    const b = new FakeConn();

    const daemonHandle = relay.attach(daemon, { userId: 'u1', mode: 'daemon', sessionId: 's1' });
    relay.attach(a, { userId: 'u1', mode: 'client', sessionId: 's1', connectionId: 'a' });
    relay.attach(b, { userId: 'u1', mode: 'client', sessionId: 's1', connectionId: 'b' });

    daemonHandle.onMessage(JSON.stringify({ type: 'frame', target: 'broadcast', payload: 'fanout' }));

    expect(a.sent.at(-1)).toContain('"payload":"fanout"');
    expect(b.sent.at(-1)).toContain('"payload":"fanout"');
  });

  it('reports daemon_unavailable when client sends after daemon has detached', () => {
    const daemon = new FakeConn();
    const client = new FakeConn();

    const daemonHandle = relay.attach(daemon, { userId: 'u1', mode: 'daemon', sessionId: 's1' });
    const clientHandle = relay.attach(client, {
      userId: 'u1',
      mode: 'client',
      sessionId: 's1',
      connectionId: 'c1',
    });

    daemonHandle.onClose();
    clientHandle.onMessage(JSON.stringify({ type: 'frame', target: 'daemon', payload: 'abc' }));

    expect(client.sent.at(-1)).toContain('"daemon_unavailable"');
  });

  it('answers ping with pong', () => {
    const conn = new FakeConn();
    const handle = relay.attach(conn, { userId: 'u1', mode: 'daemon', sessionId: 's1' });
    handle.onMessage(JSON.stringify({ type: 'ping' }));
    expect(conn.sent.at(-1)).toBe(JSON.stringify({ type: 'pong' }));
  });

  it('emits invalid_json on malformed input', () => {
    const conn = new FakeConn();
    const handle = relay.attach(conn, { userId: 'u1', mode: 'daemon', sessionId: 's1' });
    handle.onMessage('not-json');
    expect(conn.sent.at(-1)).toContain('"invalid_json"');
  });
});

describe('relayService — cross-instance via shared in-memory Redis stub', () => {
  class FakeBus {
    private readonly _subs = new Map<string, Set<(channel: string, msg: string) => void>>();
    publish(channel: string, message: string): void {
      queueMicrotask(() => {
        for (const cb of this._subs.get(channel) ?? []) {
          cb(channel, message);
        }
      });
    }

    register(channel: string, cb: (channel: string, msg: string) => void): () => void {
      const set = this._subs.get(channel) ?? new Set();
      set.add(cb);
      this._subs.set(channel, set);
      return () => set.delete(cb);
    }
  }

  function makeFakeRedis(bus: FakeBus): unknown {
    const listeners = new Map<string, (channel: string, msg: string) => void>();
    const unsubs = new Map<string, () => void>();
    const client = {
      duplicate() {
        return makeFakeRedis(bus);
      },
      publish(channel: string, message: string) {
        bus.publish(channel, message);
        return Promise.resolve(0);
      },
      async subscribe(channel: string) {
        const dispatch = (ch: string, msg: string) => {
          const handler = listeners.get(ch);
          if (handler) {
            handler(ch, msg);
          }
        };
        const off = bus.register(channel, dispatch);
        unsubs.set(channel, off);
        return Promise.resolve();
      },
      async unsubscribe(channel: string) {
        unsubs.get(channel)?.();
        unsubs.delete(channel);
        listeners.delete(channel);
        return Promise.resolve();
      },
      on(event: string, cb: (channel: string, msg: string) => void) {
        if (event === 'message') {
          for (const channel of unsubs.keys()) {
            listeners.set(channel, cb);
          }
          (client as { _onMessage?: typeof cb })._onMessage = cb;
        }
        return client;
      },
      async quit() {
        for (const off of unsubs.values()) {
          off();
        }
        unsubs.clear();
        listeners.clear();
        return Promise.resolve();
      },
    } as Record<string, unknown>;

    const origSubscribe = client.subscribe as (ch: string) => Promise<void>;
    client.subscribe = async (channel: string) => {
      await origSubscribe(channel);
      const stored = (client as { _onMessage?: (ch: string, msg: string) => void })._onMessage;
      if (stored) {
        listeners.set(channel, stored);
      }
    };

    return client;
  }

  it('delivers daemon broadcast to clients on a peer instance', async () => {
    const bus = new FakeBus();
    const redisA = makeFakeRedis(bus) as never;
    const redisB = makeFakeRedis(bus) as never;
    const relayA = new RelayService(redisA);
    const relayB = new RelayService(redisB);

    const daemon = new FakeConn();
    const clientLocal = new FakeConn();
    const clientRemote = new FakeConn();

    const daemonHandle = relayA.attach(daemon, { userId: 'u1', mode: 'daemon', sessionId: 's1' });
    relayA.attach(clientLocal, { userId: 'u1', mode: 'client', sessionId: 's1', connectionId: 'local' });
    relayB.attach(clientRemote, { userId: 'u1', mode: 'client', sessionId: 's1', connectionId: 'remote' });

    daemonHandle.onMessage(JSON.stringify({ type: 'frame', target: 'broadcast', payload: 'hello-all' }));

    await new Promise((r) => setImmediate(r));

    expect(clientLocal.sent.at(-1)).toContain('"payload":"hello-all"');
    expect(clientRemote.sent.at(-1)).toContain('"payload":"hello-all"');
  });

  it('delivers daemon-target frame to a client on the peer instance', async () => {
    const bus = new FakeBus();
    const redisA = makeFakeRedis(bus) as never;
    const redisB = makeFakeRedis(bus) as never;
    const relayA = new RelayService(redisA);
    const relayB = new RelayService(redisB);

    const daemon = new FakeConn();
    const clientRemote = new FakeConn();

    const daemonHandle = relayA.attach(daemon, { userId: 'u1', mode: 'daemon', sessionId: 's1' });
    relayB.attach(clientRemote, { userId: 'u1', mode: 'client', sessionId: 's1', connectionId: 'remote' });

    daemonHandle.onMessage(JSON.stringify({ type: 'frame', target: 'remote', payload: 'hi-remote' }));

    await new Promise((r) => setImmediate(r));

    expect(clientRemote.sent.at(-1)).toContain('"payload":"hi-remote"');
  });
});
