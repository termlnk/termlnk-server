# Architecture

This document explains the runtime layout of `termlnk-server`, which packages depend
on which, and the rationale behind a couple of choices that look unusual at first.

## Audience

This is for contributors and self-hosters who want to extend the server. End-user
setup lives in [`self-hosting.md`](./self-hosting.md).

## Runtime in one paragraph

`apps/server/src/index.ts` is a thin Node entrypoint. It loads env, builds the
two stateful adaptors (`NodePgAdaptor` + `IoredisKVStore`), constructs a `Core`
DI container from `@termlnk-server/core`, registers the plugin chain in any
order, and calls `core.start()`. Each plugin registers its DI bindings in
`onStarting()` and mounts its Hono router under `routePrefix` in `onReady()`.
After `start()`, the Hono root app is fully wired and `@hono/node-server`
serves it; `ws` handles WebSocket upgrades for the three streaming routes.

## Package layout

```
termlnk-server/
├── apps/server/                 Node entrypoint, env loader, /sync/poke WS adapter
├── packages/
│   ├── core/                    DI container (Injector), Plugin lifecycle, Disposable
│   ├── crypto/                  IJwtService / IHmacService / ISrpService + impls
│   ├── database/                DatabasePlugin, IDBAdaptorService, NodePgAdaptor,
│   │                            drizzle PG schema, repository interfaces + impls
│   ├── kv/                      IKVStore + IoredisKVStore / MemoryKVStore
│   ├── sync-broadcast/          ISyncBroadcaster + RedisSyncBroadcaster / Memory
│   ├── rpc-server/              Hono root app, requireAuth, ws-bearer-auth,
│   │                            rate-limit, HttpError, openapi scaffolding
│   ├── protocol/                Zod schemas — shared with the desktop client
│   ├── auth/                    SRP6a + JWT + refresh-token + devices routes
│   ├── sync/                    push / pull engine + /sync/poke auth helper
│   ├── collab/                  invite create / list / revoke / claim
│   ├── shared-terminal/         /shared-terminal/ WS relay (PTY fan-out, E2EE pipe)
│   ├── multiplayer/             /multiplayer/announce + /multiplayer/signal WS
│   └── push/                    /push/register device token registry
└── internal/shared/             eslint config, tsconfig presets, vitest preset
```

## Dependency graph

```
                ┌─────────────────┐
                │      core       │   (no runtime deps; @wendellhu/redi-style DI)
                └────────┬────────┘
                         │
   ┌─────────────────────┼─────────────────────────────────────┐
   │                     │                                      │
   ▼                     ▼                                      ▼
crypto              rpc-server                              database
   │            (Hono, auth, openapi)               (drizzle pg, repos, NodePgAdaptor)
   │
   │       kv ─────────────► sync-broadcast
   │       │                       │
   ▼       ▼                       ▼
                ┌─── auth ────────────┐
                ├─── sync ────────────┤
                ├─── collab ──────────┤    feature plugins
                ├─── shared-terminal ─┤    (each mounts a routePrefix)
                ├─── multiplayer ─────┤
                └─── push ────────────┘
                         │
                         ▼
                  protocol (Zod)         (shared with desktop client repo)
                         │
                         ▼
                  apps/server (assembles all of the above)
```

Rules:

- Feature plugins (`auth` / `sync` / `collab` / `shared-terminal` / `multiplayer` /
  `push`) may import from `core`, `rpc-server`, `database/repositories`, `crypto`,
  `kv`, `sync-broadcast`, `protocol`. They MUST NOT import from each other —
  cross-feature concerns belong in a shared package, never threaded through
  another feature.
- `database/repositories` exposes interfaces only. Service code never reads
  from `entities` directly.
- `apps/server` is the only place that constructs concrete adaptors
  (`NodePgAdaptor`, `IoredisKVStore`, `RedisSyncBroadcaster`) and pre-binds
  them in the injector before plugins start.

## Plugin lifecycle

A `Plugin` subclass exposes three optional hooks (from `@termlnk-server/core`):

```
constructor(config, @InjectSelf Injector, ...services)
   └─ called by Core.registerPlugins, after the injector is created
onStarting()
   └─ called for every plugin in dependency order; the place to register
      DI bindings via registerDependencies(injector, [...])
onReady()
   └─ called for every plugin in dependency order, AFTER onStarting has
      completed for all plugins; the place to mount Hono routers
```

`@DependentOn(RpcServerPlugin, DatabasePlugin)` on a feature plugin guarantees
both are fully `onReady()` before the feature's `onStarting()` runs. That's
how registration order in `apps/server/src/index.ts` becomes irrelevant — every
feature plugin declares what it needs and the core sorts.

