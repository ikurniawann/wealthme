## beranda

Scores: desktop n/a · tablet n/a · mobile 4/3/3 (Karakter/Konsistensi/Kerapian)
Verdict: The first viewport is strong (hero card, two CTAs, labelled dock), but it carries hardcoded "Rp" chips, a dot-matrix chart that says almost nothing, and a Tambah Transaksi sheet that spends half its height on oversized account cards and a rate disclaimer.

### Defects

- [P1] mobile 001-page.png — A circular "Rp" badge sits above the "≈ -€ 1.176.786,48" net-worth headline, and another "Rp" chip sits before the "Pengeluaran" label next to "≈ € 1.252.213,75" (hardcoded currency chips next to € values) → drop the chips, or render the account-currency symbol "€".
- [P1] mobile 001-page.png — The first viewport shows no budget or cash-flow status: the 300px tall decorative BCA card carousel (6 dots) takes the centre of the hero, while desktop's "Batas pengeluaran bulanan", Analisis and Kesehatan cards are absent from the mobile page entirely → shrink the card to a compact balance row (~96px), and surface the monthly budget bar in the first viewport.
- [P1] mobile 002-page-scroll-1.png — The "Statistik 7 hari" dot-matrix is a ~235px card that carries one data point: six columns of empty grey dots and one black column on "Sab"; there are no values, no scale, and no lime dots, although the legend lists "Pemasukan" → replace it with a 7-bar sparkline that has a € total and a min/max label, or state "Tidak ada pemasukan 7 hari terakhir".
- [P1] mobile 001-page.png — The "↑126226%" chip under Pengeluaran is an unbounded raw percentage (it overflows any meaning) → cap the display (">999%") or show the absolute delta.
- [P2] mobile 001/002-\*.png — On the "Transaksi terakhir" card, "DU AD" family avatars sit beside the + button with no label, and they say nothing about the transaction; the card shows one truncated row ("Bulk pagination test 456 · ≈ € 40,48") in a 150px tile → show 2–3 rows with amount and date, and label or remove the avatars.
- [P2] mobile 001-page.png — The page header shows "Selamat pagi, Demo" above "Selamat datang kembali!", two greetings that use ~50px before any content → keep one line.
- [P1] mobile 005/006/007-catat-transaksi-\*.png — The Akun cards are ~150×105px each, so only 2 of 18 accounts fit; the third card is cut at the right edge (offscreen tx-tile); a stray "-" line sits under "Mandiri" on the Mandiri card; balances read "Rp 128.450.000 / Rp 24.966.425.000" → use compact 56px account chips or a picker row ("BCA ···9010 · €6.410"), delete the "-", and show € balances.
- [P1] mobile 005-catat-transaksi-dialog-open.png — A 3-line rate disclaimer ("1 EUR = Rp 20.036,94 · ECB… Disimpan sebagai IDR…") sits between Jumlah and Akun and pushes Kategori below the fold → collapse it to one muted line or an info tooltip.
- [P1] mobile 005/007-\*.png — The Kategori tiles show the same truncated label twice ("Asset & Other…" / "Asset & Other…"), and two other tiles share the identical generic link icon (Audit QA 1, Hiburan) → use distinct names with 2-line wrap, and give each category its own icon.
- [P2] mobile 005-catat-transaksi-dialog-open.png — The close button is a 44px circle that straddles the green header's bottom edge (half on green, half on white), and the € sign sits outside the amount field to its left → place the close button fully inside the header, and put the € prefix inside the input as other dialogs do.
- [P2] mobile 005/007-\*.png — The sticky footer is ~110px tall (Batal + Simpan + "Simpan & tambah lagi" link). On a keyboard-up screen this leaves ~330px for the form → put "Simpan & tambah lagi" in an overflow menu or a checkbox, and keep a single 56px button row.
- [P2] mobile 003-notifikasi-menu-open.png — The notification panel is a desktop-style dropdown covering the hero, not a bottom sheet; the first item says "jatuh tempo dalam 0 hari" → open it as a sheet like Semua menu, and say "jatuh tempo hari ini".
- [P3] mobile 012-semua-menu-dialog-open.png — The Semua menu sheet runs past the viewport with no visible end, and "Beranda" is highlighted though the sheet is opened from any page → OK as a scroll list, but pin the search field and mark the current route, not always Beranda.

