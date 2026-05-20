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
 * @termlnk-server/rpc-server — Hono root app + middleware + DI plugin.
 *
 * Logger middleware is wired by the entrypoint via a subpath import:
 *   import { pinoLogger } from '@termlnk-server/rpc-server/pino-logger';
 */

export type { IRequestLogger } from './common/request-logger';
export type { AppOpenAPI, AppRouteHandler, IAppBindings, IAppEnv, IAppVariables, IAuthVariables } from './common/types';
export { RPC_SERVER_PLUGIN_CONFIG_KEY } from './config.schema';
export type { IRpcServerConfig, LoggerMiddlewareFactory } from './config.schema';
export { authRateLimit, createRateLimiter, type IRateLimitOptions } from './middlewares/rate-limit';
export { requireAuth } from './middlewares/require-auth';
export { createWsBearerAuthMiddleware } from './middlewares/ws-bearer-auth';
export { RPC_SERVER_PLUGIN_NAME, RpcServerPlugin } from './plugin';
export { AppService, createRouter, IAppService } from './services/app.service';
export { HttpError, jsonError } from './utils/http-error';
