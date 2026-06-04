# termlnk-server

Open-source, self-host-friendly cloud backend for [Termlnk](https://github.com/<org>/termlnk):

- **Auth**: SRP6a zero-knowledge login + JWT (access + refresh, rotated on refresh)
- **Sync**: per-row monotonic version + per-client mutation log + WebSocket poke (cross-instance via Redis pub/sub)
- **Shared-terminal relay**: WebSocket session relay; multi-instance frame routing via Redis
- **Multiplayer**: same-account device announcements + WebRTC signalling (PG index + Redis change events)
- **Collab invites**: capability-only persistence + atomic claim (single-use enforced server-side)
- **Push tokens**: device registry for mobile invite notifications
- **Zero-knowledge**: server only sees E2EE ciphertext (XChaCha20-Poly1305 per client)
- **OpenAPI**: live `/openapi.json` + Scalar UI at `/docs`

The desktop client (`termlnk` repo) defines the wire format; this repo implements the server.

Runtime targets Node 22+ with Postgres 15+ and Redis 7+. Single-host self-host via Docker Compose is the default; multi-replica deployments add a managed Postgres + Redis behind the same image.

## Layout

```
termlnk-server/
├── apps/
│   └── server/                       Node entrypoint (Hono + @hono/node-server + ws)
│       └── src/
│           ├── index.ts              Build Core, register plugins, serve()
│           ├── env.ts                Zod-validated env
│           ├── db/migrate.ts         drizzle migration runner
│           └── ws/poke.ws.ts         Sync poke upgrade adapter
├── packages/
│   ├── core/                         DI container, Plugin lifecycle, Disposable
│   ├── rpc-server/                   Hono root app, requireAuth / createWsBearerAuthMiddleware,
│   │                                 HttpError, IAppService, OpenAPI scaffolding
│   ├── auth/                         SRP6a + JWT plugin
│   ├── sync/                         Sync engine + WS poke auth helper
│   ├── sync-broadcast/               Redis pub/sub adapter for cross-instance sync events
│   ├── shared-terminal/              Shared-session domain (one plugin, split by service):
│   │                                 relay WS (`/v1/shared-terminal`), collab invites
│   │                                 (`/v1/collab`, `/s`), multiplayer announce + WebRTC
│   │                                 signalling (`/v1/multiplayer`)
│   ├── push/                         Push-notification device registry
│   ├── crypto/                       JWT, HMAC, SRP service interfaces + implementations
│   ├── database/                     Drizzle schema (PG) + repository interfaces + node-pg adaptor
│   ├── kv/                           ioredis-backed TTL key-value abstraction
│   └── protocol/                     Zod schemas — single source of truth for wire format
├── internal/shared/                  eslint, tsconfig presets, vitest preset
├── deploy/
│   ├── docker/                       Dockerfile + compose + install.sh / deploy.sh + Caddyfile
│   └── fly/                          fly.toml for Fly.io
└── docs/
    ├── self-hosting.md
    └── architecture.md
```

> **Plugin-based architecture.** Each feature is a workspace package that exports
> a `Plugin` class. `apps/server/src/index.ts` builds a `Core` and registers
> the plugin chain; `@DependentOn` ordering guarantees `RpcServerPlugin` +
> `DatabasePlugin` boot before feature plugins. Every plugin mounts its own
> Hono router under a `routePrefix` in `onReady()`, so adding a new feature is
> a new package — no central route table to edit.

## HTTP / WS surface

| Path | Method | Owner | Auth |
|---|---|---|---|
| `/v1/auth/register` | POST | auth | open or token (config) |
| `/v1/auth/srp/init` + `/srp/verify` | POST | auth | — |
| `/v1/auth/refresh` | POST | auth | refresh token |
| `/v1/auth/me` | GET | auth | Bearer |
| `/v1/auth/devices` | GET | auth | Bearer |
| `/v1/auth/devices/:id/revoke` | POST | auth | Bearer |
| `/v1/auth/logout` | POST | auth | Bearer |
| `/v1/sync/push` + `/sync/pull` | POST | sync | Bearer |
| `/v1/sync/poke` | WS | sync | Bearer-via-Subprotocol |
| `/v1/collab/invite` | POST/GET | shared-terminal | Bearer |
| `/v1/collab/invite/:id/revoke` | POST | shared-terminal | Bearer |
| `/v1/collab/invite/:id/claim` | POST | shared-terminal | Bearer (joiner) |
| `/v1/shared-terminal/` | WS | shared-terminal | Bearer-via-Subprotocol |
| `/v1/multiplayer/announce` | POST | shared-terminal | Bearer |
| `/v1/multiplayer/announce/:sid` | DELETE | shared-terminal | Bearer + `x-termlnk-device-id` |
| `/v1/multiplayer/sessions` | GET | shared-terminal | Bearer |
| `/v1/multiplayer/signal` | WS | shared-terminal | Bearer-via-Subprotocol |
| `/v1/push/register` | POST/DELETE | push | Bearer |
| `/health` | GET | apps/server | — |
| `/openapi.json` + `/docs` | GET | rpc-server | — |

## Quick start — Docker (recommended for self-host)

One-line install on any Linux box with Docker 24+ (or install it as part of the script):

```bash
# HTTP only (binds 4000 on the host, no TLS — fine for behind your own proxy):
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk-server/main/deploy/docker/install.sh | bash

# Or with a public domain + auto-HTTPS via Caddy (Let's Encrypt):
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk-server/main/deploy/docker/install.sh \
  | bash -s -- --domain sync.example.com --email you@example.com
```

The script:

- detects (and on Linux can install) Docker + Compose v2
- creates `/opt/termlnk-server` (or `$HOME/.termlnk-server` when not root)
- fetches `docker-compose.yml`, `Caddyfile`, `.env.example`, `deploy.sh`
- generates JWT secrets + Postgres password into a `chmod 600` `.env`
- pulls the multi-arch image from `ghcr.io/termlnk/termlnk-server` (no source clone, no local build)
- starts Postgres + Redis + server (+ Caddy if a domain was given) and waits for `/health`

Override via flags or env: `--version v0.1.0`, `--dir /srv/termlnk`, `--yes` (non-interactive), `TERMLNK_INSTALL_DIR`, `TERMLNK_VERSION`.

### Managing your instance

After install, everything goes through the `deploy.sh` that the installer placed next to your compose file:

```bash
cd /opt/termlnk-server           # or wherever you installed
./deploy.sh status               # docker compose ps
./deploy.sh logs server          # tail server logs
./deploy.sh update               # pull latest image and recreate containers
./deploy.sh backup               # pg_dump → ./backups/termlnk-<timestamp>.sql.gz
./deploy.sh restore <file>       # restore from a backup (DESTRUCTIVE)
./deploy.sh restart              # restart the stack
./deploy.sh stop                 # stop (preserves data)
./deploy.sh uninstall            # remove containers, keep volumes
./deploy.sh uninstall --purge    # also drop Postgres + Redis data (DESTRUCTIVE)
```

Edit `.env` and run `./deploy.sh restart` to apply changes (e.g. flipping `ALLOW_OPEN_REGISTRATION`).

## Quick start — Fly.io

```bash
# 1) Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly launch --copy-config --config deploy/fly/fly.toml --no-deploy
fly postgres create && fly postgres attach <app>
fly redis create
fly secrets set \
  JWT_ACCESS_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))")" \
  JWT_REFRESH_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))")"
fly deploy --config deploy/fly/fly.toml
```

See [`docs/self-hosting.md`](./docs/self-hosting.md) for the full guide.

## Quick start — local dev

```bash
pnpm install
pnpm docker:bootstrap                                                            # writes .env with fresh JWT secrets
docker compose --env-file .env -f deploy/docker/docker-compose.yml up -d postgres redis
pnpm db:migrate
pnpm dev
# Pretty logs on stdout; pnpm dev defaults to NODE_ENV != production -> pino-pretty
```

## Scripts (root)

| Script | Purpose |
|---|---|
| `pnpm dev` | Hot-reloading server (filters `@termlnk/server`) |
| `pnpm build` | Turbo-orchestrated build (`protocol` → `server`) |
| `pnpm typecheck` | Turbo-orchestrated tsc --noEmit across the workspace |
| `pnpm test` | Turbo-orchestrated vitest across the workspace |
| `pnpm lint` / `pnpm lint:fix` | Repo-wide ESLint (with the antfu config + custom presets) |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle schema generation / migrations |
| `pnpm docker:bootstrap` | Generate `.env` with fresh JWT secrets if missing |
| `pnpm docker:build` / `pnpm docker:up` / `pnpm docker:down` | Local-build Compose dev workflow (uses `docker-compose.build.yml` override) |
| `pnpm docker:logs` | Tail logs from the dev compose stack |

## Architecture details

- [`docs/architecture.md`](./docs/architecture.md) — plugin/DI architecture, package boundaries, deployment model
- [`packages/protocol/src/`](./packages/protocol/src) — Zod schemas; authoritative source for request / response shapes

## License

PolyForm Noncommercial 1.0.0. Use of the software for any commercial purpose is prohibited.
