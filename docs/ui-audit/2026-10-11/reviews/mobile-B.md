## rekening

Scores: desktop n/a · tablet n/a · mobile 4/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: The wallet cards keep their character, but they are stacked full-width instead of in a carousel, so 9 accounts take 5 page scrolls. Sheets mix three header styles, and the Akun chips break a negative balance across two lines.

### Defects

- [P1] mobile 108–111-page-scroll-1..4.png — every account is a full-width ~230px card plus a ~45px action row (Mutasi · palette · ⋮). Nine accounts need 5 scroll stops, and each card has ~120px of empty space between the chip and the number → use a horizontal snap carousel with a page indicator, or a compact list (bank logo · name/last-4 · balance), with the actions in the ⋮ menu.
- [P1] mobile 107-page.png — the first viewport is hero + "Aksi cepat", and only the top 130px of the first card shows. "Aksi cepat → Tambah" and "Catat transaksi" duplicate the hero "+ Tambah" button and the dock "+" → drop the Aksi cepat card on mobile, or merge it into the hero as an icon row, so the first account is visible above the fold.
- [P1] mobile 113-tab-milik-saya.png — the "Milik saya" filter shows two stacked empty states: "Belum ada rekening yang menjadi milikmu." and then an empty dashed card under a "Semua rekening" heading that contradicts the active filter → show one empty state with a "Tambah rekening" CTA, and hide the "Semua rekening" section.
- [P1] mobile 117-catat-transaksi-dialog-open.png — in the Mandiri Akun chip the minus sign sits alone on its own line ("-" over "Rp 24.966.425.000"), so the balance reads as positive → keep sign and amount together on one line (nowrap), and shrink or compact the amount.
- [P1] mobile 117/119-catat-transaksi-\*.png — Kategori tiles show two identical truncated labels, "Asset & Other…" and "Asset & Other…", so the user cannot tell them apart in the 4-column grid → use 3 columns on phones or allow 2 full lines, and give the categories distinct names.
- [P2] mobile 117-catat-transaksi-dialog-open.png — the Akun chip rail shows the counter "2 dari 19" with no visible meaning; there are 9–10 accounts on the page → drop the counter or say "19 akun"; show scroll dots under the rail.
- [P2] mobile 115 vs 117 vs 121 — three sheet header styles in one route: white title with a grey round close (Tambah Rekening), a dark-green band with small white title and a dark close button that is barely visible (Tambah Transaksi), and a dark band with a large title (Ubah tampilan kartu) → one sheet header pattern.
- [P2] mobile 122-opsi-rekening-menu-open.png — the ⋮ menu is a floating popover over the next card, and "Ubah tampilan kartu" wraps onto two lines; the other dialogs are bottom sheets → render the overflow menu as an action sheet on phones.
- [P2] mobile 111-page-scroll-4.png — the "Perkiraan" chip overlaps the last line of the tax note ("dipotong." is half covered). The note also hardcodes "Rp 7.500.000" on a EUR page → give the chip its own row with spacing, and format the threshold in the display currency.
- [P2] mobile 116-click-tren-detail.png — the x-axis repeats "BCA" four times, so the bars cannot be identified at 358px. The "Daily average" label remains English → label bars by last-4 or a short account name, and skip €0 accounts.
- [P2] mobile 115-tambah-dialog-open.png — "+ Tambah ke Master Data" is a 342×18 tap target (smallTargets). The FX helper is three lines of ~11px text under the Saldo field → make the link at least 36px tall, and shorten the helper to one line ("≈ Rp … · kurs ECB 9 Okt").
- [P3] mobile 109/110-page-scroll-\*.png — six cards read "BCA Tabungan" with no last-4 digits, so the cards cannot be told apart → always show ···last-4 in the card header.

### Dialogs & forms seen

