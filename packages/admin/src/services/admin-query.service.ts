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

import type { IPokeEnvelope } from '@termlnk-server/sync-broadcast';
import { createIdentifier, Optional } from '@termlnk-server/core';
import { IDBAdaptorService } from '@termlnk-server/database';
import { oauthIdentities, refreshTokens, syncClients, syncObjects, users } from '@termlnk-server/database/entities';
import { pgExec } from '@termlnk-server/database/helpers';
import { IRefreshTokensRepository, ISrpCredentialsRepository, ISyncGlobalVersionRepository, ISyncObjectsRepository, IUsersRepository } from '@termlnk-server/database/repositories';
import { ISyncBroadcaster } from '@termlnk-server/sync-broadcast';
import { and, count, countDistinct, eq, gt, ilike, isNull, or } from 'drizzle-orm';
import { z } from 'zod';

export const SYNC_RESOURCES = [
  'host',
  'config',
  'ai_provider',
  'mcp_server',
  'skill',
  'snippet',
  'ssh_key',
  'identity',
  'known_host',
  'port_forwarding_rule',
] as const;
export const syncResourceIdSchema = z.enum(SYNC_RESOURCES);
export type SyncResourceId = (typeof SYNC_RESOURCES)[number];

export interface IStatsOverview {
  totalUsers: number;
  activeUsers30d: number;
  newUsers7d: number;
  totalDevices: number;
  totalOAuthIdentities: number;
}

export interface IUserListItem {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IPaginatedUsers {
  users: IUserListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface IUserDetail {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasEncryptionPassword: boolean;
}

export interface IDeviceItem {
  jti: string;
  deviceName: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface IOAuthIdentityItem {
  id: string;
  provider: string;
  providerUserId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ISyncResourceCount {
  resource: string;
  count: number;
}

export interface ISyncStats {
  totalSyncObjects: number;
  totalSyncClients: number;
  perResource: ISyncResourceCount[];
}

export interface ISyncClientItem {
  clientId: string;
  lastSeenAt: string;
}

export interface IUserSyncStats {
  perResource: ISyncResourceCount[];
  syncClients: ISyncClientItem[];
  totalSyncObjects: number;
}

export interface IClearUserSyncResourceResult {
  resource: SyncResourceId;
  deleted: number;
  cursor: string;
}

export interface IAdminQueryService {
  getStatsOverview(): Promise<IStatsOverview>;
  getSyncStats(): Promise<ISyncStats>;
  listUsers(page: number, limit: number, query?: string): Promise<IPaginatedUsers>;
  getUserDetail(userId: string): Promise<IUserDetail | null>;
  getUserSyncStats(userId: string): Promise<IUserSyncStats>;
  getUserDevices(userId: string): Promise<IDeviceItem[]>;
  getUserOAuthIdentities(userId: string): Promise<IOAuthIdentityItem[]>;
  revokeDevice(userId: string, jti: string): Promise<void>;
  revokeAllDevices(userId: string): Promise<void>;
  setUserActive(userId: string, isActive: boolean): Promise<void>;
  clearUserSyncResource(userId: string, resource: SyncResourceId): Promise<IClearUserSyncResourceResult>;
}

export const IAdminQueryService = createIdentifier<IAdminQueryService>('admin.query-service');

export class AdminQueryService implements IAdminQueryService {
  constructor(
    @IDBAdaptorService private readonly _db: IDBAdaptorService,
    @IRefreshTokensRepository private readonly _refreshTokens: IRefreshTokensRepository,
    @ISrpCredentialsRepository private readonly _srpCredentials: ISrpCredentialsRepository,
    @IUsersRepository private readonly _users: IUsersRepository,
    @ISyncGlobalVersionRepository private readonly _versions: ISyncGlobalVersionRepository,
    @ISyncObjectsRepository private readonly _objects: ISyncObjectsRepository,
    @Optional(ISyncBroadcaster) private readonly _broadcaster?: ISyncBroadcaster
  ) {}

  async getStatsOverview(): Promise<IStatsOverview> {
    const db = pgExec(this._db);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [[totalUsersRow], [activeRow], [newRow], [devicesRow], [oauthRow]] = await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: countDistinct(refreshTokens.userId) }).from(refreshTokens).where(
        and(gt(refreshTokens.lastSeenAt, thirtyDaysAgo), gt(refreshTokens.expiresAt, now))
      ),
      db.select({ value: count() }).from(users).where(gt(users.createdAt, sevenDaysAgo)),
      db.select({ value: count() }).from(refreshTokens).where(
        and(gt(refreshTokens.expiresAt, now), isNull(refreshTokens.revokedAt))
      ),
      db.select({ value: count() }).from(oauthIdentities),
    ]);

    return {
      totalUsers: totalUsersRow?.value ?? 0,
      activeUsers30d: activeRow?.value ?? 0,
      newUsers7d: newRow?.value ?? 0,
      totalDevices: devicesRow?.value ?? 0,
      totalOAuthIdentities: oauthRow?.value ?? 0,
    };
  }

