## masterdata

Scores: desktop n/a · tablet n/a · mobile 3/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: The page is a 4-viewport single column. The first screen is spent on a centred hero and a static 6-row COA group list, two long category lists truncate names until rows look identical, and toasts land inside the bottom sheet over the form.

### Defects

- [P1] mobile 338-page.png — The first viewport (below the hero) is the "Akun COA" card with six 60px read-only rows (Pendapatan…Pajak). They duplicate Master COA's "Grup akuntansi" list, so neither category list is visible until scroll 1 → collapse Akun COA into one summary row ("106 akun · 6 grup · Master COA ›") and lead with the category lists.
- [P1] mobile 339-page-scroll-1.png — The first two pengeluaran rows both read "Asset & Other In…" with the same icon and the same code 21104, so on a 358px column they cannot be told apart (on desktop the suffix still shows) → truncate from the middle, or show the distinguishing suffix ("…Asuransi Jiwa Prudential") on a second line.
- [P2] mobile 339/340-\*.png — The name column is clipped at ~130px ("Lainnya Pemasu…", "Lainnya Pengelu…", "Tabungan & Inv…", "Utang: KPR BTN …") because the code (~70px), pencil and × (each ~40px) take the right half of the row → move the code under the name as a meta line, and put edit/delete behind a row tap or a kebab so the name gets the full width.
- [P2] mobile 339/340-\*.png — The COA codes are ~10px grey monospace (tinyText=4 on every shot) → at least 12px, as a secondary line.
- [P2] mobile 342-click-tren-detail.png — Expanding "Tren & detail" adds ~110px of empty dark green between the Keluar/Masuk legend and "Sembunyikan detail". The three stats then sit in a 2-column grid with "Terhubung COA 22" orphaned alone on row 2, behind a stray vertical divider → remove the dead gap and lay out the stats as 3 columns, or as 1 row of chips.
- [P2] mobile 338-page.png — The hero holds only "22 Kategori tersimpan" plus a toggle. The Pemasukan/Pengeluaran/Terhubung split appears only after "Tren & detail" is tapped, which adds an extra tap for the most useful numbers → show the 3 stats in the collapsed hero, and drop the toggle.
- [P2] mobile 343-info-dialog-open.png — The info popover opens ~30px above its ⓘ trigger, with no arrow, and covers the hero's stats (Pemasukan/Terhubung values hidden). Its 8-line paragraph is a desktop tooltip on a phone → open it as a small bottom sheet, or as inline helper text under "Daftar rujukan".
- [P1] mobile 346-tambah-validation.png, 347-tambah-filled.png — The error toast "Nama kategori wajib diisi." renders inside the bottom sheet at y≈695–745 and covers the "Ikon" picker. In 347 it stays over the form after the name is filled → on mobile, place errors inline under the field (or raise toasts above the sheet footer and dismiss them on input).
- [P2] mobile 341-page-scroll-3.png — In "Daftar rujukan", 15 pills each carry a "Bawaan" badge, which doubles each pill's width, so BCA/Mandiri etc. wrap to 2 per row and the section is ~700px tall → drop the badge (mark custom items instead); the 15 pills then fit about 3 per row.
- [P2] mobile 361-hapus-asset-other-insurance-asuransi-jiw.png — The delete sheet title wraps to 3 lines ("Hapus kategori "Asset & Other Insurance: Asuransi Jiwa Prudential"?"), and the description repeats the full name. On a phone the header band is ~170px for one sentence → truncate the name in the title, and remove it from the description.
- [P2] mobile 344-nav-master-coa.png — Tapping "Master COA ›" lands on /mastercoa scrolled down by ~130px: the page title "Master COA" and the top bar are off-screen, and the hero is cut under the notch → reset scroll to top on route change.
- [P3] mobile 345-tambah-dialog-open.png — The sheet's drag handle (y≈276) is a faint 40px line straddling the sheet's top edge, half on the blurred backdrop → place it fully inside the sheet at 8px from the top.

### Dialogs & forms seen

- Info popover: desktop tooltip on mobile; covers hero stats; no arrow.
- Tambah Kategori (bottom sheet): fits in one viewport, footer reachable. The toast overlaps the Ikon field; the icon picker is still tofu (logged on desktop).
- Edit Kategori (×12, sampled 360/370): fits; a long name scrolls inside the input ("…Asuransi Jiwa Pruc"); tofu icon.
- Hapus Kategori (×12, sampled 361): 3-line title for long names; the header gradient seam is still visible at y≈650–695 (logged on desktop).

