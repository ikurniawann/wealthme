## investasi

Scores: desktop n/a · tablet 3/2/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: At 834px the page is a stretched phone layout: one column throughout, a 250px hero chart that is almost all empty canvas, and a 680px side sheet that is neither the bottom sheet nor the 460px sheet used on sibling pages.

### Defects

- [P1] tablet 599-page.png — the hero chart is ~250px tall across 750px, but the Bank and Telkom bars are 3–5px stubs, so ~90% of the hero is empty dark green. Single-column stacking makes the empty area worse than on desktop → at tablet, use a horizontal bar list (ticker, value, % return) or cap the chart at ~140px.
- [P1] tablet 599-page.png — the y-axis label "≈ € 24.641,99" is drawn from x≈12, outside the card's 14px edge, so it touches the card border and clips "≈" → give the plot a left gutter inside the card padding.
- [P1] tablet 599-page.png — the Modal/Nilai legend appears twice: once right-aligned under the buttons (y≈180) and once left-aligned above the plot (y≈208), in different swatch styles (dot vs square) → keep one legend.
- [P1] tablet 599/600-page.png — the 834px width is used as one column: Kepemilikan is a full-width card holding two rows, and the delayed-price note and the "Perkiraan pajak final" card are full-width cards with one line each and ~400px of blank right side → put Kepemilikan beside the hero KPIs, or put the note and tax cards side by side in a 2-col bento.
- [P1] tablet 600-page-scroll-1.png — each Portofolio row's action cluster mixes sizes: the swap button is ~28px with an outline, while edit and delete are ~44px filled squares. On a touch viewport the 28px swap target is too small → use one 40–44px icon-button size and style for all three.
- [P2] tablet 600-page-scroll-1.png — the ticker avatars "BBCA"/"TLKM"/"MANU" overflow their 36px circles, and the text runs past the circle edge ("MANU" touches the card padding) → use 2-letter monograms or a wider pill.
- [P2] tablet 600-page-scroll-1.png — the instrument filter is above Portofolio here, but on desktop (143/144) it is an orphan pill at the bottom of the page. The same component has two placements → use the tablet placement on desktop.
- [P2] tablet 599-page.png — the topbar shows the plain "WealthMe" wordmark with no logo mark, and the page title "Investasi" is right-aligned next to the icons. The desktop shows logo + title on the left → on tablet, put the title on the left after the logo, or drop the duplicate wordmark.
- [P2] tablet 604-tab-obligasi.png, 613 — with an empty filter, the hero keeps its full 250px chart area and shows one line, "Belum ada investasi untuk digambar.", at the top-left, leaving ~280px of empty dark panel → collapse the chart area to the message height.
- [P2] tablet 613-click-untung-modal-1-031-84-24-641-99.png — tapping the "Untung / Rugi Total" KPI does nothing visible (identical to 608). The KPI reads as tappable at tablet size → make it non-interactive, or open a breakdown.

### Dialogs & forms seen

- Catat Investasi (610/611/612): right side sheet 680px wide, leaving a 154px strip. This differs from the 460px sheet on aset/liabilitas/dana/asuransi and from the bottom sheet the rubric expects ≤768. With 7 fields there is ~260px of dead white above the footer. "Harga Beli per Unit" is squeezed to ~200px next to the EUR picker ("€ 1.250.000" fits only because the column is half width). Use one sheet width (≈520px) at tablet.

### Not reachable

- Lihat Detail per position and the swap/edit/delete row actions were not opened at tablet.

## aset

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The hero works at 834px, but the lists are full-width single-column rows, and the 3-column Aset Fisik grid is too narrow: titles collide with the edit/delete buttons.

### Defects

