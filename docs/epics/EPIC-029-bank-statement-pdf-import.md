# EPIC-029: Bank statement PDF import via the family AI key

status: on-progress
environment: dev
retries: 0

## Goal

`/rekonsiliasi` accepts a bank-statement PDF and turns it into reviewable
`BankSyncEntry` rows, using the family's own AI key to read layouts the CSV/XLSX
parsers cannot. Today the file picker offers `.pdf` and the server refuses it.

**This reverses a deliberate prior decision, on purpose.** `uploadFile` throws
`PDF_UNSUPPORTED` and the UI says "PDF ditolak — ini disengaja … angka hasil
pembacaan sering meleset tanpa ketahuan". That reasoning was correct for a naive
parser and remains the governing risk: the failure mode is a _silently wrong
number on a money row_, not a crash. Every decision below is shaped by it.

## Evidence

| Claim                                                                     | Where                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Server refuses `.pdf` with `PDF_UNSUPPORTED`                              | `apps/api/src/reconciliation/reconciliation.service.ts:347-354`             |
| The file picker already offers `.pdf`, and a callout explains the refusal | `apps/web/src/app/(app)/rekonsiliasi/page.tsx:1491,1540`, `i18n/id.ts:3119` |
| CSV + XLSX only, both parsed server-side                                  | `reconciliation-parsers.ts`, `reconciliation.service.ts:340-360`            |
| Hardened, already-reviewed parsing exists for amounts and dates           | `parseStatementAmount`, `parseStatementDate`, `mapTableToRows`              |
| Per-bank column-mapping templates exist, with detection                   | `TemplateMapping`, `detectMapping`, `GET/POST reconciliation/templates`     |
| Rows already require per-entry human confirmation                         | `POST :syncId/auto-match`, `POST :syncId/entries/:entryId/match`            |
| 20 MB statement upload ceiling                                            | `reconciliation.controller.ts:54`                                           |
| Family-AI-key resolution + 3 provider adapters exist and are reviewed     | `AiKeyService.resolveDecryptedKey`, `OcrFactory` (EPIC-027 group 6)         |
| `pdf-lib` is a writer and cannot extract text                             | `apps/api/package.json:48`, `pdf-report-writer.util.ts`                     |
| EPIC-028 must not start until EPIC-027 lands (same files)                 | `docs/epics/EPIC-028-*.md` header                                           |

## Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Rejected alternative                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| E1  | **The model never produces a final amount.** It emits a table of raw strings; `parseStatementAmount`/`parseStatementDate`/`mapTableToRows` validate it unchanged                                                                                                                                                                                                                                                                                                                                                      | Model returns typed rows (puts a hallucinated number straight into money)                                           |
| E2  | Text layer first via `pdfjs-dist`; render pages to images for the vision adapters only when there is no usable text layer                                                                                                                                                                                                                                                                                                                                                                                             | Vision always (re-reads digits already present as text; far costlier)                                               |
| E3  | Mandatory preview before any `BankSync` is stored, plus a totals cross-check against the statement's own opening/closing balance when one is found                                                                                                                                                                                                                                                                                                                                                                    | Straight to entries, relying on per-entry matching alone                                                            |
| E4  | Generic extraction prompt + the existing per-bank template system for normalization; no per-bank code paths                                                                                                                                                                                                                                                                                                                                                                                                           | Hard-coded BCA/Mandiri/BNI/BRI parsers                                                                              |
| E5  | Uses `AiKeyService.resolveDecryptedKey` per request, exactly as OCR does (EPIC-027 D11). No env key, no fallback, no mock                                                                                                                                                                                                                                                                                                                                                                                             | A server-wide key for statements                                                                                    |
| E6  | Page cap + explicit refusal above it; the family pays for this call                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Unbounded page count                                                                                                |
| E7  | A totals mismatch REFUSES the import with the discrepancy shown — it never imports "mostly right" rows                                                                                                                                                                                                                                                                                                                                                                                                                | Import with a warning banner                                                                                        |
| E8  | **Encrypted files are decrypted IN THE BROWSER; the password never reaches the server.** Bank statement passwords are derived from personal data (DOB, card/account number) and are reused — treating one as a transportable form field puts PII into request handling, logs and crash reports                                                                                                                                                                                                                        | Server-side decryption with the password sent as a form field                                                       |
| E9  | PDF therefore extracts **client-side too**: `pdfjs-dist` decrypts for reading only and cannot emit a decrypted PDF, so the client uploads extracted text (or rendered page images), never the file. XLSX/ZIP decrypt to real bytes, so those upload plaintext and the existing server parsers run untouched                                                                                                                                                                                                           | Re-saving a decrypted PDF server-side (no library supports this)                                                    |
| E10 | The password is never persisted, never logged, never placed in an error message, and never sent to the AI provider — the provider receives extracted text only                                                                                                                                                                                                                                                                                                                                                        | Passing the password through for "better error messages"                                                            |
| E11 | Try an empty password first: some bank PDFs carry only an OWNER password (permissions lock) and open with none. Prompt only on a real `NEED_PASSWORD`                                                                                                                                                                                                                                                                                                                                                                 | Always prompting, training users to type a secret needlessly                                                        |
| E12 | **`office-crypto` was rejected and the OOXML decryptor hand-written against `crypto.subtle`.** The package declares zero dependencies but imports Node's `crypto` with no browser build (`dependencies: None`, no `browser` field, `dist/index.js:809` → `} from "crypto"`), so using it in a browser means bundling `crypto-browserify` — the transitive tree E8's reasoning and this repo's already-red advisory list exist to avoid. Agile encryption needs only SHA-512 and AES-256-CBC, both native to WebCrypto | Shipping `office-crypto` + a polyfill tree; `officecrypto-tool` and `xlsx-populate` have the same Node-only problem |
| E13 | **Agile encryption only.** Excel 2010+ default. The older standard scheme uses AES-**ECB**, which WebCrypto deliberately does not expose, and RC4 is older still. Both are DETECTED and refused with `unsupported-encryption` telling the user to re-save from Excel — never mis-reported as a wrong password or a corrupt file                                                                                                                                                                                       | Implementing ECB by hand to cover legacy files                                                                      |
| E14 | **The `<dataIntegrity>` HMAC is verified, and a file that omits it is REFUSED** (`integrity-missing`, distinct from `integrity-failure`). The password verifier proves the password, not the ciphertext; AES-CBC is unauthenticated, so a tampered package would decrypt silently under the correct password and feed altered numbers to the money pipeline. Accepting-when-absent is not a fallback but a bypass — anyone who can alter the package can delete one XML element                                       | Verifying the password only, and trusting the ciphertext                                                            |

## Tasks

### 1 — PDF text extraction + page rendering ✅

- [x] E4a — Encrypted PDF: `pdfjs-dist` takes the password as a `getDocument`
      option, with typed `PasswordException` handling (`NEED_PASSWORD` vs
      `INCORRECT_PASSWORD`) and an empty-password attempt first (E11). Lives
      here, not in group 4, because a decrypted PDF is useless without the
      extractor below
- [x] E1a — `pdfjs-dist` text-layer extraction behind a small port, page-capped
- [ ] E1b — Page→image rendering for the vision fallback — **NOT BUILT, deliberately.**
      Both reference statements carry a real text layer, so it would ship
      untested against any real input. `pdf-no-text-layer` is detected and
      refused by name instead (see the Automation Log)
- [x] E1c — Detect "no usable text layer" honestly and switch modes; refuse an encrypted/password-protected PDF with its own reason

### 2 — AI statement reader on the family key ✅

