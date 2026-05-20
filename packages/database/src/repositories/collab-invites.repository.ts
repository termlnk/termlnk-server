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

import type { collabInvites } from '../entities';
import type { ITxContext } from '../services/db-adaptor.service';
import { createIdentifier } from '@termlnk-server/core';

export type ICollabInviteRow = typeof collabInvites.$inferSelect;

export interface ICollabInviteInsertParams {
  userId: string;
  inviteId: string;
  sessionId: string;
  role: string;
  capabilityHash: string;
  capabilityVersion: number;
  ephPubB64: string;
  exp: number;
  singleUse: boolean;
  note: string | null;
}

export interface ICollabInvitesRepository {
  /** Insert a new active invite. Throws `UniqueViolationError` on PK collision. */
  insert(values: ICollabInviteInsertParams, tx?: ITxContext): Promise<void>;
  findOne(userId: string, inviteId: string, tx?: ITxContext): Promise<ICollabInviteRow | null>;
  /**
   * Lookup by inviteId without owner scoping. Used by the claim endpoint where the
   * claimant only knows the invite id, not who minted it.
   */
  findByInviteId(inviteId: string, tx?: ITxContext): Promise<ICollabInviteRow | null>;
  /** Owner's invite list, most-recent first. */
  listByUser(userId: string, tx?: ITxContext): Promise<ICollabInviteRow[]>;
  /** Mark an active invite as revoked. No-op when already non-active. */
  revoke(userId: string, inviteId: string, revokedAt: Date, tx?: ITxContext): Promise<void>;
  /**
   * Mark an active invite as consumed. Returns true if a row was transitioned;
   * false when the invite was already consumed/revoked/expired. The implementation
   * MUST do the read-and-update atomically (`UPDATE ... WHERE status='active'`)
   * so two concurrent claimants of a single-use invite cannot both succeed.
   */
  markConsumed(userId: string, inviteId: string, consumedAt: Date, tx?: ITxContext): Promise<boolean>;
}

export const ICollabInvitesRepository = createIdentifier<ICollabInvitesRepository>('database.collab-invites-repository');