- [P1] tablet 615-page-scroll-1.png — in the 3-col Aset Fisik grid (~250px cards), the title, the ↗ glyph and two 44px action buttons share one row. "Rumah Depok" is overprinted by the ↗ icon. "Emas Antam 50 gram" breaks to "Emas Antam 50 / gram" with the ↗ over the "0". "MacBook Pro M3" and "Toyota Avanza 2021" wrap to two lines → use 2 columns at tablet, or move edit/delete to a ⋮ menu / bottom of the card.
- [P1] tablet 615-page-scroll-1.png — "Semua rekening" and "Semua dana" are two full-width grey buttons stacked with 0px gap, so they read as one split block → add a 8–12px gap, or merge them into one link row.
- [P1] tablet 615-page-scroll-1.png — "Total pakai nilai tercatat" is a full-width card holding a heading plus two lines of text capped at ~480px, leaving ~300px empty on the right → fold it into the Aset Fisik header as a hint, or pair it with another card in a 2-col row.
- [P2] tablet 614-page.png — the Investasi and Dana & rekening lists are full-width rows: name at x=80, amount at x≈800, with ~450px of empty gap. At 834px these two lists fit side by side as a 2-col bento, as on desktop → use 2 columns ≥768.
- [P2] tablet 614-page.png — the hero headline "≈ € 94.239,69" is repeated 60px below as the "Komposisi aset" total, which costs ~70px of the first viewport on tablet → drop the second figure (already noted on desktop; the cost in height is larger here).
- [P2] tablet 615-page-scroll-1.png — the Aset Fisik card actions are 44px filled squares (grey edit, pink delete), while the Investasi/Dana rows have no actions and the Investasi page uses a 3-size cluster → one action pattern.

### Dialogs & forms seen

- Tambah/Edit Aset Fisik (617/619/620/621/627/628/629): 460px right side sheet. It fits, but ~150px is blank below Dokumen and the 374px strip of page beside it is wasted. "Nilai Aset" with the EUR picker is fine at this width.
- Hapus (622): centred 400px modal. The dark header has a hairline divider running between the title and the description (y≈510) that cuts through the header band. It is a different dialog family from the side sheets (dark header vs plain white header).

### Not reachable

- None evident.

## liabilitas

Scores: desktop n/a · tablet 3/2/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The 2-col liability cards suit tablet, but the hero chart is mostly void with a clipped axis label, filtered tabs leave half-empty grids, and the 460px sheet crushes its paired currency inputs to unreadable widths.

### Defects

- [P1] tablet 638-tambah-liabilitas-dialog-open.png, 640 — in the 460px sheet, "Total Utang / Limit" and "Sisa Tagihan" sit side by side, each with its own EUR picker. The inputs are ~80px wide and show "€ 30.00", "€ 8.000", "€ 1.250" (the real value is 1.250.000). Each FX helper wraps to 5 lines under its half column → at tablet, widen the sheet (≥560px) or stack the money fields one per row.
- [P1] tablet 630-page.png — the y-axis label "1.250.000,00" starts at x≈12, outside the card padding, and loses its "≈ €". The plot is ~170px tall, but three of four categories are 1–3px stubs → inset the axis, and use a horizontal progress list per liability at tablet.
- [P1] tablet 630-page.png — the legend is duplicated ("Dibayar • Total" right-aligned under the button, "Total • Dibayar" left-aligned above the plot) in opposite order and with different swatch shapes → one legend.
- [P1] tablet 634-tab-pinjaman-pribadi.png — a filter with one result leaves a single card in the left column and an empty right half of the grid → let a single card span both columns, or keep the grid left-aligned and add a "Tambah" ghost tile as on Aset/Split.
- [P1] tablet 631-page-scroll-1.png — the "Detail" button stacks its icon above the label in a ~60×32 pill, so "Detail" sits on the pill's bottom edge. "Bayar" and "Sudah dibayar periode ini" are icon-inline → inline icon + label at a 40px height.
- [P2] tablet 630-page.png — "Rasio utang" is a full-width card with a 770px progress bar, and "Semua liabilitas berjalan lancar" (631) is a full-width card with one line of text. On desktop these are side by side → pair them in a 2-col row at tablet.
- [P2] tablet 631-page-scroll-1.png — "Kredit Kendaraan Toyo…" is truncated in a ~400px card, although the status pill could wrap below the title → let the title wrap to 2 lines, or move the pill under it.
- [P2] tablet 637-tab-lainnya.png — the empty-state line "Belum ada liabilitas…" sits 10px under the tab bar with no vertical padding, and the card ends right after it → give the empty state the same padded block used on Notifikasi (673).
- [P2] tablet 631-page-scroll-1.png — the projection chart's y-axis labels (600M…0) sit to the right, outside the plot, while the other charts on this page put labels on the left → one axis side.

