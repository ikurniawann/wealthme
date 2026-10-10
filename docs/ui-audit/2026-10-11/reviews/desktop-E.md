## notifikasi

Scores: desktop 3/3/3 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: Hero and pill tabs are on-brand, but notifications are miscategorised, amounts are hardcoded in Rp on a EUR account, and the "mark all read" flow gives no feedback and leaves stale controls behind.

### Defects

- [P0] desktop 215-page.png, 218-tab-transaksi.png — "Jadwal Perpanjangan Asuransi Kendaraan" and "Target Dana Darurat Sesuai Rencana" are filed under Transaksi (hero legend "Transaksi 2"), but neither is a transaction. → Classify the insurance renewal as Jatuh Tempo and the savings target as Tujuan/Anggaran, then recount the legend.
- [P1] desktop 215-page.png, 218, 219, 221 — the body copy hardcodes "Rp 60.000.000", "Rp 2.000.000" and "Rp 4.200.000" for a EUR account. → Format with the account currency ("≈ €…") at render time instead of baking Rp into the stored text.
- [P1] desktop 215-page.png, 221-tab-jatuh-tempo.png — "Audit QA 1 jatuh tempo dalam 0 hari" uses the raw count. → Say "jatuh tempo hari ini" when the value is 0, and "besok" when it is 1.
- [P1] desktop 223-click-tandai-semua-dibaca.png — after "Tandai semua dibaca" the counter drops to 0 but there is no confirmation toast. The button is still fully enabled and styled as the primary action. → Show a toast with undo, and disable or hide the button while unread = 0.
- [P1] desktop 215-page.png vs 223 — the hero segmented bar and legend (Transaksi 2 · Anggaran 1 · Jatuh Tempo 2) sit under "notifikasi belum dibaca" but count all 5 notifications. They do not change when unread goes 1 → 0. → Label the bar "semua notifikasi", or make it break down only the unread items.
- [P2] desktop 215-page.png — the right hero panel shows "Jatuh tempo 2", which repeats the legend's "Jatuh Tempo 2" two columns away and adds no information. → Replace it with a non-duplicated metric (e.g. nearest due date), or drop the panel and widen the hero.
- [P2] desktop 216–222 — the tab track width changes as each bold active label widens (track ends at x≈955, then ≈958, then ≈961), so the pills shift sideways on every tab change. → Reserve the bold width (font-weight-safe grid or fixed min-width per tab).
- [P2] desktop 220-tab-persetujuan.png, 222-tab-sistem.png — the empty state is one grey centred sentence in a short card, with no icon and no tone. It also says "Coba pilih filter lain" when only 2 of 7 filters have content. → Use the shared WealthMe empty-state block (icon + title + one line), and hide or disable filters with 0 items or show their counts.
- [P2] desktop 215-page.png — read items are rendered in low-contrast grey (#9a9a9a-ish on white) and look disabled rather than read. → Keep the body at the standard muted-text token and signal read/unread only through the dot and weight.
- [P2] desktop 215-page.png — read rows use a generic bell icon while the unread row has a category icon ($ doc). Category icons are lost once an item is read. → Keep a per-category icon regardless of read state.
- [P3] desktop 215-page.png — "Tandai dibaca" is a tiny green text link stacked under the "Baru" chip, right-aligned with no hit area. → Make it an icon button or row-hover action at a ≥32px target.
- [P2] desktop all shots — the floating AI button at bottom-right is cut by the viewport edge (offscreen=I). → Inset it by ≥16px from the right edge.
- [P3] desktop 215-page.png — the content card ends at y≈740 and leaves ~160px of bare sage background. This is acceptable, but the list has no pagination or "muat lebih" affordance for longer histories. → Add a bottom affordance for when the list grows.

### Dialogs & forms seen

- Tandai semua dibaca (inline action): works (count goes 1 → 0), but no toast, no undo, and the button stays enabled.

### Not reachable

- No notification detail/drill-through or per-item menu was opened. Persetujuan and Sistem have no data, so their populated states are unverified.

## akun

Scores: desktop 3/2/3 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The hero is strong, but the tabs underneath are a patchwork: FAQ answers point to menus that do not exist, the security threshold is hardcoded in Rp, there is no visible API-key section despite AI Advisor sending users here, and "Hapus foto" deletes with no confirmation.

### Defects

- [P0] desktop 232-click-bagaimana-cara-menambah-rekening-b.png — the FAQ says "Buka menu Akun → Koneksi Bank & E-Wallet", but Akun only has Profil/Keamanan/Preferensi/Bantuan. → Point to the real route (Rekening → Tambah) and drop the bank-credential claim.
- [P0] desktop 234-click-bagaimana-cara-mengubah-mata-uang-.png — the FAQ says "Akun → Pengaturan Umum → Mata Uang" and "kurs … dari Bank Indonesia", but the real path is Akun → Preferensi → Mata Uang. → Correct the path and only state the rate source if it is true.
- [P0] desktop 236-click-apakah-wealthme-bisa-digunakan-unt.png — the FAQ promises an "Akun Bisnis" feature "dari menu Akun" with invoices and cash-flow reports, but no such setting exists on the page. → Remove it or mark it "segera hadir".
- [P0] desktop 233-click-apakah-data-saya-aman.png, 235-click-bagaimana-cara-menambah-tujuan-keu.png — the FAQ claims "Koneksi bank menggunakan OAuth 2.0 via partner" and "Aktifkan auto-debit". Both describe features the product does not show anywhere, which is a data-honesty problem on a security answer. → Rewrite the answers to describe the actual behaviour.
- [P0] desktop 238-nav-tanya-ai-advisorlangsung-tanya-ke-as.png vs 227/228 — the AI Advisor lock screen says to connect an API key "di Akun → Pengaturan". No Akun tab shown has an API-key section, and there is no "Pengaturan" tab. "Tanya AI Advisor" in Bantuan therefore leads to a dead end. → Add a visible "AI / API key" section (e.g. under Keamanan or Preferensi) and deep-link to it.
- [P1] desktop 227-tab-keamanan.png — "Konfirmasi Transaksi Besar — … transaksi >Rp 5 jt" is hardcoded in Rupiah on a EUR account. → Render the threshold in the account currency and make it editable.
- [P1] desktop 231-click-hapus-foto.png — "Hapus foto" removes the avatar immediately with only a toast: no confirmation and no undo. → Add a confirm step or an "Urungkan" action in the toast.
- [P1] desktop 231-click-hapus-foto.png — after deletion the hero shrinks by ~8px (name/badge row moves from y=179 to 171, tabs from 377 to 369), causing a layout jump. → Keep the hero row height fixed whether or not there is a photo.
- [P1] desktop 227-tab-keamanan.png — all Sesi Aktif rows read just "Perangkat · Aktif sejak 11 Okt 2026". There is no device/browser/OS/location, and the hero says 23 sessions with no "Akhiri semua sesi lain". → Show the user agent and last-seen time, and add a bulk end-sessions action.
- [P1] desktop 227-tab-keamanan.png — the "Ubah Password" and "PIN Aplikasi" tiles are bare icon + text with no card surface, border or button. They do not look clickable and leave the left half of the section empty. → Render them as bordered action rows/cards with a chevron or button, matching the Panduan Fitur rows in Bantuan.
- [P1] desktop 227-tab-keamanan.png — the disclaimer "Disimpan, tapi belum aktif…" sits only under "Notifikasi Login Baru" but applies to both toggles. → Put it once under the Autentikasi heading, or show a "Belum aktif" chip per toggle.
- [P1] desktop 229-tab-bantuan.png — the support contacts are obvious placeholders ("0800-1234-5678", "+62 811 2345 6789"), rendered as live clickable rows. → Use real channels, or label them as demo data and disable them.
- [P1] desktop 239-click-kirim-feedback.png — the About block says "Versi 1.0.0 (Build 2025.04.01)" and "Terakhir Diperbarui 1 Apr 2025", which is stale and hardcoded (the app's dates are Oct 2026). The version also appears twice. → Inject the build version/date at build time and show it once.
- [P2] desktop 224-page.png, 226-tab-profil.png — profile completeness appears twice (hero 5-segment bar plus an identical in-tab bar "4 dari 5 langkah"). The missing step "Profil dasar" has no CTA explaining what is missing, even though name and email are filled. → Keep one bar, and make the incomplete segment a link that says what to add.
- [P2] desktop 225-page-scroll-1.png — under "Anggota (2)" a lone info icon (x≈310) sits on its own line with no text. → Inline it next to the heading or remove it.
- [P2] desktop 225-page-scroll-1.png — the "Ana Demo" row has an unlabeled grey icon at the far right (x≈1378) while the own row has none. → Label the action (tooltip and aria) or drop it, and make row actions consistent.
- [P2] desktop 228-tab-preferensi.png — two selection idioms sit on one tab: Bahasa uses a lime-filled segmented control, while Tema and Mata Uang use outlined cards with a check. → Use one selected-state pattern.
- [P2] desktop 228-tab-preferensi.png — currency cards wrap unevenly ("Dollar / Amerika", "Dollar / Singapura", "Yuan / Tiongkok" on two lines, others on one), and the symbol column varies in width (Rp vs CN¥), so the code labels do not line up. → Give the symbol column a fixed width and either allow one-line names or use a 4+3 grid with wider cards.
- [P2] desktop 224-page.png — the hero stat "Tema: Terang" is filler next to meaningful stats. → Replace it with something actionable (e.g. "Mata uang EUR" or "2FA nonaktif").
- [P2] desktop 224-page.png — the tab track is ~700px wide with ~60px of dead pill space after "Bantuan". → Size the track to its content.
- [P2] desktop 229-tab-bantuan.png — "Mulai Setup Terpandu" and "Panduan Fitur Lengkap" share the same book icon. The FAQ column ends ~150px above the Panduan column, leaving a ragged two-column bottom. → Use distinct icons and balance the columns, or stack FAQ above contacts.
- [P2] desktop 239-click-kirim-feedback.png — the empty "Kirim Feedback" button is a near-invisible disabled ghost (light grey text on white) with no hint why it is disabled. → Use the standard disabled button token, plus helper text or a character counter.
- [P3] desktop 225-page-scroll-1.png — "Keluar dari Akun" is a full-width neutral pill identical to secondary actions. → Give it destructive/quiet styling, sized to its content.
- [P2] desktop all shots — the floating AI button is clipped at the right viewport edge.

### Dialogs & forms seen

- Ganti foto (230): the click shows no visible change (presumably the native file picker), with no in-app crop/preview dialog.
- Hapus foto (231): instant delete with a toast "Foto profil dihapus"; no confirmation and no undo; causes a layout shift.
- Edit profil: not opened. Profil Saya is read-only rows, so whether inline edit exists is unclear.
- Kirim feedback (239): textarea plus a disabled button; empty submit gives no validation message.
- FAQ accordion (232–236): opens correctly, but 4 of 6 answers describe non-existent menus or features (see P0s).

### Not reachable

- API-key / AI provider settings (referenced by the AI Advisor lock screen) were not found on any captured Akun tab.
- Ubah Password and PIN Aplikasi dialogs were not opened.
- "Akhiri" session action not exercised.
- The lower half of Preferensi (notification toggles below the fold) was not captured.

## rekonsiliasi

Scores: desktop 3/3/2 · tablet n/a · mobile n/a (Karakter/Konsistensi/Kerapian)
Verdict: The stepper hero is on-brand, but the page states contradict themselves ("Sedang berjalan" before any file, 2 uploaded docs with empty stats). The template sheet overflows after save and validates with English browser bubbles, and the matching table was never reachable past an AI scan screen with no progress or cancel.

### Defects

- [P0] desktop 240-page.png — the hero says "2 Dokumen mutasi diunggah" and Dokumen Terbaru lists 2 "Terunggah" files, yet Cocok / Perlu ditinjau / Belum cocok all show "—". Step 1 "Upload" shows "Sedang berjalan" although nothing is uploading. → Show real counts for the latest document (or 0), and keep step 1 at "Menunggu" until a file is chosen.
- [P0] desktop 250-click-lanjutkan-ke-pencocokan.png — the scan step "AI Sedang Membaca Dokumen / Memulai pemindaian…" has no progress, no cancel/back, and no error path. AI Advisor is locked for this user (no API key, see akun 238), so the scan likely cannot succeed, and the page never reaches the matching table. → Check the AI key before starting, show an actionable error ("Hubungkan API key di Akun"), and add cancel plus a progress state.
- [P1] desktop 244-kelola-template-submitted.png — the saved-template table's KOLOM cell "2026-10-10 · Audit QA 3 · 1250000" is clipped by the sheet's right edge, with no wrap or ellipsis. → Wrap the cell or show the three mappings as stacked chips.
- [P1] desktop 244-kelola-template-submitted.png — the saved row has no edit or delete action and no section heading. It shows bank as "MDR" while the select says "Mandiri". → Add a "Template tersimpan" heading, row actions, and the full bank name.
- [P1] desktop 242-kelola-template-validation.png — empty submit triggers the native English browser bubble "Please fill out this field." on an Indonesian UI, with no inline field error. → Use app-level inline errors in Indonesian under each required field.
- [P1] desktop 241-kelola-template-dialog-open.png, 242 — required and optional fields are not marked. Validation skips the empty "Nama Template" and flags "Kolom Tanggal", so the user cannot predict which fields are required. → Add a required asterisk or an "(opsional)" suffix.
- [P1] desktop 240-page.png — Dokumen Terbaru truncates both the filename ("BCA_Rekening_Kor…", "Mandiri_Rekon_Ap…") and the upload timestamp ("Diupload 18/9/2026, 17.0…"). The date format 18/9/2026 also differs from "11 Okt 2026" used elsewhere. → Allow two-line filenames or a tooltip, use the short date format "18 Sep 2026", and drop the seconds/time or move it to the tooltip.
- [P1] desktop 246-info-dialog-open.png — the info popover is a ~520px wall of text (4 dense paragraphs) covering the dropzone and the "Maksimal ukuran file" line. It opens with "Format yang didukung: CSV dan Excel" and then says PDF is supported too. → Cut it to 3 bullets with a "Pelajari lebih lanjut" link, and list formats consistently.
- [P2] desktop 240-page.png — format copy is inconsistent: the subtitle says "PDF, Excel, atau CSV", the chips say CSV / XLSX / ZIP / PDF, and the popover says "CSV dan Excel". → Use one source of truth for supported formats.
- [P2] desktop 240-page.png — "Maksimal ukuran file: 20MB" floats alone in the card's top-right above the title, an orphaned label. → Move it into the dropzone next to the format chips.
- [P2] desktop 240-page.png — two upload entry points ("Upload Mutasi" in the hero and "Pilih File" in the dropzone), and clicking "Upload Mutasi" (245) gives no visible response. → Keep one primary upload CTA, or have the hero button scroll to and focus the dropzone.
- [P2] desktop 241-kelola-template-dialog-open.png — Kelola Template opens as a full-height right drawer rather than the prototype `.dialog`, with ~180px of dead white between the last field and the footer. → Use the standard dialog on desktop, or tighten the drawer's content/footer spacing.
- [P2] desktop 241 — placeholder prefixes are mixed ("contoh: BCA Giro" vs "cth: Tanggal"). → Use one.
- [P2] desktop 243-kelola-template-filled.png — column-name fields accept values like "2026-10-10" and "1250000" (data values, not header names) with no hint or validation. → Add helper text ("nama header kolom di file, mis. 'Tgl Transaksi'") and reject values that are purely numeric or dates.
- [P2] desktop 248-click-bcabca.png, 249-click-mdrmandiri.png — selecting a bank chip shows 11px helper text ("Belum ada template…", "Template pemetaan kolom … akan diterapkan") below the fold. The green dot added to Mandiri after saving a template has no legend. → Move the helper into view (inside the card, above the chips) and label the dot ("Template").
- [P2] desktop 240-page.png — bank chips repeat the name ("[BCA] BCA", "[MDR] Mandiri"), and "MDR" is not a recognisable Mandiri mark. → Show either the logo badge or the name, not both abbreviations.
- [P2] desktop 247-click-seret-lepas-file-di-siniatau-pilih.png — on the dropzone's active/hover state the upload icon loses its circular lime background, so the icon jumps visually. → Keep the icon container and only tint the zone.
- [P2] desktop 240-page.png — the "Tips Rekonsiliasi" card uses a pale yellow fill with a yellow border, outside the forest/lime/sage palette. → Use the sage/lime info surface used elsewhere (e.g. the akun Grup Keluarga note).
- [P2] desktop 240-page.png — the right column ends at y≈660 while the left continues to the "Bank yang Didukung" card, leaving a ragged empty area. → Move Bank yang Didukung into the right column, or let Dokumen Terbaru grow.
- [P2] desktop 240-page.png — tinyText=6: the format chips (CSV/XLSX/ZIP/PDF), "Maksimal ukuran file", "Terunggah" badges and the bank helper are under 11px. → Raise them to ≥11px tokens.
- [P2] desktop all shots — the floating AI button is clipped at the right viewport edge (offscreen=I).

### Dialogs & forms seen

- Kelola Template (241–244): right drawer. Validation uses a native English bubble with no inline errors. The filled state reads fine. After submit, the toast "Template pemetaan kolom disimpan" appears and the record shows in the table, but the KOLOM cell is clipped, there are no row actions, and it shows the "MDR" code.
- Info popover (246): too long, covers content, and contradicts itself on formats.
- Upload Mutasi (245): no visible response.
- Bank chip select (248/249): selected state ok; helper text is below the fold and tiny.
- Lanjutkan ke pencocokan (250): reaches the scan state only, with no progress or cancel.

### Not reachable

- The matching table (Cocokkan step), the review of matched / unmatched rows, and step 4 Selesai were never reached.
- Lihat Riwayat and Dokumen Terbaru row drill-in were not opened.
- The "Lainnya" banks list was not opened.
