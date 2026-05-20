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

import type { Dependency, IDisposable } from './common/di';
import type { LogLevel } from './services/log/log.service';
import type { DependencyOverride } from './services/plugin/plugin-override';
import type { Plugin, PluginCtor } from './services/plugin/plugin.service';
import { Injector } from './common/di';
import { DisposableCollection, toDisposable } from './common/lifecycle';
import { ConfigService, IConfigService } from './services/config/config.service';
import { ErrorService } from './services/error/error.service';
import { LifecycleStages } from './services/lifecycle/lifecycle';
import { ILifecycleService, LifecycleService } from './services/lifecycle/lifecycle.service';
import { ConsoleLogService, ILogService } from './services/log/log.service';
import { mergeOverrideWithDependencies } from './services/plugin/plugin-override';
import { PluginService } from './services/plugin/plugin.service';

export interface ICoreConfig {
  logLevel?: LogLevel;
  override?: DependencyOverride;
}

/**
 * Server-side runtime root. The desktop client's runtime ships a richer Core with
 * Theme / Locale / Notification / Command / Context / Instance; the HTTP server
 * strips those because it never renders UI nor dispatches user-initiated commands.
 */
export class Core implements IDisposable {
  private readonly _injector: Injector;
  private _disposingCallbacks = new DisposableCollection();

  constructor(config: Partial<ICoreConfig> = {}, parentInjector?: Injector) {
    this._injector = createCoreInjector(parentInjector, config.override);
    const logService = this._injector.get(ILogService);
    if (config.logLevel !== undefined) logService.setLogLevel(config.logLevel);
  }

  private get _pluginService(): PluginService {
    return this._injector.get(PluginService);
  }

  start(): void {
    const lifecycleService = this._injector.get(ILifecycleService);
    if (lifecycleService.getStage() < LifecycleStages.Ready) {
      lifecycleService.setStage(LifecycleStages.Ready);
    }
  }

  ready(): void {
    const lifecycleService = this._injector.get(ILifecycleService);
    if (lifecycleService.getStage() < LifecycleStages.Steady) {
      lifecycleService.setStage(LifecycleStages.Steady);
    }
  }

  getInjector(): Injector {
    return this._injector;
  }

  onDispose(callback: () => void): IDisposable {
    const d = this._disposingCallbacks.add(toDisposable(callback));
    return toDisposable(() => d.dispose(true));
  }

  dispose(): void {
    this._disposingCallbacks.dispose();
    this._injector.dispose();
  }

  registerPlugin<T extends PluginCtor<Plugin>>(plugin: T, config?: ConstructorParameters<T>[0]): void {
    this._pluginService.registerPlugin(plugin, config);
  }

  registerPlugins<
    T extends readonly (
      | readonly [PluginCtor<Plugin>]
      | readonly [PluginCtor<Plugin>, unknown]
    )[]
  >(
    plugins: {
      readonly [K in keyof T]: T[K] extends readonly [infer P]
        ? P extends PluginCtor<Plugin>
          ? readonly [P]
          : T[K]
        : T[K] extends readonly [infer P, unknown]
          ? P extends PluginCtor<Plugin>
            ? readonly [P, ConstructorParameters<P>[0]?]
            : T[K]
          : T[K];
    }
  ): void {
    plugins.forEach((item) => {
      const [plugin, config] = item;
      this._pluginService.registerPlugin(plugin, config);
    });
  }
}

function createCoreInjector(parentInjector?: Injector, override?: DependencyOverride): Injector {
  const dependencies: Dependency[] = mergeOverrideWithDependencies([
    [ErrorService],
    [PluginService],
    [ILifecycleService, { useClass: LifecycleService }],
    [ILogService, { useClass: ConsoleLogService, lazy: true }],
    [IConfigService, { useClass: ConfigService }],
  ], override);

  return parentInjector ? parentInjector.createChild(dependencies) : new Injector(dependencies);
}
