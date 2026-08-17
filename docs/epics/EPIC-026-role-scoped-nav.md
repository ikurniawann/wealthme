# EPIC-026 addendum: role-scoped navigation + IAM wiring

status: ready-for-qa
environment: dev

## Goal

A row-scoped member (`dependant` = "Anak", `operational` = "Staff") must not
see a master-sized menu. Wire /iam to real member data.

## Automation Log

- **Finding (nav).** `sidebar-sections.tsx` filtered on `ownerOnly` only, so a
  dependant saw 26 of 26 sidebar entries. Nearly all of them 403: CASL grants
  the role only Account/AllowanceRequest/FamilyGroup/Transaction (+Inheritance
  for dependant), and `assertHouseholdWideReadAllowed` denies
  /dashboard, /reports, /exports, /ai-advisor outright.
- **Decision.** Allowlist (`ROW_SCOPED_NAV_ALLOWLIST` in `lib/nav.ts`) derived
  from those CASL grants, not from a guess. New nav items are hidden from
  row-scoped roles by default; exposing one is a deliberate edit.
- **Finding (landing).** A child still landed on /beranda, whose summary call
  403s, degrading to a screen of "Rp 0" tiles — reads as "family has no money"
  rather than "no access". Added `RowScopedRouteGuard` redirecting denied
  routes to /akses-saya (the prototype's designated "Preview Anak / Staff"
  page). UX only; the API remains the real boundary.
- **Finding (IAM).** `/iam` had zero network calls — the members table was a
  hardcoded 4-row mock (Demo User/Siti/Aisyah/Pak Dedi) shown to every family.
  `GET /family-groups/:id/members` already existed; the page now reads it.
  "Terakhir aktif" renders "—" because `MemberResponseDto` carries no
  last-login field — not fabricated.
- **Proof.** Playwright, live: master 26 sidebar items / lands /beranda;
  dependant 7 items (Transaksi, Notifikasi, Cash & E-Wallet, Bank & Account,
  Warisan, Quick Input, Panduan) / lands /akses-saya; direct URLs
  /beranda,/laporan,/aset,/iam all bounce to /akses-saya while /transaksi
  stays. Master unaffected on all four. 12 unit tests in `nav-roles.test.ts`.
  Gates: tsc web+api clean, eslint clean, api 1142/1142, web 442/444 (the 2
  failures are pre-existing in login/page.test.tsx, verified on a clean tree).

## Automation Log — IAM page made functional

- **Finding.** Beyond the mock table, `/iam` had 3 buttons and **zero**
  `onClick` handlers: "Buat Role", "Kelola Permission", "Assign Akses" were
  all inert. Role-card member counts were the literals 1/1/2/1.
- **Wired to endpoints that already existed** (no new backend needed):
  add member → `POST /members/dependant`; change role → `PATCH /members/:id`;
  remove → `DELETE /members/:id`; list → `GET /members`. Counts now derived
  from the real roster.
- **"Buat Role" → "Tambah Anggota".** `Role` is a fixed Prisma enum; there is
  no create-role endpoint, so a "create role" dialog would have been theatre.
  The button now performs the action the backend actually supports.
- **"Kelola Permission" removed.** CASL grants are compiled into
  `casl-ability.factory.ts` with no runtime edit path; replaced with a
  "Ditetapkan sistem" badge rather than a control that cannot work.
- **a11y fix (High).** `design-system.css` hid row-action buttons at
  `opacity: 0` until `tr:hover`. On a touch device — which has no hover —
  they stayed invisible yet clickable, i.e. an invisible tap target, and
  "Ubah Role"/"Hapus" were undiscoverable on a phone. Wrapped the rule in
  `@media (hover: hover) and (pointer: fine)`. Verified: desktop opacity 0
  (unchanged, matches prototype), touch opacity 1.
