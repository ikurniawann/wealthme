# EPIC-027: IAM integrity + Scan Struk

status: ready-for-qa
environment: dev
retries: 0

## Goal

Two things the IAM surface currently gets wrong, and one feature that exists
on the server but is faked on the client.

1. **/iam tells the truth about roles.** The role cards and permission matrix
   are hardcoded literals that contradict `casl-ability.factory.ts`. A
   Co-Master is created as `role: owner` (full `manage Member`), yet the
   matrix prints "Kelola IAM roles: Tidak" for that column.
2. **Removing a member actually removes their access.** `removeMember` deletes
   only the `Member` row; the `User` + `baAccount` credential survive, so a
   removed child still signs in by username. `getMe` then returns
   `familyGroupId: null`, and `isNavItemVisibleForRole(item, null)` treats an
   unknown role as _trusted_, so they see a near-full menu — the reported
   "user yang dihapus tetap bisa login dan menjadi master akun yang lain".
3. **Scan Struk works for real.** `POST /transactions/:familyGroupId/scan`,
   `OcrPort` and `ClaudeVisionOcrAdapter` already exist; the client button is
   two `setTimeout`s and a hardcoded receipt.

## Evidence

| Claim                                                                                                         | Where                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Role cards/matrix are literals, not derived from CASL                                                         | `apps/web/src/app/(app)/iam/page.tsx:31-84`                                                          |
| Co-Master is created as `role: owner` + `relationship: istri`                                                 | `apps/api/src/family-groups/family-groups.service.ts:479-503` (`createDependantMember`, EPIC-024 A1) |
| `owner` holds `manage Member`; `spouse` only `read Member`                                                    | `apps/api/src/casl/casl-ability.factory.ts:67,167`                                                   |
| Card counts fold `spouse`+`member`+`admin_staff` into "Co-Master"                                             | `iam/page.tsx:281-286`                                                                               |
| `removeMember` hard-deletes the `Member` row only                                                             | `family-groups.service.ts:250-284`                                                                   |
| Dependant users are username-only with a synthetic `@…invalid` email — they cannot exist outside their family | `family-groups.service.ts:565-577`                                                                   |
| Unknown role is treated as trusted in the sidebar                                                             | `apps/web/src/lib/nav.ts:183-191`                                                                    |
| `/akses-saya` is the row-scoped landing page and guard target — must survive                                  | `apps/web/src/components/auth/row-scoped-route-guard.tsx:41`                                         |
| Two hand-written add-member dialogs, one endpoint                                                             | `iam/page.tsx:546-640` vs `akun/page.tsx:2740-3000`                                                  |
| Scan endpoint + OCR port already exist                                                                        | `apps/api/src/transactions/transactions.controller.ts:99-112`, `apps/api/src/transactions/ocr/*`     |
| Client OCR is simulated                                                                                       | `apps/web/src/components/shell/transaction-dialog.tsx:136-148,393-398`                               |
| AI Advisor is strictly bring-your-own family key, **no env fallback**                                         | `apps/api/src/ai-advisor/ai-key.service.ts:106-113`, `ai-advisor.module.ts:14-17` (EPIC-023 D16)     |
| `MockOcrService` returns a **random** amount                                                                  | `apps/api/src/transactions/ocr/mock-ocr.service.ts:24-40`                                            |

## Decisions

