# WealthMe Design System

**WealthMe — Personal Wealth OS.** A professional personal & family **FinOps** web app for Indonesian users: track transactions, budgets, investments, assets, liabilities, insurance, inheritance (warisan), tax, donations (zakat), and goals — with an AI Advisor, bank reconciliation, split bill, and a deep reporting suite — all in one dashboard.

This design system captures WealthMe's real visual language (tokens, type, components, charts) and a faithful recreation of its product surfaces, so any agent can design on-brand screens, slides, and assets.

---

## Source material

Everything here was reverse-engineered from the product codebase. The reader may not have access, but the references are recorded so they can go deeper:

- **GitHub monorepo:** `andrsrjld/wealthme-web` (branch `development`) — Turborepo with `apps/web` (Next.js 16 · React 19 · Tailwind v4 · shadcn / Base UI) and `apps/api` (NestJS · Prisma · Postgres).
  - Tokens lifted from `apps/web/src/app/globals.css`
  - Components lifted from `apps/web/src/components/{ui,wm,charts,shell}`
  - Screens modeled on `apps/web/src/app/(app)/beranda`, `/aset`, `/ai`, and `apps/web/src/app/login`
  - Fonts & metadata from `apps/web/src/app/layout.tsx`; navigation from `apps/web/src/lib/nav.ts`; formatting from `apps/web/src/lib/format.ts`

> Explore the repository further to build richer, more accurate WealthMe designs — there are 20+ product pages (laporan/reports, rekonsiliasi, kalkulator, asuransi, warisan, tax, donation, splitbill) not all recreated here.

---

## Content fundamentals

**Language.** The product is **Bahasa Indonesia**, second person informal — it addresses the user as **"kamu"** ("kekayaanmu", "datamu"). Warm but competent; never stiff or corporate. English appears only in established finance/product terms (Cashflow, AI Advisor, Split Bill, Tax Center, PNL, Balance Sheet).

**Tone & voice.** Encouraging and advisory, like a calm private banker. Greetings are time-aware and friendly ("Selamat pagi, Andra 👋"). The AI Advisor speaks in first person and gives concrete, numeric guidance ("properti menyumbang 30% dari total aset… idealnya 20–25%").

**Casing.** Sentence case for body and titles ("Tujuan Keuangan", "Rincian Kekayaan"). UPPERCASE only for tiny section labels in the sidebar/cards (KEUANGAN, ALAT) with wide tracking. Numbers always Indonesian: thousands with `.`, decimals with `,`.

