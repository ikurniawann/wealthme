# Group: planning

Pages built: `anggaran.html`, `tujuan.html`, `laporan.html`, `cetak.html`.

## anggaran.html — real source: `apps/web/src/app/(app)/anggaran/page.tsx`

| Feature (source)                                                                                                                                | Where in HTML                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header "Anggaran <bulan>" + total budget + kategori count                                                                                       | `.ph` + `#sub`                                                                                                                                    |
| Hero card: sisa anggaran, % badge, hari lagi, progress terpakai/rencana                                                                         | `.cover.s8` (`draw()`)                                                                                                                            |
| Mini stats: total terpakai %, sisa hari + aman/hari                                                                                             | `.card.s4` (`statSpent`/`statDays`)                                                                                                               |
| Over-budget / near-limit warning notice                                                                                                         | `#alertWrap` `.note.warn`                                                                                                                         |
| Obligations ("Kewajiban bulan ini") from liabilities+insurances, Pay button + dialog (source-account select), "Lunas" badge, disabled once paid | `#obWrap`, `openBudgetDialog`-adjacent `[data-pay]` handler; pay reduces liability `outstanding`, records `paidPeriod`, creates a real `WM.addTx` |
| Category breakdown grid: progress bar, over-budget red border, edit/delete icons                                                                | `#catGrid` `.bcard`                                                                                                                               |
| "Terpakai per kategori" bar list, sorted desc                                                                                                   | `#barList`                                                                                                                                        |
| Add category dialog: name (creates a real `categories` entry) or reuse existing, icon picker (`.cgrid`/`.ctile`), amount + period               | `openBudgetDialog(null)`                                                                                                                          |
| Edit dialog: amount + period only (category name/icon read-only)                                                                                | `openBudgetDialog(id)`                                                                                                                            |
| Delete confirm                                                                                                                                  | `WM.confirm` in delete handler                                                                                                                    |
| `spent` reacts live to new transactions                                                                                                         | uses `WM.spent(catId, ym)`, wired via `WM.onChange(["tx",...])`                                                                                   |

Simulated / cut vs source: COA account picker, "manage Category" role split (member vs owner), and the FIXED/VARIABLE/REIMBURSEMENT budget-type breakdown are all COA-backed features with no COA model in the prototype store — omitted rather than faked (Honest UI). Budget `period` (weekly/yearly) is stored but spend is always computed against the current calendar month, noted in the dialog hint.

## tujuan.html — real source: `apps/web/src/app/(app)/tujuan/page.tsx` + `_components/contribute-dialog.tsx` + `contribution-history.tsx`

| Feature (source)                                                                                                                                                                                                                               | Where in HTML                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| "N tujuan aktif" + total terkumpul                                                                                                                                                                                                             | `.ph`                         |
| 4 KPI cards (on track/needs boost/at risk/overall), hidden when exactly 1 goal                                                                                                                                                                 | `#kpiWrap`                    |
| Goal cards: status strip+pill (achieved/on_track/needs_boost/at_risk computed with the same elapsed-vs-target-date formula as `goals.service.ts`), %, progress, collected/target, remaining, auto-debit line, "perlu nabung Rp X/bulan" notice | `#goalGrid` `.gcard`          |
| Add/Edit dialog: nama, icon picker, target, terkumpul, tanggal target, rekening tujuan, auto-debit amount/day/sumber (advanced disclosure)                                                                                                     | `openGoalDialog`              |
| Delete confirm with net-worth note                                                                                                                                                                                                             | delete handler                |
| Contribute ("Setor") dialog: amount, optional source account, date                                                                                                                                                                             | `openContribDialog(id,false)` |
| Contribution history toggle per card, collection `goalContributions`                                                                                                                                                                           | `[data-hist]` handler         |
| Add-goal dashed card                                                                                                                                                                                                                           | `#addCard`                    |

Beyond source (per GUIDE's explicit "withdraw" ask, real page has no withdraw endpoint): a symmetric "Tarik dana" action was added next to history, clearly a prototype-only addition, using the same dialog reversed.

## laporan.html — ports `../laporan-concept.html` onto the shared shell, cross-checked against `apps/web/src/app/(app)/laporan/_components/*`

Shell/sidebar/topbar/mobile-nav from the concept file were removed; the page uses `WM.shell` instead. CSS was rebuilt almost entirely from wm.css's existing primitives (`.grid/.s3..s12`, `.card`, `.cover`, `.headline`, `.tbl/.tw`, `.list/.row`, `.track`, `.strip`, `.pill`, `.chg`) — only the report-index-rail/mobile-picker/cover-cbtn/coa-tree rules are page-local CSS. All **17 reports** from `report-groups.ts` are present (Ringkasan, Harian, Bulanan, Tahunan, Group Family, Bank, Detail, Aliran Dana, PNL, Cashflow, Arus Kas, Investasi, Performa, Balance Sheet, Aset & Liabilitas, Pajak, Ringkasan COA), grouped exactly like `REPORT_GROUPS`.

Filter parity added (the concept only had a 4-option per-report segmented control): a **Tahun/Bulan/Rentang** filter card mirroring the real `PeriodFilter` + `RangePresetSelect`, driving the monthly reports.

Unlike the concept (static demo numbers), every report's headline, chart and table is derived live from `WM.store` (tx/accounts/investments/assets/liabilities/members), reacting via `WM.onChange`. Sankey/calendar-heatmap/gauge visuals from the concept were replaced with `WM.chart.bars/area/waterfall/donut` + `.track` bar-lists (GUIDE's "reuse WM.chart where equivalent") since the exact custom SVGs would need fabricated intermediate data. `rpajak` is clearly labelled "Perkiraan… bukan SPT resmi" (progressive-bracket estimate, honest per GUIDE). CSV export (`WM.csv`) and "Cetak PDF" (→ `cetak.html?r=<reportId>`) both work per report.

## cetak.html — real source: `apps/web/src/app/laporan/cetak/page.tsx`

No shell (standalone `<html>`-level page, `wm.css`+`wm.js` only, no `WM.shell` call — always reachable like the real route that sits outside `(app)`). Letterhead, KPI band (Pemasukan/Pengeluaran/Tabungan Bersih/Savings rate), monthly trend bar chart + table, top-expense-categories bars, and print-only `@page A4` rules are ported 1:1 in spirit from the source's inline print CSS. "Unduh PDF" calls `window.print()`; "Kembali" uses `history.back()`/falls back to `laporan.html#<r>`. Extended beyond source per GUIDE's `?r=<reportId>` requirement: the page title and a per-report detail table (investments / balance sheet / per-member / accounts / tax) adapt to the `r` query param instead of always showing the fixed summary.

## Verify

`node _shot.cjs anggaran.html tujuan.html laporan.html cetak.html` — all 4 pages, both breakpoints (1440/390): no console errors, no horizontal overflow.
