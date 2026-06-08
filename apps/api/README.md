# @wealthme/api

NestJS modular-monolith backend for WealthMe personal finance platform.

## Getting started

Copy `.env.example` to `.env` before running the API:

```bash
cp apps/api/.env.example apps/api/.env
```

Start dependent services (Postgres 17 + Redis):

```bash
pnpm db:up
```

Run in development mode:

```bash
pnpm api dev
```

## Scripts

| Script  | Command              | Description                   |
| ------- | -------------------- | ----------------------------- |
| `build` | `nest build`         | Compile TypeScript to `dist/` |
| `dev`   | `nest start --watch` | Watch-mode dev server         |
| `start` | `node dist/main.js`  | Run compiled output           |
| `lint`  | `eslint`             | Lint with shared flat config  |
| `test`  | `jest`               | Run unit tests                |

## Endpoints

| Method | Path        | Description                     |
| ------ | ----------- | ------------------------------- |
| GET    | `/health`   | Health check (no DB dependency) |
| GET    | `/api/docs` | Swagger / OpenAPI UI            |

## Environment variables

| Variable                 | Required | Default                 | Description                          |
| ------------------------ | -------- | ----------------------- | ------------------------------------ |
| `NODE_ENV`               | yes      | `development`           | Runtime environment                  |
| `PORT`                   | yes      | `4000`                  | HTTP server port                     |
| `WEB_ORIGIN`             | no       | `http://localhost:3000` | Allowed CORS origin                  |
| `DATABASE_URL`           | no       | —                       | PostgreSQL URL (Prisma — Epic 2)     |
| `REDIS_URL`              | no       | —                       | Redis URL (BullMQ — later epic)      |
| `JWT_SECRET`             | no       | —                       | JWT access token secret (Epic 3)     |
| `JWT_REFRESH_SECRET`     | no       | —                       | JWT refresh token secret (Epic 3)    |
| `JWT_EXPIRES_IN`         | no       | `15m`                   | Access token expiry                  |
| `JWT_REFRESH_EXPIRES_IN` | no       | `7d`                    | Refresh token expiry                 |
| `MINIO_*`                | no       | —                       | Object storage (enabled per feature) |
| `MAIL_*`                 | no       | —                       | SMTP mail (enabled per feature)      |

Planned domain modules: `auth`, `users`, `family`, `accounts`, `transactions`,
`categories`, `budgets`, `goals`, `investments`, `assets`, `liabilities`,
`insurance`, `inheritance`, `donations`, `tax`, `split-bills`, `notifications`,
`reports` + integration ports (`ocr`, `banking`, `market-data`, `fx`, `ai`,
`storage`, `notifications`).
