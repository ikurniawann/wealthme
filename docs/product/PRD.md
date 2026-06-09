# WealthMe — Personal Wealth Operating System

> **Status:** DRAFT — requirements only. Implementation decomposition lives in `docs/epics/` + `docs/product/ENGINEERING-TASKS.md`.
> **Version:** 1.0 · **Author:** Irfan Arsandi (WIT.ID) · **Synthesized from:** `WealthMe_Development.md`, `WealthMe_Backend_Plan.md`, `CODEX_SYSTEM_PROMPT.md`, `WealthMe_DATABASE.md`, `WealthMe_PROJECT.md`, `WealthMe_Demo.html`

---

## Problem

Indonesian personal-finance apps are built around **transaction logging** — they tell you what you spent, not whether your wealth is growing. People managing a household (and increasingly a multi-generation family) have their money scattered across cash, e-wallets, bank accounts, stocks, mutual funds, gold, property, business equity, insurance, and debt — with no single surface that answers the only question that matters: _"Is my net worth going up, and why?"_

The cost of leaving this unsolved: families make uninformed allocation decisions, miss zakat/tax obligations, lose track of inheritance assets, and cannot coordinate household finances across members (spouse, children, domestic staff) without sharing raw bank credentials.

## Evidence

- A complete, self-contained interactive prototype (`WealthMe_Demo.html`, ~3,777 lines, 21 screens) was iterated **11 times** with real design-review sessions, indicating sustained product validation effort.
- The prototype encodes a concrete reference persona and dataset (Irfan Arsandi, Arsandi Family — 4 members + 2 admin-staff, Net Worth Rp 1.256.780.000), suggesting requirements were grounded in a real household model.
- Domain-specific Indonesian features (Zakat Maal calculator with nisab check, PPh 21 progressive calculator per UU HPP, admin-staff roles for sekretaris/supir/ART) reflect observed local needs not served by generic finance apps.
- **Gap:** Quantified user-demand evidence (interviews, waitlist, analytics) is `Assumption — needs validation via user research + beta analytics`. The prototype validates _desirability of the design_, not yet _market pull_.

## Users

- **Primary — Indonesian individual wealth manager**: an adult managing personal + household finances who thinks in terms of net worth, not just spending. Triggered by wanting a single view of all assets/liabilities and growth over time.
- **Secondary — Family Owner**: head of household coordinating shared finances across family members and delegating data entry to admin-staff (secretary, driver, domestic helper) without exposing private balances.
- **Tertiary — Family Member**: spouse/child with scoped access to shared wallets, goals, and reports.
- **Not for**: enterprises/SMEs needing accounting-grade bookkeeping, professional accountants/auditors, institutional asset managers, or users outside the Indonesian tax/zakat/regulatory context (multi-currency is _display only_ in v1).

## Hypothesis

We believe a **unified wealth operating system** — combining transactions, investments, assets, liabilities, family finance, Islamic finance (zakat/inheritance), personal tax, and an AI advisor in one app — will **shift users from transaction-tracking to net-worth growth** for **Indonesian individuals and families**.

We'll know we're right when **≥70% of active users open the net-worth/dashboard view at least weekly**, and **≥40% complete at least one financial goal** within their first 90 days.

## Success Metrics

| Metric                       | Target                                    | How measured                                           |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| Weekly net-worth view rate   | ≥70% of WAU                               | Dashboard page-open events / weekly active users       |
| Transaction capture rate     | ≥10 transactions/user/month               | `transactions` insert events per user                  |
| Goal completion (90-day)     | ≥40% of users complete ≥1 goal            | `goal_progress` reaching 100% within 90 days of signup |
| Family activation            | ≥30% of family owners invite ≥1 member    | `family_members` accepted invitations                  |
| AI advisor engagement        | ≥25% of WAU send ≥1 advisor message/month | AI Advisor chat events                                 |
| Data freshness (investments) | Prices ≤15 min stale during market hours  | Market-data refresh job lag                            |
| Net-worth accuracy           | 100% formula consistency across pages     | Automated test: dashboard = Σ(domain pages)            |

> Targets are `TBD — needs validation via beta cohort analytics`. Listed as directional, not committed.

## Scope

**MVP (delivered)** — Authentication, core money tracking, and a usable net-worth dashboard wired to a real backend. This is **EPIC-000 + EPIC-001 + EPIC-002** (all `ready-for-qa`): accounts, transactions (manual + OCR scan), dashboard aggregation, budgets, goals, notifications, search.

**Post-MVP (planned)** — the remaining wealth surface:

