# Changelog

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
