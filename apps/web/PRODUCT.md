# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are members of a single Indonesian family/household sharing one
`FamilyGroup`. Roles are not equal:

- **Master** — the owner who created the family group; full control over every
  subject in the group.
- **Co-Master** — a second owner (typically a spouse/"istri"), added by the
  master with identical powers; max one per family group.
- **Anggota (member)** — any row in `Member`; the generic term for someone in
  the group.
- **Anak / Operasional (dependant)** — a member with no email of their own,
  created by the master/co-master with a username + initial password,
  row-scoped to only the accounts assigned to them.

The job to be done: a family manages its shared financial life — cashflow,
budgets, goals, investments, assets, liabilities, insurance, inheritance
planning, donation/zakat, tax — together, under one account with
role-appropriate visibility and approval flows, rather than each member
running a separate personal-finance app.

## Product Purpose

WealthMe is a personal/family "Wealth OS": one system of record for a
household's entire financial picture, not just transaction tracking. It
exists so a family can see, plan, and govern money together — spending,
saving, investing, protecting, and eventually transferring wealth — from a
single, role-aware app.

## Positioning

An all-in-one wealth OS: budgeting, transactions, goals, investments (saham,
crypto, gold/logam mulia), physical/other assets, liabilities, insurance,
inheritance (warisan), donation/zakat, tax calculators, bill splitting, and
bank reconciliation all live in one system, tied to one family group and one
shared data model — rather than a transaction tracker, a separate investment
tracker, and a separate calculator app that a competitor could each copy in
isolation. The family-governance layer (Master/Co-Master/Anggota roles,
row-scoped dependants, funding-request approvals) is part of that same
mechanism: it makes the "all-in-one" claim actually usable by more than one
person per household.

## Operating Context

- User-facing copy is Indonesian; code identifiers are English.
- Money defaults to Rupiah; multi-currency input is supported (see
  `lib/format.ts` and FX handling).
- Funding requests ("Permintaan Dana") and over-threshold expenses route
  through an owner/co-master approval flow at `/persetujuan`.
- A family group starts with zero accounts (`Rekening`) and adds its own —
  there is no auto-created default account.
- Stock quantities: 1 lot = 100 lembar (IDX convention); lembar is canonical
  storage.
- Investment recording distinguishes "Catat Investasi" (recording an existing
  holding) from a live buy transaction.

## Capabilities and Constraints

21 authenticated pages behind `(app)`: Beranda, Ringkasan, Transaksi,
Anggaran, Laporan (16 report tabs), Tujuan, Notifikasi, Dana, Rekening,
Investasi, Aset, Liabilitas, Asuransi, Warisan, Donasi & Zakat, Tax Center,
Split Bill, Rekonsiliasi Bank, AI Advisor, Kalkulator, Akun — plus IAM
(`/iam`, `/akses-saya`) for family member/role administration.

Live calculators: Zakat Maal, PPh 21 (progressive, UU HPP),
Investasi/KPR/Pensiun/Tabungan/Split. Simulated bank reconciliation stepper.
AI Advisor chat — each family brings its own provider key (Claude/OpenAI/
Gemini); a family with no key configured sees the advisor disabled rather
than a silent shared-cost fallback.

Backend is a real NestJS API + Postgres (not mock) as of the current
codebase; an earlier prototype (`WealthMe_Demo.html`) used client-side mock
auth/data only — that prototype is not the current implementation.

Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4,
shadcn/ui (Base UI). Foundation files (`globals.css`, `lib/*`,
`components/ui|wm|charts|shell/*`, `layout.tsx`) are shared/protected —
changes there require an explicit, reviewed foundation change.

## Brand Commitments

Name: **WealthMe**. Fonts: Sora (UI) + DM Mono (numbers), self-hosted via
`next/font`. Brand palette (including `success`, `warning`, `brand-purple`,
`brand-cyan`) is mapped onto the shadcn token contract in `globals.css`, for
both light and `.dark` themes — dark/light mode is a committed, token-driven
feature, not incidental.

## Evidence on Hand

Live implementation at `apps/web/src/app/(app)/**` is the current design and
product authority (no DESIGN.md yet). Glossary of domain terms (Master,
Co-Master, Rekening, Permintaan Dana, Lot/Lembar, Catat Investasi, etc.) is
maintained in `apps/web/CONTEXT.md`. No customer testimonials, case studies,
press, or pricing exist on hand — do not fabricate any.

## Product Principles

1. One family, one shared financial picture — every domain (cashflow to
   warisan) lives in the same system and data model, not a bolt-on.
2. Role-appropriate access, not one-size-fits-all — Master/Co-Master/Anggota/
   Dependant see and can do different things by design.
3. Indonesian-first — language, currency defaults, tax rules (PPh 21, UU
   HPP), zakat, and IDX conventions (lot/lembar) are native, not localized
   afterthoughts.
4. Real data over simulation — the product is a production system on a real
   API/DB; treat mock/demo behavior as legacy, not a target to preserve.
5. Family governance is a feature, not friction — approvals, row-scoping, and
   role separation exist to make shared money manageable, and should read as
   trust infrastructure, not bureaucracy.
