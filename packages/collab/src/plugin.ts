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
import type { ICollabPluginConfig } from './config.schema';
import { DependentOn, IConfigService, ILogService, Injector, InjectSelf, Plugin, registerDependencies } from '@termlnk-server/core';
import { DatabasePlugin } from '@termlnk-server/database';
import { ICollabInvitesRepository } from '@termlnk-server/database/repositories';
import { createRouter, IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { COLLAB_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './config.schema';
import { CollabController } from './controllers/collab.controller';
import { InviteLandingController } from './controllers/invite-landing.controller';
import { CollabService, ICollabService } from './services/collab.service';

export const COLLAB_PLUGIN_NAME = 'TERMLNK_COLLAB_PLUGIN';

@DependentOn(RpcServerPlugin, DatabasePlugin)
export class CollabPlugin extends Plugin {
  static override pluginName = COLLAB_PLUGIN_NAME;

  constructor(
    private readonly _config: ICollabPluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._configService.setConfig(COLLAB_PLUGIN_CONFIG_KEY, { ...defaultPluginConfig, ...this._config });
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [ICollabService, {
        useFactory: (i: Injector) => new CollabService(i.get(ICollabInvitesRepository)),
        deps: [Injector],
      }],
      [CollabController],
    ];
    registerDependencies(this._injector, dependencies);
  }

  override onReady(): void {
    const appService = this._injector.get(IAppService);
    const config = { ...defaultPluginConfig, ...this._config };
    const router = createRouter();
    this._injector.get(CollabController).registerRoutes(router);
    appService.mount(config.routePrefix, router);
    this._logService.log(`[CollabPlugin] mounted at ${config.routePrefix}`);

    // The browser-facing landing page is mounted at the app root (outside
    // routePrefix) on purpose: the URL is shared with humans and lives outside
    // the `/v1` API namespace, and it skips collab's bearer-auth middleware
    // since no user identity is required to render the deep-link bridge.
    const landing = new InviteLandingController({ downloadUrl: config.downloadUrl });
    appService.get(`${config.landingPath}/:inviteId`, (c) => landing.render(c.req.param('inviteId') ?? ''));
    this._logService.log(`[CollabPlugin] invite landing mounted at ${config.landingPath}/:inviteId`);
  }
}
