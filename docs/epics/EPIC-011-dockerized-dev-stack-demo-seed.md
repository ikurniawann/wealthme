# EPIC-011: Dockerized Dev Stack + Centralized Env + Demo Seed Parity

status: on-progress
environment: dev
retries: 0

## Goal

Make the full WealthMe stack (web + api + postgres + redis + minio + mailhog)
runnable as containers locally **and** on a real development server with
identical contents, driven by a single centralized `.env`, with database
**migrate + seed run automatically by docker compose**. The seeded
`demo@wealthme.id` user must populate **every** app menu via the API, so a
container run shows the same data a developer sees with `pnpm dev`.

Source request (verbatim, ID): "sekarang tambahkan data migration untuk user
demo@wealthme.id ini agar seluruh menu ter isi via api. lalu setelah migration
sudah rapih, saya ingin coba run web api db redis dari local tapi menggunakan
container (asumsikan akan saya deploy ke server development real) untuk demo ke
user, pastikan untuk penggunaan .env untuk web dan api sebisa mungkin di satu
tempat terpusat. buat agar nantinya di server development isinya sama ketika saya
run di localhost menggunakan pnpm dev. jangan lupa untuk migrate dan seed juga di
docker compose"

## Decisions (user-approved 2026-06-17)

- **Env**: single gitignored root `.env` (+ committed `.env.example`) is the one
  source of truth. `pnpm dev` loads it into both apps; compose uses
  `env_file: .env`. Per-app `.env`/`.env.local` removed (web keeps only
  `NEXT_PUBLIC_*` derived from root).
- **Compose**: root `docker-compose.yml` is the single canonical stack for both
  local-demo and the dev server; `docker-compose.override.yml` holds local-only
  tweaks; `deploy/` is reconciled/retired so local == server.
- **Seed in compose**: a one-shot `migrate` service runs
  `prisma migrate deploy` + `prisma db seed` before `api` starts.

## Evidence Map

- Monorepo: pnpm@9 + turbo; `apps/web` (Next.js 16), `apps/api` (NestJS +
  Prisma), `packages/config` (`@wealthme/config`).
- Existing seed: `apps/api/prisma/seed.ts` (1793 lines) → `demo@wealthme.id` /
  `demo1234`, 6 months of data across most models.
- Root `docker-compose.yml` already defines postgres/redis/minio/mailhog/api/web
  BUT references **non-existent** `apps/api/Dockerfile` & `apps/web/Dockerfile`,
  and has **no** migrate/seed step.
- `deploy/docker-compose.yml` diverges (api `:3001`, prebuilt images,
  `env_file: .env`) from root (api `:4000`, builds) → parity risk.
- Env scattered: root `.env`/`.env.example`, `apps/api/.env`/`.env.example`,
  `apps/web/.env`/`.env.local`/`.env.example`, `deploy/.env.example`.
- Seed gaps: `BankSync`/`BankSyncEntry` (Rekonsiliasi Bank) not seeded; audit
  other menus for empty API responses.

## Risks

- Next.js 16 Docker image needs `output: "standalone"` + correct env inlining of
  `NEXT_PUBLIC_*` at build time.
- Centralizing env can break `pnpm dev` if Next no longer finds its vars — must
  verify both modes.
- Prisma seed is `upsert`-based (idempotent) — confirm re-running in compose is
  safe.
- Secrets must never be committed; only `.env.example` is tracked.

## Tasks

- [x] T-1101 Dockerfiles + centralized root `.env`
- [x] T-1102 Compose: auto migrate+seed + local/server parity
- [ ] T-1103 Seed gap-fill so every menu is API-populated
- [ ] T-1104 Dev-server runbook + parity verification

---

### T-1101 Dockerfiles + centralized root .env

**Goal**: Buildable api/web images + a single root `.env` consumed by both
`pnpm dev` and compose.

**Scope**:

- Create `apps/api/Dockerfile` (multi-stage: deps → build → runtime; runs Prisma
  generate; small runtime image).
- Create `apps/web/Dockerfile` (multi-stage; Next.js `output: "standalone"`;
  inline `NEXT_PUBLIC_*` at build).
