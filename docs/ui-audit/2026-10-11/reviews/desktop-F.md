## splitbill

Scores: desktop 3/3/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Forest hero and bento grid are on-brand, but the hero chart is a near-empty single-category plot with duplicated legends, the right column is mostly dead space, and the create sheet validates only via toast and mangles amounts when filled.

### Defects

- [P1] desktop 251-page.png — Hero shows two legends for the same chart with swapped order ("Terkumpul · Total" under the button, "Total · Terkumpul" above the plot) → keep one legend, attached to the chart.
- [P1] desktop 251-page.png — Hero chart plots a single category ("Makan") with two thin bars in a ~460px-wide area; the y-axis label "≈ € 59,89" sits outside the plot, top-left → for one active bill use a progress meter/donut, or a chart with real per-bill categories.
- [P2] desktop 251-page.png — "Buat Split Bill" pill floats mid-hero, right-aligned under the subtitle, disconnected from both the headline and the chart → anchor it in the header row (same position as "Catat Donasi" on /donation, which also moves between states).
- [P1] desktop 251-page.png — "Riwayat" card is ~560px tall with one 40px row; about 380px of white space → size the card to its content or fill it (paid-history list, totals per month).
- [P2] desktop 251-page.png — Bottom-right card reads "Makan Malam Anniversary baru 33%" with no label or icon, so it looks like a broken sentence → give it an eyebrow ("Pengingat"/"Progres") and phrase it as "Makan Malam Anniversary · 33% terkumpul".
- [P2] desktop 251-page.png — Active-split tile wraps "≈ € 19,96 terkumpul dari ≈ € 59,89 · 3 orang" so "· 3 orang" is orphaned on line 2, then repeats "3 orang" on the next line ("1 dari 3 orang") → one line for the amount, one line for "1/3 lunas · 6 Okt 2026".
- [P2] desktop 251-page.png — Active grid holds one tile plus a dashed "Split baru" tile, leaving the right third of the card empty → let the tiles flow to the width or use a list.
- [P2] desktop 251-page.png — Floating AI button is cut off at the right viewport edge (offscreen=I) → keep it inside the 16–24px gutter.
- [P1] desktop 252-buat-split-bill-dialog-open.png — Under "Total Tagihan", three stacked 11px helper lines (rate, "Nilai rupiah final…", "Disimpan sebagai IDR…") crowd the field → reduce to one line with an info tooltip.
- [P2] desktop 252-buat-split-bill-dialog-open.png — Total input has a grey fill while every other input in the sheet is white with a border → one input style.
- [P2] desktop 252-buat-split-bill-dialog-open.png — Subtitle wraps and leaves "peserta." orphaned on line 2 → shorten the copy or widen the text measure.
- [P2] desktop 252-buat-split-bill-dialog-open.png — Per-person shares show "EUR 0,00" while the rest of the app uses "€" → use the same "€" money format.
- [P1] desktop 252-buat-split-bill-dialog-open.png — The participant list runs under the sticky footer (the "Citra" row is clipped) with no scroll cue → add a fade/shadow above the footer or bottom padding.
- [P1] desktop 253-buat-split-bill-validation.png — Empty submit shows only a bottom toast ("Judul acara wajib diisi"); no field gets an error border or inline message, and the total and participant names are never flagged → show inline errors on every invalid field and focus the first one.
- [P1] desktop 254-buat-split-bill-filled.png — After the fields are filled, the stale toast "Judul acara wajib diisi" is still on screen → dismiss validation toasts when the field becomes valid.
- [P1] desktop 254-buat-split-bill-filled.png — Shares render as "EUR 416666,67" with no thousands separator, and the participant inputs shrink (1310→1266px) as the amount text grows → use a fixed-width right-aligned amount column with "€ 416.666,67".
- [P2] desktop 254-buat-split-bill-filled.png — Bold "≈Rp 25.046.175.000" has no space after "≈" and is set heavier than the field value → match the regular helper style used elsewhere ("≈ € …").
- [P1] desktop 255-buat-split-bill-submitted.png — Success toast "Split Bill dibuat!" sits on top of a ghost toast (second pill edge visible behind it) → one toast at a time and replace instead of stacking.
- [P1] desktop 255-buat-split-bill-submitted.png — Detail sheet footer makes the destructive "Cabut Semua Link" the filled red primary next to a second destructive "Hapus", and there is no positive primary (share/copy all) → make share the primary and move revoke/delete into a quiet overflow.
- [P2] desktop 255-buat-split-bill-submitted.png — Detail sheet has ~480px of empty white below three rows, and the "Konfirmasi & Catat Pemasukan" chips use ~11px text → give the space a summary block (paid/unpaid, account, instructions) and set the chips at body size.
- [P1] desktop 256-liburan-bali-bareng3-orang-6-okt-2026lun.png — A fully settled bill (all three "Lunas", listed under Riwayat) still shows a yellow warning to set a payment account, plus a "Cabut Semua Link" primary → hide the payment-account warning and link revocation on settled bills.
- [P2] desktop 256-liburan-bali-bareng3-orang-6-okt-2026lun.png — Warning copy is squeezed into a ~180px column (7 lines) beside the button → stack the button under the text at full width.

