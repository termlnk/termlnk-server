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

import type { IDBAdaptorService } from '@termlnk-server/database';
import type { IPushTokensRepository } from '@termlnk-server/database/repositories';
import { createIdentifier } from '@termlnk-server/core';

export interface IPushRegisterParams {
  userId: string;
  deviceToken: string;
  platform: string;
  userAgent: string | null;
}

export interface IPushService {
  register(params: IPushRegisterParams): Promise<void>;
  unregister(userId: string, deviceToken: string): Promise<void>;
}

export const IPushService = createIdentifier<IPushService>('push.service');

/**
 * Push token registry. Why the global `delete by deviceToken` before insert in
 * `register`: device tokens (APNs / FCM / Expo) are platform-global handles —
 * if a user signs into a different account on the same device, the token must
 * migrate from the old user-row to the new one. This is a soft re-assignment,
 * not a uniqueness violation.
 */
export class PushService implements IPushService {
  constructor(
    private readonly _db: IDBAdaptorService,
    private readonly _tokens: IPushTokensRepository
  ) {}

  async register(params: IPushRegisterParams): Promise<void> {
    await this._db.transaction(async (tx) => {
      await this._tokens.deleteByDeviceToken(params.deviceToken, tx);
      await this._tokens.insert({
        userId: params.userId,
        deviceToken: params.deviceToken,
        platform: params.platform,
        userAgent: params.userAgent,
      }, tx);
    });
  }

  async unregister(userId: string, deviceToken: string): Promise<void> {
    await this._tokens.delete(userId, deviceToken);
  }
}