### Dialogs & forms seen

- Tambah Transaksi (bottom sheet): oversized account cards, Rp balances, duplicate truncated category tiles, 3-line disclaimer, empty submit identical to open state (logged on desktop), and a 110px footer.
- Notifikasi menu: dropdown rather than a sheet; Rp amounts (logged on desktop).
- Menu akun: ok (3 items, 44px rows).
- Semua menu sheet: ok; long list with no current-route state.

### Not reachable

- The Tambah Transaksi submit state on mobile, and the Statistik "Detail" target.

## ringkasan

Scores: desktop n/a · tablet n/a · mobile 3/2/2 (Karakter/Konsistensi/Kerapian)
Verdict: Four viewports long, with the chart hidden behind "Tren & detail", a desktop-style native select for currencies, a contradictory Komposisi card and a table that is cut off on a phone.

### Defects

- [P0] mobile 013-page.png — Komposisi Aset says "Total Aset ≈ € 94.239,69", while the row "Aset Fisik ≈ € 1.306.246,11 · 98%" alone is 14× the total → compute the total and the shares from the same rows.
- [P1] mobile 019–025-select-\*.png — The Valas control opens a tiny desktop-style listbox: ~25px option rows (below the 36px tap minimum), pale grey text, missing-glyph flag boxes, and it covers the "Tren & detail" button → use a bottom sheet with 48px rows and SVG flags (or a native picker).
- [P1] mobile 013/020/025-\*.png — The headline block re-centres per currency ("≈ -€ 1.176.786,48" starts at x≈77; "≈ -CN¥ 8.824.957,14" at x≈54, nearly touching the card edges), so the whole hero shifts on every switch → left-align the headline at the card padding, or reserve a fixed width.
- [P1] mobile 026/027-atur-rentang-\*.png — "Atur" opens an untitled popover that holds a native "12 Bln" select and an empty grey bar beside it (~160px of dead control); it overlaps the Komposisi Aset header ("Ko…") → present it as a titled bottom sheet ("Rentang & tampilan") with a segmented period control.
- [P1] mobile 028-click-tren-detail.png — In the expanded chart, the "Sembunyikan detail" button sits on top of the x-axis labels ("6 Okt", "10 Okt"); the y-axis reads "1.5B / 1B / 500M" under a CN¥ headline; "Total Liabilitas ≈ CN¥ 9.531.679,…" is truncated; "Selisih dari pemasukan" leaves an orphan half-row → put the toggle below the plot, use currency ticks, and let the KPI values wrap or shrink.
- [P1] mobile 014-page-scroll-1.png — The Arus kas y-axis label "1.252.213,75" starts outside the card (clipped at x=0); the legend appears twice (header right and under the subtitle); the title "Arus kas Okt" contradicts the subtitle "Mei – Okt" → keep one legend, give the axis a gutter inside the card, and title the card by its range.
- [P1] mobile 014-page-scroll-1.png — The currency footnote "≈ Nilai dalam EUR adalah perkiraan…" floats as orphan 11px text between cards, outside any card → move it into the hero as a muted line, or into an info tooltip.
- [P1] mobile 015/016-page-scroll-\*.png — The "Rincian Aset vs Liabilitas" table is cut at the card's right edge: the JENIS chips read "Aset I", "Inves", "Liabi"; "Total A" is cut; no amount column is visible; there is no scroll affordance → on phones render it as a stacked list (name · type chip · amount), or add a visible horizontal-scroll shadow.
- [P1] mobile 015-page-scroll-2.png — The Skor kesehatan card is ~420px tall for a single "0 %" gauge plus one sentence; "Rasio utang terhadap aset 1.348,7% – mendekati batas" calls 1348% "approaching" the limit → compact it to a 120px row, and use "jauh melewati batas" above 100%.
- [P2] mobile 013-page.png — The "↓ ≈ € 1.250.692,70 bulan ini" badge is ~10px red text on a red outline on dark green (unreadable at phone size) → use a filled chip, ≥12px.
- [P2] mobile 013-page.png — On mobile the dock highlights "Menu" for Ringkasan, so 3 of the 6 audited routes show the same active tab and the user loses wayfinding → show the page's section in the header, or make the active state reflect the parent group.
- [P2] mobile 013-016 — The page takes 3 scroll stops (≈4 viewports), with Komposisi, Arus kas, Pengeluaran terbesar, Skor, Liabilitas and Rincian all stacked full-width → merge Pengeluaran terbesar and Liabilitas terbesar into tabs, and collapse Rincian by default.

