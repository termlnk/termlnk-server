# Self-hosting termlnk-server

This guide covers running your own termlnk-server instance for the desktop client to sync against.

There are three supported paths:

1. **Docker Compose** — the simplest single-host self-host, includes Postgres + Redis
2. **Fly.io** — managed container hosting (closest to "click to deploy")
3. **Any container platform** — Cloud Run, Render, Railway, Kubernetes, Nomad, bare metal — anything that can run the image built from `deploy/docker/Dockerfile`

## Prerequisites

- A reachable host (localhost works for single-machine self-host)
- For Docker path: Docker 24+ with Compose v2 (the installer can install both on Linux); openssl on `PATH` for secret generation (already present on every standard distro)
- For Fly.io path: [`flyctl`](https://fly.io/docs/hands-on/install-flyctl/) v0.3+
- For BYO path: Postgres 15+ and Redis 7+ reachable from the server, plus two random 64-byte JWT secrets

## Path 1 — Docker Compose

One-line install on a Linux host with Docker 24+ (the script can install Docker itself if missing):

```bash
# HTTP only — binds port 4000 to the host. Use this if you'll front the server with your own proxy:
curl -fsSL https://raw.githubusercontent.com/termlnk/termlnk-server/main/deploy/docker/install.sh | bash

# Or with a public domain + auto-HTTPS via Caddy (Let's Encrypt HTTP-01, requires :80/:443 reachable):
curl -fsSL https://raw.githubusercontent.com/termlnk/termlnk-server/main/deploy/docker/install.sh \
  | bash -s -- --domain sync.example.com --email you@example.com
```

What the installer does, in order:

1. Detects Docker + Compose v2; on Linux it can install Docker via `get.docker.com` if missing.
2. Picks an install dir: `/opt/termlnk-server` (root) or `$HOME/.termlnk-server` (non-root). Override with `--dir <path>` or `TERMLNK_INSTALL_DIR`.
3. Downloads `docker-compose.yml`, `Caddyfile`, `.env.example`, `deploy.sh` into the install dir.
4. Prompts for `--domain` / `--email` if you didn't pass them (interactive even when piped from curl). Skip prompts with `--yes` after providing every required flag, or `TERMLNK_NONINTERACTIVE=1`.
5. Generates JWT secrets and a Postgres password with `openssl rand -base64 64`, writing them into `chmod 600 .env`.
6. `docker compose pull` then `docker compose up -d` (with `--profile https` when a domain is set).
7. Polls `/health` for up to 60 seconds and prints the public URL.

Re-running the installer in an existing install dir performs an in-place update instead of a fresh write.

Verify:

```bash
curl https://sync.example.com/health   # or http://localhost:4000/health if HTTP-only
# {"ok":true}
```

Image notes:

- Pulled from `ghcr.io/termlnk/termlnk-server:${TERMLNK_VERSION:-latest}` (multi-arch: linux/amd64 + linux/arm64).
- Pin a release in `.env` (`TERMLNK_VERSION=v0.1.0`) for reproducible deploys.
- Built from `deploy/docker/Dockerfile` — multi-stage, final stage is `node:22-alpine` with a non-root user (`hono`, uid 1001). Total image ~150 MB.

### Managing the instance

After install, all lifecycle ops go through `deploy.sh` in the install dir:

```bash
cd /opt/termlnk-server
./deploy.sh status                 # docker compose ps
./deploy.sh logs server            # tail server logs (any service name works)
./deploy.sh update                 # pull latest image + recreate
./deploy.sh backup                 # pg_dump → ./backups/termlnk-<ts>.sql.gz
./deploy.sh restore <file>         # gzipped pg_dump → Postgres (DESTRUCTIVE)
./deploy.sh restart                # restart the stack
./deploy.sh stop                   # stop (containers stay, data preserved)
./deploy.sh shell server           # open a shell in a container
./deploy.sh uninstall              # remove containers, keep data volumes
./deploy.sh uninstall --purge      # also drop Postgres + Redis volumes
```

Edit `.env` then `./deploy.sh restart` to roll changes.

## Path 2 — Fly.io

```bash
# 1) Login (creates the org if needed)
fly auth signup   # or: fly auth login

# 2) Bootstrap the app from the bundled fly.toml. --no-deploy because Postgres/Redis
#    need to be wired before the first deploy.
fly launch --copy-config --config deploy/fly/fly.toml --no-deploy

# 3) Provision dependencies. Postgres attaches DATABASE_URL automatically;
#    `fly redis create` provisions managed Redis and sets REDIS_URL.
fly postgres create
fly postgres attach <postgres-app-name>
fly redis create

# 4) Inject the JWT secrets (any value over 32 chars; placeholder words rejected).
fly secrets set \
  JWT_ACCESS_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))")" \
  JWT_REFRESH_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))")" \
  CORS_ORIGINS="https://your.app,https://desktop.client.host"

# 5) Deploy.
fly deploy --config deploy/fly/fly.toml
fly status
fly open /docs                        # opens Scalar in your browser
```

## Path 3 — BYO container platform

Pull the published image and run it on whatever platform you prefer (Cloud Run, Render, Railway, Kubernetes, Nomad, bare metal):

```bash
docker pull ghcr.io/termlnk/termlnk-server:latest
docker run --rm -p 4000:4000 \
  -e DATABASE_URL=postgres://… \
  -e REDIS_URL=redis://… \
  -e JWT_ACCESS_SECRET=… \
  -e JWT_REFRESH_SECRET=… \
  ghcr.io/termlnk/termlnk-server:latest
```

Or build locally from source if you need a patched image:

```bash
docker build -f deploy/docker/Dockerfile -t termlnk-server:local .
```

Image notes:
- Multi-arch: linux/amd64 + linux/arm64
- Multi-stage build; final stage is `node:22-alpine` with a non-root user (`hono`, uid 1001)
- Total image ~150 MB; runtime starts in <1s
- Drizzle migrations run on every cold start (idempotent via `__drizzle_migrations` table)

## First-time database setup

The Drizzle migrator runs on each fresh container boot via the server entry. To run it manually:

```bash
cd /opt/termlnk-server
./deploy.sh shell server                    # then: node dist/db/migrate.js
```

For Fly:

```bash
fly ssh console -C "node /app/dist/db/migrate.js"
```

## Pointing the desktop client at your server

In the Termlnk desktop app, the cloud URL is configured via the `cloudBaseUrl` plugin config
on `@termlnk/auth-core` and `@termlnk/sync-core`. Set it to:

```
http://your-host:4000/v1
```

Both packages share the same base URL — the URL must include the `/v1` version prefix.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes (default for compose) | `postgres://termlnk:termlnk@localhost:5432/termlnk_server` | Postgres connection string |
| `REDIS_URL` | yes (default for compose) | `redis://localhost:6379` | Redis connection string |
| `JWT_ACCESS_SECRET` | **yes** | — | At least 32 bytes; rejected if it contains `changeme` |
| `JWT_REFRESH_SECRET` | **yes** | — | Distinct from access secret; same length rules |
| `JWT_ACCESS_TTL_SECONDS` | no | `900` | Access token lifetime |
| `JWT_REFRESH_TTL_SECONDS` | no | `2592000` | Refresh token lifetime |
| `ALLOW_OPEN_REGISTRATION` | no | `true` | If `false`, `/v1/auth/register` returns 403 |
| `REQUIRE_EMAIL_VERIFICATION` | no | `false` | If `true`, login is rejected until email is verified |
| `CORS_ORIGINS` | no | `*` | Comma-separated allowlist; `*` is permissive |
| `HOST` / `PORT` | no | `0.0.0.0` / `4000` | Bind address |
| `NODE_ENV` | no | — | `production` selects JSON log output; otherwise pino-pretty |

Invalid values fail loudly at startup with a Zod-formatted error message per field.

## Security checklist

- [ ] Replace both JWT secrets with values from `crypto.randomBytes(64)` — never use placeholders (the server refuses to start otherwise; `install.sh` already does this for fresh installs).
- [ ] Put the server behind HTTPS (Caddy / Traefik / Nginx). JWTs in plaintext HTTP are a leak.
- [ ] Restrict `CORS_ORIGINS` to known hosts; do not use `*` in production.
- [ ] Run Postgres on a private network; do not expose port 5432 to the public internet.
- [ ] Set `ALLOW_OPEN_REGISTRATION=false` if this is a personal or team-only instance.
- [ ] Snapshot Postgres regularly. Sync payloads are encrypted but you still need DR for the rows and user records themselves.
- [ ] Put an L7 WAF in front for DDoS + rate-limiting beyond the per-process limiter on `/v1/auth/*`.

## Architecture & wire format

See [`../docs/architecture.md`](./architecture.md) for module boundaries and the dependency
graph. See [`packages/protocol/src/`](../packages/protocol/src) for the Zod schemas — these
are the authoritative source for request/response shapes. The desktop client imports the same
package (or its inlined equivalent) for symmetric validation.

Live OpenAPI spec is served at `/openapi.json`; an interactive Scalar reference at `/docs`.

Key invariants:

- **Zero-knowledge**: server stores only ciphertext (`sync_objects.payload`). Decrypting requires the user's master key, which is derived client-side from their password and never transmitted.
- **Server-monotonic versioning**: every accepted mutation bumps the per-user `sync_global_version`; pull cursors encode this number opaquely.
- **Single-use refresh tokens**: each `/auth/refresh` rotates the jti. Replay → both copies revoked.
- **Cross-instance sync poke**: every push fans out via Redis pub/sub, so WS clients on any server instance get the same `{type:"poke"}` event.
- **Cross-instance shared-terminal relay**: daemon broadcast and targeted frames cross instances through Redis (`relay:{userId}:{sessionId}` channel); same-instance frames stay in-process.

## Operations

### Database backup

```bash
cd /opt/termlnk-server
./deploy.sh backup                          # → ./backups/termlnk-<timestamp>.sql.gz
./deploy.sh restore backups/termlnk-20260520T120000Z.sql.gz
```

### Logs

```bash
cd /opt/termlnk-server
./deploy.sh logs server                     # any service: server / postgres / redis / caddy
fly logs --app <app-name>                   # for Fly.io
```

Production logs are structured JSON (level / time / msg / reqId / req / res); pipe them to
a log aggregator (Loki, Datadog, CloudWatch) without further processing.

### Reset (destructive)

```bash
cd /opt/termlnk-server
./deploy.sh uninstall --purge               # tears down and drops all data volumes
```

## Limitations (v1)

- No email verification email — set `REQUIRE_EMAIL_VERIFICATION=false` until you wire one in.
- Cross-instance daemon takeover (one server instance kicking another instance's daemon) is
  not implemented — daemon-replacement semantics are local-only. Multi-instance deployments
  should pin daemons to one region or use sticky sessions on the load balancer.
- Rate limiting is a per-process in-memory limiter; for a fleet you'll want an L7 WAF or a Redis-backed limiter store.
- No admin endpoints; user / refresh-token revocation is via direct SQL.