- Tambah Rekening Bank: real bottom sheet with a sticky Batal/Simpan footer. Issues: an 18px-tall Master Data link and a 3-line FX helper.
- Tambah Transaksi (Catat transaksi): bottom sheet with a sticky footer and "Simpan & tambah lagi". Issues: wrapped minus sign in the Akun chip, duplicate truncated categories, and a header style that differs from other sheets. Empty-submit feedback is already logged on desktop.
- Ubah tampilan kartu: fits the screen with a sticky footer; ok.
- Opsi rekening menu: popover, not an action sheet.

### Not reachable

- Edit / Hapus rekening sheets from the ⋮ menu.

## investasi

Scores: desktop n/a · tablet n/a · mobile 3/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: The hero takes the whole first viewport to show an empty "Perubahan Hari Ini". Holding cards drop the quantity and price data that desktop shows. The Catat Investasi sheet's two-column money row is crushed to unreadable widths.

### Defects

- [P1] mobile 135/137-catat-investasi-\*.png — the "Harga Beli per Unit" input is ~60px wide next to the EUR picker. It shows "€ co" as the placeholder and "€ 1.2" for the typed value. The sibling "Jumlah Saham" placeholder is cut ("contoh: 10 (1 lot = 1"), and the FX helper wraps to 6 lines in a half column → on phones stack each money field full-width with the currency picker inside the input (suffix), and put the helper under it on one line.
- [P1] mobile 124-page-scroll-1.png — holding cards drop the lot/lembar count, per-unit price, "Live · delayed" status and source that desktop shows. Each card is still ~235px tall because of a separate bottom action row (swap/edit/delete) and a large blank gap → put qty × price under the name and move the actions into a ⋮ / swipe; target ~110px per row.
- [P1] mobile 123-page.png — the hero is ~450px tall: two stacked centred buttons, then a KPI pair, then "Perubahan Hari Ini" rendered as "—", "—" and "Belum ada snapshot harga hari ini" (three lines of nothing). Portofolio starts at y≈655 → put the two buttons side by side, and fold the empty day change into one muted line or hide it.
- [P1] mobile 123–139 — the "Kepemilikan" composition card (instrument split) from desktop does not appear anywhere on mobile → show it under Tren & detail or as a compact stacked bar under the hero.
- [P2] mobile 124-page-scroll-1.png — the ticker avatar text "MANU" overflows its 36px circle, and the names wrap to three lines ("Manulife / Saham / Andalan") because the name column is ~110px → use ≤4-char initials at a smaller size, and widen the text column by moving the value under the name.
- [P2] mobile 139-click-tren-detail.png — with the Deposito filter active, "Tren & detail" opens a ~180px empty dark area that says "Belum ada investasi untuk digambar", with an orphaned Modal/Nilai legend → collapse to one empty line, and hide the legend when there is no data.
- [P2] mobile 134-click-perbarui-harga.png — the "Memuat ulang harga terbaru…" toast sits over the Portofolio card ~10px above the dock; there is no spinner on the Perbarui Harga button → show a loading state on the button itself, and anchor toasts above the dock with a consistent offset.
- [P2] mobile 126–133-tab-\*.png — the filter chip rail is cut at the right edge ("Obligasi", "De…") with no fade or scroll hint (offscreen wm-seg-label) → add an edge fade, or use a select on phones.
- [P3] mobile 124-page-scroll-1.png — the "Dividen & bunga tercatat di Transaksi →" link passes under the dock at the scroll stop → add bottom padding equal to the dock height plus 16px.

### Dialogs & forms seen

- Catat Investasi: bottom sheet with a sticky footer. Issues: crushed two-column price/qty row, truncated placeholders, a 6-line FX helper in a half column. Native English validation tooltip, already logged on desktop.

### Not reachable

- Swap/edit/delete actions on holding cards; Lihat Detail.

## aset

Scores: desktop n/a · tablet n/a · mobile 3/3/3 (Karakter/Konsistensi/Kerapian)
Verdict: The single-column port keeps the desktop's right-column-first order, so the page leads with investments and reaches its own physical assets only at the third scroll. The hero buttons reflow when toggled.

### Defects

