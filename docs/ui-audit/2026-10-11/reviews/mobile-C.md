## rekonsiliasi

Scores: desktop n/a · tablet n/a · mobile 3/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: The collapsed hero keeps the first viewport tidy, but the stepper (the page's main idea) is hidden behind "Tren & detail", the primary CTA "Lanjutkan ke Pencocokan" sits under the translucent dock, and the info popover runs over the dock.

### Defects

- [P1] mobile 227-page.png vs desktop 240-page.png — the 4-step stepper (Upload / Pindai / Cocokkan / Selesai) is visible on desktop but on mobile is folded into "Tren & detail", so the first viewport shows a bare "2 Dokumen mutasi diunggah" with no sense of progress → show a compact one-row stepper (4 dots with labels) in the collapsed hero; keep only the Cocok/Perlu ditinjau/Belum cocok stats in the expander.
- [P1] mobile 233-click-tren-detail.png — the expanded hero is ~580px tall (y 135–715): a 2×2 grid of 100px step cards plus a stats block with three "—" values, so the hero fills the whole screen → use a single-row horizontal stepper (~64px) and drop the stats row until there is a matching run.
- [P1] mobile 236-click-bcabca.png, 237-click-mdrmandiri.png — the primary CTA "Lanjutkan ke Pencocokan" sits under the dock at y≈790 and shows through the translucent dock bar; at that scroll stop it cannot be tapped → add bottom padding of at least dock height + 16px to the page, and make the CTA a sticky full-width bar above the dock once a file or bank is picked.
- [P1] mobile 235-click-seret-lepas-file-di-siniatau-pilih.png — the dock is semi-transparent, so the "Bank yang Didukung" heading and body text show through the dock labels (Beranda/Transaksi) and make them hard to read → make the dock surface opaque (solid forest) or blur the backdrop strongly.
- [P1] mobile 234-info-dialog-open.png — the info popover is ~550px tall and runs from y≈290 to y≈838, over the dock (the "Menu" item shows beside it). It is anchored left at 300px wide rather than full width → on mobile open it as a bottom sheet with a title and close button, or cut it to 2 lines with a "Selengkapnya" link.
- [P2] mobile 228-page-scroll-1.png — the Tips card's close "×" is a 9×24px tap target (smallTargets "Tutup 9x24") → give it a 36×36 hit area.
- [P2] mobile 228-page-scroll-1.png — "Lanjutkan ke Pencocokan" is a 232px-wide left-aligned pill floating between two cards, unlike the full-width card buttons elsewhere, and it has a drop shadow → full-width primary button inside the upload flow, no shadow.
- [P2] mobile 228-page-scroll-1.png — on mobile "Lihat Riwayat" drops to its own row under "Dokumen Terbaru" with ~30px of gap above and below, so it reads as a sub-heading → put it on the title row, right-aligned, as on desktop.
- [P2] mobile 228-page-scroll-1.png — Dokumen Terbaru rows truncate both lines ("BCA_Rekening_K…", "Diupload 18/9/2026, 17.…") because the "Terunggah" badge and the chevron take ~110px → move the badge under the filename, or drop the chevron and let the name wrap to 2 lines.
- [P2] mobile 236-click-bcabca.png — picking a bank inserts a whole new "Pemetaan Kolom — BCA" card (~190px) between Bank yang Didukung and the CTA. That pushes the CTA under the dock and repeats the "Kelola Template" button already in the hero → show the mapping status as one line inside the bank card.
- [P2] mobile 236-click-bcabca.png — the chip row wraps "Lainnya" onto its own line under BCA/Mandiri, leaving ~150px empty to its right → let the three chips scroll horizontally on one row, or shorten them to logo + name.
- [P2] mobile 227-page.png — "Maksimal ukuran file: 20MB" is the first line of the upload card, set in 10–11px bold above the card title (tinyText=10 on every shot) → move it under the format chips at ≥12px.
- [P2] mobile 238-click-lanjutkan-ke-pencocokan.png — the scan card's body text runs to ~22px from the card edge while the title and other cards use a 28px inset. The card leaves ~50px dead below "Memulai pemindaian…" and has no cancel → use the same inset, add a progress bar and a "Batal" button.
- [P2] mobile 229-kelola-template-dialog-open.png — the sheet has ~45px of dead space between the 4-line subtitle and the first field ("Bank") → tighten to 16px, and cut the subtitle to 2 lines.
- [P3] mobile 227-page.png — the page title "Rekonsiliasi Bank" is 18px, below the "Selamat pagi, Demo" greeting, so the page has no real h1 weight on mobile → raise the title to the fluid h1 token.

### Dialogs & forms seen

- Kelola Template (229–231): becomes a bottom sheet with a sticky Tutup/Simpan footer and fits; the body scrolls under the footer with no fade. Validation is the native English bubble (desktop already logged it).
- Info popover (234): too tall for mobile and overlaps the dock; it should be a sheet.
- Upload Mutasi (232): no visible response, the same as desktop.
- Bank chips (236/237): selection works, but the injected mapping card pushes the CTA under the dock.
- Lanjutkan ke pencocokan (238): scan state only, with no cancel.

### Not reachable

- The Cocokkan matching table on mobile (the most likely overflow risk), step 4, Lihat Riwayat, the Lainnya bank list.

## splitbill

Scores: desktop n/a · tablet n/a · mobile 3/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: Short page (1 scroll), but the collapsed hero shows an unlabelled total and an orphan legend, settled history is ranked above active bills, the 2-column active tiles are cramped, and both sheets have a 2-line wrapped CTA and an overcrowded footer.

### Defects

- [P1] mobile 239-page.png — the collapsed hero's headline "≈ € 1.250.059,89" has no label (it is the total of active bills). The labelled stats (Sudah/Belum Dibayar) are hidden behind "Tren & detail" → add an eyebrow "Total tagihan aktif", and show "Belum dibayar ≈ € …" as a second line in the collapsed state.
- [P1] mobile 239-page.png — the "Terkumpul / Total" legend shows in the collapsed hero although the chart it describes is hidden → render the legend only inside the expanded chart.
- [P1] mobile 239-page.png — "Riwayat" (1 settled bill) is placed above "Split Bill Aktif", so the actionable bills start at y≈625 and their numbers sit under the dock in the first viewport → put Split Bill Aktif first on mobile and Riwayat last.
- [P1] mobile 240-page-scroll-1.png — the active tiles are two 158px columns: the title truncates ("Makan Malam An…"), and the amount line wraps to 3 lines ("≈ € 0,00 terkumpul / dari ≈ € 1.250.000,00 / · 3 orang") with "· 3 orang" orphaned → use full-width list rows on mobile (title, progress bar, "€ 19,96 / € 59,89", "1/3 lunas").
- [P2] mobile 240-page-scroll-1.png — the dashed "Split baru" tile occupies a full 158×128 grid cell on its own row next to empty space, duplicating the hero "Buat Split Bill" → drop it on mobile (the hero button and dock "+" already create).
- [P2] mobile 240-page-scroll-1.png — the last card "Audit QA 1 baru 0%" is a heading with the percentage glued to it and no eyebrow, so it reads as broken text → "Pengingat · Audit QA 1 — 0% terkumpul".
- [P1] mobile 244-click-tren-detail.png — the expanded hero repeats the legend in reverse order ("Terkumpul · Total" above, "Total · Terkumpul" over the plot). The y-axis label "1.250.000,00" has no currency. The "Makan" bars are invisible at that scale, so the chart shows one grey bar → one legend, and per-bill progress meters instead of a shared-scale bar chart.
- [P2] mobile 244-click-tren-detail.png — expanded, the hero is ~640px (y 135–775) and fills the entire viewport down to the dock → cap the chart at ~160px.
- [P1] mobile 241-buat-split-bill-dialog-open.png — the footer primary "Buat & Bagikan Link" wraps to 2 lines inside a 208px button → shorten it to "Buat & Bagikan", or stack the footer buttons full width.
- [P1] mobile 241-buat-split-bill-dialog-open.png — the first participant row ("Andi / EUR 0,00") is cut by the sticky footer, with no fade or scroll cue, and the sheet already starts at y=68 → add a footer top shadow or fade and 24px of bottom padding.
- [P1] mobile 243-buat-split-bill-filled.png — the participant name inputs are squeezed to ~222px by the share column. "EUR 416666,67" (no separator) takes ~110px, and the third row sits under the validation toast → put the share under the name (2-line row), formatted "€ 416.666,67".
- [P1] mobile 242-buat-split-bill-validation.png, 243 — the validation toast is placed inside the sheet at y≈697–747, over the participant rows and right above the footer → anchor sheet toasts above the sheet's top edge, or use inline errors.
- [P2] mobile 241 — under "Total Tagihan" the FX helper is 3 lines of 11px text (rate, "Nilai rupiah final…", "Disimpan sebagai IDR…"), ~50px of a 776px sheet → one line plus an ⓘ.
- [P1] mobile 245-liburan-bali-bareng3-orang-6-okt-2026lun.png — the warning box squeezes its copy into a ~115px column next to the "Atur Rekening Tujuan" button: 10 lines of text over ~200px → stack the text full width and put the button under it.
- [P1] mobile 245 — the footer has three buttons (Hapus / Tutup / Cabut Semua Link); the destructive primary wraps to 2 lines and is the only filled button → on mobile use one full-width primary (share) and move Hapus/Cabut into an overflow "⋯".
- [P2] mobile 245 — the per-participant link icons are 26×26 tap targets (smallTargets "Link untuk … 26x26") → 40×40 hit area.

### Dialogs & forms seen

- Buat Split Bill (241–243, 246–248): a bottom sheet with a sticky footer; the CTA wraps, rows are cut under the footer, the share column crushes the name inputs, the toast sits over the list, and there are 3 FX helper lines.
- Split detail (245): fits; the warning column is crushed, the footer has 3 buttons with a wrapped destructive primary, and the link icons are 26px.
- "Split baru" tile (246) opens the same sheet, which is fine.

### Not reachable

- "Custom per Orang" mode on mobile (per-row amount inputs would be even narrower), Atur Rekening Tujuan, the share sheet and the Hapus confirmation.

## warisan

Scores: desktop n/a · tablet n/a · mobile 3/2/2 (Karakter/Konsistensi/Kerapian)
Verdict: The first viewport is fine, but asset cards waste height on a separate icon-button row, the edit sheet's heir table is unusable at 390px (only one column visible), and the delete sheet has the banded gradient and a dead strip.

### Defects

- [P0] mobile 255-ubah-dialog-open.png — in the Edit sheet, the "Ahli Waris" table shows only the NAMA column. The HUBUNGAN header is clipped to "H" at the right edge, and the share/% inputs are off-screen with no scroll affordance, so the heir percentage cannot be edited on mobile → render each heir as a stacked mini-card (Nama select, Hubungan, Bagian %) in the sheet.
- [P1] mobile 255 — each heir shows a "Ana Demo" select plus a greyed duplicate "Ana Demo" input under it, which doubles the row height on mobile → one control.
- [P1] mobile 250-page-scroll-1.png — every asset card puts the toggle, ✎ and 🗑 on their own row at the bottom right, ~70px tall with ~200px empty to the left, so each card is ~220px and 3 assets take ~700px → put the actions in a "⋯" menu or the card header, and drop the row.
- [P1] mobile 249-page.png, 250 — the visibility toggle on each card has no label on mobile (desktop has none either, but on mobile it sits beside destructive buttons and reads as "enable/disable") → label it "Terlihat ahli waris" or show an eye icon chip.
- [P2] mobile 249-page.png — in the asset card, "Nilai estimasi" is indented ~40px from the value "≈ € 42.421,65" above it (value at x≈47, label at x≈86) → left-align the label with the value.
- [P2] mobile 249/250 — asset rows are grey boxes with a 1px border inside a white card (a card in a card), which eats 18px of side gutter per side at 390px → flat rows with dividers on mobile.
- [P2] mobile 249-page.png — "Belum dialokasikan" uses a bare "?" glyph with no avatar circle next to the "AD" avatar above → a dashed avatar circle.
- [P2] mobile 250-page-scroll-1.png — the edit/delete icon buttons are grey and rose filled squares, a style not used by other mobile lists (which use plain icons or "⋯") → shared icon button.
- [P1] mobile 254-click-tren-detail.png — the expanded hero repeats "≈ € 67.874,64" twice (headline and "total"). The legend truncates "Belum dialokasi…", with 63% + 38% = 101%. The hero grows to ~550px → remove the second total, let the legend wrap to 2 lines, and round consistently.
- [P1] mobile 251-tambah-aset-warisan-dialog-open.png — the footer primary "Simpan Aset Warisan" wraps to 2 lines; "Ahli Waris" heading is cut under the footer with no fade → "Simpan", plus a footer shadow.
- [P1] mobile 252-tambah-aset-warisan-validation.png, 253 — the error toast sits inside the sheet over the "Terlihat oleh ahli waris" toggle and the "Ahli Waris" section, and stays after the field is filled → inline error under Nama Aset.
- [P2] mobile 251 — 3 lines of 11px FX helper under "Nilai Estimasi" → one line.
- [P1] mobile 256-hapus-dialog-open.png — the delete bottom sheet has a dark gradient header with two hard horizontal bands (at y≈650 and y≈693) cutting through the body text, and a ~40px white dead strip under the buttons. It uses an 18px inset vs 24px on every other sheet → a flat surface, a 24px inset, and a footer padded to the safe area only.

### Dialogs & forms seen

- Tambah Aset Warisan (251–253): a bottom sheet with a sticky footer; the CTA wraps, the toast covers the toggle, the FX helper has 3 lines, and the heir section is under the footer.
- Edit Aset Warisan (255): heir table overflow (P0) and a duplicate name control.
- Hapus (256): a bottom sheet with a banded gradient, an inconsistent inset and dead space below the buttons.

### Not reachable

- Tambah Ahli Waris row add and percentage validation on mobile (the table is unreachable past column 1).

## donation

Scores: desktop n/a · tablet n/a · mobile 2/2/1 (Karakter/Konsistensi/Kerapian)
Verdict: The worst mobile layout of this set: one Riwayat row collapses its meta column to one character wide and renders ~400px of vertical letters. All names truncate to 5–6 characters, the hero chart axis is cut by the right edge, and the zakat calculator is a long stack of Rp inputs.

### Defects

- [P0] mobile 258-page-scroll-1.png, 259-page-scroll-2.png — the Rp 1.250.000 "Zakat Fitrah" row's meta column shrinks to ~10px. "10 Okt 2026, Mandiri ···5586 ···5586" renders one character per line (~35 lines, ~420px tall), and the "≈" wraps above "€ 1.250.000,00" → give the text column `min-width:0; flex:1`, move the tax chip under the name, and keep the amount `white-space:nowrap`.
- [P1] mobile 258/259 — every Riwayat title truncates to 4–9 characters ("Sede…", "Sed…", "Zakat Ma…", "Wakaf: Wa…", "Zakat Fitr…") because the "Tidak mengurangi pajak"/"Pengurang Pajak" chip (~120–160px) sits on the same row → 2-line row: name + amount on line 1, date · account · tax chip on line 2.
- [P1] mobile 258/259 — dates wrap to 2–3 lines ("20 / Agu / 2026") in the squeezed column → same 2-line row fix.
- [P1] mobile 269-click-tren-detail.png — the hero chart's right axis labels are cut by the right edge ("≈ € 1.497.234", "≈ € 998.156,4", "Avg ≈ € 250.0"; offscreen tickText) → move the axis labels inside the plot or onto the left, and use compact numbers (1,5 jt / 1.5M).
- [P1] mobile 269 — only one bar (Zakat Fitrah) is visible; "Zakat Maal" and "Wakaf" labels sit over empty space → a log scale, or a horizontal bar list per category on mobile.
- [P1] mobile 257-page.png — the zakat calculator header puts the religion select (140px) and "Simpan Agama Keluarga" (188px) side by side. The placeholder truncates to "Pilih agama kelu" and selected values clip ("Kristen (Persep", 261) → select full width on row 1, save button full width on row 2.
- [P2] mobile 257-page.png — the info ⓘ for the calculator sits alone on its own right-aligned row (~45px) between the controls and the first input → put it next to the "Kalkulator Zakat Maal" title.
- [P1] mobile 257/258 — the calculator is a full-width stack of 4 empty "(Rp)" inputs + checkbox + result + CTA, ~700px (y 358–1060), before any history → collapse the calculator to its result card with an "Hitung zakat" expander, and show Riwayat first.
- [P2] mobile 258-page-scroll-1.png — the "Laporan" link is a 55×16 tap target (smallTargets) and is prefixed by an ⓘ icon → a 36px-high text button with an arrow.
- [P2] mobile 258 — the nisab note "Nisab dihitung dari harga emas keluarga: Rp ≈ € 126,40/gram Diinput manual, per 11 Okt 2026" wraps onto 2 lines of ~11px text, with "Rp" next to "≈ €" (already logged on desktop; on mobile it is tinyText).
- [P2] mobile 266-catat-donasi-dialog-open.png — "+ Tambah ke Master Data" is a 342×18 tap target → 36px high.
- [P1] mobile 267-catat-donasi-validation.png, 268 — the error toast sits inside the sheet over the "Pengurang pajak penghasilan" toggle row and stays after a valid amount → inline error under Jumlah.
- [P2] mobile 266/271 — the 3-line FX helper under "Jumlah (Rp)" (EUR) vs a 1-line "≈ € 0,00 (mata uang tampilan)" when IDR is preselected (271): the same field has two helper layouts → one line in both.
- [P2] mobile 270-info-dialog-open.png — the info popover covers the "Tabungan & Kas" label and input → open it above the field, or inline under the title.
- [P2] mobile 259-page-scroll-2.png — the bottom card "Donasi bisa jadi pengurang pajak" is cut by the dock at the last scroll stop, with no CTA → add bottom padding and a "Buka Pusat Pajak" link.

### Dialogs & forms seen

- Catat Donasi Keagamaan (266–268): a bottom sheet that fits, with a sticky footer; there is a toast over the toggle, an 18px-high Master Data link, and 3 FX lines.
- Catat Estimasi Zakat (271–273): the same sheet, switched to IDR with a different helper layout.
- Info popover (270): covers the first input.
- Religion select (260–265): the value renders on mobile but is clipped by the 140px trigger.

### Not reachable

- Riwayat row tap/edit, "Laporan" target, "Simpan Agama Keluarga" result.

## tax

Scores: desktop n/a · tablet n/a · mobile 2/2/1 (Karakter/Konsistensi/Kerapian)
Verdict: Broken on mobile. The "Status PTKP" segmented control is wider than the card, and selecting "K/I" scrolls the whole page sideways. The page then stays shifted with its left gutter gone, and all four page-scroll stops render blank.

### Defects

- [P0] mobile 279-tab-tk-tidak-kawin.png, 281-tab-k-i-penghasilan-istri-digabung.png — the Status PTKP segmented control overflows the card: the third option "K/I (pe…" is cut at the right viewport edge. Tapping it scrolls the page horizontally ~100px (281: card title "…or PPh 21", inputs cut on the left) → on mobile use a vertical radio list or a select with the full labels "TK – Tidak kawin / K – Kawin / K/I – Penghasilan istri digabung".
- [P0] mobile 285-tab-3.png, 290-select-alas-kaki.png, 295-click-tren-detail.png, 297-click-reset.png, 298, 302, 303 — after that, the page stays horizontally offset by ~14–31px: the left gutter is gone (text at x=0), the hero is cut on the left ("ealthMe", "usat Pajak") and there is a sage strip on the right → `overflow-x: clip` on the page container and fix the segmented control width. The INDEX overflowX metric did not catch this, so verify by hand.
- [P0] mobile 275-page-scroll-1.png, 276, 277, 278 — all four page-scroll stops are empty sage background (only the "2026" select edge is visible at the top of 275). The calculator, results, TER grid, history and documents do not render at scroll time, though they appear in later click shots (297/298/302/303) → the scroll-reveal (gsap card choreography) leaves cards at opacity 0 when scrolled quickly or with reduced motion; render them visible by default and animate only `from` a visible state, or disable the reveal on mobile.
- [P2] mobile 275–278 — the body background shows hard horizontal seams (bands at y≈60/120/180/520 in the scroll shots) → a fixed full-viewport background, or a non-repeating gradient.
- [P1] mobile 274-page.png — the first viewport spends ~420px on the hero plus two separate SPT cards ("SPT 2026 Belum Lapor", "Status SPT Tahunan 2025 Sudah Lapor") plus an orphan "Buka kalkulator PPh 21" pill; the calculator starts at y≈630 → merge the two SPT statuses into one 2-column card, and drop the pill (the calculator is right below).
- [P1] mobile 274-page.png — "Perkiraan" is a 74×44 yellow blob badge centred in the hero under the subtitle, larger than the button below it → a small inline chip next to the amount.
- [P2] mobile 274-page.png — "Kalkulator Lain" is a 98×15 tap target (smallTargets) → 36px-high link button.
- [P1] mobile 295-click-tren-detail.png — the expanded hero has ~120px of dead green between "Isi penghasilan bruto…" and "Sembunyikan detail"; the SPT statuses are repeated a third time in the stats grid → remove the duplication and the spacer.
- [P1] mobile 298-click-atur-per-bulan-bonus-thr.png — the monthly bonus grid is 12 inputs in 2 columns (~6 rows × 92px ≈ 560px), labelled "1…12". Odd and even columns are vertically misaligned by ~12px (label "1" at y≈455, "2" at y≈467) → 3 columns with month names (Jan, Feb…), aligned rows, or a single repeating row with "+ bulan".
- [P2] mobile 276-page-scroll-2.png, 298 — "Atur per bulan (bonus/THR)" is a 160×17 tap target → 36px-high toggle button.
- [P1] mobile 298 — the "Rincian Tarif Progresif" table header is cut at the card edge ("Dasar Kena T…"), and the empty-state text is offset to the right → stack the table as label/value rows on mobile.
- [P2] mobile 279-tab-tk-tidak-kawin.png — "Penghasilan freelance / bebas (opsional)" and "Biaya Jabatan" sit under the dock at the bottom of the calculator, and the "▸" disclosure triangle is the native browser marker, unlike the chevron expanders elsewhere → shared expander and dock padding.
- [P1] mobile 300-tambah-penghasilan-validation.png, 301 — the raw backend toast ("occurredAt must match /^\d{4}-\d{2}-\d{2}$/…", desktop logged) wraps to 2 lines inside the sheet and covers the "Catatan" field → inline Indonesian errors.
- [P2] mobile 299-tambah-penghasilan-dialog-open.png — the native date input shows "mm/dd/yyyy" with a desktop calendar icon, and the checkbox is centred with its label wrapped under it (desktop logged); on mobile it is the only centred control in the sheet → shared date picker, left-aligned checkbox row.
- [P2] mobile 303-click-lapor-spt-tahunan.png — the action row wraps 2+1 ("Lapor SPT Tahunan" + "Unduh Ringkasan (CSV)" / "Unduh Ringkasan (PDF)"). The CSV button touches the right edge, and the dark button has a drop shadow → stack 3 full-width buttons, or primary + "Unduh ▾" menu.
- [P2] mobile 303 — the Riwayat Catatan Pajak meta wraps ("Bruto: Rp 320.000.000, Zakat: / Rp 0"), and the Dokumen Pajak empty state uses a tofu glyph at 24px (desktop logged the tofu) → one meta line ("Bruto Rp 320 jt · Zakat Rp 0").
- [P2] mobile 302-click-simpan-omzet-tahun-ini.png — the "Omzet disimpan" toast covers the "Ringkasan pajak tahunan" heading, and the next card's "Rp 0" peeks out between toast and dock → toasts above the dock with a gap, short-lived.

### Dialogs & forms seen

- Simpan ke Catatan Pajak (296): a bottom sheet that fits, with a sticky footer; developer copy and the garbled subtitle carry over from desktop.
- Tambah penghasilan (299–301): a bottom sheet; the raw regex toast sits inside the sheet, with a native date input and a centred checkbox. The sheet top jumps from y=182 to y=242 when the Jenis changes and the checkbox disappears.
- Status PTKP / Tanggungan segmented controls (279–285): PTKP overflows and causes horizontal page scroll; Tanggungan 0–3 fits.
- Tahun Pajak and KLU selects (286–294): the native select works; the page is still shifted horizontally.

### Not reachable

- The Isi omzet bulanan expander, Penghasilan freelance expander, "+ Upload" document sheet, "Kalkulator Lain" target, and any page-scroll view with content rendered (all scroll stops blank).

## quickinput

Scores: desktop n/a · tablet n/a · mobile 3/2/2 (Karakter/Konsistensi/Kerapian)
Verdict: The page meant for fast input buries its 12 shortcuts below the fold under "Entri Terakhir". The grid is a 6-row, 2-column stack of tall tiles (~3 screens of scroll). The Tambah Transaksi sheet uses a different shell with a clipped account carousel, and every other sheet is mostly FX boilerplate.

### Defects

- [P1] mobile 306-page.png — the first viewport (after the hero) is entirely "Entri Terakhir" (5 rows plus "Lihat Semua"). Not one shortcut tile is visible until scroll 1, although the page is "Input Cepat" → put the shortcut grid directly under the hero, and move Entri Terakhir below or cut it to 3 rows.
- [P1] mobile 307-page-scroll-1.png, 308-page-scroll-2.png — the 12 shortcut tiles are 158×130px in 2 columns (6 rows, ~790px). Each tile has a 36px icon, title and subtitle with ~40px of internal dead space → a 3- or 4-column icon grid (icon + 1-line label, ~88px tiles) so all 12 fit in one viewport; drop the subtitles on mobile.
- [P2] mobile 307 — the tile subtitles are not top-aligned: "GoPay, OVO, DANA" sits ~30px lower than "Tambah rekening bank" in the same row (desktop also) → top-align them under the title.
- [P2] mobile 308-page-scroll-2.png — the closing card "Input cepat, tanpa muter-muter" is marketing copy that adds a 4th scroll-worthy block → remove it on mobile.
- [P1] mobile 312-click-tren-detail.png — the hero chart's right axis label "Avg 4 transaksi" overprints "3 transaksi" and is clipped at the right edge ("Avg 4 transaks"); the headline is still "12 Pintasan tersedia" → axis labels inside the plot, and a meaningful headline ("2 transaksi hari ini").
- [P1] mobile 309-catat-transaksi-dialog-open.png — Tambah Transaksi uses a different sheet shell from every other sheet: a dark gradient header band, an 18px inset instead of 24px, a close button overlapping the header's bottom edge (y 80–124 vs header 68–116), and an extra "Simpan & tambah lagi" link under the footer (footer ~110px) → the shared `.dialog` sheet; put "Simpan & tambah lagi" as a secondary option in the footer.
- [P1] mobile 309 — the Akun carousel shows 2 cards plus a clipped third ("BN…", "Rp…") at the right edge. In the Mandiri card the balance sign "-" sits alone on one line and "Rp 24.966.425.000" on the next, and the balances are in Rp next to a € amount → 2 full cards per view or a select, the sign on the same line, and balances in the account currency.
- [P1] mobile 309 — the amount input has both a dark focus ring and a separate lime 3px underline under the row, a double focus indicator unique to this sheet → one focus style.
- [P2] mobile 309 — category tiles at 82px wide truncate to "Asset & Other…" twice, so the two are indistinguishable → shorter category names, or a 3-column grid with 2-line labels.
- [P2] mobile 310-catat-transaksi-validation.png — the empty submit shows nothing on mobile either; the shot is identical to 309 (desktop logged) and is worse here because Akun/Kategori are below the fold → scroll to and mark the first invalid field.
- [P1] mobile 320–333 (Rekening, E-Wallet, Aset, Liabilitas, Asuransi, Tujuan) — every money field carries 3 lines of FX helper (4 lines once filled: "≈Rp 25.046.175.000" + 3). Liabilitas and Asuransi have 2 such fields (8 lines) and Tujuan has 3 (12 lines), so the sheet is ~40% boilerplate and needs 2 scrolls (331/333) → one line "≈ Rp … · kurs ECB 9 Okt" with an ⓘ for the rest.
- [P1] mobile 324-asetproperti-kendaraan-filled.png, 327, 330 — the generic error toast "Terjadi kesalahan, silakan coba lagi" sits inside the sheet over the focused field (No. Dokumen / Sisa Tenor / Jatuh Tempo) → toast above the sheet, plus inline errors.
- [P2] mobile 322 vs 325 vs 331 — sheet height varies per form (top at y=273, 130, 68), and the sheet jumps between states (325→327: 130→96; 322→324: 273→256) → a stable max-height sheet or animated height.
- [P2] mobile 333-tujuangoal-keuangan-baru-filled.png — the scrolled sheet body slides under the title with no divider or shadow, so the "Target Jumlah" label is cut in half under the header → a sticky header with a bottom hairline when scrolled.
- [P2] mobile 332-tujuangoal-keuangan-baru-validation.png — the only inline error ("Nama Tujuan wajib diisi.") leaves the input border neutral → red border plus the message.
- [P2] mobile 321-e-walletgopay-ovo-dana-dialog-open.png — "Pemilik" is an empty select with no placeholder (desktop logged); on mobile it is the last visible field, right above the footer, and looks like a blank bar → a placeholder "Pilih pemilik".
- [P2] mobile 320, 321 — "+ Tambah ke Master Data" is a 342×18 tap target → 36px high.
- [P2] mobile 319-nav-investasisaham-reksa-dana-emas.png, 334-nav-anggarankategori-budget.png, 337-nav-split-billpatungan-grup.png — tiles that navigate keep the quickinput scroll offset: the target page opens with its title and the top of its hero cut off (the hero starts above y=0) → scroll to top on route change.

### Dialogs & forms seen

- Tambah Transaksi (309–311, 316–318): a bottom sheet but a different shell (dark header, 18px inset, extra footer link); clipped account carousel, Rp balances, double focus indicator, and silent validation.
- Tambah Rekening Bank (320) / E-Wallet (321): bottom sheets; 3-line FX block, an 18px-high Master Data link, and an empty Pemilik select.
- Tambah Aset (322–324), Liabilitas (325–327), Asuransi (328–330): bottom sheets; FX boilerplate ×1–2, and a generic toast over the focused field.
- Tambah Tujuan Keuangan (331–333): bottom sheet; 12 lines of FX boilerplate, a header with no scroll divider, and an inline error without a red border.

### Not reachable

- The Masuk/Transfer/Kartu tabs, the Lampiran expander, "Lihat semua" categories, "Simpan & tambah lagi", and Rekening/E-Wallet validation and submit on mobile.
