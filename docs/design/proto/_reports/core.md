# Group: core

Pages built: `index.html` (beranda), `ringkasan.html` (ringkasan), `transaksi.html` (transaksi).
All three use only the shared `WM.shell`/`wm.js`/`wm.css` foundation; no other proto files, `wm.css`, `wm.js`, or git write commands were touched.

## index.html — beranda

Ported `../dashboard-concept.html`'s bento layout onto the shared shell (own sidebar/topbar/mnav/tx-dialog/toast removed, only page-specific CSS kept), driven live from `WM.store`.

Feature map (source: `apps/web/src/app/(app)/beranda/_components/*`, `use-beranda-data.ts`):

- SetupChecklistCard -> `#setupWrap`, live from `WM.store` (5 steps: rekening/anggaran/transaksi/anggota/tujuan).
- Hero net worth + KPIs + cashflow -> `.cover.hero.s8`, 3bln/6bln toggle over real `WM.income`/`WM.spent` per month.
- WealthSnapshot -> liquid vs non-liquid split card, links to `ringkasan.html`.
- 4 StatCards (Cash&E-Wallet, Bank&Rekening, Investasi, Liabilitas) linking to their WM.NAV pages.
- AllocationCard -> `WM.chart.donut` over Kas/Investasi/Aset fisik.
- RecentActivity -> real `tx` via shared `WM.txRow` (click -> `WM.openTxDetail`), "Lihat semua" -> `transaksi.html`.
- BudgetCard -> top-4 budgets, `WM.spent(cat)` vs limit, over-budget note, -> `anggaran.html`.
- AttentionCard -> pending fund requests + nearest-due liability, -> `persetujuan.html`/`liabilitas.html`, empty state.
- GoalsCard -> up to 3 goals with real progress, -> `tujuan.html`, empty-state CTA.
- Extra (kept from approved concept, functional not decorative): wallet `.pcard` carousel per real account + quick actions (Catat/Transfer wired to `WM.openTx`, Riwayat -> `transaksi.html`) + family avatars.

Simulated: "Minta dana" wallet action -> toast "(simulasi)" (no request-creation flow wired here).
Dropped vs the concept, intentionally: the concept's tips/insight mosaic and health-gauge cards -- neither exists in the real beranda page (real page removed the AI-insight banner as fabricated copy).

Verify: `node _shot.cjs index.html` -> 1440px & 390px `overflow:false`, `errors:none`. Playwright spot-check: wallet "Catat" -> `WM.openTx` -> submit -> toast + hero net worth updated live; "Lainnya" popover opened. 1024px not separately screenshotted (script only shoots 1440/390) but page CSS only layers on wm.css's existing 1180/900/720 breakpoints, so 1024 sits inside the already-verified collapsed-sidebar range.

## ringkasan.html — ringkasan

No prior concept file existed for this page; designed fresh in the bento language (dashboard/laporan-concept vocabulary: `.cover`, `.grid` spans, `WM.chart.*`).

Feature map (source: `apps/(app)/ringkasan/_components/*`, `use-ringkasan-data.ts`, `use-ringkasan-privacy.ts`):

- page-lead: currency segmented (IDR/Emas/asing), trend range segmented (incl. custom date range), privacy blur toggle -> `#curSeg`/`#rangeSeg`/`#customRange`/`#privacyBtn`, all functional and re-render the page.
- hero-stats: net worth cover + assets/liabilities/savings-rate stat cards.
- consolidated-total-card: IDR/USD/gram-emas simultaneous total, labeled "Perkiraan".
- trend-composition: net worth trend (`WM.chart.area`) + YoY badge, donut composition + progress list, -> `aset.html`.
- breakdown-table: asset/liability rows + subtotals + net worth row.
- cashflow-card: grouped income/expense `WM.chart.bars` + Pemasukan/Pengeluaran/Surplus.
- top-expenses-card: top-5 category horizontal bars (page-local `.hb-row`/`.track`, wm.js has no hbar helper) -> `laporan.html`.
- health-score-card: custom inline-SVG radial gauge (wm.js has no radial helper) plotting real savings rate + debt-ratio notice.
- liability-breakdown-card: sorted horizontal bars of liabilities.