### Dialogs & forms seen

- Tambah Liabilitas (638/639/640): 460px side sheet with grouped fieldsets (Identitas/Nominal/Bunga & Tenor). The fieldset legends overlap the top border. In 640 the Angsuran/Bulan money input is crushed to ~70px showing only "€". Long scroll: the footer is visible but the last fields sit under it.

### Not reachable

- Detail, Bayar and ⋮ menus on the liability cards were not opened at tablet.

## dana

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The hero and composition read well, but the Tunai and E-Wallet lists lose their desktop side-by-side layout and become full-width rows with a floating badge column. Each short form opens a mostly empty full-height side sheet.

### Defects

- [P1] tablet 642-page-scroll-1.png — in the Tunai and E-Wallet rows, the "Bersama" badge and "diperbarui 11 Okt" float in a column at x≈600–660, ~140px from the card's right edge, with nothing to the right. The amount stays at the left under the name → right-align the meta to the card padding, or put the amount on the right as in Mutasi.
- [P1] tablet 642-page-scroll-1.png — Tunai (one row) and E-Wallet are stacked full-width. Desktop (188) places them side by side, and the 834 viewport has room for that → use 2 columns at ≥768.
- [P1] tablet 642-page-scroll-1.png — the "Saldo kas boleh minus…" footnote is set on the bare page background between two cards, at 16px side padding instead of the 32px card inset, so it reads as stray text → put it inside the Tunai card or under the Mutasi header.
- [P2] tablet 642-page-scroll-1.png — the "+ Tambah" buttons are ~80×44 with ~11px bold text, smaller than every other add button on the page (hero "+ Tunai"/"+ E-Wallet") → same size and label style.
- [P2] tablet 642-page-scroll-1.png — the Kas Tunai icon is a pale lavender square with a near-invisible glyph, while the e-wallet icons are saturated brand tiles → give cash a solid tile.
- [P2] tablet 641-page.png — "Kartu & bank di tempat lain" is a full-width card whose text is capped at ~500px → pair it with Komposisi in a 2-col row, as on desktop.
- [P2] tablet 642-page-scroll-1.png — three e-wallet rows read "GoPay" with no number or label, so they cannot be told apart → show the masked number ("GoPay ···1234") as Rekening does.

### Dialogs & forms seen

- Tambah Kas Tunai (643): 460px full-height side sheet with 3 fields. ~640px of the sheet is empty white. Use a centred modal or a content-height sheet at tablet.
- Tambah E-Wallet (644)/Tambah (645): same problem; ~530px empty.
- Edit Kas Tunai (647): same; the IDR picker is shown although the account displays EUR (consistent with desktop).
- Ubah tampilan kartu (646): uses a dark gradient header, unlike the white headers of the other sheets. The card preview has a drop shadow (the system uses no shadows). The swatches and motif tiles fit.
- Hapus (648): centred 400px modal. The description wraps at ~230px ("…tidak bisa / dikembalikan.") inside a 400px box, and a hairline cuts between the title and the body in the dark header.

### Not reachable

- Card-skin result on the page: the tablet list never shows the card visual that "Ubah tampilan kartu" edits, so the dialog's effect is not visible on this route.

## asuransi

Scores: desktop n/a · tablet 3/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The 2-col policy cards suit 834px, but the hero spends ~230px on a single 28px bar. The add/edit sheet crushes its money inputs to ~80px, and its error toast straddles the sheet edge.

### Defects

