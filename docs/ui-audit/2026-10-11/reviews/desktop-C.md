## rekening

Scores: desktop 4/3/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Strong card-wallet identity, but the hero chart clips its own axis, the "Milik saya" filter contradicts the hero, and the Catat Transaksi dialog fails silently with IDR chips beside € values.

### Defects

- [P0] desktop 137-catat-transaksi-validation.png — empty submit gives no feedback: no field errors, no toast, and the shot is identical to 136 → mark Akun and Kategori as required with inline errors, and focus the first invalid field.
- [P0] desktop 139-catat-transaksi-submitted.png — submitting the filled form (no Akun or Kategori picked) does nothing: the dialog stays open, with no error and no success toast → show inline "Pilih akun"/"Pilih kategori" errors; on success, close and toast.
- [P0] desktop 140-nav-lihat-mutasi.png — Transaksi hero shows "Rp 7.364,66" (Rp prefix on a € amount) next to "≈ € 9.568,09" KPIs → use the account currency symbol "≈ €".
- [P1] desktop 136/137/138-catat-transaksi-\*.png — Akun chips list balances as "Rp 128.450.000 / Rp 81.000.000 / Rp 32.000.000" while the whole page is in € → format the chip balances in the display currency (≈ €6.410,66 …).
- [P1] desktop 130-page.png, 131, 134, 142 — hero chart y-axis labels are clipped at the card edge ("≈ € 7.486,1", "≈ € 4.990,7", "Avg ≈ € 4.0") → reserve a right gutter or use compact ticks (€7,5 rb).
- [P1] desktop 142-opsi-rekening-menu-open.png — the "Avg ≈ € 3.0" label overlaps the "≈ € 2.495" tick, and the chart repeats the x-label "BCA" for two accounts (one bar empty) → de-collide the avg label from the ticks and label bars by account name/last-4, not bank.
- [P1] desktop 130-page.png — "Daily average ≈ € 4.016,75" is total ÷ account count (12.050,24/3; 3.012,56 = /4 in 142), not a daily average; it is also English in an Indonesian UI, and the "BCA – BNI" subline is meaningless → relabel "Rata-rata per rekening" or compute a real daily average.
- [P1] desktop 133-tab-milik-saya.png — the hero still shows "≈ € 12.050,24 · 3 Rekening Terhubung" while the list says "Belum ada rekening yang menjadi milikmu." → scope the hero to the filter or label it "Semua rekening".
- [P2] desktop 133-tab-milik-saya.png — two stacked empty states (dashed "Belum ada rekening…" banner plus the "Tambah rekening baru" tile under a "Semua rekening" heading that contradicts the active "Milik saya" tab) → show one empty state and retitle the section per tab.
- [P2] desktop 130-page.png — the "Aksi cepat" card is 170px tall beside a 395px hero, leaving a large empty sage hole under it → stretch it, or fill the column (recent mutasi, reconciliation status).
- [P2] desktop 130-page.png — hero card casts a visible drop shadow, against the no-shadow design rule → remove it.
- [P2] desktop 130-page.png (all pages) — AI floating button at bottom-right is cut by the viewport edge (offscreen=I) → inset it by 16–24px.
- [P2] desktop 131-page-scroll-1.png — tax note hardcodes "Simpanan dengan pokok ≤ Rp 7.500.000" on an all-€ page → add "(≈ € 374)", or state explicitly that this is an IDR statutory threshold.
- [P2] desktop 136-catat-transaksi-dialog-open.png — Akun chip "BCA Tahapan ···9…" is truncated, and the 4th chip is cut at the right edge under the chevron button → widen the chips or wrap to a grid; keep the next-arrow outside the content.
- [P2] desktop 136-catat-transaksi-dialog-open.png — Jumlah shows two focus indicators (a dark box border plus a lime underline below it) → keep one.
- [P2] desktop 135-tambah-dialog-open.png vs 136 — "Tambah Rekening Bank" is a right side-sheet with a white header; "Tambah Transaksi" is a centred modal with a green header; "Ubah tampilan kartu" (141) is a side-sheet with a green header → one dialog pattern and header style.
- [P2] desktop 135-tambah-dialog-open.png — "Saldo Saat Ini" input has a grey fill while every other input is white, and the form shows no required markers, unlike Tambah Transaksi's red asterisks → unify the input fill and required-field marking.
- [P3] desktop 136-catat-transaksi-dialog-open.png — "Lainnya Pengeluaran" wraps to 2 lines, pushing its icon up out of line with the row; Hiburan, Audit and Lainnya share the same generic link icon → shorten the label and give the categories distinct icons.
- [P3] desktop 141-ubah-tampilan-kartu-dialog-open.png — the preview masks the number as "···9010" while the list cards show "\*\*\*\* 9010" → use one mask format.
- [P3] desktop 142-opsi-rekening-menu-open.png — "Ubah tampilan kartu" wraps inside the kebab menu, and the menu covers the card balance → widen the menu or align it outside the card.