| #   | Decision                                                                                                                                                                                                  | Rejected alternative                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| D1  | Co-Master stays `role: owner`; the **label** is what's wrong                                                                                                                                              | Re-mapping istri to `spouse` (would need a data migration)            |
| D2  | Cards/matrix show only creatable roles: Master (owner, incl. Co-Master), Anak, Staff                                                                                                                      | All six DB roles as columns (7-col table, exposes uncreatable roles)  |
| D3  | Member management lives **only** on /iam; Profile's family section becomes read-only                                                                                                                      | Shared dialog used in both places                                     |
| D4  | Members are **soft-deleted** (`Member.deletedAt`), enforced by a Prisma `$extends` global query filter                                                                                                    | Hard-delete of the `User`; manual `deletedAt: null` at ~43 call sites |
| D5  | "Anggota Nonaktif" section on /iam with **Restore**                                                                                                                                                       | No UI (would make re-adding a username impossible)                    |
| D6  | Family-less users blocked at login/`/auth/me`; `role: null` treated as **restricted** in nav                                                                                                              | Frontend-only fix (orphan keeps a valid session)                      |
| D7  | Removal revokes the Redis refresh key and better-auth sessions                                                                                                                                            | Let the access token expire                                           |
| D8  | Camera via **`getUserMedia`** live preview                                                                                                                                                                | Native `<input capture>` (chosen against, deliberately)               |
| D9  | OCR result → review screen → prefill → user confirms → save                                                                                                                                               | Auto-save from OCR                                                    |
| D10 | Captured JPEG auto-attached to the created transaction                                                                                                                                                    | Discard the image                                                     |
| D11 | **OCR uses the family AI Advisor key only** (`AiKeyService.resolveDecryptedKey`), per-request adapter like `AiAdvisorFactory`. No `ANTHROPIC_API_KEY` fallback; `MockOcrService` demoted to a test double | Env key fallback (re-introduces the shared-billing mode D16 removed)  |
| D12 | Vision adapters for **all three** providers (Claude / OpenAI / Gemini) behind an `OcrFactory`                                                                                                             | Claude-only with a "provider tidak didukung" message                  |
| D13 | `categoryHint` matched to a real family Category server-side; no match → blank                                                                                                                            | A second AI call via `CategorizationPort`                             |
| D14 | Anyone with `create Transaction` may scan (incl. anak/staff); the existing 10/min throttle is the guard                                                                                                   | Trusted roles only                                                    |

## Tasks

Seven PR-sized task groups, dependency-ordered. Group letters below map back
to the A/B numbering used in the Decisions table.

### 1 — IAM role truth: matrix, cards, dead buttons ✅

- [x] A1 — Matrix row "Kelola IAM roles" → Ya for Co-Master; card copy corrected
- [x] A2 — Cards + matrix reduced to Master / Anak / Staff; stop counting `member`/`admin_staff` as Co-Master
- [x] A3 — Remove the "Preview Anak / Staff" button (leave `/akses-saya` and its guard untouched)
- [x] A4 — Remove the "Assign Akses" button (hero add + per-row "Ubah Role" cover it)
- [x] A6 — "Cakupan akses terbatas" gauge computed as row-scoped members ÷ total members

### 2 — Member management consolidated on /iam ✅

- [x] A5 — Move the complete add-member dialog (incl. Istri/Co-Master, show-password, relationship lock) to /iam; Profile family section → read-only + link to /iam

### 3 — Member soft-delete + global query filter ✅

- [x] A7 — `Member.deletedAt` + migration; Prisma `$extends` global filter excluding soft-deleted members from every read

### 4 — Access revocation on removal ✅

- [x] A9 — Revoke Redis refresh key + better-auth sessions on removal
- [x] A10 — Block family-less users at login/`/auth/me`; `isNavItemVisibleForRole(item, null)` → restricted

### 5 — Anggota Nonaktif + restore ✅

- [x] A8 — "Anggota Nonaktif" section on /iam + restore endpoint (depends on group 3)

### 6 — OCR provider factory on the family AI key ✅

- [x] B5 — OCR key resolution via `AiKeyService`; `scanAvailable` flag; drop the env binding and the runtime mock
- [x] B6 — `OcrFactory` + vision adapters for Claude, OpenAI and Gemini
- [x] B7 — `categoryHint` → real Category id server-side; blank when no match
- [x] B8 — Scan-path equivalents of `AiKeyCorruptedError` / `AiAdvisorNotConfiguredError`

### 7 — Camera capture, review prefill, attachment ✅

