#!/usr/bin/env bash
# termlnk-server one-line installer.
#
# Quick install (HTTP only, localhost):
#   curl -fSL https://raw.githubusercontent.com/termlnk/termlnk-server/main/deploy/docker/install.sh | bash
#
# With domain + HTTPS (Caddy auto-provisions a Let's Encrypt cert):
#   curl -fSL https://raw.githubusercontent.com/termlnk/termlnk-server/main/deploy/docker/install.sh \
#     | bash -s -- --domain sync.example.com --email you@example.com
#
# Environment overrides (all optional):
#   TERMLNK_INSTALL_DIR   target dir (default: /opt/termlnk-server, or $HOME/.termlnk-server when non-root)
#   TERMLNK_VERSION       image tag to pin (default: latest)
#   TERMLNK_REPO_RAW      base URL for compose / Caddyfile / .env.example / deploy.sh
#   TERMLNK_NONINTERACTIVE=1   never prompt; require all inputs via flags / env

set -euo pipefail

VERSION="${TERMLNK_VERSION:-latest}"
REPO_RAW="${TERMLNK_REPO_RAW:-https://raw.githubusercontent.com/termlnk/termlnk-server/main/deploy/docker}"
DOMAIN="${TERMLNK_DOMAIN:-}"
ACME_EMAIL="${TERMLNK_EMAIL:-}"
NONINTERACTIVE="${TERMLNK_NONINTERACTIVE:-0}"
INSTALL_DIR_OVERRIDE="${TERMLNK_INSTALL_DIR:-}"

# --- ANSI styling -------------------------------------------------------------
if [ -t 1 ]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_RED=$'\033[31m'; C_GRN=$'\033[32m'
  C_YLW=$'\033[33m'; C_BLU=$'\033[34m'; C_RST=$'\033[0m'
else
  C_BOLD=''; C_DIM=''; C_RED=''; C_GRN=''; C_YLW=''; C_BLU=''; C_RST=''
fi
log()   { printf '%s[termlnk]%s %s\n' "$C_BLU" "$C_RST" "$*"; }
ok()    { printf '%s[termlnk]%s %s%s%s\n' "$C_BLU" "$C_RST" "$C_GRN" "$*" "$C_RST"; }
warn()  { printf '%s[termlnk]%s %s%s%s\n' "$C_BLU" "$C_RST" "$C_YLW" "$*" "$C_RST" >&2; }
die()   { printf '%s[termlnk]%s %sERROR%s %s\n' "$C_BLU" "$C_RST" "$C_RED" "$C_RST" "$*" >&2; exit 1; }

# --- CLI args -----------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --domain)     DOMAIN="$2"; shift 2 ;;
    --email)      ACME_EMAIL="$2"; shift 2 ;;
    --version)    VERSION="$2"; shift 2 ;;
    --dir)        INSTALL_DIR_OVERRIDE="$2"; shift 2 ;;
    --yes|-y)     NONINTERACTIVE=1; shift ;;
    -h|--help)
      sed -n '2,18p' "$0" 2>/dev/null || grep -E '^#' "$0" | head -n 20
      exit 0
      ;;
    *) die "Unknown flag: $1 (try --help)" ;;
  esac
done

# Do NOT `exec </dev/tty` here: in `curl | bash` mode bash reads the script from
# fd 0, so reassigning it makes bash hang reading the rest from /dev/tty.
prompt() {
  local var_msg="$1" default="$2" reply=''
  if [ "$NONINTERACTIVE" = "1" ] || [ ! -t 0 ]; then
    printf '%s' "$default"
    return 0
  fi
  if [ -n "$default" ]; then
    printf '%s [%s]: ' "$var_msg" "$default" >&2
  else
    printf '%s: ' "$var_msg" >&2
  fi
  IFS= read -r reply || reply=''
  printf '%s' "${reply:-$default}"
}

# --- Platform / Docker checks -------------------------------------------------
os="$(uname -s)"
log "Platform: $os $(uname -m)"

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker found: $(docker --version)"
  else
    case "$os" in
      Linux)
        warn "Docker not found. Installing via get.docker.com (requires root or passwordless sudo)..."
        curl -fsSL https://get.docker.com | sh
        ;;
      Darwin)
        die "Docker is not installed. Install Docker Desktop: https://www.docker.com/products/docker-desktop"
        ;;
      *) die "Unsupported OS '$os'. Install Docker manually then re-run." ;;
    esac
  fi
  if ! docker compose version >/dev/null 2>&1; then
    die "Docker Compose v2 is required (docker compose ...). Upgrade Docker to 24+."
  fi
  if ! docker info >/dev/null 2>&1; then
    die "Docker daemon is not reachable. Start Docker and retry (you may need to add yourself to the 'docker' group and re-login)."
  fi
  log "Docker Compose: $(docker compose version --short 2>/dev/null || echo unknown)"
}