- [x] E2a — `StatementReaderPort` + factory over the existing claude/openai/gemini adapters, keyed by `AiKeyService` (E5)
- [x] E2b — Prompt returns a table of RAW STRINGS only (E1); zod-validated shape, never typed money
- [x] E2c — Extracted table flows through `mapTableToRows` + the existing template system unchanged (E4)
- [x] E2d — Distinct error codes mirroring the OCR set (not configured, corrupted key, auth, rate limit, timeout, parse, page cap)

### 3 — Preview + totals gate ✅

- [x] E3a — Extraction returns a preview payload; nothing is persisted yet
- [x] E3b — Totals cross-check against the statement's own opening/closing balance when present; mismatch refuses with the numbers shown (E7)
- [x] E3c — `/rekonsiliasi` preview UI: rows, skipped rows with reasons, the totals verdict, and an explicit confirm
- [x] E3d — Replace the "PDF ditolak — ini disengaja" callout with copy that tells the truth about the new flow and its AI-key requirement

### 4 — Encrypted XLSX + password-protected ZIP (decrypted client-side) ✅

Ships value on its own: both decrypt to real bytes, so the plaintext file goes
to the UNCHANGED server parser and reconciliation works end to end without any
of groups 1-3. Encrypted PDF is deliberately NOT here — decrypting a PDF only
yields a readable document, which is useless until group 1 can extract from it,
and the password is simply a `pdfjs.getDocument` option, so it belongs beside
the extractor (see E4a, moved into group 1).

- [x] E4b — Encrypted XLSX: decrypted in the browser against `crypto.subtle`
      (hand-written, see E12); the plaintext workbook uploads to the UNCHANGED
      server parser. Agile encryption only (E13), `<dataIntegrity>` verified (E14)
- [x] E4c — Password-protected ZIP containing CSV/XLSX: unzipped client-side
      (`@zip.js/zip.js` handles both ZipCrypto and AES), inner file uploaded;
      the server path still routes through `zip-bounds.util.ts` (whose comments
      record that decompression bound being defeated twice in review)
- [x] E4d — Password held in component state only: never persisted, never
      logged, never in an error message, never sent to the AI provider (E10).
      A test asserts the password appears in no request body and no thrown message
- [x] E4e — Decryptors are dynamically imported so they cost nothing on first
      paint; the reconciliation page must stay inside the app-page JS budget

## Acceptance Criteria

- A text-layer PDF from a real Indonesian bank produces rows whose amounts and dates match the statement exactly.
- A scanned PDF still works via the vision fallback, or is refused with a specific reason — never silently zero rows.
- With no family AI key, PDF upload is refused with the same honesty as the OCR path and no fabricated rows.
- A totals mismatch blocks the import and shows the discrepancy.
- No amount reaches the database without passing `parseStatementAmount`.
- The existing CSV/XLSX paths are untouched and still green.
- A password-protected PDF, XLSX and ZIP each import with the correct password, and the password appears in no request the server receives.
- A wrong password says so specifically and allows a retry, rather than reporting a corrupt file.

## Test Plan

- Unit: text-vs-vision mode selection; page cap; raw-string schema rejection of typed money; totals cross-check pass and fail; every error code.
- Integration: PDF upload → preview → confirm → entries; no-key refusal; encrypted PDF refusal.
- Regression: the whole existing reconciliation suite stays green.
- Manual: a real BCA/Mandiri/BNI/BRI e-statement per bank, amounts reconciled by hand against the PDF.

## Agent Routing

`ecc:typescript-reviewer` · `ecc:security-reviewer` (untrusted PDF + paid key) · `ecc:database-reviewer` (if BankSync gains columns) · `review-qa-agent` · `test-agent`.

## Done Signal

Merged to `development` with gates green; this file's Automation Log records the outcome per group.

## Automation Log

