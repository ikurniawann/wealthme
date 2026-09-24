# EPIC-032: Client design revisions (Sept 2026) — Donasi, sidebar, IAM labels, istri role

status: backlog
environment: dev
retries: 0

## Goal

Collect the client's (Dax) design and role feedback from 2026-09-24 into one
place before any implementation. Nothing here is built yet unless noted.

## Decisions

| #   | Decision                                                                                                                                                                                                                                    | Rejected                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| R1  | Istri = **Co-Master (`spouse`)**: full financial reach, but member management (IAM) and family settings stay with the single Master (the head). Restores the EPIC-023 D2 "one accountable head" rule. (user-confirmed 2026-09-24, option A) | B: keep istri as `owner` and only relabel her in the UI |

## Tasks

### 1. De-slop every app page — less text, (i) icons (scope widened 2026-09-24)

Client verdict: "Ini AI bgt", "jangan banyak tulisan". User: applies to **all
29 pages under `app/(app)`**, not just Donasi. Use the installed design skills
(taste-skill / redesign-skill, antislop + antislop-copywriting/-ui/-human,
web-design-guidelines, minimalist-skill) as review lenses.

Baseline scan (`i18n/id.ts`, 2026-09-24): 279 em-dashes, 88 lines with emoji,
26+ single-line strings ≥80 chars (multi-line strings not counted), 7
`uppercase tracking` eyebrow labels in app/components.

Shared rules for every page:

