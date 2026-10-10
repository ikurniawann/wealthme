## akun

Scores: desktop n/a · tablet 3/3/3 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The two-column tab bodies survive at 834px, but the tab strip, the Preferensi notification grid and the Keamanan tiles are sized for desktop, and the page has two unrelated sheet styles.

### Defects

- [P1] tablet 005-tab-preferensi.png — The notification section uses 3 columns (Transaksi / Tujuan & Anggaran / Investasi) of ~240px, each with a toggle on the right. Descriptions are cut ("Setiap ada dana masuk ke…", "Notifikasi perubahan harga…"), and "Anggaran Mendekati Batas" wraps into its toggle column → use 2 columns at tablet, or one row per setting with the toggle on the right.
- [P1] tablet 005-tab-preferensi.png — The Tema "Ikuti sistem" option wraps to 2 lines while "Terang"/"Gelap" are 1 line, so the three tiles have uneven text baselines. The "Terang" check mark sits right against the tile edge → shorten the label to "Sistem" or stack the tiles under the Bahasa control.
- [P1] tablet 004-tab-keamanan.png — The "Lihat semua (24)" link is cut by the dock (only its top half shows at y≈1040), and every Sesi Aktif row's "Akhiri" action is a bare 11px red word (tap target ≈40×16px) → add bottom padding equal to the dock height, and make "Akhiri" a ≥36px ghost button.
- [P2] tablet 001/003 — The tab strip is a 420px pill that stops at x≈450 inside an 806px card, leaving the right half empty → stretch the segmented control to the card width, or left-align it with the card title.
- [P2] tablet 001-page.png, 011-info-dialog-open.png — The "Anggota (2)" info icon sits alone on its own row under the heading. Its popover then covers the "Demo User (Kamu)" row → put the icon inline after the heading and anchor the popover above it.
- [P2] tablet 002-page-scroll-1.png — Ana Demo's row ends in an unlabeled gauge icon (x≈774) with no tooltip or text, so its purpose (transaction limit) is unclear on touch → label it "Batas" or use a chevron with a "Batas transaksi" caption.
- [P2] tablet 009-edit-profil-validation.png — The "Profil berhasil disimpan" toast is centred on the viewport, so it straddles the sheet edge at x≈450: half of it is on the blurred scrim → centre toasts inside the open sheet, or place them above the sheet footer.
- [P2] tablet 008 vs 012 — Two sheet patterns on one page. "Profil Saya" is a 384px sheet with a hairline header, an inline save button and no footer. "Batas Transaksi Besar" is a 460px sheet with a rounded left edge, a circular close button and a sticky Batal/Simpan footer → use one sheet component.
- [P2] tablet 012-batas-transaksi-besar-ana-demo-dialog-op.png — The amount shows a pre-filled "0" in a grey (disabled-looking) field, while the copy says "Kosongkan untuk tidak membatasi". The 760px of empty sheet below it make the dialog look unfinished → leave the field empty with a placeholder, and size the sheet to its content or use a centred dialog.
- [P3] tablet 008-edit-profil-dialog-open.png — The "Penghasilan Bulanan" placeholder is "cth: Rp 25.000.000" on a EUR account → use the account currency in the example.

### Dialogs & forms seen

- Edit profil sheet (008–010): fits the viewport; has a toast placement issue and a different sheet style from Batas.
- Info popover (011): overlaps the member row.
- Batas Transaksi Besar sheet (012): fits; pre-filled 0, mostly empty sheet.

### Not reachable

- The FAQ accordions were not expanded at tablet (006 shows them collapsed only), so expanded-answer wrapping at the 414px column is unverified.

## rekonsiliasi

Scores: desktop n/a · tablet 3/3/3 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The 4-step stepper fits at 834px, but the primary "Lanjutkan" CTA floats outside any card under the dock, and the info popover and template sheet are squeezed.

### Defects

