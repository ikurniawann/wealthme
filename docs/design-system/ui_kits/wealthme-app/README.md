# WealthMe App — UI kit

A faithful, interactive recreation of the WealthMe **Personal Wealth OS** web app, built entirely from this design system's tokens and components.

## Run

Open `index.html`. It loads the compiled `_ds_bundle.js`, the Lucide icon CDN, and the screen scripts.

## Flow

- **Login gate** → starts authenticated; click the logout icon (top-right) to see the deep-indigo `gradient-auth` login screen, then **Masuk** (demo: `demo@wealthme.id` / `demo1234`) to re-enter.
- **Sidebar nav** — Beranda, Aset, and AI Advisor are interactive; other items route back to Beranda (not recreated).
- **Topbar** — sun/moon toggles **dark mode** across the whole app; search + notifications are cosmetic.

## Screens

| File                 | Surface                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `screen-beranda.jsx` | Dashboard: wealth hero + sparkline, allocation donut, 5 KPI tiles, cashflow bars, recent transactions, goals, AI insight banner |
| `screen-aset.jsx`    | Assets: KPI strip, filterable table with status pills, composition donut                                                        |
| `screen-ai.jsx`      | AI Advisor: chat thread (type to get a canned reply), health score, suggested prompts                                           |
| `screen-login.jsx`   | Authentication card on the indigo auth gradient                                                                                 |

## Supporting files

- `data.js` — mock data + Rupiah/compact formatters (plain `window.WM`)
- `icons.jsx` — `WMIcon`, a re-render-safe Lucide `<svg>` wrapper
- `shell.jsx` — `Sidebar` + `Topbar`
- `app.jsx` — login gate, shell, and screen routing

## Composition

Screens compose system primitives — `HeroCard`, `SectionCard`, `SummaryCard`, `Donut`/`DonutLegend`, `Sparkline`, `BarChart`, `ProgressBar`, `StatusBadge`, `Button`, `Input` — from `window.<Namespace>` (the bundle). They are cosmetic recreations, not production logic.
