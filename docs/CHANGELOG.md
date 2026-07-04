# Changelog

## [0.4.1](https://github.com/termlnk/termlnk-server/compare/v0.4.0...v0.4.1) (2026-07-04)


### Features

* **admin:** clear user sync resources ([0624cd3](https://github.com/termlnk/termlnk-server/commit/0624cd3e671856f985c1b1a11b6a8fc95622ed43))
* **auth:** add password change endpoint with device revocation ([ebb796b](https://github.com/termlnk/termlnk-server/commit/ebb796b2777db7375f203c07d93436ec0b1e01c1))

# [0.4.0](https://github.com/termlnk/termlnk-server/compare/v0.3.0...v0.4.0) (2026-06-15)


### Features

* **admin:** add admin dashboard with user management, stats and auth ([449cfa2](https://github.com/termlnk/termlnk-server/commit/449cfa292cb61b56c6d9eb1ccc6c792647c67a79))
* **protocol:** add port_forwarding_rule sync resource ([a851994](https://github.com/termlnk/termlnk-server/commit/a851994c4292a7991483407635024ac42ba47098))
* **protocol:** add snippet sync resource ([28af9a8](https://github.com/termlnk/termlnk-server/commit/28af9a81d3ace25fc9fad67e428e45672441d52e))

# [0.3.0](https://github.com/termlnk/termlnk-server/compare/v0.2.4...v0.3.0) (2026-06-05)


### Features

* **protocol:** add ssh_key, identity and known_host sync resources ([0e4d637](https://github.com/termlnk/termlnk-server/commit/0e4d637b89d3310c27e6fea4f2dbdecde215bf6b))
* **shared-terminal:** relay notifies daemon on participant leave ([82f1431](https://github.com/termlnk/termlnk-server/commit/82f14315a331281bb225deef314fda07e680cc99))

## [0.2.4](https://github.com/termlnk/termlnk-server/compare/v0.2.3...v0.2.4) (2026-05-31)


### Features

* **auth:** add Google OAuth web sign-in flow and completion landing pages ([eb3d0f5](https://github.com/termlnk/termlnk-server/commit/eb3d0f5f8a80bedd5c593627cab189d8c7e4bc05))

## [0.2.3](https://github.com/termlnk/termlnk-server/compare/v0.2.2...v0.2.3) (2026-05-31)


### Features

* **auth:** add Google OAuth sign-in with decoupled E2E vault ([a868b09](https://github.com/termlnk/termlnk-server/commit/a868b096021b27d5dbb0cd10a717cba2a7de7da6))
* **deploy:** wire Google OAuth env through docker and fly ([e393101](https://github.com/termlnk/termlnk-server/commit/e393101eb10ff2cf5f6b07d9c3c98c5ea7438478))

## [0.2.2](https://github.com/termlnk/termlnk-server/compare/v0.2.1...v0.2.2) (2026-05-27)


### Bug Fixes

* **relay:** evict joiners only on explicit daemon shutdown, not socket blips ([5db766e](https://github.com/termlnk/termlnk-server/commit/5db766ef7b6866bc0c830282952e80e9da0b8a3f))
* **sync:** scope HTTP auth to push/pull so WS poke route keeps subprotocol auth ([c19eac2](https://github.com/termlnk/termlnk-server/commit/c19eac213a7c081ddf312a900ccc57d681ea009d))

## [0.2.1](https://github.com/termlnk/termlnk-server/compare/v0.2.0...v0.2.1) (2026-05-24)


### Features

* **collab:** mint relay-claim token for cross-account session attach ([598b9ee](https://github.com/termlnk/termlnk-server/commit/598b9ee65ed12f4585282998f02852e3610f56fe))
* **multiplayer:** ship configurable ICE servers via signaling ready ([d768eda](https://github.com/termlnk/termlnk-server/commit/d768eda8a4eb175a53fe1c370bf8e6db37b4b8b1))

# [0.2.0](https://github.com/termlnk/termlnk-server/compare/v0.1.0...v0.2.0) (2026-05-22)


### Features

* **collab:** serve invite landing page at /s/:inviteId ([a29f5de](https://github.com/termlnk/termlnk-server/commit/a29f5de87c09c61603adb011d31b4d4e3cdd2f37))
* **sync:** return per-mutation server version in push acceptedDetails ([a643d50](https://github.com/termlnk/termlnk-server/commit/a643d501e75b8877aa0f898f664da89b649331a4))

# 0.1.0 (2026-05-21)


### Bug Fixes

* **deploy:** split Caddy into docker-compose.https.yml overlay ([3aa9e8f](https://github.com/termlnk/termlnk-server/commit/3aa9e8f154dc00e00f4da49157da78cfcbe1bc02)), closes [docker/compose#13340](https://github.com/docker/compose/issues/13340)
* **install:** drop `exec </dev/tty` that hangs `curl | bash` ([bb92788](https://github.com/termlnk/termlnk-server/commit/bb92788ea062d2587c536e11871f16196a06d3e3))


### Features

* init ([4534212](https://github.com/termlnk/termlnk-server/commit/4534212e9ee6c1c57e81a5b115b12dada7100792))
* **install:** auto-fall-back to HTTP-only in non-interactive runs ([171df76](https://github.com/termlnk/termlnk-server/commit/171df7682a108bdb71183ceb0bb4088353caa267))

All notable changes to termlnk-server are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and entries are
generated automatically by [release-it](https://github.com/release-it/release-it)
from [Conventional Commits](https://www.conventionalcommits.org/).
