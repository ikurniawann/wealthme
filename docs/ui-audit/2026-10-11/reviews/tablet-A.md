## beranda

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: At 834px the bento becomes a rigid two-column grid with equal-height rows, so short cards (Batas pengeluaran, Kesehatan, Tujuan) sit beside tall neighbours with 200–350px of blank white, and the hero chart's axis labels are clipped at the card edge.

### Defects

- [P1] tablet 448-page.png — "Batas pengeluaran bulanan" holds a title, one bar and one caption line but is stretched to the height of the Rekening card, leaving ~340px of empty white below the bar → let the row size to content (align-items:start) or stack the budget card under Rekening and pair it with a shorter card.
- [P1] tablet 449-page-scroll-1.png / 451-tab-30h.png — "Kesehatan finansial" has ~120px of blank space between the alert chip and the footnote, and "Tujuan" has ~200px of blank space under Dana Pensiun, because each is stretched to match its taller neighbour → size cards to content or pin the footnote directly under the content.
- [P1] tablet 448-page.png, 451–456 — The hero bar chart's minimum y-label is rendered outside the plot as "1.250.270,02" at the card's left edge (x≈16), losing its "≈ -€" prefix; the max label "≈ € 1.315,07" also sits against the edge → reserve a left gutter inside the card padding and use compact ticks (e.g. "-€1,25 jt").
- [P1] tablet 458-click-grafik-garis.png — In line mode the y-axis moves to the right side and reads "10B / 0 / -10B / -20B / -30B", while bar mode puts € labels on the left; the two modes of one chart use different axis sides and units → keep one axis position and the € formatter in both modes.
- [P1] tablet 451-tab-30h.png, 456 — The 30h x-axis labels render as "2C" and "3C" for 20 and 30 (the trailing glyph is clipped by the tick label box) → widen the tick label box or drop the label width clamp.
- [P2] tablet 448-page.png — The Rekening card carousel shows BCA in full and BNI cut at the half-column edge with no next/prev chevron (desktop has a "›" button), so the cut-off card is the only scroll affordance → add the chevron or a dot pager at tablet.
- [P2] tablet 448-page.png — The topbar has a text-only "WealthMe" wordmark on the left (no logo mark, unlike desktop) and the greeting "Selamat datang kembali!" pushed to the right against the search icon, so the page title sits far from the content's left edge → left-align the page title under or beside the wordmark and keep the logo mark.
- [P2] tablet 448-page.png — At 834px the app uses the phone dock (5 labelled columns spread ~170px apart) and no sidebar or rail; the desktop quick "Catat transaksi" topbar button and search field are both gone → at tablet use a collapsed icon rail, or at least keep the dock compact and centred instead of stretched.
- [P2] tablet 455-notifikasi-menu-open.png — Notification items are indented ~38px with an empty leading column (no icon, no unread dot), so titles do not align with the "Notifikasi" header → add the type icon or remove the indent.
- [P2] tablet 454-cari-listbox-open.png — The command palette list is cut after "Input Cepat" at the panel's bottom edge with no fade or scroll hint → add a bottom fade or show a "more results" row.
- [P3] tablet 448-page.png — The hero's percentage deltas print unformatted "126226%" and "331495%" → cap display (e.g. ">999%") so the KPI strip does not read as noise.

### Dialogs & forms seen

- Tambah Transaksi (460–462): centred 600px modal (not a sheet), fits 1112px height; the Akun chip strip truncates "BCA Tahapan ···9…" and clips the 4th chip, the Kategori tiles truncate "Asset & Other Insurance: Asuran…"; the Rp chip balances and the silent validation are already logged on desktop.
- Cari palette (454): ok apart from the missing scroll hint.
- Notifikasi menu (455): fits, anchored under the bell; indent issue above.
- Akun menu (456): ok.

### Not reachable

- No mobile/001-page.png exists for any route in this batch, so the tablet-vs-mobile comparison could not be made.