- [x] B1 — `getUserMedia` live camera preview in the transaction dialog (HTTPS required on a real device; `localhost` is a secure context)
- [x] B2 — Capture → downscale to fit the 2 MB base64 cap → `POST /transactions/:familyGroupId/scan` (the param stops being ignored)
- [x] B3 — Real OCR result on the review screen → "Gunakan" prefills the form → user confirms → Simpan
- [x] B4 — Captured JPEG auto-attached via the existing post-create attachment flow

### 8 — Upload a receipt file for OCR (not only the camera) ✅

- [x] B9 — "Unggah Struk" alongside the camera in the scan view: pick an image
      file, decode it, reuse `encodeWithinCap` to fit the 2 MB base64 cap, and
      post it to the same scan endpoint
- [x] B10 — Uploaded file flows through the SAME review → "Gunakan" → prefill →
      user-confirms path as a capture (D9); the picked file is auto-attached to
      the created transaction (D10)
- [x] B11 — Desktop/no-camera reachability: the scan surface is usable when
      `getUserMedia` is unavailable, instead of dead-ending on a camera error

## Acceptance Criteria

- The permission matrix agrees with `casl-ability.factory.ts` for every role it displays.
- A member removed from /iam can no longer sign in; their existing session stops working immediately.
- A removed member appears under "Anggota Nonaktif" and can be restored to a working login.
- A user with zero active memberships cannot obtain a session, and never sees a trusted menu.
- Add-member exists on /iam only; Profile links to it.
- Scanning a real receipt with a configured family AI key fills amount, date and description, and never invents a value when no key is configured.
- The scanned image is attached to the created transaction.

## Test Plan

- Unit: soft-delete filter (members excluded everywhere), restore, family-less login refusal, `isNavItemVisibleForRole(null)`, matrix values vs CASL, `OcrFactory` provider selection, `categoryHint` matching.
- Integration: `DELETE member` → login refused + sessions revoked; restore → login works.
- Manual: scan a real receipt on a device over HTTPS.
- Gates: `scripts/qa.sh`, `scripts/test.sh`, `scripts/security-check.sh`.

## Agent Routing

`ecc:react-reviewer` · `ecc:typescript-reviewer` · `ecc:security-reviewer` (A7/A9/A10, B5) · `ecc:database-reviewer` (A7 migration) · `review-qa-agent` · `test-agent`.

## Done Signal

Both groups merged to `development` with gates green; this file's Automation Log records the outcome per group.

## Automation Log