### Not reachable

- Daftar rujukan "+ Tambah" sheets, the delete outcome, and the Edit submit result.

## mastercoa

Scores: desktop n/a · tablet n/a · mobile 2/2/1 (Karakter/Konsistensi/Kerapian)
Verdict: The worst mobile screen of this batch. All 106 accounts are rendered as a 2-column card grid on a 358px column, long names push cards past the viewport edge and over their neighbours, and the list runs 9+ viewports with no pagination or search.

### Defects

- [P0] mobile 372–377-page-scroll-\*.png — Cards with long names widen their grid track, so the right column runs past the 390px viewport and the left card's title is overprinted or clipped by the right card. Examples: "Pemasukan Lainnya" (372), "Makanan & Minuma", "Tagihan & Utilitas" (373), "Penalti Pelunasan", "Pengeluaran Lainnya" (374), "Clothing & Accessori", "Grooming & Perso", "Medical Supplies & A" (375), "Public Transport & Ri", "Vehicle Legal & Admi", "Service/Maintenar" (376), "Asset & Other Insu", "Donation Religious" (377). The manifest flags offscreen wm-btile/mc-tile-name on every shot → on mobile use a 1-column list row (code · name · direction chip), or fixed `minmax(0,1fr)` tracks with 2-line clamped titles.
- [P0] mobile 372-page-scroll-1.png, 375-page-scroll-4.png — The white "Semua akun" container is narrower than the overflowing cards: its right edge shows as a vertical white strip at x≈376 behind the cards, and the cards stick out to x=390 → contain the grid (`min-width:0` and `overflow:hidden` on the card), with no horizontal bleed.
- [P1] mobile 372–377-\*.png — 106 cards at ~138px each, 2 per row, make ~7,300px of grid. After 6 scroll stops (shot 377) the list has reached only 21301 "Bank Charges", about two-thirds through, and the "89 akun belum terhubung" list on desktop is not reached at all → paginate or virtualise, add a search field, and collapse groups (accordion per group, showing the count).
- [P1] mobile 385-click-1income12-akun-pemasukan.png, 387-click-3alokasi14-akun-mutasi.png — Tapping a group row ("Income", "Alokasi") gives no visible response: the viewport stays on the hero chart and the group list with no active state, and the filtered result card renders ~500px below, off-screen → highlight the selected row and scroll to the result, or make the group list a sticky horizontal chip filter above the grid.
- [P1] mobile 372–377-\*.png, 390-click-6pajak8-akun-pengeluaran.png — The trash icon on every card is a 26×26 tap target (smallTargets on each shot), placed 0px from the card corner where a tap meant to open the card lands → remove delete from the card (move it to the Edit sheet), or use a 44px target.
- [P1] mobile 372–376-\*.png — The "· Fixed/Variable" meta does not fit beside the direction chip, so it wraps as an orphan "·" at the chip's end with "Fixed" on the next line ("Gaji · / Fixed"), or is clipped ("· Variabl" in 373/374/375) → put the budget type on its own line without the bullet, or drop it on mobile.
- [P1] mobile 371-page.png — The hero stacks four controls (Master Data, Panduan, Tambah Akun, Tren & detail) as centred pills over 3 rows, ~230px. The first viewport ends at "Piutang", and no account is visible → move Master Data/Panduan to the page header kebab, keep "Tambah Akun" as the only hero CTA, and show the count in a single line.
- [P1] mobile 383-click-tren-detail.png — The expanded hero is 640px tall (the full viewport) for a meaningless "Daily average 18 · 1 – 6" chart (logged on desktop) → on mobile drop the chart and keep the two stats.
- [P2] mobile 380-tambah-akun-dialog-open.png — The Tambah Akun sheet says "code is automatic" three times (the subtitle, the Kode Akun placeholder "Otomatis jika dikosongkan", and the helper "Dikosongkan = kode dibuat otomatis…"), which costs ~70px on a sheet that already runs to y=68 → keep one helper line.
- [P2] mobile 379-panduan-dialog-open.png — The Panduan sheet's dark header takes ~235px (28% of the screen) for a 7-line paragraph, and the close button (y≈158) overlaps the paragraph's right margin → keep the header to the title row, move the paragraph into the body, and inset the close button.
- [P2] mobile 381-tambah-akun-validation.png — The browser-native "Please fill out this field." bubble (English, in OS chrome) floats over the Arah Transaksi select → inline red helper text, as IAM does (437).
- [P2] mobile 371-page.png — The "Semua" row's chip is a 20px empty circle containing "·", the only non-chip on the list; the group chips (Pemasukan/Pengeluaran/Mutasi) are ~10px text → remove the dot, and use 12px chip text.
- [P3] mobile 392-pajak-penghasilan-hapus-dialog-open.png — The Hapus Akun COA sheet header has a darker band between title and description (the same seam as on desktop), and the title still does not name the account → "Hapus 60001 · Pajak Penghasilan?".

