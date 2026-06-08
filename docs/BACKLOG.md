# WealthMe — Roadmap & Backlog

Sumber data board: [`scripts/backlog.json`](../scripts/backlog.json) · dibuat otomatis ke
GitHub Projects via [`scripts/setup-github-project.sh`](../scripts/setup-github-project.sh).

**Urutan kerja:** ikuti fase 0 → 7. **MVP yang bisa mulai dipakai = selesainya Epic 0–2.**
Label tiap issue: `area:*` (Frontend/Backend/Infra) · `phase:N` · `prio:P0|P1|P2` · `type:*`.

Prioritas: **P0** = wajib untuk MVP · **P1** = produk inti · **P2** = lanjutan/integrasi.

---

## Phase 0 · Foundation & Infra  _(Epic 0)_
- [ ] **P0** (Infra) Restructure repo into pnpm monorepo (web → apps/web) — _selesai via `chore/monorepo`_
- [ ] **P0** (Infra) Shared packages: `@wealthme/contracts` (Zod) + `@wealthme/config`
- [ ] **P0** (Infra) Local dev stack via Docker Compose (postgres, redis, minio, mailhog)
- [ ] **P0** (Infra) CI: GitHub Actions (lint + build + test web & api)
- [ ] **P1** (Infra) Env management: `.env.example` + typed config loading
- [ ] **P2** (Infra) Commit hooks: husky + lint-staged + conventional commits

## Phase 1 · Backend Foundation  _(Epic 1)_
- [ ] **P0** (Backend) Scaffold NestJS app at `apps/api` (config, health, logging)
- [ ] **P0** (Backend) Prisma + Postgres + base schema & migrations
- [ ] **P0** (Backend) Auth: email/password (argon2) + JWT access/refresh + rotation (Redis)
- [ ] **P1** (Backend) Google OAuth login
- [ ] **P0** (Backend) RBAC (CASL) + TenantInterceptor (userId/familyGroupId scoping)
- [ ] **P1** (Backend) Audit logging module
- [ ] **P0** (Backend) OpenAPI/Swagger + typed client generation pipeline
- [ ] **P0** (Frontend) Web: Auth.js integration (Credentials → API) + session
- [ ] **P0** (Frontend) Web: API client + TanStack Query setup

## Phase 2 · Core Money Tracking (MVP)  _(Epic 2)_
- [ ] **P0** (Backend) Accounts API (bank & e-wallet) + balances
- [ ] **P0** (Frontend) Wire Rekening + Dana pages to API
- [ ] **P0** (Backend) Transactions API (CRUD, filters, categories)
- [ ] **P0** (Frontend) Wire Transaksi page + add-transaction modal
- [ ] **P1** (Backend) OCR adapter (mock) + receipt → transaction endpoint
- [ ] **P1** (Backend) Categories API + default seed
- [ ] **P0** (Backend) Dashboard aggregation API (net worth, cashflow, sparkline, allocation)
- [ ] **P0** (Frontend) Wire Beranda + Ringkasan dashboards
- [ ] **P1** (Backend) Budgets API
- [ ] **P1** (Frontend) Wire Anggaran page + add-category
- [ ] **P1** (Backend) Goals API
- [ ] **P1** (Frontend) Wire Tujuan page
- [ ] **P1** (Backend) Notifications API + in-app delivery
- [ ] **P1** (Frontend) Wire Notifikasi page + topbar badge
- [ ] **P2** (Backend) Search API (Postgres FTS) + wire ⌘K

## Phase 3 · Wealth  _(Epic 3)_
- [ ] **P1** (Backend) Investments API + portfolio P&L
- [ ] **P1** (Backend) `investment_prices` + MarketDataPort (mock) + refresh cron (BullMQ)
- [ ] **P2** (Backend) Realtime price push (WebSocket)
- [ ] **P1** (Frontend) Wire Investasi page
- [ ] **P1** (Backend) Assets API + net-worth rollup
- [ ] **P1** (Frontend) Wire Aset page
- [ ] **P1** (Backend) Liabilities API
- [ ] **P1** (Frontend) Wire Liabilitas page
- [ ] **P2** (Backend) Insurance API
- [ ] **P2** (Frontend) Wire Asuransi page

