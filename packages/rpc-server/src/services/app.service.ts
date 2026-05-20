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
import type { AppOpenAPI, IAppEnv } from '../common/types';
import type { IRpcServerConfig } from '../config.schema';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { createIdentifier } from '@termlnk-server/core';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { HttpError, jsonError } from '../utils/http-error';

interface IZodErrorIssue { path: PropertyKey[]; message: string }

function rejectInvalidRequest(issues: readonly IZodErrorIssue[]): never {
  const first = issues[0];
  const path = first ? first.path.map(stringifyKey).join('.') : '';
  const message = first ? `${path || 'body'}: ${first.message}` : 'invalid request';
  throw new HttpError(400, 'invalid_request', message, issues.map((i) => ({
    path: i.path.map(stringifyKey),
    message: i.message,
  })));
}

function stringifyKey(p: PropertyKey): string | number {
  return typeof p === 'symbol' ? p.toString() : p;
}

/**
 * Plain feature router. Subroutes are mounted on the root app via
 * `IAppService.mount(prefix, router)`. The shared `defaultHook` funnels Zod
 * validator failures through our HttpError envelope so the wire format stays
 * consistent regardless of which validator failed.
 */
export function createRouter(): AppOpenAPI {
  return new OpenAPIHono<IAppEnv>({
    defaultHook: (result) => {
      if (!result.success) {
        rejectInvalidRequest(result.error.issues);
      }
    },
  });
}

/**
 * The root HTTP surface, scoped behind a DI identifier so feature plugins can
 * `mount(prefix, router)` instead of import-cycling each other.
 *
 * Lifecycle:
 *   - RpcServerPlugin.onStarting constructs the app and registers `IAppService`.
 *   - Feature plugins' onReady fetch IAppService and call `mount(...)`.
 *   - apps/server pulls `IAppService.app` to serve traffic.
 */
export interface IAppService {
  readonly app: AppOpenAPI;
  /** Mount a feature router under a path prefix. Idempotent — only the first call wins per prefix. */
  mount(pathPrefix: string, router: AppOpenAPI): void;
  /** Add a top-level middleware. Use sparingly; prefer per-route middleware on the feature router. */
  use(path: string, middleware: MiddlewareHandler): void;
  /** Register a simple GET handler — useful for /health and similar non-OpenAPI endpoints. */
  get(path: string, handler: (c: Parameters<MiddlewareHandler>[0]) => Response | Promise<Response>): void;
}
export const IAppService = createIdentifier<IAppService>('rpc-server.app.service');

export class AppService implements IAppService {
  readonly app: AppOpenAPI;

  constructor(config: IRpcServerConfig) {
    const app = createRouter();
    app.use('*', requestId());
    if (config.loggerMiddleware) {
      app.use('*', config.loggerMiddleware());
    }
    const corsOrigins = config.corsOrigins ?? ['*'];
    app.use('*', cors({
      origin: corsOrigins.includes('*') ? '*' : [...corsOrigins],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'Accept'],
      maxAge: 600,
    }));
    app.notFound((c) => jsonError(c, new HttpError(404, 'not_found')));
    app.onError((err, c) => jsonError(c, err));

    if (config.openapi) {
      const { title, version, description, specPath = '/openapi.json', docsPath = '/docs' } = config.openapi;
      app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token issued by /v1/auth/srp/verify or /v1/auth/refresh.',
      });
      app.doc(specPath, {
        openapi: '3.0.0',
        info: { title, version, description: description ?? '' },
      });
      app.get(docsPath, Scalar({ url: specPath, pageTitle: `${title} — API reference`, theme: 'default' }));
    }
    this.app = app;
  }

  mount(pathPrefix: string, router: AppOpenAPI): void {
    this.app.route(pathPrefix, router);
  }

  use(path: string, middleware: MiddlewareHandler): void {
    this.app.use(path, middleware);
  }

  get(path: string, handler: (c: Parameters<MiddlewareHandler>[0]) => Response | Promise<Response>): void {
    this.app.get(path, handler);
  }
}