- [P1] mobile 140–142-page\*.png — the order is hero → Investasi (3 rows) → Dana & rekening → an explanatory note card → Aset Fisik. The route's own content (Aset Fisik) first appears at y≈1500, on the 2nd–3rd scroll → put Aset Fisik right after the hero, and collapse Investasi and Dana into one summary row each that links out.
- [P1] mobile 140-page.png vs 143-click-sembunyikan-jumlah.png — the hero buttons are stacked (Sembunyikan / Tambah Aset / Tren) at first, but after toggling they become a side-by-side row (Tampilkan | Tambah Aset). The hero shrinks by ~50px and the content jumps → use the same side-by-side layout in both states.
- [P2] mobile 141-page-scroll-1.png — "Semua rekening" and "Semua dana" are two full-width grey buttons stacked with ~2px gap, so they read as one block. The card header says "19 akun" but lists 5 → use one "Lihat 19 akun" link, or two chips in a row with an 8px gap.
- [P2] mobile 141-page-scroll-1.png — "Total pakai nilai tercatat" is a 130px card holding only a footnote paragraph, placed between two data cards → turn it into an info tooltip next to the hero total.
- [P2] mobile 142-page-scroll-2.png — every 2-column physical-asset tile has a 44px action row underneath (↗, edit, delete). The ↗ button has no surface, edit is grey-filled and delete is red-filled, three styles in one row. The always-visible delete invites mis-taps → the tile already opens Edit on tap ("Ketuk kartu untuk ubah"), so drop the row and keep delete inside the sheet.
- [P2] mobile 149/151–154-\*-dialog.png vs 144-tambah-aset-dialog-open.png — Edit Aset Fisik opens with the picker on IDR and an "Rp" prefix, while Tambah Aset Fisik opens on EUR with "€" → default both to the display currency, and show the stored IDR as the helper.
- [P2] mobile 150-hapus-dialog-open.png — the delete-confirm sheet has a dark-green header band, a white footer, and ~60px of dead white below the buttons. The backdrop is a heavy full blur, unlike the dim backdrop of the other sheets → use the same sheet surface and backdrop as the form sheets, and trim the bottom padding to the safe area.
- [P3] mobile 140-page.png — the hero subline wraps as "…aset fisik, per 11 / Oktober 2026", breaking the date → shorten it ("Per 11 Okt 2026") or nowrap the date.
- [P3] mobile 141-page-scroll-1.png — the Mandiri row subtitle is truncated ("Bank · Mandiri · ···5586 ·…") while the other rows fit → drop the redundant "Bank ·" prefix.

### Dialogs & forms seen

- Tambah Aset Fisik: bottom sheet with a sticky footer; fits. Rp label and native validation already logged on desktop.
- Edit Aset Fisik (×5 via card tap/Ubah): bottom sheet; opens in IDR, unlike Add.
- Hapus confirm: header and footer styling differ from the other sheets.

### Not reachable

- Dokumen upload field of the Edit sheet (below the fold, not captured).

## liabilitas

Scores: desktop n/a · tablet n/a · mobile 3/2/1 (Karakter/Konsistensi/Kerapian)
Verdict: Below the first liability the page is a ~1,500px blank canvas: three of the four liability cards, the status card and the projection chart do not render on mobile. The add sheet's money inputs are crushed to ~48px.

### Defects

