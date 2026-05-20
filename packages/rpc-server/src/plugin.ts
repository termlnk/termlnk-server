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
import type { IRpcServerConfig } from './config.schema';
import { IConfigService, InjectSelf, merge, Plugin, registerDependencies, touchDependencies } from '@termlnk-server/core';
import { defaultPluginConfig, RPC_SERVER_PLUGIN_CONFIG_KEY } from './config.schema';
import { AppService, IAppService } from './services/app.service';

export const RPC_SERVER_PLUGIN_NAME = 'RPC_SERVER_PLUGIN';

export class RpcServerPlugin extends Plugin {
  static override pluginName = RPC_SERVER_PLUGIN_NAME;

  constructor(
    private readonly _config: IRpcServerConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(RPC_SERVER_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const appService = new AppService(this._config);

    const dependencies: Dependency[] = [
      [IAppService, { useValue: appService }],
    ];
    registerDependencies(this._injector, dependencies);
  }

  override onReady() {
    touchDependencies(this._injector, [
      [IAppService],
    ]);
  }
}
