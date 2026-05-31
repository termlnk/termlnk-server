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

import { renderOAuthLandingHtml } from './oauth-landing.template';

// The landing page's "not installed yet" link. A constant, not a config knob: the
// only operator path for this would have been env, which never carried it, so it
// could never have been anything but this value.
const DOWNLOAD_URL = 'https://termlnk.com';

/** Maps internal OAuth error codes to a reason the signing-in user can act on. */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: 'The sign-in request was incomplete. Please start again from Termlnk.',
  invalid_state: 'This sign-in link has expired or was already used. Please start again from Termlnk.',
  access_denied: 'Sign-in was cancelled.',
  server_error: 'Something went wrong on our side. Please try again in a moment.',
};

const FALLBACK_ERROR_MESSAGE = 'Sign-in could not be completed. Please start again from Termlnk.';

/**
 * Resolves a user-facing reason for an error code. Uses `Object.hasOwn` rather than a
 * bare index so an attacker-controlled code (`?error=toString`, `?error=__proto__`)
 * pulls the fallback string instead of a prototype member.
 */
function errorMessageFor(errorCode: string): string {
  return Object.hasOwn(ERROR_MESSAGES, errorCode) ? ERROR_MESSAGES[errorCode]! : FALLBACK_ERROR_MESSAGE;
}

export interface IOAuthLandingHandlerOptions {
  /** Desktop deep link the pages hand off to, e.g. `termlnk://auth/callback`. */
  readonly desktopCallbackUrl: string;
}

/**
 * Framework-agnostic renderer for the Google OAuth completion bridge pages. The
 * `/google/callback` handler renders these instead of a bare 302: desktop pages
 * carry the relay code (success) or error (failure) into the `termlnk://auth/callback`
 * deep link; web pages stay in the popup and tell the user to close it, since the
 * client's backend polls the outcome out-of-band.
 */
export class OAuthLandingController {
  constructor(private readonly _options: IOAuthLandingHandlerOptions) {}

  renderSuccess(relayCode: string): Response {
    const deepLink = `${this._options.desktopCallbackUrl}?relayCode=${encodeURIComponent(relayCode)}`;
    return this._html(renderOAuthLandingHtml({ status: 'success', deepLink, downloadUrl: DOWNLOAD_URL }));
  }

  /**
   * Desktop failure page. Hands the error back through the deep link too, so a
   * client waiting on `termlnk://...` learns the flow failed instead of hanging.
   */
  renderError(errorCode: string): Response {
    const deepLink = `${this._options.desktopCallbackUrl}?error=${encodeURIComponent(errorCode)}`;
    return this._html(renderOAuthLandingHtml({ status: 'error', deepLink, errorMessage: errorMessageFor(errorCode) }));
  }

  /**
   * Web popup success page. The relay code reaches the client's backend out-of-band
   * (it polls by device code), so this page carries no secret — it only tells the
   * user the popup can be closed.
   */
  renderWebComplete(): Response {
    return this._html(renderOAuthLandingHtml({ status: 'web-complete' }));
  }

  /**
   * Web popup failure page. The error reaches the backend through its poll, so this
   * just explains the failure in place — no deep link, there's no desktop client here.
   */
  renderWebError(errorCode: string): Response {
    return this._html(renderOAuthLandingHtml({ status: 'web-error', errorMessage: errorMessageFor(errorCode) }));
  }

  private _html(html: string): Response {
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
