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

export const MULTIPLAYER_PLUGIN_CONFIG_KEY = 'multiplayer';

export interface IMultiplayerPluginConfig {
  /** API prefix where REST + WS endpoints are mounted; default `/v1/multiplayer`. */
  routePrefix?: string;
  /**
   * Redis client used for two cross-instance fan-outs:
   *   - announcement.changed events (so peers see new shares without polling)
   *   - signaling envelopes routed across multiple server instances
   * null = single-instance only.
   */
  redis?: Redis | null;
  /**
   * Heartbeat freshness window in ms. Announcements whose `last_heartbeat_at` is older
   * than this are considered stale and dropped from GET /sessions results. Default 90 s
   * — matches the desktop client's 30 s heartbeat with a 3× safety margin.
   */
  freshnessWindowMs?: number;
  /**
   * Sweep cadence in ms — interval at which the plugin deletes stale rows from the DB.
   * Default 60 s.
   */
  sweepIntervalMs?: number;
}

export const defaultPluginConfig: Required<Pick<
  IMultiplayerPluginConfig,
  'routePrefix' | 'freshnessWindowMs' | 'sweepIntervalMs'
>> = {
  routePrefix: '/v1/multiplayer',
  freshnessWindowMs: 90_000,
  sweepIntervalMs: 60_000,
};
