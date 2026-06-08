# EPIC-005: Family & Tools (Phase 5)

status: backlog
environment: dev
retries: 0

## Goal

Build multi-user family group management, role-based member access, and all
collaborative tools: split bills, inheritance planning, donations/zakat records,
tax document storage, bank reconciliation, and multi-currency support.

GitHub Milestone: Phase 5 — Family & Tools (issues #49–#62)
Depends on: EPIC-002 (Core MVP), EPIC-004 (Reports — for Zakat)

## Tasks

### Family & Access Control
- [ ] #49 Family group + members + email invitations — create group, invite/join, shared balance
- [ ] #50 Admin/staff roles + scoped permissions — input-only access, category restrictions, no private balances
- [ ] #51 Web: wire Akun → Family tab + add-admin modal — real members/admins + invites

### Split Bill
- [ ] #52 Split bills + participants + share-link API — create split, per-person split, public share link, settle
- [ ] #53 Web: wire Split Bill page + modals — real splits + share/detail

### Inheritance
- [ ] #54 Inheritance + heirs + visibility API — assets per category; heir access flags
- [ ] #55 Web: wire Warisan page + add-asset modal — real inheritance + heirs

### Donations & Zakat
- [ ] #56 Donations/Zakat records API — records + institutions; feed tax deduction
- [ ] #57 Web: wire Donasi & Zakat page — real history + calculator + record modal

### Tax
- [ ] #58 Tax records + documents API + StoragePort (MinIO) — records, document upload/download via S3-compatible storage
- [ ] #59 Web: wire Tax Center page — real records/docs + PPh calculator

### Multi-currency & Reconciliation
- [ ] #60 Multi-currency: FxPort (BI rates) + currency switch — daily rates; convert displayed values
- [ ] #61 Bank reconciliation: statement upload + parser + matching — parse PDF/Excel per bank; match vs recorded txns; suggestions
- [ ] #62 Web: wire Rekonsiliasi stepper to API — real upload/scan/match/finish flow

## Acceptance Criteria

- Family group creation, email invites, and join flow work end-to-end
- Admin/staff role restricts visibility of private balances and limits categories
- Split bill creates real record; share link is publicly accessible without auth
- Warisan page shows real inheritance assets with heir access toggles
- Donasi & Zakat page shows real donation history; calculator uses live nisab
- Tax Center shows real tax records; PDF documents upload/download via MinIO
- Currency switch converts all displayed values using Bank Indonesia daily rates
- Bank statement upload (PDF/Excel) parses and matches against recorded transactions
- Rekonsiliasi stepper (upload → scan → match → finish) works with real API
- Document uploads stored in MinIO; never directly in Postgres

## Automation Log

<!-- Automation appends results here after each run -->
