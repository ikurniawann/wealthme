## dana

Scores: desktop 4/3/3 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Strong hero/bento character, but the trend chart is scaled in Rupiah against € totals, the date axis is out of order, and the dialog family uses three different header treatments.

### Defects

- [P0] desktop 188-page.png — hero trend chart y-axis reads "0 / 5M / 10M / 15M" (Rupiah scale) while the headline total is "≈ € 331,89"; line sits at ~7M which no € figure on screen matches → convert series to display currency and label ticks "€100 / €200 / €300" (or show Rp explicitly with a unit).
- [P1] desktop 188-page.png — chart x-axis "19 Okt · 22 Okt · 25 Okt · 11 Okt" is evenly spaced but non-monotonic (11 Okt after 25 Okt with no month/year) → use chronological ticks with month change marked (e.g. "25 Sep … 11 Okt").
- [P1] desktop 188-page.png, 189-page-scroll-1.png — "Mutasi Tunai & E-Wallet Terakhir" lists rows dated 25 Okt (two weeks in the future vs today 11 Okt) named "Bulk pagination test 456/402/294/186" → demo account must not show test-fixture rows or future-dated mutations.
- [P1] desktop 188-page.png — floating AI button at bottom-right is cut by the viewport edge (only left half visible, `offscreen` flagged) and overlaps the last mutation amount "-≈ € 23,87" → inset the FAB 16–24px from the edge and reserve space under it.
- [P1] desktop 189-page-scroll-1.png — footer note "Saldo kas boleh minus…" runs under the FAB; "(mi" is clipped at the right edge → constrain note width to the content column.
- [P2] desktop 188-page.png — Tunai card: "diperbarui 11…" truncated although ~100px of free space remains to the right; "Bersama" chip floats mid-row instead of right-aligned like the "Aktif" chips on Asuransi → right-align chip, let meta wrap or drop truncation.
- [P2] desktop 188-page.png — Kas Tunai icon tile is an empty pale-lavender square with an almost invisible glyph, while GoPay/OVO tiles are saturated brand squares → give cash a proper filled icon tile in the same system.
- [P2] desktop 188-page.png — Tunai card is half empty (one row, ~110px dead space) and the "Kartu & bank di tempat lain" card wraps its title and body into a ~190px column leaving the right half blank → let copy use full card width; balance card heights.
- [P2] desktop 188-page.png — amounts render as "-≈ € 40,48" (minus before the approx sign) → "≈ −€ 40,48" or "−€ 40,48" with approx in a column header.
- [P2] desktop 188-page.png — hero "Tunai" button is a dark outline pill, "E-Wallet" a filled cream pill, both same weight action → identical style for sibling add actions.
- [P2] desktop 188-page.png — mutation rows all use the same "↗" icon for outflows; direction icon carries no information → in/out icons with semantic colour.
- [P3] desktop 188-page.png — "+ Tambah" micro-buttons on Tunai/E-Wallet cards (≈11px text) are smaller than every other card action on the page.

### Dialogs & forms seen

- Tambah Kas Tunai (190, 192): fits; currency helper is three 11px lines ("1 EUR = Rp 20.036,94 · ECB…", "Nilai rupiah final…", "Disimpan sebagai IDR…") under one field — noisy; ~430px of empty sheet above footer.
- Tambah E-Wallet (191): same helper noise; "+ Tambah ke Master Data" link sits flush under the select with no spacing to the next label.
- Ubah tampilan kartu (193): different system from the other sheets — green gradient header, no footer divider, footer buttons 54px vs 46px elsewhere; card preview repeats "Kas Tunai" twice (top-left and italic top-right).
- Ubah → "Edit Kas Tunai" (194): title says "Edit" while the trigger says "Ubah" (mixed language); defaults to IDR "Rp 3.000.000" while Tambah defaults to EUR — inconsistent default currency between add and edit.
- Hapus (195): centred modal with green header band; a 1px rule cuts between title and description inside the band, and the description wraps at ~250px in a 400px dialog; no icon/amount context of what is deleted (balance ≈ € 149,72 not shown).

### Not reachable

- No validation, filled or submitted state captured for Tunai/E-Wallet dialogs; no detail view of a single wallet; "Lihat Semua" not followed.

## asuransi

Scores: desktop 4/3/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Looks on-brand, but the hero shows "Rp ≈ €", the coverage card contradicts its own total after a policy is added, and the add/edit form crushes currency inputs to ~90px.

### Defects

