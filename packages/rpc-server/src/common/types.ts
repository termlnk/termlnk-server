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

import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { IRequestLogger } from './request-logger';

/**
 * Per-request auth claims surfaced by `requireAuth`. Public routes leave these
 * undefined; protected routes set all three.
 */
export interface IAuthVariables {
  userId: string;
  email: string;
  /** jti of the refresh token that issued the current access token — used to mark "current device" in the device list */
  currentJti: string;
}

/**
 * Per-request bindings. Empty on Node — env is process-global. Reserved for
 * future use if a non-process runtime ever needs request-scoped env injection.
 */
export interface IAppBindings {}

export interface IAppVariables extends IAuthVariables {
  /** request-id middleware injects a per-request opaque id (also echoed in X-Request-Id) */
  requestId: string;
  /** logger middleware injects a per-request bound logger */
  logger: IRequestLogger;
}

export interface IAppEnv {
  Variables: IAppVariables;
  Bindings: IAppBindings;
}

export type AppOpenAPI = OpenAPIHono<IAppEnv>;

/**
 * Handler signature alias — paired with a `createRoute(...)` config so the request
 * payload, response payload, and path/query/header params all infer from the same
 * Zod schemas. Use as: `export const list: AppRouteHandler<typeof routes.list> = ...`.
 */
export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, IAppEnv>;
