## mastercoa

Scores: desktop 3/3/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The forest hero and bento shell are on-brand, but the 106-card account grid breaks its own columns, the hero chart is meaningless, and English/Indonesian labels are mixed throughout.

### Defects

- [P1] desktop 383-page-scroll-2.png, 384-page-scroll-3.png — card 20404 "Medical Supplies & Accessories" is wider than its grid column and runs past the "Semua akun" card edge (to ~1090px), on top of the gutter → set `min-width:0` on grid items and clamp or wrap titles to 2 lines.
- [P1] desktop 384-page-scroll-3.png — "Public Transport & Ride-Hail" title is clipped at the card edge and pushes into the "Service/Maintenance" card → same fix: wrap or ellipsis inside a fixed column.
- [P1] desktop 383-page-scroll-2.png, 385-page-scroll-4.png, 386-page-scroll-5.png, 398-click-4piutang5-akun-mutasi.png — cards with long names ("Clothing & Accessories", "Penalti Pelunasan Pinjaman", "Donation Religious/Ministry", "Pending Reimbursement", "Personal Loan (to others)") widen their cells, so cards overlap neighbours and stick out of the white container (398: the Personal Loan card ends ~1035px, past the container at 1032px) → fixed equal tracks (`minmax(0,1fr)`).
- [P1] desktop 381-page.png — hero shows "Daily average 18 · 1 – 6" with a bar chart of accounts per group; "daily average" has no meaning for a chart of accounts, and the x-axis shows only group numbers 1–6 → drop the chart, or label it "Akun per grup" with group names on the axis.
- [P1] desktop 381-page.png — the hero's right column contains only two stats, and roughly 60% of the dark card below them is empty → spread the stats down the full height, or shorten the hero.
- [P1] desktop 382-page-scroll-1.png, 383-page-scroll-2.png, 384-page-scroll-3.png — in the "89 akun COA belum terhubung" list, names are squeezed into a ~130px column inside a 376px card, so words break mid-word ("Maintenance/Repai r", "Service/Maintenanc e", "Gadgets/Electronic s") → let the text column fill the row and use `overflow-wrap:normal`.
- [P1] desktop 381-page.png, 401-60001pajak-penghasilan-pengeluaran-fixed.png — group names are English ("Income", "Expense", "6 · Tax") in the side list, the section titles and the Grup select, while the unlinked list uses "Pendapatan/Beban/Alokasi" and Data Master (388) uses "Pendapatan/Beban" → use one Indonesian group vocabulary everywhere.
- [P1] desktop 395-click-1income12-akun-pemasukan.png, 398-click-4piutang5-akun-mutasi.png, 400-click-6pajak8-akun-pengeluaran.png — clicking a group filters the grid, but the "Grup akuntansi" list shows no selected state ("Semua" still looks active, the clicked row is not highlighted) → highlight the active row in forest/lime.
- [P2] desktop 381-page.png — the "Semua" row's right-side chip is an empty grey circle containing only "·", unlike the coloured direction chips on the other rows → remove it or show a count.
- [P2] desktop 381-page.png — the hero says "Kategori terhubung 22 dari 22 kategori" (everything linked) next to "Akun kosong 89 perlu dicek" and a "89 akun COA belum terhubung" card; side by side these read as contradictory → reword to "22/22 kategori punya akun · 89 akun belum dipakai kategori".
- [P2] desktop 381-page.png, 382-page-scroll-1.png — account names mix English seed data ("Salary Dax", "Household Needs", "Other Income") with Indonesian ("Gaji", "Pemasukan Lainnya"), and duplicates appear ("Passive Income" as both 10005 and 10301; "Rumah Tangga" 20008 next to "Household Needs" 20101) → clean up the seed data, or show the parent code for disambiguation.
- [P2] desktop 386-page-scroll-5.png, 387-page-scroll-6.png — Mutasi cards drop the "· Fixed/Variable" meta, so card rows have uneven content compared with Pemasukan/Pengeluaran cards → show "—" or keep the meta slot.
- [P2] desktop 387-page-scroll-6.png — the grid ends with about 270px of empty white container under the last row ("Tambah Akun" tile), while the sidebar list keeps going → don't stretch the left card to match the right one, or paginate the right list.
- [P2] desktop 381-page.png — the hero action pills (Master Data / Panduan / Tambah Akun) float mid-card, right-aligned under the big number, not aligned to the top-right like other pages' heroes → anchor them to the hero header row.
- [P3] desktop 381-page.png — every account card shows a trash icon all the time, which is heavy visual noise across 106 cards → show it on hover/focus only.