- [P0] desktop 202-tambah-submitted.png, 204-opsi-lainnya-menu-open.png — after adding an inactive ("Tidak Aktif") policy, "Uang Pertanggungan per Jenis" lists "Asuransi Kesehatan ≈ € 1.250.000,00 · 97%" under a header that still says "total pertanggungan aktif ≈ € 35.434,55"; the rows sum to €1,285,434 and the percentages are computed against a different total → exclude inactive policies (or update the total) so rows, bar and total agree.
- [P0] desktop 202-tambah-submitted.png — "Tidak ada perpanjangan dalam 30 hari" is shown while the new policy card reads "0 hari · 10 Oktober 2026" (already due) → either count it or label it inactive/expired explicitly in the reminder card.
- [P1] desktop 196-page.png (all page shots) — hero headline renders "Rp ≈ € 74,86": a hardcoded "Rp" prefix sits in front of the € value → drop the Rp glyph.
- [P1] desktop 198-bayar-premi-dialog-open.png — every policy card and the hero offer "Bayar Premi", but the dialog says "Tidak ada polis yang perlu dibayar saat ini." and only offers Batal → disable/hide the button when nothing is due, or let the user pay ahead for a chosen policy.
- [P1] desktop 203-detail-dialog-open.png — the "Detail" button opens an "Edit Asuransi" form, duplicating the ⋮ → Edit menu item; there is no read-only detail view → open a detail sheet (premium history, beneficiary, docs) or rename the button to "Ubah".
- [P1] desktop 196-page.png — premium chart has a single bar for "Okt" with y-ticks "0" and "≈ € 74,86" only; a one-month stacked bar is not a trend and the legend includes 3 series with no values → show 6–12 months or replace with a breakdown list.
- [P2] desktop 196-page.png — hero action pills "Bayar Premi" (outline) and "Tambah" (filled) sit in the middle of the chart area under the headline rather than in the hero header row like Dana's pills → align action placement across hero cards.
- [P2] desktop 196-page.png — hero right column has ~180px of dead space under "Perpanjangan terdekat"; "Asuransi Kendaraan Toyota Avanza · 176 hari lagi" wraps with the separator "·" orphaned at line start.
- [P2] desktop 196-page.png — 3 policies in a 2-col grid leave a half-empty row; Polis card title "Asuransi Kendaraan Toyota Ava…" truncated while there is room if the "Aktif" chip moved → let title wrap to 2 lines.
- [P2] desktop 196-page.png — "Tidak ada perpanjangan dalam 30 hari" card copy is squeezed into ~200px of a 376px card, and the card ends at 660px while the Polis card continues → full-width text, align card heights.
- [P2] desktop 196-page.png — Uang Pertanggungan card has ~150px empty bottom area under two rows.
- [P2] desktop 196-page.png — BPJS card lacks the "Pertanggungan ≈ € …" line the other cards show, so rows misalign between neighbouring cards → keep row count consistent ("Pertanggungan —").
- [P3] desktop 204-opsi-lainnya-menu-open.png — ⋮ menu overlaps the card below and its rounded panel has no edge/shadow separation from the card underneath.

### Dialogs & forms seen

- Bayar Premi (198): empty-state dialog with only "Batal" full-width; header band has a 1px rule cutting between title and description.
- Tambah Asuransi (199): labels say "Premi (Rp)" and "Uang Pertanggungan (Rp, opsional)" while the field prefix/selector is "€ / EUR"; currency input box is ~95px wide next to a 95px currency selector; helper text wraps to 5–6 lines of 11px copy per field.
- Tambah validation (200): empty submit only shows a toast "Nama asuransi wajib diisi"; the Nama Asuransi field gets no red border or inline message → inline field error + focus.
- Tambah filled (201): amount field truncates "1.250.0" (and the hint "≈ Rp 25.046.175.000"); validation toast from the empty submit still on screen while the form is valid.
- Tambah submitted (202): success toast stacked on top of the stale "wajib diisi" toast; record appears in list (Tidak Aktif, "/3 bln") — ok apart from P0 total above.
- Edit Asuransi via Detail (203): "Rp 850.0(" and "Rp 500.0(" truncated in the narrow amount inputs; helper "≈ € 24.953,91 (mata uang tampilan)" wraps to two lines.
- ⋮ menu (204): Edit / Hapus ok.

### Not reachable

- Hapus confirmation, Ahli waris (opsional) accordion contents, and the Bayar Premi flow with a due policy were not captured.

## ai

Scores: desktop 3/3/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The BYO-key gate is a single small card in a vast empty canvas; there is no preview of the chat surface, so the page reads unfinished.

### Defects

- [P1] desktop 205-page.png — the whole route is one 460×270 card at the top centre with ~520px of blank sage canvas below and around it → use a full-height locked chat layout (blurred sample conversation, example prompts, what the advisor can do) with the key CTA in context.
- [P1] desktop 205-page.png — floating AI FAB (bottom-right, half cut off by the viewport edge) is still shown on the AI Advisor page while the advisor is "belum aktif" → hide on this route; fix the edge clipping globally.
- [P2] desktop 205-page.png — "Buka Pengaturan" is a ~30px-tall tiny cream pill, smaller than the primary "Catat transaksi" button and the dialog CTAs → primary-size button with arrow like the "Simpan" CTA.
- [P2] desktop 205-page.png — body copy "Sambungkan API key AI kamu sendiri (Claude, OpenAI, atau Gemini) di Akun → Pengaturan…" is centred 12px text in low-contrast grey on dark green → raise contrast, left-align or split into steps.
- [P2] desktop 205-page.png — the card uses a drop shadow, against the stated no-shadow card system.
- [P3] desktop 205-page.png — lock icon sits in a nearly invisible dark circle on dark green.

