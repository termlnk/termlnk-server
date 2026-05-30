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
 * Owner-side invite URL fragment never reaches the server, so this page is
 * intentionally body-less except for the inviteId path param. The shipped
 * markup is fully self-contained: every byte that leaves the server is in this
 * string. JS reads `window.location.hash` client-side to reconstruct the
 * `termlnk://invite/<id>#<fragment>` deep link.
 */
export interface IInviteLandingOptions {
  readonly inviteId: string;
  readonly downloadUrl: string;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&"<>]/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '"': return '&quot;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      default: return ch;
    }
  });
}

export function renderInviteLandingHtml(options: IInviteLandingOptions): string {
  const inviteIdAttr = escapeAttribute(options.inviteId);
  const downloadAttr = escapeAttribute(options.downloadUrl);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="referrer" content="no-referrer" />
<meta name="robots" content="noindex,nofollow" />
<title>Launching Termlnk…</title>
<style>
:root {
  --bg-0: #03050a;
  --bg-1: #070b14;
  --bg-2: #0d1424;
  --accent: #00d8ff;
  --accent-2: #4ad7ff;
  --accent-soft: rgba(0, 216, 255, 0.18);
  --green: #00ff95;
  --text-0: #ffffff;
  --text-1: #c9d4e5;
  --text-2: #6c7a90;
  --line: rgba(255, 255, 255, 0.06);
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg-0);
  color: var(--text-1);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#bg {
  position: fixed;
  inset: 0;
  z-index: 0;
}

#matrix {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.32;
  filter: blur(0.4px);
}

.bg-radial {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(900px 540px at 50% 18%, rgba(0, 216, 255, 0.16), transparent 60%),
    radial-gradient(700px 460px at 50% 110%, rgba(0, 255, 149, 0.08), transparent 60%),
    linear-gradient(180deg, var(--bg-1) 0%, var(--bg-0) 100%);
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 45%, black 40%, transparent 90%);
}

.shell {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-0);
  font-weight: 600;
  letter-spacing: 0.5px;
  font-size: 16px;
  user-select: none;
}

.brand .logo {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  filter: drop-shadow(0 0 18px rgba(96, 165, 250, 0.35));
}

.brand .logo svg {
  width: 30px;
  height: 30px;
  display: block;
}