- [P0] mobile 159-page-scroll-1.png, 160-page-scroll-2.png — after the first card (KPR, "Progres Pelunasan 29%") the list card ends. Two full viewports of empty sage background follow. The other 3 of the "4 liabilitas" cards, the "Semua liabilitas berjalan lancar" card and the "Proyeksi Sisa Utang 6 Bulan" chart (all visible on desktop 177) are missing. This is likely a stuck enter animation (opacity 0) or a collapsed grid row → render every card on phones, with no scroll-triggered reveal that can stay hidden.
- [P0] mobile 167/168/169-tambah-liabilitas-\*.png — "Total Utang / Limit" and "Sisa Tagihan" sit two per row, each with its own EUR picker, which leaves a ~48px input that shows only "€ :" / "€ 8". Typed values cannot be read. "Angsuran/Bulan" in 169 is the same → one money field per row on phones, with the currency picker as an input suffix (or one picker for the whole sheet).
- [P1] mobile 167-tambah-liabilitas-dialog-open.png — the FX helper (5 lines) is repeated under every money field, and the fieldset cards (Identitas / Nominal / Bunga & Tenor) inside the sheet take another 26px of width → show one FX line at the top of the Nominal group, and drop the nested borders on mobile.
- [P1] mobile 158-page.png — the hero shows a "Dibayar • Total" legend while the chart is collapsed, so the legend points at nothing → render the legend only inside the expanded chart.
- [P1] mobile 170-click-tren-detail.png — the y-axis top label "1.250.000,00" is clipped on the left. The x-labels are truncated ("Kartu Krec", "Kredit Ken"), and a second legend ("Total • Dibayar") is stacked under the hero legend → use compact ticks (€1,25 jt), short x-labels (Kartu, Pribadi, KPR, Kendaraan), and one legend.
- [P2] mobile 158-page.png — the "Rasio utang" info icon is a 14×14 target (smallTargets) → hit area at least 36px.
- [P2] mobile 158/164/165-tab-\*.png — list titles are truncated by the due-date pill ("KPR BTN Perum…", "Kredit Kendara…") → put the pill on its own line under the title on phones.
- [P2] mobile 161–166-tab-\*.png — the 6-option filter rail inside the card is cut at both edges ("ibadi", "Lainnya" off-screen) with no fade → add an edge fade, or a select on phones.

### Dialogs & forms seen

- Tambah Liabilitas: bottom sheet with a sticky footer, but the two-column money rows are unusable at 390px; the name placeholder is truncated ("cth. Kartu Kredit B"). Native validation and Rp labels already logged on desktop.

### Not reachable

- Detail / Bayar / ⋮ on liability cards; the cards did not render on mobile.

## dana

Scores: desktop n/a · tablet n/a · mobile 4/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: The first viewport repeats the total three ways and spends a full card on a cross-link note. Each wallet then takes ~117px because its icon actions sit on their own row, so the page runs to 4 scroll stops.

### Defects

- [P1] mobile 171-page.png — the first viewport shows the total twice (hero "≈ € 331,89" and Komposisi "≈ € 331,89 Total") plus a ~310px composition card. A note card ("Kartu & bank di tempat lain") follows. The actual Tunai/E-Wallet lists start only after the first scroll → fold Komposisi into the hero "Tren & detail", and turn the note into a one-line link at the bottom.
- [P1] mobile 172/173-page-scroll-\*.png — every wallet row puts palette/edit/delete on a separate line under the balance (~117px per row). Ten wallets need 4 scroll stops → keep rows ≤64px with a ⋮ or swipe for actions, or use the rekening card treatment.
- [P2] mobile 172-page-scroll-1.png — each section has its own "+ Tambah" pill under the title, duplicating the hero "+ Tunai / + E-Wallet" buttons and the dock "+" → drop the section pills on mobile, or put them in the section header row on the right.
- [P2] mobile 172-page-scroll-1.png — the Kas Tunai icon is a pale lavender square with a near-invisible glyph, unlike the solid GoPay/OVO tiles → use a solid tile with a visible cash glyph.
- [P2] mobile 177-click-tren-detail.png — the expanded hero chart has only two x-ticks ("22 Okt", "11 Okt") and M-scale y-ticks (scale already logged on desktop); at 358px the line has no anchor → show 3–4 dated ticks with the month.
- [P2] mobile 180-ubah-dialog-open.png vs 175-tunai-dialog-open.png — Edit Kas Tunai opens in IDR ("Rp 3.000.000") while Tambah opens in EUR → default both to the display currency.
- [P2] mobile 181-hapus-dialog-open.png — the delete sheet has a dark header band, a white footer, and ~60px of dead white under the buttons, with a heavy full blur behind it → match the form-sheet surface and backdrop.
- [P3] mobile 173-page-scroll-2.png — the "Saldo kas boleh minus…" paragraph sits outside any card, between two cards, at body width → put it inside the Tunai card as a muted footnote.