## Phase 4 · Reports & Calculators  _(Epic 4)_
- [ ] **P1** (Backend) Reports read-models: Ringkasan/Harian/Bulanan/Tahunan
- [ ] **P1** (Backend) Reports: Group Family / Bank / Detail
- [ ] **P1** (Backend) Reports: PNL / Balance Sheet / Cashflow / Aliran Dana
- [ ] **P1** (Frontend) Wire Laporan page (all 16 tabs) to API
- [ ] **P2** (Backend) Export reports to PDF/Excel
- [ ] **P1** (Backend) Zakat Maal calculator service + wire
- [ ] **P1** (Backend) PPh 21 calculator service (UU HPP brackets) + wire
- [ ] **P2** (Frontend) Financial calculators parity (investasi/KPR/pensiun/tabungan/split)

## Phase 5 · Family & Tools  _(Epic 5)_
- [ ] **P1** (Backend) Family group + members + email invitations
- [ ] **P1** (Backend) Admin/staff roles + scoped permissions
- [ ] **P1** (Frontend) Wire Akun → Family + add-admin modal
- [ ] **P1** (Backend) Split bills + participants + share-link API
- [ ] **P1** (Frontend) Wire Split Bill page + modals
- [ ] **P1** (Backend) Inheritance + heirs + visibility API
- [ ] **P1** (Frontend) Wire Warisan page + add-asset modal
- [ ] **P1** (Backend) Donations/Zakat records API
- [ ] **P1** (Frontend) Wire Donasi & Zakat page
- [ ] **P1** (Backend) Tax records + documents API + StoragePort (MinIO)
- [ ] **P1** (Frontend) Wire Tax Center page
- [ ] **P2** (Backend) Multi-currency: FxPort (BI rates) + currency switch
- [ ] **P2** (Backend) Bank reconciliation: statement upload + parser + matching
- [ ] **P2** (Frontend) Wire Rekonsiliasi stepper to API

## Phase 6 · Integrations & AI  _(Epic 6)_
- [ ] **P2** (Backend) OCR real provider (Google Vision/Textract) + BullMQ pipeline
- [ ] **P2** (Backend) Open-banking adapter (Brick/Ayoconnect) replace mock bank sync
- [ ] **P2** (Backend) Market data real (IDX/RTI) replace mock
- [ ] **P2** (Backend) AI Advisor → Claude via AI SDK (streaming chat)
- [ ] **P2** (Frontend) Wire AI Advisor page to streaming API
- [ ] **P2** (Backend) AI transaction categorization (`claude-haiku-4-5`)
- [ ] **P2** (Backend) Email/push notifications real (SendGrid/SES/FCM)
- [ ] **P2** (Backend) Search upgrade to Meilisearch

## Phase 7 · Hardening & Launch  _(Epic 7)_
- [ ] **P2** (Backend) Encryption at rest + column-level for sensitive fields
- [ ] **P2** (Backend) Rate limiting + throttling
- [ ] **P2** (Infra) Secrets management (Vault/Doppler)
- [ ] **P2** (Infra) Compliance: PDP/OJK, data residency, audit retention
- [ ] **P2** (Infra) Observability: pino + OpenTelemetry + Sentry + Grafana
- [ ] **P2** (Infra) E2E test suite (Playwright web + supertest api)
- [ ] **P2** (Infra) Load testing (k6)
- [ ] **P2** (Infra) Deploy: K8s/Swarm manifests + backups + runbook
- [ ] **P2** (Frontend) Accessibility & i18n pass (WCAG, EN locale)

---

### Cara membuat board GitHub Projects
1. Install gh & login sekali: `gh auth login` (scopes: `repo`, `read:org`, `project`).
2. Jalankan: `bash scripts/setup-github-project.sh` — membuat Project "WealthMe Roadmap",
   fields (Status/Area/Priority), labels, milestones (Phase 0–7), dan semua issue di atas,
   lalu menambahkannya ke board (kolom **Backlog**).
