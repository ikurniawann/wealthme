## anggaran

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The hero and bento look like WealthMe, but the numbers contradict each other everywhere: an IDR-scaled chart, "0% dari batas" next to categories at 1194%, a paid bill that stays in "Belum Dibayar", and budget dialogs that mix Rp and € and lose their state.

### Defects

- [P0] desktop 078-page.png — The hero says "Terpakai ≈ €2.051,55 · 0% dari batas", "Sisa ≈ €1.248.497,44" and "Aman per hari ≈ €62.424,87", while six of nine category cards are 266–1194% over budget; one weekly €1.25M "Audit QA 1" budget is folded into the monthly total and swamps every aggregate → compute the KPIs per period (normalise weekly budgets to the month, or exclude them), and do not show "0%" when categories are over budget.
- [P0] desktop 078-page.png — The chart's y-axis reads "0 / 5 jt / 10 jt" (Rupiah millions), while every budget on the page is €40–€150 → plot in the display currency with € ticks (e.g. €0 / €250 / €500).
- [P0] desktop 078-page.png — The bars contradict the cards: Transportasi (759%), Tagihan (752%), Belanja (642%) and Makan (266%) each show a tall "Batas" bar with a thin sliver on top, which reads as under budget; the lime "Terpakai" legend colour appears on no bar, and only Hiburan is hatched red → draw terpakai in lime, in front of a batas outline, and flag every over-budget bar.
- [P0] desktop 089-bayar-submitted.png — After paying KPR BTN, a new category "Utang: KPR BTN Peruma…" appears at 0% with "Sisa ≈ €209,61 · ≈ €209,61", Terpakai stays ≈ €2.051,55, and "10 kategori" replaces 9; the payment shows up as unspent budget → record the payment as terpakai against the category, and do not create a new 0% budget.
- [P1] desktop 089-bayar-submitted.png — KPR BTN Perumahan (27 Okt) now reads "Sudah Lunas" but stays in the card titled "Kewajiban Belum Dibayar", which also already lists 3 "Sudah Lunas" items (Prudential, BPJS, Asuransi Kendaraan) → show only unpaid items, or rename the card and split it into paid and unpaid groups.
- [P1] desktop 079-page-scroll-1.png — The alert card says "Makan & Minum melebihi budget 166%!" while Hiburan (1194%), Transportasi (759%), Tagihan (752%) and Belanja (642%) are far worse; the alert points at the wrong category → alert on the worst offender, or list all over-budget categories.
- [P1] desktop 078/079 — The chart shows only 6 of 9 categories (Pendidikan, Tabungan & Investasi and Audit QA 1 are missing), and the x labels are cut to "Tagihan" and "Makan" → show every category, or label the chart "Top 6", and use full or ellipsised names with a tooltip.
- [P1] desktop 078-page.png — Each card's footer "Lewat anggaran ≈ €436,66 · ≈ €39,93" wraps, leaving "€39,93" alone on a second line, and the two numbers have no labels; 0% cards show the same number twice ("Sisa ≈ €49,91 · ≈ €49,91") → label both values ("Terpakai €436,66 / Batas €39,93") on one line.
- [P1] desktop 078-page.png, 089 — The floating AI button is cut off by the right viewport edge (offscreen=I) → inset it at least 16px from the edge.
- [P1] desktop 082/084/085-tambah-kategori — The field label reads "Budget per Bulan (Rp)", but the input is in € with an EUR selector, and Periode can be set to "Mingguan" → label it "Batas per periode", with the currency taken from the selector.
- [P1] desktop 084/085/100 — The amount input is about 95px wide and truncates the value ("250.00", "1.250.0") while the Periode select gets twice the width → make the amount full-width and put the currency and period selectors on their own row.
- [P1] desktop 083-tambah-kategori-validation.png — An empty submit shows only the toast "Nama kategori wajib diisi"; the Nama Kategori field gets no red border or inline message, and the toast is still on screen after the form is filled (084) → show an inline field error, matching the Tambah Tujuan dialog, and drop the toast.
- [P1] desktop 085/101/103 — The server 409 appears as an English toast, "A budget already exists for this category", stacked on top of a second toast; the name field shows no inline error → translate it ("Kategori ini sudah punya anggaran") and attach it to Nama Kategori with a link to edit the existing budget.
- [P1] desktop 100-kategori-baru-dialog-open.png — Opening "Kategori baru" pre-fills the previous dialog's values (Audit QA 1, €1.250.0…, Mingguan) → reset the form on open.
- [P1] desktop 087-bayar-validation.png — Submitting "Bayar Sekarang" with "Pilih rekening..." still selected gives no feedback at all (identical to 086) → show an inline error on Rekening Sumber, or disable the button until an account is chosen.
- [P1] desktop 090–099-edit-anggaran — "Simpan Perubahan" wraps onto two lines and its arrow icon is clipped at the right edge, while the icon-only delete button takes the widest slot (about 148px, solid red, no label) → give delete a compact icon button or a "Hapus" label, and let the primary button keep its text on one line.
- [P1] desktop 090–099 — The Edit dialog defaults to IDR ("Rp 25.04…", "Rp 4.200.") while Tambah defaults to EUR, and the Rp value is truncated in the narrow field → default to the display currency (EUR) in both dialogs.
- [P2] desktop 090-edit-anggaran-audit-qa-1 — The label "Budget per Bulan (Rp)" sits next to Periode "Mingguan"; the label contradicts the field → use a period-neutral label.
- [P2] desktop 090–099 — The Edit sheet shows only name, amount and period, with about 550px of empty white below and no current spend or progress → show terpakai and % for the category so the user can edit the limit with that in view.
- [P2] desktop 082/084 — Four lines of FX small print ("1 EUR = Rp…", "Nilai rupiah final…", "Disimpan sebagai IDR…") are squeezed into a 200px column under the amount → collapse them to one line, with details behind an info tooltip.
- [P2] desktop 086-bayar-dialog-open.png, 082 — Bayar is a centred modal with a green gradient header and a hairline running between title and subtitle, while Tambah and Edit are white side sheets → use one dialog pattern, and remove the stray rule under the title.
- [P2] desktop 081-tab-sisa.png — On the "Sisa" tab every card still leads with % terpakai, and the subtitle still says "Pantau terpakai per kategori" → lead with the remaining amount and update the subtitle.
- [P2] desktop 079-page-scroll-1.png — The "0%" figure sits about 18px lower in Kesehatan, Pendidikan and Tabungan than in Audit QA 1, so the card baselines are uneven → pin the headline figure to the same baseline in every card.
- [P2] desktop 089-bayar-submitted.png — The category name "Utang: KPR BTN Peruma…" is truncated in the card header → wrap to two lines, or drop the "Utang:" prefix.
- [P2] desktop 079-page-scroll-1.png — The Kewajiban card stretches to the grid height, leaving about 330px of empty white above "Semua kewajiban" → let the card hug its content, or fill the gap.
- [P3] desktop 090/099 — Hiburan and Audit QA 1 use the same generic alarm-clock icon → give each category its own icon.

