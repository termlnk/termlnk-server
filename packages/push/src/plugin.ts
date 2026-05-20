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
import type { IPushPluginConfig } from './config.schema';
import { DependentOn, IConfigService, ILogService, Injector, InjectSelf, Plugin, registerDependencies } from '@termlnk-server/core';
import { DatabasePlugin, IDBAdaptorService } from '@termlnk-server/database';
import { IPushTokensRepository } from '@termlnk-server/database/repositories';
import { createRouter, IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { defaultPluginConfig, PUSH_PLUGIN_CONFIG_KEY } from './config.schema';
import { PushController } from './controllers/push.controller';
import { IPushService, PushService } from './services/push.service';

export const PUSH_PLUGIN_NAME = 'TERMLNK_PUSH_PLUGIN';

@DependentOn(RpcServerPlugin, DatabasePlugin)
export class PushPlugin extends Plugin {
  static override pluginName = PUSH_PLUGIN_NAME;

  constructor(
    private readonly _config: IPushPluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._configService.setConfig(PUSH_PLUGIN_CONFIG_KEY, { ...defaultPluginConfig, ...this._config });
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IPushService, {
        useFactory: (i: Injector) => new PushService(i.get(IDBAdaptorService), i.get(IPushTokensRepository)),
        deps: [Injector],
      }],
      [PushController],
    ];
    registerDependencies(this._injector, dependencies);
  }

  override onReady(): void {
    const appService = this._injector.get(IAppService);
    const prefix = this._config.routePrefix ?? defaultPluginConfig.routePrefix;
    const router = createRouter();
    this._injector.get(PushController).registerRoutes(router);
    appService.mount(prefix, router);
    this._logService.log(`[PushPlugin] mounted at ${prefix}`);
  }
}
