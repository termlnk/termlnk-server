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

export interface IAdminPluginConfig {
  /** Secret for signing admin JWT tokens (must be >= 32 characters). */
  jwtSecret: string;
  /** Admin access token TTL in seconds; default 3600 (1 hour). */
  jwtTtlSeconds?: number;
  /** Seed admin email — used only when admin_users table is empty. */
  seedEmail?: string;
  /** Seed admin password — used only when admin_users table is empty. */
  seedPassword?: string;
  /** Filesystem path to the built admin SPA (for production static serving). */
  spaDistPath?: string;
  /** API prefix at which the admin API router is mounted; default `/admin/api/v1`. */
  apiPrefix?: string;
}

export const ADMIN_PLUGIN_CONFIG_KEY = 'admin.config';

export const defaultAdminPluginConfig: Partial<IAdminPluginConfig> = {
  jwtTtlSeconds: 3600,
  apiPrefix: '/admin/api/v1',
};