## ringkasan

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Tablet is a stretched phone layout: every card is a full-width 806px slab stacked in one column, with no bento pairing, and the hero controls wrap and float when "Kustom" is chosen.

### Defects

- [P1] tablet 469/470/471 — All seven cards (hero, Komposisi Aset, Arus kas, Pengeluaran terbesar, Skor kesehatan, Liabilitas terbesar, Rincian) are single-column full width; short lists like Pengeluaran terbesar and Liabilitas terbesar become 770px-wide hairline bars with labels and values ~700px apart → pair Pengeluaran terbesar with Liabilitas terbesar and Komposisi with Skor kesehatan in a 2-column grid at ≥768px.
- [P1] tablet 470-page-scroll-1.png, 489 — The Arus kas y-axis max label "1.252.213,75" starts at x≈2, outside the card's left edge, and loses its "≈ €" prefix → keep ticks inside the card padding with compact € formatting.
- [P1] tablet 488-select-kustom.png — Choosing "Kustom" wraps the control row to a second line: the currency select, period select and date field sit right-aligned with a floating "Kustom" label above the date field only, and the hero grows by ~80px, pushing Komposisi down → give the date-range field its own row under the selects, left-aligned, with matching label treatment.
- [P1] tablet 469-page.png, 474, 488 — The period control (and the CNY currency select once Valas is chosen) is a white native <select> box inside the dark hero, next to dark custom pill tabs; its OS dropdown (474, 488) is a white list with a blue highlight → use the app's dark segmented/dropdown component.
- [P2] tablet 470-page-scroll-1.png — Arus kas shows two legends ("Pemasukan • Pengeluaran" in the header and again above the plot) → keep one.
- [P2] tablet 470-page-scroll-1.png — The "Laporan" link in Pengeluaran terbesar sits ~10px below the title baseline instead of aligned with it → align it to the title row like "Lihat detail" in Komposisi.
- [P2] tablet 470/471 — Skor kesehatan puts a 160px gauge on the left and a one-line advice chip on the right, leaving ~120px of empty card under the chip → vertically centre the advice block or put the gauge and advice in one row of equal height.
- [P2] tablet 469-page.png — The "≈ US$ … · … gram" sub-line and the red-on-red "bulan ini" badge are ~10–11px on the dark hero (tinyText=4) → raise to ≥12px with AA contrast.

### Dialogs & forms seen

- Valas listbox (474): native list, missing-glyph boxes before every code (already logged on desktop), low-contrast grey options.
- Period select (476–488): native OS list over the hero; see above.
- Date range dialog (489): the shot shows the page scrolled with no dialog visible, so the range dialog either opened off-screen or failed to open at tablet.
- Sembunyikan nominal (490): blur works, but "-82226%" and the date field stay unblurred.

### Not reachable

- The custom date-range dialog (489) was not visible in the tablet capture.

## transaksi

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The desktop side-by-side filter card becomes a full-width stack of four full-width form fields, so on first view tablet users see only the hero and filters and no transaction rows at all.

### Defects

- [P1] tablet 492-page.png — "Cari & saring" stacks search, type tabs, Rentang Tanggal, Akun, Kategori and Urutkan as six full-width rows (~500px tall), pushing "Riwayat" entirely below the first viewport → lay Rentang/Akun/Kategori/Urutkan in a 2×2 grid at tablet, or collapse filters into a "Saring" button with a sheet.
- [P1] tablet 492-page.png, 525 — The hero y-axis max label "1.252.573,08" starts at x≈14, outside the card padding, without its "≈ €" prefix → keep ticks inside the plot gutter in € format.
- [P1] tablet 494/504-select-\*.png — With an account filter active, a dark pill (the active-filter chip or "Hapus filter" button) peeks out at y≈1040, half hidden under the dock → add bottom padding equal to the dock height to the scroll container.
- [P1] tablet 527-semua-tanggal-dialog-open.png — The date picker opens as a 295px popover anchored left that covers the Akun/Kategori/Urutkan labels and the empty-state line; day cells are ~32px targets and the weekday headers are under 11px (tinyText=11) → at 834px open the range picker as a centred dialog or a full-width panel with ≥40px day cells.
- [P2] tablet 493-page-scroll-1.png — Row amounts end at x≈794 while the date-group totals end at x≈802, so the two money columns are misaligned by 8px → use one right edge.
- [P2] tablet 504-select-audit-qa-1.png — With zero results the hero keeps a ~180px empty dark plot with only a 0 baseline → collapse the plot to an inline empty state at tablet.

