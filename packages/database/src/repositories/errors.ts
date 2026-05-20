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

/**
 * Repository-layer error for unique-constraint violations. The PG repository
 * inspects driver error code `23505` and rethrows as this class so services
 * can `instanceof`-check without coupling to the driver.
 */
export class UniqueViolationError extends Error {
  constructor(public readonly table: string, options?: ErrorOptions) {
    super(`unique violation on ${table}`, options);
    this.name = 'UniqueViolationError';
  }
}