### Dialogs & forms seen

- Buat Split Bill (sheet): validation is toast-only with no inline errors, the toast goes stale, "EUR" vs "€" formats differ, shares are unformatted and resize the row, and the list is clipped under the footer.
- Split bill detail (Audit QA 1): record created and appears in "Split Bill Aktif" (hero updates to 2 active). Footer hierarchy leads with a destructive action, and the toasts stack.
- Liburan Bali Bareng detail: irrelevant payment-account warning on a settled bill; destructive primary.

### Not reachable

- "Custom per Orang" split mode, the "Atur Rekening Tujuan" flow, the per-participant link/share action and the Hapus confirmation were not opened.

## warisan

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Shell and hero follow the forest/lime system, but the hero repeats its own total, the percentages contradict each other after an add, the right column is half empty, and the edit sheet's heir table overflows the sheet.

### Defects

- [P1] desktop 257-page.png — Hero shows the same figure twice: "≈ € 57.393,99 Total Nilai Warisan" and again "≈ € 57.393,99 total" just below → drop the second figure or replace it with allocated vs unallocated.
- [P0] desktop 261-tambah-aset-warisan-submitted.png — The hero legend says 63% + 38% (=101%), the side stat says "Teralokasi 63%", and the bottom-right card says "37% nilai belum dialokasikan"; 38% and 37% describe the same unallocated share → round once so the parts sum to 100% and show one value everywhere.
- [P1] desktop 257-page.png — "Alokasi Ahli Waris" card is ~380px tall with two rows; the "Belum dialokasikan" row uses a bare "?" glyph with no avatar circle, unlike the "AD" avatar above it → match the avatar treatment and size the card to its content.
- [P1] desktop 257-page.png — Bottom-right "26% nilai belum dialokasikan" card is bottom-heavy: about 130px empty on top, and the text uses only ~200px of a 376px card → top-align it and add an action ("Atur ahli waris").
- [P2] desktop 257-page.png — "Tambah Aset Warisan" pill floats between the two totals, right-aligned, unrelated to either → put it in the hero header row.
- [P2] desktop 257-page.png — Asset rows are grey-filled boxes with a 1px border inside a white card (a card in a card, with a border); other pages use borderless rows → use flat rows with dividers, or tiles without borders.
- [P1] desktop 257-page.png — "Tabungan & Investasi" (unallocated) shows no heir chip, no allocation bar and no "belum dialokasikan" state, while "Rumah Depok" shows a full bar → show an empty bar and a "Belum ada ahli waris" chip so the gap is visible.
- [P2] desktop 257-page.png — Per-row toggle has no label; its meaning ("Terlihat oleh ahli waris") is only discoverable in the dialog → add a label or tooltip next to the switch.
- [P2] desktop 257-page.png — "Penuh" allocation bar is dark forest green while the hero allocation bar is hatched lime → use one allocation colour.
- [P2] desktop 257-page.png — In the IA, Warisan (and Donasi) sit under "Pusat Pajak" in the sidebar; inheritance is not a tax sub-page → move them to their own group or rename the parent.
- [P2] desktop 257-page.png — Floating AI button is cut off at the right edge (offscreen=I) → keep it inside the gutter.
- [P1] desktop 259-tambah-aset-warisan-validation.png — Empty submit shows only the toast "Nama aset wajib diisi."; the Nama Aset field gets no error state and required fields are not marked → inline error, red border and focus on the field.
- [P1] desktop 260-tambah-aset-warisan-filled.png — Stale validation toast "Nama aset wajib diisi." is still shown while Nama Aset is filled → dismiss it when the field becomes valid.
- [P2] desktop 258-tambah-aset-warisan-dialog-open.png — Currency selector defaults to EUR on open, then silently flips to IDR ("Rp 210.000.000") when an asset is picked (260); the Edit sheet also opens in IDR → keep the user's display currency and convert, or explain the switch.
- [P2] desktop 260-tambah-aset-warisan-filled.png — Picking "Toyota Avanza 2021" leaves Kategori as "Kas & Tabungan", and the saved card shows that chip (261) → auto-fill the category from the linked asset (Kendaraan).
- [P2] desktop 258-tambah-aset-warisan-dialog-open.png — Under "Nilai Estimasi", three 11px helper lines repeat the split-bill helper block → one line plus a tooltip.
- [P1] desktop 261-tambah-aset-warisan-submitted.png — Success toast stacks over a ghost toast and covers the new "Toyota Avanza 2021" row (category chip and "Terhubung ke Aset" text hidden) → one toast, placed away from fresh content.
- [P0] desktop 262-ubah-dialog-open.png — Edit sheet "Ahli Waris" table is wider than the sheet: the third column header shows only "B…", and its input is cut off at the right viewport edge → stack the heir fields vertically in the sheet, or wrap them as a card per heir.
- [P1] desktop 262-ubah-dialog-open.png — Each heir shows a "Ana Demo" select plus a second greyed "Ana Demo" input under it, with no label explaining the duplicate → show one control (select an existing member, or a free-text name), not both.
- [P2] desktop 262-ubah-dialog-open.png — Heir table uses uppercase tracked column headers ("NAMA", "HUBUNGAN"), a style used nowhere else in the sheets → use the sheet's normal field labels.
- [P1] desktop 263-hapus-dialog-open.png — Delete confirmation header has a dark gradient with visible hard horizontal bands at the title baseline and mid-body, so the body text sits across two tones → use a flat surface or one smooth gradient behind the whole text block.
- [P2] desktop 263-hapus-dialog-open.png — Confirm modal uses a dark-header style unlike every side sheet, and its body copy wraps at ~300px in a 400px dialog → align it with the sheet system and use the full width.

