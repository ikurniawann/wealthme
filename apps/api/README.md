# @wealthme/api (placeholder)

NestJS modular-monolith backend. Scaffolded in **Epic 1 · Backend foundation**
(`nest new` here) per `docs/WealthMe_Backend_Plan.md`.

## Environment

Copy `.env.example` to `.env` before running the API:

```bash
cp apps/api/.env.example apps/api/.env
```

### Required variables

| Variable             | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `NODE_ENV`           | Runtime environment (`development`, `test`, `production`)       |
| `PORT`               | HTTP server port (default `4000`)                               |
| `DATABASE_URL`       | PostgreSQL connection URL                                       |
| `REDIS_URL`          | Redis connection URL                                            |
| `JWT_SECRET`         | Secret for signing JWT access tokens — **replace placeholder**  |
| `JWT_REFRESH_SECRET` | Secret for signing JWT refresh tokens — **replace placeholder** |

### Optional variables

| Variable                 | Default     | Description                    |
| ------------------------ | ----------- | ------------------------------ |
| `JWT_EXPIRES_IN`         | `15m`       | Access token expiry            |
| `JWT_REFRESH_EXPIRES_IN` | `7d`        | Refresh token expiry           |
| `MINIO_ENDPOINT`         | —           | S3-compatible storage endpoint |
| `MINIO_ACCESS_KEY`       | —           | MinIO / S3 access key          |
| `MINIO_SECRET_KEY`       | —           | MinIO / S3 secret key          |
| `MINIO_BUCKET`           | —           | Default upload bucket          |
| `MAIL_HOST`              | `localhost` | SMTP host                      |
| `MAIL_PORT`              | `1025`      | SMTP port                      |
| `MAIL_USER`              | —           | SMTP username                  |
| `MAIL_PASS`              | —           | SMTP password                  |
| `MAIL_FROM`              | —           | Sender address                 |

> A Zod-validated `ConfigModule` (NestJS config) that enforces these variables
> at startup is scaffolded as part of **Epic 1 · Backend foundation**.

Planned domain modules: `auth`, `users`, `family`, `accounts`, `transactions`,
`categories`, `budgets`, `goals`, `investments`, `assets`, `liabilities`,
`insurance`, `inheritance`, `donations`, `tax`, `split-bills`, `notifications`,
`reports` + integration ports (`ocr`, `banking`, `market-data`, `fx`, `ai`,
`storage`, `notifications`).