- 2026-08-24 /nerve EPIC-029 #4 "Encrypted XLSX + password-protected ZIP"
  → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/309. Requested directly by the user:
  "kebanyakan bank e-statement di protect password".
  Sequenced first, ahead of groups 1-3, because both formats decrypt to real
  bytes and go straight to the UNCHANGED server parser — reconciliation works
  end to end with no AI and no extraction pipeline. Encrypted PDF moved to
  group 1 (E4a): decrypting a PDF only yields a readable document, useless
  until there is an extractor, and the password is just a `getDocument` option.
  **The password never leaves the tab (E8/E10).** Statement passwords are DOB,
  card or account numbers, KTP digits — PII, and reused. Client-side decryption
  means there is nothing to leak through a log, a request or a crash report.
  Asserted adversarially rather than claimed: the tests instrument `fetch`,
  `XMLHttpRequest`, `sendBeacon`, `console.*` and `Storage.prototype.setItem`,
  and `password-upload.test.tsx` serializes the real captured request — URL,
  headers, every FormData part including the uploaded file's bytes — and
  searches it for the password, while also asserting the decryptor DID receive
  it so the test cannot pass by the feature silently doing nothing.
  **`office-crypto` was rejected (E12)** after it turned out to import Node's
  `crypto` with no browser build — verified independently: `dependencies: None`,
  no `browser` field, `dist/index.js:809` → `} from "crypto"`. The epic had
  recommended it; the recommendation was wrong. Agile encryption needs only
  SHA-512 and AES-256-CBC, both native to WebCrypto, so it is implemented
  against the spec instead of shipping a `crypto-browserify` tree into an
  already-red advisory list. Agile only (E13); standard/ECB and RC4 are
  detected and refused with a re-save instruction.
  **Three review rounds; every finding was real, and two were severe.**
  (1) `hashSize` was unvalidated, so `Number("x")` → NaN → `Math.min(NaN, n)`
  → NaN → `subarray(0, NaN)` → zero-length on both sides → `bytesEqual` true:
  **the password verifier passed for ANY password.** Reverting the fix fails 11
  tests, several resolving to `[80, 75, 3, 4, …]` — ZIP magic, a workbook
  "successfully decrypted" with the wrong password. `hashSize` is now pinned to
  the declared algorithm's exact digest length, not a loose bound, because a
  plausible-but-wrong value would silently shorten the comparison rather than
  disable it.
  (2) DIFAT enumeration was unbounded: `numFatSectors` and the DIFAT count are
  attacker-controlled 32-bit header fields never bounded by `totalSectors`. A
  6 KB file with a 2-cycle chain blocked the main thread for **37,916 ms**,
  reached before `EncryptionInfo` is parsed and before any password check — so
  submitting any password, even a wrong one, froze the tab. Now bounded by the
  real sector count with an explicit cycle refusal, mirroring `followChain`.
  (3) The QA gate then found the one that matters most on money data: **no
  ciphertext integrity check (E14)**. The password verifier proves the
  password, not the package. AES-CBC is unauthenticated, so a tampered
  `EncryptedPackage` decrypts silently under the correct password and hands
  altered numbers to the "hardened, already-reviewed" parser as pristine data —
  precisely the silently-wrong-number-on-a-money-row failure this epic's Goal
  is written against. `<dataIntegrity>` is now verified, and a file that omits
  the element is REFUSED rather than accepted: anyone who can alter the package
  can also delete one XML element, so leniency there is a bypass, not a
  fallback.
  Hardening the fix surfaced three more unvalidated inputs — base64 blobs
  escaping the closed failure union as raw `DOMException`s, a `saltValue` of
  any length reaching `subtle.decrypt` as the CBC IV, and short ciphertext
  blobs reported as **wrong-password** for a file that is actually malformed
  (which would have had users retyping a correct password against a broken
  file).
  Gates: qa.sh 0, test.sh 0, API 108 suites / 1296 tests, web 55 suites / 673
  tests (671 passed, 2 skipped — was 573 on `development`). Both HIGH fixes
  mutation-proved, and both reviewers re-ran the mutations themselves rather
  than trusting the report. `security-check.sh` red only on the pre-existing
  `deepmerge-ts` advisories; `@zip.js/zip.js` (BSD-3-Clause) added none.
  Decryptors are `await import(...)`-only, so they stay out of first paint.
  **Needs manual verification with genuine bank files:** a real BCA / Mandiri /
  BNI / BRI protected `.xlsx` and a real protected ZIP. The crypto fixture is
  built with Node's `createCipheriv` and decrypted via `crypto.subtle` — real
  cross-implementation validation, but it proves conformance to the spec as
  read here, not interoperability with what every bank's generator actually
  emits.