Two cross-cutting bindings are NOT owned by any plugin and must be pre-bound
by the entrypoint (because they're constructed from env): `IKVStore` (ioredis
client) and `ISyncBroadcaster` (Redis pub/sub adaptor). `apps/server/src/index.ts`
does `injector.add([...])` for these before `core.registerPlugins(...)`.

## Hono mount model

`RpcServerPlugin` exposes `IAppService` — a thin wrapper around the root
`OpenAPIHono` app + a `mount(prefix, router)` method. Each feature plugin
constructs its own router in `onReady()`, registers routes against it, and
calls `IAppService.mount('/v1/<feature>', router)`. The OpenAPI plugin walks
all mounted routers when serving `/openapi.json`, so adding a new feature is
genuinely a new package — no central route table.

WebSocket routes (`/sync/poke`, `/shared-terminal/`, `/multiplayer/signal`)
use `@hono/node-server`'s `upgradeWebSocket` middleware. `apps/server/src/index.ts`
constructs a single `ws.WebSocketServer({ noServer: true })` and hands it to
the Node adapter, which dispatches upgrades to the matching Hono route. The
sync poke route is wired in `apps/server/src/ws/poke.ws.ts` separately because
its upgrade also needs `ISyncService` from the DI graph.

## Persistence + cross-instance fanout

```
HTTP request
   │
   ▼
feature route handler ── reads/writes via repository interface (driver-agnostic DTOs)
   │
   ▼
PgXxxRepository ── drizzle/pg-core query against NodePgAdaptor.db
   │
   ▼
Postgres
```

```
                            sync push
                                │
                                ▼
                       Postgres write (txn)
                                │
                                ▼
              ISyncBroadcaster.publish(userId, envelope)
                                │
                                ▼              ┌── publishes on `sync:poke:<userId>`
                  RedisSyncBroadcaster ────────┤
                                               └── PG pub/sub (Redis SUB on every replica)
                                │
                                ▼
        Replica B's subscribed handler ── forwards over WebSocket to that user's poke socket
```

Single-instance self-host can swap `RedisSyncBroadcaster` for
`MemorySyncBroadcaster` to skip Redis entirely; the WS contract is
identical because both implement the same `ISyncBroadcaster` interface.

## Error envelope, logging, testing

- **Errors**: every non-2xx is `{ "error": { "code", "message?", "details?" } }`,
  validated against `errorResponseSchema` in `@termlnk-server/protocol`. Throw
  `HttpError(status, code, msg?, details?)` from anywhere in the request path.
  The validator default hook routes Zod failures into
  `HttpError(400, 'invalid_request', …)`. The runtime never leaks SQL or stack
  traces — only the generic `server_error` code escapes.
- **Logging**: `pinoLogger` middleware (from `@termlnk-server/rpc-server/pino-logger`)
  attaches a per-request `c.var.logger` bound to `requestId` (from
  `hono/request-id`). Mode is `'pretty'` for `pnpm dev`, `'json'` otherwise.
- **Tests**: each package owns colocated `*.spec.ts` files. Vitest is run via
  Turborepo (`pnpm test`). Tests use in-memory fakes for repositories and the
  KV / sync broadcaster — no Postgres or Redis needed for unit-level tests.

## Why Plugin/DI instead of factories

The codebase chose `@termlnk-server/core`'s `Plugin` + injector model over
free-standing factory closures because:

1. Feature plugins have non-trivial dependencies (auth + sync + WS) that compose
   through multiple layers. Threading dependency closures through 4-5 layers
   becomes the bulk of the code.
2. The desktop client uses the same DI library, so the protocol package's Zod
   schemas + the service interfaces (`ISyncService`, `IAuthService`, etc.) read
   the same on both sides of the wire.
3. `@DependentOn` ordering replaces hand-written "register in this order"
   comments at the entrypoint — adding a new plugin just declares what it needs.

## Adding a new feature

1. Create `packages/<feature>/` with a `Plugin` subclass, a controller that
   takes `IAppService` in `onReady()`, and a routes module that uses
   `createRoute({ method, path, request, responses })` from `@hono/zod-openapi`.
2. Add schemas to `packages/protocol/src/<feature>.ts`. The desktop client
   imports the same module.
3. Register the plugin in `apps/server/src/index.ts`. Order doesn't matter
   thanks to `@DependentOn`.
4. If the feature needs a new table: add an entity under
   `packages/database/src/entities/`, declare a repository interface in
   `packages/database/src/repositories/`, implement it under
   `packages/database/src/implementations/`, register it in
   `DatabasePlugin._registerDependencies()`, then `pnpm db:generate` to emit
   a new drizzle migration.
