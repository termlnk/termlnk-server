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
import type { IAuthPluginConfig } from './config.schema';
import { DependentOn, IConfigService, ILogService, InjectSelf, merge, Plugin, registerDependencies } from '@termlnk-server/core';
import { DatabasePlugin } from '@termlnk-server/database';
import { authRateLimit, createRouter, IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { AUTH_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './config.schema';
import { AuthController } from './controllers/auth.controller';
import { AuthService, IAuthService } from './services/auth.service';
import { GoogleOAuthService, IGoogleOAuthService } from './services/google-oauth.service';
import { IOAuthFlowStore, OAuthFlowStore } from './services/oauth-flow-store.service';
import { ISrpSessionService, SrpSessionService } from './services/srp-session.service';

export const AUTH_PLUGIN_NAME = 'TERMLNK_AUTH_PLUGIN';

@DependentOn(RpcServerPlugin, DatabasePlugin)
export class AuthPlugin extends Plugin {
  static override pluginName = AUTH_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthPluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(AUTH_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [ISrpSessionService, { useClass: SrpSessionService }],
      [IAuthService, { useClass: AuthService }],
    ];

    const google = this._config.google;
    if (google?.enabled) {
      dependencies.push(
        [IGoogleOAuthService, { useClass: GoogleOAuthService }],
        [IOAuthFlowStore, { useClass: OAuthFlowStore }]
      );
    }

    dependencies.push([AuthController, { useClass: AuthController }]);

    registerDependencies(this._injector, dependencies);
  }

  override onReady(): void {
    const appService = this._injector.get(IAppService);
    const prefix = this._config.routePrefix ?? defaultPluginConfig.routePrefix ?? '/v1/auth';
    if (this._config.rateLimit ?? defaultPluginConfig.rateLimit) {
      appService.use(`${prefix}/*`, authRateLimit);
    }
    const router = createRouter();
    this._injector.get(AuthController).registerRoutes(router);
    appService.mount(prefix, router);
    this._logService.log(`[AuthPlugin] mounted at ${prefix}`);
  }
}
