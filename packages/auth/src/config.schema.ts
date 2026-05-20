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

export interface IAuthPluginConfig {
  allowOpenRegistration: boolean;
  requireEmailVerification: boolean;
  /** API prefix at which the auth router is mounted; default `/v1/auth` */
  routePrefix?: string;
  /** Apply the default `authRateLimit` middleware to /v1/auth/*; default true */
  rateLimit?: boolean;
}

export const AUTH_PLUGIN_CONFIG_KEY = 'auth';

export const defaultPluginConfig: Required<Omit<IAuthPluginConfig, 'allowOpenRegistration' | 'requireEmailVerification'>> = {
  routePrefix: '/v1/auth',
  rateLimit: true,
};
