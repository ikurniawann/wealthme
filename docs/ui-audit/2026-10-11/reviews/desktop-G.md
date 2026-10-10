## tax

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The hero and card shell are on-brand. The calculator body reads like an unfinished form port: segmented controls collide, glyphs fall back to tofu boxes, raw backend validation strings show up as toasts, and the hero ignores the year the user picks.

### Defects

- [P0] desktop 305-tambah-penghasilan-validation.png — An empty submit raises the toast `occurredAt must match /^\d{4}-\d{2}-\d{2}$/ regular expression`, a raw English backend regex, and marks no field → validate on the client and show an inline Indonesian error under "Tanggal diterima" / "Jumlah bruto".
- [P0] desktop 307-tambah-penghasilan-submitted.png — The submit raises the toast `rateBpsOverride must not be greater than 10000` (internal field name, basis points) after 1250000 was typed into "Tarif sendiri (%)" → cap the input at 0–100 % on the client and show "Tarif maksimal 100%" inline.
- [P1] desktop 280-page.png, 284–290 tab-\*.png — The "Status PTKP" and "Tanggungan (0–3)" segmented controls share one track. The "0" chip sits on top of "K/I (penghasilan i…)", whose label is truncated and overprinted → give each control its own row/track and show the full K/I label (or "K/I" plus a tooltip).
- [P1] desktop 280-page.png — The hero says "Perpuluhan Pengurang Pajak: –" while the calculator field "Perpuluhan (pengurang)" on the same screen shows 1.750.000 → bind the hero to the same value.
- [P1] desktop 293-select-2024.png, 300-click-tandai-sudah-lapor.png — With "Tahun Pajak" set to 2024, the hero still says "Estimasi Pajak Terutang 2026" and the "SPT 2026" card stays put → make the hero/status cards follow the selected year or label them as current year explicitly.
- [P1] desktop 283-page-scroll-3.png, 309-click-lapor-spt-tahunan.png — The "Riwayat Catatan Pajak" row icons and the "Dokumen Pajak" empty-state icon render as tofu boxes (missing glyph) → use the lucide icon set used everywhere else.
- [P1] desktop 280-page.png, 302-click-reset.png — The PPh 21 result card on the right is about 250px of blank white above a bottom-anchored "Rp 0" block → top-align the result, or fill the card with a breakdown or an empty state.
- [P1] desktop 280-page.png — The hero's dark left panel is mostly empty: "Belum ada PKP" floats mid-card with about 180px of dead green below it → shrink the hero, or put a real empty-state CTA ("Isi penghasilan bruto") in it.
- [P1] desktop 301-simpan-ke-catatan-pajak-dialog-open.png — The drawer shows the developer note "Nilai dikirim sebagai string angka murni, titik ribuan hanya untuk tampilan." → remove the implementation copy.
- [P1] desktop 301-simpan-ke-catatan-pajak-dialog-open.png — The subtitle "Catatan pajak tahun akan dibuat/diperbarui dengan angka di bawah ini: 2024" is garbled (the year is dangling at the end), and saving is allowed with Penghasilan bruto Rp 0 → "Catatan pajak 2024 akan dibuat…", and block saving an all-zero record.
- [P1] desktop 309-click-lapor-spt-tahunan.png — Clicking "Lapor SPT Tahunan" gives no visible feedback: no navigation, toast or dialog. The label promises an action → open Coretax in a new tab or show what happens.
- [P1] desktop 304-tambah-penghasilan-dialog-open.png — The "Diinvestasikan kembali di Indonesia ≤ 3 tahun" checkbox is centred, with its label wrapped below it, orphaned between left-aligned fields → use a left-aligned checkbox with an inline label like the other checkboxes ("NIK/NPWP sudah tervalidasi").
- [P1] desktop 303-click-atur-per-bulan-bonus-thr.png — In the monthly grid, the column labelled "1" sits about 12px higher than "2/3/4" (label and input misaligned), and months are numbered rather than named → align the grid and use Jan…Des.
- [P2] desktop 280–311 all — The whole page is in hardcoded "Rp" (hero "Rp 0", PTKP "Rp 54.000.000", history "Bruto: Rp 320.000.000"), while the account currency is EUR and every other page shows "≈ €". The page never says the values are IDR by law → add an "IDR (wajib pajak Indonesia)" note or a ≈ € secondary value.
- [P2] desktop 280-page.png — SPT status is shown twice: the hero right column ("SPT 2026 Belum Lapor", "Status SPT Tahunan 2025 Belum Lapor") repeats the two white cards beside it → keep one.
- [P2] desktop 280-page.png — "Buka kalkulator PPh 21" is an orphan pill floating right in an 80px gap between the hero row and the calculator → put it in the card header or remove it.
- [P2] desktop 280-page.png — "Tandai Sudah Lapor" is a hairline full-width 24px pill, unlike every other button (dark filled / outlined 40px) → use the standard secondary button.
- [P2] desktop 280-page.png, 281-page-scroll-1.png — Label weights differ inside one form: "Penghasilan Bruto/Tahun (Rp)" and "Biaya Jabatan (otomatis)" are regular, while "Iuran pensiun…", "Penghasilan neto lain" and "Gaji bruto per bulan" are bold → one label style.
- [P2] desktop 280-page.png, 281-page-scroll-1.png, 282-page-scroll-2.png — The hero card and the "Simpan ke Catatan Pajak", "Tambah penghasilan" and "Simpan omzet tahun ini" buttons have drop shadows, against the no-shadow design intent → remove them.
- [P2] desktop 282-page-scroll-2.png — In "Ringkasan pajak tahunan", the column "PPh orang pribadi" holds a sentence where "Pajak final"/"PPh final UMKM" hold Rp values, so the columns do not line up as a stat row → show "Rp 0 · belum dihitung" as the value and keep the help text below.
- [P2] desktop 283-page-scroll-3.png — In the 2025 row, the "Belum Lapor" badge and the "Tandai Lapor" button touch with no gap → add 8px spacing.
- [P2] desktop 308-click-simpan-omzet-tahun-ini.png — "Simpan omzet tahun ini" saved with no monthly omzet entered and toasted "Omzet disimpan" → disable it until a value exists.
- [P2] desktop 304-tambah-penghasilan-dialog-open.png vs quickinput 336/340 — "Tanggal diterima" is a native US `mm/dd/yyyy` input, while other dialogs use the custom "Pilih tanggal" picker with "10 Oktober 2026" → use the shared date picker.
- [P2] desktop 280–311 — The AI floating button is cut by the right viewport edge (offscreen) and overlaps the right edge of the "Unduh Ringkasan (PDF)" button → inset it 16px.
- [P3] desktop 302-click-reset.png — The "Perhitungan direset" toast has no icon, while the other toasts have a check icon → make toasts consistent.
- [P3] desktop 310/311-click-unduh-ringkasan-\*.png — Clicking CSV/PDF gives no visible confirmation → add a "Mengunduh…" toast.