- 2026-08-25 EPIC-029 groups 1-3 "PDF bank statements on the family AI key"
  → implemented. `/rekonsiliasi` accepts a PDF end to end: the text layer is
  extracted **in the browser**, posted as text, transcribed by the family's
  own AI key into a table of RAW STRINGS, parsed by the existing
  `parseStatementAmount`/`parseStatementDate`/`mapTableToRows`, cross-checked
  against the statement's own printed totals, and shown for explicit
  confirmation before anything is stored.

  **Vision fallback (E1b) NOT built, and said so rather than half-shipped.**
  Both genuine reference statements have real text layers, and `pdfjs-dist`
  extracted them faithfully, so a rendering path would have shipped against
  zero real input — a second paid code path, exercised only by fixtures,
  guarding a case neither real file exhibits. A scan is DETECTED
  (`pdf-no-text-layer`, both client- and server-side) and refused by name
  with the one instruction that works: download the original e-statement, or
  export CSV/Excel. It is never sent upstream, because the failure being
  avoided is not a crash — it is a paid model handed an empty prompt
  answering with a confident, entirely invented table of money rows.

  **The pdfjs worker in Next 16 / Turbopack.** Wired as
  `GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs",
import.meta.url).toString()`, which Turbopack rewrites to a real emitted
  asset — verified in the build output at
  `.next/static/media/pdf.worker.min.*.mjs`. The two classic breakages are
  both avoided: a hardcoded `/pdf.worker.js` (nothing copies it into
  `public/`, so it 404s only in production) and a CDN URL (third-party script
  execution, version-skewed against the bundled library). `pdfjs-dist` is
  reached ONLY via `await import(...)`; the build manifest confirms its
  429 KB chunk is not in `/rekonsiliasi`'s initial set.

  **`@napi-rs/canvas` excluded.** `pdfjs-dist` declares it as an OPTIONAL
  dependency for Node-side bitmap rendering — 62 MB of prebuilt native
  binaries, for code this repo never executes and never bundles (pdfjs's own
  `browser` field already maps `canvas` to false). Added to
  `pnpm.ignoredOptionalDependencies` rather than a repo-wide `optional=false`,
  which would silently drop every other package's optional deps too.

  **Endpoints.** `POST family-groups/:familyGroupId/reconciliation/statement-pdf`
  (200, persists NOTHING) and `.../statement-pdf/confirm` (201, writes).
  Both `@CheckAbility(can("create", "Reconciliation"))` — the read is
  additionally `@Throttle(5/min)` because it bills the family's key, while
  confirm is deterministic, calls no AI, and costs nothing. Tenant scoping is
  the global `TenantGuard` on `:familyGroupId`; because `AbilitiesGuard` waves
  through any route carrying no `@CheckAbility` at all, the controller spec
  now enumerates `ReconciliationController.prototype` and asserts a
  `dependant` is refused on EVERY handler — so a route added tomorrow without
  a gate fails here instead of in production. Mutation-proved: deleting the
  decorator from `readStatementPdf` fails 2 tests.

  **Three real defects the work surfaced, each found by a test or a real file:**

  (1) `parseStatementAmount` rejected `+4.350.000,00` and `+ 15.630.000,00`.
  A leading "+" failed `/^[\d.,]+$/`, and so did the space some banks put
  after the sign. That is exactly how the real Mandiri e-statement prints
  **every incoming row** and its own "Dana Masuk" summary — so on a genuine
  statement every credit would have been skipped as unparseable AND the
  totals gate would have had nothing to check against. Both are now accepted
  ("+" cannot mean anything but positive), with regression tests.

  (2) Glyph-run joining split amounts. PDF generators routinely emit one
  number as several runs at ~zero gap; the first implementation inserted a
  space between any two runs, turning `-37.000,00` into `-37.0 00,00` — an
  unparseable amount, i.e. a silently dropped money row. The gap thresholds
  are now a multiple of the RUN'S FONT SIZE, not absolute units.

  (3) The preview crashed the page on a response without a totals verdict —
  a white screen during any rolling deploy that put this client in front of
  an older API. Now validated before render and reported as a retryable
  error.

  **Real-file verification (by hand — no committed fixture derives from
  them).** Neither statement, nor any text extracted from them, nor any
  password is in the repo.
  - **BCA, 1 page** — opened with an **EMPTY password** (owner/permissions
    lock only), confirming E11 is a real case rather than a theoretical one.
    9 transactions extracted, 0 skipped. Sums: credit 4,000,136 vs printed
    "MUTASI CR : 4,000,135.57"; debit 9,510,000 vs printed
    "MUTASI DB : 9,510,000.00"; opening 7,018,920 + net −5,509,864 =
    1,509,056 vs printed "SALDO AKHIR : 1,509,055.10". The two 1-rupiah gaps
    are whole-rupiah rounding on a cents-quoted statement and fall inside the
    ⌈n/2⌉+1 bound — the exact case the tolerance exists for.
  - **Mandiri, 5 pages, password-protected** — the empty password correctly
    produced `pdf-password-required` (not `corrupt-file`); with the password
    it opened. 52 transactions, 0 skipped, summing to **exactly** the
    statement's own printed figures: incoming 15,630,000 = "Dana Masuk : +
    15.630.000,00", outgoing 15,849,448 = "Dana Keluar : - 15.849.448,00",
    and 1,517,061 + (−219,448) = 1,297,613 = "Saldo Akhir". Dates span
    2026-07-01 to 2026-07-31.
  - Both real drafts were also run through the REAL server pipeline
    (`commitStatementDraft`), and both were **REFUSED** when a single genuine
    transaction was deleted from them — the gate catches on real data, not
    only on fixtures.
  - What this does NOT cover: the AI call itself. There is no family key in
    this environment, so the model's transcription was stood in for by a
    deterministic script reading the same extracted text. Everything from the
    raw strings onward is the real code path; the transcription step needs a
    live key and a human comparing rows against the PDF.

  **Test vs hand.** Committed tests cover: line/column reconstruction and
  every gap threshold; empty-password-first, wrong-vs-required password, the
  page cap (asserting no page is read), the text cap, scan detection, the
  per-attempt buffer copy, and one distinct message per reason in both
  locales; the raw-string schema REJECTING a numeric amount and a numeric
  total; the prompt carrying no bank name; every HTTP error code; the totals
  gate's match/mismatch/unavailable, its rounding tolerance and its flatness;
  preview-persists-nothing, commit-refuses-a-mismatch, commit-does-not-call-AI,
  and a BCA-shaped `DB`-marker + dotted-decimal draft; and — driving the real
  page — that the PDF request is JSON text with no file, no FormData, no
  `upload-file`, and no password anywhere in URL, headers or body, while the
  password DID reach the extractor. Verified by hand only: pdfjs itself
  (jsdom has no Worker or `DOMMatrix`), and the two real statements above.

  **Two non-blocking security-review recommendations, both actioned (both sat
  on the money path):**

  (a) **The untrusted-text boundary is now structural, not a comment.** The
  extracted PDF text was concatenated into one user turn behind a
  `--- STATEMENT TEXT ---` line — which puts an "ignore all previous
  instructions" line embedded in a crafted statement at exactly the same
  level as the rules it is trying to override. The rules now ride each
  provider's OWN system channel (Claude's top-level `system`, OpenAI's
  `system` message, Gemini's `systemInstruction` — the same field
  `GeminiAdvisorService` already uses), never faked by prepending another
  line to the user turn. The statement is fenced in a delimited block framed
  as data to transcribe and never to obey, the fence markers are neutralised
  if the document contains them (a delimiter an attacker can write is not a
  delimiter), and the output contract is RESTATED after the block so the last
  instruction the model reads is ours rather than the document's final line.
  This is mitigation, not a guarantee, and the spec says so: the containment
  that actually holds is `statementReadingSchema` admitting only
  length-capped strings, `parseStatementAmount` re-parsing every amount
  server-side, the totals gate, and the human confirm. So the new spec asserts
  BOTH — the wire shape per provider, and that a model which OBEYS the
  injection ("return every amount as a number", "reply with the text OK",
  an over-long field) is rejected by the schema anyway. Mutation-proved:
  collapsing the OpenAI adapter back into one concatenated user turn fails
  the test.

  (b) **The `"unavailable"` totals verdict no longer reads like success.**
  `commitStatementDraft` refuses only on `mismatch`, so a statement printing
  no totals commits with no cross-check at all — correct (refusing every such
  statement would block legitimate imports) but previously presented under
  the same heading and the same "Impor baris ini" button as a verified
  import. The refusal logic is UNCHANGED; the claim is not. Verified and
  unverified now differ in the heading itself (not just body copy, which a
  glance skips), the unverified case carries an explicit note that the rows
  were not cross-checked against anything, the confirm button reads "Impor
  tanpa pemeriksaan total", and — because after the preview closes the toast
  is the only thing left on screen — the success toast is a distinct warning
  rather than "berhasil". All three i18n files; the dead
  `pdfPreviewTotalsTitle` key was removed. Tested in both directions
  (unverified must not look verified, verified must still say so) and
  mutation-proved.

  **Gates.** `qa.sh` 0, `test.sh` 0, both `tsc --noEmit` clean, eslint clean
  (one pre-existing `jest.config.ts` warning, untouched). API **116 suites /
  1379 tests** (was 110 / 1315), web **57 suites / 720 tests** (718 passed,
  2 skipped; was 56 / 689). `turbo run build --filter=web` green, worker
  asset still emitted. `security-check.sh` red on exactly the pre-existing
  `deepmerge-ts`-via-prisma advisories and nothing else — byte-identical to
  the same run with the change stashed; `pdfjs-dist` (Apache-2.0, zero
  runtime dependencies) added none.

