# Settings group — build report

Note: this folder was written concurrently by more than one agent run on the same
group. This report describes the **actual current content on disk**, verified just now with
`node _shot.cjs mastercoa.html masterdata.html iam.html panduan.html akun.html akses-saya.html
notifikasi.html` (all 7: `overflow: false, errors: none` at 1440 and 390px) plus a visual check
of the 1440px and one 390px screenshot per page. An earlier draft of this report described
features (member restore in IAM, currency conversion/gold price/religion in Akun) that are not
present in the files currently on disk — this version replaces that draft with what's actually
shipped.

`mastercoa.html` and `masterdata.html` were written fresh this pass. `iam.html`, `akun.html`,
`akses-saya.html`, `notifikasi.html`, `panduan.html` already existed from a prior/parallel pass;
this pass audited and fixed page-breaking bugs in them rather than rewriting working code:

- **akun.html**: two FAQ strings and a PIN regex used a double-escaped `\\"` / `\\d` instead of
  `\"` / `\d` inside JS string/regex literals. The FAQ ones closed the string early, which threw
  a `<script>` syntax error and broke the _entire page_ (every tab/dialog). Fixed all three.
- **akun.html** / **akses-saya.html**: 12 and 4 instances of a leaked `${''}` template-literal
  placeholder sitting directly in the HTML (rendered as literal visible text before any JS could
  repaint it). Replaced every one with the correct inline icon SVG.
- **iam.html**: a `/\\s+/g` regex and two `"\\n"` string literals were double-escaped (matched a
  literal backslash, not whitespace/newline). Fixed.
- **panduan.html**: a stray `${"" /* search */}` template artifact in the search bar, plus a
  double-escaped `\\d+` regex in the tab-label cleanup. Fixed both.

## Pages built (feature → real source)

1. **mastercoa.html** (`app/(app)/mastercoa`) — collapsible "Apa itu Master COA?" guide with all
   6 groups (Pendapatan/Beban/Alokasi/Piutang/Utang/Pajak, copy matches `i18n/id.ts`
   `mastercoa.guide` verbatim) + risk warning; 3 stat cards (Total Akun, Kategori Terhubung →
   links Master Data, Akun COA Kosong); group filter pills; grouped table (Kode/Nama/Grup/Arah/
   Tipe Anggaran/Aksi) with tinted group-header rows; add/edit modal (grup, kode with auto-gen
   hint, nama, arah, tipe anggaran, kode induk, risk notice); delete confirm with consequence
   notice. Owner-only add/edit/delete, matching source's `canManage` gate. Seeded a 21-row COA
   (`WM.store.ensure("coa", …)`, page-owned — wm.js ships none) and linked 10/12 existing
   categories to it on first load so the stat cards aren't all zero.
2. **masterdata.html** (`app/(app)/masterdata`) — Kategori card (icon + tipe badge + COA code +
   Privat badge, add/edit dialog with icon picker/tipe/COA select/privat switch, delete with
   in-use warning) plus Bank / E-Wallet / Lembaga Donasi chip-cloud cards (system items marked
   "Bawaan" and non-deletable, user-added items deletable). Top info banner and footer hint match
   `i18n/id.ts` `masterdata.*` strings verbatim. Seeded `refItems` (page-owned) and extended the
   existing `categories` store with `coaAccountId`/`isPrivate`.
3. **iam.html** (`app/(app)/iam`, master-only — gated by the existing `WM.allowedPage`) —
   Anggota / Role Akses tabs, family-handle ("kode keluarga") card + edit dialog, members table
   (name/username/email, hubungan, peran sistem, hak akses + "khusus" override badge, data
   terlihat), Tambah Anggota (role tiles incl. Istri Co-Master, username+password, hubungan,
   optional access role → credentials shown once with copy buttons), per-member "Atur akses"
   (role select + page×level override matrix), Reset Password (temp password, credential view
   with copy), Hapus (remove from family). Role Akses tab: role cards, create/edit role (name,
   description, data-scope radio, full page-access matrix grouped like the sidebar), delete with
   reassignment warning. Invite-by-email path generates a `join.html?token=…` link consistent
   with the `public` group's join page. Known gap vs. real source: the real `/iam` also has a
   soft-delete "Anggota Nonaktif" table with a restore action; this file's Hapus is a hard
   removal with no restore — left as-is rather than rewritten, noted here.