### Dialogs & forms seen

- Simpan ke Catatan Pajak (drawer): developer copy leaks in, the subtitle is garbled, an all-zero save is allowed, and there is large dead space.
- Tambah penghasilan (drawer): no inline validation; raw backend regex/field-name errors appear as toasts; the centred orphan checkbox; native US date input; the percent field accepts 1,250,000.
- Tandai Sudah Lapor (inline action): works and the toast shows, but there is no undo.

### Not reachable

- "Isi omzet bulanan" expander contents, "Penghasilan freelance / bebas (opsional)" expander, "+ Upload" document dialog, "Kalkulator Lain" link target.

## quickinput

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The shortcut grid and hero are on-brand. Every create flow fails the basics, though: no inline validation, saves fail silently or with generic errors, the hero numbers contradict each other, and dialogs mix three different shells.

### Defects

- [P0] desktop 317-catat-transaksi-submitted.png, 324-transaksipemasukan-pengeluaran-submitted.png — Pressing Simpan with no Akun or Kategori selected does nothing: no toast, no field error, and the dialog stays identical → mark Akun\*/Kategori as required inline ("Pilih akun") and scroll to the first error.
- [P0] desktop 312-page.png — The hero numbers contradict each other: "Daily average 4 transaksi" and an "Avg 4" line, against "Transaksi minggu ini 73" (≈10/day). The bars total only about 27 → compute both from the same window, or label which window each uses.
- [P1] desktop 315-catat-transaksi-validation.png — An empty submit shows no error at all. The shot is identical to 314 → show inline errors under Jumlah/Akun.
- [P1] desktop 329-asetproperti-kendaraan-validation.png, 333-liabilitasutang-cicilan-validation.png, 337-asuransitambah-polis-validation.png — An empty submit only toasts the generic "Terjadi kesalahan, silakan coba lagi", with no field marked → validate on the client with per-field messages (as Tujuan does: "Nama Tujuan wajib diisi.").
- [P1] desktop 330/334/338-\*-filled.png — The stale error toast from the empty submit stays on screen while the form is valid and filled → dismiss it on edit.
- [P1] desktop 339-asuransitambah-polis-submitted.png — The 409 shows as a bare "Data sudah ada", with no hint which field duplicates (Nama Polis?) → use an inline error on the conflicting field.
- [P1] desktop 343-tujuangoal-keuangan-baru-submitted.png — "Tanggal Auto-debit (1-28)" accepts 1250000, and the server rejects it with the generic "Terjadi kesalahan" → clamp the input to 1–28 and show an inline message.
- [P1] desktop 314-catat-transaksi-dialog-open.png, 316-catat-transaksi-filled.png — The Akun cards show "Rp 128.450.000", "-Rp 24.966.425.000" and "Rp 32.000.000" next to a € amount field set to EUR (hardcoded Rp next to €) → show balances in the account currency ("≈ € …").
- [P1] desktop 314-catat-transaksi-dialog-open.png — Kategori tiles are truncated ("Asset & Other Insurance: Asuran…", "Asset & Other Insurance: Audit Q…"), and auto-generated English category names appear in Indonesian UI → shorten or rename the categories, and add a title tooltip.
- [P1] desktop 314-catat-transaksi-dialog-open.png — The Akun carousel cuts the first card name ("BCA Tahapan ···9…") and shows a clipped sliver of a fourth card ("C") under the next arrow → fit three full cards or use a select.
- [P1] desktop 312-page.png — In the hero chart, the "Avg 4 transaksi" label overprints the "3 transaksi" axis label, and the right axis labels ("12 transaksi"…) cross the hero's vertical divider → move the avg label inside the plot and give the axis its own gutter.
- [P1] desktop 340-tujuangoal-keuangan-baru-dialog-open.png — The "Ikon" picker button renders a tofu box (missing glyph) → render the selected lucide icon.
- [P2] desktop 314 vs 326/328/332/336/340 — Three dialog shells coexist. "Tambah Transaksi" is a centred modal with a dark-green header band. Rekening/E-Wallet/Aset/Liabilitas/Asuransi/Tujuan are white right drawers with a plain title → pick one pattern for create forms.
- [P2] desktop 326–343 — Every money field carries three lines of FX boilerplate ("1 EUR = Rp 20.036,94 · ECB 9 Okt 2026 / Nilai rupiah final dihitung server saat disimpan. / Disimpan sebagai IDR, ditampilkan dalam EUR.") under each amount. That repeats 2–3× per form (Liabilitas, Asuransi, Tujuan), and the wording is engineering copy → show it once per form, collapsed behind an info icon.
- [P2] desktop 326-rekening-banktambah-rekening-bank-dialog.png, 328 — Money inputs have a grey-filled background while text inputs are white → one input surface.
- [P2] desktop 326/327 — "Pemilik" is an empty select with no placeholder or default → "Pilih pemilik" or default to the current user.
- [P2] desktop 334-liabilitasutang-cicilan-filled.png — The form accepts Cicilan/Bulan equal to Total Utang and Sisa Tenor 1,250,000 months with no sanity check → set bounds (tenor ≤ 480; cicilan ≤ total).
- [P2] desktop 331/335-\*-submitted.png — "Berhasil disimpan!" shows, but nothing on the page reflects the new aset/liabilitas ("Entri Terakhir" lists only transactions) → include all entry types in Entri Terakhir, or link to the created record in the toast.
- [P2] desktop 312-page.png — The hero headline is "12 Pintasan tersedia" (shortcut count), which is meaningless as the primary metric, and "Daily average" is English → lead with "Transaksi hari ini", and translate the label ("Rata-rata harian").
- [P2] desktop 312-page.png — The "Entri Terakhir" card has about 280px of empty space between the last row and "Lihat Semua" → size it to its content.
- [P2] desktop 312-page.png — Amounts read "-≈ € 40,48" (sign before the approx mark) → "≈ −€ 40,48".
- [P2] desktop 312-page.png, 313-page-scroll-1.png — Tile subtitles are not baseline-aligned. One-line subtitles ("Tambah rekening bank", "GoPay, OVO, DANA") sit at the bottom while two-line ones start higher → top-align the subtitle under the title.
- [P2] desktop 318-nav-\*.png, 344–347 — Tiles behave inconsistently. Rekening/E-Wallet/Aset/… open a create drawer, while Investasi/Anggaran/Aset Warisan/Donasi/Split Bill navigate away to the list page without opening a create form, despite the labels "Kategori budget", "Catat warisan" → open the create dialog on arrival.
- [P2] desktop 318-nav-bulk-pagination-test-456gopay-40-48.png — Clicking an "Entri Terakhir" row lands on the Transaksi list, not on that transaction. The landing hero shows "-Rp 1.253.349,55" next to "≈ € 10.012,27" values (Rp vs €), and the chart's Y label "252.573,08" is clipped at the left edge → deep-link to the transaction; fix the hero currency.
- [P2] desktop 344-nav-anggarankategori-budget.png — The landing chart axis uses "10 jt / 5 jt" (rupiah juta scale) on € values → use a currency-neutral scale (k/M).
- [P3] desktop 312-page.png — The hero "Catat transaksi" duplicates the topbar "Catat transaksi" CTA one row above → drop one.
- [P3] desktop 331/335-\*-submitted.png — The bottom-centre toast covers the "Tambah polis"/"Goal keuangan baru" tile text → offset toasts above content or move them to the corner.

