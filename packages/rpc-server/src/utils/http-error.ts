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
 * Single error envelope used by every non-2xx response.
 *
 * Wire format: `{ error: { code, message?, details? } }` — authoritative schema in
 * @termlnk-server/protocol `errorResponseSchema`. Clients branch on `code`; `message` is
 * a human-readable hint and is omitted when the code is self-describing or when
 * the server intentionally withholds detail (5xx never leaks internals).
 */

import type { IErrorDetail, IErrorResponse } from '@termlnk-server/protocol';
import type { Context } from 'hono';
import type { IRequestLogger } from '../common/request-logger';
import { errorResponseSchema } from '@termlnk-server/protocol';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: IErrorDetail[]
  ) {
    super(message);
  }
}

function buildBody(code: string, message?: string, details?: IErrorDetail[]): IErrorResponse {
  const error: IErrorResponse['error'] = { code };
  if (message) {
    error.message = message;
  }
  if (details && details.length > 0) {
    error.details = details;
  }
  return errorResponseSchema.parse({ error });
}

export function jsonError(c: Context, err: unknown): Response {
  if (err instanceof HttpError) {
    return c.json(buildBody(err.code, err.message || undefined, err.details), err.status as never);
  }
  // Anything not modeled as HttpError is a bug or an unexpected runtime failure. Log the
  // full error server-side for debugging, but return only the generic code — internal
  // strings (SQL text, file paths, stack traces) must not cross the trust boundary.
  const logger = (c.var as { logger?: IRequestLogger }).logger;
  if (logger) {
    logger.error({ err }, '[http-error] unhandled');
  } else {
    console.error('[http-error] unhandled:', err);
  }
  return c.json(buildBody('server_error'), 500);
}
