#!/usr/bin/env bash
# Idempotent bootstrap for local dev: if repo-root .env already exists, do nothing.
# Otherwise copy deploy/docker/.env.example and fill in fresh JWT secrets, so a clean
# clone can `pnpm docker:up` without any manual editing.
#
# Self-host users should use install.sh instead — this script is dev-only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/.env"
TEMPLATE="$(dirname "$0")/.env.example"

if [ -f "$ENV_FILE" ]; then
  echo "[bootstrap] $ENV_FILE already exists, leaving untouched"
  exit 0
fi

[ -f "$TEMPLATE" ] || { echo "[bootstrap] template missing: $TEMPLATE" >&2; exit 1; }

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 64 | tr -d '\n'
  elif [ -r /dev/urandom ]; then
    head -c 64 /dev/urandom | base64 | tr -d '\n'
  else
    echo "[bootstrap] need openssl or /dev/urandom to generate JWT secrets" >&2
    exit 1
  fi
}

ACCESS="$(gen_secret)"
REFRESH="$(gen_secret)"
ADMIN="$(gen_secret)"
ADMIN_PASS="$(gen_secret | tr -dc 'A-Za-z0-9' | head -c 16)"

# Copy template, then inject the empty secret slots.
cp "$TEMPLATE" "$ENV_FILE"
# macOS sed needs -i ''; GNU sed needs -i. Detect by uname.
if [ "$(uname -s)" = "Darwin" ]; then
  sed -i '' "s|^JWT_ACCESS_SECRET=$|JWT_ACCESS_SECRET=$ACCESS|"           "$ENV_FILE"
  sed -i '' "s|^JWT_REFRESH_SECRET=$|JWT_REFRESH_SECRET=$REFRESH|"         "$ENV_FILE"
  sed -i '' "s|^ADMIN_JWT_SECRET=$|ADMIN_JWT_SECRET=$ADMIN|"               "$ENV_FILE"
  sed -i '' "s|^ADMIN_SEED_PASSWORD=$|ADMIN_SEED_PASSWORD=$ADMIN_PASS|"   "$ENV_FILE"
else
  sed -i    "s|^JWT_ACCESS_SECRET=$|JWT_ACCESS_SECRET=$ACCESS|"           "$ENV_FILE"
  sed -i    "s|^JWT_REFRESH_SECRET=$|JWT_REFRESH_SECRET=$REFRESH|"         "$ENV_FILE"
  sed -i    "s|^ADMIN_JWT_SECRET=$|ADMIN_JWT_SECRET=$ADMIN|"               "$ENV_FILE"
  sed -i    "s|^ADMIN_SEED_PASSWORD=$|ADMIN_SEED_PASSWORD=$ADMIN_PASS|"   "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"
echo "[bootstrap] wrote $ENV_FILE with freshly-generated JWT and admin secrets"