- 2026-08-24 /nerve EPIC-027 #8 "Upload a receipt file for OCR (not only the
  camera)" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/307. Requested directly by the user
  alongside the attachment bug: a button to upload a receipt file so OCR reads
  it and fills the amount.
  Camera-only scanning was unreachable on desktop and useless for a photo
  already in the gallery. `receipt-file.ts` adds the upload pipeline;
  everything after the decode is literally the camera's code — same
  `encodeWithinCap`, same `postScanReceipt`, same review screen, same
  `useScanResult` prefill, same `attachmentFile` → upload. One path, so the
  202 held-expense handling cannot diverge (asserted by a test driven through
  the upload trigger, not the camera).
  The attachment stores the **re-encoded JPEG**, not the picked file: it is
  exactly the bytes OCR read, so a later dispute is checked against the image
  the model saw, and it is already under the 2 MB cap where a raw 8 MP original
  could exceed the 5 MB attachment limit. HEIC/AVIF fall out of the same
  conversion instead of needing a branch.
  HEIC is deliberately NOT blocked up front — Safari decodes it, and refusing
  it there would break the one platform where it works. It is allowed through
  and only a _subsequent_ decode failure is reported as HEIC-specific; a
  corrupt JPEG with the identical rejection gets its own message.
  Three review rounds, every finding real. CRITICAL-adjacent HIGH: no
  cancellation guard on the upload→scan chain, so abandoning a slow 8 MP decode
  and reopening the dialog landed the user on a stale review screen for a scan
  they cancelled. Fixed with a generation counter bumped inside `resetScan()` —
  the one funnel every abandonment path already uses, so no call site has to
  remember. HIGH: `receiptFileErrorMessage` used a `default` catch-all, so a
  10th failure reason would silently show the wrong message; now `never`-checked
  (proved by adding a literal and watching TS2322). MEDIUM from the security
  gate: the 20 MB ceiling bounds FILE size, not PIXEL dimensions, and the code's
  own comment claimed otherwise — a ~300 KB PNG declaring 30000×30000 asks for
  ~3.6 GB. Now a 40 MP budget checked from the `<img>` intrinsic size before any
  rasterisation, `createImageBitmap` given aspect-preserving `resizeWidth`/
  `resizeHeight` so the full surface is never materialised, plus a pipeline
  backstop. `bitmapResizeOptions` bounds the LONGEST edge — the obvious reading
  (`resizeWidth` alone) would have left a 1000×100000 bomb at 256 MP.
  **Two tests were caught passing for the wrong reason and rewritten**, which is
  the part worth remembering: the `onError` cancellation test passed without its
  guard until it was rebuilt around the genuinely observable case (back out,
  REOPEN, then let the old request fail — painting the previous scan's error on
  a fresh screen); and a group-7 test had left a `mockImplementation` in place
  that `jest.clearAllMocks()` does not reset, so later tests silently saw a held
  response. Reviewers traced the file order and confirmed no group-7 assertion
  was actually vacuous, but the leak would have broken group 8's tests.
  Residual, recorded honestly: reading `naturalWidth` without rasterising holds
  on Chromium/Firefox/WebKit (dimensions sit in container headers) but is
  implementation-defined, not guaranteed, and jsdom cannot test it. Worst case
  on a divergent engine is the documented ~160 MB ceiling, not unbounded. A
  browser smoke test would close it.
  Gates: qa.sh 0, test.sh 0, API 107 suites / 1278 tests, web 51 suites / 569
  tests (567 passed, 2 skipped — was 505 at the group-7 baseline), suite green
  under `TZ=UTC` forced externally, `receipt-file.test.ts` green in isolation
  (44) as well as in the full run.
  **Needs manual device verification:** a real iPhone HEIC on iOS Safari (should
  decode) vs desktop Chrome/Firefox (should show the HEIC message); a real
  ~4032×3024 upload landing under 2 MB and still legible on each of
  claude/openai/gemini; a PNG screenshot end to end; and the
  desktop-without-webcam path in a real browser.