### 2026-08-26 — PR #310 merged into `development`

PR [#310](https://github.com/andrsrjld/wealthme-web/pull/310) (parts A+B in
`975f9d3`, part C in `02b2e14`) merged as `6366618`, base `development`.
Verified by content, not by status: the merge commit is an ancestor of
`origin/development` and `statement-ooxml-zip.ts`,
`statement-reader/statement-reader.port.ts`, and `jest.global-setup.js` all
resolve there. That check exists because #303/#304 both showed MERGED and green
while `development` held only the backend half — a stacked PR merged into its
parent branch, not into `development`.

**One CI-only failure, fixed in `d42bbaa`.** `password-upload.test.tsx` blew
Jest's 5s default on the wrong-password retry spec — green locally, red on CI,
no logic bug. Every spec there mounts the whole `/rekonsiliasi` page (~600ms per
render) and the shared runner is ~5x slower (suite 20.4s on CI vs 3.9s local).

The repo's usual remedy would have been wrong: `userEvent.setup({ delay: null })`
(the idiom used 9x in `guided-setup.test.tsx`) moved the spec from 623ms to
688ms — i.e. nothing, because the cost is the render, not the typing. Reverted
and fixed the real thing with a file-scoped `jest.setTimeout(20_000)`, its
reasoning written into the file. Proved it binds by mutation: at
`jest.setTimeout(1)` the specs fail with "Exceeded timeout of 1 ms". Nothing in
these specs waits on a real timer, so a genuine hang still fails, just later.

