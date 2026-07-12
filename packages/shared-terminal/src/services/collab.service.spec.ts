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

import type { ICollabInviteRow, ICollabInvitesRepository } from '@termlnk-server/database/repositories';
import type { IRelayClaimTokenPayload, IRelayClaimTokenService } from './relay-claim-token.service';
import { HttpError } from '@termlnk-server/rpc-server';
import { describe, expect, it, vi } from 'vitest';
import { CollabService } from './collab.service';

const TTL_MS = 12 * 60 * 60 * 1000;

function makeRow(overrides: Partial<ICollabInviteRow> = {}): ICollabInviteRow {
  return {
    userId: 'owner-1',
    inviteId: 'invite-1',
    sessionId: 'session-1',
    role: 'observer',
    capabilityHash: 'hash-1',
    capabilityVersion: 1,
    ephPubB64: 'eph-pub',
    exp: Date.now() + 60_000,
    singleUse: true,
    note: null,
    status: 'active',
    createdAt: new Date(),
    consumedAt: null,
    revokedAt: null,
    ...overrides,
  } as ICollabInviteRow;
}

function makeRepo(row: ICollabInviteRow | null): ICollabInvitesRepository & { markConsumed: ReturnType<typeof vi.fn> } {
  return {
    insert: vi.fn(),
    findOne: vi.fn(async () => row),
    findByInviteId: vi.fn(async () => row),
    listByUser: vi.fn(async () => (row ? [row] : [])),
    revoke: vi.fn(),
    markConsumed: vi.fn(async () => true),
  };
}

function makeTokenService(): IRelayClaimTokenService & { signed: IRelayClaimTokenPayload[] } {
  const signed: IRelayClaimTokenPayload[] = [];
  return {
    signed,
    sign: vi.fn(async (payload: IRelayClaimTokenPayload) => {
      signed.push(payload);
      return `signed.${payload.joinerUserId}`;
    }),
    verify: vi.fn(),
  };
}

async function rejectsHttp(promise: Promise<unknown>, status: number, code: string): Promise<HttpError> {
  const err = await promise.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
  expect((err as HttpError).code).toBe(code);
  return err as HttpError;
}

describe('collabService.claim — anonymous claimant', () => {
  it('generates an anon- joiner id and mints a token with the reconnect-window TTL', async () => {
    const repo = makeRepo(makeRow());
    const tokens = makeTokenService();
    const svc = new CollabService(repo, tokens, TTL_MS);
    const before = Date.now();

    const result = await svc.claim({ claimantUserId: null, inviteId: 'invite-1', capabilityHash: 'hash-1' });

    expect(result.relayClaimToken).toMatch(/^signed\.anon-/);
    expect(tokens.signed).toHaveLength(1);
    const payload = tokens.signed[0]!;
    expect(payload.joinerUserId).toMatch(/^anon-[\w-]{10,}$/);
    expect(payload.ownerUserId).toBe('owner-1');
    expect(payload.sessionId).toBe('session-1');
    expect(payload.connectionId).toBe(result.connectionId);
    expect(payload.exp).toBeGreaterThanOrEqual(before + TTL_MS);
    expect(payload.exp).toBeLessThanOrEqual(Date.now() + TTL_MS);
    expect(repo.markConsumed).toHaveBeenCalledOnce();
  });

  it('generates a fresh anon id per claim', async () => {
    const repo = makeRepo(makeRow({ singleUse: false }));
    const tokens = makeTokenService();
    const svc = new CollabService(repo, tokens, TTL_MS);

    await svc.claim({ claimantUserId: null, inviteId: 'invite-1', capabilityHash: 'hash-1' });
    await svc.claim({ claimantUserId: null, inviteId: 'invite-1', capabilityHash: 'hash-1' });

    expect(tokens.signed[0]!.joinerUserId).not.toBe(tokens.signed[1]!.joinerUserId);
  });

  it('rejects with 503 and does NOT consume the invite when the token service is absent', async () => {
    const repo = makeRepo(makeRow());
    const svc = new CollabService(repo, null, TTL_MS);

    await rejectsHttp(
      svc.claim({ claimantUserId: null, inviteId: 'invite-1', capabilityHash: 'hash-1' }),
      503,
      'anonymous_join_unavailable'
    );
    expect(repo.markConsumed).not.toHaveBeenCalled();
  });

  it('still enforces the capability hash for anonymous claimants', async () => {
    const repo = makeRepo(makeRow());
    const tokens = makeTokenService();
    const svc = new CollabService(repo, tokens, TTL_MS);

    await rejectsHttp(
      svc.claim({ claimantUserId: null, inviteId: 'invite-1', capabilityHash: 'wrong' }),
      400,
      'invalid_capability_hash'
    );
    expect(repo.markConsumed).not.toHaveBeenCalled();
  });
});

describe('collabService.claim — signed-in claimant (regression)', () => {
  it('mints with the claimant userId and the same reconnect-window TTL', async () => {
    const repo = makeRepo(makeRow());
    const tokens = makeTokenService();
    const svc = new CollabService(repo, tokens, TTL_MS);
    const before = Date.now();

    const result = await svc.claim({ claimantUserId: 'user-2', inviteId: 'invite-1', capabilityHash: 'hash-1' });

    expect(result.relayClaimToken).toBe('signed.user-2');
    const payload = tokens.signed[0]!;
    expect(payload.joinerUserId).toBe('user-2');
    expect(payload.exp).toBeGreaterThanOrEqual(before + TTL_MS);
    expect(payload.exp).toBeLessThanOrEqual(Date.now() + TTL_MS);
  });

  it('keeps working without a token service (same-account fallback)', async () => {
    const repo = makeRepo(makeRow());
    const svc = new CollabService(repo, null, TTL_MS);

    const result = await svc.claim({ claimantUserId: 'owner-1', inviteId: 'invite-1', capabilityHash: 'hash-1' });

    expect(result.relayClaimToken).toBeUndefined();
    expect(result.sessionId).toBe('session-1');
    expect(repo.markConsumed).toHaveBeenCalledOnce();
  });

  it('rejects consumed/revoked invites with 410 regardless of claimant kind', async () => {
    const repo = makeRepo(makeRow({ status: 'consumed' }));
    const tokens = makeTokenService();
    const svc = new CollabService(repo, tokens, TTL_MS);

    await rejectsHttp(
      svc.claim({ claimantUserId: null, inviteId: 'invite-1', capabilityHash: 'hash-1' }),
      410,
      'invite_not_active'
    );
    await rejectsHttp(
      svc.claim({ claimantUserId: 'user-2', inviteId: 'invite-1', capabilityHash: 'hash-1' }),
      410,
      'invite_not_active'
    );
  });
});