- 2026-08-24 /task-work EPIC-027 #7 "Camera capture, review prefill, attachment"
  → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/304,
  re-landed on `development` via
  https://github.com/andrsrjld/wealthme-web/pull/305. Stacked on the group 6
  branch, since it consumes that endpoint contract.
  **Stacking hazard, recorded so it is not repeated.** #303 and #304 were
  merged 13 seconds apart. GitHub retargets a stacked PR's base only when that
  base branch is DELETED, so #304 merged into `feat/epic-027-task-6-…` rather
  than `development` — both PRs reported MERGED with green checks while
  `development` held the backend alone (`git ls-tree origin/development
apps/web/src/hooks/` returned no `receipt-*` files). Deploying at that point
  would have shipped a real OCR backend behind a still-simulated button. Fixed
  by #305, whose only conflict was this Automation Log — #303 squash-merged, so
  the group 6 content is on `development` without its commits, and the residual
  code diff was group 7 alone. Merge stacked PRs one at a time and confirm the
  child's base flipped to `development` before merging it.
  **The button was lying twice.** `startOcr` was two `setTimeout`s (2200 ms,
  3400 ms) over a hardcoded Indomaret receipt with no network call at all —
  and `saveOcr` closed the dialog with a success toast **without creating any
  transaction**, so a user was told their money record was saved when nothing
  was written. Both are deleted, along with `OCR_ITEMS`, the timers, and the
  "OCR nyata menyusul" copy. Also removed: a ⚡Auto flash button that only
  toasted "Flash: Auto" and did nothing.
  Real flow now: `getUserMedia` rear-camera preview (D8) → canvas capture →
  `encodeWithinCap` steps dimensions and JPEG quality over a bounded 20
  iterations until the base64 fits the server's 2 MB cap, measured on the
  actual encoded string rather than estimated → `POST /transactions/:id/scan`
  → review screen → "Gunakan" prefills the form → the user confirms through
  the ordinary create mutation (D9). Nothing is written before that; a test
  asserts no POST fires from the review screen. The captured JPEG rides the
  existing `attachmentFile` state into the existing post-create upload (D10),
  not a second mechanism. Camera/downscale/scan logic lives in three new
  `hooks/*` modules; the protected dialog only mounts and orchestrates.
  Two reviewers independently found the same CRITICAL: `start()` had no
  cancellation guard across `await getUserMedia`, so cancelling during the
  permission prompt let the stream arrive afterwards, get adopted, and never
  be stopped — the device camera light stays on after the user turned it off.
  Fixed with a generation counter checked after the await on both the resolve
  and reject paths. The implementer proved the fix by deleting both guards and
  confirming the two new tests fail, then restoring. Two HIGHs also fixed: the
  camera effect had no cleanup function (correctness depended on every call
  site remembering to call `stopCamera` — now React guarantees it), and no
  focus management across view swaps left keyboard/AT users on `<body>`.
  Sharpest catch was a MEDIUM on the TEST, not the code: the new UTC-date
  regression test was itself timezone-coupled, so under `TZ=UTC` — the default
  on most CI runners — local and UTC getters are identical and the test passed
  against the reintroduced bug. `jest.config.ts` now pins `TZ=Asia/Jakarta`
  before the workers fork. Verified by mutation: with the old local-getter
  implementation restored and `TZ=UTC` forced externally, the boundary test
  now fails where it used to pass silently.
  Deliberate deviation: the scan request does not use `apiFetch`. Protected
  `lib/api-client.ts` keeps only `{status, message}` and drops `code`/`scope`/
  `retryAfterSeconds`, which is exactly what distinguishes seven OCR failures —
  three of which share HTTP 502. `postScanReceipt` mirrors it locally
  (`uploadAttachment` precedent in the same file). Accepted cost: a scan-time
  401 shows the server message instead of the sign-out redirect; the next
  `apiFetch` call still redirects.
  Gates: qa.sh exit 0, test.sh exit 0, API 107 suites / 1278 tests, web 50
  suites / 505 tests (503 passed, 2 skipped, was 48/455), tsc + eslint +
  prettier + web build clean. Security gate PASS; script still red only on the
  pre-existing `deepmerge-ts` advisories, no dependency changed.
  **Needs manual on-device verification** (cannot run in CI): real camera over
  HTTPS incl. the indicator light going off after Gunakan/Batal/close; a real
  ~4032×3024 frame landing under 2 MB and still legible; an end-to-end scan of
  a real Indonesian receipt on each of claude/openai/gemini; the plain-HTTP
  insecure-context message; and iOS Safari inline autoplay + permission flow.

