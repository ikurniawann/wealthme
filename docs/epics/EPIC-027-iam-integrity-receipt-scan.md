# EPIC-027: IAM integrity + Scan Struk

status: on-progress
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

### 2 — Member management consolidated on /iam

- [ ] A5 — Move the complete add-member dialog (incl. Istri/Co-Master, show-password, relationship lock) to /iam; Profile family section → read-only + link to /iam

### 3 — Member soft-delete + global query filter

- [ ] A7 — `Member.deletedAt` + migration; Prisma `$extends` global filter excluding soft-deleted members from every read

### 4 — Access revocation on removal

- [ ] A9 — Revoke Redis refresh key + better-auth sessions on removal
- [ ] A10 — Block family-less users at login/`/auth/me`; `isNavItemVisibleForRole(item, null)` → restricted

### 5 — Anggota Nonaktif + restore

- [ ] A8 — "Anggota Nonaktif" section on /iam + restore endpoint (depends on group 3)

### 6 — OCR provider factory on the family AI key

- [ ] B5 — OCR key resolution via `AiKeyService`; `scanAvailable` flag; drop the env binding and the runtime mock
- [ ] B6 — `OcrFactory` + vision adapters for Claude, OpenAI and Gemini
- [ ] B7 — `categoryHint` → real Category id server-side; blank when no match
- [ ] B8 — Scan-path equivalents of `AiKeyCorruptedError` / `AiAdvisorNotConfiguredError`

### 7 — Camera capture, review prefill, attachment

- [ ] B1 — `getUserMedia` live camera preview in the transaction dialog (HTTPS required on a real device; `localhost` is a secure context)
- [ ] B2 — Capture → downscale to fit the 2 MB base64 cap → `POST /transactions/:familyGroupId/scan` (the param stops being ignored)
- [ ] B3 — Real OCR result on the review screen → "Gunakan" prefills the form → user confirms → Simpan
- [ ] B4 — Captured JPEG auto-attached via the existing post-create attachment flow

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
