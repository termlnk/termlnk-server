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
import type { IDatabaseConfig } from './config.schema';
import { IConfigService, ILogService, Injector, InjectSelf, merge, Plugin, registerDependencies } from '@termlnk-server/core';
import { DATABASE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './config.schema';
import {
  PgCollabInvitesRepository,
  PgMultiplayerAnnouncementsRepository,
  PgPushTokensRepository,
  PgRefreshTokensRepository,
  PgSrpCredentialsRepository,
  PgSyncClientsRepository,
  PgSyncGlobalVersionRepository,
  PgSyncObjectsRepository,
  PgUsersRepository,
} from './implementations';
import {
  ICollabInvitesRepository,
  IMultiplayerAnnouncementsRepository,
  IPushTokensRepository,
  IRefreshTokensRepository,
  ISrpCredentialsRepository,
  ISyncClientsRepository,
  ISyncGlobalVersionRepository,
  ISyncObjectsRepository,
  IUsersRepository,
} from './repositories';
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
      [IUsersRepository, { useFactory: (i: Injector) => new PgUsersRepository(i.get(IDBAdaptorService)), deps: [Injector] }],
      [IRefreshTokensRepository, { useFactory: (i: Injector) => new PgRefreshTokensRepository(i.get(IDBAdaptorService)), deps: [Injector] }],
      [ISrpCredentialsRepository, { useFactory: (i: Injector) => new PgSrpCredentialsRepository(i.get(IDBAdaptorService)), deps: [Injector] }],
      [ISyncGlobalVersionRepository, { useFactory: (i: Injector) => new PgSyncGlobalVersionRepository(i.get(IDBAdaptorService)), deps: [Injector] }],
      [ISyncClientsRepository, { useFactory: (i: Injector) => new PgSyncClientsRepository(i.get(IDBAdaptorService)), deps: [Injector] }],
      [ISyncObjectsRepository, { useFactory: (i: Injector) => new PgSyncObjectsRepository(i.get(IDBAdaptorService)), deps: [Injector] }],
      [ICollabInvitesRepository, { useFactory: (i: Injector) => new PgCollabInvitesRepository(i.get(IDBAdaptorService)), deps: [Injector] }],
      [IMultiplayerAnnouncementsRepository, { useFactory: (i: Injector) => new PgMultiplayerAnnouncementsRepository(i.get(IDBAdaptorService)), deps: [Injector] }],
      [IPushTokensRepository, { useFactory: (i: Injector) => new PgPushTokensRepository(i.get(IDBAdaptorService)), deps: [Injector] }],
    ];

    registerDependencies(this._injector, dependencies);
  }
}