### Dialogs & forms seen

- Valas listbox: desktop-sized, 25px rows, missing-glyph flags.
- Atur rentang dan nominal popover: untitled, with an empty grey slot and a native select; not a sheet.

### Not reachable

- The Kustom range on mobile, and the "Lihat detail" target beyond the first viewport (029 lands on aset).

## transaksi

Scores: desktop n/a · tablet n/a · mobile 3/3/3 (Karakter/Konsistensi/Kerapian)
Verdict: The list reads well and pages are short, but the hero headline is in "Rp", filters are an inline desktop panel instead of a sheet, and the date picker uses 30px day cells.

### Defects

- [P1] mobile 031/037-\*.png — The hero duplicates the dock's ring "+" with its own "+ Catat transaksi" pill, and "Ekspor CSV" is the most prominent action on a phone → keep "+" in the dock only, and move Ekspor CSV into an overflow (⋯) menu.
- [P1] mobile 037-click-tren-detail.png — The expanded hero is ~580px tall and pushes the list completely below the fold; the y-axis label "1.252.573,08" is clipped at the card's left edge; "100% transaksi sudah t…" is truncated → cap the chart at ~160px, put the axis label inside, and let the subline wrap.
- [P1] mobile 038-click-cari-saring-0.png — Tapping "Cari & saring (0)" changes nothing in the viewport (identical to 037); the panel opens inline below the fold (039) → open filters as a bottom sheet with a sticky "Terapkan" and a result count.
- [P1] mobile 039–043-\*.png — The inline filter's type control wraps "Kartu Kredit" to a second row under "Semua"; the Kategori and Urutkan fields sit under the dock → use a horizontally scrollable chip row inside the sheet.
- [P1] mobile 044-semua-tanggal-dialog-open.png — The date-range picker is a 294px floating popover with 30×30 day cells (smallTargets: 1–4 Oktober), opened upward over the "Rentang Tanggal" label; "Terapkan" is enabled before a start date is chosen → use a full-width bottom-sheet calendar with ≥40px cells and preset chips (7h, 30h, Bulan ini), and disable Terapkan until a range is valid.
- [P2] mobile 032-page-scroll-1.png — Pagination uses two small left-aligned pills ("Sebelumnya", "Berikutnya") under "Menampilkan 10 dari 564 transaksi"; 10 rows per page is short on a phone → use infinite scroll or a full-width "Muat lebih banyak" button.
- [P2] mobile 033-click-ekspor-csv.png — The "564 transaksi diekspor" toast sits over a list row about 40px above the dock, but it has no action (open or share the file) → keep the position, and add "Buka" on mobile.
- [P2] mobile 031-page.png — The header repeats "Selamat pagi, Demo" above the page title "Transaksi" on every page → drop the greeting outside Beranda.

### Dialogs & forms seen

- Tambah Transaksi sheet: same defects as on beranda (large account cards with Rp balances, duplicate "Asset & Other…" tiles, offscreen third card, 3-line disclaimer, no validation feedback).
- Semua tanggal date picker: popover with 30px cells; not a sheet.
- Cari & saring: inline panel, not a sheet; the type control wraps.

### Not reachable

- The filtered empty state on mobile; the Akun/Kategori selects (hidden under the dock).

## anggaran

Scores: desktop n/a · tablet n/a · mobile 3/2/2 (Karakter/Konsistensi/Kerapian)
Verdict: The first viewport shows no budgets at all; 14 cramped two-column cards wrap their footers to 3 lines, the segmented control is clipped, and the Edit sheet shows only the first digit of the amount being edited.

### Defects