### Dialogs & forms seen

- Tambah Transaksi (centred modal): no validation on empty submit or missing account/category (silent no-op); Rp balances next to € input; truncated category tiles and account carousel.
- Tambah Rekening Bank (drawer): repeated FX boilerplate, empty Pemilik select; validation and submit not captured.
- Tambah E-Wallet (drawer): same as Rekening; validation and submit not captured.
- Tambah Aset (drawer): generic error toast on empty submit, stale toast; saves but the record does not appear on the page.
- Tambah Liabilitas (drawer): generic error toast, duplicated FX boilerplate, no bounds on tenor/cicilan.
- Tambah Asuransi (drawer): generic error, then a vague "Data sudah ada" 409 with no field hint.
- Tambah Tujuan Keuangan (drawer): the only form with an inline field error; auto-debit day accepts 1,250,000, the server fails generically, and the Ikon button is tofu.

### Not reachable

- Validation/submit for Rekening Bank and E-Wallet drawers; "Lampiran" expander; "Lihat semua" category picker; "Simpan & tambah lagi" flow; Pemasukan/Transfer/Kartu Kredit tabs of Tambah Transaksi.

## masterdata

Scores: desktop 3/3/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The structure is coherent, but the hero and the pemasukan list are mostly dead space. Row actions are hidden until hover, the icon picker is broken (tofu), validation is toast-only, and the COA counts contradict Master COA.

