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

import { pinoLogger as pinoLoggerMiddleware } from 'hono-pino';
import { pino } from 'pino';
import pretty from 'pino-pretty';

export type LoggerMode = 'pretty' | 'json';

/**
 * Node logger middleware — pino under hono-pino. NOT edge-safe (pino pulls in
 * worker_threads + fs); the edge entrypoint uses the console logger instead.
 *
 *   - 'json' (default): structured stdout — log aggregators ingest directly
 *   - 'pretty': pino-pretty as an in-process stream for dev terminals
 *
 * pino-pretty is wired as a stream (not a transport worker) so bundlers and
 * runtimes that wrap modules (Vite SSR, Next.js server) don't break pino's
 * caller-stack inspection used to resolve transport target paths.
 */
export function pinoLogger(mode: LoggerMode = 'json') {
  const logger = mode === 'pretty'
    ? pino(
      { level: 'debug' },
      pretty({ colorize: true, singleLine: false, ignore: 'pid,hostname' })
    )
    : pino({ level: 'info' });
  return pinoLoggerMiddleware({ pino: logger });
}
