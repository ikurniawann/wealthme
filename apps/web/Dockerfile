# =============================================================================
# WealthMe Web — Multi-stage Dockerfile (Next.js 16 standalone)
# Build context: repo root (docker build -f apps/web/Dockerfile .)
# Uses node:20-bookworm-slim (not alpine) — required for argon2 native addon.
# NEXT_PUBLIC_* vars are inlined at build time via ARG → ENV.
# =============================================================================

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps

# Build tools required for native addons (argon2).
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /build

# Copy manifests for workspace graph resolution.
# Include apps/api/package.json because web's prisma schema points to api/prisma.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /build

# Reuse installed node_modules from deps stage.
COPY --from=deps /build/node_modules ./node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
# Copy apps/api/package.json and prisma so the generate step resolves correctly.
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

# Re-link binaries and workspace symlinks (fast: uses local cache).
RUN pnpm install --frozen-lockfile --prefer-offline

# 1) Build shared contracts so its dist/ is available to the Next.js compiler.
RUN pnpm --filter @wealthme/contracts build

# 2) Generate the Prisma client.
#    Run from apps/api dir where prisma is a devDep — avoids Prisma auto-install logic.
#    The generated client lands in the workspace node_modules, shared by web.
WORKDIR /build/apps/api
RUN pnpm exec prisma generate
WORKDIR /build

# 3) Build the Next.js app (output: standalone set in next.config.ts).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
# next build runs with NODE_ENV=production, and apps/web/src/lib/auth.ts
# constructs betterAuth() at module scope. Without a real BETTER_AUTH_SECRET,
# better-auth's production guard throws BetterAuthError during "Collecting
# page data", crashing the build. This placeholder is build-stage-only (never
# copied to the runtime stage) — the real secret is injected at container
# start via env_file in docker-compose.yml.
ARG BETTER_AUTH_SECRET=docker-build-stage-placeholder-secret-not-used-at-runtime

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}

RUN pnpm --filter web build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends wget openssl && \
    rm -rf /var/lib/apt/lists/*

# Run as a non-root user (hardening).
RUN groupadd --system appgroup && \
    useradd --system --gid appgroup --home-dir /app appuser

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output bundles the minimal server + required node_modules.
# Static assets and public dir must be placed alongside for the server to serve them.
COPY --from=build --chown=appuser:appgroup /build/apps/web/.next/standalone ./
COPY --from=build --chown=appuser:appgroup /build/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=appuser:appgroup /build/apps/web/public ./apps/web/public

USER appuser

EXPOSE 3000

# In a pnpm monorepo, the standalone entry point is at apps/web/server.js
# (relative to the standalone root, which we copied to /app).
CMD ["node", "apps/web/server.js"]
