# EPIC-002: Core Money Tracking (Phase 2 — MVP)

status: backlog
environment: dev
retries: 0

## Goal

Build and wire all core money-tracking APIs: accounts, transactions, categories,
budgets, financial goals, notifications, and the dashboard aggregation. This is the
product MVP — after this phase the app works end-to-end with real data.

GitHub Milestone: Phase 2 — Core Money Tracking (issues #16–#30)
Depends on: EPIC-001 (Backend Foundation)

## Tasks

### Backend APIs
- [ ] #16 Accounts API (bank & e-wallet) — CRUD, sync status, balance rollup
- [ ] #18 Transactions API (CRUD, filters, categories) — type income/expense/transfer/credit; pagination; per-day grouping; summary
- [ ] #20 OCR adapter (mock) + receipt → transaction endpoint — OcrPort interface + MockOcr; parse → prefilled transaction
- [ ] #21 Categories API + default seed — system + user categories with icons
- [ ] #22 Dashboard aggregation API (net worth, cashflow, sparkline, allocation) — computed endpoints for Beranda/Ringkasan
- [ ] #24 Budgets API — categories with limits/period; spend rollup; 80% alert flag
- [ ] #26 Goals API — target/current/auto-debit/status
- [ ] #28 Notifications API + in-app delivery — notification entity; mark-read; WebSocket/SSE push
- [ ] #30 Search API (Postgres FTS) + wire ⌘K — index pages/accounts/investments/goals; command palette hits API

### Frontend Integration
- [ ] #17 Web: wire Rekening + Dana pages to API — replace mock; real balances/actions
- [ ] #19 Web: wire Transaksi page + add-transaction modal — real list/filters; create via global modal
- [ ] #23 Web: wire Beranda + Ringkasan dashboards — charts fed by aggregation API
- [ ] #25 Web: wire Anggaran page + add-category — real budgets + create category
- [ ] #27 Web: wire Tujuan page — real goals + progress
- [ ] #29 Web: wire Notifikasi page + topbar badge — real list + unread count

## Acceptance Criteria

- Rekening/Dana pages show real account balances from API (not mock data)
- Transaksi page loads real paginated transactions with filters working
- Add-transaction modal creates real records; OCR mock pre-fills fields from receipt image
- Beranda and Ringkasan charts (sparkline, donut, bar) are fed by aggregation API
- Anggaran page shows real budget categories with spend progress; add-category modal saves to API
- Tujuan page shows real financial goals with live progress bars
- Notifikasi page loads real notifications; topbar badge reflects unread count
- ⌘K global search returns real results from Postgres FTS index
- All pages gracefully handle loading and error states (skeleton/toast)
- No hardcoded Rp values — all from API
- `npm run build` passes with zero TypeScript errors

## Automation Log

<!-- Automation appends results here after each run -->
