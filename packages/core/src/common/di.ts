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

import type { Dependency, DependencyIdentifier, Injector } from '@wendellhu/redi';

export * from '@wendellhu/redi';

export function registerDependencies(injector: Injector, dependencies: Dependency[]): void {
  dependencies.forEach((d) => injector.add(d));
}

/**
 * Eagerly instantiate dependencies that may otherwise stay lazy.
 */
export function touchDependencies(injector: Injector, dependencies: [DependencyIdentifier<unknown>][]): void {
  dependencies.forEach(([d]) => {
    if (injector.has(d)) {
      injector.get(d);
    }
  });
}