# --- Install directory --------------------------------------------------------
pick_install_dir() {
  if [ -n "$INSTALL_DIR_OVERRIDE" ]; then
    printf '%s' "$INSTALL_DIR_OVERRIDE"
    return
  fi
  if [ "$(id -u)" = "0" ]; then
    printf '/opt/termlnk-server'
  else
    printf '%s/.termlnk-server' "$HOME"
  fi
}

# --- Secret generation --------------------------------------------------------
gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 64 | tr -d '\n'
  elif [ -r /dev/urandom ]; then
    head -c 64 /dev/urandom | base64 | tr -d '\n'
  else
    die "Neither openssl nor /dev/urandom available — cannot generate JWT secrets."
  fi
}

# --- Download a deploy artifact -----------------------------------------------
fetch() {
  local relpath="$1" dest="$2"
  log "  → $relpath"
  if ! curl -fSL --connect-timeout 10 --max-time 60 "$REPO_RAW/$relpath" -o "$dest"; then
    die "Failed to download $REPO_RAW/$relpath"
  fi
}

# --- Main ---------------------------------------------------------------------
ensure_docker

INSTALL_DIR="$(pick_install_dir)"
log "Install dir: $INSTALL_DIR"

if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/.env" ]; then
  warn "$INSTALL_DIR/.env already exists — running an update instead of fresh install."
  cd "$INSTALL_DIR"
  fetch docker-compose.yml docker-compose.yml
  fetch docker-compose.https.yml docker-compose.https.yml
  fetch Caddyfile Caddyfile
  fetch deploy.sh deploy.sh && chmod +x deploy.sh
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
  COMPOSE_FILES=(-f docker-compose.yml)
  [ -n "${DOMAIN:-}" ] && COMPOSE_FILES+=(-f docker-compose.https.yml)
  docker compose --env-file .env "${COMPOSE_FILES[@]}" pull
  docker compose --env-file .env "${COMPOSE_FILES[@]}" up -d
  ok "Updated. Run '$INSTALL_DIR/deploy.sh status' to inspect."
  exit 0
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

log "Fetching deploy artifacts from $REPO_RAW"
fetch docker-compose.yml docker-compose.yml
fetch docker-compose.https.yml docker-compose.https.yml
fetch Caddyfile Caddyfile
fetch .env.example .env.example
fetch deploy.sh deploy.sh
chmod +x deploy.sh

# --- Collect domain / email ---------------------------------------------------
piped_or_noninteractive() { [ "$NONINTERACTIVE" = "1" ] || [ ! -t 0 ]; }

if [ -z "$DOMAIN" ]; then
  if piped_or_noninteractive; then
    log "No --domain given — installing in HTTP-only mode (server on :4000)."
    log "  Pass --domain <host> --email <addr> next time for auto-HTTPS via Caddy."
  else
    echo
    log "Reverse-proxy with auto-HTTPS via Caddy is optional."
    log "Leave domain blank for an HTTP-only install (server exposed on :${SERVER_PORT:-4000})."
    DOMAIN="$(prompt 'Domain (e.g. sync.example.com)' '')"
  fi
fi
if [ -n "$DOMAIN" ] && [ -z "$ACME_EMAIL" ]; then
  if piped_or_noninteractive; then
    die "--domain $DOMAIN given but --email missing (required for Let's Encrypt)."
  fi
  ACME_EMAIL="$(prompt 'Email for Let'"'"'s Encrypt notifications' '')"
  [ -z "$ACME_EMAIL" ] && die "Email is required when a domain is set."
fi

# --- Write .env ---------------------------------------------------------------
log "Generating JWT secrets..."
JWT_ACCESS_SECRET="$(gen_secret)"
JWT_REFRESH_SECRET="$(gen_secret)"
ADMIN_JWT_SECRET="$(gen_secret)"

# --- Collect admin credentials ------------------------------------------------
ADMIN_SEED_EMAIL=""
ADMIN_SEED_PASS=""

if piped_or_noninteractive; then
  ADMIN_SEED_EMAIL="admin@termlnk.local"
  ADMIN_SEED_PASS="$(gen_secret | tr -dc 'A-Za-z0-9' | head -c 16)"