### Dialogs & forms seen

- Tambah Kas Tunai: short bottom sheet with a sticky footer; ok.
- Tambah E-Wallet: ok, but the "+ Tambah ke Master Data" link is 18px tall (smallTargets).
- Ubah tampilan kartu: ok.
- Edit Kas Tunai: bottom sheet; IDR default differs from Add.
- Hapus: inconsistent sheet styling.

### Not reachable

- Mutasi "Lihat Semua" target.

## asuransi

Scores: desktop n/a · tablet n/a · mobile 3/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: Policy cards read well, but the hero carries an orphaned three-series legend. The add and edit sheets crush the premium field to one visible digit, and validation arrives as a toast that covers the form.

### Defects

- [P0] mobile 190-detail-dialog-open.png — Edit Asuransi shows "Premi" as "Rp 8" and "Uang Pertanggungan" as "Rp 5": the ~60px input is squeezed by the IDR picker, so the stored values (850.000 / 500.000.000) cannot be read or checked → one full-width money field per row on phones, with the picker as a suffix.
- [P1] mobile 186/188-tambah-\*.png — Tambah Asuransi has the same crush: "€ 0" / "€ 1.2" in a ~60px box, with a 6-line FX helper in a half column → same fix; one FX line.
- [P1] mobile 187-tambah-validation.png, 188-tambah-filled.png — empty submit shows a floating toast "Nama asuransi wajib diisi" over the form (covering the "Uang Pertanggungan" labels) instead of an inline error. The toast is still on screen after the fields are filled (188) → show an inline error under Nama Asuransi, scroll to it, and dismiss the toast on input.
- [P1] mobile 182-page.png — the hero shows a 3-item legend (Asuransi Jiwa / Kesehatan / Kendaraan) on two lines while the chart is collapsed; the legend points at nothing and pushes the hero to ~270px → only render the legend inside the expanded chart.
- [P2] mobile 183-page-scroll-1.png — each policy card's action row mixes three styles: a white pill "Detail", a bare text "Bayar Premi" with no surface (bordered only on the last card), and a bare ⋮. There is ~70px of empty gap between Detail and Bayar Premi → use one row of equal-weight pills, or primary "Bayar Premi" + ⋮ (with Detail in the menu).
- [P2] mobile 182-page.png — the breakdown row label is truncated ("Asuransi Kesehat…") so that the amount fits → drop the "Asuransi" prefix in the breakdown, or wrap.
- [P2] mobile 185-bayar-premi-dialog-open.png — the Bayar Premi sheet is a dead end: a dark header band, one "Batal" button, and ~60px of empty white below it → disable the button when nothing is due (content already logged on desktop); otherwise match the sheet styling.
- [P2] mobile 191-opsi-lainnya-menu-open.png — the ⋮ menu is a popover covering the next card's title ("BPJS Kesehatan K…") rather than an action sheet → action sheet on phones.
- [P3] mobile 189-click-tren-detail.png — "Perpanjangan terdekat" wraps to three bold lines in a half-width column ("Asuransi Kendaraan / Toyota Avanza · 176 / hari lagi") → full-width row, with the days as a separate pill.

### Dialogs & forms seen

- Bayar Premi: dead-end sheet with inconsistent styling.
- Tambah Asuransi: bottom sheet with a sticky footer; crushed money input, toast-only validation, stale toast.
- Detail (= Edit Asuransi): crushed IDR inputs show single digits.
- Opsi lainnya: popover menu.

### Not reachable

- Hapus confirmation from the ⋮ menu.

## ai

Scores: desktop n/a · tablet n/a · mobile 3/4/3 (Karakter/Konsistensi/Kerapian)
Verdict: Mobile is tidier than desktop (no clipped FAB), but the route is still one locked card followed by ~330px of empty sage canvas.

### Defects

