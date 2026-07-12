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
 * Wire-level smoke test for the relay WS endpoint: a REAL @hono/node-server
 * HTTP server, REAL WebSocket clients (Node's built-in, which enforces RFC
 * 6455 subprotocol negotiation like browsers do), and a REAL HMAC-signed
 * relay-claim token. This is the layer resolve-relay-identity.spec.ts cannot
 * cover: that the anonymous RelayToken-only subprotocol actually survives the
 * upgrade dance and lands the joiner in the owner's session bucket.
 */

import type { IAccessClaims } from '@termlnk-server/crypto';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { Injector } from '@termlnk-server/core';
import { IJwtService, WebCryptoHmacService } from '@termlnk-server/crypto';
import { createRouter } from '@termlnk-server/rpc-server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { IRelayClaimTokenService, RelayClaimTokenService } from '../services/relay-claim-token.service';
import { IRelayService, RelayService } from '../services/relay.service';
import { RelayController } from './relay.controller';

const VALID_JWT = 'valid-owner-jwt';
const OWNER_ID = 'owner-1';
const SESSION_ID = 'session-ws-1';
const SECRET = 'relay-claim-secret-for-ws-smoke-test';

const jwtService: IJwtService = {
  computeAccessExpiresAt: vi.fn(),
  computeRefreshExpiresAt: vi.fn(),
  signAccess: vi.fn(),
  signRefresh: vi.fn(),
  verifyAccess: vi.fn(async (token: string) => {
    if (token !== VALID_JWT) {
      throw new Error('bad token');
    }
    return { sub: OWNER_ID, email: 'o@example.test', jti: 'jti-1' } as IAccessClaims;
  }),
  verifyRefresh: vi.fn(),
};

const tokenService = new RelayClaimTokenService(new WebCryptoHmacService(), SECRET, 5 * 60 * 1000);

let server: ReturnType<typeof serve>;
let baseUrl: string;

beforeAll(async () => {
  const injector = new Injector([
    [IRelayService, { useFactory: () => new RelayService(null) }],
    [IRelayClaimTokenService, { useValue: tokenService }],
    [IJwtService, { useValue: jwtService }],
    [RelayController],
  ]);
  const router = createRouter();
  injector.get(RelayController).registerRoutes(router);
  // Mirrors apps/server wiring: a noServer wss handed to serve(), including
  // the handleProtocols echo strict clients require (see apps/server index.ts).
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => protocols.values().next().value ?? false,
  });
  await new Promise<void>((resolve) => {
    server = serve({ fetch: router.fetch, port: 0, websocket: { server: wss } }, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `ws://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

interface IOpenSocket {
  readonly ws: WebSocket;
  readonly messages: unknown[];
  next(predicate?: (msg: unknown) => boolean): Promise<unknown>;
}

/** Opens a socket and resolves once the server accepts the upgrade; rejects on pre-open close. */
function open(query: string, protocols: string[]): Promise<IOpenSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${baseUrl}/?${query}`, protocols);
    const messages: unknown[] = [];
    const waiters: Array<{ predicate: (msg: unknown) => boolean; resolve: (msg: unknown) => void }> = [];
    ws.addEventListener('message', (evt) => {
      const parsed = JSON.parse(String(evt.data));
      messages.push(parsed);
      const idx = waiters.findIndex((w) => w.predicate(parsed));
      if (idx >= 0) {
        waiters.splice(idx, 1)[0]!.resolve(parsed);
      }
    });
    let opened = false;
    ws.addEventListener('open', () => {
      opened = true;
      resolve({
        ws,
        messages,
        next: (predicate = () => true) => {
          const existing = messages.find(predicate);
          if (existing !== undefined) {
            return Promise.resolve(existing);
          }
          return new Promise((res) => waiters.push({ predicate, resolve: res }));
        },
      });
    });
    ws.addEventListener('close', (evt) => {
      if (!opened) {
        reject(new Error(`upgrade rejected (code=${evt.code})`));
      }
    });
    ws.addEventListener('error', () => {
      // close follows; settlement happens there.
    });
  });
}

async function mintToken(overrides: Partial<Parameters<typeof tokenService.sign>[0]> = {}): Promise<{ token: string; connectionId: string }> {
  const connectionId = (overrides.connectionId as string | undefined) ?? `conn-${Math.random().toString(36).slice(2)}`;
  const token = await tokenService.sign({
    ownerUserId: OWNER_ID,
    joinerUserId: 'anon-wssmoke1234',
    sessionId: SESSION_ID,
    inviteId: 'invite-ws-1',
    connectionId,
    exp: Date.now() + 60_000,
    ...overrides,
    ...(overrides.connectionId === undefined ? { connectionId } : {}),
  });
  return { token, connectionId };
}

describe('relay WS endpoint — anonymous attach smoke', () => {
  it('routes an anonymous RelayToken-only client into the owner bucket and relays daemon frames', async () => {
    const daemon = await open(`v=1&mode=daemon&sessionId=${SESSION_ID}`, [`Bearer.${VALID_JWT}`]);
    await daemon.next((m) => (m as { type?: string }).type === 'ready');

    const { token, connectionId } = await mintToken();
    const anon = await open(
      `v=1&mode=client&sessionId=${SESSION_ID}&connectionId=${connectionId}`,
      [`RelayToken.${token}`]
    );
    const ready = await anon.next((m) => (m as { type?: string }).type === 'ready') as { connectionId?: string };
    expect(ready.connectionId).toBe(connectionId);

    // daemon → broadcast reaches the anonymous joiner only if both sockets
    // share the owner's bucket, which is exactly what the token grants.
    daemon.ws.send(JSON.stringify({ type: 'frame', target: 'broadcast', payload: 'cGF5bG9hZA==' }));
    const frame = await anon.next((m) => (m as { type?: string }).type === 'frame') as { source?: string; payload?: string };
    expect(frame.source).toBe('daemon');
    expect(frame.payload).toBe('cGF5bG9hZA==');

    // anonymous joiner → daemon direction.
    anon.ws.send(JSON.stringify({ type: 'frame', target: 'daemon', payload: 'dXA=' }));
    const up = await daemon.next((m) => (m as { type?: string }).type === 'frame') as { source?: string };
    expect(up.source).toBe(connectionId);

    anon.ws.close();
    daemon.ws.close();
  });

  it('rejects the upgrade for a forged relay token', async () => {
    await expect(
      open(`v=1&mode=client&sessionId=${SESSION_ID}&connectionId=conn-x`, ['RelayToken.forged.token'])
    ).rejects.toThrow(/upgrade rejected/);
  });

  it('rejects an anonymous attach whose connectionId does not match the token', async () => {
    const { token } = await mintToken();
    await expect(
      open(`v=1&mode=client&sessionId=${SESSION_ID}&connectionId=conn-other`, [`RelayToken.${token}`])
    ).rejects.toThrow(/upgrade rejected/);
  });

  it('rejects a token minted for a signed-in joiner on the bare-token path', async () => {
    const { token, connectionId } = await mintToken({ joinerUserId: 'user-2' });
    await expect(
      open(`v=1&mode=client&sessionId=${SESSION_ID}&connectionId=${connectionId}`, [`RelayToken.${token}`])
    ).rejects.toThrow(/upgrade rejected/);
  });

  it('rejects a credential-less upgrade', async () => {
    await expect(
      open(`v=1&mode=client&sessionId=${SESSION_ID}`, ['unrelated-proto'])
    ).rejects.toThrow(/upgrade rejected/);
  });
});