- **EPIC-003 — Wealth**: investments (live pricing), assets, liabilities, insurance.
- **EPIC-004 — Reports & Calculators**: 16-tab reports, PDF/Excel export, Zakat & PPh 21 calculators.
- **EPIC-005 — Family & Tools**: multi-tenant family finance + RBAC, split bill, inheritance, donations/zakat, tax center, multi-currency, bank reconciliation, account/profile settings.
- **EPIC-006 — Integrations & AI**: real OCR, open banking, market data, AI advisor (Claude), auto-categorization, real notifications.
- **EPIC-007 — Hardening & Launch**: encryption, PDP/OJK compliance, observability, E2E + load testing, K8s deploy, i18n, a11y.

**Out of scope (v1)**

- **Open Banking live integration** — deferred to EPIC-006; regulatory/API availability in Indonesia is uncertain. Mock-first.
- **Native mobile app** — web is mobile-first responsive; native is post-launch.
- **Full multi-currency accounting** — currency switching changes _display_, not double-entry base currency (IDR remains authoritative).
- **Institutional/SME features** — multi-entity books, payroll, invoicing.
- **Real-time tax e-filing (DJP integration)** — Tax Center calculates and prepares documents; actual e-Filing submission is external.

## Delivery Milestones

<!-- Business outcomes, not engineering tasks. Each epic = one milestone. -->
<!-- Status mirrors docs/epics/ frontmatter. -->

| #   | Milestone (Epic)               | Outcome                                                      | Status       | Plan                                         |
| --- | ------------------------------ | ------------------------------------------------------------ | ------------ | -------------------------------------------- |
| 1   | EPIC-000 Foundation & Infra    | Monorepo + Docker dev stack + CI/CD operational              | ready-for-qa | `docs/epics/EPIC-000-foundation-infra.md`    |
| 2   | EPIC-001 Backend Foundation    | Auth, Prisma schema, RBAC, OpenAPI, web wiring live          | ready-for-qa | `docs/epics/EPIC-001-backend-foundation.md`  |
| 3   | EPIC-002 Core Money Tracking   | **MVP** — users track money & see real net worth             | ready-for-qa | `docs/epics/EPIC-002-core-money-tracking.md` |
| 4   | EPIC-003 Wealth                | Investments/assets/liabilities/insurance with live valuation | planned      | `docs/epics/EPIC-003-wealth.md`              |
| 5   | EPIC-004 Reports & Calculators | Full reporting suite + zakat/tax calculators                 | planned      | `docs/epics/EPIC-004-reports-calculators.md` |
| 6   | EPIC-005 Family & Tools        | Multi-tenant family finance + Indonesian-specific tools      | planned      | `docs/epics/EPIC-005-family-tools.md`        |
| 7   | EPIC-006 Integrations & AI     | Real external providers + AI advisor                         | planned      | `docs/epics/EPIC-006-integrations-ai.md`     |
| 8   | EPIC-007 Hardening & Launch    | Production-ready: secure, compliant, observable              | planned      | `docs/epics/EPIC-007-hardening-launch.md`    |

## Open Questions

- [ ] **OJK/PDP compliance scope** — what exact data-residency, consent-retention, and audit obligations apply before public launch? (blocks EPIC-007 sign-off)
- [ ] **Market-data provider** — IDX official feed vs RTI vs third-party aggregator; licensing cost and latency. (blocks EPIC-003 realtime, EPIC-006)
- [ ] **OCR provider** — Google Vision vs AWS Textract vs self-hosted Tesseract; accuracy on Indonesian receipts. (blocks EPIC-006)
- [ ] **Open Banking partner** — Brick vs Ayoconnect vs none-at-launch; sandbox availability and bank coverage. (blocks EPIC-006)
- [ ] **AI advisor liability** — what disclaimers/guardrails are required for financial advice generated by an LLM? (blocks EPIC-006)
- [ ] **Market-pull evidence** — run beta cohort before committing to the post-MVP roadmap order? (affects all post-MVP sequencing)

## Risks

