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

export { ADMIN_PLUGIN_CONFIG_KEY } from './config.schema';
export type { IAdminPluginConfig } from './config.schema';
export { ADMIN_PLUGIN_NAME, AdminPlugin } from './plugin';
export { ARGON2_OPTIONS, IAdminAuthService } from './services/admin-auth.service';
export type { IAdminAccount, IAdminLoginResult } from './services/admin-auth.service';
export { IAdminQueryService } from './services/admin-query.service';
export type { IPaginatedUsers, IStatsOverview, IUserDetail } from './services/admin-query.service';
