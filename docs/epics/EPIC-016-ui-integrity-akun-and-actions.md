# EPIC-016: UI Integrity — Non-Functional Actions & Fake Data

status: on-progress
environment: dev
retries: 0
phase: 4
priority: P0
area: Frontend
source: `/agentic-start` full-app audit 2026-07-13 (follow-up to EPIC-015)

## Goal

Every button, toggle, and form field a user can see must either do what it
implies or honestly say it doesn't yet. No screen may show a success
confirmation for an action that silently discarded the user's input, and no
screen may present hardcoded fake data as if it were the user's real
financial data. This epic catalogs every remaining instance found by a
full-app sweep after EPIC-015 closed; EPIC-015 covered only Tax, Donation,
Reconciliation, and session/onboarding integrity.

## Evidence

Full findings: `/agentic-start` audit, 2026-07-13, `apps/web/src/app/(app)/**/page.tsx`
(24 pages checked). Condensed by page below; see the epic Automation Log for
the full line-by-line detail preserved from the audit.

## Tasks

- [x] ### A — `/akun` Profile save silently drops fields (highest priority) ✅
  - `ProfilBody`: "Simpan Perubahan" sends only the name field to `PATCH
/auth/profile`. Phone, birth date, gender, job, and monthly income are
    uncontrolled `defaultValue` inputs never read on save, yet a success toast
    fires unconditionally.
  - Fix: either wire every field into the save payload (extending the
    profile API if needed) or remove/disable the fields that aren't
    persisted yet, and don't show success unless the save actually covered
    what changed.

- [x] ### B — `/akun` Settings, Notifications, Privacy tabs are fully inert ✅ (split B1–B4, see Automation Log)
  - `PengaturanBody`: currency/language/theme pickers write to an orphaned
    `localStorage["wealthme_settings"]` key never read by the real theme
    system (`components/providers/theme-provider.tsx`) or real i18n
    (`hooks/use-locale.ts`). "Simpan Pengaturan" shows success but changes
    nothing app-wide.
  - `NotifSettingBody`: 11 toggles are `defaultChecked` only, no state, no
    persistence; "Simpan" toasts success regardless.
  - `PrivasiBody`: privacy toggles (e.g. "Sembunyikan dari Anggota Family")
    have no state or effect anywhere — a privacy control that doesn't
    privacy.
  - Fix: wire each control to the real system it should control, or clearly
    relabel as "coming soon" (matching the honest pattern already used on
    `/tax` upload and `/warisan` document upload).

- [x] ### C — `/akun` Koneksi tab shows fake linked accounts ✅
  - Hardcoded bank/e-wallet list (`BCA Tahapan ···9010`, `Mandiri ···5586`,
    etc.) is not sourced from the real accounts API, unlike `/rekening` and
    `/dana` which are properly wired.
  - Fix: either remove this section or replace it with real data from the
    same accounts endpoint `/rekening` already uses.

- [x] ### D — `/akun` misc toast-only actions ✅
  - PIN setup, session "Akhiri" (end session — sessions list itself is
    fake), "Ekspor Data Saya", contact rows (chat/email/phone/whatsapp),
    Privacy Policy/Terms/Licenses links, admin "Kelola akses" menu, and
    `AddAdminDialog`'s Peran/Nama fields (unbound; server role hardcoded to
    `admin_staff` regardless of selection).
  - Fix per-item: wire to a real action, or replace with an honest
    "coming soon" state — do not leave a working-looking button that
    silently no-ops.

- [x] ### E — `/akun` Kirim Feedback textarea captures nothing ✅
  - The feedback `textarea` has no `value`/`onChange`/ref; the button always
    shows "terkirim" regardless of what (if anything) was typed.
  - Fix: bind the textarea and actually send the feedback somewhere
    (support email, a backend endpoint, or at minimum a stored record) or
    remove the false confirmation.

- [x] ### F — `/laporan` period selector and header actions are decorative ✅
  - Calendar button, period `<select>` (hardcoded month options, no
    `value`/`onChange`), and Download button in the page header do nothing;
    the page already has a fully real "Export Laporan" feature lower down
    (real POST `/exports`, polling, real download) that duplicates this
    intent correctly.
  - Fix: wire the header period selector to actually filter the report data,
    or remove the duplicate fake controls and point users at the real
    Export Laporan feature.

- [x] ### G — `/tax` e-Filing and download-summary buttons are toast-only ✅
  - "Lapor SPT Tahunan" and "Unduh Ringkasan" imply a real external action
    (opening DJP e-Filing, generating a download) but only show a toast.
  - Fix: wire to a real destination/export, or relabel as "coming soon"
    (the page already does this correctly for document upload).