- [P0] mobile 058–067-edit-anggaran-\*.png — The Edit Anggaran amount field is ~64px wide and shows only "Rp 2", "Rp 8" or "Rp 1": the user cannot read the budget they are editing → make the amount input full-width on its own row, with currency and period selectors below.
- [P0] mobile 051/053/068/070-tambah-kategori-\*.png — In Tambah Kategori, the amount input is ~60px wide and shows "€ 0", "€ )00" or "€ 1.2" (truncated) → make it a full-width field.
- [P1] mobile 045-page.png — The first viewport shows the hero plus "Kewajiban Belum Dibayar"; none of the 14 budget categories is visible until scroll 1, and the Kewajiban card is ~700px tall because it also lists 3 "Sudah Lunas" rows → put "Rincian per kategori" first (or a top-3 over-budget strip), limit Kewajiban to unpaid rows, and show "Semua kewajiban" as a link.
- [P1] mobile 045-page.png — The hero shows a "Terpakai • Batas" legend while the chart it describes is collapsed; the "Oktober" period pill looks like a disabled chip → show the legend only when the chart is expanded, and style the period as a tappable select.
- [P1] mobile 046/049/050-\*.png — The Terpakai/Sisa segmented control is clipped by the card edge ("Sis…" in 046/049, "…erpakai" in 050) because it shares a row with a 2-line title → put the segmented control on its own full-width row under the title.
- [P1] mobile 046/047/048-\*.png — The 2-column category cards (~158px) truncate names ("Tagihan & Ut…", "Makan & Min…", "Asset & Oth…", "Utang: Audit…", "Tabungan & …"); footers wrap to 2–3 lines ("Sisa ≈ / € 1.250.000,00 · ≈ / € 1.250.000,00"); the "0%" baseline differs between neighbour cards (047, Audit QA 1 vs Utang: KPR) → use one-column rows on phones (icon · name · % · bar · "€x dari €y"), or drop the duplicated second value.
- [P1] mobile 048-page-scroll-3.png — The bottom alert says "Hiburan melebihi budget 1094%!", while the Hiburan card says "1194%" → state one figure the same way everywhere ("terpakai 1194%" or "lewat 1094%").
- [P1] mobile 054-click-tren-detail.png — The expanded hero is ~615px tall; the y-axis is "0 / 5 jt / 10 jt" (logged); only 3 of 6 bars have x-labels ("Hiburan", "Tagihan", "Makan"); the bars are unlabelled → label every bar or use a horizontal bar list on phones.
- [P1] mobile 058–067-edit-anggaran-\*.png — The footer's red icon-only delete slab (~95px) takes more width than "Batal", and "Simpan Perubahan" wraps to 2 lines with its arrow icon clipped at the right edge → use a 44px ghost trash icon, and keep the primary button's label on one line.
- [P1] mobile 051 vs 055 vs 095 — The sheet headers differ: Tambah Kategori and Edit Anggaran use a plain white header; Bayar Kewajiban and Tambah Transaksi use the green band; the drag handle is a stub half-hidden at the sheet's top edge (051/058) → use one sheet header style everywhere.
- [P1] mobile 052/053/069/070-\*.png — Validation and server errors appear as a toast pinned inside the sheet over the "Opsi lanjutan" row, and they persist after the field is filled (053); 069 is the English "A budget already exists for this category" → show inline field errors and remove the toast.
- [P2] mobile 051-tambah-kategori-dialog-open.png — The 5-line rate disclaimer is squeezed into a ~160px left column under the amount → one muted line, full-width.
- [P2] mobile 048-page-scroll-3.png — The "Kategori baru" dashed tile sits alone in the last grid row with an empty right half → make it a full-width dashed row.
- [P2] mobile 045–048 — The page takes 3 scroll stops (≈4 viewports) → the one-column compact rows above would cut it to ~2.

### Dialogs & forms seen

- Tambah Kategori Anggaran: amount field truncated to ~60px; toast-only validation; English 409 toast; white header unlike other sheets.
- Bayar Kewajiban: ok layout (green header, sticky footer); empty submit gives no feedback (logged on desktop).
- Edit Anggaran ×10: amount shows a single digit; delete slab outweighs the primary action; "Simpan Perubahan" wraps and its icon is clipped.
- Kategori baru: same as Tambah Kategori, with prefilled stale values (logged on desktop).

