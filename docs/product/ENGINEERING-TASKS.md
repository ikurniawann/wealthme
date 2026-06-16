# WealthMe — Engineering Task Breakdown

> Companion to `PRD.md` + `USER-STORIES.md`. Decomposes the **planned** epics (EPIC-003 → EPIC-007) into engineering tasks.
> Each task: **ID** · description · **Type** (BE / FE / Infra) · **Complexity** (S ≤1d, M 2–4d, L ≥1w) · **Depends on** · **Stories**.
> Task IDs mirror the enhanced task lists in `docs/epics/`. EPIC-000/001/002 are **delivered (ready-for-qa)** and listed below for traceability; their residual QA items are noted in each epic file.
> **Convention (from EPIC-002):** each domain = a Backend module + a Frontend wiring task (replace mock with TanStack Query against `@wealthme/contracts`).
>
> Status note: this file is a product/engineering decomposition. Current
> execution status is canonical in `docs/epics/README.md` and each
> `docs/epics/EPIC-*.md` file. Agent workflow lives in
> `docs/AGENTIC-WORKFLOW.md`.

---

## EPIC-000 — Foundation & Infra ✅ (ready-for-qa)

| ID    | Task                                                                                                     | Type  | Cx  | Status | Stories   |
| ----- | -------------------------------------------------------------------------------------------------------- | ----- | --- | ------ | --------- |
| T-001 | pnpm monorepo restructure (web → apps/web) + workspace/turbo/root config + `packages/contracts`+`config` | Infra | M   | done   | US-PLAT-1 |
| T-002 | Shared `@wealthme/config` + `@wealthme/contracts` (Zod, build, type export)                              | Infra | M   | done   | US-PLAT-1 |
| T-003 | Docker Compose dev stack (postgres/redis/minio/mailhog) + db scripts                                     | Infra | S   | done   | US-PLAT-2 |
| T-004 | CI GitHub Actions (lint+build+test, turbo/pnpm cache, required check)                                    | Infra | M   | done\* | US-PLAT-3 |
| T-005 | Env management: `.env.example` per app + validated config loader                                         | Infra | S   | done   | US-PLAT-4 |
| T-006 | Commit hooks: husky + lint-staged + commitlint                                                           | Infra | S   | done   | US-PLAT-5 |

\* _Residual: branch-protection enablement is a one-time repo-admin step (see `docs/CI.md`)._

## EPIC-001 — Backend Foundation ✅ (ready-for-qa)

| ID    | Task                                                                                           | Type | Cx  | Status                     | Stories              |
| ----- | ---------------------------------------------------------------------------------------------- | ---- | --- | -------------------------- | -------------------- |
| T-101 | Scaffold NestJS `apps/api` (config, env-validation, pino, `/health`, Swagger, CORS)            | BE   | M   | done                       | US-PLAT-6            |
| T-102 | Prisma + Postgres + core schema (users/family/members/accounts/transactions/categories) + seed | BE   | M   | done                       | US-AUTH-1            |
| T-103 | Auth email/password (argon2id) + JWT access/refresh rotation (Redis) + `JwtAuthGuard`          | BE   | L   | done                       | US-AUTH-1, US-AUTH-2 |
| T-104 | Google OAuth login (link by email)                                                             | BE   | M   | done                       | US-AUTH-3            |
| T-105 | RBAC (CASL) + TenantInterceptor (userId/familyGroupId scoping)                                 | BE   | L   | done                       | US-FAM-7             |
| T-106 | Postgres RLS (second layer)                                                                    | BE   | M   | **deferred → T-503/T-704** | US-FAM-7             |
| T-107 | Audit logging interceptor → `audit_logs`                                                       | BE   | S   | done                       | US-FAM-6             |
| T-108 | OpenAPI/Swagger + typed client generation                                                      | BE   | M   | done                       | US-PLAT-6            |
| T-109 | Web: Auth.js (Credentials→API) + session + TanStack Query client                               | FE   | L   | done                       | US-AUTH-1..3         |

