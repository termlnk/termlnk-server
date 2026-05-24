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
import type { IMultiplayerPluginConfig } from './config.schema';
import { DependentOn, IConfigService, ILogService, Injector, InjectSelf, Plugin, registerDependencies } from '@termlnk-server/core';
import { DatabasePlugin } from '@termlnk-server/database';
import { IMultiplayerAnnouncementsRepository } from '@termlnk-server/database/repositories';
import { createRouter, IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { defaultPluginConfig, MULTIPLAYER_PLUGIN_CONFIG_KEY } from './config.schema';
import { MultiplayerController } from './controllers/multiplayer.controller';
import { AnnouncementService, IAnnouncementService } from './services/announcement.service';
import { ISignalingService, SignalingService } from './services/signaling.service';

export const MULTIPLAYER_PLUGIN_NAME = 'TERMLNK_MULTIPLAYER_PLUGIN';

@DependentOn(RpcServerPlugin, DatabasePlugin)
export class MultiplayerPlugin extends Plugin {
  static override pluginName = MULTIPLAYER_PLUGIN_NAME;

  constructor(
    private readonly _config: IMultiplayerPluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._configService.setConfig(MULTIPLAYER_PLUGIN_CONFIG_KEY, { ...defaultPluginConfig, ...this._config });
  }

  override onStarting(): void {
    const redis = this._config.redis ?? null;
    const freshnessWindowMs = this._config.freshnessWindowMs ?? defaultPluginConfig.freshnessWindowMs;
    const sweepIntervalMs = this._config.sweepIntervalMs ?? defaultPluginConfig.sweepIntervalMs;
    const iceServers = this._config.iceServers ?? defaultPluginConfig.iceServers;
    if (iceServers === defaultPluginConfig.iceServers) {
      // Symmetric-NAT users (≈10–20 % of mobile carriers) have no TURN
      // fallback with the default public-STUN-only list; surface this once
      // at startup so operators notice in production.
      this._logService.warn('[MultiplayerPlugin] using default ICE servers (public STUN only, no TURN). Symmetric-NAT peers will fail to connect; configure `iceServers` for production deployments.');
    }

    const dependencies: Dependency[] = [
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
    const prefix = this._config.routePrefix ?? defaultPluginConfig.routePrefix;
    const router = createRouter();
    this._injector.get(MultiplayerController).registerRoutes(router);
    appService.mount(prefix, router);
    this._logService.log(`[MultiplayerPlugin] mounted at ${prefix}`);
  }

  override dispose(): void {
    try {
      const announcements = this._injector.get(IAnnouncementService);
      announcements.dispose();
    } catch {
      // Service may not have been bound (e.g. plugin construction failed early).
    }
    super.dispose();
  }
}