Simulated, honestly labeled: FX conversion (USD/SGD/JPY/EUR) and gold-per-gram price are fixed indicative constants, always prefixed "~" with a visible footnote noting the rate/price is simulated. Net-worth trend history is honestly reconstructed backward from current net worth using real per-month income-expense (no fabricated history); "1 bln" range correctly falls back to the real component's own empty state since seed data only spans 2 months.
Missing, matching the real app's own decision: no export button (real page's source comments say this was cut as mock-only). Drill-down from category/liability rows into filtered transaction views was not added since it doesn't exist in the real app either (only "Laporan"/"Detail" links, which are kept).

Verify: `node _shot.cjs ringkasan.html` -> 1440px & 390px `overflow:false`, `errors:none`. Manually checked 1024px (custom Playwright script) -> `overflow:false`, no errors, sidebar collapses to icon rail. Interactively drove every control: privacy toggle, foreign-currency select recompute, custom range reveal + apply, "1 bln" empty state. Net worth reconciles exactly between hero and breakdown-table bottom row.

## transaksi.html — transaksi

Feature map (source: `apps/web/src/app/(app)/transaksi/page.tsx` + `components/shell/transaction-dialog.tsx`):

- Filters: type chips (Semua/Masuk/Keluar/Transfer/Kartu kredit), date range, account select, category select, sort, plus an added search box and an owner-only member filter (both reasonable additions beyond the real page, noted as such).
- Active-filter chips with per-filter clear.
- Pagination, PAGE_SIZE 10, Prev/Next (matches real page exactly; no infinite scroll in the real page either).
- Export CSV via `WM.csv`+`WM.download` (real, client-side only -- an honest addition since the real page has none).
- Summary reworked into one `.cover.hero-tx` band: income/expense/tx-count stats + weekly masuk-vs-keluar `WM.chart.bars` + surplus/defisit headline.
- Per-row edit/delete, disabled + tooltip when `WM.canModifyTx(t)` is false.
- Row click -> detail via wm.js's global delegated `[data-tx]` handler.
- Empty state, single `.tbl` inside `.tw` for responsive scroll.
- Add/Edit dialog: reuses `WM.openTx` as-is (type toggle, amount, account/category tiles, date, member, note, live budget hint, simulated receipt scan).
- Detail: reuses `WM.openTxDetail` as-is, with edit-lock note and Edit/Hapus (confirm + undo toast) footer.
- Deep link: `transaksi.html#<txId>` opens that transaction's detail automatically on load.
- Live updates: `WM.onChange(["tx","accounts"], draw)`.

Not replicated (documented foundation gaps, not silently dropped): the dialog's 4th "Kartu Kredit" tab (liability-linked purchase -- wm.js has no liability-linked tx concept; workaround is the existing "Kartu kredit (Mandiri)" account tile via the normal expense flow), currency/FX selector on amount (wm.js money helpers are IDR-only), transfer's optional admin-fee field, and a dedicated attachment list beyond the simulated scan button (wm.js tx has no attachments array).

Verify: `node _shot.cjs transaksi.html` -> 1440px & 390px `overflow:false`, `errors:none`. Manual 1024px Playwright check -> same, clean. Deep link `#t1` (real seed id) verified opening the detail dialog on load. Every dialog (add/edit/delete-confirm/export) opened once via Playwright clicks with zero console errors.

## Cross-page notes

- All three pages read/write the same `WM.store` collections and use the shared `WM.openTx`/`WM.openTxDetail`/`WM.canModifyTx` so a transaction added on `index.html` is immediately visible and editable on `transaksi.html`, and vice versa.
- Some target pages referenced by links (`anggaran.html`, `investasi.html`, `liabilitas.html`, `tujuan.html`, `aset.html`, `laporan.html`, `persetujuan.html`, `dana.html`, `rekening.html`) are owned by other groups and were not built here; links point at them per `WM.NAV` conventions for when those groups land.
