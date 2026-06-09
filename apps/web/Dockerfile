# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages packages
COPY apps/web apps/web

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
WORKDIR /app/apps/web
RUN pnpm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages packages
COPY apps/web/package.json apps/web/
COPY apps/web/public apps/web/public
COPY apps/web/next.config.ts apps/web/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built app from builder
COPY --from=builder /app/apps/web/.next /app/apps/web/.next

# Expose port
EXPOSE 3000

# Start app
CMD ["pnpm", "--filter", "web", "start"]