### Dialogs & forms seen

- Tambah Aset Warisan: opens fine, but validation is toast-only and goes stale, currency flips EUR→IDR, and the category does not follow the picked asset. The record is created and appears in the list, with the toast covering it.
- Edit Aset Warisan: heir table overflows the sheet horizontally (P0) and has a duplicate name control.
- Hapus Rumah Depok?: banded gradient header and a narrow text measure; the destructive button is clearly styled.

### Not reachable

- "Tambah Ahli Waris" row add, the heir-percentage editing/validation (e.g. >100%) and the visibility-toggle effect were not exercised.

## donation

Scores: desktop 2/2/1 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Weakest of the three: the history icons render as tofu boxes, the religion select never shows its value, the zakat calculator is hard-labelled "Rp" in a EUR account, and the hero's "Daily average" is mislabelled, inconsistently computed and charted off-scale.

### Defects

- [P0] desktop 264-page.png — Every "Riwayat Donasi & Zakat" row icon renders as an empty tofu box (missing glyph) → use the lucide icon set used elsewhere.
- [P0] desktop 265-select-islam-zakat.png … 270-select-tidak-diatur.png — After picking Islam, Kristen, Katolik, Hindu, Buddha or "Tidak diatur", the select trigger stays blank (just a chevron box), and the card still says "Kalkulator Zakat Maal" with zakat fields for every religion → render the chosen value in the trigger, and swap the calculator (persepuluhan/dana punia/none) to match.
- [P1] desktop 264-page.png — The religion select has no label or placeholder: a 46px empty box squeezed between the title and "Simpan Agama Keluarga" → label it "Agama keluarga" with a placeholder, on its own row.
- [P1] desktop 264-page.png — Zakat inputs are hardcoded "Tabungan & Kas (Rp)", "Emas & Perak (Rp)", "Investasi & Saham (Rp)", "Utang Jatuh Tempo (Rp)" while the result shows "≈ € 0,00" and the nisab "≈ € 10.743,71" → use the account currency, or add the same currency selector as the dialogs.
- [P1] desktop 264-page.png — Nisab note reads "harga emas keluarga: Rp ≈ € 126,40/gram Diinput manual, per 11 Okt 2026", with "Rp" next to a € value and a missing separator before "Diinput" → "≈ € 126,40/gram · diinput manual · 11 Okt 2026".
- [P0] desktop 274-catat-donasi-submitted.png — "Daily average" is not daily: it equals total ÷ count (57,39/4 = 14,35; 1.250.057,39/5 = 250.011,48). After the second add (279) it shows 250.023,96 = total ÷ 5 while "Transaksi" says 6 → compute one defined metric (average per donation over all records) and label it in Indonesian ("Rata-rata per donasi").
- [P1] desktop 264-page.png — The "Daily average" label is English in an Indonesian UI, and the caption "Sedekah / Infak – Wakaf" (later "Zakat Fitrah – Wakaf") reads as a range of categories → translate it and drop or clarify the caption.
- [P0] desktop 274-catat-donasi-submitted.png — After adding one large Zakat Fitrah, the chart drops "Sedekah / Infak" and "Sedekah" (still listed in Riwayat), and the "Zakat Maal" and "Wakaf" bars become invisible at the new scale → show every category, and use a log scale, a capped axis or horizontal bars with value labels.
- [P1] desktop 264-page.png — Y-axis labels and "Avg ≈ € 14,35" sit outside the plot and run across the hero's vertical divider (e.g. "≈ € 1.497.234,61" and "Avg ≈ € 250.011,48" in 274 cross x≈762) → put labels inside the plot area or reserve an axis gutter.
- [P2] desktop 264-page.png — Chart bars are dark forest-on-forest with low contrast, while the other heroes (splitbill) use lime for the highlighted series → use lime/sage bars from the chart palette.
- [P1] desktop 264-page.png — Hero has ~170px of empty forest below the chart, and the right stat column is empty below "Pengurang pajak" (~380px) → shorten the hero or add stats (per-category totals, zakat paid vs due).
- [P2] desktop 264-page.png vs 274-catat-donasi-submitted.png — "Catat Donasi" jumps from the top-right of the hero (y≈112) to a mid-hero row (y≈186) when the total gets wider → fixed header slot.
- [P1] desktop 264-page.png — "Kalkulator Zakat Maal" title wraps to two lines and the info icon sits orphaned on its own row, because the select and button crowd the header → title on row 1, controls on row 2.
- [P2] desktop 264-page.png — "Simpan Agama Keluarga" is a small dark-teal pill with 12px text, a style not used by other buttons ("Catat Estimasi Zakat" is forest with an icon) → use the shared secondary button.
- [P2] desktop 264-page.png — Zakat inputs have no placeholder or "0" and no currency prefix, unlike the dialog money inputs → reuse the money input component.
- [P2] desktop 264-page.png — Tax chips use inconsistent casing ("Tidak mengurangi pajak" vs "Pengurang Pajak") → one casing rule.
- [P2] desktop 264-page.png — The "Laporan" header link is prefixed by an info icon, which reads as a tooltip rather than a link → use a report/arrow icon.
- [P2] desktop 264-page.png — Bottom-right "Donasi bisa jadi pengurang pajak" card is bottom-heavy (~60px empty top), and its text uses ~170px of a 376px card; the card is cut off at the fold → top-align it and use the width; add a CTA to Pusat Pajak.
- [P2] desktop 264-page.png — Riwayat card header inset (280px) differs from the hero and other cards (284px) → same card padding.
- [P2] desktop 264-page.png — Floating AI button is cut off at the right edge (offscreen=I) → keep it inside the gutter.
- [P1] desktop 271-catat-donasi-dialog-open.png — Field label says "Jumlah (Rp)" while the currency selector is EUR and the prefix is "€" → label it "Jumlah" and let the selector carry the currency.
- [P2] desktop 271-catat-donasi-dialog-open.png — Three stacked 11px rate/helper lines under the amount (same block as splitbill/warisan) → one line plus a tooltip.
- [P2] desktop 271-catat-donasi-dialog-open.png — "Pengurang pajak penghasilan" switch in its off state is white-on-white and nearly invisible → give the off track a visible sage/grey fill.
- [P1] desktop 272-catat-donasi-validation.png — Validation is a toast only ("Jumlah donasi tidak valid"); the amount field gets no error state → inline error and focus.
- [P1] desktop 273-catat-donasi-filled.png — Stale "Jumlah donasi tidak valid" toast is still shown after a valid amount is entered → clear it on change.
- [P2] desktop 273-catat-donasi-filled.png — "≈Rp 25.046.175.000" is bold with no space after "≈" → regular weight, "≈ Rp 25.046.175.000".
- [P1] desktop 274-catat-donasi-submitted.png — New row meta reads "10 Okt 2026, Mandiri ···5586 ···5586", with the account suffix duplicated → render the account once.
- [P1] desktop 274-catat-donasi-submitted.png — Success toast stacks over a ghost toast and covers the third row's amount → single toast, positioned clear of the list.
- [P1] desktop 276-catat-estimasi-zakat-dialog-open.png — "Catat Estimasi Zakat" opens the generic "Catat Donasi Keagamaan" sheet with "Rp 0", so it does not carry the calculator's estimate. It switches currency to IDR (the plain Catat Donasi opened in EUR) and keeps the previous run's date (10 Oktober instead of today, 11 Oktober) → prefill the estimate in the account currency, title it "Catat Zakat", and reset the date to today.
- [P2] desktop 275-info-dialog-open.png — Info popover covers the "Tabungan & Kas" label and input → place it above, or anchor it to the left of the icon.

### Dialogs & forms seen

- Catat Donasi Keagamaan: "Jumlah (Rp)" label contradicts the EUR selector; validation is toast-only and goes stale. The record is created and appears in Riwayat with a duplicated account suffix; the hero updates but the chart/average is wrong.
- Info popover (zakat): opens, but overlaps the first input.
- Catat Estimasi Zakat: the same generic sheet; it does not prefill the estimate, switches currency to IDR and keeps the stale date. The record is created and appears with "Pengurang Pajak"; Pengurang pajak in the hero updates (€32,44 → €94,82).
- Religion select (6 options): the selected value never renders and the calculator does not change.

### Not reachable

- The "Laporan" link target, "+ Tambah ke Master Data", "Simpan Agama Keluarga" result and the rows below the fold in Riwayat (edit/delete per donation) were not captured.