### Dialogs & forms seen

- Tambah Rekening Bank: side-sheet layout ok; grey saldo field and no required markers; validation/submit not captured.
- Tambah Transaksi (Catat transaksi): no field-level validation, silent failure on submit, Rp balances on account chips, truncated/clipped chips.
- Ubah tampilan kartu: ok apart from header style and mask inconsistency.
- Opsi rekening menu: label wraps, overlaps balance.

### Not reachable

- Tambah Rekening validation/submitted states, Edit and Hapus rekening dialogs, the Reconsiliasi quick action.

## investasi

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The hero bento is on-brand, but the chart is unreadable, the type filter sits orphaned at the bottom and does not filter the summary, and the create form labels Rp on € inputs and then fails with a generic error.

### Defects

- [P0] desktop 157-catat-investasi-submitted.png — submit returns HTTP 400 surfaced only as "Terjadi kesalahan, silakan coba lagi"; no field is flagged and the toast overlaps the Batal button → map the 400 message to the offending field, and position the toast clear of the sheet footer.
- [P1] desktop 154/155/156-catat-investasi-\*.png — labels say "Harga Beli per Unit (Rp)" and "Harga Saat Ini (Rp, opsional)" while the input prefix is € and the picker says EUR; placeholders "contoh: 9500 / 15250" are IDR-scale → label "(EUR)" or a neutral "Harga beli per unit", with EUR-scale placeholders.
- [P1] desktop 155-catat-investasi-validation.png — validation is the browser-native English tooltip "Please fill out this field."; no styled inline error and no required markers → custom Indonesian inline errors plus asterisks.
- [P1] desktop 143-page.png — chart y-axis top label is clipped on the left ("€ 24.641,99" loses "≈"), and the Modal/Nilai legend is rendered twice (top-right and top-left) → one legend; give the axis a left gutter.
- [P1] desktop 143-page.png — the linear scale is dominated by Manulife, so the Bank and Telkom bars are 3–5px stubs; x-labels "Bank"/"Telkom" are truncated names → use log/percent-return bars or a horizontal bar list with full tickers (BBCA, TLKM, MANU).
- [P1] desktop 144-page-scroll-1.png, 146–152 — the instrument filter is a single orphaned pill ("Semua", "Saham", "Reksa Dana"…) at the very bottom of the page, below the tax card, showing only the active value → put a segmented tab bar above Portofolio, as Liabilitas does.
- [P1] desktop 148-tab-obligasi.png, 152-tab-deposito.png — the hero still says "3 posisi tercatat · ≈ € 25.673,83", and Kepemilikan still lists Reksa Dana/Saham, while Portofolio says "0 posisi"; the chart shows "Belum ada investasi untuk digambar" with the legend still visible → scope all summary blocks to the filter or label them "Semua"; hide the legend on the empty chart.
- [P1] desktop 143-page.png — "Perubahan Hari Ini —" / "Belum ada snapshot harga hari ini" contradicts "Terakhir sinkron 11 Okt 2026, 02.28" (today) in the side card → compute the day change from the sync, or explain why it is missing.
- [P2] desktop 147-tab-reksa-dana.png — the filter pill renders square-cornered and unpadded (different from the "Semua" pill in 144), and the page is scrolled 28px so the topbar is cut → keep the pill styling stable; do not scroll on tab change.
- [P2] desktop 143-page.png — the three row actions use three different button treatments (outline swap, grey-filled edit, pink-filled delete) → one icon-button style, with destructive colour only on hover/confirm.
- [P2] desktop 143-page.png — the Kepemilikan card has ~200px of dead white space under two rows; the "Saham & kripto delayed" card is mostly empty → size the cards to content or add content (allocation target, top movers).
- [P2] desktop 153-click-perbarui-harga.png — "Memuat ulang harga terbaru…" toast uses a check (success) icon for an in-progress state, and no completion toast follows → spinner icon, then "Harga diperbarui" or an error.
- [P2] desktop 156-catat-investasi-filled.png — "Jumlah Unit Penyertaan" shows "1250000" unformatted while the price field shows "1.250.000" → apply thousand separators consistently.
- [P2] desktop 154-catat-investasi-dialog-open.png — the sheet is ~680px wide vs ~460px for Tambah Rekening/Aset; the price input has a grey fill unlike other inputs → standard sheet width and input fill.
- [P2] desktop 143-page.png — the tinyText=2 hits are the "Yahoo Finance" source and the badge text at ~10px → raise to 11px or more.
- [P3] desktop 143-page.png — "Selengkapnya" is a black underlined link while "Dividen & bunga tercatat di Transaksi →" is green with no underline → one link style.
- [P3] desktop 158-click-untung-modal-1-031-84-24-641-99.png — clicking the Untung/Modal KPI does nothing visible, though it reads as interactive → either a breakdown popover or no click affordance.

