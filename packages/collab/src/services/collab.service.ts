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

import type {
  ICollabInviteRow,
  ICollabInvitesRepository,
} from '@termlnk-server/database/repositories';
import type {
  IClaimCollabInviteResponse,
  ICollabInviteServerView,
} from '@termlnk-server/protocol';
import { createIdentifier } from '@termlnk-server/core';
import { UniqueViolationError } from '@termlnk-server/database/repositories';
import { HttpError } from '@termlnk-server/rpc-server';

export interface ICreateInviteParams {
  userId: string;
  inviteId: string;
  sessionId: string;
  role: string;
  capabilityHash: string;
  capabilityVersion: number;
  ephPubB64: string;
  exp: number;
  singleUse: boolean;
  note?: string | null;
}

export interface IClaimInviteParams {
  /** Authenticated claimant — does not need to match the invite owner. */
  claimantUserId: string;
  inviteId: string;
  capabilityHash: string;
  displayName?: string;
}

export interface ICollabService {
  create(params: ICreateInviteParams): Promise<ICollabInviteServerView>;
  revoke(userId: string, inviteId: string): Promise<void>;
  list(userId: string): Promise<ICollabInviteServerView[]>;
  /**
   * Receiver-side claim: validate + atomically flip status to consumed + return the
   * connection metadata the joiner needs to attach to the relay. The owner's UI
   * picks up the consumption through the next GET /invite poll.
   *
   * Failure surface (HttpError codes the controller maps to status):
   *   - 404 invite_not_found       — inviteId never minted
   *   - 410 invite_not_active      — already consumed / revoked / expired
   *   - 410 invite_expired         — past capability.exp
   *   - 400 invalid_capability_hash — caller's hash != stored hash (tampering / wrong fragment)
   */
  claim(params: IClaimInviteParams): Promise<IClaimCollabInviteResponse>;
}

export const ICollabService = createIdentifier<ICollabService>('collab.service');

function toView(row: ICollabInviteRow): ICollabInviteServerView {
  const view: ICollabInviteServerView = {
    inviteId: row.inviteId,
    sessionId: row.sessionId,
    role: row.role as ICollabInviteServerView['role'],
    capabilityHash: row.capabilityHash,
    exp: row.exp,
    singleUse: row.singleUse,
    status: row.status as ICollabInviteServerView['status'],
    createdAt: row.createdAt.toISOString(),
  };
  if (row.consumedAt) {
    view.consumedAt = row.consumedAt.toISOString();
  }
  if (row.revokedAt) {
    view.revokedAt = row.revokedAt.toISOString();
  }
  return view;
}

/** Base64url-encoded 16 random bytes (128 bits — collision-safe per-invite). */
function generateConnectionId(): string {
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    s += String.fromCharCode(buf[i]!);
  }
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export class CollabService implements ICollabService {
  constructor(private readonly _invites: ICollabInvitesRepository) {}

  async create(params: ICreateInviteParams): Promise<ICollabInviteServerView> {
    try {
      await this._invites.insert({
        userId: params.userId,
        inviteId: params.inviteId,
        sessionId: params.sessionId,
        role: params.role,
        capabilityHash: params.capabilityHash,
        capabilityVersion: params.capabilityVersion,
        ephPubB64: params.ephPubB64,
        exp: params.exp,
        singleUse: params.singleUse,
        note: params.note ?? null,
      });
    } catch (err) {
      if (err instanceof UniqueViolationError) {
        throw new HttpError(409, 'invite_already_exists');
      }
      throw err;
    }
    const row = await this._invites.findOne(params.userId, params.inviteId);
    if (!row) {
      throw new HttpError(500, 'server_error', 'invite vanished after insert');
    }
    return toView(row);
  }

  async revoke(userId: string, inviteId: string): Promise<void> {
    const existing = await this._invites.findOne(userId, inviteId);
    if (!existing) {
      throw new HttpError(404, 'invite_not_found');
    }
    if (existing.status === 'active') {
      await this._invites.revoke(userId, inviteId, new Date());
    }
  }

  async list(userId: string): Promise<ICollabInviteServerView[]> {
    const rows = await this._invites.listByUser(userId);
    return rows.map(toView);
  }

  async claim(params: IClaimInviteParams): Promise<IClaimCollabInviteResponse> {
    // 1. Owner-agnostic lookup. inviteId is base64url(24) so the namespace is large
    //    enough that we don't worry about cross-user collisions.
    const row = await this._invites.findByInviteId(params.inviteId);
    if (!row) {
      throw new HttpError(404, 'invite_not_found');
    }

    // 2. Cheap rejects before the atomic update so we surface the precise failure
    //    code. Expiry is checked here because `exp` is wall-clock ms; we don't run a
    //    sweep on every claim.
    if (row.status !== 'active') {
      throw new HttpError(410, 'invite_not_active', `invite is ${row.status}`);
    }
    if (row.exp < Date.now()) {
      throw new HttpError(410, 'invite_expired');
    }
    if (row.capabilityHash !== params.capabilityHash) {
      throw new HttpError(400, 'invalid_capability_hash');
    }

    // 3. Atomic consume — handles the concurrent-claim race for single-use invites.
    //    `false` here means another claimant won between our findByInviteId and the
    //    update, or the owner just revoked it. Either way the caller sees 410.
    const consumedAt = new Date();
    const ok = await this._invites.markConsumed(row.userId, row.inviteId, consumedAt);
    if (!ok) {
      throw new HttpError(410, 'invite_not_active', 'claim race lost');
    }

    return {
      sessionId: row.sessionId,
      ephPubB64: row.ephPubB64,
      role: row.role as IClaimCollabInviteResponse['role'],
      connectionId: generateConnectionId(),
      consumedAt: consumedAt.toISOString(),
    };
  }
}
