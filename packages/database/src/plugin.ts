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
import type { IDatabaseConfig } from './config.schema';
import { IConfigService, ILogService, InjectSelf, merge, Plugin, registerDependencies } from '@termlnk-server/core';
import { DATABASE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './config.schema';
import { PgCollabInvitesRepository, PgMultiplayerAnnouncementsRepository, PgOAuthIdentitiesRepository, PgPushTokensRepository, PgRefreshTokensRepository, PgSrpCredentialsRepository, PgSyncClientsRepository, PgSyncGlobalVersionRepository, PgSyncObjectsRepository, PgUsersRepository } from './implementations';
import { ICollabInvitesRepository, IMultiplayerAnnouncementsRepository, IOAuthIdentitiesRepository, IPushTokensRepository, IRefreshTokensRepository, ISrpCredentialsRepository, ISyncClientsRepository, ISyncGlobalVersionRepository, ISyncObjectsRepository, IUsersRepository } from './repositories';
import { IDBAdaptorService } from './services/db-adaptor.service';

export const DATABASE_PLUGIN_NAME = 'DATABASE_PLUGIN';

export class DatabasePlugin extends Plugin {
  static override pluginName = DATABASE_PLUGIN_NAME;

  constructor(
    private readonly _config: IDatabaseConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    if (!this._config?.dbAdaptor) {
      throw new Error('[DatabasePlugin] dbAdaptor is required');
    }

    this._config = merge({}, defaultPluginConfig, _config);
    this._configService.setConfig(DATABASE_PLUGIN_CONFIG_KEY, this._config);
  }

  override onStarting(): void {
    this._registerDependencies();
  }

  override onReady(): void {
    if (this._config.autoInitialize === false) {
      this._logService.log('[DatabasePlugin] autoInitialize=false, skipping initialize()');
      return;
    }
    this._config.dbAdaptor!.initialize();
  }

  private _registerDependencies(): void {
    const dependencies: Dependency[] = [
      [IDBAdaptorService, { useValue: this._config.dbAdaptor }],
      [IUsersRepository, { useClass: PgUsersRepository }],
      [IRefreshTokensRepository, { useClass: PgRefreshTokensRepository }],
      [ISrpCredentialsRepository, { useClass: PgSrpCredentialsRepository }],
      [IOAuthIdentitiesRepository, { useClass: PgOAuthIdentitiesRepository }],
      [ISyncGlobalVersionRepository, { useClass: PgSyncGlobalVersionRepository }],
      [ISyncClientsRepository, { useClass: PgSyncClientsRepository }],
      [ISyncObjectsRepository, { useClass: PgSyncObjectsRepository }],
      [ICollabInvitesRepository, { useClass: PgCollabInvitesRepository }],
      [IMultiplayerAnnouncementsRepository, { useClass: PgMultiplayerAnnouncementsRepository }],
      [IPushTokensRepository, { useClass: PgPushTokensRepository }],
    ];
    registerDependencies(this._injector, dependencies);
  }
}
