# WealthMe — Personal Wealth OS (Next.js)

Production-ready frontend port of the `WealthMe_Demo.html` prototype, rebuilt with
**Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI)**.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Build & checks:

```bash
npm run build    # production build (type-checked)
npm run lint     # eslint
```

## Demo login

The app opens at `/login` with the demo account pre-filled
(`irfan.arsandi@wealthme.id` / `demo1234`). Click **Masuk** (or **Google**) to enter.
Auth is a client-side mock (localStorage) — there is no backend; all data is mock data.

## Architecture

```
src/
├─ app/
│  ├─ layout.tsx            # fonts (Sora + DM Mono), ThemeProvider, AuthProvider, Toaster
│  ├─ page.tsx              # root → redirects to /beranda or /login
│  ├─ login/page.tsx        # auth gate
│  └─ (app)/                # authenticated route group (sidebar/topbar/mobile shell)
│     ├─ layout.tsx         # renders <AppShell>
│     └─ <21 pages>/page.tsx
├─ components/
│  ├─ ui/                   # shadcn/ui primitives (Base UI)
│  ├─ shell/                # sidebar, topbar, mobile bars, theme toggle, global search + transaction dialogs
│  ├─ charts/               # Sparkline (canvas), Donut (svg), BarChart
│  ├─ wm/                   # SectionCard, SummaryCard, StatusBadge, ProgressBar, MoneyStat, HeroCard …
│  └─ providers/            # ThemeProvider (next-themes), AuthProvider
└─ lib/
   ├─ format.ts             # Rupiah / number formatters
   ├─ nav.ts                # navigation config + page titles
   └─ data.ts               # shared mock data (cashflow, sparkline, search index, AI responses)
```

### Pages (21)
Beranda · Ringkasan · Transaksi · Anggaran · Laporan (16 report tabs, deep-linkable via `?tab=`) ·
Tujuan · Notifikasi · Dana · Rekening · Investasi · Aset · Liabilitas · Asuransi · Warisan ·
Donasi & Zakat · Tax Center · Split Bill · Rekonsiliasi Bank · AI Advisor · Kalkulator · Akun.

### Notable features ported
- Dark / light mode via `next-themes` (token-driven, persisted).
- Fully responsive: desktop sidebar collapses to a mobile sheet + bottom nav + FAB.
- Global **Tambah Transaksi** modal incl. simulated **OCR receipt-scan** flow.
- Live calculators: Zakat Maal, PPh 21 (progressive UU HPP), Investasi/KPR/Pensiun/Tabungan/Split.
- Simulated bank reconciliation stepper and AI Advisor chat.
- Command-palette style global search (`⌘K`).

## Design system
WealthMe brand palette is mapped onto the shadcn token contract in `src/app/globals.css`
(both light and `.dark`), so every component and brand color (`success`, `warning`,
`brand-purple`, `brand-cyan`, …) adapts to dark mode automatically. Fonts: **Sora** (UI) +
**DM Mono** (numbers), self-hosted via `next/font`.
