## beranda

Scores: desktop 4/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The forest/lime bento has real character, but the page leaks IDR units into a EUR account, its charts are clipped and partly in the wrong unit, and the Catat transaksi dialog fails silently.

### Defects

- [P0] desktop 014-click-grafik-garis.png — The line-chart y-axis reads "30M / 20M / 10M / 0 / -10M" (raw IDR millions) beside a "≈ € 73.375,73" headline → format the axis in the account currency (€) with the same abbreviation rules as the KPIs.
- [P0] desktop 009/011-catat-transaksi-\*.png — The Akun chips in the dialog show "Rp 128.450.000 / Rp 85.200.000 / Rp 32.000.000", while the Rekening card on the same page shows "≈ € 6.410,66" for BCA → show the account balances in the display currency.
- [P0] desktop 010-catat-transaksi-validation.png — An empty submit is pixel-identical to the open state: no field errors on Jumlah, Akun or Kategori, no error summary, no focus move → show inline errors under each required field and give the Jumlah field an error border.
- [P0] desktop 012-catat-transaksi-submitted.png — After "Simpan" with no Akun or Kategori selected, the dialog stays unchanged: no toast, no error, no highlight on the missing fields (silent failure) → block with visible field errors, or close and show a success toast.
- [P0] desktop 001-page.png vs 020-nav-ubah.png — "Batas pengeluaran bulanan" shows a fully red, over-limit bar ("€ 2.051,55 anggaran terpakai" against "€ 548,99"), while the Anggaran page it links to says "Terpakai ≈ € 2.051,55 · 0% dari batas" → derive both from one budget computation, and label the right-hand number ("Batas € 548,99 · lewat 274%").
- [P1] desktop 008-notifikasi-menu-open.png — The notification copy hardcodes Rupiah ("Rp 60.000.000", "Rp 2.000.000", "Rp 4.200.000") in a EUR account → render the amounts through the currency formatter.
- [P1] desktop 001-page.png — The Tujuan rows use IDR unit suffixes ("42 / 60 jt", "15,6 / 25 jt", "120 / 300 jt", "0,3 / 1 M") right next to "≈ € 898,34 lagi" → show progress in € (or as a %) and drop "jt"/"M".
- [P1] desktop 006-select-30h.png — The 30h bar chart clips its x-axis labels ("2(", "2ε", "3(", "1(") and its y-axis labels at the card's left edge ("€ 1.315,07", "-≈ € 264,45") → reserve axis gutters, or rotate/thin the ticks.
- [P1] desktop 001-page.png / 003-tab-7h.png — On the 7h bar chart, the 0 baseline sits near the top and expense bars hang downward to an unlabeled depth. The minimum label "-≈ € 261,43" is clipped at the left edge. There are no Pemasukan bars, although the KPI shows "Pemasukan ≈ € 1.521,05" → when a series is zero for the range, say so ("Tidak ada pemasukan 7 hari terakhir"), and fix the clipped label.
- [P1] desktop 014-click-grafik-garis.png — The line chart occupies only the top half of the hero. The legend disappears and ~120px of empty dark area remains below the x-axis → fill the plot height and keep the series legend.
- [P1] desktop 009-catat-transaksi-dialog-open.png — The currency picker shows a missing-glyph box ("☒☒ EUR") instead of a flag → use an SVG flag or drop the glyph.
- [P1] desktop all shots — The floating AI button at the bottom right is cut in half by the viewport edge (offscreen) and overlaps the Riwayat list → inset it by the page gutter.
- [P1] desktop 015-nav-tambah.png — "+ Tambah" on the Rekening card navigates to the Rekening Bank list instead of an add-account flow → open the add-account dialog, or relabel it "Kelola".
- [P1] desktop 020-nav-ubah.png — "Ubah" on the budget card navigates to the Anggaran overview, not an edit form → open the budget editor, or relabel it "Lihat anggaran".
- [P2] desktop 001-page.png — The Riwayat transaksi amounts read "-≈ € 45,22" (the sign is outside the approximation mark, which differs from the "≈ -€ 530,50" order in the KPI column) → use one sign/≈ order everywhere.
- [P2] desktop 001-page.png — The Riwayat transaksi title wraps to two lines ("Riwayat / transaksi"), and the subtitles truncate ("10 Okt · Mandiri ·…", "10 Okt · BCA Taha…") → widen the column or shorten the title to "Riwayat".
- [P2] desktop 001-page.png — In Tujuan, the goal name truncates ("Dana Darurat 6 B…"), and "Sesuai rencana · ≈ / € 37.430,87 lagi · 3 Okt 2036" breaks mid-value across lines → put the status/remaining amount on its own line with nowrap on the amount.
- [P2] desktop 002-page-scroll-1.png — The Kesehatan finansial card is ~60% empty between the alert block and the footer note, and the Analisis pengeluaran card also has a large dead tail → shorten the row or add content (trend sparkline).
- [P2] desktop 002-page-scroll-1.png — "Kesehatan finansial ≈ -€ 336,93 (30 hari)" sits next to the hero "Selisih ≈ -€ 530,50 (1–11 Okt)": two different "selisih" numbers with no visible reconciliation → label each window explicitly in the headline.
- [P2] desktop 001-page.png — The 7h/30h dropdown in the hero and the 7h/30h segmented control in Riwayat are two different control styles for the same concept, and the Riwayat list does not change between 7h and 30h (003 vs 004) → use one segmented style, and filter the list, or remove the toggle.
- [P2] desktop 016-click-rekening-berikutnya.png — The carousel arrows sit on top of the card chip and number, and the previous card peeks in at the left edge → place the arrows outside the card track.
- [P2] desktop 009-catat-transaksi-dialog-open.png — The 4th account chip is cut off under the "›" arrow, and the first chip truncates "BCA Tahapan ···9…" → show full chips (wrap or a two-row grid) with a "3 dari 6" pager that does not clip.
- [P2] desktop 009-catat-transaksi-dialog-open.png — Category icons are generic (Audit QA 1, Hiburan and Lainnya Pengeluaran share the same link icon), and "Lainnya Pengeluaran" is the only label that wraps to two lines → give each category a distinct icon and use one-line labels.
- [P2] desktop 009 vs 011 — The Jumlah field changes style between states (boxed with a dark border plus a lime underline when empty, underline-only when filled), and the whole dialog jumps up 9px → use one field treatment and a fixed dialog position.
- [P2] desktop 009-catat-transaksi-dialog-open.png — The close "×" button straddles the header's bottom edge instead of centring in the green band. The Simpan button has a drop shadow, against the no-shadow system → centre it vertically and remove the shadow.
- [P3] desktop 009-catat-transaksi-dialog-open.png — Three different footer button styles (outline Batal, ghost "Simpan & tambah lagi", filled Simpan with an arrow chip) with uneven widths → make it two tiers: primary filled, secondary outline.
- [P3] desktop 001-page.png — The demo data reads "Bulk pagination test 468/414/360…" on the home screen → seed realistic merchant names.

