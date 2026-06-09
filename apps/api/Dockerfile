# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages packages
COPY apps/api apps/api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
WORKDIR /app/apps/api
RUN pnpm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages packages
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built app from builder
COPY --from=builder /app/apps/api/dist /app/apps/api/dist

# Generate Prisma client
WORKDIR /app/apps/api
RUN pnpm exec prisma generate

# Expose port
EXPOSE 4000

# Start app
CMD ["node", "dist/main.js"]