- **Proof (Playwright, live).** add → "Budi Staff | Staf Operasional" appears;
  change role → "Budi Staff | Tanggungan"; delete → row gone. Zero page
  errors. Gates: tsc web+api clean, eslint clean, web 442/444 (2 pre-existing
  login failures, verified on a clean tree), api 1142/1142.

## Automation Log — funding approval was completely broken

- **Symptom.** "Setujui Permintaan Dana" always failed with
  "fromAccountId is required to approve a funding request", even with a
  source account selected.
- **Not the frontend.** `persetujuan/page.tsx` disables the approve button
  while `fromAccountId` is empty, so an empty value could not be submitted.
  Reproduced straight against the API with a valid account UUID → same 400.
- **Root cause.** `allowance-requests.controller.ts` imported the body DTO
  `type`-only: `import { type ApproveAllowanceRequestDto }`. TypeScript erases
  a type-only import, so no runtime class reached `design:paramtypes`; the
  global ValidationPipe (`whitelist: true`, main.ts) found no validation
  metadata and stripped EVERY body property, leaving `dto.fromAccountId`
  undefined for every caller. The funding-approval path was 100% unusable.
  Origin: the sibling DTO imports carry
  `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`;
  this one did not, so the lint rule's autofix turned it into a type import.
  The disable comment is now restored alongside the value import.
- **Proof.** Same request after the fix → 200, `fromAccountId` persisted, and
  money actually moved: Kas Tunai 3.000.000 → 2.950.000, Mandiri Hima
  1.000.000 → 1.050.000; request status `approved`. A repeat call now answers
  409 "already been decided" (correct).
- **Regression test.** `allowance-requests.controller.spec.ts` asserts
  `design:paramtypes[2]` is the real `ApproveAllowanceRequestDto` class, not
  `Object`. A service-level test cannot catch this — the property is already
  gone by then. Verified the test FAILS when the `type` keyword is
  reintroduced, then passes once removed.
- **Swept the repo:** only one other type-only DTO import exists
  (`AiKeyStatusDto`), used solely as a return type, never `@Body()` — safe.
- **Gates.** tsc clean, eslint clean, api 1143/1143.

## Automation Log — forced password change bounced back to itself

- **Symptom.** Setting a new password on `/ubah-password-wajib` succeeded but
  appeared to fail; the only way through was to sign out and sign back in
  with the new password.
- **Root cause (a race, not a failure).** `POST /auth/set-password` returns
  204 and clears `mustChangePassword` server-side. The page then fired
  `void queryClient.invalidateQueries(["auth","password-status",token])` —
  fire-and-forget — and navigated immediately. `invalidateQueries` only marks
  the entry stale; React Query keeps serving the CACHED value until the
  refetch lands. `ForcePasswordChangeGuard` reads that same key and redirects
  on a truthy value, so it read the stale `true` and bounced the user back to
  `/ubah-password-wajib`. Re-logging in "fixed" it only because a fresh
  session refetched the flag as `false`.
- **Fix.** `queryClient.setQueryData(key, { mustChangePassword: false })`
  synchronously (the 204 already proves it), then await the invalidation,
  then navigate. Also replaced the blanket `onError` toast with
  `extractApiErrorMessage`, so "Current password is incorrect" is shown
  instead of one generic failure string.
- **Proof (Playwright, fresh dependant each run).** Before: after submit the
  URL was still `/ubah-password-wajib` (204 logged, then 403s). After: submit
  → `/akses-saya`, still signed in, no re-login. Gates: tsc clean, eslint
  clean, web 442/444 (2 pre-existing login failures).
- **Transfer "error tapi berhasil" — NOT reproduced.** Plain transfer through
  the dialog returned 201 with the success toast; transfer via API and
  transfer + adminFee both 201. The `held` path that shows a warning toast is
  `type === "expense"` only, so it cannot fire on a transfer. Needs the exact
  error text / steps from the reporter before guessing further.

## Automation Log — invisible body text on /iam and /akses-saya

