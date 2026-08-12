# WealthMe → Next.js conversion conventions (READ FULLY)

You are porting pages from a single-file HTML demo (`/home/stealth/WORK/vibes/wealthme2/WealthMe_Demo.html`)
into a **Next.js 16 App Router + React 19 + Tailwind v4 + shadcn (base-nova / Base UI)** app.
Stack & foundation are already built. You ONLY create page files (and page-local sub-components). **Do NOT modify any shared/foundation file** (globals.css, lib/_, components/ui/_, components/wm/_, components/charts/_, components/shell/\*, layout.tsx). If you need a helper that doesn't exist, inline it inside your page file.

## Where pages go

Each demo page `id="page-XYZ"` becomes `src/app/(app)/XYZ/page.tsx` with a default export.
Add `"use client";` at the very top of every page (these are interactive).
The route group `(app)` already provides the sidebar/topbar/mobile shell + page padding, so your page renders ONLY the inner content (what was inside `<div class="page" id="page-XYZ">`). Do NOT add sidebars, topbars, page titles, or outer padding — start directly with the page's content. Wrap multi-section pages in a `<div className="space-y-4">`.

## Language & fidelity

Preserve ALL Indonesian copy, numbers, emoji, and structure exactly. This is a faithful port — match the demo's content and layout. Improve only the implementation quality (semantic HTML, accessibility, React state instead of DOM manipulation).

## Formatters — `import { formatRupiah, parseRupiah, formatAmountInput, formatNumber } from "@/lib/format"`

- `formatRupiah(1256780000)` → `"Rp 1.256.780.000"`
- `parseRupiah("1.256.780")` → number
- `formatAmountInput(str)` → live-format a numeric input (use in onChange for Rp inputs)

## Shared data — `import { ... } from "@/lib/data"`

`USER` ({name:"Irfan Arsandi", email, initials:"IA", family:"Arsandi Family"}), `NET_WORTH` (1256780000),
`CASHFLOW` ({months,income,expense,max}), `SPARKLINE_POINTS`, `SEARCH_DATA`, `AI_RESPONSES`, `AI_CHIPS`, `resolveAiResponse(text)`.

## Reusable components — `import { ... } from "@/components/wm"`

- `<SectionCard title={...} action={<CardLink>Lihat</CardLink>}>…</SectionCard>` — a Card with a 13.5px bold muted title row. `bodyClassName` for the body.
- `<CardLink onClick>Lihat Semua</CardLink>` — small primary text button.
- `<StatusBadge variant="success|danger|warning|info|purple|gray">…</StatusBadge>` — pill badge (matches demo `.badge`).
- `<SummaryCard icon="💰" iconBg="var(--success-soft)" iconColor="var(--success)" label="Dana" amount="Rp 45 jt" delta="↑ 2,4%" deltaUp />`
- `<MoneyStat label="Pemasukan" value="Rp 25,85 jt" valueClass="text-success" />`
- `<ProgressBar value={80} color="var(--success)" />` (height prop optional, default 7)
- `<HeroCard className="gradient-wealth">…</HeroCard>` — rounded gradient card w/ decorative circle, white text.

## Charts — `import { ... } from "@/components/charts/apex-presets"` (ApexCharts, since EPIC-025 N3)

The old hand-rolled `Sparkline`/`Donut`+`DonutLegend`/`BarChart` SVG
components were retired in EPIC-025 N3-G/N3-I — every page now renders
charts through the ApexCharts presets below. `donut.tsx` survives only as
the home of the `DonutSegment` type (imported by `@/lib/laporan-utils.ts`
and every donut-using page) — it exports no components anymore.

