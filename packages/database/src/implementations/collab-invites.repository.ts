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
  ICollabInviteInsertParams,
  ICollabInviteRow,
  ICollabInvitesRepository,
} from '../repositories/collab-invites.repository';
import type { IDBAdaptorService, ITxContext } from '../services/db-adaptor.service';
import { and, desc, eq } from 'drizzle-orm';
import { collabInvites } from '../entities';
import { UniqueViolationError } from '../repositories/errors';
import { isPgUniqueViolation, pgExec } from './_helpers';

export class PgCollabInvitesRepository implements ICollabInvitesRepository {
  constructor(private readonly _adaptor: IDBAdaptorService) {}

  async insert(values: ICollabInviteInsertParams, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    try {
      await db.insert(collabInvites).values({
        userId: values.userId,
        inviteId: values.inviteId,
        sessionId: values.sessionId,
        role: values.role,
        capabilityHash: values.capabilityHash,
        capabilityVersion: values.capabilityVersion,
        ephPubB64: values.ephPubB64,
        exp: values.exp,
        singleUse: values.singleUse,
        status: 'active',
        note: values.note,
      });
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        throw new UniqueViolationError('collab_invites', { cause: err });
      }
      throw err;
    }
  }

  async findOne(userId: string, inviteId: string, tx?: ITxContext): Promise<ICollabInviteRow | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .select()
      .from(collabInvites)
      .where(and(eq(collabInvites.userId, userId), eq(collabInvites.inviteId, inviteId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByInviteId(inviteId: string, tx?: ITxContext): Promise<ICollabInviteRow | null> {
    const db = pgExec(this._adaptor, tx);
    const rows = await db
      .select()
      .from(collabInvites)
      .where(eq(collabInvites.inviteId, inviteId))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByUser(userId: string, tx?: ITxContext): Promise<ICollabInviteRow[]> {
    const db = pgExec(this._adaptor, tx);
    return db
      .select()
      .from(collabInvites)
      .where(eq(collabInvites.userId, userId))
      .orderBy(desc(collabInvites.createdAt));
  }

  async revoke(userId: string, inviteId: string, revokedAt: Date, tx?: ITxContext): Promise<void> {
    const db = pgExec(this._adaptor, tx);
    await db
      .update(collabInvites)
      .set({ status: 'revoked', revokedAt })
      .where(and(
        eq(collabInvites.userId, userId),
        eq(collabInvites.inviteId, inviteId),
        eq(collabInvites.status, 'active')
      ));
  }

  async markConsumed(userId: string, inviteId: string, consumedAt: Date, tx?: ITxContext): Promise<boolean> {
    const db = pgExec(this._adaptor, tx);
    // Atomic guard: only flip to consumed when still 'active' so concurrent claimants
    // on a single-use invite see exactly one winner.
    const rows = await db
      .update(collabInvites)
      .set({ status: 'consumed', consumedAt })
      .where(and(
        eq(collabInvites.userId, userId),
        eq(collabInvites.inviteId, inviteId),
        eq(collabInvites.status, 'active')
      ))
      .returning({ inviteId: collabInvites.inviteId });
    return rows.length > 0;
  }
}