### Dialogs & forms seen

- Tambah Kategori Anggaran: Rp label on a € input, truncated amount, toast-only validation, raw English 409 toast, FX text crowding.
- Kategori baru (same form): opens pre-filled with stale data from the previous dialog.
- Bayar Kewajiban: no validation on empty submit; the success toast works, but the paid item stays under "Belum Dibayar" and a phantom 0% budget is created.
- Edit Anggaran (×10): defaults to IDR, truncated amount, wrapped and clipped "Simpan Perubahan", unlabeled red delete button, no spend context.

### Not reachable

- Month picker ("Oktober" chip), the "Semua kewajiban" and "Lihat transaksinya" links, and Opsi lanjutan in Tambah Kategori were not opened.

## laporan

Scores: desktop 4/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The editorial headline hero is strong, but the report tabs disagree on the same period's totals (three different income and expense totals and three different "Gaji" values), the charts have clipped or missing axes, and the KPI layouts and tables are sloppy.

### Defects

- [P0] desktop 106/111/112/114 — For the same period (11 Apr–11 Okt), Ringkasan, Grup Keluarga and Arus Kas show Pemasukan €10.012,27 / Pengeluaran €13.299,44, while Bank, Detail and PNL show €9.874,95 / €12.242,49 → use one data source and one definition of the period for every tab.
- [P0] desktop 112-tab-laporan-detail.png — On one screen, the hero shows Pengeluaran ≈ €12.242,49 while the KPI strip below shows "PENGELUARAN −≈ €14.398,51" and "SURPLUS −€4.523,55" → reconcile them; the strip must match the hero.
- [P0] desktop 113-tab-laporan-aliran-dana.png — "Sumber Dana Masuk" sums to €12.242,49 (Gaji alone €10.095,64) while the hero says Pemasukan €10.012,27, and the income side and the expense side both sum to exactly €12.242,49 → fix the income aggregation; sources cannot exceed total income.
- [P0] desktop 113/114/115 — "Gaji" for the same period is €10.095,64 (Aliran Dana), €8.143,28 (PNL) and €8.280,59 (Arus Kas) → use one category aggregation across all reports.
- [P0] desktop 109-tab-laporan-tahunan.png — "Total Pemasukan 2026 ≈ €9.874,95" is lower than the 6-month Ringkasan income (€10.012,27), so year-to-date is smaller than a subset of itself → fix the annual aggregation.
- [P0] desktop 109-tab-laporan-tahunan.png — The "Tren Pemasukan per Tahun" y-axis reads 50M/100M/150M/200M, while annual income is about €9.9k; these are IDR units on a € page → use display-currency ticks.
- [P0] desktop 115-tab-arus-kas.png — The Sankey's middle node is labelled "Pemasukan ≈ €13.299,44", which is the expense total (Pemasukan is €10.012,27) → label it "Total arus" or "Pengeluaran", with the correct number.
- [P1] desktop 104/106-tab-ringkasan — The chart's y-axis label is clipped at the left edge (".359,56"), it is the only tick, and the bars have no month labels on the x-axis → add full tick labels inside the plot padding and Mei–Okt labels under the bars.
- [P1] desktop 108-tab-laporan-bulanan.png — The y-axis label "≈ €2.359,56" hangs outside the card's content padding (x≈537 against a 564 content edge), and there are only the max and 0 ticks → put ticks inside the plot area with 3–4 gridlines.
- [P1] desktop 108-tab-laporan-bulanan.png — In the "Rekap per Bulan" table, the MASUK, KELUAR and NET headers are left-aligned while their values are right-aligned, so each header sits about 150px away from its column → right-align numeric headers.
- [P1] desktop 112-tab-laporan-detail.png — The JUMLAH column is cut off at the card's right edge: the header "JUMLAH" is clipped and amounts lose their last digit ("−≈ €99,8", "≈ €109,8") → add right padding or let the table scroll inside the card.
- [P1] desktop 107/109/110 — The KPI bentos leave a single card alone on a second row ("Jumlah Transaksi", "Rasio selisih · 2026", "Surplus") with two-thirds of the row empty → use a 4-column row or a 2×2 grid.
- [P1] desktop 107-tab-laporan-harian.png — The first transaction's icon is a broken empty glyph (□) → fall back to the category icon.
- [P1] desktop 107-tab-laporan-harian.png — The headline reads "keluar ≈ €99,82 dari 2 transaksi", but only one of the two is counted (the other is a €109,80 principal transfer) → say "dari 1 transaksi" or count the transfer separately.
- [P1] desktop 110-tab-laporan-grup-keluarga.png — The orange note says the period picker does not filter this view, yet the breadcrumb shows "11 Apr – 11 Okt", the hero says "di periode ini", and Pemasukan/Pengeluaran match the period-filtered tabs → make the note true or remove it, and disable the picker on this tab if it is ignored.
- [P1] desktop 111-tab-laporan-bank.png — Account names run into the bank tag with no gap ("BCA Tahapan ···9010BCA", "OVOOVO", "Kas Tunai—") → add a separator and muted spacing, or drop the duplicate tag.
- [P1] desktop 115-tab-arus-kas.png — The Sankey's left labels for Bonus, Freelance, Hasil Investasi and Defisit sit on top of each other, and the value text is under 11px (tinyText=11) → set a minimum node spacing, group small flows into "Lainnya", and use 11px+ labels.
- [P1] desktop 119-click-cetak-pdf.png — Clicking "Cetak PDF" gives no feedback (no toast, no print dialog), while Excel shows a toast → show progress and success for PDF too.
- [P2] desktop 106/108/115 — Negative values are set in the positive lime accent: "≈ €3.287,17" and "≈ €630,32" (pengeluaran melebihi), "≈ −€3.287,17", and "−33%" in green → use the danger colour for deficits.
- [P2] desktop 110/112/115 — Negative results are labelled "Surplus" ("Surplus ≈ −€3.287,17", "SURPLUS −€4.523,55") → switch the label to "Defisit" when the value is negative, or use "Selisih".
- [P2] desktop 106-tab-ringkasan.png — The breadcrumb reads "Ringkasan / Ringkasan" → show the group only once, or use "Laporan / Ringkasan".
- [P2] desktop 106-tab-ringkasan.png — In "Dibanding bulan lalu", Selisih (−€630,32, ↓267%) uses a lime dot like Pemasukan → use the danger dot for a negative change.
- [P2] desktop 106-tab-ringkasan.png — "Ke mana uangnya" uses an arbitrary bar colour per row (dark green, orange, teal, grey), and the 5 rows sum to €13.045 of €13.299 with no "Lainnya" row → use one colour, scaled by value, and add the remainder row.
- [P2] desktop 104/106 — The "Ke mana uangnya" and "Dibanding bulan lalu" cards end about 60px apart at the bottom → stretch the cards to equal height.
- [P2] desktop 112/107 — Amount signs are formatted inconsistently: "−≈ €99,82" (sign before ≈) here, "≈ −€99,82" elsewhere, and transfers have no sign → use one format, "≈ −€x".
- [P2] desktop 112-tab-laporan-detail.png — The KPI strip (small uppercase labels, 60px tall) uses a different card style from the KPI cards on Harian, Tahunan and Grup Keluarga (large, 130px) → use one KPI component.
- [P2] desktop 112-tab-laporan-detail.png — Seed test rows such as "Bulk pagination test 468" appear in the demo data → clean them out of the demo dataset.
- [P2] desktop 113-tab-laporan-aliran-dana.png — The hero copy "Keluarga membelanjakan…" is a copy of Grup Keluarga's; the section titles are ALL CAPS ("SUMBER DANA MASUK") unlike the title-case cards elsewhere; and the left card ends about 230px above the right one → write a report-specific headline, use title case, and align the card heights.
- [P2] desktop 114-tab-laporan-pnl.png — The "PENDAPATAN / BEBAN" legend chips sit top-right on a statement that has no chart → remove them, or tie them to the inline bars.
- [P2] desktop 107-tab-laporan-harian.png — The date chip "11 Oktober 2026" (about 46px tall, outlined) is misaligned with the Excel and PDF buttons (40px), and the breadcrumb still shows "11 Apr – 11 Okt" on a daily report → match the button heights and show the selected day in the breadcrumb.
- [P2] desktop 115-tab-arus-kas.png — The hero headline wraps and leaves "ini." alone on the second line → balance the wrap (text-wrap: balance) or shorten the copy.
- [P2] desktop 116/117-periode — The trigger shows a date range ("11 April 2026 – 11 Oktober 2026") while the dialog edits Tahun/Bulan/Rentang, and the dialog header has the same stray hairline between title and subtitle as Bayar → make the trigger mirror the chosen preset and remove the rule.
- [P3] desktop 118-click-excel.png — The toast "Membuat ekspor EXCEL..." has no icon (other toasts do), and EXCEL is in caps → add the icon and write "Excel".
- [P3] desktop 104-page.png — "Cetak PDF" uses a download icon → use a printer or file icon.