### Dialogs & forms seen

- Panduan "Apa itu Master COA?" (bottom sheet, nearly full height): oversized header; body scrolls; Rp examples (logged on desktop).
- Tambah Akun COA (sheet): fits, with the footer visible. There is triple redundant helper copy, the browser-native validation bubble, and free-text Kode Akun/Kode Induk (logged on desktop).
- Edit Akun COA (×8, sampled 391): fits; reuses the add subtitle; Kode Induk is empty (logged on desktop).
- Hapus Akun COA (×8, sampled 392): fits; header seam; account unnamed.

### Not reachable

- The end of the 106-card grid and the "akun belum terhubung" list (the crawler stopped after 6 scroll stops); a successful create.

## panduan

Scores: desktop n/a · tablet n/a · mobile 3/3/2 (Karakter/Konsistensi/Kerapian)
Verdict: A readable but 7-viewport text column. 25 topic cards are stacked one per row before the FAQ, cards look non-interactive, and desktop-only instructions are shown to phone users.

### Defects

- [P1] mobile 407–413-page\*.png — The page is ~7 viewports: 25 topic cards at 115–140px each (6 scroll stops) before the FAQ appears at scroll 5 (412). The FAQ, the thing most mobile users come for, sits ~4,800px down → on mobile, show topics as a compact 2-column icon grid or one collapsible list per section, and move the FAQ up or link it from the hero ("Lihat FAQ ↓").
- [P1] mobile 408-page-scroll-1.png — "Tombol "+" Catat Transaksi" says "Klik ikon "+" di sidebar…", but on mobile the "+" is the ring button in the bottom dock, and there is no sidebar → use viewport-aware copy ("Ketuk tombol + di tengah dock bawah").
- [P1] mobile 409-page-scroll-2.png — "Pencarian (Ctrl/Cmd+K)" tells phone users to "Tekan Ctrl/Cmd+K", which is impossible on touch → hide the shortcut on touch devices and name the mobile entry point.
- [P2] mobile 407-page.png — The segmented filter overflows: "Anggaran" is cut at the right edge, and Laporan/Keluarga & Peran/Keamanan are hidden, with no fade or arrow showing the strip scrolls (offscreen BUTTON, wm-seg-label) → add an edge fade, or wrap the chips to 2 rows.
- [P2] mobile 407-page.png, 417-tab-anggaran.png — The hero search placeholder is cut mid-word ("cth. anggaran, rekonsiliasi, ganti pe") → "Cari topik…".
- [P2] mobile 407–412-\*.png — Topic cards have no chevron, arrow or pressed state, so nothing tells the user they open anything (desktop review was also unsure) → add a trailing chevron if they link, or style them as plain text blocks if they do not.
- [P2] mobile 413-page-scroll-6.png — "Masih Butuh Bantuan?" uses three 115px cards, each holding one line of contact data (≈350px total), and none of them is a tap-to-call or mailto action affordance → use one card with 3 list rows and trailing call/chat icons, as `tel:`/`mailto:`/`wa.me` links.
- [P2] mobile 421-click-kenapa-statement-pdf-dari-bank-say.png — In the expanded FAQ answer, the closing "." is orphaned on its own line after the "Rekonsiliasi" link, and the link is an 84×21 tap target (smallTargets) → keep the punctuation inside the inline link's line (no `display:block`), and pad the link to 36px height.
- [P3] mobile 407-page.png — The featured topic rows use #111 black icon tiles (logged on desktop as off-palette). On mobile they are also 48px versus 32px for the others, which makes the stack visibly jagged → one icon size per list.

### Dialogs & forms seen

- FAQ accordion (421): expands inline; rows are ~60px tall, a good tap size; orphaned period, small inline link.
- Tab filters (414–420): filter correctly, and the active chip scrolls into view (418, 420). The FAQ is not filtered (logged on desktop).

### Not reachable

- Topic card targets (not opened by the crawler).

## persetujuan