- [P1] tablet 649-page.png — the hero chart is one stacked bar ("Okt"), 28px wide, centred in a ~750×200 plot, so the hero is ~85% empty → at tablet, replace it with three premium rows (Jiwa/Kesehatan/Kendaraan) or a 12-month strip.
- [P1] tablet 650-page-scroll-1.png — the policy card actions are inconsistent: "Bayar Premi" is plain text with an icon on three cards and an outlined pill on the fourth. "Detail" is a small white pill with no icon → one button style; the hit area must be ≥40px on all.
- [P2] tablet 649-page.png — "Perpanjangan terdekat" wraps to two bold lines ("Asuransi Kendaraan Toyota Avanza · / 176 hari lagi"), while the other two KPIs are one number each → show the name small and "176 hari" as the value.
- [P2] tablet 650-page-scroll-1.png — "Tidak ada perpanjangan dalam 30 hari" is a full-width card with two lines, leaving ~300px empty on the right → merge it into the Polis header or the hero KPI.
- [P2] tablet 656-opsi-lainnya-menu-open.png — the ⋮ menu has a drop shadow and a pill-rounded container, and it overlaps the neighbouring card's title ("Asuransi Kendaraan Toyo…") → anchor the menu inside the card or flip it upward; use no shadow, per the system.

### Dialogs & forms seen

- Tambah Asuransi (652/653/654): 460px side sheet. "Premi" and "Uang Pertanggungan" each pair an ~80px input with an EUR picker, showing "€ 1.250.0". Each FX helper wraps to 5–6 lines in a half column. The subtitle wraps to 2 lines. In 654 the scrolled body runs under the header with no divider, so the "Jenis" label is hidden. Validation (653) shows only a toast, "Nama asuransi wajib diisi", centred on the page (x≈240–595): it straddles the sheet's left edge, covers the "Catatan" label, and does not highlight the field.
- Edit Asuransi via "Detail" (655): the same crushing ("Rp 850.0(", "Rp 500.0(").
- Bayar Premi (651): centred 480px modal. The only action is a full-width "Batal". A hairline cuts the dark header between the title and the description. It has an × close button, while the Hapus modals on other pages have none.
- Opsi lainnya menu (656): see the defect above.

### Not reachable

- Hapus confirm for a policy was not opened at tablet.

## ai

Scores: desktop n/a · tablet 2/3/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The route is a 456px card in the top-centre of an 834×1112 screen, with ~650px of blank sage below it.

### Defects

- [P1] tablet 657-page.png — the locked card is 456px wide and centred, while every other tablet page uses full-width 806px cards. The card ends at y≈390, and nothing fills the space down to the dock at y≈1044 → use a full-width locked chat layout (sample prompts and a disabled composer pinned above the dock).
- [P2] tablet 657-page.png — the hero notch cut-out is at the centre of a narrow card, so it nearly touches the lock icon (gap ~30px) → drop the notch on non-hero cards, or widen the card.
- [P2] tablet 657-page.png — the body copy is centred, with the arrow path "Akun → Pengaturan" mid-sentence. "Buka Pengaturan" is a small 132×44 light pill → use a full-width primary button for the single action.

### Dialogs & forms seen

- none

### Not reachable

- The chat UI itself, because no API key is configured.

## kalkulator

Scores: desktop n/a · tablet 3/2/2 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The calculator picker's tiles fill the first 350px, and the live result sits below the fold, so on tablet you cannot see the result while you edit the inputs. The hero chart bleeds to the card edges.

### Defects

- [P1] tablet 658-page.png — the 7 calculator tiles are 56px tall in a 2-col grid, ending with an orphan "Split Group" tile and an empty right cell. Picker plus intro take y=87–435. Desktop uses 3 columns → use a horizontally scrollable segmented pill row (as Notifikasi/Liabilitas do), or 4 columns at tablet.
- [P1] tablet 658-page.png — the result hero starts at y≈717, and its lower half (Total setoran / Hasil pengembangan) is under the dock. Editing an input never shows the updated result in the same view. Desktop puts the result beside the form → at 834, use form and result side by side, or a sticky result strip.
- [P1] tablet 658/659-page.png — the Investasi chart runs edge to edge in the hero (line starts at x=14, "Th 0" at the card edge). The y-labels "600M…0" sit in a 46px strip outside the plot, at the right card edge. The top tick is hidden under the "≈€ 31.197,21" pill ("?00M") → inset the plot inside the card padding.
- [P1] tablet 660-tab-zakat-maal.png — the Zakat result hero is a 175px dark block holding only the faint grey text "Hitung Zakat", which duplicates the button label directly above it → hide the block until computed, or show a real placeholder ("Isi data lalu tekan Hitung").
- [P2] tablet 660-tab-zakat-maal.png, 666 — the "Hitung Zakat" and "Buat Split Bill dari Hitungan Ini" buttons have a visible drop shadow, unlike every other button → no shadow.
- [P2] tablet 663-tab-kpr.png — the result hero has no notch-to-content spacing consistency: the headline sits 20px under the notch on KPR and Investasi, but on Split (666) it sits 30px under → align it.
- [P2] tablet 666-tab-split-group.png — the per-person rows (Andi…Dani, then hidden) continue under the dock, and the last row is cut at y≈1040 → add bottom padding equal to the dock height on this route.