- Add `.dockerignore`(s).
- Centralize env: root `.env` + `.env.example` as source of truth; wire
  `pnpm dev` to load root `.env` (dotenv-cli/turbo passthrough); remove per-app
  `.env`/`.env.local` (keep `.example` pointers or delete with note).
- Update `apps/web/next.config` for standalone output if needed.

**Acceptance Criteria**:

- `docker build` succeeds for both images.
- `pnpm dev` still boots web+api reading only the root `.env`.
- No secrets committed; only `.env.example` tracked; `.env` gitignored.

**Test Plan**: `pnpm dev` smoke (web :3000, api :4000 /health); `docker build`
both images; `bash scripts/security-check.sh` (no committed secrets).

**Agent Routing**: ECC `typescript-reviewer` + `security-reviewer`;
`vercel:nextjs` for standalone output; project `security-agent`.

**Done Signal**: both images build; `pnpm dev` parity confirmed; gates green.

---

### T-1102 Compose: auto migrate+seed + local/server parity

**Goal**: One canonical compose that migrates+seeds automatically and is
identical for local and dev server.

**Scope**:

- Add one-shot `migrate` service: `prisma migrate deploy && prisma db seed`,
  `depends_on` postgres healthy; `api` depends on `migrate` completion.
- `env_file: .env` for all services; remove duplicated inline env where the root
  `.env` covers it.
- Add `docker-compose.override.yml` for local-only tweaks; keep base portable to
  the dev server.
- Reconcile/retire `deploy/docker-compose.yml` + `deploy/.env.example` so server
  == local (ports, services, image build).

**Acceptance Criteria**:

- `docker compose up` from clean volumes brings up the full stack, runs
  migrate+seed once, and web shows demo data.
- Same compose works for the dev server (documented overrides only).

**Test Plan**: `docker compose down -v && docker compose up` clean run; confirm
migrate+seed logs; hit web :3000 + api :4000.

**Agent Routing**: ECC `database-reviewer` (migrate/seed safety) +
`security-reviewer`; project `security-agent`, `deploy-agent` (DEV).

**Done Signal**: clean `up` yields a fully-seeded, browsable app.

---

### T-1103 Seed gap-fill so every menu is API-populated

**Goal**: `demo@wealthme.id` populates every menu via API.

**Scope**:

- Audit each page/menu's API calls vs seeded models; list empties.
- Add missing seed data (at minimum `BankSync`/`BankSyncEntry` for Rekonsiliasi
  Bank; any other empty menu).
- Keep seed idempotent (`upsert`).

**Acceptance Criteria**: every left-nav menu shows non-empty API data for the
demo user; `seed.spec.ts` passes.

**Test Plan**: run seed; click through all menus (Playwright/manual);
`apps/api` seed test.

**Agent Routing**: ECC `database-reviewer`; `review-qa-agent` for menu coverage.

**Done Signal**: no empty menus for the demo user.

---

### T-1104 Dev-server runbook + parity verification

**Goal**: Documented, repeatable dev-server bring-up identical to localhost.

**Scope**:

- Update `deploy/runbook.md` for the canonical compose + centralized `.env`
  workflow (build, migrate+seed, up).
- Add a parity check (localhost containers == `pnpm dev` contents).
- DEV deploy via `scripts/deploy-dev.sh` (no production).

**Acceptance Criteria**: following the runbook on a fresh host reproduces the
seeded demo stack.

**Test Plan**: dry-run runbook locally; `bash scripts/test.sh`.

**Agent Routing**: `deploy-agent`, `doc-updater`.

**Done Signal**: runbook reproduces the demo; epic → `ready-for-qa`.

## Acceptance Criteria (epic)

- Single root `.env` drives both `pnpm dev` and docker compose.
- `docker compose up` (clean) auto-migrates + seeds and serves a fully-populated
  app for `demo@wealthme.id`.
- Local containers and the dev server produce identical contents.
- No secrets committed; production deploy remains manual.

## Automation Log

### T-1102 — DONE (2026-06-17)