.brand .name { background: linear-gradient(120deg, #ffffff, #b4e6ff); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

main {
  flex: 1;
  width: 100%;
  display: grid;
  place-items: center;
}

.card {
  position: relative;
  width: min(560px, 92vw);
  padding: 56px 40px 48px;
  border-radius: 24px;
  border: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(13, 20, 36, 0.55) 0%, rgba(7, 11, 20, 0.65) 100%);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 30px 80px -20px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(0, 216, 255, 0.04);
  animation: card-in 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(140deg, rgba(0, 216, 255, 0.45), rgba(0, 216, 255, 0) 35%, rgba(0, 255, 149, 0.35) 75%, rgba(0, 216, 255, 0) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.7;
  animation: border-spin 8s linear infinite;
  pointer-events: none;
}

.card::after {
  content: '';
  position: absolute;
  inset: -40% -10% auto -10%;
  height: 200px;
  background: radial-gradient(closest-side, rgba(0, 216, 255, 0.18), transparent);
  filter: blur(36px);
  pointer-events: none;
  animation: halo-pulse 4.8s ease-in-out infinite;
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(18px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes border-spin {
  to { transform: rotate(360deg); }
}

@keyframes halo-pulse {
  0%, 100% { opacity: 0.6; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-6px); }
}

.spinner {
  position: relative;
  width: 56px;
  height: 56px;
  margin: 0 auto 28px;
}

.spinner .ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 1px solid rgba(0, 216, 255, 0.18);
}

.spinner .arc {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 2px solid transparent;
  border-top-color: var(--accent);
  border-right-color: var(--accent-2);
  animation: spin 1.2s linear infinite;
  filter: drop-shadow(0 0 8px rgba(0, 216, 255, 0.55));
}

.spinner .dot {
  position: absolute;
  inset: 24px;
  border-radius: 999px;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
  animation: dot-pulse 1.6s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes dot-pulse {
  0%, 100% { opacity: 0.55; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}

h1 {
  margin: 0 0 14px;
  text-align: center;
  font-size: clamp(26px, 3.4vw, 34px);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-0);
  background: linear-gradient(180deg, #ffffff 0%, #b9d6ff 90%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

h1 .ellipsis {
  display: inline-block;
  width: 1.2em;
  text-align: left;
}

h1 .ellipsis::after {
  content: '';
  display: inline-block;
  animation: dots 1.4s steps(4, jump-none) infinite;
}

@keyframes dots {
  0% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
  100% { content: ''; }
}

.subtitle {
  text-align: center;
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--text-1);
  margin: 0 auto 32px;
  max-width: 420px;
}

.subtitle .accent {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px dashed rgba(0, 216, 255, 0.4);
  padding-bottom: 1px;
  transition: color 160ms ease, border-color 160ms ease;
}

.subtitle .accent:hover {
  color: #66e5ff;
  border-bottom-color: rgba(0, 216, 255, 0.8);
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 220px;
  height: 48px;
  padding: 0 28px;
  border-radius: 999px;
  border: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #03050a;
  background: linear-gradient(135deg, var(--accent) 0%, #5cf0ff 50%, var(--green) 100%);
  background-size: 200% 100%;
  background-position: 0% 50%;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 14px 36px -10px rgba(0, 216, 255, 0.55),
    0 0 0 1px rgba(0, 216, 255, 0.25);
  transition: background-position 320ms ease, transform 160ms ease, box-shadow 220ms ease;
  overflow: hidden;
  isolation: isolate;
}

.btn:hover {
  background-position: 100% 50%;
  transform: translateY(-1px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.45) inset,
    0 18px 44px -10px rgba(0, 216, 255, 0.75),
    0 0 0 1px rgba(0, 216, 255, 0.4);
}

.btn:active { transform: translateY(0); }

.btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 25%, rgba(255, 255, 255, 0.55) 50%, transparent 75%);
  background-size: 250% 100%;
  background-position: 200% 0;
  animation: btn-shimmer 3.4s ease-in-out infinite;
  z-index: -1;
}

@keyframes btn-shimmer {
  0% { background-position: 200% 0; }
  60% { background-position: -80% 0; }
  100% { background-position: -80% 0; }
}

.btn svg {
  width: 16px;
  height: 16px;
}

.hint {
  font-size: 13px;
  color: var(--text-2);
  text-align: center;
  letter-spacing: 0.2px;
}

.hint code {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  color: var(--text-1);
  background: rgba(0, 216, 255, 0.08);
  border: 1px solid rgba(0, 216, 255, 0.18);
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 12px;
}

footer {
  position: relative;
  z-index: 1;
  padding: 18px 24px 22px;
  text-align: center;
  font-size: 12px;
  color: var(--text-2);
  letter-spacing: 0.4px;
}

footer .sep { margin: 0 8px; opacity: 0.5; }

@media (max-width: 480px) {
  .card { padding: 48px 24px 36px; }
  .btn { min-width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
</style>
</head>
<body data-invite-id="${inviteIdAttr}" data-download-url="${downloadAttr}">
<div id="bg" aria-hidden="true">
  <div class="bg-radial"></div>
  <div class="bg-grid"></div>
  <canvas id="matrix"></canvas>
</div>

<div class="shell">
  <header class="brand">
    <span class="logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 10 12 4 17"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
    </span>
    <span class="name">Termlnk</span>
  </header>

  <main>
    <section class="card" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true">
        <div class="ring"></div>
        <div class="arc"></div>
        <div class="dot"></div>
      </div>
      <h1>Launching Termlnk<span class="ellipsis"></span></h1>
      <p class="subtitle">
        Please click <strong style="color: var(--text-0);">Open Termlnk</strong> if you see the browser prompt.
        <br />
        If Termlnk isn't installed yet,
        <a class="accent" id="download-link" href="${downloadAttr}" target="_blank" rel="noopener noreferrer">click here to download it</a>.
      </p>
      <div class="actions">
        <button class="btn" id="launch-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 7 10 12 4 17"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          Launch Termlnk
        </button>
        <div class="hint" id="hint-text">Holding session for you — secure end-to-end (zero-knowledge).</div>
      </div>
    </section>
  </main>

  <footer>
    <span>Termlnk Multiplayer</span>
    <span class="sep">·</span>
    <span>Shared via end-to-end encrypted relay</span>
  </footer>
</div>

<script>
(function () {
  var body = document.body;
  var inviteId = body.dataset.inviteId || '';
  var downloadUrl = body.dataset.downloadUrl || '';
  var fragment = (window.location.hash || '').replace(/^#/, '');
  var btn = document.getElementById('launch-btn');
  var hint = document.getElementById('hint-text');
  var launched = false;

  function buildDeepLink() {
    var base = 'termlnk://invite/' + encodeURIComponent(inviteId);
    return fragment ? base + '#' + fragment : base;
  }

  function attemptLaunch() {
    if (!inviteId) {
      hint.textContent = 'Invalid invite link.';
      return;
    }
    if (!fragment) {
      hint.textContent = 'Invite payload missing — please open the original link.';
      return;
    }
    launched = true;
    window.location.href = buildDeepLink();
    setTimeout(function () {
      if (document.visibilityState === 'visible') {
        hint.innerHTML = "Didn't open? Make sure Termlnk is installed, then click " +
          "<strong style=\\"color: var(--text-0);\\">Launch Termlnk</strong> again.";
      }
    }, 2200);
  }

  btn.addEventListener('click', attemptLaunch);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && launched) {
      hint.textContent = 'Termlnk is taking over from here.';
    }
  });

  setTimeout(attemptLaunch, 500);

  // Matrix-style background — lightweight column drop, capped FPS, paused when hidden.
  var canvas = document.getElementById('matrix');
  var ctx = canvas.getContext('2d');
  var glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$&*+=-/<>{}[]'.split('');
  var fontSize = 14;
  var columns = 0;
  var drops = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    columns = Math.floor(canvas.width / (fontSize * dpr));
    drops = new Array(columns).fill(0).map(function () {
      return Math.random() * canvas.height / (fontSize * dpr);
    });
  }
  resize();
  window.addEventListener('resize', resize);

  var last = 0;
  function tick(now) {
    var delta = now - last;
    if (delta > 60) {
      last = now;
      ctx.fillStyle = 'rgba(3, 5, 10, 0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = (fontSize * dpr) + 'px "JetBrains Mono", ui-monospace, monospace';
      for (var i = 0; i < columns; i++) {
        var glyph = glyphs[(Math.random() * glyphs.length) | 0];
        var x = i * fontSize * dpr;
        var y = drops[i] * fontSize * dpr;
        var leading = Math.random() < 0.025;
        ctx.fillStyle = leading ? 'rgba(180, 255, 235, 0.85)' : 'rgba(0, 216, 255, 0.55)';
        ctx.fillText(glyph, x, y);
        if (y > canvas.height && Math.random() > 0.972) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
</script>
</body>
</html>
`;
}