### Not reachable

- The Bayar submit result, and Edit Anggaran save/delete confirmation on mobile.

## laporan

Scores: desktop n/a · tablet n/a · mobile 3/2/2 (Karakter/Konsistensi/Kerapian)
Verdict: Every report opens with ~300px of controls and a 4-line display headline before any number; Ringkasan renders a blank viewport under its hero; KPI strips overflow; and the net-worth reports contradict Beranda and Ringkasan on the same session.

### Defects

- [P0] mobile 087/088-\*.png vs beranda 001, ringkasan 013 — Balance Sheet and Aset & Liabilitas say "Kekayaan bersih ≈ € 73.375,73" (Total aset € 94.511,69), while Beranda and Ringkasan in the same session say "≈ -€ 1.176.786,48" (Total aset € 94.239,69) → derive net worth from one source, or label the report as a snapshot "per 10 Okt" and show the live figure.
- [P1] mobile 072-page-scroll-1.png — On Ringkasan, scrolling past the hero shows ~580px of empty background: the "Kemana uangnya" and "Dibanding bulan lalu" cards (present in ringkasan/030) do not render → mount those cards without the scroll/animation gate, or remove the min-height.
- [P1] mobile 071/075–088 — The report picker repeats its label: an optgroup caption ("Ringkasan", "Arus Kas", "Kekayaan", "Kewajiban") sits above the select value, and the breadcrumb repeats both ("Ringkasan / Ringkasan"); Balance Sheet is filed under "Kewajiban" → drop the caption, keep the breadcrumb only on desktop, and file Balance Sheet under Kekayaan.
- [P1] mobile 071-page.png — The first viewport is header + Periode + select + Excel/Cetak PDF + a 4-line, ~32px display headline; the chart starts at y≈650, and its only y-label is clipped (".213,75") → put Excel/PDF in an overflow menu, cut the headline to 2 lines at ~24px, and show the income/expense pair before the chart.
- [P1] mobile 081-select-laporan-detail.png — The KPI strip overflows the viewport: "−≈ € 1.264.460,89" is cut off at the right edge (offscreen lpb-kpi); these KPIs are flat grey tiles, unlike the white cards elsewhere → stack the KPIs at full width as white cards.
- [P1] mobile 084-select-arus-kas.png — "≈ € 1.263.361,82" in the Arus Kas KPI touches the card's right edge (no padding) → wrap or shrink the value to fit.
- [P1] mobile 077-select-laporan-bulanan.png — The "Tren 6 Bulan Terakhir" y-label "1.252.213,75" hangs outside the card at x=0; the legend is stacked in a right column that pushes the title to 2 lines → put the legend under the title, and the axis label inside the plot.
- [P1] mobile 086-select-performa.png — The hero says "Rasio selisih -12518%", while the gauge directly below reads "0 %" → show the clamped state honestly on the gauge ("< 0%", red), or hide the gauge.
- [P1] mobile 076-select-laporan-harian.png — The actions break into a different layout (date pill + Excel, then a full-width Cetak PDF); the KPI cards "Pemasukan Hari Ini / Pengeluaran Hari Ini" repeat the hero's two numbers, with ~50px of dead space above the values → keep one action row across reports, and remove the duplicate KPI cards.
- [P2] mobile 078-select-laporan-tahunan.png — The KPI cards show only titles ("Total Pemasukan 2026", "Total Pengeluaran") in the viewport, with the values pushed below by empty space → align values directly under titles.
- [P2] mobile 079/085/087-\*.png — The breadcrumb date is truncated ("11 Apr – 11"); the orange note "Tampilan ini selalu menampilkan data terkini…" is 11px text floating between cards → hide the date range on mobile breadcrumbs, and render the note as an inline info chip.
- [P2] mobile 085-select-investasi.png — "+ Tambah" is 88×30px (smallTargets) → ≥40px tall.
- [P2] mobile 073/074-tab-\*.png — "12 Bln" renders a single 6px-wide bar at the right edge, and "6 Bln" a single bar, with no month labels → show monthly bars with labels, or a "Data tersedia sejak …" note.

