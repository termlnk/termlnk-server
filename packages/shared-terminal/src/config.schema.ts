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

import type Redis from 'ioredis';

export const SHARED_TERMINAL_PLUGIN_CONFIG_KEY = 'shared-terminal';

export interface ISharedTerminalPluginConfig {
  /** API prefix where the WS endpoint is mounted; default `/v1/shared-terminal` */
  routePrefix?: string;
  /** ioredis client for cross-instance pub/sub. null = single-instance only. */
  redis?: Redis | null;
}

export const defaultPluginConfig: Required<Pick<ISharedTerminalPluginConfig, 'routePrefix'>> = {
  routePrefix: '/v1/shared-terminal',
};
