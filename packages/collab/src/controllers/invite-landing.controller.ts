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

import { renderInviteLandingHtml } from './invite-landing.template';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface IInviteLandingHandlerOptions {
  readonly downloadUrl: string;
}

/**
 * Framework-agnostic renderer for the `GET /s/:inviteId` deep-link bridge page.
 * The browser strips the URL fragment (carrying `ephPriv` + capability) before
 * the request reaches us, so this only needs the inviteId path param to render
 * a self-contained HTML page that wakes the desktop client.
 */
export class InviteLandingController {
  constructor(private readonly _options: IInviteLandingHandlerOptions) {}

  render(inviteId: string): Response {
    if (!ID_PATTERN.test(inviteId)) {
      return new Response('Invalid invite link.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    const html = renderInviteLandingHtml({
      inviteId,
      downloadUrl: this._options.downloadUrl,
    });
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  }
}