  async listUsers(page: number, limit: number, query?: string): Promise<IPaginatedUsers> {
    const db = pgExec(this._db);
    const offset = (page - 1) * limit;

    const where = query
      ? or(
        ilike(users.email, `%${escapeLike(query)}%`),
        ilike(users.displayName, `%${escapeLike(query)}%`)
      )
      : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db.select().from(users).where(where).orderBy(users.createdAt).offset(offset).limit(limit),
      db.select({ value: count() }).from(users).where(where),
    ]);

    return {
      users: rows.map((r) => ({
        id: r.id,
        email: r.email,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        emailVerified: r.emailVerified,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      total: totalRow?.value ?? 0,
      page,
      limit,
    };
  }

  async getUserDetail(userId: string): Promise<IUserDetail | null> {
    const db = pgExec(this._db);
    const [rows, srpCred] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      this._srpCredentials.findByUserId(userId),
    ]);
    const user = rows[0];
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      hasEncryptionPassword: srpCred !== null,
    };
  }

  async getUserDevices(userId: string): Promise<IDeviceItem[]> {
    const now = new Date();
    const rows = await this._refreshTokens.listActiveByUserId(userId, now);
    return rows.map((r) => ({
      jti: r.jti,
      deviceName: r.deviceName,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    }));
  }

  async getUserOAuthIdentities(userId: string): Promise<IOAuthIdentityItem[]> {
    const db = pgExec(this._db);
    const rows = await db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, userId));
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      providerUserId: r.providerUserId,
      email: r.email,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async revokeDevice(userId: string, jti: string): Promise<void> {
    await this._refreshTokens.revokeOneByUserId(userId, jti, new Date());
  }

  async revokeAllDevices(userId: string): Promise<void> {
    await this._refreshTokens.revokeAllByUserId(userId, new Date());
  }

  async getSyncStats(): Promise<ISyncStats> {
    const db = pgExec(this._db);
    const [perResourceRows, [clientsRow]] = await Promise.all([
      db.select({ resource: syncObjects.resource, value: count() })
        .from(syncObjects)
        .where(eq(syncObjects.deleted, false))
        .groupBy(syncObjects.resource),
      db.select({ value: countDistinct(syncClients.clientId) }).from(syncClients),
    ]);

    const perResource = perResourceRows.map((r) => ({ resource: r.resource, count: r.value }));
    const totalSyncObjects = perResource.reduce((sum, r) => sum + r.count, 0);

    return {
      totalSyncObjects,
      totalSyncClients: clientsRow?.value ?? 0,
      perResource,
    };
  }

  async getUserSyncStats(userId: string): Promise<IUserSyncStats> {
    const db = pgExec(this._db);
    const [perResourceRows, clientRows] = await Promise.all([
      db.select({ resource: syncObjects.resource, value: count() })
        .from(syncObjects)
        .where(and(eq(syncObjects.userId, userId), eq(syncObjects.deleted, false)))
        .groupBy(syncObjects.resource),
      db.select({ clientId: syncClients.clientId, lastSeenAt: syncClients.lastSeenAt })
        .from(syncClients)
        .where(eq(syncClients.userId, userId)),
    ]);

    const perResource = perResourceRows.map((r) => ({ resource: r.resource, count: r.value }));

    return {
      perResource,
      syncClients: clientRows.map((r) => ({
        clientId: r.clientId,
        lastSeenAt: r.lastSeenAt.toISOString(),
      })),
      totalSyncObjects: perResource.reduce((sum, r) => sum + r.count, 0),
    };
  }

  async setUserActive(userId: string, isActive: boolean): Promise<void> {
    await this._users.setActive(userId, isActive);
    if (!isActive) {
      await this._refreshTokens.revokeAllByUserId(userId, new Date());
    }
  }

  async clearUserSyncResource(userId: string, resource: SyncResourceId): Promise<IClearUserSyncResourceResult> {
    const result = await this._db.transaction(async (tx) => {
      await this._versions.ensureExists(userId, tx);
      let currentVersion = await this._versions.findCurrentForUpdate(userId, tx);
      const rows = await this._objects.listActiveByResource(userId, resource, tx);
      const updatedAt = new Date();

      for (const row of rows) {
        currentVersion += 1;
        await this._objects.update({
          userId,
          resource,
          entityId: row.entityId,
          payload: null,
          version: currentVersion,
          deleted: true,
          updatedAt,
        }, tx);
      }

      if (rows.length > 0) {
        await this._versions.update(userId, currentVersion, tx);
      }

      return {
        resource,
        deleted: rows.length,
        cursor: String(currentVersion),
      };
    });

    if (result.deleted > 0) {
      const envelope: IPokeEnvelope<SyncResourceId> = {
        resource,
        cursor: result.cursor,
        originClientId: 'admin:sync-resource-clear',
      };
      void this._broadcaster?.publish<SyncResourceId>(userId, envelope).catch(() => undefined);
    }

    return result;
  }
}

function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

export function parseSyncResource(resource: string): SyncResourceId | null {
  const parsed = syncResourceIdSchema.safeParse(resource);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}