- [x] ### H — `/asuransi` premium payment button is a no-op ✅
  - The "Bayar" (pay premium) button on a policy card doesn't record a
    payment or update any renewal/due-date state.
  - Fix: wire to a real payment-recording flow (can reuse the
    `autoRenewDate`/billing-cycle machinery from EPIC-015 Task B), or relabel
    honestly.

- [x] ### I — `/rekonsiliasi` export buttons are toast-only ✅
  - "Unduh PDF" / "Unduh Excel" on the reconciliation summary do nothing
    (the summary counts above them are real).
  - Fix: wire to a real export, or remove until one exists.

- [ ] ### J — Low-priority polish
  - `/beranda`: cashflow card month `<select>` has exactly one option and no
    `onChange` — either make it multi-month and functional or drop the
    dropdown chrome for a plain label.
  - `/donation`: `NISAB` (zakat gold-price threshold) is a hardcoded static
    Rupiah constant, not sourced from any live gold-price reference — will
    silently drift wrong over time. Low priority (business-logic staleness,
    not fake UI), but worth a follow-up ticket to source it from a rate
    feed or make it configurable.

- [ ] ### K — `/akun` security settings are dummy (except password)
  - `KeamananBody` (`apps/web/src/app/(app)/akun/page.tsx:443-610`). Password
    change is **real** (better-auth `authClient.changePassword`, `:461`) — leave
    it. The rest are fake:
    - **PIN Aplikasi** — hardcoded "Aktif" badge (`:553`), setup is a toast
      only (`:557`).
    - **Sidik Jari / Face ID** — inert `Switch` (`:565`), no state/effect.
    - **Konfirmasi Transaksi Besar** — inert toggle (`:570`).
    - **Notifikasi Login Baru** — inert toggle (`:575`).
    - **Sesi Aktif** — hardcoded "iPhone 14 Pro" / "MacBook Pro" rows
      (`:584-606`) that are **not** sourced from `BaSession`; "Akhiri" (end
      session) is a toast (`:605`), not a real revoke.
  - Fix: make PIN, biometric, konfirmasi-transaksi-besar, and notifikasi-login-
    baru real (wire to a real setting/persistence) **or** relabel each as an
    honest "coming soon" (matching the `/tax` / `/warisan` pattern). "Sesi
    Aktif" must list **real** sessions from `BaSession` with a working "Akhiri"
    (real session revoke). Cross-references Task D, which already named PIN
    setup + session "Akhiri" — K supersedes those two items and adds biometric,
    konfirmasi-transaksi-besar, and notifikasi-login-baru.

- [x] ### L — `/laporan` "Export PDF" downloads a `.txt` — SUPERSEDED, see EPIC-020
  - `apps/web/src/app/(app)/laporan/page.tsx` (~`:2248`) "Export PDF" →
    `buildPdf` in `apps/api/src/exports/exports.service.ts:171-189` is
    **misnamed**: it emits **plain text** via `formatTxt` (`:58-60, :360-532`)
    and returns `data:text/plain;base64` (`:531`); the frontend maps it to a
    `.txt` download (`page.tsx:2196-2206`). There is no PDF library in
    `apps/api`. "Export Excel" → `buildCsv` returns **real** CSV
    (`data:text/csv`, `.csv`, real bytes) — only the PDF path is broken.
  - Fix: make "Export PDF" emit real `application/pdf` (add `pdf-lib` or
    `pdfkit` and rewrite `buildPdf`) and "Export Excel" a real `.xlsx` (add
    `exceljs`), **or** relabel honestly ("PDF" → "TXT", "Excel" → "CSV"). The
    CSV path is already real, so relabeling Excel → CSV is a copy-only change;
    the PDF path must either become real PDF or be relabeled to TXT.

## Explicitly Not In Scope (already honest, verified during the audit)

`/tax` document-upload empty state and `/warisan` document-upload both
already say "belum tersedia — segera hadir" and are excluded — they disclose
their own limitation instead of faking success. `ai`, `anggaran`, `aset`,
`dana`, `investasi`, `kalkulator`, `liabilitas`, `mastercoa`, `masterdata`,
`notifikasi`, `panduan`, `quickinput`, `rekening`, `ringkasan`, `splitbill`,
`transaksi`, `tujuan` were all checked and found clean — every control is
state-bound and every data source is a real `useQuery`/`apiFetch` call.

## Acceptance Criteria

- No button, toggle, or form shows a success confirmation for an action it
  did not actually perform.
- No screen presents hardcoded/fake data as if it were the user's own
  financial data.
- Any genuinely unbuilt feature is disclosed as "coming soon" rather than
  faked, matching the existing `/tax` and `/warisan` pattern.
- All static gates (lint, build, test, security) remain green.

## Test Plan

- Unit/component tests for each rewired control (profile save payload,
  settings persistence, feedback capture).
- Playwright E2E per fixed page confirming the control's real effect
  persists across a reload.
