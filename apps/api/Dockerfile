# =============================================================================
# WealthMe API — Multi-stage Dockerfile
# Build context: repo root (docker build -f apps/api/Dockerfile .)
# Uses node:20-bookworm-slim (not alpine) — required for argon2 + Prisma native engines.
# =============================================================================

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
# Install all workspace deps needed to build the api package.
FROM node:20-bookworm-slim AS deps

# OpenSSL is required by Prisma engine detection at install time.
# Build tools (python3/make/g++) are required for native addons (argon2).
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Pin pnpm version via corepack.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /build

# Copy manifests that pnpm needs to resolve the workspace graph.
# EPIC-027 — `patchedDependencies` in package.json points at patches/
# (exceljs@4.4.0.patch). pnpm reads it during install, so the directory must be
# present BEFORE `pnpm install` or the install fails with exit code 254.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY patches/ ./patches/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/

# Install all deps (including devDeps — needed for prisma generate + nest build).
RUN pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /build

# Bring over installed node_modules from deps stage.
COPY --from=deps /build/node_modules ./node_modules

# Copy workspace manifests + full source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY patches/ ./patches/
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Re-link binaries and create per-package node_modules symlinks.
RUN pnpm install --frozen-lockfile --prefer-offline

# 1) Build @wealthme/contracts so its dist/ is available to the api compiler.
RUN pnpm --filter @wealthme/contracts build

# 2) Build the api: "prisma generate && nest build".
#    Prisma schema lives at apps/api/prisma/schema.prisma (already copied above).
RUN pnpm --filter @wealthme/api build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

# OpenSSL is required by the Prisma query engine at runtime.
# wget is required for the compose healthcheck (wget -qO-).
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl wget && \
    rm -rf /var/lib/apt/lists/*

# Run as a non-root user (hardening — avoids host-level caps on breakout).
RUN groupadd --system appgroup && \
    useradd --system --gid appgroup --home-dir /app appuser

WORKDIR /app

ENV NODE_ENV=production
# pnpm hoists shared packages to .pnpm/node_modules/ rather than the root
# node_modules/.  NODE_PATH makes node resolve them without per-package symlinks,
# which is required for reflect-metadata, @prisma/client, etc. at runtime.
ENV NODE_PATH=/app/node_modules/.pnpm/node_modules

# Compiled NestJS output (nest-cli emits to apps/api/dist/).
COPY --from=build /build/apps/api/dist ./apps/api/dist

# Prisma schema + migrations (needed for the migrate service in T-1102,
# and by prisma CLI when running migrate deploy).
COPY --from=build /build/apps/api/prisma ./apps/api/prisma

# Full node_modules tree (includes Prisma query engine, argon2 native addon,
# all transitive runtime deps, and the prisma CLI for T-1102 migration runs).
COPY --from=build /build/node_modules ./node_modules

# Compiled workspace packages (@wealthme/contracts dist/ needed at runtime).
COPY --from=build /build/packages ./packages

EXPOSE 4000

# StorageDiskService writes attachments under STORAGE_DIR (/data/storage, a
# named volume — see docker-compose.yml). Create and chown it HERE, while we
# are still root: Docker auto-creates a missing mountpoint as root:root, and a
# fresh named volume inherits the ownership of the image directory it covers.
# Without this the API runs as appuser(999) against a root-owned 755 directory
# and EVERY upload fails with EACCES — silently, since the volume starts empty
# and nothing else touches it. An existing volume created before this line
# keeps its old ownership and needs a one-time
# `docker compose exec -u root api chown -R 999:999 /data/storage`.
RUN mkdir -p /data/storage && chown -R appuser:appgroup /data/storage

# Run from apps/api so relative imports in dist/main.js resolve correctly.
WORKDIR /app/apps/api

USER appuser

# apps/api package.json "start" script: "node dist/main.js"
CMD ["node", "dist/main.js"]