else
  echo
  log "Admin dashboard credentials (used for the first admin account)."
  ADMIN_SEED_EMAIL="$(prompt 'Admin email' 'admin@termlnk.local')"
  while true; do
    printf '  Admin password (min 8 chars): ' >&2
    IFS= read -rs ADMIN_SEED_PASS || ADMIN_SEED_PASS=''
    echo >&2
    if [ "${#ADMIN_SEED_PASS}" -ge 8 ]; then
      break
    fi
    if [ -z "$ADMIN_SEED_PASS" ]; then
      ADMIN_SEED_PASS="$(gen_secret | tr -dc 'A-Za-z0-9' | head -c 16)"
      log "No password entered — generated: $ADMIN_SEED_PASS"
      break
    fi
    warn "Password must be at least 8 characters. Try again."
  done
fi

if [ -n "$DOMAIN" ]; then
  server_bind=127.0.0.1
  cors_origins="https://$DOMAIN"
  # Pre-fill the public callback so enabling OAuth later is just client id/secret
  # + flipping ENABLED to true. Still disabled by default.
  google_redirect_uri="https://$DOMAIN/auth/google/callback"
else
  server_bind=0.0.0.0
  cors_origins='*'
  google_redirect_uri=
fi

umask 077
cat > .env <<EOF
# Generated by install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
TERMLNK_VERSION=$VERSION

DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL

SERVER_BIND=$server_bind
SERVER_PORT=4000
POSTGRES_BIND=127.0.0.1
POSTGRES_PORT=5432
REDIS_BIND=127.0.0.1
REDIS_PORT=6379

POSTGRES_USER=termlnk
POSTGRES_PASSWORD=$(gen_secret | tr -dc 'A-Za-z0-9' | head -c 32)
POSTGRES_DB=termlnk_server

JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000

ALLOW_OPEN_REGISTRATION=true
REQUIRE_EMAIL_VERIFICATION=false
CORS_ORIGINS=$cors_origins

# Google OAuth (optional) — disabled. To enable: set client id/secret, ensure
# GOOGLE_REDIRECT_URI matches an Authorized redirect URI in your Google OAuth
# client, flip GOOGLE_OAUTH_ENABLED to true, then ./deploy.sh restart.
GOOGLE_OAUTH_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=$google_redirect_uri
GOOGLE_DESKTOP_CALLBACK_URL=termlnk://auth/callback

# Admin dashboard — enabled by default with generated secret. Seed admin is
# auto-created on first boot. Change the email/password below, then visit
# /admin/ to log in.
ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET
ADMIN_SEED_EMAIL=$ADMIN_SEED_EMAIL
ADMIN_SEED_PASSWORD=$ADMIN_SEED_PASS
ADMIN_JWT_TTL_SECONDS=3600
EOF
chmod 600 .env
ok "Wrote $INSTALL_DIR/.env (secrets generated)."

# --- Boot ---------------------------------------------------------------------
COMPOSE_FILES=(-f docker-compose.yml)
[ -n "$DOMAIN" ] && COMPOSE_FILES+=(-f docker-compose.https.yml)

log "Pulling images..."
docker compose --env-file .env "${COMPOSE_FILES[@]}" pull

log "Starting termlnk-server..."
docker compose --env-file .env "${COMPOSE_FILES[@]}" up -d

# --- Wait for /health ---------------------------------------------------------
log "Waiting for server to become healthy..."
health_url='http://127.0.0.1:4000/health'
for i in $(seq 1 60); do
  if curl -fsS -m 2 "$health_url" >/dev/null 2>&1; then
    ok "Server is healthy after ${i}s."
    break
  fi
  if [ "$i" = "60" ]; then
    warn "Server did not become healthy within 60s. Inspect: $INSTALL_DIR/deploy.sh logs server"
  fi
  sleep 1
done

# --- Summary ------------------------------------------------------------------
echo
ok "termlnk-server is up."
if [ -n "$DOMAIN" ]; then
  echo "  ${C_BOLD}URL${C_RST}        https://$DOMAIN"
  echo "  ${C_BOLD}Admin${C_RST}      https://$DOMAIN/admin/"
  echo "  ${C_BOLD}OpenAPI${C_RST}    https://$DOMAIN/docs"
else
  echo "  ${C_BOLD}URL${C_RST}        http://localhost:4000"
  echo "  ${C_BOLD}Admin${C_RST}      http://localhost:4000/admin/"
  echo "  ${C_BOLD}OpenAPI${C_RST}    http://localhost:4000/docs"
fi
echo "  ${C_BOLD}Install dir${C_RST}   $INSTALL_DIR"
echo "  ${C_BOLD}Manage${C_RST}        $INSTALL_DIR/deploy.sh {status|logs|update|backup|restart|stop|uninstall}"
echo
echo "  ${C_BOLD}Admin login${C_RST}"
echo "    Email:    $ADMIN_SEED_EMAIL"
echo "    Password: $ADMIN_SEED_PASS"
echo
echo "  ${C_DIM}Tip: edit $INSTALL_DIR/.env then run './deploy.sh restart' to apply changes.${C_RST}"
