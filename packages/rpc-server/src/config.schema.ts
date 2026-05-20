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

import type { MiddlewareHandler } from 'hono';

export const RPC_SERVER_PLUGIN_CONFIG_KEY = 'rpc-server';

export interface IRpcServerConfig {
  corsOrigins?: string[];
  /** logger middleware factory — runtime-specific (pino on Node, console on Edge) */
  loggerMiddleware?: () => MiddlewareHandler;
  /** OpenAPI document metadata */
  openapi?: {
    title: string;
    version: string;
    description?: string;
    /** Where the spec is served; default `/openapi.json` */
    specPath?: string;
    /** Where the Scalar UI is served; default `/docs` */
    docsPath?: string;
  };
}

export const defaultPluginConfig: IRpcServerConfig = {
  corsOrigins: ['*'],
};

/**
 * Runtime contract: the entrypoint (apps/server) supplies a logger middleware
 * factory — typically `pinoLogger` from this package.
 */
export type LoggerMiddlewareFactory = () => MiddlewareHandler;
