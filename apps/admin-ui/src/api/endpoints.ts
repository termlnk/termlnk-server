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

import { adminFetch } from './client';

export interface IAdminAccount {
  id: string;
  email: string;
  displayName?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface ILoginResponse {
  admin: IAdminAccount;
  token: string;
  expiresAt: number;
}

export interface IStatsOverview {
  totalUsers: number;
  activeUsers30d: number;
  newUsers7d: number;
  totalDevices: number;
  totalOAuthIdentities: number;
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

export interface IUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IUserDetail extends IUser {
  hasEncryptionPassword: boolean;
}

export interface IPaginatedUsers {
  users: IUser[];
  total: number;
  page: number;
  limit: number;
}

export interface IDevice {
  jti: string;
  deviceName: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface IOAuthIdentity {
  id: string;
  provider: string;
  providerUserId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export const api = {
  login: (email: string, password: string) =>
    adminFetch<ILoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => adminFetch<{ admin: IAdminAccount }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    adminFetch<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  statsOverview: () => adminFetch<IStatsOverview>('/stats/overview'),

  syncStats: () => adminFetch<ISyncStats>('/stats/sync'),

  listUsers: (page: number, limit: number, q?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q) params.set('q', q);
    return adminFetch<IPaginatedUsers>(`/users?${params}`);
  },

  getUser: (id: string) => adminFetch<{ user: IUserDetail }>(`/users/${id}`),

  getUserDevices: (id: string) =>
    adminFetch<{ devices: IDevice[] }>(`/users/${id}/devices`),

  revokeDevice: (userId: string, jti: string) =>
    adminFetch<void>(`/users/${userId}/devices/${jti}/revoke`, { method: 'POST' }),

  revokeAllDevices: (userId: string) =>
    adminFetch<void>(`/users/${userId}/revoke-all`, { method: 'POST' }),

  getUserOAuthIdentities: (id: string) =>
    adminFetch<{ identities: IOAuthIdentity[] }>(`/users/${id}/oauth-identities`),

  getUserSyncStats: (id: string) =>
    adminFetch<IUserSyncStats>(`/users/${id}/sync-stats`),

  disableUser: (id: string) =>
    adminFetch<void>(`/users/${id}/disable`, { method: 'POST' }),

  enableUser: (id: string) =>
    adminFetch<void>(`/users/${id}/enable`, { method: 'POST' }),
};