### Defects

- [P0] desktop 348-page.png vs 352-nav-master-coa.png — "Akun COA · 106 akun · Kategori yang sudah punya akun COA" implies 106 linked accounts. Master COA says "Akun kosong 89 perlu dicek" and "89 akun COA belum terhubung", and the hero says "Terhubung COA 21" → subtitle "106 akun · 21 terhubung ke kategori".
- [P1] desktop 353-tambah-dialog-open.png, 357/359/369/377-edit-\*.png — The "Ikon" picker renders a tofu box for every category, including Bonus (gift icon in the list) and Cicilan KPR (house icon) → show the category's current lucide icon.
- [P1] desktop 354-tambah-validation.png — An empty submit shows only the toast "Nama kategori wajib diisi.", with no inline error on "Nama Kategori". The Tujuan form in quickinput does it inline → inline error and red field border.
- [P1] desktop 355-tambah-filled.png — The stale error toast "Nama kategori wajib diisi." stays visible after the name is filled → dismiss it on input.
- [P1] desktop 348-page.png — The hero's left panel is about 300px of empty dark green below the Keluar/Masuk legend, and the right column repeats the same numbers (Pemasukan 5 / Pengeluaran 16 / Terhubung COA 21) → shrink the hero, or use the space for a useful split (e.g. unlinked categories).
- [P1] desktop 349-page-scroll-1.png, 350-page-scroll-2.png — "Kategori pemasukan (5)" stretches to match the 16-row pengeluaran card, leaving about 600px of blank white → let the cards size independently (masonry), or stack them.
- [P1] desktop 348-page.png — Category names are auto-generated English and truncated ("Asset & Other Insurance: Asuransi Jiwa Prud…", "Utang: Audit QA 1", "Utang: KPR BTN Perumahan") in Indonesian UI → use localized, short names ("Premi Asuransi Jiwa", "Cicilan KPR BTN").
- [P1] desktop 358/360/370/380-hapus-\*.png — The delete confirm header band has a visible horizontal seam/line through the gradient between title and description. The description starts lowercase ("kategori \"Hiburan\" yang dihapus…") → render the header as one block and capitalize the sentence.
- [P1] desktop 358/380-hapus-\*.png — Deleting in-use categories (Hiburan, Belanja, both used by budgets and transactions) gives only "tidak bisa dikembalikan", with no count of affected transactions/budgets → state the impact, or offer to reassign.
- [P1] desktop 352-nav-master-coa.png — The Master COA hero says "Daily average 18 · 1 – 6" for a chart of account counts per group (not a time series). Group names switch to English (Income/Expense) while Data Master shows Pendapatan/Beban → "Rata-rata per grup", with consistent Indonesian group names.
- [P2] desktop 356-tambah-submitted.png — Row edit/delete actions (pencil, ×) appear only on hover. Without hover, the rows have a dead 100px gutter right of the COA code. Delete here is "×" while Master COA uses a trash icon → always-visible kebab or icons, and one delete glyph.
- [P2] desktop 348-page.png — COA codes are set in tiny monospace grey (~10px) and float mid-row at x≈677 instead of right-aligned → right-align them with readable size.
- [P2] desktop 348-page.png, 349-page-scroll-1.png — Several categories share one COA code (Freelance and Lainnya Pemasukan 10099; Audit QA 1 and Makan & Minum 20001; both "Utang:" rows 50001) with no indication that this is intentional → flag shared mappings.
- [P2] desktop 348-page.png, 349-page-scroll-1.png — The generic chain-link icon is the fallback for Freelance, Lainnya, Hiburan and the insurance rows, so Hiburan and Freelance look identical to a link → give each category a meaningful default icon.
- [P2] desktop 350-page-scroll-2.png — In "Daftar rujukan", every chip repeats a "Bawaan" badge (15×), which is visual noise, and there is no visible delete affordance despite the info text "bisa kamu tambah dan hapus sendiri" → mark custom items instead, and show remove on hover/focus.
- [P2] desktop 351-info-dialog-open.png — The info popover covers the "Akun COA" subtitle and the first three list rows, has no pointer arrow, and mixes quote styles (“Bawaan") → anchor it below the icon with an arrow, and fix the quotes.
- [P2] desktop 369-edit-asset-other-insurance-asuransi-jiwa.png — Behind the drawer, "Kategori pemasukan (5)" is still shown above six rows (Audit QA 1 plus 5) after the add, though 356 showed (6) → keep the count in sync (the background is blurred; verify).
- [P3] desktop 370-hapus-asset-other-insurance-asuransi-jiw.png — A long category name wraps the confirm title to three lines → truncate the name in the title.
- [P3] desktop 352-nav-master-coa.png — The "Semua" row in "Grup akuntansi" has an empty dot pill where the other rows have type chips → remove it or show a count.

### Dialogs & forms seen

- Info popover: covers content, no arrow.
- Tambah Kategori (drawer): toast-only validation, stale toast, tofu icon picker; submit worked ("Kategori ditambahkan") and the record appeared in the list (count 5 to 6).
- Edit Kategori (drawer, ×12 sampled 4): fields prefilled correctly; icon picker tofu for all; long names fit.
- Hapus Kategori (confirm modal, ×12 sampled 4): seam in the header gradient, lowercase description, no impact warning, title wraps for long names.

### Not reachable

- Daftar rujukan "+ Tambah" dialogs (Bank / E-Wallet / Lembaga Donasi), the actual delete outcome, Edit submit result, the "Akun COA" select options list, the Peran & Akses subpage.