- 2026-08-24 /task-work EPIC-027 #6 "OCR provider factory on the family AI key"
  → PASS (attempts: 1), PR: https://github.com/andrsrjld/wealthme-web/pull/303.
  **The scan path was answering with `Math.random()`.** `TransactionsModule`
  bound `OCR_PORT` from `ANTHROPIC_API_KEY` and fell back to
  `MockOcrService` when unset — the exact mock-answer-as-truth mode D16
  removed from the advisor, still live on a path that writes a money field.
  `MockOcrService` is deleted, `OCR_PORT` is gone, and `scanReceipt` now
  takes the route `familyGroupId` (previously `_familyGroupId`, ignored) and
  resolves a per-request adapter from the family's own encrypted key via
  `AiKeyService.resolveDecryptedKey` — `AiAdvisorModule` exports the service,
  no cycle, one instance. `OcrFactory` covers claude/openai/gemini with one
  shared prompt (`ocr-prompt.util.ts`) and one shared zod schema so the three
  providers cannot drift. `scanAvailable` on the AI-key status is derived
  from "key configured AND provider has a vision adapter", not "a key row
  exists". B7 matches `categoryHint` against real `Category` rows scoped to
  `{ familyGroupId, kind: "expense" }`, exact-match first with a substring
  fallback gated at 5 chars so "Lain" cannot swallow everything; no match →
  null, never auto-created. B8 maps six typed errors to distinct codes
  (`OCR_NOT_CONFIGURED` 412, `AI_KEY_CORRUPTED` 409, `OCR_AUTH` 502,
  `OCR_RATE_LIMITED` 429, `OCR_TIMEOUT` 504, `OCR_PARSE_FAILED` 502,
  generic `OCR_UPSTREAM_FAILED` 502) with the provider body logged
  server-side only.
  Security gate confirmed the boundary rather than assuming it: `TenantGuard`
  is a global `APP_GUARD` running BEFORE `AbilitiesGuard` and resolves
  membership by `userId_familyGroupId`, so passing another family's id to
  `POST /transactions/:familyGroupId/scan` fails closed and cannot spend
  their key — `@CheckAbility` is the second layer, not the only one. The
  decrypted key reaches only the SDK constructor, `Authorization: Bearer`,
  and Gemini's `x-goog-api-key` HEADER (not a query string, which would land
  in upstream access logs); both new adapter specs seed the mocked upstream
  failure with the key itself and assert it never appears in a thrown
  message. Review gate raised one HIGH — "scanReceipt has zero coverage" —
  which was FALSE: the reviewer read only `transactions.service.spec.ts` and
  missed `transactions-scan-receipt.spec.ts`. Dismissed, no duplicate tests
  added. Two MEDIUMs were real and fixed: Claude/Gemini adapters had no
  specs, and `ScanReceiptDto.imageBase64` accepted an empty string straight
  through to a paid upstream (now `@MinLength(32)` + a base64-shape
  `@Matches`, which also rejects a still-attached `data:image/jpeg;base64,`
  prefix — group 7 must post the raw payload with the prefix stripped).
  Gates: qa.sh exit 0, test.sh exit 0, API 107 suites / 1278 tests, web
  untouched (455 total — the epic's earlier 451 baseline had drifted on
  `development`, not from this diff), tsc + eslint + nest build clean.
  Security script still red only on the pre-existing `deepmerge-ts`
  advisories via `@prisma/config`/better-auth; `git diff` on package.json +
  lockfile is empty, so no dependency changed here.
  **Left for group 7:** the web is entirely untouched — `transaction-dialog`
  still runs its two `setTimeout`s and a hardcoded receipt, and
  `use-ai-key.ts` does not yet read `scanAvailable` (additive field, nothing
  broken).