- `SparklineChart` — area sparkline, `sparkline.enabled: true`. Replaces the old white-line hero sparkline.
- `DonutChart` — replaces `Donut`+`DonutLegend`. Takes `DonutSegment[]` (from `@/components/charts/donut`) — the series is summed for the Apex-rendered center total, so pass real **amounts**, not pre-computed percentages, if you also want a currency-formatted center value.
- `CashflowChart` — grouped income/expense bars, replaces `BarChart`. Takes real Rupiah amounts (the old `BarChart` expected a pre-scaled `/1_000_000` value baked into its own tooltip text — Apex's formatters need the real number).
- `HBarChart`, `TrendChart`, `RadialChart` — additional presets with no direct predecessor, added in N3-A for pages that had no chart before.

All presets: `import { ... } from "@/components/charts/apex-presets"`. Always
pass a real, data-specific `ariaLabel` — the fallback default is
generic and only meant for the error-boundary path. See
`apps/web/src/components/charts/apex-presets.tsx`'s own header comment
for the full prop shape of each preset.

## shadcn UI (Base UI under the hood — IMPORTANT API quirks)

Components live in `@/components/ui/*`: `button, card, input, label, badge, dialog, sheet, tabs, select, textarea, switch, separator, accordion, avatar, progress, table, tooltip, dropdown-menu, scroll-area`.

- **Base UI uses `render={<el/>}` NOT `asChild`.** Triggers render a `<button>` by default — put className/props directly on the trigger.
- For **forms (selects, inputs)** prefer **styled native elements** over the shadcn Select to keep it simple. Native select field class:
  `"w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"`
- Modals: use the `Dialog` from `@/components/ui/dialog`:

  ```tsx
  import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
  const [open, setOpen] = useState(false);
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-w-[480px] sm:max-w-[480px] p-6">
      <DialogTitle className="text-[17px] font-extrabold mb-4">
        Judul
      </DialogTitle>
      …
    </DialogContent>
  </Dialog>;
  ```

  (Always include a `DialogTitle` — add `className="sr-only"` if visually hidden. Override width with BOTH `max-w-[N]` and `sm:max-w-[N]` because the base content sets `sm:max-w-sm`.)

  **Wrap the width in `min(...)`: `max-w-[min(480px,calc(100%-2rem))]`.** The dialog
  base sets `max-w-[calc(100%-2rem)]` to keep a 2rem side gutter on a phone, and
  `tailwind-merge` lets a caller's `max-w-*` replace it outright — verified, not
  assumed: merging the base with `max-w-[480px]` drops the base value entirely.
  A bare `max-w-[480px]` therefore renders the dialog edge-to-edge at 390px wide
  with no side margin. `min()` keeps the intended width above ~512px and restores
  the gutter below it. Same trap as the `dvh` note in `components/ui/dialog.tsx`:
  an override silently defeats the base, just on the width axis instead of height.
  (EPIC-023 I2.)

- The **global "Tambah Transaksi" + search dialogs already exist** — do NOT rebuild them. Page-specific modals (budget, split bill, warisan, donation, add-admin) ARE yours to build locally.

## Toasts — `import { toast } from "sonner"` → `toast.success("…")`, `toast("…")`, `toast.warning("…")`.

Use these wherever the demo called `showToast(...)`.

## Icons — `lucide-react`. (Use any valid lucide name; `FileInvoice` does NOT exist → use `FileText`.) Emoji in content stays as emoji.

## Color token mapping (demo CSS var → use Tailwind class, or `var(--token)` inline)

| demo var               | Tailwind class                        | CSS var                             |
| ---------------------- | ------------------------------------- | ----------------------------------- |
| --primary              | `bg-primary` `text-primary`           | var(--primary)                      |
| --primary-light        | `bg-accent`                           | var(--accent) / var(--primary-soft) |
| --primary-dark         | `text-primary-strong`                 | var(--primary-strong)               |
| --success              | `bg-success` `text-success`           | var(--success)                      |
| (success soft #DCFCE7) | `bg-success-soft`                     | var(--success-soft)                 |
| --danger               | `bg-destructive` `text-destructive`   | var(--destructive)                  |
| --warning              | `bg-warning` `text-warning`           | var(--warning)                      |
| (warning soft)         | `bg-warning-soft`                     | var(--warning-soft)                 |
| --purple               | `bg-brand-purple` `text-brand-purple` | var(--brand-purple)                 |
| --cyan                 | `bg-brand-cyan`                       | var(--brand-cyan)                   |
| --orange               | `bg-brand-orange`                     | var(--brand-orange)                 |
| --bg                   | `bg-background`                       | var(--background)                   |
| --surface              | `bg-card`                             | var(--card)                         |
| --border               | `border`                              | var(--border)                       |
| --text                 | `text-foreground`                     | var(--foreground)                   |
| --text2 / --text3      | `text-muted-foreground`               | var(--muted-foreground)             |

Gradients: classes `gradient-wealth`, `gradient-emerald`, `gradient-profile`, `gradient-ai`. `mono` utility for DM Mono font. `hide-scrollbar` utility.
Dark mode works automatically through these tokens — never hardcode dark colors except inside gradients.

## Responsive grid mapping (demo → Tailwind)

- grid-2 → `grid grid-cols-1 md:grid-cols-2 gap-3.5`
- grid-3 → `grid grid-cols-1 md:grid-cols-3 gap-3.5`
- grid-4 → `grid grid-cols-2 md:grid-cols-4 gap-3.5`
- grid-5 → `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3`
  Tables that scroll on mobile: wrap in `<div className="w-full overflow-x-auto">` with an inner `min-w-[580px]` table.

## Quality bar

Production-grade: no `onclick=` strings, no `document.getElementById`. Use React state/refs. Components must be self-contained and type-safe (TypeScript, no `any` unless unavoidable). Run no commands — just write the page file(s). Keep class lists readable. Match spacing/sizing closely (the demo uses small px sizes like text-[13px]).
