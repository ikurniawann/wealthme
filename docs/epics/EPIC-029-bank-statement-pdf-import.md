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

### 1 — PDF text extraction + page rendering

- [ ] E4a — Encrypted PDF: `pdfjs-dist` takes the password as a `getDocument`
      option, with typed `PasswordException` handling (`NEED_PASSWORD` vs
      `INCORRECT_PASSWORD`) and an empty-password attempt first (E11). Lives
      here, not in group 4, because a decrypted PDF is useless without the
      extractor below
- [ ] E1a — `pdfjs-dist` text-layer extraction behind a small port, page-capped
- [ ] E1b — Page→image rendering for the vision fallback, reusing the 2 MB-cap encoder shape
- [ ] E1c — Detect "no usable text layer" honestly and switch modes; refuse an encrypted/password-protected PDF with its own reason

### 2 — AI statement reader on the family key

- [ ] E2a — `StatementReaderPort` + factory over the existing claude/openai/gemini adapters, keyed by `AiKeyService` (E5)
- [ ] E2b — Prompt returns a table of RAW STRINGS only (E1); zod-validated shape, never typed money
- [ ] E2c — Extracted table flows through `mapTableToRows` + the existing template system unchanged (E4)
- [ ] E2d — Distinct error codes mirroring the OCR set (not configured, corrupted key, auth, rate limit, timeout, parse, page cap)

### 3 — Preview + totals gate

- [ ] E3a — Extraction returns a preview payload; nothing is persisted yet
- [ ] E3b — Totals cross-check against the statement's own opening/closing balance when present; mismatch refuses with the numbers shown (E7)
- [ ] E3c — `/rekonsiliasi` preview UI: rows, skipped rows with reasons, the totals verdict, and an explicit confirm
- [ ] E3d — Replace the "PDF ditolak — ini disengaja" callout with copy that tells the truth about the new flow and its AI-key requirement

### 4 — Encrypted XLSX + password-protected ZIP (decrypted client-side) ✅ ✅

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
  → PASS (attempts: 3), PR: <PR_URL>.
  Reordered before building: this group was originally "all password-protected
  statements". XLSX and ZIP decrypt to real bytes, so the plaintext goes to the
  UNCHANGED server parser and reconciliation works end to end with none of
  groups 1-3. A decrypted PDF is useless until group 1 can extract from it, and
  its password is just a `getDocument` option — E4a moved to group 1.
  **The named package does not work in a browser.** The epic specified
  `office-crypto` on the strength of "zero runtime dependencies". True of its
  package.json, false of its runtime: `dist/index.js:809` imports Node's
  `crypto` synchronously, there is no `browser` field and no browser build, so
  using it means bundling `crypto-browserify`'s transitive tree — the exact
  growth E8 and this repo's already-red advisory list argue against.
  `officecrypto-tool` is worse (same hard require plus `cfb`, `crypto-js`,
  `xml2js`). Verified independently with `npm pack` rather than taken on trust.
  ECMA-376 **agile** encryption needs only SHA-512 and AES-256-CBC, both native
  in `crypto.subtle`, so the decryptor is hand-written: a CFB/OLE reader, agile
  key derivation, verifier, and segmented decryption. Standard (AES-**ECB**,
  which WebCrypto deliberately does not expose), RC4 and extensible schemes are
  detected from the version words BEFORE any password work and refused as
  `unsupported-encryption` — never mis-reported as a wrong password.
  **Hand-written crypto earned an adversarial pass, and it found two
  CRITICALs that every functional test passed straight through.**
  (1) `concatSectors` allocated the directory entry's attacker-controlled
  `streamSize` BEFORE walking the FAT to see whether that many bytes exist —
  a ~2 KB crafted container declaring `0xFFFFFFFE` requested ~4.3 GB, and
  `parseCfb` runs before any password is entered. The reviewer built a working
  PoC. Tellingly the clamp already existed for the root stream and was missing
  in `read()`: an oversight, not a decision. Both bounds now live inside
  `concatSectors` so every caller gets them by construction, and the regression
  test instruments `Uint8Array` via a Proxy to assert the largest allocation
  actually _requested_ — with a positive control proving the spy sees real
  allocations, so the assertions cannot pass vacuously.
  (2) Agile encryption's `dataIntegrity` HMAC was never verified. Segments are
  plain AES-256-CBC and the manufactured-padding trick can never throw on
  tampered input, so CBC bit-flipping silently rewrote plaintext: anyone able
  to alter the file between the bank and the upload could change specific
  transaction amounts, the real password still worked, no error surfaced, and
  the result landed in the ledger as pristine. HMAC-SHA512 is now computed over
  the whole `EncryptedPackage` INCLUDING its 8-byte length header (covering the
  header is what stops a truncation posing as a shorter workbook), after the
  password verifier so a mistyped password is still reported as such, and
  before any plaintext is produced. A missing `<dataIntegrity>` is REFUSED with
  its own `integrity-missing` reason: accepting-when-absent is not a fallback,
  it is a bypass, since whoever can alter the package can delete one XML
  element. Excel has emitted it since 2010, so the expected real cost is zero —
  and a distinct reason means a bank whose generator omits it produces a
  specific report rather than a silent tamper.
  Also fixed: `MAX_SPIN_COUNT` 1,000,000 → 200,000 (Office's default is
  100,000) with a real macrotask yield every 4096 iterations so an untrusted
  file cannot freeze the tab; `keyBits` routed through the bounded helper the
  rest of the file already used; unmapped errors now log `err.name` ONLY (not
  `constructor.name`, which minifiers mangle) so a genuine defect stops
  presenting to every user as "file rusak" forever.
  ZIP: multiple statement entries are REFUSED, never guessed — silently
  reconciling the wrong month is the failure class this epic exists to prevent.
  The real bound is a counting `WritableStream` that throws inside `write()`,
  because `zip-bounds.util.ts`'s header records declared sizes being defeated
  twice; tested against an entry that under-declares by 4 bytes then writes
  25 KB. `@zip.js/zip.js` added via its `index-native.js` subpath so no WASM is
  bundled; zero dependencies, advisory list unmoved.
  E4e: 232 KiB of decryptor stays off first paint — `/rekonsiliasi` initial JS
  moved 1419.6 → 1428.1 KiB (+8.5 KiB, +0.6 %), same 22 chunks.
  E4d is proven at two layers: the module test instruments `fetch`,
  `XMLHttpRequest`, `sendBeacon`, every `console.*` and `Storage.setItem` and
  serialises thrown values including own properties; the page test renders the
  REAL page and serialises the actual `fetch` — URL, headers, every FormData
  part including the uploaded bytes — asserting the password appears nowhere,
  with guards in both directions so it cannot pass vacuously.
  Gates: qa.sh 0, test.sh 0, web 55 suites / 673 tests (671 passed, 2 skipped;
  was 51/573), API 108/1296 untouched, tsc + eslint clean, advisory list
  unchanged.
  **Not yet proven, and this is the one that matters:** no file from real
  Microsoft Excel or a real Indonesian bank has been through this. The fixture
  is built with `node:crypto` from the same reading of [MS-OFFCRYPTO] as the
  implementation — it validates internal consistency, NOT interoperability. If
  Excel deviates in any detail, including the HMAC derivation, every test here
  still passes. One genuine locked statement is the check that counts.
  Also unverified: whether Indonesian banks emit standard (AES-ECB) rather than
  agile — if any do they hit `unsupported-encryption`, an honest refusal but a
  non-working case. Bytes 0-3 of the `EncryptionInfo` stream answer it cheaply.

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