| Risk                                                                                 | Likelihood | Impact   | Mitigation                                                                                                    |
| ------------------------------------------------------------------------------------ | ---------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Data residency / PDP non-compliance                                                  | Medium     | Critical | Self-host in Indonesia region; encrypt sensitive columns; audit trail; consent records (EPIC-007 early start) |
| Family RBAC complexity introduces data leaks (member sees another's private balance) | Medium     | High     | App-layer TenantInterceptor + Postgres RLS defense-in-depth; CASL abilities; dedicated RBAC E2E tests         |
| Market-data latency/cost makes "realtime" infeasible                                 | Medium     | Medium   | Port+adapter (`MarketDataPort`); start scheduled refresh, add WebSocket only where data license allows        |
| AI advisor gives wrong/hallucinated financial advice                                 | High       | High     | Keep zakat/PPh/calculators deterministic in BE (never LLM); ground advisor on user data; add disclaimers      |
| OCR/bank-statement parsing accuracy varies by format                                 | High       | Medium   | Mock-first; human-in-the-loop confirmation before persisting scanned transactions                             |
| Net-worth formula drift across 21 pages                                              | Medium     | High     | Single source of truth in `@wealthme/contracts`; automated cross-page consistency test                        |
| Scope sprawl (21 pages, 17 domains) delays launch                                    | High       | Medium   | Strict epic sequencing; MVP already shipped; defer integrations behind ports                                  |

---

## Appendix A — Product Surface (21 pages → epic ownership)

| #   | Page (route)                   | Domain                   | Owning Epic                          | Status  |
| --- | ------------------------------ | ------------------------ | ------------------------------------ | ------- |
| 1   | Beranda (`/beranda`)           | Dashboard                | EPIC-002                             | done    |
| 2   | Ringkasan (`/ringkasan`)       | Summary                  | EPIC-002                             | done    |
| 3   | Transaksi (`/transaksi`)       | Transactions             | EPIC-002                             | done    |
| 4   | Anggaran (`/anggaran`)         | Budgets                  | EPIC-002                             | done    |
| 5   | Tujuan (`/tujuan`)             | Goals                    | EPIC-002                             | done    |
| 6   | Notifikasi (`/notifikasi`)     | Notifications            | EPIC-002                             | done    |
| 7   | Dana (`/dana`)                 | Cash/e-wallet            | EPIC-002                             | done    |
| 8   | Rekening (`/rekening`)         | Bank accounts            | EPIC-002                             | done    |
| 9   | Investasi (`/investasi`)       | Investments              | EPIC-003                             | planned |
| 10  | Aset (`/aset`)                 | Assets                   | EPIC-003                             | planned |
| 11  | Liabilitas (`/liabilitas`)     | Liabilities              | EPIC-003                             | planned |
| 12  | Asuransi (`/asuransi`)         | Insurance                | EPIC-003                             | planned |
| 13  | Laporan (`/laporan`)           | Reports (16 tabs)        | EPIC-004                             | planned |
| 14  | Kalkulator (`/kalkulator`)     | Calculators              | EPIC-004                             | planned |
| 15  | Warisan (`/warisan`)           | Inheritance              | EPIC-005                             | planned |
| 16  | Donasi & Zakat (`/donation`)   | Donations/Zakat          | EPIC-004 (calc) + EPIC-005 (records) | planned |
| 17  | Tax Center (`/tax`)            | Personal tax             | EPIC-004 (calc) + EPIC-005 (records) | planned |
| 18  | Split Bill (`/splitbill`)      | Split bill               | EPIC-005                             | planned |
| 19  | Rekonsiliasi (`/rekonsiliasi`) | Bank reconciliation      | EPIC-005                             | planned |
| 20  | AI Advisor (`/ai`)             | AI advisor               | EPIC-006                             | planned |
| 21  | Akun (`/akun`)                 | Profile/account settings | EPIC-005 (new task T-505)            | planned |

## Appendix B — Core Formulas (authoritative, deterministic — implement in `@wealthme/contracts` + BE services, never LLM)

```
Net Worth     = Cash + Investments + Assets − Liabilities
Savings Rate  = (Income − Expense) / Income × 100
ROI           = (Current Value − Invested Amount) / Invested Amount × 100
Goal Progress = Current Amount / Target Amount × 100
Zakat Maal    = 2.5% of eligible wealth, if wealth ≥ nisab (≈85g gold)
PPh 21        = progressive brackets (UU HPP: 5/15/25/30/35%) on PKP, after PTKP + biaya jabatan + zakat deduction
```

## Appendix C — Tech Stack (locked decisions, from Backend Plan)

- **Repo:** Monorepo (pnpm workspaces + Turborepo) — `apps/web`, `apps/api`, `packages/contracts`, `packages/config`
- **Frontend:** Next.js 16 · TypeScript · Tailwind v4 · shadcn (Base UI) · TanStack Query
- **Backend:** NestJS (modular monolith → microservices) · REST + OpenAPI · Zod contracts
- **Database:** PostgreSQL + Prisma · money as BIGINT (rupiah, no minor unit) · Postgres RLS
- **Auth:** Auth.js (web session) delegating to NestJS Passport + JWT (authoritative, web+mobile) · argon2id · CASL RBAC
- **Infra:** Redis + BullMQ · MinIO (S3) · WebSocket/SSE · Docker Compose (dev) → K8s (prod) · self-host (ID residency)
- **AI:** Claude via AI SDK behind `AiAdvisorPort` — `claude-sonnet-4-6` (advisor), `claude-haiku-4-5` (categorization)
- **Integration ports (mock-first):** `OcrPort`, `BankSyncPort`, `MarketDataPort`, `FxPort`, `AiAdvisorPort`, `StoragePort`, `NotificationPort`