- [ ] Page subtitles/taglines and per-card explainer paragraphs → removed or moved behind one (i) tooltip at the card's top-right.
- [ ] No em-dash (`—`) in visible copy; no emoji in titles/labels (use lucide icons, already the project's set).
- [ ] Helper text only where it prevents a mistake; ≤1 short line.
- [ ] Info banners ("Untuk anggota tanpa email…", "Persetujuan … kini punya halamannya sendiri") → (i) or removed.
- [ ] One shared `InfoTip` pattern (Base UI tooltip) instead of per-page inventions — needs a reviewed `components/wm` addition.
- [ ] Per page: audit screenshot before/after (light + dark, desktop + 390px).

#### Page audit (demo site, 1440×900, light, 2026-09-24)

Metrics per page: visible words · em-dashes · text nodes with emoji · text nodes ≥70 chars.

| Priority | Page                                                               | Words · — · emoji · long  | Main problems                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | mastercoa                                                          | 1529 · 44 · 2 · 16        | Whole page is a tutorial: "Apa itu Master COA?" essay, yellow risk banner, 6 group cards each with paragraph + "Contoh:" box, CAPS emphasis (TIDAK, KEMBALI). → table of groups; explanation behind (i) / collapsible "Pelajari"; risk warning only on the edit dialog |
| P0       | akun                                                               | 664 · 18 · 4 · 10         | Info banners in Anggota card, raw `member-…@members.internal.wealthme.invalid` emails shown, "Disimpan, tapi belum aktif — …" notes, 2 Master rows (Task 4)                                                                                                            |
| P0       | panduan                                                            | 588 · 8 · 1 · 26          | Wall of long paragraphs; needs accordion/search, one line per item                                                                                                                                                                                                     |
| P0       | notifikasi                                                         | 484 · 18 · 28 · 4         | Emoji on every row, em-dash in titles ("Pengeluaran Utang — …"), raw ids in text "(6b938282)", subtitle paragraph                                                                                                                                                      |
| P1       | masterdata                                                         | 394 · 5 · 30 · 2          | Emoji before every category chip + title (🗄️ 🏷️ 🏦 💳), teal info banner, category codes + "Bawaan" pill on every chip                                                                                                                                                 |
| P1       | anggaran                                                           | 400 · 3 · 19 · 0          | Emoji icon tiles on every row, "Belum Dibayar" pill repeated 6× (the section title already says it), dot-separated meta lines                                                                                                                                          |
| P1       | donation                                                           | 211 · 5 · 11 · 3          | See Donasi specifics below                                                                                                                                                                                                                                             |
| P1       | tax                                                                | 301 · 3 · 11 · 2          | Emoji, long helper lines ("Diketik \"78000\"…")                                                                                                                                                                                                                        |
| P1       | rekonsiliasi                                                       | 346 · 5 · 0 · 4           | Long helper sentences around the upload/template select                                                                                                                                                                                                                |
| P1       | ai                                                                 | 218 · 0 · 6 · 3           | Subtitle, 👋 greeting, long disclaimer → (i)                                                                                                                                                                                                                           |
| P2       | rekening, dana                                                     | 188/154 · 5/1 · 8/9 · 1/0 | Emoji tiles, em-dashes                                                                                                                                                                                                                                                 |
| P2       | beranda                                                            | 339 · 0 · 4 · 0           | 👋 greeting + "Yuk, lihat…" subtitle; ID/EN toggle floating on page; "Aset Likuid · 3.4%" meta; stray line glyph left of hero chart                                                                                                                                    |
| P2       | tujuan, splitbill, quickinput, kalkulator                          | ≤200 · 1-3 · ≤4 · ≤1      | Subtitles, one long helper each (kalkulator "Semua kolom rupiah otomatis…")                                                                                                                                                                                            |
| P2       | laporan, ringkasan, investasi, aset, liabilitas, asuransi, warisan | 118-311 · 0-3 · 0-3 · 1-2 | One long subtitle/disclaimer each → (i)                                                                                                                                                                                                                                |
| P3       | transaksi, persetujuan, akses-saya, iam                            | small                     | akses-saya has 3 long sentences; iam checked separately in Task 4                                                                                                                                                                                                      |

Cross-page patterns found:

- Emoji prefixed to page titles (📚 Master COA, 🗄️ Setup Master Data) and card titles.
- Every page has a subtitle under the H1; the topbar already shows the page name, so the H1 + subtitle repeats it.
- Colored info banners (teal/yellow) used for explanation, not for state.
- `·` meta strings stacked with several values per line.
- Numbered group labels ("1 · Pemasukan").

Screenshots: kept locally (scratchpad `audit/*.png`), not committed.

Donasi specifics (first page, used as the pattern):

- [ ] Replace the religion-not-chosen banner's title + paragraph with a compact row (select + save); move the explanation into an (i) tooltip.
- [ ] Tithe/Zakat calculator card: drop subtitle, helper text and "10% dari penghasilan" badge; one (i) icon top-right carries the explanation; replace the ✝️ emoji in the title with an icon.
- [ ] Remove the "Catat donasi & tunaikan kewajiban zakat" tagline under the hero.
- [ ] Result box shows label + amount only.

Files: `apps/web/src/app/(app)/donation/page.tsx`, `apps/web/src/i18n/{id,en}.ts`.

### 2. Sidebar — collapsible groups (accordion)

Client: "toggle ke pinggir, toggle ke bawah" with reference screenshot; grouping left to us.

- [ ] Group headers are `<button aria-expanded>` with icon, label, chevron on the right edge; children render below with a left rail.
- [ ] Proposed groups (awaiting OK): ungrouped Beranda/Ringkasan/Transaksi/Notifikasi · Perencanaan (Anggaran, Laporan, Tujuan) · Kekayaan (Dana, Rekening, Investasi, Aset, Liabilitas, Asuransi) · Kewajiban & Keluarga (Warisan, Donasi, Tax, Persetujuan) · Alat (Split Bill, Rekonsiliasi, AI, Kalkulator, Quick Input) · Pengaturan (Master COA, Master Data, IAM, Panduan).
- [ ] Group containing the active page auto-opens; open state persisted in localStorage; collapsed rail stays icon-only; mobile nav sheet follows; empty groups (after access filter) hidden; honors `prefers-reduced-motion`.

Files (protected, reviewed foundation change): `apps/web/src/lib/nav.ts`, `apps/web/src/components/shell/sidebar-sections.tsx`, sidebar CSS in `design-system.css`.

### 3. Relationship labels capitalized

- [x] "Hubungan Keluarga" select options capitalized for display (value stays lowercase). `iam/_components/add-member-dialog.tsx` — done 2026-09-24, not yet gated/deployed.
- [ ] Same for the heir list in `warisan/page.tsx:243`.
- [ ] "— Tidak diisi —" / "— Not set —" placeholder: drop the em-dashes.

### 4. Istri role = Co-Master (R1)

Today `DEFAULT_ROLE_BY_RELATIONSHIP.istri = "owner"` (EPIC-024 A1), enforced server-side, so an istri is indistinguishable from the head: two "Master" rows in IAM and Akun, and she can manage members/settings.

- [ ] `packages/contracts/src/members/index.ts`: `istri → spouse`; update the EPIC-024 A1 comment.
- [ ] API: server-side istri enforcement and the one-per-family cap move from `owner` to `spouse` (`family-groups.service.ts` and related DTOs).
- [ ] Data migration: existing members with relationship `istri` and role `owner` who are not the group head → `spouse`. Needs a way to identify the head; confirm the field before writing it. **Human review required (DB change).**
- [ ] UI: `iam/_components/members-tab.tsx` and `akun/page.tsx` show Master only for the head and Co-Master for `spouse`; "Kepala keluarga" only on the head row.
- [ ] Tests for the role default, the cap, and the migration.

## Acceptance Criteria

- Donasi page shows no explanatory paragraphs; explanations live behind (i) icons.
- Sidebar groups collapse/expand with the chevron on the right; the active page's group is open.
- Relationship values display capitalized everywhere, with no em-dash placeholder.
- A family has exactly one Master; an istri shows and behaves as Co-Master (no member/settings management).

## Automation Log

- 2026-09-24 — Revisions collected from client screenshots (WhatsApp). Decision R1 (option A) confirmed by user. Task 3 first item implemented ahead of this list; the rest is not started.
- 2026-09-25 — Task 1 shared pieces + Donasi done: `components/wm/info-tip.tsx` (i) popover; Donasi subtitle/banners/helper text moved behind (i); app-wide copy pass on `i18n/{id,en}.ts` + 20 components (emoji out of titles/labels/toasts, " — " → ", "); 10 visible JSX em-dash separators replaced with ":" / "·"; beranda 👋 + subtitle removed.
- 2026-09-25 — **Reviewed foundation change** (user asked for a full dashboard UI audit): appended a "foundation polish" block to `app/design-system.css` (protected file). One motion curve (`--ease-spring`), radius scale (16px surfaces / 10px controls), cards flat on a hairline with elevation reserved for the hero + dialogs, concentric inner bezel on `.hero` (replaces the decorative circle), press feedback on buttons/nav, solid accent for the active nav item (no gradient), softer section headers, lucide stroke 1.75, dialog and page-entry motion honouring `prefers-reduced-motion`. Verified light, dark and 390px. Audit lenses: taste-skill, soft-skill, antislop-ui.