### Dialogs & forms seen

- Filter periode: reads fine; the header has a stray rule; no applied or submitted state was captured, and the trigger label does not reflect the preset model.
- Excel export: a progress toast appears; no completion state was seen.
- Cetak PDF: no visible feedback.

### Not reachable

- Investasi, Performa, Laporan Balance Sheet, Aset & Liabilitas, Pajak and Ringkasan COA were not captured (17 reports listed, 10 shot); the lower parts of Bulanan, Tahunan, Bank, PNL and Arus Kas (below the fold) were not seen; the 6 Bln / 12 Bln toggle was not exercised.

## tujuan

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The hero and goal cards look on-brand, but the chart is broken (clipped axis, duplicate legends, ambiguous labels), the side cards are mostly empty and contradict the goal details, and the add form accepts nonsense values.

### Defects

- [P0] desktop 120/124 vs 125/127 — The page says "Sesuai rencana 4/5 · Perlu didorong 0 · Berisiko 0", "Semua tujuan berjalan sesuai rencana" and "Semua tujuan berjalan baik", while the Dana Pensiun and Liburan Jepang detail sheets show a red warning ("Perlu menabung ≈ €311,92 / bulan, belum ada alokasi rutin") under the status "On Track" → count goals without an allocation as "Perlu didorong" and list them in "Perlu perhatian".
- [P1] desktop 120-page.png — The chart's y-axis label is clipped at the card's left edge ("€ 49.907,82", with the ≈ cut off); after submit it reads "250.000,00" with the leading digits cut (124) → reserve label width inside the plot.
- [P1] desktop 120/124 — There are two legends in opposite order ("Terkumpul • Target" under the button and "Target • Terkumpul" above the plot) → keep one legend.
- [P1] desktop 120/124 — The x-axis labels are truncated to the first word, so two bars are both labelled "Dana" (Dana Pensiun and Dana Darurat), plus "DP" and "Audit" → use short distinct names or an ellipsis with a tooltip.
- [P1] desktop 124-tambah-tujuan-submitted.png — A single large goal flattens every other bar to a 2px line, so the chart carries no information → plot % progress per goal, or cap and annotate outliers.
- [P1] desktop 124-tambah-tujuan-submitted.png — The "Tambah Tujuan" button jumps from beside the amount (120) to a row below it (124) when the figure gets wider, shifting the layout → give the button a fixed position.
- [P1] desktop 120-page.png — "Perlu perhatian" (about 330px tall) and "Semua tujuan berjalan baik" (about 400px tall) hold one sentence each and say the same thing; most of the right column is empty white → merge them into one card, or fill it with per-goal next actions.
- [P1] desktop 123/124 — "Tanggal Auto-debit (1-28)" accepts 1250000, and a target date of 10 Oktober 2026 (yesterday) is accepted; both save without an error → enforce the 1–28 range and a future date inline.
- [P1] desktop 125–129 detail sheets — The Setor (lime filled pill), Edit (plain text) and Hapus (red text) actions each use a different button style, with "Riwayat Setoran" as an underlined link below → use one button hierarchy (primary, secondary, destructive ghost) in a single row.
- [P1] desktop 129-audit-qa-1-100-terkumpul-dialog-open.png — A goal at 100% "Tercapai" still offers "Setor" as the primary action → hide or demote Setor for completed goals.
- [P2] desktop 125–128 — The status label "On Track" is English, while the 100% goal says "Tercapai" → use Indonesian throughout ("Sesuai rencana").
- [P2] desktop 125–129 — The detail sheet shows %, the remaining amount and the date, but not the target or collected amounts, and leaves about 600px of empty sheet → add Terkumpul / Target / Auto-debit rows and the deposit history inline.
- [P2] desktop 129 — The meta line reads "terkumpul · Oktober 2026" in lowercase, while the others read "≈ €x lagi · <date>" → write "Tercapai · Oktober 2026".
- [P2] desktop 121/122 — The FX note (3 lines) is repeated under each of the three money fields, making the form about 40% longer; the "Ikon" picker is cut off at the bottom, and its first glyph renders as an empty rectangle → show the FX note once at the top of the form and fix the icon glyph.
- [P2] desktop 121-tambah-tujuan-dialog-open.png — There is no subtitle or description under the title, unlike the Tambah Kategori and Edit Anggaran sheets → add the one-line description.
- [P2] desktop 122-tambah-tujuan-validation.png — Only Nama Tujuan gets an inline error; Target Jumlah = 0 and an empty Target Tanggal are not flagged → validate the required money and date fields too.
- [P2] desktop 124-tambah-tujuan-submitted.png — The success toast covers the new goal card's progress line → place toasts clear of the content (bottom-right), or offset them.
- [P2] desktop 120/124 — The "Tujuan baru" dashed tile has no fixed slot in the grid (it moves between the 2nd and 3rd column), and the bottom of the grid misaligns with the right column → keep it last at a fixed size.
- [P3] desktop 124/129 — The new goal reuses the lock icon that Dana Darurat uses → assign a distinct default icon.

### Dialogs & forms seen

- Tambah Tujuan Keuangan: the inline error for Nama works and a success toast appears; there is no range or date validation, the FX text is repeated three times, and the icon picker is clipped.
- Goal detail sheets (×5): mixed button styles, the English "On Track" label contradicts the red warnings, no target or collected amounts, and the sheet is mostly empty.

### Not reachable

- The Setor, Edit, Hapus and Riwayat Setoran flows inside the goal sheets were not opened; the Target Tanggal date picker popover was not captured.
