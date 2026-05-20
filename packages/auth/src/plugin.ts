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
import type { IAuthPluginConfig } from './config.schema';
import { DependentOn, IConfigService, ILogService, Injector, InjectSelf, Plugin, registerDependencies } from '@termlnk-server/core';
import { IHmacService, IJwtService, ISrpService } from '@termlnk-server/crypto';
import { DatabasePlugin, IDBAdaptorService } from '@termlnk-server/database';
import {
  IRefreshTokensRepository,
  ISrpCredentialsRepository,
  IUsersRepository,
} from '@termlnk-server/database/repositories';
import { IKVStore } from '@termlnk-server/kv';
import { authRateLimit, createRouter, IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { AUTH_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './config.schema';
import { AuthController } from './controllers/auth.controller';
import { AuthService, IAuthService } from './services/auth.service';
import { ISrpSessionService, SrpSessionService } from './services/srp-session.service';

export const AUTH_PLUGIN_NAME = 'TERMLNK_AUTH_PLUGIN';

@DependentOn(RpcServerPlugin, DatabasePlugin)
export class AuthPlugin extends Plugin {
  static override pluginName = AUTH_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    if (!this._config) {
      throw new Error('[AuthPlugin] config is required');
    }
    this._configService.setConfig(AUTH_PLUGIN_CONFIG_KEY, { ...defaultPluginConfig, ...this._config });
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [ISrpSessionService, {
        useFactory: (i: Injector) => new SrpSessionService(i.get(ISrpService), i.get(IKVStore)),
        deps: [Injector],
      }],
      [IAuthService, {
        useFactory: (i: Injector) => new AuthService(
          i.get(IDBAdaptorService),
          i.get(IUsersRepository),
          i.get(IRefreshTokensRepository),
          i.get(ISrpCredentialsRepository),
          i.get(IJwtService),
          i.get(IHmacService),
          {
            allowOpenRegistration: this._config.allowOpenRegistration,
            requireEmailVerification: this._config.requireEmailVerification,
          }
        ),
        deps: [Injector],
      }],
      [AuthController],
    ];
    registerDependencies(this._injector, dependencies);
  }

  override onReady(): void {
    const appService = this._injector.get(IAppService);
    const prefix = this._config.routePrefix ?? defaultPluginConfig.routePrefix;
    if (this._config.rateLimit ?? defaultPluginConfig.rateLimit) {
      appService.use(`${prefix}/*`, authRateLimit);
    }
    const router = createRouter();
    this._injector.get(AuthController).registerRoutes(router);
    appService.mount(prefix, router);
    this._logService.log(`[AuthPlugin] mounted at ${prefix}`);
  }
}
