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

import { describe, expect, it } from 'vitest';
import {
  pokeMessageSchema,
  pullRequestSchema,
  pullResponseSchema,
  pushRequestSchema,
  pushResponseSchema,
  syncResourceIdSchema,
} from './sync.js';

describe('sync schemas', () => {
  it('syncResourceId enumerates the 10 resources', () => {
    expect(syncResourceIdSchema.safeParse('host').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('config').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('ai_provider').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('mcp_server').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('skill').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('snippet').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('ssh_key').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('identity').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('known_host').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('port_forwarding_rule').success).toBe(true);
    expect(syncResourceIdSchema.safeParse('chat').success).toBe(false);
  });

  it('pushRequest accepts minimal mutation list', () => {
    const ok = pushRequestSchema.safeParse({
      clientId: 'cid-1',
      mutations: [{
        id: 1,
        resource: 'host',
        op: 'upsert',
        entityId: 'h1',
        payload: 'AQID',
        baseVersion: null,
        createdAt: 1715000000000,
      }],
    });
    expect(ok.success).toBe(true);
  });

  it('pushRequest mutation payload may be null for delete', () => {
    const ok = pushRequestSchema.safeParse({
      clientId: 'cid-1',
      mutations: [{
        id: 2,
        resource: 'host',
        op: 'delete',
        entityId: 'h1',
        payload: null,
        baseVersion: 5,
        createdAt: 1715000000000,
      }],
    });
    expect(ok.success).toBe(true);
  });

  it('pushResponse rejects negative version', () => {
    const bad = pushResponseSchema.safeParse({
      accepted: [],
      rejected: [],
      lastServerVersion: -1,
    });
    expect(bad.success).toBe(false);
  });

  it('pushResponse parses successfully with acceptedDetails carrying per-mutation version', () => {
    const ok = pushResponseSchema.safeParse({
      accepted: [1, 2],
      acceptedDetails: [
        { id: 1, resource: 'host', entityId: 'h1', version: 42 },
        { id: 2, resource: 'host', entityId: 'h2', version: 43 },
      ],
      rejected: [],
      lastServerVersion: 43,
    });
    expect(ok.success).toBe(true);
  });

  it('pushResponse stays backward-compatible when acceptedDetails is omitted', () => {
    // Old servers don't return acceptedDetails; new clients must accept that shape.
    const ok = pushResponseSchema.safeParse({
      accepted: [1, 2],
      rejected: [],
      lastServerVersion: 43,
    });
    expect(ok.success).toBe(true);
  });

  it('pushResponse acceptedDetails rejects negative version', () => {
    const bad = pushResponseSchema.safeParse({
      accepted: [1],
      acceptedDetails: [{ id: 1, resource: 'host', entityId: 'h1', version: -1 }],
      rejected: [],
      lastServerVersion: 0,
    });
    expect(bad.success).toBe(false);
  });

  it('pullRequest cursor may be null on first pull', () => {
    const ok = pullRequestSchema.safeParse({
      clientId: 'cid-1',
      resource: 'config',
      cursor: null,
    });
    expect(ok.success).toBe(true);
  });

  it('pullResponse patch entityId may be null on clear', () => {
    const ok = pullResponseSchema.safeParse({
      cursor: 'opaque',
      patch: [{
        op: 'clear',
        resource: 'host',
        entityId: null,
        payload: null,
        version: 100,
      }],
      lastMutationId: 50,
    });
    expect(ok.success).toBe(true);
  });

  it('pokeMessage requires type=poke and cursor', () => {
    expect(pokeMessageSchema.safeParse({
      type: 'poke',
      resource: 'host',
      cursor: 'c1',
    }).success).toBe(true);
    expect(pokeMessageSchema.safeParse({ type: 'pong' }).success).toBe(false);
  });
});
