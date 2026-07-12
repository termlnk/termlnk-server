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

import type { Dependency } from '@termlnk-server/core';
import type { ISharedTerminalPluginConfig } from './config.schema';
import { DependentOn, IConfigService, ILogService, Injector, InjectSelf, Plugin, registerDependencies } from '@termlnk-server/core';
import { IHmacService } from '@termlnk-server/crypto';
import { DatabasePlugin } from '@termlnk-server/database';
import { ICollabInvitesRepository, IMultiplayerAnnouncementsRepository } from '@termlnk-server/database/repositories';
import { createRouter, IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { defaultPluginConfig, SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from './config.schema';
import { CollabController } from './controllers/collab.controller';
import { InviteLandingController } from './controllers/invite-landing.controller';
import { MultiplayerController } from './controllers/multiplayer.controller';
import { RelayController } from './controllers/relay.controller';
import { AnnouncementService, IAnnouncementService } from './services/announcement.service';
import { CollabService, ICollabService } from './services/collab.service';
import { IRelayClaimTokenService, RelayClaimTokenService } from './services/relay-claim-token.service';
import { IRelayService, RelayService } from './services/relay.service';
import { ISignalingService, SignalingService } from './services/signaling.service';

export const SHARED_TERMINAL_PLUGIN_NAME = 'TERMLNK_SHARED_TERMINAL_PLUGIN';

/**
 * The shared-session domain plugin. One plugin owns the whole "share a terminal
 * session" feature across its three planes — they all key off the same
 * `sessionId` and evolve together:
 *   - relay      : PTY frame fan-out over WS (`/v1/shared-terminal/`)
 *   - collab     : invite admission + relay-claim token minting (`/v1/collab`, `/s`)
 *   - multiplayer: same-account device announce + WebRTC signalling (`/v1/multiplayer`)
 *
 * Each plane keeps its own route prefix so the wire contract shared with the
 * desktop client stays unchanged; merging is at the package/plugin level only.
 */
@DependentOn(RpcServerPlugin, DatabasePlugin)
export class SharedTerminalPlugin extends Plugin {
  static override pluginName = SHARED_TERMINAL_PLUGIN_NAME;

  constructor(
    private readonly _config: ISharedTerminalPluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._configService.setConfig(SHARED_TERMINAL_PLUGIN_CONFIG_KEY, { ...defaultPluginConfig, ...this._config });
  }

  override onStarting(): void {
    const redis = this._config.redis ?? null;

    // The relay-claim HMAC secret. The app wires this from JWT_ACCESS_SECRET —
    // they share an HMAC key by design (see config.schema notes). When absent
    // (e.g. embedded tests) cross-account collab is disabled but same-account
    // flows still work.
    const secret = this._config.relayClaimTokenSecret ?? '';
    // Derive every defaulted field with `?? default` rather than reading a
    // `{ ...default, ...this._config }` spread: spread lets an explicit
    // `undefined`/`null` from the caller override the default, which would feed
    // NaN ttl / missing ICE servers into the services below.
    const ttlMs = this._config.relayClaimTokenTtlMs ?? defaultPluginConfig.relayClaimTokenTtlMs;
    const freshnessWindowMs = this._config.freshnessWindowMs ?? defaultPluginConfig.freshnessWindowMs;
    const sweepIntervalMs = this._config.sweepIntervalMs ?? defaultPluginConfig.sweepIntervalMs;
    const iceServers = this._config.iceServers ?? defaultPluginConfig.iceServers;

    if (iceServers === defaultPluginConfig.iceServers) {
      // Symmetric-NAT users (~10–20% of mobile carriers) have no TURN fallback
      // with the default public-STUN-only list; surface this once at startup so
      // operators notice in production.
      this._logService.warn('[SharedTerminalPlugin] using default ICE servers (public STUN only, no TURN). Symmetric-NAT peers will fail to connect; configure `iceServers` for production deployments.');
    }

    const dependencies: Dependency[] = [
      // -- relay (data plane)
      [IRelayService, { useFactory: () => new RelayService(redis) }],
      [RelayController],

      // -- collab (admission plane)
      [IRelayClaimTokenService, {
        useFactory: (i: Injector) => new RelayClaimTokenService(i.get(IHmacService), secret, ttlMs),
        deps: [Injector],
      }],
      [ICollabService, {
        useFactory: (i: Injector) => new CollabService(
          i.get(ICollabInvitesRepository),
          // No secret → no cross-account support and anonymous claims are
          // rejected with 503; same-account signed-in claim still works
          // because the joiner's own JWT routes into the owner's bucket.
          secret ? i.get(IRelayClaimTokenService) : null,
          ttlMs
        ),
        deps: [Injector],
      }],
      [CollabController],

      // -- multiplayer (presence + signalling plane)
      [IAnnouncementService, {
        useFactory: (i: Injector) => new AnnouncementService(
          i.get(IMultiplayerAnnouncementsRepository),
          i.get(ILogService),
          freshnessWindowMs,
          sweepIntervalMs,
          redis
        ),
        deps: [Injector],
      }],
      [ISignalingService, {
        useFactory: (i: Injector) => new SignalingService(i.get(ILogService), redis, iceServers),
        deps: [Injector],
      }],
      [MultiplayerController],
    ];
    registerDependencies(this._injector, dependencies);
  }

  override onReady(): void {
    const appService = this._injector.get(IAppService);

    // relay WS → /v1/shared-terminal
    const relayRouter = createRouter();
    this._injector.get(RelayController).registerRoutes(relayRouter);
    appService.mount(this._config.routePrefix ?? defaultPluginConfig.routePrefix, relayRouter);

    // collab invite REST → /v1/collab
    const collabRouter = createRouter();
    this._injector.get(CollabController).registerRoutes(collabRouter);
    appService.mount(this._config.collabRoutePrefix ?? defaultPluginConfig.collabRoutePrefix, collabRouter);

    // Browser-facing invite landing at the app root (outside any /v1 prefix and
    // outside collab's bearer auth): the URL is shared with humans and only
    // needs the inviteId to render the deep-link bridge.
    const downloadUrl = this._config.downloadUrl ?? defaultPluginConfig.downloadUrl;
    const landingPath = this._config.landingPath ?? defaultPluginConfig.landingPath;
    const landing = new InviteLandingController({ downloadUrl });
    appService.get(`${landingPath}/:inviteId`, (c) => landing.render(c.req.param('inviteId') ?? ''));

    // multiplayer announce REST + signal WS → /v1/multiplayer
    const multiplayerRouter = createRouter();
    this._injector.get(MultiplayerController).registerRoutes(multiplayerRouter);
    appService.mount(this._config.multiplayerRoutePrefix ?? defaultPluginConfig.multiplayerRoutePrefix, multiplayerRouter);

    this._logService.log(
      `[SharedTerminalPlugin] mounted relay=${this._config.routePrefix ?? defaultPluginConfig.routePrefix} `
      + `collab=${this._config.collabRoutePrefix ?? defaultPluginConfig.collabRoutePrefix} `
      + `landing=${landingPath}/:inviteId `
      + `multiplayer=${this._config.multiplayerRoutePrefix ?? defaultPluginConfig.multiplayerRoutePrefix}`
    );
  }

  override dispose(): void {
    try {
      // AnnouncementService owns a sweep timer + Redis subscription that must be
      // torn down explicitly.
      this._injector.get(IAnnouncementService).dispose();
    } catch {
      // Service may not have been bound (e.g. plugin construction failed early).
    }
    super.dispose();
  }
}
