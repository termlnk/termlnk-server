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
import type { ISyncPluginConfig } from './config.schema';
import { DependentOn, IConfigService, ILogService, Injector, InjectSelf, merge, Plugin, registerDependencies } from '@termlnk-server/core';
import { DatabasePlugin, IDBAdaptorService } from '@termlnk-server/database';
import {
  ISyncClientsRepository,
  ISyncGlobalVersionRepository,
  ISyncObjectsRepository,
} from '@termlnk-server/database/repositories';
import { createRouter, IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { ISyncBroadcaster } from '@termlnk-server/sync-broadcast';
import { defaultPluginConfig, SYNC_PLUGIN_CONFIG_KEY } from './config.schema';
import { SyncController } from './controllers/sync.controller';
import { ISyncService, SyncService } from './services/sync.service';

export const SYNC_PLUGIN_NAME = 'TERMLNK_SYNC_PLUGIN';

@DependentOn(RpcServerPlugin, DatabasePlugin)
export class SyncPlugin extends Plugin {
  static override pluginName = SYNC_PLUGIN_NAME;

  constructor(
    private readonly _config: ISyncPluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._configService.setConfig(SYNC_PLUGIN_CONFIG_KEY, merge({}, defaultPluginConfig, this._config));
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [ISyncService, {
        useFactory: (i: Injector) => new SyncService(
          i.get(IDBAdaptorService),
          i.get(ISyncGlobalVersionRepository),
          i.get(ISyncClientsRepository),
          i.get(ISyncObjectsRepository),
          i.get(ISyncBroadcaster)
        ),
        deps: [Injector],
      }],
      [SyncController],
    ];
    registerDependencies(this._injector, dependencies);
  }

  override onReady(): void {
    const appService = this._injector.get(IAppService);
    const prefix = this._config.routePrefix ?? defaultPluginConfig.routePrefix!;
    const router = createRouter();
    this._injector.get(SyncController).registerRoutes(router);
    appService.mount(prefix, router);
    this._logService.log(`[SyncPlugin] mounted at ${prefix}`);
  }
}