- 2026-08-18 /epic-loop EPIC-027 #3–#5 → PASS, PR #299.
  **The security gate earned its keep.** Group 3's whole design rested on a
  Prisma `$extends` filter catching every Member read; `ecc:security-reviewer`
  returned FAIL with a CRITICAL: extension query hooks intercept only
  TOP-LEVEL operations, so a `memberships` relation loaded through
  include/select is resolved inside the parent request and never reaches the
  member hook. `getMe` would have kept returning a removed member's old
  familyGroupId and role — the exact reported bug. Four nested reads now
  filter explicitly: auth.service.ts PROFILE_DETAIL_SELECT and getMe, both
  family-groups `_count` aggregates, and `apps/web/src/lib/auth.ts`
  session.create.before (a SEPARATE better-auth Prisma client the API's
  extension can never reach — reviewed foundation exception to a protected
  lib/\* path). Also fixed: the `"deletedAt" in where` opt-out was a footgun
  (`{deletedAt: undefined}` satisfies `in`, Prisma then drops the key, leaving
  NO filter) → now `!== undefined`. Re-review PASS, no bypass remaining.
  Group 4 adds session revocation on removal (Redis refresh key +
  better-auth rows, best-effort so a revocation failure cannot fail a
  completed removal), a login refusal for users with zero active memberships,
  and flips the nav gate so a resolved `null` role is the MOST restricted
  state instead of the most permissive. `useMyRole` now returns `undefined`
  while loading so the stricter gate never flashes a stripped menu at an
  owner. Group 5 adds the Anggota Nonaktif panel + restore.
  Gates: API 1217/1217, web 451/451, tsc clean both apps, eslint clean.
  Security script still red on pre-existing `deepmerge-ts` advisories
  (transitive via prisma/better-auth); no dependency changed in these diffs.
- 2026-08-18 /epic-loop EPIC-027 #2 "Member management consolidated on /iam"
  → PASS (attempts: 1), PR: https://github.com/andrsrjld/wealthme-web/pull/299
  (same branch as #1 — group 2 edits the same files, so a separate branch
  would only have stacked conflicts). The complete dialog moved from
  akun/page.tsx to iam/\_components/add-member-dialog.tsx; /iam's lesser copy
  (no Istri/Co-Master option, no show-password, no relationship lock) is
  gone, and the profile page links to /iam instead. Review gate:
  `ecc:react-reviewer` PASS with 1 MEDIUM (dead `addDependantButton` i18n
  key) + 2 LOW (stale comments, indentation), all fixed before commit. tsc
  clean, eslint clean, tests 451/451. Side effect: akun/page.tsx drops ~300
  lines, which helps EPIC-028 group D.
- 2026-08-18 /epic-loop EPIC-027 #1 "IAM role truth: matrix, cards, dead
  buttons" → PASS (attempts: 1). Review gate: `ecc:react-reviewer` PASS with
  one MEDIUM (the "Export laporan" row is enforced by
  `assertHouseholdWideReadAllowed` in reports.controller.ts, not by CASL —
  the factory declares a `Report` subject it grants to nobody) and one LOW
  (dead per-role `members` literals); both fixed before commit. QA gate PASS,
  tests 442/442, tsc clean. Security gate reports pre-existing transitive
  advisories (`deepmerge-ts` via prisma/better-auth) unrelated to this diff,
  which adds no dependencies — recorded, not treated as this task's failure.
- 2026-08-18 — Epic created from a `/grilling` session. Fourteen decisions
  recorded above (D1–D14) with the user; D11 supersedes an earlier
  "family key first, env fallback" answer after the AI Advisor module was
  found to have deliberately removed env-based key binding (EPIC-023 D16).
- 2026-09-02 — Documentary QA audit (code vs. this log, no live DEV access
  from this sandbox). All 8 task groups verified `MERGED` (PRs #299, #300,
  #303, #304, #305, #307) and spot-checked against real source — 5 checks
  (OCR factory, camera capture, nav null-role gate, member soft-delete
  columns/migration, receipt-file upload hook) all confirmed, no
  contradictions between this log's claims and the code. Group 8's heading
  was missing its ✅ despite every sub-item being done — corrected. All 14
  decisions (D1–D14) map to task groups that are done and merged; none are
  still open as decisions. **Status moved `on-progress` → `ready-for-qa`**:
  every task group's gates passed and merged. What remains is the manual
  device/browser verification this log's own group 6/7/8 entries already
  flag as never executed — real iPhone HEIC in Safari, a real ~4000×3000
  photo staying under 2 MB and legible on each of Claude/OpenAI/Gemini, a
  PNG screenshot end to end, desktop-without-webcam, and the camera
  indicator-light-off behaviour on-device — exactly the human QA layer this
  status exists for.