**Gates after the fix.** `qa.sh` 0, `test.sh` 0 — API 116/1379, web 57/720
(718 passed, 2 skipped). CI run `32942303811` green, with
`PASS src/app/(app)/rekonsiliasi/password-upload.test.tsx (20.423 s)`.

`security-check.sh` remains red, and it is **not** this branch's doing:
`pnpm audit --audit-level high` flags `nanoid` (via better-auth→next) and
`deepmerge-ts` (via prisma), and `development`'s own lockfile already pins those
exact vulnerable versions (`nanoid@3.3.17`, `deepmerge-ts@7.1.5`). No advisory
names `pdfjs-dist` or anything else this epic added. Worth its own upgrade PR;
it is not a signal about this work.

**DEV deploy blocked on a host credential, not on the code.** CI run
`32942868550` on `development` is green and pushed
`ghcr.io/andrsrjld/wealthme-web-{api,web}:dev`, but `scripts/deploy-dev.sh`
refuses on the pull:

```
Error response from daemon: error from registry: unauthorized
[deploy] REFUSED: image pull failed.
```

The dev host has no `ghcr.io` entry in `~/.docker/config.json`, and the packages
are private — an anonymous token request returns `UNAUTHORIZED` and the manifest
`403`. The `gh` CLI token on this host carries `repo, read:org, gist,
admin:public_key` but **not** `read:packages`, so it cannot stand in. Needs a
human, once:

