# EPIC-004: Reports & Calculators (Phase 4)

status: backlog
environment: dev
retries: 0

## Goal

Build all 16 Laporan report tabs, financial statement read-models (PNL, Balance Sheet,
Cashflow), and the calculator services (Zakat Maal, PPh 21). Add PDF/Excel export.
After this phase the app delivers actionable financial intelligence.

GitHub Milestone: Phase 4 — Reports & Calculators (issues #41–#48)
Depends on: EPIC-002 (Core MVP)

## Tasks

### Backend
- [ ] #41 Reports read-models: Ringkasan / Harian / Bulanan / Tahunan — aggregated period reports
- [ ] #42 Reports: Group Family / Bank / Detail — per-member, per-bank, full transaction detail
- [ ] #43 Reports: PNL / Balance Sheet / Cashflow / Aliran Dana (Sankey flow data)
- [ ] #45 Export reports to PDF/Excel — server-side export jobs
- [ ] #46 Zakat Maal calculator service + wire — deterministic 2.5% + nisab; reused by Donasi
- [ ] #47 PPh 21 calculator service (UU HPP brackets) + wire — progressive 5/15/25/30/35%; PTKP; biaya jabatan; zakat deduction

### Frontend
- [ ] #44 Web: wire Laporan page (all 16 tabs) to API — all tab content fed by report endpoints
- [ ] #48 Web: financial calculators parity — confirm parity with demo; optional shared calc in contracts

## Acceptance Criteria

- Laporan page all 16 tabs render real data (no mock values)
- Ringkasan/Harian/Bulanan/Tahunan reports aggregate correct totals
- Group Family report shows per-member breakdown
- PNL, Balance Sheet, Cashflow, and Aliran Dana (Sankey) all compute correctly
- PDF export downloads a correctly formatted report file
- Excel export downloads a correctly structured spreadsheet
- Zakat Maal calculator returns 2.5% of eligible assets above nisab
- PPh 21 calculator applies correct UU HPP progressive brackets (5/15/25/30/35%)
- Calculator results match manual verification with sample test cases
- All report endpoints are paginated or bounded (no unbounded queries)

## Automation Log

<!-- Automation appends results here after each run -->
