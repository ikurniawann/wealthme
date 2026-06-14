# Load Tests — WealthMe API

Uses [k6](https://k6.io) — a developer-centric load testing tool with a plain JavaScript runtime.

## Install k6

```bash
# macOS
brew install k6

# Ubuntu / Debian
sudo apt-get install k6

# Docker (no install required)
docker run --rm -i grafana/k6 run - <baseline.js
```

## Running the tests

### Prerequisites

1. The API must be running locally (default: `http://localhost:3001`).
2. Create a test user and obtain a JWT by calling `POST /auth/login` once, or use `TEST_EMAIL` / `TEST_PASSWORD` env vars so the script logs in itself.

### Baseline test (steady ramp)

```bash
k6 run \
  --env BASE_URL=http://localhost:3001 \
  --env TEST_TOKEN=<jwt> \
  apps/api/test/load/baseline.js
```

`TEST_TOKEN` is optional. When omitted the script logs in with `TEST_EMAIL` / `TEST_PASSWORD` on each iteration.

```bash
k6 run \
  --env BASE_URL=http://localhost:3001 \
  --env TEST_EMAIL=load-test@example.com \
  --env TEST_PASSWORD=LoadTest123! \
  apps/api/test/load/baseline.js
```

### Spike test (rate-limiter verification)

```bash
k6 run \
  --env BASE_URL=http://localhost:3001 \
  apps/api/test/load/spike.js
```

No token needed — the spike test intentionally hammers the unauthenticated `/auth/login` endpoint to verify that the ThrottlerGuard returns `429 Too Many Requests` under load.

## Expected results

| Test     | VUs        | Duration     | Target p95 latency | Target error rate |
| -------- | ---------- | ------------ | ------------------ | ----------------- |
| Baseline | 0 → 50     | ~2 min total | < 500 ms           | < 1 %             |
| Spike    | 200 (flat) | 10 s         | < 500 ms (200s)    | < 30 % (429s OK)  |

## Interpreting output

- `http_req_duration p(95)` — 95th percentile response time. Baseline threshold: **500 ms**.
- `http_req_failed` — requests that returned a network error or non-2xx. Spike allows up to **30%** because `429` responses are classified as failures by k6 but are correct behaviour.
- `checks` — inline assertions per request. Aim for 100% on baseline; spike may show ~30% `429` which is expected.

## Thresholds summary

| Metric                          | Baseline | Spike                |
| ------------------------------- | -------- | -------------------- |
| `http_req_duration` p95         | < 500 ms | < 500 ms (200s only) |
| `http_req_failed`               | < 1 %    | < 30 %               |
| Response status check (200/201) | pass     | 200/201/429 accepted |
