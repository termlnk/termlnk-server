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
import type { IAdminPluginConfig } from './config.schema';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { DependentOn, IConfigService, ILogService, InjectSelf, merge, Plugin, registerDependencies } from '@termlnk-server/core';
import { DatabasePlugin } from '@termlnk-server/database';
import { createRouter, IAppService, RpcServerPlugin } from '@termlnk-server/rpc-server';
import { ADMIN_PLUGIN_CONFIG_KEY, defaultAdminPluginConfig } from './config.schema';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminStatsController } from './controllers/admin-stats.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { IAdminUsersRepository, PgAdminUsersRepository } from './repositories/admin-users.repository';
import { AdminAuthService, IAdminAuthService } from './services/admin-auth.service';
import { AdminQueryService, IAdminQueryService } from './services/admin-query.service';

export const ADMIN_PLUGIN_NAME = 'TERMLNK_ADMIN_PLUGIN';

@DependentOn(RpcServerPlugin, DatabasePlugin)
export class AdminPlugin extends Plugin {
  static override pluginName = ADMIN_PLUGIN_NAME;

  constructor(
    private readonly _config: IAdminPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    const config = merge({}, defaultAdminPluginConfig, this._config);
    this._configService.setConfig(ADMIN_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IAdminUsersRepository, { useClass: PgAdminUsersRepository }],
      [IAdminAuthService, { useClass: AdminAuthService }],
      [IAdminQueryService, { useClass: AdminQueryService }],
      [AdminAuthController, { useClass: AdminAuthController }],
      [AdminStatsController, { useClass: AdminStatsController }],
      [AdminUsersController, { useClass: AdminUsersController }],
    ];

    registerDependencies(this._injector, dependencies);
  }

  override onReady(): void {
    const config = this._configService.getConfig<IAdminPluginConfig>(ADMIN_PLUGIN_CONFIG_KEY)!;
    const appService = this._injector.get(IAppService);
    const prefix = config.apiPrefix ?? '/admin/api/v1';

    const router = createRouter();
    this._injector.get(AdminAuthController).registerRoutes(router);
    this._injector.get(AdminStatsController).registerRoutes(router);
    this._injector.get(AdminUsersController).registerRoutes(router);
    appService.mount(prefix, router);

    this._logService.log(`[AdminPlugin] API mounted at ${prefix}`);

    if (config.spaDistPath) {
      this._mountSpa(appService, config.spaDistPath);
    }

    void this._injector.get(IAdminAuthService).seedIfEmpty().catch((err) => {
      this._logService.log(`[AdminPlugin] seed admin failed: ${err instanceof Error ? err.message : err}`);
    });
  }

  private _mountSpa(appService: IAppService, distPath: string): void {
    appService.app.use(
      '/admin/*',
      serveStatic({ root: distPath, rewriteRequestPath: (p: string) => p.replace(/^\/admin/, '') })
    );

    const indexHtml = join(distPath, 'index.html');
    const cachedHtml = existsSync(indexHtml) ? readFileSync(indexHtml, 'utf-8') : null;

    appService.app.get('/admin/*', (c) => {
      if (cachedHtml) {
        return c.html(cachedHtml);
      }
      return c.text('Admin UI not found', 404);
    });

    this._logService.log(`[AdminPlugin] SPA served from ${distPath}`);
  }
}
