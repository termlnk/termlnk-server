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

import type { Dependency, Injector } from '@termlnk-server/core';
import type { ISharedTerminalPluginConfig } from './config.schema';
import { DependentOn, IConfigService, ILogService, InjectSelf, Plugin, registerDependencies } from '@termlnk-server/core';
import { createRouter, IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { defaultPluginConfig, SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from './config.schema';
import { SharedTerminalController } from './controllers/shared-terminal.controller';
import { IRelayService, RelayService } from './services/relay.service';

export const SHARED_TERMINAL_PLUGIN_NAME = 'TERMLNK_SHARED_TERMINAL_PLUGIN';

@DependentOn(RpcServerPlugin)
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
    const dependencies: Dependency[] = [
      [IRelayService, { useFactory: () => new RelayService(redis) }],
      [SharedTerminalController],
    ];
    registerDependencies(this._injector, dependencies);
  }

  override onReady(): void {
    const appService = this._injector.get(IAppService);
    const prefix = this._config.routePrefix ?? defaultPluginConfig.routePrefix;
    const router = createRouter();
    this._injector.get(SharedTerminalController).registerRoutes(router);
    appService.mount(prefix, router);
    this._logService.log(`[SharedTerminalPlugin] mounted at ${prefix}`);
  }
}