4. **panduan.html** (`app/(app)/panduan`) — search box, 6-group tab filter (Memulai/Transaksi/
   Anggaran/Laporan/Keluarga & Peran/Keamanan, matching `i18n/id.ts` `panduan.groups`), feature
   cards (title + desc + link) sourced from the real per-feature copy, live result count, FAQ
   accordion (7 questions from source), contact cards (email/WhatsApp/phone).
5. **akun.html** (`app/(app)/akun`) — hero (avatar/name/email/role), profile-completion stepper,
   Profil / Keamanan / Preferensi / Bantuan tabs: profile fields + edit dialog, family/member
   list linking to IAM, inline change-password form, PIN dialog, auth-preference switches,
   active-sessions list with "Akhiri", theme (light/dark/system, wired to the real `data-theme`
   attribute), display-currency picker (7 currencies — honestly notes all amounts stay in
   Rupiah in this prototype, no conversion is simulated), language selector (honestly refuses
   English: "belum tersedia"), notification preferences, privacy preferences, export data (real
   JSON download of the store) and delete-account (confirm → simulated), FAQ, support contacts +
   feedback mailto, legal links (`legal.html?doc=…`), logout.
6. **akses-saya.html** (`app/(app)/akses-saya`, restricted-role home) — eyebrow badge by role,
   3 stat cards (rekening ditugaskan, saldo keluarga always "Tidak terlihat", laporan keluarga
   lock state by `WM.isOwner()`), assigned-accounts list from `WM.visibleAccounts()`, "Ajukan
   dana" flow (writes to `requests` + a matching `notifications` entry, mirrors the real
   allowance-request primitive), permitted-activity table, recent transactions scoped to visible
   accounts. Correctly shows the shell's lock state when opened as Master, per the page's own
   `WM.allowedPage` rule (verified by screenshot).
7. **notifikasi.html** (`app/(app)/notifikasi`) — filter chips (Semua / Belum dibaca /
   Transaksi / Anggaran / Persetujuan / Jatuh Tempo / Sistem), grouped by Hari ini / Minggu ini /
   Lebih lama with per-group unread counts, mark-one-read, mark-all-read, delete with undo toast
   (delete is a prototype addition — the real page has only mark-read — added because the group
   brief explicitly asked for it), click opens the stored `href` target after marking read,
   unread-count badge in the page title.

## Simulated / honest-UI notes already on-page

IAM invite-by-email and reset-password land in copyable credential views labeled as the real
action (no backend exists in this static prototype). `akun.html`'s export button triggers a real
client-side JSON download of the store. Currency display and the language switch both say
plainly that they don't change the numbers/text shown, rather than silently doing nothing.

## Known gaps

- `iam.html` has no removed/restore-member section (hard delete only).
- `akun.html`'s "Sesi aktif" list is static demo data (no real device fingerprinting is possible
  in a static prototype).

## This pass's fix

Re-verified all 7 pages with a fresh `node _shot.cjs` batch + screenshot review (this session had
no memory of the prior pass's report). Found and fixed one more layout bug the prior pass missed:
`iam.html`'s members-table "Aksi" cell put `.ibtn` buttons (`display:grid`, which blockifies a
plain inline button) directly as `<td>` siblings — grid buttons don't participate in inline flow,
so "Atur akses" stayed inline while the key/trash icon buttons dropped onto their own block lines,
inflating every row's height. Wrapped the three action buttons in a
`display:flex;justify-content:flex-end;flex-wrap:wrap` div (the same pattern `mastercoa.html`'s
and `masterdata.html`'s action cells already use) — confirmed fixed by screenshot.