### Dialogs & forms seen

- Catat Investasi: (Rp) labels on € inputs, native English validation, unformatted unit count, 400 error with generic toast; nothing created.

### Not reachable

- Detail ("Lihat Detail"), Edit, Hapus, and Transfer/swap dialogs on portfolio rows; Kripto/Emas/Lainnya tabs were captured but show only the same empty state.

## aset

Scores: desktop 3/3/3 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Coherent bento with honest composition maths, but the hero repeats its total, the hide toggle leaks values, and every asset form mixes Rp labels with EUR inputs and falls back to native English validation.

### Defects

- [P1] desktop 159-page.png — hero shows "≈ € 94.302,07" twice (headline and again above "Komposisi aset") → drop the second, or show a delta/net worth there.
- [P1] desktop 161-click-sembunyikan-jumlah.png — "Sembunyikan" blurs only the list values; the hero, the KPI column (12.382,13 / 25.673,83 / 56.246,11) and every composition row stay fully visible → mask all amounts on the page.
- [P1] desktop 162/163/164-tambah-aset-\*.png — "Nilai Aset (Rp)" and the "Rp per tahun" toggle sit on a € input with an EUR picker; the placeholder "cth. 200.000.000" is IDR-scale → label the display currency; use a "Nominal per tahun" toggle and an EUR-scale placeholder.
- [P1] desktop 163-tambah-aset-validation.png, 173 — validation is the native English "Please fill out this field." with no inline error and no required markers → custom inline Indonesian errors.
- [P1] desktop 165-tambah-aset-submitted.png, 175 — "Perubahan Nilai per Tahun (%)" accepts 1250000 and only the native English tooltip "Value must be less than or equal to 100." stops it; the native spinner appears → clamp/validate inline in Indonesian; hide the spinner.
- [P1] desktop 166/167/169/171-\*-dialog (Edit Aset Fisik) — the Dokumen field is the raw browser "Choose File | No file chosen" control → styled upload dropzone/button as elsewhere.
- [P2] desktop 175-aset-baru-submitted.png — the manifest records the toast "Aset berhasil diperbarui" while the create form is still blocked by validation, so a success message shows for a record that was not saved → only toast after a successful save, with the right verb ("ditambahkan").
- [P2] desktop 166-rumah-depok-…png vs 162 — Edit opens with an IDR currency/"Rp" prefix while Tambah defaults to EUR/"€" → the same default currency in both.
- [P2] desktop 159-page.png — "Dana & rekening · 7 akun" lists only 5 rows with no "+2 lainnya" hint → state "5 dari 7" or show all.
- [P2] desktop 160-page-scroll-1.png — "Semua rekening" and "Semua dana" buttons are stacked flush with no gap and look like one split control → put them side by side, or space them.
- [P2] desktop 159-page.png — the "Total pakai nilai tercatat" card is a title plus a text block at half the card width, then ~200px of empty space; the title is unclear → rename it (e.g. "Nilai tercatat, bukan taksiran") and fold it into the hero as a footnote.
- [P2] desktop 159-page.png — the Investasi card leaves ~90px of empty space above "Semua investasi", and "RD-MANULIFE-GROWTH · Manulife Saham Andalan" wraps to two lines → show the name only, with the code as a subline.
- [P2] desktop 168-hapus-dialog-open.png — the confirm dialog puts title and description inside a green gradient header with a hairline cutting through it, then an empty white body holding only buttons → white body with the description, header divider removed, consistent with the other dialogs.
- [P3] desktop 160-page-scroll-1.png — subtitle "4 · Ketuk kartu untuk ubah" uses touch wording on desktop, and the cards also carry separate edit/delete/open icons → "Klik kartu untuk ubah", or drop the hint.
- [P3] desktop 166-…png — dialog title "Edit Aset Fisik" (English verb) while the page uses "Ubah" elsewhere → "Ubah Aset Fisik".

### Dialogs & forms seen

- Tambah Aset Fisik (hero button): Rp labels on € input, native validation, % field unbounded until native tooltip; not created.
- Edit Aset Fisik (Rumah Depok/Toyota/Emas): IDR default vs EUR on create, raw file input, English "Edit".
- Hapus "Rumah Depok": layout issue in header/body split; confirm not executed.
- Aset baru tile: same as Tambah Aset Fisik, same defects.