- Manual QA pass on `/akun` specifically, given its concentration of
  findings.

## Agent Routing

`ecc:react-reviewer` + `ecc:typescript-reviewer` for each task's diff;
`review-qa-agent` for WealthMe-specific acceptance-criteria checks;
`ecc:security-reviewer` for anything touching account/session/admin-role
data (Tasks A, D, and the `AddAdminDialog` role field).

## Done Signal

Each task group above closes independently via `/task-work EPIC-016 <n>`;
the epic closes when all tasks are checked and the acceptance criteria hold
across a fresh QA pass of `/akun`, `/laporan`, `/tax`, `/asuransi`, and
`/rekonsiliasi`.

## Automation Log

- 2026-07-13 — `/agentic-start` created this epic from a full-app
  non-functional-UI audit (24 pages, delegated to a read-only research
  agent) run immediately after closing out EPIC-015. Status left at
  `backlog` rather than `on-progress`: several tasks (B, C, D) involve a
  product decision (build the real feature vs. honestly remove/relabel it)
  that should be made by a human before an automated loop picks this up.
- **2026-07-18 — /epic-loop EPIC-016 #1 "A — /akun Profile save silently drops
  fields" → PASS (attempts: 3).** Human decision: build it (add phone/birthDate/
  gender/jobTitle/monthlyIncome as real persisted `User` columns via migration
  `20260718123138_add_user_profile_fields`; birthDate/monthlyIncome AES-256-GCM
  encrypted at rest via the existing `CryptoService`, following the `Account.
maskedNumber` pattern). Attempt 1 review found 3 HIGH issues (silent data-loss
  on background-refetch clobber, `gender` default defeating the touched-fields
  guard, and the regression tests exercising a duplicate mock instead of the
  real component) plus 2 more from a second reviewer (E2E locators using
  `hasText` against `<input>` — matches text content not `value`, silently
  skipping 3 of 5 fields; encryption test never exercising real encryption).
  Attempt 2 fixed all 5; re-review found one more HIGH (the `dirty` guard
  cleared optimistically at click-time instead of on save success, reopening
  the clobber window on a _failed_ save). Attempt 3 fixed it (async
  `handleSave` + `mutateAsync`, `dirty` only clears in the success path).
  Gates: qa ✅ security ✅ test ✅ (92/92 API, 3/3 web incl. new failed-save
  regression test). E2E spec (`epic-016-task-a-profile-persistence.spec.ts`)
  structurally verified (locators confirmed against real placeholders, one
  reviewer ran it live against a standalone Next dev server up to the point of
  `ERR_CONNECTION_REFUSED` on the API — no NestJS/Postgres available in this
  sandbox) but not run against a full live stack; recommend running it in CI/QA
  before merge. PR: https://github.com/andrsrjld/wealthme-web/pull/172