## EPIC-002 — Core Money Tracking (MVP) ✅ (ready-for-qa)

| ID    | Task                                                                   | Type | Cx  | Status | Stories        |
| ----- | ---------------------------------------------------------------------- | ---- | --- | ------ | -------------- |
| T-201 | Accounts API (CRUD, balance, sync status)                              | BE   | M   | done   | US-ACCT-1      |
| T-202 | Wire **Rekening** + **Dana** pages                                     | FE   | S   | done   | US-DASH-5      |
| T-203 | Transactions API (CRUD, filters, pagination, grouping, summary)        | BE   | M   | done   | US-TXN-1,3,4,6 |
| T-204 | Categories API + default seed                                          | BE   | S   | done   | US-TXN-5       |
| T-205 | OCR adapter (mock) `OcrPort`+`MockOcr` + `POST /transactions/scan`     | BE   | S   | done   | US-TXN-2       |
| T-206 | Wire **Transaksi** page + add-transaction modal (manual+scan)          | FE   | M   | done   | US-TXN-1,2     |
| T-207 | Dashboard aggregation API (net worth, cashflow, sparkline, allocation) | BE   | M   | done   | US-DASH-1..5   |
| T-208 | Wire **Beranda** + **Ringkasan**                                       | FE   | M   | done   | US-DASH-1..6   |
| T-209 | Budgets API (limit, period, usage rollup, 80% flag)                    | BE   | S   | done   | US-NOTIF-3     |
| T-210 | Wire **Anggaran** + add-category modal                                 | FE   | S   | done   | US-TXN-5       |
| T-211 | Goals API (target/current/auto-debit/status)                           | BE   | S   | done   | US-DASH-6      |
| T-212 | Wire **Tujuan** page                                                   | FE   | S   | done   | US-DASH-6      |
| T-213 | Notifications API (entity, mark-read, WebSocket/SSE push)              | BE   | M   | done   | US-NOTIF-1     |
| T-214 | Wire **Notifikasi** + topbar badge                                     | FE   | S   | done   | US-NOTIF-1     |
| T-215 | Search API (Postgres FTS)                                              | BE   | S   | done   | US-TXN-7       |
| T-216 | Wire command palette (⌘K)                                              | FE   | S   | done   | US-TXN-7       |

---

## EPIC-003 — Wealth

| ID    | Task                                                                                        | Type | Cx  | Depends on          | Stories                      |
| ----- | ------------------------------------------------------------------------------------------- | ---- | --- | ------------------- | ---------------------------- |
| T-301 | Investments API: holdings CRUD, cost basis (modal), current value, return Rp & %            | BE   | M   | EPIC-002            | US-INV-1, US-INV-2           |
| T-302 | `investment_prices` table + `MarketDataPort` (mock adapter)                                 | BE   | M   | T-301               | US-INV-3                     |
| T-303 | Scheduled price-refresh job (BullMQ cron) writing to `investment_prices`                    | BE   | M   | T-302               | US-INV-3                     |
| T-304 | Realtime price push — WebSocket gateway broadcasting price ticks                            | BE   | L   | T-303               | US-INV-4                     |
| T-305 | Wire **Investasi** page: portfolio table + live return, horizontal scroll on mobile         | FE   | M   | T-301, T-304        | US-INV-2, US-INV-4, US-INV-6 |
| T-306 | Assets API: CRUD + value history (`asset_history`)                                          | BE   | M   | EPIC-002            | US-ASSET-1, US-ASSET-2       |
| T-307 | Net-worth rollup service (cash + investments + assets − liabilities), shared in `contracts` | BE   | M   | T-301, T-306, T-308 | US-DASH-1, US-ASSET-3        |
| T-308 | Liabilities API: credit cards & loans, remaining balance, payment ratio                     | BE   | S   | EPIC-002            | US-LIAB-1, US-LIAB-2         |
| T-309 | Wire **Aset** page: grouped list (cash/investment/asset/liability) + tabs                   | FE   | S   | T-306, T-307        | US-ASSET-1, US-ASSET-3       |
| T-310 | Wire **Liabilitas** page: cards + loans with ratios                                         | FE   | S   | T-308               | US-LIAB-1, US-LIAB-2         |
| T-311 | Insurance API: policies, premium, renewal date, status; renewal → notification trigger      | BE   | S   | EPIC-002            | US-INS-1, US-INS-2           |
| T-312 | Wire **Asuransi** page: active policies + coverage summary                                  | FE   | S   | T-311               | US-INS-1, US-INS-3           |