### Dialogs & forms seen

- Tambah Transaksi (519–521): centred modal, fits; same chip/category truncation as on Beranda (offscreen=tx-tile is the clipped 4th account chip).
- Semua tanggal picker (527): popover issues above.
- Ekspor CSV (518): no tablet-specific issue visible.

### Not reachable

- Nothing obvious.

## anggaran

Scores: desktop n/a · tablet 3/2/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The tablet layout puts a 7-row Kewajiban list above the budget grid. The 3-column category grid is too narrow for its footers. Its dialogs mix right-hand drawers and centred modals.

### Defects

- [P1] tablet 528-page.png — "Kewajiban Belum Dibayar" (a desktop side column) becomes a full-width card of 7 rows plus a "Semua kewajiban" button, ~620px tall, so "Rincian Anggaran per Kategori" (the page's main content) starts below the first viewport → move Kewajiban below the category grid, or cap it to the 3 unpaid rows at tablet.
- [P1] tablet 529/530 — The 3-column category grid (cards ~250px) wraps every footer, leaving "≈ € 39,93", "€ 49,91", "€ 1.250.000,00" alone on a second line, and truncates "Asset & Other Insurance: …" twice with no tooltip, so the two cards are indistinguishable → use 2 columns at 834px, or shorten the footer to "Lewat €436,66 dari €39,93".
- [P1] tablet 533–535, 539–551 vs 536 — Tambah Kategori, Edit Anggaran and Kategori baru open as 460px right-hand drawers while Bayar Kewajiban opens as a centred modal on the same page → use one dialog pattern per viewport (the prototype `.dialog`).
- [P1] tablet 533/535/551 — Inside the drawer the amount input is ~95px wide and clips "250.00(" / "1.250.0", while the FX help text wraps in a 200px column below it and ~570px of the drawer stays empty → make the amount full-width on its own row with the currency selector inline and Periode below.
- [P1] tablet 536/537-bayar-\*.png — In Bayar Kewajiban, the header divider line runs between the title and its subtitle ("Pembayaran akan mencatat…"), so the subtitle hangs half inside the green band → put the subtitle inside the header block above the divider.
- [P1] tablet 541-edit-anggaran-\*.png — In the drawer footer, the icon-only delete button is the widest (~148px), "Simpan Perubahan" wraps to two lines and its arrow icon is clipped → give Hapus a 44px square and let Simpan take the remaining width.
- [P2] tablet 535-tambah-kategori-filled.png — The toast "Nama kategori wajib diisi" is still shown over a filled name field and is centred on the page, overlapping the drawer's left edge → dismiss it on input and anchor toasts inside the active dialog.
- [P2] tablet 528-page.png — The hero chart shows only 6 of 13 categories even though 834px fits more bars → show all, or label "6 teratas".
- [P2] tablet 530-page-scroll-2.png — The last grid row leaves one card plus the dashed "Kategori baru" tile, and the alert "Makan & Minum melebihi budget 166%!" comes after the full grid, far from the hero → place the alert above the grid.

### Dialogs & forms seen

- Tambah Kategori (533–535): drawer; amount input crushed, empty lower 50%.
- Bayar Kewajiban (536–538): centred modal, fits; header divider cuts title/subtitle.
- Edit Anggaran ×12 (539–550): drawer; footer button sizing broken, Rp default and truncation (already logged on desktop).
- Kategori baru (551): drawer, prefilled with the previous values (already logged on desktop).

### Not reachable

- Nothing obvious.

## laporan

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Tablet stacks a floating period pill, a full-width native report selector and a hero whose chart is squeezed to ~110px with a clipped axis. Two report types also disagree on net worth in the same session.

### Defects

- [P0] tablet 569-select-aset-liabilitas.png vs 560-select-laporan-grup-keluarga.png — For the same period, Aset & Liabilitas reports "Kekayaan bersih ≈ € 73.375,73 · Total aset € 94.511,69 · Liabilitas € 21.135,96", while Grup Keluarga reports "Total Net Worth ≈ -€ 1.176.786,48" and Aset Lain ≈ € 1.306.246,11 → both views must read one balance-sheet source.
- [P1] tablet 552/556-\*.png — The Ringkasan hero chart is only ~110px tall, has no x-axis labels, and its single y-label is clipped to ".213,75" at the left edge, while ~70px of empty space sits between the headline and the 6/12 Bln toggle → move the toggle onto the breadcrumb row and give the plot ≥220px with full tick labels.
- [P1] tablet 552-page.png — The report-type picker is a full-width white card whose small label repeats the value ("Ringkasan" over "Ringkasan"; "Arus Kas" over "Laporan Detail" in 562; "Kewajiban" over "Aset & Liabilitas" in 569), so it reads as a stray native select, not a control → render it as a labelled segmented menu or a "Jenis laporan" dropdown beside the period pill on one row.
- [P1] tablet 558-select-laporan-bulanan.png — The "Tren 6 Bulan Terakhir" y-label "1.252.213,75" starts at x≈2, outside the card → keep ticks inside the card.
- [P1] tablet 562-select-laporan-detail.png — The detail table's JUMLAH column is clipped at the card's right edge ("-≈ € 99,8", "JUMLAH" cut), and the table does not scroll horizontally, while KETERANGAN takes ~330px → shrink KETERANGAN or allow horizontal scroll with a visible edge.
- [P1] tablet 565-select-arus-kas.png — The Sankey's left labels (Gaji, Bonus, Freelance, Hasil Investasi) are stacked in 10px type (tinyText=15) inside a ~30px band, and the right-hand labels Belanja/Tagihan/Hiburan/Transportasi touch each other → at tablet, replace the Sankey with ranked bars or enforce label spacing ≥14px.
- [P1] tablet 570-periode-\*.png — Filter periode has the same broken header as Bayar: the divider line runs between "Filter periode" and its subtitle → keep the subtitle above the divider.
- [P2] tablet 560-select-laporan-grup-keluarga.png — The KPI tiles have ~60px of empty space between label and value, and "Surplus" drops alone onto a second row, leaving two-thirds of the row empty → use 2×2 at tablet.
- [P2] tablet 565-select-arus-kas.png — The "Surplus ≈ -€ 1.253.349,55" KPI is green and the "-12518%" ratio is unformatted → colour by sign and cap the percent display.
- [P2] tablet 552-page.png — The period pill (~350px) floats alone on the first row with ~450px of empty space to its right → put the report selector beside it.

### Dialogs & forms seen

- Report-type select (556–569): native-looking full-width select; label/value duplication.
- Filter periode (570/571): centred modal, fits; header divider bug.
- Excel / Cetak PDF (572/573): no tablet-specific issue visible.

### Not reachable

- Nothing obvious.

## tujuan

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The goal grid works at 3 columns, but the two one-sentence status cards are now full-width slabs, and every dialog is a right-hand drawer that is two-thirds empty.

### Defects

- [P1] tablet 574/575 — "Perlu perhatian" (one sentence, full width) and "Semua tujuan berjalan baik" (one sentence, text limited to ~500px of an 806px card) say the same thing and take two full-width rows → merge them into one status line in the hero, or put them side by side.
- [P1] tablet 574-page.png — The hero y-axis label "1.250.000,00" starts at x≈12, outside the card padding, without "≈ €" → keep ticks inside the plot.
- [P1] tablet 579–583 detail drawers — The goal detail drawer is 460×1112px for ~5 lines of content (percent, bar, one line of advice, three actions, one link), leaving ~800px empty → use a centred dialog or bottom sheet sized to content at tablet.
- [P2] tablet 574-page.png — Two legends in opposite order ("Terkumpul • Target" under the button, "Target • Terkumpul" above the plot) → keep one.
- [P2] tablet 576–578 — The "Ikon" picker shows a missing-glyph box (▯) instead of an icon → render the default icon or a "Pilih ikon" label.
- [P2] tablet 576/577 — The three-line FX disclaimer is repeated under each of the three amount fields, making the drawer scroll for boilerplate → show it once under the first amount, or as an info tooltip.
- [P2] tablet 579-dana-pensiun-\*.png — The status label reads "On Track" (English) under the title, while the page uses "Sesuai rencana" → use the Indonesian label.

### Dialogs & forms seen

- Tambah Tujuan / Tujuan baru (576–578, 584–586): drawer; validation shows inline "Nama Tujuan wajib diisi" (good); the auto-debit day and past-date acceptance are already logged on desktop.
- Goal detail ×5 (579–583): drawer is mostly empty; Setor shown on a 100% goal (already logged on desktop).

### Not reachable

- Nothing obvious.

## rekening

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The 2-column card grid suits 834px. The hero chart's y-labels run past the card's right padding, a full-width Aksi cepat strip wastes a row, and the drawers use two different header styles.

### Defects

- [P1] tablet 587-page.png, 591, 592, 598 — The hero chart's y-labels ("≈ € 7.486,17", "≈ € 4.990,78") start at x≈746 and end at x≈818, inside the card's 32px right padding and touching the rounded edge (offscreen=tickText) → reserve a right gutter or use compact ticks.
- [P1] tablet 587-page.png — The chart has 5 (later 6) category slots but only 2 bars render; Mandiri (≈ -€ 1.246.019,85) and the €0 accounts get no bar or zero line, and three slots are labelled "BCA" → plot negative balances below zero and label by account name + last digits.
- [P1] tablet 590-tab-milik-saya.png — Under "Milik saya", the chart vanishes, a dashed "Belum ada rekening yang menjadi milikmu." box sits under Aksi cepat, and a second dashed "Tambah rekening baru" tile sits under a heading still reading "Semua rekening", with ~200px of blank page below → show one empty state with the add action, and retitle the section to the active filter.
- [P2] tablet 587-page.png — "Aksi cepat" is a full-width 150px card with four icons spaced ~190px apart, and its "Tambah" duplicates the hero's "+ Tambah" → fold the quick actions into the hero or a compact chip row.
- [P2] tablet 597-ubah-tampilan-kartu-dialog-open.png vs 592-tambah-dialog-open.png — The "Ubah tampilan kartu" drawer has a dark green header band, while "Tambah Rekening Bank" and the other drawers have plain white headers → use one drawer header style.
- [P2] tablet 597-ubah-tampilan-kartu-dialog-open.png — The colour change is already applied to the card behind the overlay before "Selesai" is pressed, and the preview shows "···9010" while the list shows "\*\*\*\* 9010" → preview only inside the drawer, and use one masking format.
- [P2] tablet 598-opsi-rekening-menu-open.png — The ⋮ menu opens upward over the card, covering its "Bersama" chip and balance, and "Ubah tampilan kartu" wraps to two lines in a 160px menu → widen the menu to fit one line and open it below the button when space allows.
- [P2] tablet 587-page.png — "Daily average" (English) heads an Indonesian hero → "Rata-rata".

### Dialogs & forms seen

- Tambah Rekening Bank (592): drawer, fits; ~280px empty at the bottom, acceptable.
- Tambah Transaksi (593–595): centred modal, same chip truncation as elsewhere (offscreen=tx-tile).
- Ubah tampilan kartu (597): drawer with an inconsistent header; live preview leaks to the page.
- Opsi rekening menu (598): overlaps the card; label wraps.

### Not reachable

- Nothing obvious.
