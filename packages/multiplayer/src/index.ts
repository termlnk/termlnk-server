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

export { MULTIPLAYER_PLUGIN_CONFIG_KEY } from './config.schema';
export type { IMultiplayerPluginConfig } from './config.schema';
export { MULTIPLAYER_PLUGIN_NAME, MultiplayerPlugin } from './plugin';
export { AnnouncementService, IAnnouncementService } from './services/announcement.service';
export type { ISignalAttachOptions, ISignalConnection, ISignalHandle } from './services/signaling.service';
export { ISignalingService, SignalingService } from './services/signaling.service';