### Dialogs & forms seen

- none (no chat input, no dialogs).

### Not reachable

- The enabled chat surface (messages, input, streaming, error states) — not reachable without a configured key.

## kalkulator

Scores: desktop 3/2/3 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Inputs are all Rp while results are €, half the tabs compute live and half need a button with an empty dark result card, and the active-tab and input styles differ tab to tab.

### Defects

- [P0] desktop 206-page.png, 209-tab-investasi.png — Investasi chart y-axis "200M / 400M / 600M / ?00M" is in Rupiah while the result is "≈ € 31.197,21"; the top tick is clipped under the "≈€ 31.197,21" chip → plot in display currency, keep the top tick clear of the end-label.
- [P1] desktop 206–213 — every input is labelled and prefixed "(Rp)" / "Rp" while every result is "≈ €" (e.g. Split: input "Rp 1.250.000", result "≈ € 13,72"; KPR "Rp 1.500.000.000" → "≈ € 625,38") → inputs in account currency with an IDR toggle, or show results in both with Rp primary; the mismatch makes results unverifiable at a glance.
- [P1] desktop 207-tab-zakat-maal.png, 208-tab-pph-21.png, 211-tab-pensiun.png — Zakat, PPh 21 and Pensiun show a full-height dark result card containing only a faint grey "Hitung Zakat" / "Hitung PPh 21" / "Hitung Dana Pensiun" label, while Investasi, KPR, Tabungan and Split compute live → compute live everywhere, or show a designed empty state (what will appear, example output).
- [P1] desktop 206-page.png vs 209-tab-investasi.png — the same Investasi tab is lime-filled on first load but grey (#e5e5e0) after clicking; all other clicked tabs are also grey → one active-tab style (lime, as in the sidebar).
- [P1] desktop 214-nav-buat-split-bill-dari-hitungan-ini.png — "Buat Split Bill dari Hitungan Ini" lands on the Split Bill overview with no prefilled create dialog; the computed €68,62 / 5 orang is not carried over → open the Buat Split Bill sheet prefilled.
- [P2] desktop 206–213 — plain number inputs (Jangka Waktu, Imbal Hasil, Bunga, Tenor, Usia, Jumlah Orang, Pajak, Tip) have a dark 1px border; Rp inputs next to them have a light border → one input style.
- [P2] desktop 206-page.png — 7 calculator tiles in a 3-column grid leave "Split Group" orphaned on a third row with two empty slots → 4+3, 7-across segmented control, or a vertical list.
- [P2] desktop 206-page.png — page subtitle "Semua kolom rupiah otomatis pakai titik ribuan, 100.000.000 tetap terbaca sebagai seratus juta saat disimpan." is developer copy, and PPh 21 repeats a similar hint in a separate pill (208) → remove or reduce to a single field hint.
- [P2] desktop 206-page.png — Investasi chart area bleeds to the card's left edge (line starts at x=0 of the card, no padding) while the result rows below have 20px insets.
- [P2] desktop 206-page.png, 210-tab-kpr.png, 212-tab-tabungan.png — input card and result card heights differ (input card leaves 150–180px empty bottom on Investasi/KPR; Tabungan result card is shorter than its sibling) → align heights or let content define both.
- [P2] desktop 210-tab-kpr.png — "Bunga per Tahun (%)" shows "9.5" with a dot decimal in an id-ID UI that uses "." as a thousands separator everywhere else → "9,5".
- [P2] desktop 212-tab-tabungan.png — result "±29 Bulan" has no breakdown (total setoran, bunga) unlike Investasi/KPR results.
- [P2] desktop 207-tab-zakat-maal.png — "Hitung Zakat" button is 36px tall full-width, shorter than the 46px dialog CTAs and with a drop shadow; same for PPh/Pensiun buttons.
- [P3] desktop 206-page.png — result-card value "+≈ € 16.723,95" stacks plus and approx glyphs.

### Dialogs & forms seen

- PPh 21 "Rincian lapisan tarif" (208): button visible, dialog not captured.
- Inputs across 7 tabs: no validation states visible (e.g. Usia Sekarang > Target Usia, DP > Harga Properti not tested).

### Not reachable

- Computed results for Zakat Maal, PPh 21 and Pensiun (crawler did not click "Hitung"); "Rincian lapisan tarif" dialog.