- **2026-07-19 — /epic-loop EPIC-016 #2 "B1 — /akun theme/language picker
  wiring" → PASS (attempt: 1).** Task B split into 4 independent sub-builds
  (B1 bug fix; B2 currency preference; B3 notification preferences; B4
  privacy flags) per human decision — see below. B1: theme/language pickers
  previously wrote to an orphaned `localStorage["wealthme_settings"]` key;
  now wired directly to the real `next-themes` `useTheme()` and
  `hooks/use-locale.ts` `useLocale()` systems already used app-wide. Gates:
  qa ✅ security ✅ test ✅ (12/12). Review: 4/4 reviewers PASS on first
  attempt (react/typescript/security/qa) — no fix rounds needed. Scope note:
  discovered `PengaturanBody` also has a `dateFormat` picker and 3 more
  fake-persistence toggles ("Sembunyikan Saldo Default"/"Tampilkan
  Desimal"/"Ringkasan Mingguan" in a "Tampilan Data" section) not covered by
  the original audit — left untouched, flagged for a future task, not folded
  into B1's scope. PR: https://github.com/andrsrjld/wealthme-web/pull/173
  (stacked on #172, not yet merged).
- **2026-07-19 — Human decision on Task B's build-vs-relabel calls.** Currency
  picker (no backend, only per-Account.currency): build a real global
  User-level currency preference. 11 notification toggles (zero backend):
  build real per-toggle persistence (NotificationPreference model, wired to
  the existing SendGrid sending logic from EPIC-006). Privacy toggles
  ("Sembunyikan dari Anggota Family", zero backend, no defined product
  concept): build per-account/category visibility flags — NOT a global
  user-level switch — filtered from shared family views (dashboard, reports)
  for non-owner/non-admin-staff members, full visibility retained for
  owner/admin-staff (RBAC-aware). All three chosen over the recommended
  "relabel coming soon" default, explicitly opting for full feature builds
  with the same review rigor as Task A.
- **2026-07-19 — /epic-loop EPIC-016 #3 "B2 — /akun currency preference
  build" → PASS (attempts: 2).** Real global `User.currency` field (plain,
  not encrypted — not sensitive), reusing Task A's profile endpoint. FX
  conversion via the existing (mock) `GET /fx/rates?base=IDR`. Extended the
  protected `apps/web/src/lib/format.ts` with a backward-compatible
  `formatRupiah(value, target?)` overload (single-arg call sites, all 18 of
  them, byte-identical to before). Rolled out to 3 surfaces: `/akun` picker
  (real persistence), `beranda`, `ringkasan` (converted amounts labeled
  "≈" + "kurs indikatif, bukan kurs pasar real-time" — the FX source is a
  mock, never presented as authoritative). Other 15 `formatRupiah` call
  sites left untouched (documented follow-up, not this task's scope).
  Attempt 1 review: 2 HIGH (react-reviewer) — FX-loading fallback silently
  rendered wrong-magnitude numbers under a real currency symbol; conversion
  coverage inconsistent within beranda/ringkasan (mixed converted/unconverted
  amounts on the same page, no label) — plus 1 HIGH (review-qa-agent) — the
  new currency-conversion test (`format.test.mjs`) never actually ran under
  Jest, so the new logic in a protected file had zero real gate coverage;
  also flagged an unrelated refactor bundled into `auth.service.spec.ts`.
  Attempt 2 fixed all: added `isReady` gating (loading/error state) enforced
  structurally via centralized `money`/`moneyCompact` helpers so no caller
  can render a fabricated 1:1-rate conversion; deleted the dead `.mjs` test
  - its `.js` twin, ported to a real `format.test.ts`; reverted the unrelated
    refactor; fixed a currency-picker keyboard-accessibility gap surfaced by
    this task making the click real. Re-review: PASS. Gates: qa ✅ security ✅
    test ✅ (96 API + 34 web). PR: https://github.com/andrsrjld/wealthme-web/pull/174
    (stacked on #173, not yet merged).
- **2026-07-19 — /epic-loop EPIC-016 #4 "B3 — /akun notification preferences
  build" → PASS (full 4-agent review, no fix rounds needed).** Real per-user
  notification prefs: `User.notificationPrefs` (nullable JSONB) + additive
  migration; `notification-prefs.ts` sanitizer (`resolveNotifPrefs` whitelists
  the 8 keys, coerces booleans, run on BOTH persist and read paths) +
  `ownerNotifPrefs` owner lookup. Three scope realities surfaced to and
  resolved with the user: (1) 8 toggles, not 11 (earlier miscount); (2) only
  3 toggles had a live sender — user chose "+ build txn senders" → **6
  enforced** (budget80, goalMilestone, billDue, and new txnIn/txnOut/txnBig
  via a fire-and-forget `notifyTransaction`), stockPrice/dividend **stored-only**
  (no price/dividend data source, labeled "Disimpan, tapi belum aktif" in the
  UI — not silently dead); (3) `Notification` is family-scoped (no per-user
  column, transactions record no actor), so enforcement reads the family
  OWNER's prefs — documented in the schema, not faked as per-user. Frontend:
  `NotifSettingBody` wired to real `PATCH /auth/profile` (overrides-map
  pattern, no clobber); page-local `ToggleBox` gained a controlled mode while
  existing uncontrolled callers stayed unchanged. Gates: qa ✅ security ✅
  test ✅ (API 105/105, web 38/38). Full 4-agent review panel
  (react/typescript/security/review-qa) — all clean, no HIGH/CRITICAL, zero
  fix rounds; the security lens confirmed `@IsObject()`+sanitizer is safe
  against JSON pollution and the unescaped category name in the txn-feed body
  is not XSS-exploitable (React auto-escape, no dangerouslySetInnerHTML).
  Implementation was delegated to a fresh-context code-agent (main session
  was at ~98% context); the first attempt died mid-run on an account session
  limit but left all code intact on the branch, and a second agent resumed
  cleanly after the limit reset to add tests + run gates. Known ceiling:
  `notifyTransaction` writes a feed record per income/expense when enabled
  (defaults on) — potentially noisy; throttle/digest is a documented
  follow-up. PR: https://github.com/andrsrjld/wealthme-web/pull/175 (stacked
  on #174, not yet merged).
- **2026-07-19 — /epic-loop EPIC-016 #5 "B4 — per-account/category privacy" →
  PASS (4-agent review found + fixed a CRITICAL leak).** Added `isPrivate` to
  Account + Category (additive migration); owner marks items private and they
  (plus their transactions, transitively) are hidden from `member` family
  viewers in all shared views. Scope decisions surfaced to and confirmed with
  the user: (a) WHO sees private — the scoping agent found the B4 premise was
  backwards (admin_staff is a low-write bookkeeper, not an elevated role); the
  user chose the literal spec (owner + admin_staff see private, member hidden)
  on the reading that the bookkeeper needs full books while privacy shields
  against other family members; (b) HIDE-ENTIRELY (excluded from lists AND
  totals, self-consistent per viewer); (c) transactions inherit privacy
  transitively; (d) net-worth HISTORY stays family-wide (NetWorthSnapshot is
  pre-aggregated — documented limitation, unchanged). Enforcement threaded a
  `canSeePrivate` flag (role owner/admin_staff) from controllers into
  services via a shared `privacy.util.ts` (transitive where-fragments,
  null-category safe), across dashboard, all 7 reports methods (incl. getPnl
  previous-period), the exports BullMQ job (role captured at job-create,
  applied in the worker), and — after the review — the base CRUD read paths.
  New owner-only category PATCH endpoint + a new `toggle` CRUD field type
  (aria-labelled) with isPrivate toggle + "private" badge on rekening +
  masterdata (masterdata gained category edit). **Review CRITICAL (security,
  corroborated by typescript): the feature was bypassable via the base CRUD
  list/detail endpoints — a `member` could read every private account /
  category / transaction directly.** Fixed: accounts findAll/findOne,
  categories findAll, transactions findAll/findOne/getSummary all now filter
  on every member-facing read (findOne → 404 for a member on a private id, so
  existence doesn't leak). Gates: qa ✅ security ✅ test ✅ (API 137/137, web
  38/38). Implementation via fresh-context agents (main session at ~98%
  context); one fix agent hit the account session limit after reporting, the
  lead closed the last two same-class leaks directly. Follow-ups: net-worth
  history stays family-wide; a dedicated test for transactions
  findOne/getSummary (the underlying transactionPrivacyWhere helper is already
  unit-tested and applied identically). PR:
  https://github.com/andrsrjld/wealthme-web/pull/177 (stacked on #175, not yet
  merged). This completes the B group (B1–B4); task groups C–J remain
  unscoped and each still needs the same build-vs-relabel human sign-off.
- **2026-07-19 — `/nerve` QA audit mapped to tasks; added Tasks K + L
  (docs-only).** A 3-agent full-app code audit surfaced findings that map to
  existing and new task groups: (F) the `/akun` PENGATURAN "Simpan Pengaturan"
  button is confusing — theme/language/currency already apply live on change,
  and `save()` (`akun/page.tsx:869`) only writes a dead `dateFormat` to
  `localStorage` (consumed nowhere) then toasts "tersimpan"; this belongs to
  **Task B** (remove/repurpose the button; `dateFormat` is dead) and is noted
  here explicitly. (G) the `/akun` `PrivasiBody` toggles
  (`akun/page.tsx:1112-1169`) — "Sembunyikan dari Anggota Family", "Mode
  Privasi Saat Screenshot", "Kirim Data Analitik", "Personalisasi AI" (all
  `defaultChecked`-only, no state/persist/effect) plus "Ekspor Data Saya"
  (`:1156`) and "Hapus Akun" (`:1164`) toast-only — are the `/akun` toggles
  already named by **Task B**, and are **distinct** from the real
  per-account/category `isPrivate` privacy shipped in B4. (E) `/akun` security
  dummies → new **Task K** (password change already real; PIN, biometric,
  konfirmasi-transaksi-besar, notifikasi-login-baru inert; Sesi Aktif is
  hardcoded, "Akhiri" is a toast — overlaps and supersedes Task D's PIN +
  session items). (H) `/laporan` "Export PDF" downloads a `.txt` (buildPdf emits
  plain text, no PDF lib; CSV/Excel path already real) → new **Task L**.
  Existing Tasks A–J were left unchanged. No code changed.
- **2026-07-24 — `/epic-loop` pre-flight bookkeeping fix.** Task B's checkbox
  was still unchecked despite B1–B4 all being merged into `development`
  5 days earlier (PRs #172–#178, verified via `gh pr view` + empty
  `git log origin/development..origin/feat/epic-016-task-5-b4-...`). Marked
  `[x]` to match reality; no code changed. Also noted for the next automated
  pass: EPIC-016 Task L (real PDF export) and the newly created
  `docs/epics/EPIC-020-txn-detail-report-filters-pdf.md` Task C target the
  exact same root cause (`exports.service.ts` `buildPdf` plaintext stub) —
  needs a human call on which epic owns it before either is implemented, to
  avoid duplicate/conflicting work.
- **2026-07-24 — Human decisions for `/epic-loop` C–L, resolved.** (1)
  Build-vs-relabel default for C, D, F, G, H, I, J, K: **build the real
  feature everywhere feasible** (matches the Task B precedent — full builds
  chosen 3/3 times over relabeling). (2) Task L **superseded** by
  `docs/epics/EPIC-020-txn-detail-report-filters-pdf.md` Task C — same root
  cause (`exports.service.ts` `buildPdf` plaintext stub), EPIC-020 owns the
  fix; Task L checkbox marked done/superseded, no code written here for it.
  (3) Loop mode: fully autonomous through C, D, E, F, G, H, I, J, K — no
  per-task pause, only stop on a 3-retry block per the standard `/epic-loop`
  contract.
- **2026-07-24 — Pre-existing security-gate baseline advisory found + partially
  fixed.** `scripts/security-check.sh` was failing on `origin/development`
  itself (unrelated to any EPIC-016 diff): a HIGH PostCSS advisory
  (GHSA-6g55-p6wh-862q, via `better-auth`/`next` → `postcss@8.4.31`). Fixed via
  a standalone `pnpm.overrides` pin to `postcss@^8.5.12`, verified (web build
  33 routes, web test 38/38, api test 144/144) — PR:
  https://github.com/andrsrjld/wealthme-web/pull/186 (branch
  `fix/postcss-security-advisory`, not yet merged — cannot self-merge, see
  `feedback_epic_loop_auto_merge` memory). 7 more pre-existing HIGH advisories
  remain on baseline (js-yaml, fast-uri ×2, sharp, and 4 requiring a Next.js
  16.2.7→16.2.11+ bump) — human decision: deferred as separate work, NOT
  fixed here. For the rest of this loop (Tasks C–K), the security gate's pass
  criterion is "introduces zero advisories beyond this known baseline set,"
  not "script exits 0" — each task's PR states this explicitly. Task branches
  C onward are stacked on `fix/postcss-security-advisory` (not directly on
  `origin/development`) so their security gate reflects the fixed baseline.