- **Symptom.** Descriptive text under each role card and section heading was
  unreadable in BOTH light and dark mode.
- **Root cause.** Seven elements used `className="text-muted"`. `--muted` is a
  _surface_ token (`#eef3f1`-ish light, `#171f28`-ish dark) — the card
  background itself — so the text rendered in the background colour and
  effectively vanished. The readable token is `--muted-foreground`
  (`#607279` / `#a7b2bc`), i.e. the class should have been
  `text-muted-foreground`. `text-muted` is not defined as a CSS class
  anywhere; it resolved purely through Tailwind's colour-token mapping,
  which is why it silently produced valid-but-invisible output instead of
  erroring.
- **Scope.** Exactly 7 occurrences, confined to `iam/page.tsx` (5) and
  `akses-saya/page.tsx` (2) — the two pages reported. Repo-wide sweep
  confirms no bare `text-muted` remains; the rest of the app already uses
  `text-muted-foreground` (649 uses) or the design-system `.t-muted` (61),
  both of which resolve to `--muted-foreground`.
- **Proof.** Measured on the live page with the real theme class toggled
  (not `colorScheme` emulation, which this app ignores — it themes via a
  `dark` class): light = **4.98:1**, passing WCAG AA for body text; dark =
  light grey on a near-black card, passing comfortably. Confirmed visually
  in both themes. Gates: tsc clean, eslint clean, web 442/444 (2 pre-existing
  login failures).

## Automation Log — mobile transaction list sign + missing add-transaction FAB

- **Sign bug.** `/transaksi` renders two separate components: `TxTableRow`
  (desktop table) and `TxRow` (mobile cards, `sm:hidden`). `TxTableRow`
  already treated a transfer as neither gain nor loss — no sign, neutral
  colour — but `TxRow` computed `(isIncome ? "+" : "-")`, so EVERY non-income
  row got a minus. The same transfer therefore read "Rp 500.000" on desktop
  and "-Rp 500.000" on a phone. Ported the desktop logic (sign AND colour)
  into `TxRow`.
  Proof: mobile and desktop now emit an identical amount list —
  `Rp 100.000 · Rp 50.000 · -Rp 2.500 · Rp 20.000 · Rp 25.000` — transfers
  unsigned on both, the expense still negative on both.