### Dialogs & forms seen

- Cari (command palette): ok; it is clean, but only pages are listed and no transactions appear despite the "transaksi" placeholder.
- Notifikasi menu: hardcoded Rp amounts, no timestamps, no read/unread state.
- Tambah Transaksi: Rp balances on the account chips, a tofu glyph on the currency pill, no inline validation, a silent no-op submit, a clipped account carousel, and a jumping layout.

### Not reachable

- The submitted success state (toast) was never reached, because the submit is a silent no-op without an account and category.
- The Anggota keluarga "⋮" menu and the Lampiran expander were not opened.

## ringkasan

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The hero chart is broken (a flat line on a 1.5B IDR axis that ignores the unit and period controls), native OS selects break the visual language, and several KPIs contradict each other on the same screen.

### Defects

- [P0] desktop 022-page.png — The hero chart's y-axis reads "1.5B / 1B / 500M / 0" (raw IDR) under a "≈ € 73.375,73" headline. It plots one flat line pinned to the top edge → plot net worth in the display currency with an auto-scaled domain.
- [P0] desktop 026/029/032/035/040-\*.png — Switching IDR→Emas→USD/JPY/CNY and 1 Bln→Semua changes the headline numbers, but the chart stays identical (same 1.5B axis, same "7 Okt – 10 Okt" x-range for every period, including "12 Bln" and "Semua") → re-query the series per unit and period.
- [P0] desktop 022/023-\*.png — "Selisih dari pemasukan · Okt 2026 -35%" in the hero contradicts the "Skor kesehatan" gauge "0 % Rasio selisih Okt 2026" further down → make both read one ratio and show the negative value on the gauge.
- [P1] desktop 023-page-scroll-1.png — The Skor kesehatan card pairs a "Perlu Perhatian" red badge with the copy "Rasio utang terhadap aset 22,4% – masih dalam batas aman". The badge and the message disagree, and the message is about debt while the gauge is about selisih → align the badge severity with the message, and show the metric the gauge is titled after.
- [P1] desktop 029/032/035-select-\*.png — With USD/JPY/CNY selected, the hero switches currency, but Komposisi Aset, Arus kas and Pengeluaran terbesar stay in €. The footnote also claims "Nilai dalam JPY adalah perkiraan…" → either convert every card or scope the currency control visibly to the hero.
- [P1] desktop 025-tab-idr.png — The tab labelled "IDR" displays € values → rename it to the account currency ("EUR") or show actual IDR.
- [P1] desktop 028/029-\*.png — The period control is an unstyled native <select> (white OS box, blue OS highlight list) inside the dark hero, beside the custom pill tabs → use the app's dropdown/segmented component.
- [P1] desktop 027-tab-valas-usd-sgd-eur-jpy-aud-cny.png — The Valas listbox shows missing-glyph boxes before every code ("☒☒ USD"), and the option text is pale grey on white (low contrast). Once chosen, the pill turns into a white OS select (029) → use SVG flags, the app's listbox styling, and a stable selected-state style.
- [P1] desktop 041-select-kustom.png — Choosing "Kustom" shifts the whole control row left. The range field truncates ("11 Juli 2026 – 11 Oktob") and pushes the chart down. The hero then grows 66px, misaligning it with the Komposisi card → reserve a fixed slot for the range field.
- [P1] desktop 042-11-juli-2026-11-oktober-2026-dialog-open.png — The date-range dialog opens scrolled off the top of the viewport. Only the "Batal / Terapkan" buttons are visible, and its 7 tiny text nodes are unreadable → anchor the picker in view (or as a centred modal) and scroll it into view.
- [P1] desktop 022-page.png — The "↓ ≈ € 530,50 bulan ini" badge is red text on a red outline on dark green, at ~10px: illegible (same in Emas/USD) → use a filled chip with AA contrast and ≥12px text.
- [P1] desktop 022-page.png — The Arus kas y-axis label "≈ € 2.359,56" hangs outside the card's left edge (x≈257 < card x 264) → move the label inside the plot gutter.
- [P1] desktop 023-page-scroll-1.png — The Arus kas summary labels "≈ -€ 530,50" as "Surplus", and its "Pemasukan/Pengeluaran" values are October-only under a chart titled "Mei – Okt" → label it "Selisih" and state the period of each figure.
- [P2] desktop 022-page.png — The Arus kas card has two legends (one top-right, one under the title), and its title "Arus kas Okt" conflicts with the subtitle "Mei – Okt" → keep one legend and one period.
- [P2] desktop 022/023-\*.png — Komposisi Aset lists "Dana ≈ € 182,16" and "Tunai ≈ € 149,72", while the Rincian table merges them into "Kas & E-Wallet ≈ € 331,89". "Rekening" vs "Bank & Rekening" is a further naming mismatch → use one taxonomy across both cards.
- [P2] desktop 022-page.png — Komposisi Aset ends at y≈465, leaving a ~90px hole above Pengeluaran terbesar. The Pengeluaran terbesar and Liabilitas terbesar cards are each ~50% empty below their lists → balance the bento heights, or let the cards hug their content.
- [P2] desktop 022-page.png — "Lihat detail" is an outlined pill, while the sibling card action "Laporan" is a bare green text link → use one secondary-action style.
- [P2] desktop 024-page-scroll-2.png — In the Rincian table, the asset "Jenis" chips are darker with bold text, while the "Liabilitas" chips are lighter and thinner. The Kekayaan Bersih row puts formula text in the Jenis column → use one chip style with semantic colour, and put the formula in a caption.
- [P2] desktop 043-click-sembunyikan-nominal.png — "Sembunyikan nominal" blurs the amounts but leaves "-35%" and the full Arus kas bar shapes visible (the magnitude still leaks) → mask the ratios and chart bars too, or label the control as hiding amounts only.
- [P3] desktop 026-tab-emas.png — The Emas mode shows "Total Liabilitas 167,22 gr" (debt expressed in grams of gold) and keeps "≈ US$ 82.224,84 · 580,52 gram" as the subline → hide the redundant subline in Emas mode.