### Dialogs & forms seen

- Filter periode sheet: ok (green header, 3 full-width selects, sticky Reset/Terapkan); the trigger label does not reflect a draft change until it is applied.
- Excel: toast ok. Cetak PDF: no feedback (logged on desktop).

### Not reachable

- The Kustom period, the lower sections of each report (only one scroll stop was captured), and the Arus Kas Sankey on mobile (tinyText=26 suggests unreadable labels below the fold).

## tujuan

Scores: desktop n/a · tablet n/a · mobile 3/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: The goals list is cut off at the bottom of the page, the first viewport spends a card on one "all good" sentence, and the goal detail sheet uses 32px buttons with an equal-weight red Hapus.

### Defects

- [P0] mobile 094-page-scroll-1.png — At maximum scroll, the "Semua tujuan" card is cut straight through the second row (Liburan Jepang / Dana Darurat cards sliced mid-bar at y≈745); the 5th goal and the "Tujuan baru" tile are unreachable → remove the overflow clip on the page container, and add dock-height bottom padding.
- [P1] mobile 093-page.png — "Perlu perhatian" uses a full card in the first viewport for "Semua tujuan berjalan sesuai rencana." (it also contradicts the red warnings in the 099/101 sheets, logged on desktop) → fold it into the hero as a status chip, and use the space for the goal list.
- [P1] mobile 093-page.png — The hero shows a "Terkumpul • Target" legend while the chart is collapsed; when expanded (098), a second legend in the reverse order "Target • Terkumpul" appears → one legend, visible only with the chart.
- [P1] mobile 098-click-tren-detail.png — The expanded chart is dominated by the 1.25M Audit bar, so four goals are 2px stubs; x-labels "Dana", "Liburan", "DP", "Dana", "Audit" repeat "Dana"; the y-label "1.250.000,00" is flush to the card edge → on phones use a per-goal % progress list instead of absolute bars.
- [P1] mobile 093/094-\*.png — The 2-column goal cards truncate names ("DP Rumah K…", "Liburan Jep…", "Dana Darura…") → use one-column rows with full names.
- [P1] mobile 099–103-\*-dialog-open.png — The goal detail sheet buttons are 110×32px and "Riwayat Setoran" is 99×18px (smallTargets); "Hapus" (red text) sits in the same row with the same weight as Edit, one thumb-width from Setor → use 44px buttons: primary Setor full-width, Edit secondary, and Hapus as a separate destructive row (or in a ⋯ menu) with confirmation.
- [P1] mobile 099–103-\*.png — The status label is English ("On Track"), and the sheet has a plain white header unlike the green Bayar/Transaksi sheets → "Sesuai rencana", with the shared sheet header.
- [P1] mobile 097/106-\*-filled.png — With a field focused near the bottom ("Tanggal Auto-debit (1-28)"), the input sits half under the sticky Batal/Simpan footer → scroll the focused field above the footer (scroll-padding-bottom = footer height).
- [P1] mobile 095/104-\*-dialog-open.png — Each of the three amount fields repeats the same 3-line rate disclaimer ("1 EUR = Rp 20.036,94 · ECB… Disimpan sebagai IDR…"), adding ~150px; the EUR picker is repeated per field → one disclaimer line under the first amount, and one currency choice for the whole goal.
- [P2] mobile 103-audit-qa-1-100-terkumpul-dialog-open.png — The progress line reads "terkumpul · Oktober 2026" with the amount missing → "≈ € x terkumpul".
- [P2] mobile 093-page.png — "Tujuan Keuangan" sits under the "Selamat pagi, Demo" greeting, and the dock highlights "Menu" → drop the greeting, and reflect the section in the header.

### Dialogs & forms seen

- Tambah Tujuan / Tujuan baru sheet: inline error for Nama only (good); triple disclaimer; focused field hidden under the footer; white header unlike other sheets.
- Goal detail sheets ×5: 32px buttons, equal-weight Hapus, English status, Setor offered on a 100% goal (logged on desktop).

### Not reachable

- The Setor / Riwayat Setoran / Edit sub-flows; the 5th goal card and the "Tujuan baru" tile on the page (clipped).
