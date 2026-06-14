## termlnk-server Dockerfile — multi-stage with non-root runtime user.
##
##   Stage 1 (deps):    cache pnpm store from lockfile (fast rebuilds when only source changes)
##   Stage 2 (builder): install full workspace, build protocol + admin-ui + server, prune to prod deps
##   Stage 3 (runtime): minimal Alpine + non-root user (uid 1001) + dist only

FROM node:22-alpine AS deps
WORKDIR /workspace
RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@10.33.4 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY internal/shared/package.json internal/shared/
COPY packages/protocol/package.json packages/protocol/
COPY apps/admin-ui/package.json apps/admin-ui/
COPY apps/server/package.json apps/server/
RUN pnpm fetch

FROM node:22-alpine AS builder
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
COPY --from=deps /workspace /workspace
COPY internal internal
COPY packages packages
COPY apps apps
COPY turbo.json ./
RUN pnpm install --offline
RUN pnpm --filter @termlnk-server/protocol build \
  && pnpm --filter @termlnk/admin-ui build \
  && pnpm --filter @termlnk/server build
# Collect prod deps into a self-contained dir. `--legacy` works around pnpm 10's
# new requirement that the source workspace declare `inject-workspace-packages`;
# our deploy target is a Node app (not a publishable library), so the legacy
# behaviour is what we want.
RUN pnpm deploy --filter @termlnk/server --prod --legacy /app/runtime

FROM node:22-alpine AS runtime
RUN addgroup -S hono && adduser -S hono -u 1001 -G hono
WORKDIR /app
COPY --from=builder --chown=hono:hono /app/runtime/node_modules ./node_modules
COPY --from=builder --chown=hono:hono /workspace/apps/server/dist ./dist
COPY --from=builder --chown=hono:hono /workspace/apps/server/package.json ./
USER hono
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