### Dialogs & forms seen

- Valas listbox: tofu flag glyphs, low-contrast options.
- Periode native select: OS-styled, off-brand.
- Kustom date range dialog: opens off-screen (only the footer buttons are visible).

### Not reachable

- The Kustom range calendar body was never visible in a shot (scrolled away), so its day grid and validation went unreviewed.

## transaksi

Scores: desktop 3/2/3 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Solid filter-plus-list structure, but the hero headline hardcodes "Rp" on € values, ignores the type tabs, and contradicts its own KPIs. The Tambah Transaksi dialog has no validation and no success feedback.

### Defects

- [P0] desktop 045-page.png — The hero headline reads "-Rp 3.187,35" (and "Rp 7.364,66" in 047, "Rp 0,00" in 058) while every other figure is "≈ € …" → use the account currency symbol.
- [P0] desktop 074/075/076-click-\*.png — With the Masuk, Transfer or Kartu Kredit tab active, "Jumlah transaksi" changes (31 / 0 / 0), but the headline "-Rp 3.187,35 Defisit" and "Total Pengeluaran ≈ € 13.199,62 · 529 transaksi" stay unfiltered. "Jumlah transaksi 0" sits next to "529 transaksi" in the same card → apply the type filter to every hero figure.
- [P0] desktop 075-click-transfer.png — "100% transaksi sudah terkategori" is shown with "Jumlah transaksi 0" → hide the ratio when the count is 0.
- [P0] desktop 069-catat-transaksi-validation.png — An empty submit shows no field errors at all (identical to 068) → inline errors on Jumlah, Akun and Kategori.
- [P0] desktop 071-catat-transaksi-submitted.png — The submit with no account or category selected gives no feedback: the dialog is unchanged, with no toast, no error, and nothing highlighted → block with visible errors, or confirm with a toast and a list refresh.
- [P0] desktop 068/070-catat-transaksi-\*.png — The Akun chips show "Rp 128.450.000 / Rp 85.200.000 / Rp 32.000.000" in a EUR account → show the balances in €.
- [P1] desktop 045/046-\*.png — "Terbaru" lists future-dated rows ("25 Oktober 2026", "22 Oktober 2026"; Masuk shows "19/16 Oktober 2026") while today is 11 Okt. Beranda's Riwayat shows 10 Okt as newest → exclude or flag scheduled/future transactions ("Terjadwal"), and keep both lists in agreement.
- [P1] desktop 045-page.png — The hero y-axis label is clipped at the card's left edge ("€ 2.718,90", and "€ 1.865,71" in 047/074) → add a left gutter.
- [P1] desktop 058/065/055-select-\*.png, 075/076 — With zero results, the hero keeps a ~380px empty dark plot with only an axis. The headline reads "Rp 0,00 Surplus". "Ekspor CSV / Catat transaksi" jump from below the headline to the top-right row → render a chart empty state, show "€ 0" with a neutral label, and keep the button position fixed.
- [P1] desktop 058-select-audit-qa-1.png — The empty list is a single grey line "Tidak ada transaksi pada filter ini." with no "Hapus filter" action, while a stale account filter (Kas Tunai) persists from a previous selection → add a reset CTA in the empty state.
- [P1] desktop 045-page.png — The type segmented control wraps: "Kartu Kredit" drops to a second row under "Semua" → fit five segments on one line (smaller padding) or use a select.
- [P1] desktop 046-page-scroll-1.png — The floating AI button overlaps the "Berikutnya" pagination button and is itself cut in half at the viewport edge → inset the FAB and add bottom padding to the list card.
- [P2] desktop 047-select-bca-tahapan-9010.png — The active-filter chip "Mutasi: BCA Tahapan ···9010 X" uses a literal letter "X" as its close control, duplicates the Akun select value, and grows the filter card and hero by 44px (layout shift) → use an icon button and reserve the chip row.
- [P2] desktop 046-page-scroll-1.png — The day-group totals ("-≈ € 212,36") right-align at x=1404 while the row amounts align at x=1396 → put both on one right edge.
- [P2] desktop 045-page.png — "Urutkan:" has a trailing colon, while its sibling labels (Rentang Tanggal, Akun, Kategori) do not → drop the colon.
- [P2] desktop 045-page.png — Two "Catat transaksi" buttons are visible at once (topbar filled plus hero ghost) → keep one per screen.
- [P2] desktop 077-semua-tanggal-dialog-open.png — The date popover overlaps and clips the "Akun" label ("A" visible). Today (11 Okt) is not marked, "Terapkan" is enabled before any date is picked, and the 7 tiny-text nodes (weekday headers) are under 11px → anchor the popover below the field without covering labels, mark today, disable apply until valid, and raise the weekday text size.
- [P2] desktop 067-click-ekspor-csv.png — "Ekspor CSV" stays enabled with 0 results, and its result toast has no icon or status colour → disable the button on empty results, and style the toast as info.
- [P2] desktop 070-catat-transaksi-filled.png — The dialog opened from a page filtered to "Kas Tunai" does not preselect that account → default Akun to the active filter.
- [P3] desktop 046-page-scroll-1.png — Every row is "Bulk pagination test NNN" seed data → seed realistic transactions.

### Dialogs & forms seen

- Tambah Transaksi: same defects as on beranda (Rp chips, tofu "☒☒ EUR", no validation, silent submit, clipped account carousel, field style jump).
- Rentang tanggal popover: overlaps the Akun label, no today marker, apply always enabled, tiny weekday text.
- Ekspor CSV toast: ok copy, unstyled.

### Not reachable

- No transaction detail or edit view: the rows show no click affordance, and no row action was captured.
- The Akun and Kategori dropdown menus were not captured open; only their results were.