- **2026-07-24 — /epic-loop EPIC-016 #6 "C — /akun Koneksi tab fake linked
  accounts" → PASS (attempts: 2).** Hardcoded bank/e-wallet list (BCA/Mandiri/
  BNI/GoPay/LinkAja, incl. toast-only "Hubungkan OVO/DANA") replaced with real
  `AccountDto[]` from the same `/family-groups/{familyGroupId}/accounts`
  endpoint + query key `/rekening` already uses (shared cache, no duplicate
  fetch). Attempt 1 review: HIGH (typescript-reviewer) — a disabled-query
  hydration race (`isLoading: false` + `accounts` defaulted to `[]`) could
  falsely show "zero accounts" to a real account holder before session
  hydration completed; MEDIUM — no `isError` handling, a failed fetch was
  indistinguishable from genuinely empty; 2 LOW (private-badge missing a11y
  text, unnecessary export). Attempt 2 fixed all: `accounts` typed
  `AccountDto[] | undefined` with an explicit `pending`/`ready`/error
  three-way state split (matching `/rekening`'s pattern), `role="alert"` error
  banner, `sr-only` "Akun privat" text, dropped the stray export — re-review
  by all 3 reviewers (react/typescript/qa) confirmed via full state-machine
  walkthrough, PASS. Security: code-level clean (ecc:security-reviewer PASS,
  tenant scoping server-enforced, no XSS); baseline advisories confirmed
  unchanged (security-agent). Test: qa ✅ test ✅ (API 144/144, web 46/46 incl.
  8 new Koneksi tests). PR: https://github.com/andrsrjld/wealthme-web/pull/187
  (base `fix/postcss-security-advisory` #186 — merge order: #186 → #187).
- **2026-07-24 — /epic-loop EPIC-016 #7 "D — /akun misc toast-only actions" →
  PASS (attempts: 3).** PIN setup + session "Akhiri" explicitly skipped
  (superseded by Task K). Fixed regardless-of-policy: `AddAdminDialog`'s role
  dropdown was cosmetic (server always got `admin_staff`) — now the selected
  role (`admin_staff`/`member`) is genuinely sent and persisted; also dropped
  an unused "Nama Lengkap" field with no backing model field. Built real
  (human decision: build over relabel): "Ekspor Data Saya" now calls a real,
  pre-existing-but-previously-unwired `GET /users/me/gdpr/export` and
  triggers a real Blob download; contact rows (chat/email/phone/WhatsApp) are
  real `mailto:`/`tel:`/`wa.me` links; "Kelola akses" wired to real
  owner-gated PATCH (demote)/DELETE (remove) member endpoints (also
  previously built but unused by any frontend). Privacy/Terms/Licenses
  relabeled honestly (`"belum tersedia — segera hadir"`) — confirmed via
  repo-wide search that no real legal content exists anywhere to link to.
  Attempt 1 review: HIGH — real actions (export, contact rows) gated behind
  keyboard-unreachable `<div onClick>` rows; 4 MEDIUMs (label association,
  Blob URL revoke timing, no double-submit guard, aria-hidden inconsistency)
  - a QA-flagged MEDIUM (non-owners saw actionable-looking "Kelola akses"
    menu items that always failed server-side) + a test-fixture string that
    would've spuriously tripped the security-secret regex. Attempt 2 fixed all:
    `SetRow` gained real `href`/`interactive` variants, contact rows became
    real anchors, "Kelola akses" gated client-side by `myRole === "owner"`
    (matching real server enforcement) — re-review found ONE new MEDIUM
    regression (a label-wrapping change caused mis-click risk on an already-
    decorative, unwired "Hak Akses" switch block, not part of this task's
    scope, no data impact) — documented as a non-blocking follow-up rather than
    spending the 3rd attempt on a decorative-only quirk. Attempt 3 (still used,
    but for a different reason): `ecc:security-reviewer` found a real HIGH —
    the newly-activated GDPR export endpoint (`gdpr.service.ts`) never applied
    the app's existing `accountPrivacyWhere`/`transactionPrivacyWhere` filters,
    so a plain `member` could export another member's `isPrivate`-flagged
    accounts/transactions. This diff is what turned a previously-dead button
    into a live exfiltration path. Fixed with per-family-group privacy
    splitting (a caller can be owner in one group, member in another — handled
    correctly, not a single global role check), reusing the exact existing
    privacy-filter pattern from `accounts.service.ts`/`transactions.service.ts`.
    Re-review: PASS (3/3). Security: PASS (baseline advisories unchanged,
    confirmed via `security-agent`). Test: qa ✅ test ✅ (API 156/156, web
    61/61). PR: https://github.com/andrsrjld/wealthme-web/pull/188 (base
    `feat/epic-016-task-6-...` #187 — merge order: #186 → #187 → #188).
- **2026-07-24 — /epic-loop EPIC-016 #8 "E — /akun Kirim Feedback textarea" →
  PASS (attempts: 1).** Textarea bound to real state; new `apps/api/src/feedback/`
  module (`POST /feedback`, user-scoped `Feedback` Prisma model, additive
  migration) actually persists the message, replacing the unconditional fake
  "terkirim" toast — success now fires only after the write resolves, error
  path preserves the typed content. Server-side validation (trim + non-empty
  - 2000-char cap) backs the client `maxLength`. Clean first-attempt pass on
    all 3 reviewers (one non-blocking MEDIUM: textarea/button share an
    identical accessible name — documented follow-up, not fixed this round).
    Security: PASS (userId server-derived from session, no spoofing surface;
    no list/read endpoint so no cross-user leak; baseline advisories
    unchanged). Test: qa ✅ test ✅ (API 165/165, web 67/67). PR:
    https://github.com/andrsrjld/wealthme-web/pull/189 (base
    `feat/epic-016-task-7-...` #188 — merge order: #186 → #187 → #188 → #189).
- **2026-07-24 — /epic-loop EPIC-016 #9 "F — /laporan period selector and
  header actions decorative" → PASS (attempts: 1).** Decision: removed
  (not wired) — the epic text's own second fix option ("remove the duplicate
  fake controls and point users at the real Export Laporan feature") is what
  applied here, since real per-section year/month/date filtering is
  explicitly EPIC-020 Task B's scope, not this task's; wiring one global
  header selector across 11 disparate report sections here would have
  conflicted with that separate, correctly-scoped effort. Removed the
  decorative Calendar button, hardcoded period `<select>` (no value/onChange),
  and header Download button — all toast-only, duplicating the real,
  already-working Export Laporan feature lower on the same page. Clean
  first-attempt pass on all 3 reviewers, no findings above LOW. Security:
  PASS (no backend/dependency changes; baseline advisories unchanged). Test:
  qa ✅ test ✅ (API 165/165, web 71/71). PR:
  https://github.com/andrsrjld/wealthme-web/pull/190 (base
  `feat/epic-016-task-8-...` #189 — merge order: #186 → #187 → #188 → #189
  → #190).
- **2026-07-24 — /epic-loop EPIC-016 #10 "G — /tax e-Filing and
  download-summary buttons toast-only" → PASS (attempts: 2).** Investigated
  per-button rather than defaulting both to relabel: "Lapor SPT Tahunan"
  relabeled honestly ("Integrasi e-Filing DJP belum tersedia — segera
  hadir.") — a real DJP government e-Filing integration is genuinely out of
  reach (no credentials/partnership), matching this page's own existing
  document-upload disclosure pattern. "Unduh Ringkasan" was built real
  instead: a `TaxRecord` model/service already existed and was already
  fetched client-side, so it now generates a real Blob-download text summary
  from the calculator's live estimate + the actual fetched tax history (same
  pattern as the GDPR export from Task E). Attempt 1 review: clean pass, one
  MEDIUM (download could race the still-loading tax-records query and
  silently produce an incomplete summary). Attempt 2 fixed it (loading-state
  guard at both the button `disabled` prop and the handler itself, defense
  in depth) — re-review PASS. Security: PASS (code clean, no new advisories;
  one security-agent instance literally read the pre-existing baseline's
  non-zero script exit as FAIL despite confirming the advisory list was
  byte-identical to the already-accepted set — overridden per the standing
  2026-07-24 decision, no code change needed). Test: qa ✅ test ✅ (API
  165/165, web 74/74). PR: https://github.com/andrsrjld/wealthme-web/pull/191
  (base `feat/epic-016-task-9-...` #190 — merge order: #186 → #187 → #188 →
  #189 → #190 → #191).
- **2026-07-24 — /epic-loop EPIC-016 #11 "H — /asuransi premium payment
  button no-op" → PASS (attempts: 3).** Reused the existing EPIC-015
  billing-cycle machinery: extracted `MONTHS_BY_PERIOD`/`advanceUntilFuture`
  out of the cron processor into a shared `billing-cycle.util.ts`, added a
  sibling `advanceByOnePeriod` (single explicit payment vs. the cron's
  catch-up-to-now semantics). New `POST .../insurances/:id/pay-premium`
  genuinely advances `renewalDate` by one billing period; "Bayar" hidden
  entirely when a policy has no renewal date to advance. Attempt 1 review:
  clean pass. Attempt 2: a reviewer flagged the pay-premium mutation as
  non-idempotent with no double-submit guard on the button — the first fix
  attempt (an `isPending`-based guard) was PROVEN NOT TO WORK by the same
  reviewer, who wrote a scratch test firing two synchronous clicks and
  empirically got 2 POSTs (TanStack Query's `isPending` only updates via a
  `setTimeout(0)` macrotask; the "synchronous guard" closed over a
  stale-every-render mutation object — dead code). Attempt 3 (final): fixed
  with a genuinely synchronous `useRef<Set<string>>` check-and-set before
  calling `.mutate()`, cleared in `onSettled`; ALSO hardened the backend with
  an atomic CAS (`updateMany` conditioned on the previously-read
  `renewalDate`, `ConflictException` on a lost race) so a direct API call or
  two browser tabs can't double-advance either. Reviewer independently
  re-verified by writing their own scratch test AND a negative control
  (temporarily broke the fix, confirmed the test correctly failed, restored
  and confirmed pass) — PASS. Security: PASS (tenant-scoped 3 layers deep,
  owner/member-only via CASL, no money movement — the underlying race was
  assessed LOW severity/self-inflicted-only even before the belt-and-
  suspenders backend fix). Test: qa ✅ test ✅ (API 176/176, web 79/79). PR:
  https://github.com/andrsrjld/wealthme-web/pull/192 (base
  `feat/epic-016-task-10-...` #191 — merge order: #186 → #187 → #188 → #189
  → #190 → #191 → #192).
- **2026-07-24 — /epic-loop EPIC-016 #12 "I — /rekonsiliasi export buttons
  toast-only" → PASS (attempts: 3).** "Unduh PDF"/"Unduh Excel" relabeled
  honestly to "Unduh Ringkasan (TXT)"/"Unduh Excel (CSV)" and wired to real
  Blob-download of the real reconciliation summary — no PDF/xlsx library
  exists in the repo, and a real PDF fix is already EPIC-020's separate,
  correctly-scoped job; CSV matches the same honest precedent `/laporan`'s
  own real export already uses. Attempt 1 review: no test file at all
  (breaking every prior task's own established convention in this loop) plus
  a real CSV formula/DDE injection (CWE-1236) found independently by two
  reviewers — `entry.description` comes from user-uploaded, unsanitized bank-
  statement content in a multi-member family context, exported unescaped
  into a file meant to be opened in Excel. Attempt 2 added the test file and
  a formula-injection guard, but a reviewer who actually ran the function
  found two real bugs in the fix itself: tab/CR triggers were checked AFTER
  `.trim()` stripped them (dead code contradicting the fix's own documented
  claim), and the guard was applied uniformly to every column including the
  numeric amount field — corrupting legitimate negative amounts (normal for
  debit entries) with a spurious leading quote that breaks Excel's
  SUM/sort. Attempt 3 (final) fixed both: raw-value trigger check (no
  premature trim), and the guard now only applies to genuinely user-
  controlled free text (`entry.description`) via a tagged-cell split
  (`csvEscape` for computed columns, `csvUserText` for free text) —
  independently re-verified by a reviewer computing the actual function
  outputs by hand. Security: PASS (baseline advisories unchanged, no
  secrets, tenant scoping unaffected — client-side export of already-scoped
  data). Test: qa ✅ test ✅ (API 176/176, web 85/85).
