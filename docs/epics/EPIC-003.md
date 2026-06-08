# EPIC-003: Wealth Features (Phase 3)

status: backlog
environment: dev
retries: 0

## Goal

Build the wealth management layer: investments with live P&L, assets with net-worth
rollup, liabilities with debt ratios, and insurance policies. Add real-time price
push via WebSocket. After this phase users see their complete financial picture.

GitHub Milestone: Phase 3 — Wealth (issues #31–#40)
Depends on: EPIC-002 (Core MVP)

## Tasks

### Backend
- [ ] #31 Investments API + portfolio P&L — holdings, cost basis, returns
- [ ] #32 investment_prices + MarketDataPort (mock) + refresh cron (BullMQ) — scheduled price refresh; pluggable provider
- [ ] #33 Realtime price push (WebSocket) — push price/portfolio updates to clients
- [ ] #35 Assets API + net-worth rollup — physical/financial assets grouped by category
- [ ] #37 Liabilities API — credit cards/loans; debt ratios
- [ ] #39 Insurance API — policies, premium, renewal

### Frontend
- [ ] #34 Web: wire Investasi page — real portfolio table + live returns
- [ ] #36 Web: wire Aset page — real grouped assets + tabs
- [ ] #38 Web: wire Liabilitas page — real liabilities + payoff progress bars
- [ ] #40 Web: wire Asuransi page — real insurance policies

## Acceptance Criteria

- Investasi page shows real holdings with cost basis, current value, and P&L (%)
- Portfolio values update in real-time via WebSocket when prices refresh
- Aset page shows assets grouped by category with total net worth rollup
- Liabilitas page shows real debts with progress bars toward payoff
- Asuransi page shows real insurance policies with premium and renewal dates
- Net worth figure on Beranda/Ringkasan updates when assets or liabilities change
- BullMQ cron refreshes prices on schedule without blocking request thread
- MarketDataPort is swappable — mock provider returns deterministic test data
- All pages handle no-data empty states gracefully
- No cross-tenant data leakage

## Automation Log

<!-- Automation appends results here after each run -->