Scores: desktop n/a · tablet n/a · mobile 3/3/3 (Karakter/Konsistensi/Kerapian)
Verdict: Short (1.2 viewports) and tidy in the empty state, but it says "nothing here" four times and the detail toggle opens a blank dark slab.

### Defects

- [P1] mobile 427-click-tren-detail.png — "Tren & detail" grows the hero from 200px to 540px; ~175px of that is empty dark green under "Belum ada keputusan bulan ini.", followed by three zero stats → hide the toggle when there is no data, or show the stats directly in the collapsed hero.
- [P2] mobile 423-page.png — The first viewport repeats the empty state four times: hero "0 permintaan", "Tidak ada permintaan menunggu.", "Belum ada permintaan dana.", and (after expanding) "Belum ada keputusan bulan ini." → one designed empty state (icon + "Belum ada permintaan dana dari anggota" + how members submit), and drop "Pemohon aktif" when it is empty.
- [P2] mobile 426-tab-riwayat.png, 428-click-lihat-riwayat-keputusan.png — Switching to Riwayat changes the card title to "Riwayat Keputusan", which wraps to 2 lines beside the segmented control. The active "Riwayat" pill is flush against the card's right padding, with its text touching the pill edge (x≈358), and the card height jumps → keep a fixed title ("Permintaan dana"), or put the segmented control on its own row under the title on mobile.
- [P2] mobile 423-page.png — "Lihat riwayat keputusan" is a full-width 44px pill with left-aligned 12px text (logged on desktop). On mobile it also duplicates the Riwayat tab 150px below it → remove it on mobile.
- [P3] mobile 423-page.png — "≈ € 0,00" as the hero number for an empty queue is a weak headline on a phone (logged ≈ issue on desktop) → show "0 permintaan" as the big number and drop the € value.

### Dialogs & forms seen

- None (no requests).

### Not reachable

- Approve/reject sheet and request detail (no pending data).

## akses-saya

Scores: desktop n/a · tablet n/a · mobile 2/2/2 (Karakter/Konsistensi/Kerapian)
Verdict: The page is ~4 viewports, and half of it is an unpaginated list of 22 accounts that alternate "BCA Tabungan"/"GoPay" with identical bank icons. Then the same 22 names repeat as a paragraph.

### Defects

- [P1] mobile 429-page.png, 430-page-scroll-1.png, 431-page-scroll-2.png — "Rekening kamu" renders 22 rows at 58px (~1,300px, more than 1.5 viewports). Rows 7–22 alternate "BCA Tabungan" / "GoPay" eight times with no last-4, owner or balance, and every row (GoPay, OVO, Kas Tunai) uses the same bank icon → show the first 5 with "Lihat semua 22", group by type (Bank / E-wallet / Tunai), and add a disambiguating meta line.
- [P1] mobile 431-page-scroll-2.png — "Rekening Ditugaskan" repeats the same 22 names as a 7-line comma paragraph ("…BCA Tabungan, GoPay, BCA Tabungan, GoPay…") directly under the list → show "22 rekening" only.
- [P2] mobile 432-page-scroll-3.png — In "Aktivitas yang Diizinkan", the "Read + Input terbatas" badge sits beside the title, so the title wraps to 2 lines and the subtitle is squeezed into a ~150px column over 3 lines → put the badge under the title on mobile, and let the subtitle take the full width.
- [P2] mobile 429-page.png — The first viewport spends ~190px on a hero with "22 Akun Master" + "Role: Master" + a toggle, and the access summary (Saldo/Laporan/Role) appears only after "Tren & detail" (433) → show those three chips in the collapsed hero, and drop the toggle.
- [P2] mobile 431-page-scroll-2.png — The three access cards (Rekening Ditugaskan / Saldo Keluarga / Laporan Keluarga) are each ~150–230px with a 34px icon tile plus a right-aligned badge on its own row, which costs ~50px each → use list rows with the icon, label and status chip on one line.
- [P3] mobile 430-page-scroll-1.png — Account rows are 58px tall but show a single 13px label, with the rest of each row empty → 48px rows with name plus meta.

### Dialogs & forms seen

- None (read-only page).

### Not reachable

- Not applicable.

## iam

Scores: desktop n/a · tablet n/a · mobile 3/2/2 (Karakter/Konsistensi/Kerapian)
Verdict: Forms and sheets fit well, but the expanded hero draws its chart on top of its own stats, the black heat grid means nothing on a phone, and member rows truncate the access summary and clip after copy.

### Defects

