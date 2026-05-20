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
  collabInviteRoleSchema,
  collabInviteServerViewSchema,
  collabInviteStatusSchema,
  createCollabInviteRequestSchema,
  listCollabInvitesResponseSchema,
} from './collab.js';

describe('collab schemas', () => {
  it('collabInviteRole enumerates 4 roles', () => {
    expect(collabInviteRoleSchema.safeParse('owner').success).toBe(true);
    expect(collabInviteRoleSchema.safeParse('co-pilot').success).toBe(true);
    expect(collabInviteRoleSchema.safeParse('observer').success).toBe(true);
    expect(collabInviteRoleSchema.safeParse('auditor').success).toBe(true);
    expect(collabInviteRoleSchema.safeParse('admin').success).toBe(false);
  });

  it('collabInviteStatus enumerates the 4 lifecycle states', () => {
    expect(collabInviteStatusSchema.safeParse('active').success).toBe(true);
    expect(collabInviteStatusSchema.safeParse('consumed').success).toBe(true);
    expect(collabInviteStatusSchema.safeParse('revoked').success).toBe(true);
    expect(collabInviteStatusSchema.safeParse('expired').success).toBe(true);
    expect(collabInviteStatusSchema.safeParse('canceled').success).toBe(false);
  });

  it('createCollabInviteRequest accepts a minimal payload', () => {
    const got = createCollabInviteRequestSchema.safeParse({
      inviteId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      sessionId: 'sess-1',
      role: 'observer',
      capability: { v: 1, sid: 'sess-1', role: 'observer', exp: 1, nonce: 'nonce-1' },
      capabilityHash: 'AAAAAAAAAAAAAAAA',
      ephPubB64: 'AAAAAAAAAAAAAAAA',
      exp: 1715000000000,
      singleUse: true,
    });
    expect(got.success).toBe(true);
  });

  it('createCollabInviteRequest rejects non-base64url inviteId', () => {
    const got = createCollabInviteRequestSchema.safeParse({
      inviteId: 'has spaces',
      sessionId: 'sess-1',
      role: 'observer',
      capability: { v: 1, sid: 'sess-1', role: 'observer', exp: 1, nonce: 'n' },
      capabilityHash: 'h',
      ephPubB64: 'AAAAAAAAAAAAAAAA',
      exp: 1,
      singleUse: false,
    });
    expect(got.success).toBe(false);
  });

  it('createCollabInviteRequest rejects negative exp', () => {
    const got = createCollabInviteRequestSchema.safeParse({
      inviteId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      sessionId: 'sess-1',
      role: 'observer',
      capability: { v: 1, sid: 'sess-1', role: 'observer', exp: 1, nonce: 'n' },
      capabilityHash: 'AAAAAAAAAAAAAAAA',
      ephPubB64: 'AAAAAAAAAAAAAAAA',
      exp: -1,
      singleUse: false,
    });
    expect(got.success).toBe(false);
  });

  it('collabInviteServerView allows optional consumed/revoked timestamps', () => {
    const ok = collabInviteServerViewSchema.safeParse({
      inviteId: 'a',
      sessionId: 's',
      role: 'co-pilot',
      capabilityHash: 'h',
      exp: 1,
      singleUse: false,
      status: 'consumed',
      createdAt: '2026-05-10T00:00:00.000Z',
      consumedAt: '2026-05-10T00:10:00.000Z',
    });
    expect(ok.success).toBe(true);
  });

  it('listCollabInvitesResponse allows empty list', () => {
    const ok = listCollabInvitesResponseSchema.safeParse({ invites: [] });
    expect(ok.success).toBe(true);
  });
});