### Not reachable

- Successful asset creation (the created record never appeared in the list); the MacBook card dialog (170) was skipped as near-identical.

## liabilitas

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The page reads well at a glance, but the projection chart is in unlabeled Rupiah millions beside € totals, filtered empty states claim no liabilities exist, and the create form crushes its amount inputs and ends in a raw 500.

### Defects

- [P0] desktop 187-tambah-liabilitas-submitted.png — submit with "Bunga Anuitas/Tahun (%)" = 1250000 returns HTTP 500 shown as the raw English toast "Internal server error" → validate rate (0–100) client- and server-side; show an Indonesian inline error.
- [P1] desktop 177-page-scroll-1.png — "Proyeksi Sisa Utang 6 Bulan" y-axis reads 600M/400M/200M (IDR millions, no unit) while the page total is ≈ € 21.026,16 → ticks in display currency (≈ € 30 rb / € 20 rb …).
- [P1] desktop 176-page.png — the hero chart shows two legends in opposite order ("Dibayar • Total" top-right, "Total • Dibayar" top-left), and the top y-label "€ 22.458,52" is clipped on the left → one legend; give the axis a gutter.
- [P1] desktop 180-tab-pinjaman-pribadi.png, 183-tab-lainnya.png — a filtered tab says "Belum ada liabilitas. Tambahkan kartu kredit atau pinjaman kamu." while 3 liabilities exist; the hero, chart and projection stay unfiltered → "Tidak ada Pinjaman Pribadi" plus a CTA, with summary blocks scoped or labelled "Semua".
- [P1] desktop 184-tambah-liabilitas-dialog-open.png, 186 — the two-column money inputs are crushed by the EUR pickers: values/placeholders read "30.00", "1.250" (real value 1.250.000) → stack amount fields full-width, or move the currency picker into the input suffix.
- [P1] desktop 184-tambah-liabilitas-dialog-open.png — labels "Total Utang / Limit (Rp)", "Sisa Tagihan (Rp)", "Min. Bayar (Rp, opsional)" and "Angsuran/Bulan (Rp)" sit on € inputs; the "800.000" placeholder is IDR-scale → display-currency labels and placeholders.
- [P1] desktop 185-tambah-liabilitas-validation.png — native English "Please fill out this field." tooltip; no inline errors or required markers → custom inline errors.
- [P1] desktop 176-page.png — the "Detail" button stacks its icon above its label (a two-line pill) while "Bayar" is icon-inline → same inline icon-label button for both.
- [P2] desktop 184-tambah-liabilitas-dialog-open.png — the 4-line FX helper ("1 EUR = Rp … Disimpan sebagai IDR…") repeats under every money field (4×), wrapping awkwardly in half-width columns → show it once per section.
- [P2] desktop 184-tambah-liabilitas-dialog-open.png — fieldset legends "Identitas/Nominal/Bunga & Tenor" sit on the border line, with nested bordered cards inside the sheet; no other dialog uses this pattern → plain section headings as in Tambah Aset.
- [P2] desktop 176-page.png — card title "Kredit Kendaraan T…" is truncated even though the badge leaves room → wrap to two lines, or move "Jatuh Tempo" under the title.
- [P2] desktop 176-page.png — credit-card "Penggunaan Limit 57%" uses the same lime progress bar as "Progres Pelunasan" (positive) → a neutral/amber utilisation scale.
- [P2] desktop 177-page-scroll-1.png — the projection's 0-based axis turns a ~5% decline into a flat line across a 300px-tall card → tighter domain or a smaller card with start/end values.
- [P2] desktop 176-page.png — the Rasio utang card has ~130px of empty space below one line of copy; the "Semua liabilitas berjalan lancar" card text wraps at half width → content-sized cards; let the text span the full width.
- [P2] desktop 180-tab-pinjaman-pribadi.png — the empty-state text sits flush under "0 liabilitas" with no spacing, icon or CTA → padded empty-state block.
- [P2] desktop 176-page.png — the "Jatuh Tempo 27 Okt" badge on KPR is green-filled while the others are outlined, with no visible meaning → tie the fill to a state (paid/overdue) and add a legend, or keep all outlined.
- [P3] desktop 176-page.png — the sidebar nests Aset and Liabilitas under "Investasi" → its own "Kekayaan bersih" group, or top-level items.

### Dialogs & forms seen

- Tambah Liabilitas: crushed amount inputs, Rp labels on €, native validation, unbounded % field leading to a raw 500 toast; nothing created.

### Not reachable

- The Detail, Bayar and kebab menus on liability cards; edit/delete liability; the Rasio utang info tooltip.