### Dialogs & forms seen

- Panduan "Apa itu Master COA?" (389): the examples hardcode "Rp 10.000.000" / "Rp 1.500.000" while the account currency is EUR; the close button sits inside the gradient header and overlaps the text's right margin; the example boxes are clipped by the scroll area with no fade → use the account currency formatter and add a scroll affordance.
- Tambah Akun COA (390–393): empty submit shows the browser-native "Please fill out this field." bubble, not the inline red helper text used by IAM (438); "Kode Akun" accepts free text ("Audit"), and the error only arrives as a raw English server toast ("COA code "Audit" must be exactly 5 digits") instead of an inline field error; "Kode Induk" also accepts text; "Budget Type" is an English label among Indonesian ones.
- Edit Akun COA (401, 403–415): reuses the add-form subtitle "Kode dibuat otomatis dari grup yang dipilih", which is wrong for editing an existing code; "Kode Induk" is empty for every account, including codes that clearly have a parent (60101 → 601) → prefill the parent or hide the field.
- Hapus Akun COA? (402–416): the header shows a visible seam or second band under the title (gradient split at ~y353); the dialog never names the account being deleted ("Hapus Akun COA?" only) → put "Hapus 60001 · Pajak Penghasilan?" in the title.
- Two dialog systems on one page: centred modal (Panduan, Hapus) and right side sheet (Tambah/Edit). Acceptable, but the Panduan modal is a third, wider centred variant with a dark header.

### Not reachable

- No successful create: the crawler's code "Audit" was rejected, so the created-record-appears state was not shown.

## panduan

Scores: desktop 3/3/3 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Clean and readable, but the topic grid leaves ragged half-empty rows, the black icon tiles are off-palette, and the FAQ contradicts the Rekonsiliasi page.

### Defects