**Exit:** Investasi/Aset/Liabilitas/Asuransi run on live data; price refresh on schedule + WebSocket push; net-worth rollup matches dashboard; P&L and rollup unit tests pass.

---

## EPIC-004 — Reports & Calculators

| ID    | Task                                                                                                          | Type | Cx  | Depends on                  | Stories                         |
| ----- | ------------------------------------------------------------------------------------------------------------- | ---- | --- | --------------------------- | ------------------------------- |
| T-401 | Report read-model: Ringkasan / Harian / Bulanan / Tahunan aggregations                                        | BE   | M   | EPIC-002, EPIC-003          | US-RPT-1, US-RPT-2              |
| T-402 | Report read-model: Group Family / Bank / Detail                                                               | BE   | M   | EPIC-002, EPIC-005 (family) | US-RPT-3, US-RPT-4, US-RPT-5    |
| T-403 | Report read-model: PNL / Balance Sheet / Cashflow / Aliran Dana (Sankey data)                                 | BE   | L   | T-401                       | US-RPT-7, US-RPT-6              |
| T-404 | Wire **Laporan** page: 16 tabs to report API, horizontal tab scroll                                           | FE   | M   | T-401, T-402, T-403         | US-RPT-1..7                     |
| T-405 | Export service: report → PDF/Excel (server-side BullMQ job)                                                   | BE   | M   | T-403                       | US-RPT-8                        |
| T-406 | Zakat Maal service (2.5% + nisab ~Rp 102jt) in `contracts` + BE; golden-value tests                           | BE   | S   | EPIC-002                    | US-CALC-4                       |
| T-407 | PPh 21 service (UU HPP progressive, PTKP, biaya jabatan, zakat deduction); golden-value tests                 | BE   | M   | T-406                       | US-CALC-5                       |
| T-408 | Financial calculators (investment/KPR/pension/savings/split) parity with demo; shared formulas in `contracts` | BE   | M   | EPIC-002                    | US-CALC-1, US-CALC-2, US-CALC-3 |
| T-409 | Wire **Kalkulator** page (5 tabs) + inline calculators on Donasi & Tax pages                                  | FE   | M   | T-406, T-407, T-408         | US-CALC-1..5                    |

**Exit:** Every report tab aggregates correctly per period; P&L/Balance Sheet/Cashflow internally consistent; PDF/Excel export correct; zakat & PPh 21 outputs match demo exactly; calculators deterministic in BE.

---

## EPIC-005 — Family & Tools

