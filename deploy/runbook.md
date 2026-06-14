# WealthMe On-Call Runbook

Last updated: 2026-06-14

---

## Service Management

All commands assume you are in the `deploy/` directory with a valid `.env` file present.

### Start all services

```bash
docker compose up -d
```

### Stop all services

```bash
docker compose down
```

### Restart a single service

```bash
docker compose restart api
docker compose restart web
docker compose restart db
docker compose restart redis
```

### View running containers

```bash
docker compose ps
```

---

## Health Checks

| Endpoint            | Expected response     | Checks                          |
| ------------------- | --------------------- | ------------------------------- |
| `GET /health`       | `200 {"status":"ok"}` | API process alive, DB reachable |
| `GET /health/redis` | `200 {"status":"ok"}` | Redis ping reachable            |

Quick curl check:

```bash
curl -sf http://localhost:3001/health && echo "API OK"
curl -sf http://localhost:3001/health/redis && echo "Redis OK"
```

---

## Log Access

### Stream live API logs

```bash
docker compose logs -f api
```

### Stream all service logs

```bash
docker compose logs -f
```

### Last 100 lines from a service

```bash
docker compose logs --tail=100 api
docker compose logs --tail=100 db
```

Logs are structured JSON (pino). To pretty-print:

```bash
docker compose logs -f api | npx pino-pretty
```

---

## Database Backup

### Create a backup now

```bash
# From repo root — env vars are read from deploy/.env or your shell
source deploy/.env && bash deploy/backup.sh
```

Backups are written to `deploy/backups/wealthme_YYYYMMDD_HHMMSS.sql.gz`.
The script keeps the **last 7 backups** and deletes older ones automatically.

### Restore from a backup

```bash
# 1. Identify the backup file
ls -lh deploy/backups/

# 2. Restore (replaces current data)
PGPASSWORD="${POSTGRES_PASSWORD}" gunzip -c deploy/backups/wealthme_<timestamp>.sql.gz \
  | psql \
    --host="${POSTGRES_HOST}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}"
```

> WARNING: Restore overwrites all existing data. Take a fresh backup first.

---

## Common Issues

### API container does not start

1. Check logs: `docker compose logs api`
2. Confirm `.env` exists in `deploy/` and contains all required variables (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, etc.)
3. Confirm `db` and `redis` are healthy: `docker compose ps`
4. Run `docker compose up db redis -d` first, wait for health checks, then `docker compose up api -d`

### Redis connection failure

Symptom: `health/redis` returns non-200, or logs show `ECONNREFUSED`.

1. Check Redis container: `docker compose ps redis`
2. Restart Redis: `docker compose restart redis`
3. Verify `REDIS_URL` in `.env` matches the service name (`redis://redis:6379`)

### Database migration needed

After a deployment that includes schema changes:

```bash
docker compose exec api npx prisma migrate deploy
```

Or run the migration before starting the API:

```bash
docker compose run --rm api npx prisma migrate deploy
docker compose up -d api
```

### API returns 429 Too Many Requests for all routes

The ThrottlerGuard limits to 100 requests per minute per IP. This is expected under load.

- If triggered by legitimate traffic, the rate limit can be adjusted via `THROTTLE_LIMIT` and `THROTTLE_TTL` env vars.
- If triggered by a single IP hammering the service, this is the rate limiter working correctly — no action needed.

### Out-of-disk space (backups)

The backup script retains 7 backups. If disk is full:

```bash
ls -lh deploy/backups/
# Manually remove old files if needed
rm deploy/backups/wealthme_<old_timestamp>.sql.gz
```

---

## Escalation Path

| Severity      | Condition                                                | Action                                                      |
| ------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| P1 — Critical | API down, data loss risk, security breach                | Page on-call engineer immediately via PagerDuty / team chat |
| P2 — High     | Repeated 5xx errors, Redis down > 5 min                  | Notify on-call engineer within 15 min                       |
| P3 — Medium   | Elevated latency (p95 > 2s), single service restart loop | Create issue, notify team in Slack #incidents               |
| P4 — Low      | Single intermittent error, cosmetic bug                  | Create GitHub issue, no immediate page                      |

**On-call contact:** Check the team's PagerDuty rotation or `#on-call` Slack channel for the current responder.