- [P0] desktop 428-click-kenapa-statement-pdf-dari-bank-say.png vs 429-nav-rekonsiliasi.png — the FAQ says PDF statements are rejected and to upload CSV instead, but the linked Rekonsiliasi page says "Upload file PDF, Excel, atau CSV" and shows a PDF chip → align the FAQ copy with real upload support (or remove PDF from Rekonsiliasi).
- [P1] desktop 417-page.png — the "Tombol "+" Catat Transaksi" topic says "Klik ikon "+" di sidebar", but the desktop sidebar has no "+"; the action is the "Catat transaksi" button in the top bar → fix the copy per viewport.
- [P1] desktop 417-page.png, 418-page-scroll-1.png, 419-page-scroll-2.png, 420-page-scroll-3.png — 4-column topic grids leave orphan rows (Transaksi: 1 card alone on row 2; Anggaran: 2 of 4; Laporan 3 of 4; Keluarga 3 of 4; Keamanan 2 of 4) with large empty white areas → use auto-fit columns, or a bento layout sized to the count.
- [P1] desktop 417-page.png — the hero search placeholder is truncated mid-word ("cth. anggaran, rekonsiliasi, ganti pe") → shorten it to fit ("Cari topik…").
- [P2] desktop 417-page.png, 419-page-scroll-2.png — the featured topic rows use solid near-black (#111) icon tiles, a colour not used anywhere else in the forest/lime system; small cards use pale sage tiles → use forest-900 with a lime icon.
- [P2] desktop 417-page.png — featured-row description text stops at ~1060px, leaving the right ~340px of each full-width row empty, and nothing on the row indicates it is clickable → add a chevron or "Buka" affordance, or make it a 2-column card.
- [P2] desktop 422-tab-memulai.png, 424-tab-anggaran.png, 427-tab-keamanan.png — filter tabs filter topics, but the FAQ is always the full unfiltered list of 7 → filter the FAQ by tab, or label it "FAQ umum".
- [P2] desktop 420-page-scroll-3.png — contact cards show placeholder-looking data ("+62 811 2345 6789", "0800-1234-5678") presented as real support channels → use real numbers or hide them in the demo.
- [P3] desktop 417-page.png — topic cards (white, 1px border, ~16px radius) differ from the page's 26px borderless cards and from the sage-filled featured rows: three card styles on one page.

### Dialogs & forms seen

- FAQ accordion (428): expands inline. OK, except the answer text is indented differently from the question (starts at x=284 vs 285, with a greyed question weight change).

### Not reachable

- None evident. Topic cards were not opened (it is unclear whether they are links).

## persetujuan

Scores: desktop 3/3/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The empty state is rendered as three big mostly-blank cards: on-brand frame, but no content design, a wasted hero and inconsistent micro-controls.

### Defects

- [P1] desktop 430-page.png — the hero is 335px tall, and below the amount it holds only one tiny centred line "Belum ada keputusan bulan ini." floating at y=194, leaving about 200px of empty dark card → collapse the hero in the empty state, or add an illustration with a "how approvals work" CTA.
- [P1] desktop 430-page.png — the "Pemohon aktif" card is 418px tall, but its content ends at y=208 (one line plus a button), leaving about 280px blank → size it to content, or merge it with the guidance card.
- [P1] desktop 430-page.png — the "Periksa sebelum menyetujui" text is held to a ~200px column inside a 376px card, so the heading wraps onto 2 lines and the body onto 5 → let the text use the full card width.
- [P2] desktop 430-page.png — "≈ € 0,00" shows the approximation sign on an exact zero → drop "≈" when the value is 0, or show "Tidak ada" instead.
- [P2] desktop 430-page.png — the "Lihat riwayat keputusan" button has left-aligned, 12px bold text inside a full-width outline pill: a one-off button style not used elsewhere → use the standard secondary button (centred, same height as "Buat role" / "Master COA >").
- [P2] desktop 431-tab-pending.png, 432-tab-riwayat.png — the segmented tab label "Pending" is English beside "Riwayat" → "Menunggu" (which the hero already uses).
- [P2] desktop 430-page.png, 432-tab-riwayat.png — empty states are bare grey sentences ("Belum ada permintaan dana.", "Belum ada permintaan yang diputuskan.") with no icon or explanation of how members submit requests, and the hero message duplicates them → one designed empty state with next step.
- [P2] desktop 430-page.png — the page ends at y=712 with about 190px of bare sage below; the bento does not fill the viewport → acceptable, but tighter card heights would fix it.
- [P3] desktop 433-click-lihat-riwayat-keputusan.png — "Lihat riwayat keputusan" only switches the tab below, with no scroll or focus cue, so on a taller page it would look like nothing happened.

### Dialogs & forms seen

- None (no requests exist to approve or reject).

### Not reachable

- Approve/reject dialog and request detail: no pending data in the demo account.

## akses-saya

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The page tells the Master user that they are restricted, which is factually wrong, and pads a mostly-empty hero and card with duplicate account names.

### Defects

- [P0] desktop 435-page-scroll-1.png — for a user whose role is Master, "Mengubah role anggota — Hanya Master yang bisa mengubah IAM" is marked red "Dikunci", and the header badge says "Read + Input terbatas" → derive the rows from the current role (Master = all Diizinkan, badge "Akses penuh").
- [P0] desktop 434-page.png — the hero says "Saldo keluarga: Tidak terlihat", and the "Saldo Keluarga" card says net worth "tidak dihitung untuk akun ini", for the Master account, which the IAM page (436) describes as "Akses penuh · Semua data keluarga" → contradiction; show "Terlihat" for Master/Co-Master.
- [P1] desktop 434-page.png, 435-page-scroll-1.png — copy aimed at a restricted member is shown to the Master: "Kalau butuh akses tambahan, minta Master…" and "Mengajukan dana — Perlu disetujui Master" → hide these or rewrite them for Master ("Kamu yang menyetujui").
- [P1] desktop 434-page.png — hero big number "10" is labelled "Akun Master", which reads as "10 Master accounts"; it is actually 10 assigned rekening → "10 rekening ditugaskan".
- [P1] desktop 434-page.png — the hero is 374px tall with only "10" and a badge in the left pane; about 280px is empty dark gradient → shrink it, or put the access summary chips there.
- [P1] desktop 434-page.png — the "Rekening kamu" list repeats names with no disambiguation ("GoPay" ×3, "BCA Tabungan" ×2), and every row (GoPay, OVO, Kas Tunai) uses the same bank icon → add last-4/owner and type-specific icons.
- [P2] desktop 434-page.png — the "Rekening Ditugaskan" card repeats the same 10 account names as an inline comma-separated paragraph ("…GoPay, BCA Tabungan, GoPay.") when the right card already lists them → show a count only.
- [P2] desktop 434-page.png, 435-page-scroll-1.png — the white container below the three access cards has ~160px of empty space because it stretches to the right column's height → align the heights or move "Aktivitas yang Diizinkan" up into it.
- [P2] desktop 434-page.png — "Role: Master" badge and the "Role Master" stat repeat the same fact twice in one hero.
- [P3] desktop 435-page-scroll-1.png — activity rows put the label and description inline on one line with uneven gaps; the status chips are right-aligned 1100px away from their label, so scanning across is hard → use a 2-line row, or a table with a narrower width.

### Dialogs & forms seen

- None.

### Not reachable

- Not applicable; this page is read-only.

## iam

Scores: desktop 3/2/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The role editor drawer is well done, but the page around it has a clipped, meaningless hero chart, contradictory counts, an unlabelled black heatmap and raw English errors.

### Defects

- [P0] desktop 436-page.png — in the default state the hero chart is cut off by the card bottom: only the top of one bar and the "30/20 halaman" grid lines show, and the bars and axis are invisible until "Lihat cara kerja" grows the row (445) → give the chart a fixed height independent of the neighbouring card.
- [P1] desktop 436-page.png, 445-click-lihat-cara-kerja.png — the hero reads "Daily average 12 halaman · Demo – Ana" over a bar chart of pages per member; "Daily average" is wrong (it is pages per member, not per day) and English → "Rata-rata 12 halaman per anggota", or drop the chart.
- [P1] desktop 445-click-lihat-cara-kerja.png — the "Avg 12 halaman" and "30/20/0 halaman" axis labels spill past the chart pane across the divider into the stats column (x≈700–790) → keep axis labels inside the left pane.
- [P1] desktop 436-page.png — the counts contradict each other: "Anggota dengan role 0", "Akses khusus 2", and the caption "1 anggota diatur aksesnya", for a family of 2 where only Ana is restricted → define and reconcile these metrics.
- [P1] desktop 436-page.png — the "1 anggota akses terbatas" card shows a 9×2 grid of solid black and grey squares with no legend, labels or axis (black is not a palette colour) → label pages and levels, use forest/lime/sage tones, or remove it.
- [P1] desktop 436-page.png — Ana's role shows as the raw lowercase English enum "dependant" under her name → "Anak".
- [P1] desktop 444-buat-role-submitted.png — the toast says to assign the role "lewat tombol Atur Akses", but no "Atur Akses" button is visible on the member rows (only a trash icon and an "Anak" chip; the drawer opens on row click) → add a visible "Atur akses" button per member row.
- [P2] desktop 436-page.png — the caption "Master selalu punya akses penuh, 1 anggota diatur aksesnya" floats on the sage background between cards, outside any card → move it into the members card header.
- [P2] desktop 436-page.png — in the "1 anggota akses terbatas" card the heading (14px bold) is smaller than its subtitle (16px regular), which inverts the hierarchy used in every other card.
- [P2] desktop 436-page.png — the "Role akses" card stacks two helper lines with no spacing ("Siap pakai untuk beberapa anggota" / "Belum ada role…"), and "Lihat cara kerja" is plain grey text with no link or chevron styling.
- [P2] desktop 436-page.png — member rows are misaligned: the "Master" chip sits at x≈936–1012 while Ana's "Anak" chip sits at x≈964–1012 with a red trash icon before it; the Master row has no actions → reserve a fixed actions column.
- [P2] desktop 436-page.png — the bottom ~320px of the viewport is empty, and the member list card is only 200px tall.
- [P3] desktop 447-click-salin-username.png — after copying, the copy icon turns into a lime check circle that is larger than the original icon, so the row shifts slightly.

### Dialogs & forms seen

- Tambah Anak / Operasional (437–440): inline required-field errors are good, but the username format rule is not stated up front, and the server error appears as a raw English toast ("username may only contain letters, numbers, underscores, and dots") instead of inline under Username; the drawer is 460px wide while Buat Role and Atur Akses are 680px.
- Buat Role (441–444): empty submit just leaves "Buat Role" disabled, with no field error saying "Nama role wajib diisi"; the template chips wrap so "Co-Master" sits alone on a second line; the "Semua: Tidak Lihat Kelola" header controls look like plain text, not buttons. On success the new role "Audit QA 1" appears in the Role akses card (OK), but "Anggota dengan role" stays 0.
- Atur Akses: Ana Demo (446): OK structurally; the 1/2/3 step labels are 13px grey and read as helper text, not section headings; the "Lihat saldo" toggle is not numbered and sits between steps 2 and 3.

### Not reachable

- Delete member confirmation (trash icon) was not opened; the role edit/delete flow for the created role was not opened.