- [P1] mobile 192-page.png — below the 280px lock card the viewport is empty down to the dock (~330px) → show what the advisor does (3 example prompts, a blurred sample answer) under the lock, so the empty state sells the feature.
- [P2] mobile 192-page.png — the dock highlights "Menu" on the AI Advisor route, as on every non-dock route; this is the only signal of location besides the small "AI Advisor" heading → acceptable, but consider a back affordance in the top bar for routes reached from Menu.

### Dialogs & forms seen

- none

### Not reachable

- "Buka Pengaturan" target (not clicked).

## kalkulator

Scores: desktop n/a · tablet n/a · mobile 3/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: The 7-tile picker eats the first viewport, so on phones every result sits below the inputs and below the fold. The PPh 21 header button overflows the card.

### Defects

- [P1] mobile 193-page.png, 195–201-tab-\*.png — the calculator picker is a 2-column grid of 7 tall tiles (~380px, with an orphan "Split Group" tile). The selected calculator's form starts at y≈555 and its result only after a full scroll (194) → use a horizontal chip rail for the picker (~48px), and show a sticky compact result bar ("≈ € 31.197,21 · Estimasi nilai akhir") at the top of the form.
- [P1] mobile 196-tab-pph-21.png — the "Rincian lapisan tarif" button overflows the card's right edge and is cut at the viewport ("Rincian lapisan tari") → wrap it under the heading as a full-width secondary button on phones.
- [P1] mobile 194-page-scroll-1.png — the Investasi chart runs edge-to-edge past the card padding (the line starts at x=14). The y-ticks still read "600M/400M/200M", and the top tick is hidden under the "≈€ 31.197,21" chip; at 358px the right-side tick column takes ~45px → inset the plot inside the padding, use compact € ticks, and keep the top tick clear of the chip.
- [P2] mobile 195/196/199-tab-\*.png — the active tile switches from lime fill (first load, 193) to grey (#e5e5e0) after a tap; at phone size the grey active state is barely distinguishable from the idle tiles → one lime active style.
- [P2] mobile 202-nav-buat-split-bill-dari-hitungan-ini.png — "Buat Split Bill dari Hitungan Ini" lands on /splitbill scrolled mid-page: the top bar and the hero's top are off-screen, so the user arrives without context → scroll to top (or open the prefilled create sheet) on navigation.
- [P2] mobile 202-nav-buat-split-bill-dari-hitungan-ini.png — the landing hero shows an orphaned "Terkumpul • Total" legend with the chart collapsed. "Split Bill Aktif" uses cramped 2-column cards where "Makan Malam An…" is truncated and the meta wraps to 4 lines → render the legend only when the chart is open, and use 1-column rows on phones.

### Dialogs & forms seen

- none (inline forms only; Rp-labelled inputs already logged on desktop)

### Not reachable

- Zakat/PPh/Pensiun result cards below the fold (not captured on mobile).

## notifikasi

Scores: desktop n/a · tablet n/a · mobile 3/3/3 (Karakter/Konsistensi/Kerapian)
Verdict: A 260px dark hero spends the first viewport on a giant "0", so only two notifications fit above the fold. Rows run the title and body together in one paragraph.

### Defects

- [P1] mobile 203-page.png — the hero is ~260px for "0 notifikasi belum dibaca", a primary "Tandai semua dibaca" button (enabled at 0, already logged on desktop) and two KPIs. Only 1.5 notifications are visible in the first viewport → on mobile collapse the hero to a one-line summary bar ("0 belum dibaca · 2 jatuh tempo"), with the mark-all action as a text button in the list header.
- [P2] mobile 203/204-page\*.png — each row is one run-on paragraph (bold title followed by grey body text), wrapping to 3–4 lines. All rows look equally greyed, with no read/unread distinction, and every icon is the same bell → title on its own line, body in a 2-line clamp, category-specific icons, and an unread dot.
- [P2] mobile 203–211-tab-\*.png — the 8-option filter rail inside the card is cut at the right edge ("Ang…", "Ja…", offscreen wm-seg-label) with no fade, and the selected chip scrolls out of view as you move along → add an edge fade, and scroll the active chip into view.
- [P2] mobile 206/209/211-tab-\*.png — empty filters show a single grey sentence in a 200px card followed by ~170px of blank page → a small illustration/icon plus a "Lihat semua" link back.
- [P3] mobile 204-page-scroll-1.png — the first item under "Hari Ini" has no divider while the "Minggu Ini" items do → consistent separators.

### Dialogs & forms seen

- none

### Not reachable

- Individual notification tap targets / deep links.

## akun

Scores: desktop n/a · tablet n/a · mobile 3/2/3 (Karakter/Konsistensi/Kerapian)
Verdict: The hero identity block is misaligned, with the camera badge sitting on the role chip. Edit profil is the only form in this batch that opens as a right-side drawer instead of a bottom sheet.

### Defects

- [P1] mobile 221/222/223-edit-profil-\*.png — Edit Profil opens as a 292px right-side drawer, leaving a 98px strip of the page visible. Every other form on mobile is a bottom sheet. The close "×" is ~24px and the footer has only "Simpan Perubahan", with no Batal → use the standard bottom sheet with the Batal/Simpan sticky footer.
- [P1] mobile 222/223-edit-profil-\*.png — the "Profil berhasil disimpan" toast floats over the form, covering the Pekerjaan/Penghasilan fields, while the drawer stays open → close the sheet on success, then toast above the dock.
- [P1] mobile 214-page.png — the avatar's camera badge overlaps the "Master" chip, and the name/badge/email block is offset right of the avatar with uneven alignment (chip under the avatar edge, email starting mid-way) → stack the avatar above the centred name, or align the chip and email under the name's left edge, with the badge inside the avatar bounds.
- [P2] mobile 214-page.png, 224-click-tren-detail.png — the profile-completeness bar fills segments 2–5 and leaves segment 1 empty (4/5). It appears twice when "Tren & detail" is open (hero "Kelengkapan profil 80%" plus the Profil tab card) → fill left to right, and show it once.
- [P2] mobile 214-page.png — the "Tren & detail" toggle on a profile page opens member/session/theme counts, not a trend → rename it "Ringkasan akun", or inline the three counts.
- [P2] mobile 215-page-scroll-1.png, 225-info-dialog-open.png — the info icon under "Anggota (2)" sits alone on its own row. Its tooltip ("Untuk anggota tanpa email…") applies to a specific member, not the heading → put the hint next to the member it applies to.
- [P2] mobile 215-page-scroll-1.png — the Ana Demo row action is a 28×28 unlabelled gauge icon (smallTargets) → a 36px+ target with a label ("Batas transaksi").
- [P2] mobile 217-tab-keamanan.png — the Ubah Password / PIN Aplikasi tiles are bare icon + text in two narrow columns, with descriptions wrapping to 3 lines; they do not look tappable → full-width bordered rows with a chevron.
- [P2] mobile 223-edit-profil-filled.png — the "Penghasilan Bulanan" input has no currency prefix, and its placeholder reads "cth: Rp 25.000.000" on a EUR account → € prefix and a display-currency placeholder.
- [P3] mobile 226-batas-transaksi-besar-ana-demo-dialog-op.png — "Kosongkan untuk tidak membatasi" appears twice (subtitle and helper), and the title wraps onto 2 lines ("— Ana / Demo") → keep the helper only, and put the member name in a subtitle.
- [P3] mobile 214–219-tab-\*.png — the 4-tab rail is cut at the edge ("Bant…", "ofil") at 390px, where four short labels could fit → use equal-width tabs with no scroll.

### Dialogs & forms seen

- Edit Profil: right drawer, not a bottom sheet; no Batal; the toast covers fields.
- Info tooltip: ok, but anchored to an orphaned icon.
- Batas Transaksi Besar: proper bottom sheet with a sticky footer; duplicated helper copy.
- Ganti foto: no visible change beyond an avatar ring (native picker).

### Not reachable

- Keamanan toggles below the fold, Preferensi currency selector, Bantuan FAQ answers (not opened on mobile).