```bash
gh auth refresh -s read:packages
gh auth token | docker login ghcr.io -u andrsrjld --password-stdin
bash scripts/deploy-dev.sh
```

`DEPLOY_MODE=build` is the documented fallback but the script's own header warns
local builds on this host fail randomly (a hardware symptom), so it is a last
resort. Containers still serve the 39h-old images until this runs.

**Remember on the next deploy:** `docker compose restart nginx`. `wealthme-nginx`
has been up 45h and caches the web container's IP; every recreate moves that IP
and nginx 502s until restarted. This has bitten every deploy so far and is not
yet automated in the compose recreate set.

- 2026-09-02 — Documentary QA audit (code vs. this log, no live DEV access
  from this sandbox). All 4 task groups' items are `[x]` except E1b (PDF
  page→image rendering for the vision fallback), which is marked
  **deliberately not built** — confirmed still absent in code, this is not
  a gap, it's a recorded scope decision.
  Spot-checked and confirmed real: the four `statement-pdf` endpoints, the
  Mandiri "+15.630.000,00" sign-parsing fix, the statement-reader
  port/factory/adapters (claude/openai/gemini), and the client-side
  OOXML/ZIP decryption hooks with their tests.
  **Deploy blocker confirmed still open, first-hand**: `gh auth status` on
  this machine shows scopes `admin:public_key, gist, read:org, repo` — no
  `read:packages`; `~/.docker/config.json` has no `ghcr.io` entry at all.
  Nothing in git history since this log's last entry records the
  remediation (`gh auth refresh -s read:packages` + `docker login ghcr.io`)
  having run. Still needs a human with interactive GitHub OAuth — not
  automatable.
  **This log is stale relative to `development`**: 9 PRs merged after this
  log's last entry touch the exact reconciliation/statement code this epic
  covers (#311 DI fix, #312 page-by-page read + timeout fixes, #313
  bank-line→Transaction conversion, #314 Gemini thinking-budget fix, #316
  a ÷100 display-amount fix, #318 the overdraft-floor waiver for bank-line
  imports) — none recorded here. Not fixing that drift now (out of this
  audit's scope), flagging it so the next person updating this file knows
  to reconcile against `git log`, not just this file's own history.
  Status unchanged (`on-progress`) — accurate: real code work remains
  blocked on a human-only step, and E1b's omission is by design.
