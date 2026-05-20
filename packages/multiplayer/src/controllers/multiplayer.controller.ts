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

import type { AppOpenAPI, AppRouteHandler } from '@termlnk-server/rpc-server';
import type { ISignalConnection, ISignalHandle } from '../services/signaling.service';
import { upgradeWebSocket } from '@hono/node-server';
import { z } from '@hono/zod-openapi';
import { IJwtService } from '@termlnk-server/crypto';
import { createWsBearerAuthMiddleware, HttpError, requireAuth } from '@termlnk-server/rpc-server';
import { IAnnouncementService } from '../services/announcement.service';
import { ISignalingService } from '../services/signaling.service';
import * as routes from './multiplayer.routes';

const signalQuerySchema = z.object({
  sessionId: z.string().min(1).max(256),
  peerId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

export class MultiplayerController {
  constructor(
    @IAnnouncementService private readonly _announcements: IAnnouncementService,
    @ISignalingService private readonly _signaling: ISignalingService,
    @IJwtService private readonly _jwt: IJwtService
  ) {}

  registerRoutes(router: AppOpenAPI): void {
    router.use('/announce', requireAuth(this._jwt));
    router.use('/announce/*', requireAuth(this._jwt));
    router.use('/sessions', requireAuth(this._jwt));

    router
      .openapi(routes.announce, this._announce)
      .openapi(routes.retract, this._retract)
      .openapi(routes.list, this._list);

    router.get(
      '/signal',
      createWsBearerAuthMiddleware(this._jwt),
      upgradeWebSocket((c) => {
        const userId = c.get('userId') as string;
        const parsed = signalQuerySchema.safeParse({
          sessionId: c.req.query('sessionId'),
          peerId: c.req.query('peerId'),
        });
        if (!parsed.success) {
          throw new HttpError(400, 'invalid_request', 'missing or invalid signal query parameters');
        }
        const { sessionId, peerId } = parsed.data;
        let handle: ISignalHandle | null = null;
        return {
          onOpen: (_evt, ws) => {
            const conn: ISignalConnection = {
              send: (data) => ws.send(data),
              close: (code, reason) => ws.close(code, reason),
            };
            handle = this._signaling.attach(conn, { userId, sessionId, peerId });
          },
          onMessage: (evt) => {
            const data = typeof evt.data === 'string'
              ? evt.data
              : new TextDecoder().decode(evt.data as ArrayBuffer);
            handle?.onMessage(data);
          },
          onClose: () => {
            handle?.onClose();
            handle = null;
          },
          onError: () => {
            handle?.onClose();
            handle = null;
          },
        };
      })
    );
  }

  private _announce: AppRouteHandler<typeof routes.announce> = async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    await this._announcements.upsert({
      userId,
      deviceId: body.deviceId,
      sessionId: body.sessionId,
      title: body.title,
      cols: body.cols,
      rows: body.rows,
      deviceClock: body.deviceClock,
    });
    return c.body(null, 204);
  };

  private _retract: AppRouteHandler<typeof routes.retract> = async (c) => {
    const userId = c.get('userId');
    const { sessionId } = c.req.valid('param');
    // The desktop client emits `x-termlnk-device-id` on retract so the server can
    // delete the exact (userId, deviceId, sessionId) tuple instead of nuking every
    // device's row for that sessionId. Missing header is silently treated as a no-op;
    // the freshness sweep catches the orphan within ~90 s either way.
    const deviceId = c.req.header('x-termlnk-device-id') ?? '';
    if (deviceId) {
      await this._announcements.retract(userId, deviceId, sessionId);
    }
    return c.body(null, 204);
  };

  private _list: AppRouteHandler<typeof routes.list> = async (c) => {
    const userId = c.get('userId');
    const { excludeDevice } = c.req.valid('query');
    const sessions = await this._announcements.listFresh(userId, excludeDevice);
    return c.json({ sessions }, 200);
  };
}
