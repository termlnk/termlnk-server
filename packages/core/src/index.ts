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

export * from './common/array';
export * from './common/async';
export * from './common/di';
export * from './common/error';
export * from './common/lifecycle';
export * from './common/lodash';
export * from './common/nanoid';
export { afterTime, bufferDebounceTime, convertObservableToBehaviorSubject, fromCallback, takeAfter } from './common/rxjs';
export { sequence, sequenceAsync } from './common/sequence';
export type { ISequenceExecuteResult } from './common/sequence';
export { awaitTime } from './common/timer';
export * from './common/types';
export { Core, type ICoreConfig } from './core';
export { EventState, EventSubject, fromEventSubject, type IEventObserver } from './observer/observable';
export { ConfigService, IConfigService } from './services/config/config.service';
export type { IConfigOptions } from './services/config/config.service';
export { ErrorService } from './services/error/error.service';
export type { IError } from './services/error/error.service';
export { LifecycleNameMap, LifecycleStages } from './services/lifecycle/lifecycle';
export { ILifecycleService, LifecycleService, LifecycleUnreachableError } from './services/lifecycle/lifecycle.service';
export { ConsoleLogService, ILogService, LogLevel } from './services/log/log.service';
export { mergeOverrideWithDependencies } from './services/plugin/plugin-override';
export type { DependencyOverride, NullableDependencyPair } from './services/plugin/plugin-override';
export { DependentOn, DependentOnSymbol, Plugin, PluginService, PluginStore, PluginType } from './services/plugin/plugin.service';
export type { PluginCtor } from './services/plugin/plugin.service';
