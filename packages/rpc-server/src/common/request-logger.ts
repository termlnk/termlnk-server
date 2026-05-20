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
 * Minimal logger surface shared by Node (pino) and Edge (console) middlewares.
 *
 * Hono-pino exposes a richer surface (.assign, .reset, etc.); we deliberately
 * narrow it here so plugin code is portable. The Pino middleware adaptor binds
 * `c.var.logger` to a `PinoLogger` instance whose method signatures are a
 * superset of `IRequestLogger`, so the structural typing just works.
 */
export interface IRequestLogger {
  debug(obj: object | string, msg?: string): void;
  info(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
}
