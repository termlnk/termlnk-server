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

export { AUTH_PLUGIN_CONFIG_KEY } from './config.schema';
export type { IAuthPluginConfig } from './config.schema';
export { AUTH_PLUGIN_NAME, AuthPlugin } from './plugin';
export { AuthService, IAuthService } from './services/auth.service';
export type { IDeviceMeta, IRegisterParams, ITokenBundle } from './services/auth.service';
export { GoogleOAuthService, IGoogleOAuthService } from './services/google-oauth.service';
export type { IGoogleAuthSession, IGoogleOAuthConfig, IGoogleUserInfo } from './services/google-oauth.service';
export { IOAuthFlowStore, OAuthFlowStore } from './services/oauth-flow-store.service';
export type { IOAuthRelayPayload } from './services/oauth-flow-store.service';
export { ISrpSessionService, SrpSessionService } from './services/srp-session.service';