| ID    | Task                                                                                                                                                         | Type  | Cx  | Depends on          | Stories                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --- | ------------------- | ---------------------------------- |
| T-501 | Family group + members + email invitation flow                                                                                                               | BE    | M   | EPIC-001            | US-FAM-1, US-FAM-2                 |
| T-502 | Admin-staff role + scoped permissions (input-only, category-limited, no private balances); CASL abilities                                                    | BE    | L   | T-501               | US-FAM-3, US-FAM-7                 |
| T-503 | Tenancy enforcement: TenantInterceptor + Postgres RLS; member-isolation guarantees                                                                           | BE    | L   | T-501               | US-FAM-4, US-FAM-7                 |
| T-504 | Audit logging for admin-staff actions (`audit_logs`)                                                                                                         | BE    | S   | T-502               | US-FAM-6                           |
| T-505 | Wire **Akun** page: profile edit, password/PIN/biometric, sessions, preferences (currency/lang/theme), privacy/export/delete, Family panel + Add-Admin modal | FE    | L   | T-501, T-502, T-510 | US-AUTH-4..8, US-FAM-1, US-FAM-3   |
| T-506 | Split bills + participants + public share-link API (settle/pay)                                                                                              | BE    | M   | EPIC-002            | US-SPLIT-1, US-SPLIT-2, US-SPLIT-3 |
| T-507 | Wire **Split Bill** page + create/detail/share modals + WhatsApp reminder                                                                                    | FE    | M   | T-506               | US-SPLIT-1..4                      |
| T-508 | Inheritance + heirs + per-asset visibility API                                                                                                               | BE    | M   | T-503               | US-INH-1, US-INH-2, US-INH-3       |
| T-509 | Wire **Warisan** page + Add-Asset modal + heir visibility + document upload                                                                                  | FE    | M   | T-508, T-512        | US-INH-1..4                        |
| T-510 | `StoragePort` (MinIO) — upload/download for documents (inheritance, tax)                                                                                     | BE    | M   | EPIC-000            | US-INH-4, US-TAX-3                 |
| T-511 | Donations/Zakat records API (feeds tax deduction)                                                                                                            | BE    | S   | T-406               | US-DON-1, US-DON-3, US-DON-4       |
| T-512 | Wire **Donasi & Zakat** page + record modal + inline zakat calculator                                                                                        | FE    | S   | T-511, T-406        | US-DON-1..5                        |
| T-513 | Tax records + documents API (consumes zakat deduction)                                                                                                       | BE    | M   | T-407, T-510, T-511 | US-TAX-2, US-TAX-3, US-TAX-4       |
| T-514 | Wire **Tax Center** page + PPh 21 calculator + SPT status + documents                                                                                        | FE    | M   | T-513, T-407        | US-TAX-1..4                        |
| T-515 | `FxPort` (BI rate) + multi-currency display switch (IDR/USD/SGD/EUR/JPY)                                                                                     | BE+FE | M   | EPIC-002            | US-AUTH-6                          |
| T-516 | Bank reconciliation: statement upload + parser + matching pipeline (`BankSyncPort` mock)                                                                     | BE    | L   | T-510               | US-RECON-1, US-RECON-2, US-RECON-3 |
| T-517 | Wire **Rekonsiliasi Bank** stepper (upload→scan→match→done) + suggestions                                                                                    | FE    | M   | T-516               | US-RECON-1..3                      |

**Exit:** Owner invites members; member sees shared not private balances; admin-staff input-only with audit trail; split share link public + pay status live; inheritance visible to permitted heirs; docs in MinIO; currency switch changes displayed values; reconciliation matches + suggests missing entries; Akun page fully wired.

---

## EPIC-006 — Integrations & AI

| ID    | Task                                                                                                           | Type | Cx  | Depends on         | Stories                   |
| ----- | -------------------------------------------------------------------------------------------------------------- | ---- | --- | ------------------ | ------------------------- |
| T-601 | Real OCR (Google Vision/Textract) replacing `MockOcr` + BullMQ pipeline + image storage                        | BE   | L   | EPIC-002, T-510    | US-TXN-2                  |
| T-602 | Open-banking adapter (Brick/Ayoconnect): consent, account sync, transaction feed (`BankSyncPort` real)         | BE   | L   | T-516              | US-RECON-1                |
| T-603 | Real market data (IDX/RTI) replacing `MarketDataPort` mock                                                     | BE   | M   | T-302              | US-INV-3                  |
| T-604 | AI Advisor → Claude via AI SDK (streaming), grounded on user data (`claude-sonnet-4-6`) behind `AiAdvisorPort` | BE   | L   | EPIC-002, EPIC-003 | US-AI-1, US-AI-3, US-AI-4 |
| T-605 | Wire **AI Advisor** page to streaming API + quick-question shortcuts + disclaimers                             | FE   | M   | T-604              | US-AI-1, US-AI-2          |
| T-606 | Auto-categorization of transactions (`claude-haiku-4-5`)                                                       | BE   | M   | EPIC-002           | US-TXN-5                  |
| T-607 | Real email/push notifications (SendGrid/SES/FCM) replacing mock `NotificationPort`                             | BE   | M   | EPIC-002           | US-NOTIF-1, US-NOTIF-2    |
| T-608 | Search upgrade to Meilisearch (if Postgres FTS insufficient)                                                   | BE   | M   | EPIC-002           | US-TXN-7                  |