- Rewrote root `docker-compose.yml`: single canonical stack; `env_file:[.env]` on
  api/web/migrate; per-service service-name URL overrides (DATABASE_URL→postgres,
  REDIS_URL→redis, MINIO_ENDPOINT→minio, MAIL_HOST→mailhog, API_URL→api, etc.).
- NEW one-shot `migrate` service (pnpm virtual-store binaries: prisma + tsx);
  `restart:"no"`; depends_on postgres healthy; api depends_on migrate
  `service_completed_successfully`.
- NEW `docker-compose.override.yml` publishes infra ports (postgres/redis/minio/
  mailhog) for LOCAL dev only; base keeps them unexposed for the server.
- Reconciled `deploy/docker-compose.yml` → thin server overlay; aligned
  `deploy/.env.example` to BETTER*AUTH*\* (app uses better-auth, not next-auth).
- NEW migration `20260617000001_add_missing_schema_drift` (Better Auth tables,
  users.emailVerified/image, budgets/goals/notifications/split_bills/bank_syncs).
- Dockerfile fixes: api `NODE_PATH` (pnpm virtual store), web runtime `openssl`.
- Verification: clean `down -v` + `up -d --build` → migrate ran all migrations +
  seed exited 0; `curl :4000/health` ok; `curl :3000/` → 200; second `up`
  proved idempotency ("No pending migrations").
- Gates: ECC database-reviewer PASS (migration matches schema; BIGINT money; FK
  cascades). ECC security-reviewer CONDITIONAL→addressed: removed dead
  `GoogleStrategyDisabled` class (illusory disable guard — kept the safe
  `|| "disabled"` boot fallback); restored `.email()`/`.url()` on
  `NOTIFICATION_FROM_EMAIL`/`SENTRY_DSN`. No secrets; infra ports local-only.
- **CAVEAT (documented):** `prisma migrate deploy` of the drift migration ERRORs
  on a PRE-EXISTING dev DB where those tables already exist. Fresh-volume path:
  `docker compose down -v` then `up`. Keep-data path:
  `prisma migrate resolve --applied 20260617000001_add_missing_schema_drift`.
  Goes in the T-1104 runbook.
- Deferred (pre-existing, not introduced): missing FK indexes on `account.userId`,
  `session.familyGroupId`, `bank_sync_entries.matchedTxId/suggestedTxId`.
- Merged: T-1102 code via PR #164; epic-doc updates + security fixes via the
  T-1102 security follow-up PR.

### T-1101 — DONE (2026-06-17)

- Created `apps/api/Dockerfile` + `apps/web/Dockerfile` (multi-stage,
  `node:20-bookworm-slim` for argon2/Prisma native deps), root `.dockerignore`,
  Next.js `output: "standalone"`.
- Centralized env: root `.env`/`.env.example` is the single source of truth.
  API `ConfigModule` gains `envFilePath: ["../../.env", ".env"]`; api prisma
  scripts prefixed with `dotenv -e ../../.env --`; web `next.config.ts` loads
  root `.env` via `dotenv` (no override). Deleted `apps/api/.env`,
  `apps/web/.env`, `apps/web/.env.local`; per-app `.env.example` → pointer stubs.
- Hardening from security gate applied: non-root `USER appuser` in both runtime
  images; inert MinIO placeholders in `.env.example`; explicit `.env.example`
  exclusions in `.dockerignore`.
- Gates: `tsc --noEmit` (api+web) PASS; ECC typescript-reviewer PASS; ECC
  security-reviewer CONDITIONAL→addressed (1 HIGH root-user + 2 MEDIUM fixed;
  1 LOW pre-existing `console.log` reset-URL in `apps/web/src/lib/auth.ts` left
  for a separate cleanup); both `docker build`s SUCCESS (post-hardening rebuild
  green). `security-check.sh` red only on pre-existing `ws` advisory baseline.
- Note for T-1102: root `docker-compose.yml` web service still sets `NEXTAUTH_*`
  but the app uses `better-auth` (`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`) —
  reconcile when rewriting compose.