- [P0] mobile 439-click-tren-detail.png, 444-click-lihat-cara-kerja.png — After "Tren & detail", the bar chart is painted over the stats block: the "Master 1 / Anggota dengan role 0 / Akses khusus 2" labels sit on top of the Demo bar ("Akses kh▮s" is cut by the bar). The axis labels run off the right edge ("Avg 12 halama", "30 halaman" at x≈298–390) → give the chart its own row above the stats, with axis labels inside the card padding.
- [P1] mobile 435-page-scroll-1.png — The "1 anggota akses terbatas" card shows a 9×2 grid of 34px black/grey squares with no page names, legend or levels. On a 358px column it reads as a broken barcode → replace it with a list ("Ana · 4 halaman dibuka · Lihat saja"), or label each cell.
- [P1] mobile 446-click-salin-username.png — After "Salin", the username line shifts left out of its box ("ername: ana_demo") because the larger check icon pushes the row → reserve a fixed 24px icon slot, and keep the text start fixed.
- [P1] mobile 435-page-scroll-1.png — Member rows truncate the only useful summary ("Akses penuh · Semua data k…", "Bawaan Anak · Hanya dat…") because the trash icon and the chip take ~110px. Ana's trash sits ~30px left of her "Anak" chip, while the Master row has no action → wrap the summary to 2 lines, and move delete to the member's sheet or a kebab.
- [P1] mobile 445-click-atur-akses-ana-demo.png — Tapping Ana's row only tints it: no "Atur Akses" sheet opens on mobile (on desktop the drawer opens), and there is no visible "Atur akses" button. The toast/how-to copy ("Lewat tombol Atur Akses", 444) points to a control that does not exist on mobile → add an explicit "Atur akses" button per row that opens the sheet.
- [P2] mobile 434-page.png — Hero alignment is mixed: the big "2" and its label are centred under the notch (the "2" sits only ~8px under the notch edge), while the "Kode: keluarga-ec704b" pill and the "+ Tambah" button are left-aligned and the stats are in a 2-column grid. "Tren & detail" is plain text without the pill used on other pages → one alignment (left), and the standard toggle pill.
- [P2] mobile 434-page.png — "Lihat cara kerja" is a 326×31 target (under 36px) styled as grey bold text with no chevron → 44px row with a chevron.
- [P2] mobile 434-page.png, 435-page-scroll-1.png — The caption "Master selalu punya akses penuh, 1 anggota diatur aksesnya" floats on the sage background between cards and nearly touches the 14px screen edges → move it into the members card header.
- [P2] mobile 436-tambah-dialog-open.png — In the Username field, the fixed "@keluarga-ec704b" suffix takes ~145px of 342px, leaving ~195px for typing, and the password eye toggle is 28×28 (smallTargets) → put the domain suffix under the field as helper text ("Login: nama@keluarga-ec704b"), and make the toggle 44px.
- [P2] mobile 440-audit-qa-1hanya-data-miliknya4-halaman-1.png — The Edit Role footer packs three buttons (text "Hapus", "Batal", "Simpan Role"), so "Simpan Role" wraps to 2 lines inside the pill → move Hapus into the sheet body (danger zone), and keep a 2-button footer.
- [P2] mobile 440/441-\*.png — The template chips are 35px tall (smallTargets), and the "Semua: Tidak Lihat Kelola" header controls are bare 12px text with no button affordance → 40px chips, and a real segmented control for "Semua".
- [P2] mobile 447-hapus-ana-demo-dialog-open.png — The delete sheet uses "Anda" ("dan Anda bisa mengaktifkannya kembali"), while the rest of the app (including this page's "kamu" copy in the role sheets) uses "kamu"; the member list also says "(Anda)" → use "kamu" throughout.
- [P3] mobile 435-page-scroll-1.png — Ana's role is still the raw "dependant" under her name in the restricted card (logged on desktop); on mobile it is the card's only meta line.

### Dialogs & forms seen

- Tambah Anak / Operasional (436–438, bottom sheet): fits; inline errors are good (437); a long domain suffix squeezes Username; the eye toggle is 28px.
- Buat Role (441–443, near-full-height sheet): fits; the disabled "Buat Role" button with no field error on empty submit (logged on desktop); 35px chips.
- Edit Role: Audit QA 1 (440): opens from the role card; the 3-button footer wraps "Simpan Role".
- Hapus Anggota (447, sheet): fits; header gradient seam; mixed "Anda".

### Not reachable

- The Atur Akses sheet for Ana Demo (the row tap opened nothing on mobile), and the access matrix inside it.
- The role edit matrix past "Beranda" (the sheet body was not scrolled).