**Exit:** Real receipt scan auto-fills transactions; bank accounts sync via partner sandbox; investment prices from real market source; advisor streams grounded answers; auto-categorization hits accuracy target; email/push delivered on triggers.

---

## EPIC-007 — Hardening & Launch

| ID    | Task                                                                                     | Type     | Cx  | Depends on | Stories            |
| ----- | ---------------------------------------------------------------------------------------- | -------- | --- | ---------- | ------------------ |
| T-701 | Encryption at-rest + sensitive columns (account numbers, documents) via AES-GCM/pgcrypto | Infra+BE | M   | EPIC-005   | US-AUTH-8          |
| T-702 | Rate limiting + throttling (`@nestjs/throttler`) on all endpoints                        | BE       | S   | —          | —                  |
| T-703 | Secrets management (Vault/Doppler), no secrets in prod env                               | Infra    | M   | —          | —                  |
| T-704 | PDP/OJK compliance: ID data residency, audit retention, consent records                  | Infra+BE | L   | T-701      | US-AUTH-8          |
| T-705 | Observability: pino + OpenTelemetry + Sentry + Grafana (log/trace/metric/error)          | Infra    | L   | —          | —                  |
| T-706 | E2E suite: Playwright (web) + supertest (api) for critical flows incl. RBAC isolation    | BE+FE    | L   | EPIC-005   | US-FAM-4, US-FAM-7 |
| T-707 | Load testing (k6) + capacity baseline                                                    | Infra    | M   | T-705      | —                  |
| T-708 | Deploy: K8s/Swarm manifests + DB backup + on-call runbook                                | Infra    | L   | T-703      | —                  |
| T-709 | Accessibility (WCAG 2.2) audit pass across all pages                                     | FE       | M   | all FE     | —                  |
| T-710 | i18n: EN locale alongside ID                                                             | FE       | M   | all FE     | US-AUTH-6          |

**Exit:** Sensitive data encrypted; no prod-env secrets; rate limits active; full observability with alerts; E2E + load tests green; reproducible deploy with tested backup/restore; a11y audit passes; id/en switch works.

---

## Summary

| Epic      | Tasks  | BE     | FE     | Infra | Heaviest dependency |
| --------- | ------ | ------ | ------ | ----- | ------------------- |
| EPIC-003  | 12     | 7      | 5      | —     | EPIC-002            |
| EPIC-004  | 9      | 6      | 3      | —     | EPIC-002, EPIC-003  |
| EPIC-005  | 17     | 10     | 7      | —     | EPIC-001, EPIC-004  |
| EPIC-006  | 8      | 7      | 1      | —     | EPIC-002..005       |
| EPIC-007  | 10     | 2      | 3      | 5     | EPIC-001..006       |
| **Total** | **56** | **32** | **19** | **5** | —                   |

**Sequencing note:** EPIC-004's `T-402` (Family/Group reports) soft-depends on EPIC-005's family model; if EPIC-004 ships first, deliver T-402 as a follow-up after T-503. All other cross-epic dependencies flow forward (003→004→005→006→007).
