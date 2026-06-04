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

/**
 * RTCIceServer-compatible config carried over signaling. Both `urls` (single
 * string or array) and the optional TURN credentials match the browser
 * RTCIceServer dictionary 1:1.
 */
export interface IIceServerConfig {
  readonly urls: string | string[];
  readonly username?: string;
  readonly credential?: string;
}

/**
 * Unified config for the shared-session domain: PTY relay (data plane), collab
 * invites (admission), and multiplayer announce + WebRTC signalling. Three
 * surfaces share one plugin and one config key — each keeps its own route
 * prefix so the existing wire paths (`/v1/shared-terminal`, `/v1/collab`,
 * `/v1/multiplayer`, `/s`) stay byte-for-byte compatible with the desktop client.
 */
export interface ISharedTerminalPluginConfig {
  // -- relay (PTY fan-out, WS `/v1/shared-terminal/`)
  /** API prefix where the relay WS endpoint is mounted; default `/v1/shared-terminal`. */
  routePrefix?: string;
  /**
   * ioredis client for cross-instance pub/sub — shared by the relay fan-out,
   * announcement change-events, and signaling envelope routing. null =
   * single-instance only.
   */
  redis?: Redis | null;

  // -- collab (invite create/list/revoke/claim + landing page)
  /** API prefix for collab invite REST endpoints; default `/v1/collab`. */
  collabRoutePrefix?: string;
  /** Invite landing path that wakes up the desktop client deep link; default `/s`. */
  landingPath?: string;
  /** URL the landing page exposes when the desktop client isn't installed yet. */
  downloadUrl?: string;
  /**
   * HMAC secret used to sign the one-shot relay-claim token returned by
   * `/v1/collab/invite/:id/claim`. The app wires this from JWT_ACCESS_SECRET
   * — sharing the key is safe because the two HMACs sign distinct envelope
   * shapes that can't be cross-confused, and a JWT secret leak already implies
   * full session-attach capability anyway. Surfaced as config purely for
   * unit-test substitution.
   */
  relayClaimTokenSecret?: string;
  /** Relay claim token TTL in ms. Default 5 minutes. */
  relayClaimTokenTtlMs?: number;

  // -- multiplayer (same-account device announce + WebRTC signalling)
  /** API prefix for multiplayer REST + signal WS endpoints; default `/v1/multiplayer`. */
  multiplayerRoutePrefix?: string;
  /**
   * Heartbeat freshness window in ms. Announcements whose `last_heartbeat_at`
   * is older than this are considered stale and dropped from GET /sessions.
   * Default 90 s — matches the desktop client's 30 s heartbeat with a 3× margin.
   */
  freshnessWindowMs?: number;
  /** Sweep cadence in ms — interval at which stale announcement rows are deleted. Default 60 s. */
  sweepIntervalMs?: number;
  /**
   * ICE servers handed to WebRTC peers via the signaling `ready` message. When
   * unset the server returns public Google STUN entries so cone-NAT peers can
   * still succeed without operator configuration (symmetric NAT needs TURN).
   */
  iceServers?: IIceServerConfig[];
}

const DEFAULT_ICE_SERVERS: IIceServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const defaultPluginConfig: Required<Pick<
  ISharedTerminalPluginConfig,
  | 'routePrefix'
  | 'collabRoutePrefix'
  | 'landingPath'
  | 'downloadUrl'
  | 'relayClaimTokenTtlMs'
  | 'multiplayerRoutePrefix'
  | 'freshnessWindowMs'
  | 'sweepIntervalMs'
  | 'iceServers'
>> = {
  routePrefix: '/v1/shared-terminal',
  collabRoutePrefix: '/v1/collab',
  landingPath: '/s',
  downloadUrl: 'https://termlnk.com',
  relayClaimTokenTtlMs: 5 * 60 * 1000,
  multiplayerRoutePrefix: '/v1/multiplayer',
  freshnessWindowMs: 90_000,
  sweepIntervalMs: 60_000,
  iceServers: DEFAULT_ICE_SERVERS,
};