### Dialogs & forms seen

- none (all inputs inline). The number inputs (Jangka Waktu, Imbal Hasil, Bunga, Tenor, Jumlah Orang, Pajak, Tip) have a dark 1px border, while the Rp inputs have a light border: two input styles side by side in every form.

### Not reachable

- 661 PPh 21, 664 Pensiun, 665 Tabungan were not individually re-inspected beyond the pattern (the same tile/result layout applies).

## notifikasi

Scores: desktop n/a · tablet 3/3/3 · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The hero and pill tabs fit 834px, but the list is short and the page leaves ~180–520px of empty sage above the dock. The hero's 2-column KPI split doesn't match the 3-column heroes elsewhere.

### Defects

- [P1] tablet 668-page.png, 673, 676 — the content ends at y≈866 (y≈522 on empty filters), and empty sage fills the rest of the screen above the dock. On empty filters this is ~520px → let the list card fill the height (min-height to the dock), with the empty state centred in it.
- [P2] tablet 668-page.png — the hero KPI row has two columns, Persetujuan (x=46) and Jatuh tempo (x=424), at 50/50. The other tablet heroes use 3 equal columns at 46/297/547 → use the same 3-col grid; add "Transaksi" or leave a blank third column.
- [P2] tablet 668-page.png — the counter "5 notifikasi" sits outside the pill bar, right-aligned in the ~95px left over. On filters it reads "0 notifikasi" next to a bar that nearly touches it (gap ~25px) → move the counter under the section heading.
- [P2] tablet 668-page.png — read notifications render their body text in light grey (#9a9a9a-ish) on white. At 15px this is low contrast for an entire list once everything is read → keep the body at secondary-text contrast; mark unread with weight and a dot instead.
- [P3] tablet 668-page.png — the topbar bell does not show an active state while you are on the Notifikasi page → highlight it on this route.

### Dialogs & forms seen

- none

### Not reachable

- Unread state at tablet: the desktop pass had already marked everything read, so the unread styling was never captured at 834.

## cross-route (tablet)

- [P1] tablet all routes — tablet uses the mobile shell: a "WealthMe" text-only wordmark, a right-aligned page title, and a 5-column dock stretched to 834px with ~170px between items and 10px labels. There is no sidebar rail and no "Catat transaksi" button in the topbar. The dock "Menu" item stays lime-highlighted on every page in this batch, because none of them is a dock destination → at ≥768, use a collapsed icon rail, or at least a dock capped at ~480px and centred; show the active section.
- [P1] tablet all form routes — sheet widths differ: Catat Investasi is 680px, while Aset/Liabilitas/Dana/Asuransi are 460px. Neither matches the rubric's bottom sheet ≤768 or a centred modal. The 460px sheets crush the paired money+currency inputs; the 680px sheet wastes space → one tablet sheet width (~560px), with money fields one per row.
- [P2] tablet all dialogs — there are three header treatments: white header with grey × (sheets), dark gradient header with × (Ubah tampilan kartu, Bayar Premi), and dark gradient header without × (Hapus). The dark ones have a hairline cutting between the title and the subtitle.
- [P2] tablet investasi/liabilitas/kalkulator/split — the chart's top y-axis label is clipped at the left or top card edge in every hero bar chart at 834px.