- [P1] tablet 013-page.png, 018, 021 — "Lanjutkan ke Pencocokan", the main next-step action, is a 230px pill on the sage background between cards. On first paint it sits under the dock (y≈1012–1052), half hidden → put it inside the upload card footer, or in a sticky action bar above the dock.
- [P1] tablet 019-info-dialog-open.png — At tablet the info popover is a 300px-wide, ~550px-tall column of 4 paragraphs that runs from y≈516 to y≈1064, past the top edge of the dock, and covers the dropzone and the bank chips → cap it at ~360px tall with internal scroll, or move the text into an expandable "Format didukung" row.
- [P1] tablet 015-kelola-template-dialog-open.png, 016 — In the 460px sheet the saved-template KOLOM cell "2026-10-10 · Audit QA 3 · 1250000" runs flush to the sheet's right padding edge with no wrap, and the 3-column table has no row actions → stack the mapping as three labelled lines under the template name at sheet widths.
- [P2] tablet 013-page.png — "Maksimal ukuran file: 20MB" is a lone 11px right-aligned line above the card title, so it reads like a stray header → move it next to the format chips under "Pilih File".
- [P2] tablet 023-click-lanjutkan-ke-pencocokan.png — The scan state is a 220px white card, followed by ~400px of empty sage canvas down to the dock → centre the scan card in the remaining space, or give it a progress bar and a "Batal" action so the screen is not mostly empty.
- [P2] tablet 016-kelola-template-validation.png — The native English "Please fill out this field." bubble overlaps the "Kolom Keterangan" label at tablet (already logged as a defect on desktop; at tablet it also covers the next field's label).

### Dialogs & forms seen

- Kelola Template sheet (015–017): fits; the table cell is clipped, native validation.
- Info popover (019): too tall for the viewport at tablet.
- Bank chips (021/022): the selected state and the helper line "Template pemetaan kolom untuk bank ini akan diterapkan." render fine.

### Not reachable

- The file picker (018/020) opens the OS dialog, so no upload or preview state was captured.

## splitbill

Scores: desktop n/a · tablet 3/3/3 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The 3-up active-bill grid works at 834px, but the hero chart is a single sliver, a stray status card trails the page, and the detail sheet crushes its warning text.

### Defects

- [P1] tablet 025-page-scroll-1.png — A white card "Audit QA 1 baru 0% / Sisa ≈ € 1.250.000,00 dari 3 orang." sits alone at the bottom of the page with no heading style, action or link; it looks like a leaked live-region/toast rendered as a card → remove it, or fold it into the Audit QA 1 tile as a "baru" badge.
- [P1] tablet 029-liburan-bali-bareng3-orang-6-okt-2026lun.png — In the 460px sheet the yellow warning puts a 180px text column (7 wrapped lines) beside a wide "Atur Rekening Tujuan" button → stack the button under the text at sheet widths.
- [P1] tablet 024-page.png — The hero chart draws one tall "Audit" bar and an invisible "Makan" bar (€59,89 against €1,25 jt), so 600px of chart says nothing. Its two legends are in opposite orders ("Terkumpul · Total" vs "Total · Terkumpul") → at tablet replace it with per-bill progress rows, or use a log/clamped scale.
- [P2] tablet 029 — The sheet header says "≈ € 141,41 / orang" while the rows show 141,39 / 141,39 / 141,44 → show the actual per-person split, or note the rounding.
- [P2] tablet 024-page.png — In the active tiles the money line wraps with a dangling "≈" at the end of a line ("terkumpul dari ≈ / € 1.250.000,00") → keep "≈ €" with the number (non-breaking space).
- [P2] tablet 028-buat-split-bill-filled.png — The stale "Judul acara wajib diisi" toast is centred on the viewport across the sheet edge (x≈240–595), half on the scrim (the stale toast itself is already logged on desktop) → anchor toasts inside the sheet.
- [P2] tablet 029 — The footer puts three buttons in 460px (Hapus outline-red, Tutup, Cabut Semua Link solid red), so the primary slot holds a destructive action (already logged on desktop). At tablet the three pills are also uneven widths (102/108/180px).

### Dialogs & forms seen

- Buat Split Bill sheet (026–028, 030–032): fits at tablet with no clipped participant row (better than desktop). It has three helper lines under the amount, and amounts lack thousands separators ("EUR 416666,67").
- Liburan Bali detail sheet (029): crushed warning box and destructive primary.

### Not reachable

- The share/copy-link flow for a single participant was not opened.

## warisan

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The page reads acceptably as stacked slabs, but the edit sheet's heir table loses its share column at 460px, and the asset rows show unlabeled toggles and icon buttons.

### Defects

- [P0] tablet 038-ubah-dialog-open.png — In the 460px edit sheet the heir table is wider than the sheet. The header shows "NAMA / HUBUNGAN / BA…" and the share (%) input is fully off-canvas at x>798, so the user cannot see or edit the share at tablet (desktop shows a partly clipped input) → stack each heir as a card (name select, relation, share %) at sheet widths.
- [P1] tablet 033-page.png, 034 — Each asset row has a green toggle (x≈668) with no label (it is "Terlihat oleh ahli waris"), next to two 44px grey icon squares (edit, red-tinted delete) → add a visible "Terlihat" label or eye icon, and group the actions in an overflow menu.
- [P1] tablet 034-page-scroll-1.png — "Tabungan & Investasi" and "Toyota Avanza 2021" rows have ~60px of empty space where Rumah Depok shows heir chips and an allocation bar, so the rows are different heights with no "Belum ada ahli waris" state (already logged on desktop; at tablet the empty band is wider at 740px).
- [P2] tablet 033-page.png — The hero has ~80px of dead green between the legend rows and the stat row → tighten the hero.
- [P2] tablet 038 vs 035 — The edit sheet opens Nilai Estimasi in IDR ("Rp 850.000.000", IDR selector), while the add sheet defaults to EUR → open both in the account currency.
- [P2] tablet 039-hapus-dialog-open.png — The delete confirmation is a 400px centred modal (other warisan dialogs are right sheets). Its body text wraps into a ~270px column inside the 400px header, leaving ~90px empty on the right → let the text use the full width.

### Dialogs & forms seen

- Tambah Aset Warisan sheet (035–037): fits; ~240px of dead sheet below "Tambah Ahli Waris".
- Ubah sheet (038): heir share column unreachable (P0).
- Hapus modal (039): the gradient banding is already logged on desktop; the text column is narrow.

### Not reachable

- The heir picker inside "Tambah Ahli Waris" was not opened at tablet.

## donation

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: At 834px the hero chart's right-hand axis is cut by the card edge, and the calculator header crowds a truncated select. The rest stacks cleanly.

### Defects

- [P1] tablet 040-page.png, 041–054 — The hero bar chart puts its y-axis labels on the right, and they are clipped by the card's right edge: "≈ € 1.497.234", "≈ € 998.156,", "≈ € 499.078,", "Avg ≈ € 250.0" (the offscreen tickText metric). This is the right-side mirror of the known left-axis clipping → reserve a right gutter, or use compact ticks ("€1,5 jt").
- [P1] tablet 040-page.png — The religion select is 150px and truncates its placeholder to "Pilih agama kelua", squeezed between the title and "Simpan Agama Keluarga", with an orphan info icon at the far right → put the select and button on their own row under the title at tablet.
- [P2] tablet 040-page.png — The hero's right column is empty: the Catat Donasi button floats at the top-right over ~300px of empty green beside the chart, and the stat row uses 2 of 3 columns → fill the third column (e.g. "Zakat dibayar") or make the stats 2-up.
- [P2] tablet 051-info-dialog-open.png — The calculator info popover covers the "Emas & Perak (Rp)" label and the top of its input → anchor the popover above or to the left of the icon.
- [P2] tablet 054-catat-estimasi-zakat-filled.png — The "Jumlah donasi tidak valid" toast sits centred across the sheet edge at x≈240–595 (stale-toast content already logged on desktop).
- [P3] tablet 042–047 — At tablet the select trigger shows the chosen value ("Islam (Zakat)", "Tidak diatur"), unlike the blank desktop trigger, so the desktop P0 is desktop-only. Note it for the fix.

### Dialogs & forms seen

- Catat Donasi sheet (048–050): fits with ~380px of empty sheet; "Jumlah (Rp)" label is next to a € field (already logged).
- Catat Estimasi Zakat (052–054): the same sheet opens in IDR (already logged).
- Info popover (051): covers an input.

### Not reachable

- None evident.

## tax

Scores: desktop n/a · tablet 2/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The longest page in the set (~5 screens of single-column slabs) at 834px. It has duplicate SPT cards, a floating orphan button, an overlapping PTKP/Tanggungan control and a US-format native date field.

### Defects

- [P1] tablet 055-page.png — Under the hero, "SPT 2026 / Belum Lapor" and "Status SPT Tahunan 2025 / Sudah Lapor" are two full-width 806px cards that repeat the hero's own stat row word for word, each holding one value → drop them at tablet, or merge them into one 2-up row.
- [P1] tablet 055-page.png, 061, 070 — "Buka kalkulator PPh 21" is a small grey pill floating right-aligned on the sage background between cards, pointing at the calculator directly below it → remove it, or make it an anchor in the hero.
- [P1] tablet 056-page-scroll-1.png, 061, 070 — At tablet the Status PTKP and Tanggungan segmented controls share one 774px track. The "0" chip is drawn over "K/I (penghasilan i…" ("K/I (penghasilan i0"), and selecting K/I plus "3" (070) lights two pills in one track (already logged on desktop; the overlap is identical at tablet) → put Tanggungan on its own row under Status PTKP below 1024px.
- [P1] tablet 078-tambah-penghasilan-dialog-open.png — "Tanggal diterima" is a native `mm/dd/yyyy` date input, while every other sheet uses the app date picker ("11 Oktober 2026") → use the shared date picker with an Indonesian format.
- [P2] tablet 055-page.png — The hero is 430px tall with "Belum ada PKP" centred and ~160px of empty green below it (already logged on desktop; at tablet it is the whole first screen).
- [P2] tablet 057-page-scroll-2.png — In "Ringkasan pajak tahunan" the 3 sub-stats are uneven columns (240 / 80 / 100px) and leave the right ~340px empty → use an equal 3-column grid across the full card.
- [P2] tablet 058-page-scroll-3.png — The "+ Upload" button has both an upload icon and a literal "+" → keep one.
- [P2] tablet 058, 084 — The three bottom actions (Lapor SPT Tahunan, Unduh CSV, Unduh PDF) sit outside any card on the sage background, and the two Unduh clicks give no visible feedback → put them in the Ringkasan card footer and show a download toast.
- [P2] tablet 077-click-atur-per-bulan-bonus-thr.png — The 12-month grid is 4×3 with numeric labels. The "1" field is ~12px higher than 2–4 (already logged on desktop; same at tablet).

### Dialogs & forms seen

- Simpan ke Catatan Pajak sheet (075): fits; the developer note and the garbled year are already logged; ~640px of empty sheet.
- Tambah penghasilan sheet (078–080): native date input; the centred checkbox with its label below is already logged.
- Year/sector selects (066–074): native selects, they work.

### Not reachable

- "Isi omzet bulanan" and "Penghasilan freelance / bebas" expanders were not opened at tablet.

## quickinput

Scores: desktop n/a · tablet 3/2/3 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The 3×4 shortcut grid fits at 834px. However, the hero axis is clipped on the right, and "Catat transaksi" opens a centred modal while every other shortcut opens a right sheet.

### Defects

- [P1] tablet 085-page.png — The hero chart's right-axis labels are cut by the card edge ("Avg 4 transak…"), and the Avg label overprints "3 transaksi" → keep axis labels inside the card padding.
- [P1] tablet 087-catat-transaksi-dialog-open.png vs 097/099/102/105/108 — "Catat transaksi"/"Transaksi" opens a 600px centred modal with a dark header band, while Rekening, E-Wallet, Aset, Liabilitas, Asuransi and Tujuan open 460px right sheets with light headers. One page has two dialog families → use the same container for all quick-input forms.
- [P1] tablet 108-tujuangoal-keuangan-baru-dialog-open.png — Three money fields each repeat the same 3-line FX note ("1 EUR = Rp 20.036,94 · ECB…", "Nilai rupiah final…", "Disimpan sebagai IDR…"), so 9 of the sheet's lines are duplicates → show the rate note once at the top of the form.
- [P1] tablet 097-rekening-banktambah-rekening-bank-dialog.png, 098 — "Pemilik" is an empty select with no placeholder or default → default it to the current user, or show "Pilih pemilik".
- [P2] tablet 087-catat-transaksi-dialog-open.png — The Jumlah field shows a dark focus border and a separate lime underline 6px below it (double focus indicator). The Akun strip clips a 4th card ("G…", the tx-tile offscreen metric) → use one focus style, and fit 3 full cards or show a fade.
- [P2] tablet 085-page.png — Entri Terakhir amounts read "-≈ € 40,48" (minus before the approximation sign) → render "≈ -€ 40,48" or "−€ 40,48".
- [P2] tablet 086-page-scroll-1.png — Each shortcut tile is 250×120 with the icon, title and caption crammed top-left and ~120px empty on the right → centre the content vertically, or make tiles shorter with the icon inline.

### Dialogs & forms seen

- Tambah Transaksi modal (087–089, 093–095): fits the viewport; the silent validation and Rp balances are already logged.
- Rekening/E-Wallet/Aset/Liabilitas/Asuransi/Tujuan sheets (097–110): fit. They have empty Pemilik selects, repeated FX notes, tofu icon pickers (already logged) and generic error toasts (already logged).

### Not reachable

- None evident (the nav-\* shots left the route as expected).

## masterdata

Scores: desktop n/a · tablet 3/3/3 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Category names no longer truncate at 834px, but the rows are stretched 770px lines with tiny icon actions, the hero is half empty, and the info popover is attached to the wrong card.

### Defects

- [P1] tablet 116-page-scroll-1.png, 117 — Each category row's edit (pencil) and delete (×) are bare ~16px glyphs about 45px apart with no hit area, and the name sits ~550px away from them → give each action a ≥40px button. Use the trash icon used elsewhere (warisan, mastercoa) instead of "×".
- [P1] tablet 118-info-dialog-open.png — The info popover on the "Akun COA" card describes the whole Data Master page ("Kelola data referensi… Item bertanda"Bawaan"…") and covers 4 rows of the COA list → move the icon to the page/hero title. Also fix the missing space before “Bawaan”.
- [P2] tablet 115-page.png — The hero has ~120px of dead green between the Keluar/Masuk legend and the stat row. A brighter hairline segment runs over the stat row from x≈290 to x≈800 only → shrink the hero and draw one full-width divider.
- [P2] tablet 115-page.png — The "Akun COA" list is 6 rows that only use the left 160px of an 806px card → show the 6 groups as a 3×2 or 2×3 tile grid at tablet.
- [P2] tablet 116-page-scroll-1.png — Codes are duplicated across categories ("Audit QA 1" and "Bonus" are both 10002; "Freelance" and "Lainnya Pemasukan" are both 10099) and render as tiny grey monospace → show the COA name ("10002 · Bonus"), or flag shared codes.
- [P2] tablet 124-hapus-audit-qa-1-dialog-open.png — The delete confirmation is a centred 400px modal with the description in lowercase and a ~290px column, while add/edit are right sheets. It has no close × (mastercoa and iam delete dialogs have one) → use one confirm-dialog template.

### Dialogs & forms seen

- Tambah/Edit Kategori sheets (120–145 odd): fit; tofu icon picker and toast-only validation already logged; ~560px of empty sheet.
- Hapus modals (124–146 even): fit; inconsistent with the other routes' delete dialogs.

### Not reachable

- None evident.

## mastercoa

Scores: desktop n/a · tablet 3/3/1 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: At 834px the "Semua akun" grid overflows horizontally. That widens the layout viewport, shifts the whole page, and pushes the dock half off-screen. The page is also ~10 screens of unpaginated cards and rows.

### Defects

- [P0] tablet 147-page.png, 148–153, 156 — In the unfiltered view the card "Medical Supplies & Accessories" (20404) runs past x=834, and "Donation Religious/Ministry" (21202) runs past the grid edge. The resulting horizontal overflow pushes the fixed dock down to y≈1088, so only its top 24px shows and the labels are hidden. It also shifts the dock right (the "+" moves from x=417 to x≈434) and lets the page pan sideways (156 shows the background offset ~33px left). In the filtered view (165) the dock is normal → `min-width:0` and wrap/ellipsis on card titles, and `overflow-x:clip` on the grid.
- [P1] tablet 149-page-scroll-2.png, 150 — "Penalti Pelunasan Pinjaman" (20011), "Grooming & Personal Care" (20302) and "Public Transport & Ride-Hailin…" (20502) push their cards into the next column's gutter or clip mid-word (already logged on desktop; at tablet four cards in the 250px columns are affected).
- [P1] tablet 148–153 — "Semua akun" shows all 106 cards in 36 rows (~5,000px). Below it, "89 akun COA belum terhubung" is another ~5,000px single-column list of rows that use only the left 260px of an 806px card → paginate or collapse by group, and show the unlinked list as a 2–3 column grid or behind a "Lihat 89 akun" disclosure.
- [P1] tablet 157-tambah-akun-validation.png — An empty submit shows the native English "Please fill out this field." bubble over the Arah Transaksi label → use inline Indonesian errors as in the IAM Tambah sheet.
- [P2] tablet 147-page.png, 165 — The "Semua" row ends in a near-empty 20px pill containing only "·", unlike the labelled direction chips on the other rows → remove it, or show "Semua arah".
- [P2] tablet 147-page.png — The hero's three action buttons (Master Data, Panduan, Tambah Akun) sit in one row at the top-right, crowding into the "106" title area. The stat row uses 2 of 3 columns → put the secondary actions in an overflow menu at tablet, and fill or merge the stat row.
- [P2] tablet 155-panduan-dialog-open.png — The Panduan modal is a 480px centred card whose body text is cut at the bottom (y≈1050), with no fade, footer or close-at-bottom; the two cards per row hold long "Contoh" blocks (8–10 lines) → add a bottom fade/scroll hint, or use a full-height sheet at tablet.
- [P2] tablet 167-pajak-penghasilan-hapus-dialog-open.png — The delete dialog has a circular × in its header, while the warisan/masterdata delete dialogs do not → one confirm template.

### Dialogs & forms seen

- Tambah Akun sheet (156–158): fits; native English validation; English group names already logged.
- Edit Akun sheets (166–180 even): fit; ~400px of empty sheet.
- Hapus dialogs (167–181 odd): fit; extra × compared with other routes.
- Panduan modal (155): no scroll cue.

### Not reachable

- None evident.

## panduan

Scores: desktop n/a · tablet 3/3/3 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The topic grid becomes 3 columns at 834px with orphan rows in every section, and the copy still describes desktop-only affordances.

### Defects

- [P1] tablet 182-page.png, 188-tab-transaksi.png — "Tombol "+" Catat Transaksi" says "Klik ikon "+" di sidebar". At tablet there is no sidebar; the "+" is the ring button in the bottom dock → make the copy viewport-aware ("tombol + di bawah layar").
- [P1] tablet 182/183/185 — The 3-column grid leaves orphans: Memulai has 1 card alone on row 2 (Data Master, with 520px empty beside it); Transaksi, Anggaran and Keamanan have 2 of 3 on their last row → use a 2-column grid at tablet (the counts 4/5/2/… divide better), or let the last card span.
- [P2] tablet 183-page-scroll-1.png — The "Pencarian (Ctrl/Cmd+K)" card advertises a keyboard shortcut on a touch tablet layout → show "Ketuk ikon cari di atas" at touch widths.
- [P2] tablet 193-click-kenapa-statement-pdf-dari-bank-say.png — With the "Keamanan" tab active, the FAQ still lists all 7 unrelated questions (PDF statements, KPR, AI Advisor) → filter the FAQ by tab, or label it "Semua pertanyaan".
- [P2] tablet 182-page.png — The hero search placeholder is cut ("cth. anggaran, rekonsiliasi, ganti pe") in its 320px field (already logged on desktop; same at tablet).
- [P3] tablet 187–192 — The active tab pill is wider than the inactive label, so tabs after it shift ~2px when switching → reserve the pill padding on all tabs.

### Dialogs & forms seen

- FAQ accordion (193): expands inline and reads well at the full card width. The content contradiction is already logged.

### Not reachable

- None evident.

## persetujuan

Scores: desktop n/a · tablet 2/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The empty state is said four times down one column: a 430px hero with one centred line, then three cards each saying "nothing yet".

### Defects

- [P1] tablet 195-page.png — The hero is 430px tall with "Belum ada keputusan bulan ini." floating at y≈210 and ~200px of empty green below it (already logged on desktop; at tablet it fills the first screen) → collapse the hero to the amount and stat row when there is no data.
- [P1] tablet 195-page.png, 197 — "Lihat riwayat keputusan" is a 770px full-width pill with left-aligned 12px text and no icon or chevron, so it reads as an input field. It duplicates the "Riwayat" tab in the card directly below → remove it, or make it a right-aligned text link with a chevron.
- [P2] tablet 195-page.png — "Pemohon aktif", "Permintaan dana" and the hero each carry their own empty message ("Tidak ada permintaan menunggu.", "Belum ada permintaan dana.", "Belum ada keputusan bulan ini.") → merge into one empty-state card with an illustration and one explanation of how requests arrive.
- [P2] tablet 195 vs 197 — Switching the tab renames the card title ("Permintaan dana" → "Riwayat Keputusan") and shrinks the card by 40px, moving the guidance card up → keep a stable title and height.
- [P2] tablet 195-page.png — The "Periksa sebelum menyetujui" text is a ~490px column inside an 806px card, with the right 300px empty → let it span the card, or pair it beside Pemohon aktif in 2 columns.

### Dialogs & forms seen

- None (no dialogs on this route).

### Not reachable

- No pending request exists, so the approve/reject flow could not be reviewed.

## akses-saya

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The "Rekening kamu" list is a 14-row, 770px-wide column of bare names (~1,000px tall) at 834px, and the same 14 names are repeated as a run-on sentence in the card below.

### Defects

- [P1] tablet 199-page.png, 200 — "Rekening kamu" lists 14 accounts one per 58px row, each showing only a bank icon and a name, using ~180px of an 806px row; the list is ~1,000px tall → use a 2–3 column chip/tile grid at tablet with type icon and last-4.
- [P1] tablet 200-page-scroll-1.png — The "Rekening Ditugaskan" card repeats all 14 names as one 7-line comma sentence ("BCA Tahapan ···9010, Mandiri ···5586, … GoPay, BCA Tabungan, GoPay.") directly under the list that already shows them → show the count only, or the first 3 names plus "+11".
- [P2] tablet 200-page-scroll-1.png — The three permission cards are equal height, set by the longest text. "Saldo Keluarga" and "Laporan Keluarga" have ~80px of empty space under 2–3 lines → align content to the top and let height follow content.
- [P2] tablet 199-page.png — The hero big number now reads "14 / Akun Master" (desktop showed 10); the label problem is already logged. At tablet the hero has no chart or detail, so the large number stands alone → add "rekening ditugaskan" wording and the access chips here.

### Dialogs & forms seen

- None (no dialogs on this route).

### Not reachable

- None evident.

## iam

Scores: desktop n/a · tablet 3/2/1 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: At 834px the hero chart is drawn underneath the stat row, so the numbers sit on top of bars and the average line. The access-matrix heat grid becomes eighteen 80px black and grey slabs.

### Defects

- [P0] tablet 201-page.png, 202, 210 — The hero chart overlaps the stat row. The dashed Avg line runs through "Master 1 / Anggota dengan role 0 / Akses khusus 2", and the Demo bar passes behind the "Master" label. The chart's lower half and x-axis are clipped by the card bottom (on desktop the chart was only clipped). Unlike desktop, "Lihat cara kerja" (210) does not enlarge the hero → give the chart its own row with a fixed height above the stats, or drop the chart at tablet.
- [P1] tablet 201-page.png — The right-axis labels are cut by the card edge ("Avg 12 halam…"), and the "30/20 halaman" labels touch the edge → keep the axis inside the padding.
- [P1] tablet 202-page-scroll-1.png — In "1 anggota akses terbatas" the unlabeled 9×2 heat grid stretches to eighteen ~80×80px tiles: nine solid near-black slabs over grey/white ones, the heaviest element on the page (the missing legend is already logged) → cap tile size at ~28px, add page labels, and use forest/lime/sage tones.
- [P1] tablet 207-buat-role-dialog-open.png, 206, 211 — The "Lihat" state in every access segmented control is sky blue (#0ea5e9-like), and the "Kas & Dompet / Rekening Bank" row dots are blue. Blue is not in the forest/lime/sage palette; "Kelola" uses lime → use a palette tone for Lihat (e.g. sage/forest outline).
- [P2] tablet 207-buat-role-dialog-open.png, 206 — In the 680px sheet, the template chips wrap so "Co-Master" sits alone on a second line. The Tidak/Lihat/Kelola segments are ~30px tall tap targets → let the chips scroll horizontally, and raise segment height to ≥36px.
- [P2] tablet 201-page.png — "Master selalu punya akses penuh, 1 anggota diatur aksesnya" is a caption floating on the sage background between two cards → put it inside the member card header.
- [P2] tablet 201-page.png — Ana Demo's delete is a lone red trash glyph (~16px) placed 20px from the "Anak" chip, with no button surface → give it a 40px ghost button, or move it into the Atur Akses sheet.
- [P2] tablet 206-audit-qa-1hanya-data-miliknya4-halaman-1.png — The Edit Role footer shows "Hapus" as plain red text with no button shape, unlike the outlined "Hapus" in splitbill → use the shared destructive-secondary button.
- [P2] tablet 204-tambah-validation.png — The inline errors ("Nama wajib diisi." etc.) appear, but the fields keep a neutral border → add an error border. This is still the only route in the batch with inline validation; use it as the template for the others.

### Dialogs & forms seen

- Tambah Anak / Operasional sheet (203–205): fits; inline validation present.
- Buat Role / Edit Role (206–209): 680px sheet; blue Lihat state, wrapped template chips, small segments.
- Atur Akses Ana Demo (211): same matrix issues; fits with a sticky footer.
- Hapus Anggota (213): centred modal with ×; fits.

### Not reachable

- None evident.