**Currency.** Rupiah, prefix `Rp` + non-breaking grouping: `Rp 2.847.500.000`. Compact forms use `jt` (juta), `M` (miliar), `rb` (ribu): `Rp 25,85 jt`, `Rp 2,4 M`. Helpers live in `lib/format` (recreated in the UI kit's `data.js`).

**Emoji.** Used deliberately and sparingly as **category/account glyphs** inside tinted chips (🏦 bank, 💵 e-wallet, 📈 investasi, 🏠 properti, 🎓 goal) and a single waving 👋 in greetings. Never decorative filler in prose. "New" features are flagged with a small pill, not an emoji.

**Numbers & deltas.** Up/down movement uses ▲/▼ with success-green / destructive-red, plus a percentage. Money read-outs are extrabold; labels are small and muted.

---

## Visual foundations

**Mood.** Calm, dense, trustworthy fintech. White cards on a faintly indigo-tinted off-white canvas; one confident indigo accent; generous data, restrained chrome. Full dark mode.

**Color.** Brand is **indigo `#4F46E5`** (`--primary`), with `primary-strong #3730A3` and `primary-soft #EEF2FF`. Neutrals are slate, subtly **tinted toward the active brand color via `color-mix`** so the whole UI's mood follows the chosen hue. Semantics: success emerald `#10B981`, warning amber `#F59E0B`, destructive red `#EF4444`, each with a soft fill for pills. Brand extensions: purple `#8B5CF6` (warisan/"New"), cyan `#06B6D4`, orange `#F97316`. A fixed 5-hue categorical chart ramp (indigo/emerald/amber/violet/cyan) keeps multi-series charts readable. Six swappable **presets** (`data-theme`: emerald, rose, amber, violet, slate) recolor only brand/accent/ring/chart-1.

**Type.** **Sora** (300–800) for all UI and display — geometric, slightly techy, confident. **DM Mono** (400/500, tabular) for money, IDs, and the ⌘K shortcut. The scale is small and dense: most UI text is 10.5–15px; hero numbers reach 28px extrabold with `-0.02em` tracking. Big values are extrabold; labels are 10.5–12px muted; tiny uppercase section labels carry `0.06em` tracking.

**Spacing & radius.** 4px grid; **14px** is the signature gap between dashboard cards. Base radius **14px** (`--radius`), derivatives 10/12/18px, pills at 999px. Icon chips are 26–34px squares at 8–10px radius.

**Cards.** White (`--card`) panels with a soft **inset 1px foreground ring** (`--ring-card`) instead of a heavy border — elevation is deliberately restrained. 14px radius, ~16–22px padding. Shadows appear only on raised elements: the indigo **FAB/primary glow** (`0 2px 8px rgba(79,70,229,.35)`), dropdown pop, and the deep auth-card modal shadow.

**Backgrounds & gradients.** No photography, no textures. Hero/total surfaces use **gradient-wealth** — a 135° indigo gradient (darkened→primary) that follows the active brand color, with a soft translucent glow ring top-right. **gradient-ai** is a near-black slate for the AI surface; **gradient-emerald** for success; the login screen uses a deep indigo `gradient-auth`.

**Borders & lines.** Hairline `--border` (slate, brand-tinted). Table rows and list items are separated by single top-borders, not boxes.

**Motion.** Subtle and functional. Hover **lightens** fills (buttons via `color-mix` toward black on solid, toward muted on ghost/outline); press nudges **1px down** (`translateY(1px)`). Progress bars ease width over 700ms. Nav/accordion use short 120–300ms transitions. The only looping animation is the OCR receipt **scan-line** sweep (`animate-scan`). No bounce, no parallax.

**Hover/press states.** Sidebar items: inactive are muted; hover → secondary bg + foreground text; active → accent bg + primary text (weight bump to 600). Icon buttons: secondary bg → accent bg + primary icon on hover.

**Charts.** Hand-built and lightweight: SVG **donut** (butt-cap arcs on a `--muted` track, centered total), smoothed **canvas sparkline** (white-on-indigo for the hero; primary stroke + translucent fill on light surfaces), and CSS **grouped bar** chart (green income / red expense).

---

## Iconography

- **Lucide** is the icon system (the app uses `lucide-react`), **1.75px** stroke, 24px grid, `currentColor`. Cards and the UI kit load the Lucide UMD from CDN; the kit renders each icon as a React-managed `<svg>` so it survives re-renders. Common icons: `home, wallet, bar-chart-3, briefcase, target, shield-check, bot, receipt, bell, search, plus, gem, eye, line-chart, pie-chart, landmark, calculator, send, log-out`.
- **Emoji** complement Lucide as colorful **category glyphs** inside tinted chips (account types, goals, transaction kinds) — never as UI controls.
- No custom SVG icon set, no icon font of the brand's own. The logo is a rounded-square **indigo "W"** mark + "Wealth**Me**" wordmark (the "Me" in primary). Assets in `assets/`.

---

## Index / manifest

**Foundations**

- `styles.css` — root entry (import this). Pure `@import` manifest.
- `tokens/colors.css` · `typography.css` · `spacing.css` (radius/shadow/gradients) · `fonts.css` (Sora + DM Mono) · `base.css`
- `guidelines/*.card.html` — foundation specimen cards (Colors, Type, Spacing, Brand) shown in the Design System tab.
- `assets/` — `wealthme-logo.svg`, `wealthme-mark.svg`.

**Components** (`window.WealthMeDesignSystem_*`, see `check_design_system` for the exact namespace)

- `components/core/` — `Button`, `Badge`, `StatusBadge`, `ProgressBar`
- `components/forms/` — `Input`, `Select`, `Switch`
- `components/surfaces/` — `Card`, `SectionCard`, `SummaryCard`, `HeroCard`, `MoneyStat`
- `components/charts/` — `Donut` + `DonutLegend`, `Sparkline`, `BarChart`

**UI kit**

- `ui_kits/wealthme-app/` — interactive recreation: login gate → dashboard (Beranda), Aset, AI Advisor, with sidebar nav, topbar, and dark-mode toggle. See its `README.md`.

**Skill**

- `SKILL.md` — portable Agent-Skill manifest for using this system in Claude Code.