- **Missing FAB.** `design-system.css` set `.mobile-fab { display: none }` in
  BOTH the base rule and the ≤768px media query, so the round
  "Tambah transaksi" button never rendered — and the topbar's button is
  desktop-only, leaving a phone with no way to add a transaction at all.
  Restored the prototype's rule verbatim (`docs/prototype/assets/app.css`):
  52px circle, `left: 50%` + `translateX(-50%)`, `bottom: 34px +
env(safe-area-inset-bottom)`, `z-index: 55` (above the bar's 50).
  Verified live: `display: grid`, 52×52, bottom 34, z 55, horizontally
  centred.
- **Knock-on fix.** The FAB is centred at `left: 50%`, which is a GAP between
  items only when the bar holds an even number of them. The row-scoped bar
  added earlier had three, so the FAB would have covered the middle item
  ("Transaksi"). Added `notifikasi` — already in that role's sidebar
  allowlist, so no new grant — making it four, matching the trusted bar.
  `nav-roles.test.ts` now asserts the count stays even and explains why.
- **Gates.** tsc clean, eslint clean, web 442/444 (2 pre-existing login
  failures verified on a clean tree).

## Automation Log — /akses-saya showed the wrong role (and other fiction)

- **Reported.** A child (`dependant`) saw "Role: Staff Operasional".
- **Cause.** The badge was a hardcoded literal and the page made NO role
  lookup at all — every viewer was told they were operational staff.
  Now reads `useMyRole()` + `t.common.roleLabels`.
- **Same page, worse claim.** The "Laporan" card promised "Ringkasan
  pribadi". Verified live: `GET /reports/summary` answers **403** for both
  row-scoped roles. A permissions screen promising access the API refuses is
  the one thing it must never do; the card now says "Dikunci" and points to
  /transaksi for the user's own rows. "Rekening Ditugaskan" was likewise
  always "Kas Operasional" — it now lists the real accounts from
  `GET /accounts` (row-scoped already, so that list IS the assignment) and
  says "Belum ada" when empty, which is the truth for a fresh dependant.
  Dropped the three invented progress percentages (76/0/42) — they measured
  nothing.
- **Correction to an earlier entry in this log.** A previous note claimed
  `assertHouseholdWideReadAllowed` "hard-denies /dashboard (beranda)". It
  does not: it guards the dashboard's net-worth-trend route only.
  `/dashboard/summary` answers **200** for a dependant — but every figure is
  zero, since it is row-scoped and these roles own nothing household-wide.
  Hiding beranda remains right (a wall of "Rp 0" reads as "this family has no
  money", not "you cannot see this"), but the justification in `nav.ts` has
  been corrected to say so accurately.
- **Role naming unified.** The IAM page showed "Anak"/"Staff Operasional" on
  its role CARDS but "Tanggungan"/"Staf Operasional" in the members TABLE
  beside them — same role, two names — and "Master" vs "Pemilik" for the
  owner. `t.common.roleLabels` now follows the prototype's product language
  (docs/prototype/pages/iam.html: Master · Co-Master · Anak · Staff), which
  also fixes /akun. Verified: all 3 table labels now match a card label.
- **Gates.** tsc clean, eslint clean, web 442/444 (2 pre-existing login
  failures).

## Automation Log — /laporan "Ringkasan COA" did not match the prototype

Compared the app against `docs/prototype/pages/laporan.html` (panel `rcoa`)
by rendering BOTH in Playwright and diffing structure, not by eyeballing.

What the app was missing / doing differently:

|               | Before                                    | Prototype                                             | Now           |
| ------------- | ----------------------------------------- | ----------------------------------------------------- | ------------- |
| Layout        | bare heading + 2 loose SectionCards       | 2 `.card`s with headers                               | 2 `.card`s ✅ |
| Card 1 title  | —                                         | "Ringkasan COA per Hari" + purple "Baru" badge        | ✅            |
| Filters       | bespoke Tailwind inputs, outside any card | `.field`/`.label`/`.select` inside card 1             | ✅            |
| Yearly total  | separate card, "Total Tahunan"            | right-aligned "Total setahun" + value + "N transaksi" | ✅            |
| Hint line     | absent                                    | "Kolom = bulan, baris = tanggal…"                     | ✅            |
| Card 2 title  | absent                                    | `{code} · {name} — {year}`                            | ✅            |
| Scroll hint   | absent                                    | "Geser ke kanan untuk bulan berikutnya →"             | ✅            |
| "Perbesar"    | absent                                    | fullscreen button                                     | ✅            |
| Cell contents | one summed figure + "(3x)" suffix         | one `.coa-amt` line PER transaction, stacked          | ✅            |
| Table CSS     | ad-hoc Tailwind                           | `.coa-matrix` / `.coa-date` / `.coa-cell`             | ✅ ported     |

- The prototype keeps this CSS page-local ("exists on exactly one screen").
  It went into `design-system.css` here because this app has no page-local
  `<style>` route, and the sticky-header + sticky-first-column + corner-cell
  z-index ladder is far more legible as real CSS than as stacked Tailwind
  arbitrary variants. Values copied verbatim.
- The matrix table is built once and reused inside the fullscreen dialog, so
  the normal and expanded views cannot drift apart.
- **Verified structurally, both rendered live:** header columns 13 = 13, body
  rows 31 = 31, `.coa-table-wrap` max-height 620px = 620px, thead `position:
sticky`, date column `position: sticky`, hint present, expand button
  present, card titles the same shape. The only differing number is filled
  cells (6 vs the prototype demo's 157) — that is data volume, not structure.
- **Pre-existing, left alone but noted:** when the server's COA matrix is
  empty the section falls back to `buildDemoCoaMatrix` — fabricated amounts
  in a financial report. It IS disclosed on screen ("Data contoh
  ditampilkan…", now a `notice--warning`), so it is not a silent fake, but it
  should probably become a real empty state.
- **Gates.** tsc clean, eslint clean, web 442/444 (2 pre-existing login
  failures).

## Automation Log — /laporan "Filter Laporan" did not match the prototype

Diffed the app against `docs/prototype/pages/laporan.html` by rendering both.

|                    | Before                              | Prototype                                           | Now      |
| ------------------ | ----------------------------------- | --------------------------------------------------- | -------- |
| Container          | bespoke Tailwind box                | `section.card.report-filter-card` + `.card__header` | ✅       |
| Controls           | **4** (preset + year + month + day) | **2** (preset + date-range)                         | ✅ 2     |
| Rentang Tanggal    | 3 selects, only when "Custom"       | always-visible date-range PICKER                    | ✅       |
| Preset default     | `custom` ("Bulan/Tahun Tertentu")   | `bulan-ini` ("Bulan Ini")                           | ✅       |
| Grid               | `grid-cols-[220px_1fr]`             | `.bento-filter`                                     | ✅       |
| Cash-basis callout | bespoke Tailwind                    | `.notice.notice--info`                              | ✅       |
| "Periode aktif"    | a preset NAME ("Agustus 2026")      | a date RANGE ("1 – 31 Agustus 2026")                | ✅ range |

- **Reused, not rebuilt.** `/transaksi` already had a working React port of the
  prototype's `WM.mountDateRange` (same `.date-range__trigger` / `.dr-day` /
  `.dr-foot` class contract the CSS in `design-system.css` was already
  carrying, unused by /laporan). Extracted it to
  `components/wm/date-range-field.tsx` and pointed BOTH pages at it — copying
  a second hand-maintained calendar would have guaranteed drift. Also swapped
  its `‹`/`›` text glyphs for the lucide chevrons the prototype uses.
- **Custom now resolves to a real range.** Applying the picker sets
  `rangePreset = "custom"` and feeds `resolvePreset`'s existing WIB-pinned
  `custom` branch, so `presetRange` is non-null for every preset and the trend
  anchors follow one code path instead of a null-fallback.
- **Bug I introduced and caught in review.** Displaying the bounds via
  `iso.slice(0, 10)` showed "31 Juli – 31 Agustus": these bounds are WIB-pinned,
  and 1 Aug 00:00 WIB is 31 Jul 17:00 **UTC**, so slicing reports the previous
  day. Exported `wibDateOf()` from `laporan-period.ts` (built on the private
  `wibCalendarParts` already there) so the +7h shift stays in one file, and
  used it for both bounds.
- **Deliberate deviation, NOT matched to the prototype.** The prototype
  hardcodes "1 – 31 Agustus 2026" for "Bulan Ini"; the app shows
  "1 – 17 Agustus 2026". `resolvePreset`'s to-date presets end at _today_ on
  purpose, and the label is derived from the bounds actually queried. Copying
  the prototype's full-month string would make the disclosure claim a range
  that includes future days the report cannot contain. Kept honest.
- **Also kept, though absent from the prototype:** the WIB timezone note
  (EPIC-022 B7) and the "period not applicable" warning on rfamily/rinv.
- **Gates.** tsc clean, eslint clean, web 442/444 (2 pre-existing login
  failures).

## Automation Log — three reported oddities on /iam and /warisan

**1. "Anak 50/50 padahal anak cuma satu" — not a calculation bug.**
`InheritanceHeir` is its own entity (free-text `name`/`relationship`/
`sharePercent` + an OPTIONAL `memberUserId`); it is never derived from the
Member roster. "Anak Pertama"/"Anak Kedua" at 50% each were hardcoded rows in
`prisma/seed.ts`, `memberUserId` unset — seed fiction that contradicted a
family whose roster contained no children at all.
_Fixed:_ one heir at 100%, `memberUserId` linked to a real member. Keeping
heirs separable from members stays correct (a legal beneficiary may hold no
app account), which is why the column remains optional.

**2. Seed had exactly ONE member (the owner).** Every role-scoped surface —
the reduced sidebar, /akses-saya, the IAM roster — had nothing to show, and
testing a child meant hand-creating one through the API each time. Seeded a
real `dependant`: **ana_demo / demo1234** (username login, no email — same
synthetic `members.internal.wealthme.invalid` address the production
`POST /members/dependant` path uses; fixed rather than `randomUUID()`'d so
re-seeding is idempotent). Verified: the account signs in, and
`/inheritance` now returns `Ana Demo · anak · 100%` with the member id.

**3. "Permintaan Akses (2 pending)" — the feature does not exist.**
Traced to the schema: no `AccessRequest`/`PermissionRequest` model, no
endpoint, and `AllowanceRequestKind` is only `funding | held_expense` (money,
not access). The panel was two hardcoded strings, so nothing could be
requested, approved, or rejected — and it showed a permanent "2 pending"
badge on a security screen.
_Removed_ (user's call, over building it now). A comment in `iam/page.tsx`
records what a real implementation needs: model + migration + endpoints +
CASL grant + a request UI on /akses-saya + the approve/reject UI here.

**Gates.** tsc web+api clean, eslint clean, api 1143/1143, web 442/444 (2
pre-existing login failures). Verified live: IAM no longer renders the fake
panel; /warisan shows the single 100% heir.

## Automation Log — "Gagal menyimpan: Unauthorized" on transfer

- **Immediate cause was mine.** `prisma/seed.ts` deletes every `baSession` row
  for the demo user (pre-existing, line 74 — "invalidate stale sessions so the
  next login embeds the correct familyGroupId"). I re-ran the seed in the
  previous turn while a browser tab was open, so that tab's session was gone
  and every authenticated call answered 401. Not a transfer bug — the same
  401 would have hit any save.
- **The real defect it exposed.** `lib/api-client.ts`'s header comment claimed
  the wrapper "retries once after a 401 by signing out". No 401 handling
  existed anywhere in the app — the comment was false. A revoked session
  therefore left the app _looking_ signed in (shell + cached data) while every
  write failed with a bare "Gagal menyimpan: Unauthorized" and no route out.
  This also explains the earlier, unreproducible "transfer error tapi
  berhasil": a stale session fails the write while the optimistic UI/cache
  still shows the row.
- **Fix.** `apiFetch` now ends the session and redirects to /login on any 401,
  once (a `sessionEndedHandled` latch stops N concurrent 401s from each firing
  a sign-out + navigation). Implemented at the single choke point every
  authenticated call already passes through.
- **Two traps hit and fixed while doing it:**
  1. A static `import { authClient } from "./auth-client"` broke Jest for
     every suite that transitively imports `apiFetch` — `better-auth/react` is
     ESM-only ("Cannot use import statement outside a module"). Went back to a
     dynamic `await import()` so it stays a browser-runtime-only dependency.
     Caught because the suite count went 1 → 2 failures.
  2. I first redirected to `/login?next=<path>`. `app/login/page.tsx` reads no
     such param, so it did nothing — removed rather than shipped as a
     decorative parameter.
- **Proof.** Playwright: sign in, then force the API to answer 401 for every
  call (exactly what a wiped `baSession` does) → the app lands on `/login`
  instead of sitting stuck in the shell.
- **Gates.** tsc clean, eslint clean, web 442/444 (the 2 pre-existing login
  failures, unchanged).
