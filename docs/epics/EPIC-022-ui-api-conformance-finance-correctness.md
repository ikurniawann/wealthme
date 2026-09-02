# EPIC-022: UI↔API Conformance & Financial Correctness Pass

status: on-progress
environment: dev
retries: 0
phase: 4
priority: P0
area: Full-stack
source: `/nerve` full-app audit 2026-08-04 — 6 parallel domain agents reading UI and API side by side, plus live API reproduction against DEV

## Goal

The app now _looks_ finished — every epic is closed, 25 pages are bilingual, gates
are green. This epic exists because a deep audit found that a finished-looking
surface still hides three classes of problem that a real user would hit on day one:

1. **The UI and the API disagree.** Forms collect fields the API silently drops,
   send phone numbers into email validators, and swallow the server's actual
   error message into a generic "Gagal menyimpan". `ValidationPipe` runs with
   `whitelist: true` but **without** `forbidNonWhitelisted`
   (`apps/api/src/main.ts:29`), so unknown fields are stripped in silence —
   every mismatch below is silent data loss with a success toast, not a visible
   error.
2. **Some numbers are not true.** A balance sheet that can never fail to balance,
   a cashflow that prints negatives as positives, a "net worth trend" chart that
   is actually cumulative cashflow, and a retirement calculator overstating the
   required saving by ~12×.
3. **Some money movements are fictional.** Goal auto-debit writes a
   transaction-shaped row into the ledger that moved no money at all.

This epic is a correctness pass, not a feature epic. Nothing here is new
functionality; everything is "the app already claims to do this, and it doesn't."

## Evidence

Every finding below was verified by reading **both** the UI and the API for that
flow. The calibration case — reported by the user and reproduced live against the
DEV API — is task group A1: inviting a family member by phone number always fails,
because the form says "Email / No. HP" and the DTO is `@IsEmail`.

Live API reproduction (2026-08-04): `POST /family-groups/:id/invitations` returns
**201** for `role: member` and `role: admin_staff`, and **400 `email must be an
email`** for a non-email value — confirming the backend is healthy and the defect
is entirely in the form.

## Tasks

- [x] ### A — Money-losing and lie-shaped defects (fix first) ✅
  - **A1 — Family invite rejects phone numbers.** Field is labelled "Email / No.
    HP" (`components/crud/crud-config.ts:308`) but POSTs to an `@IsEmail` DTO;
    `nama`, `hubungan` and `role` are collected and never sent (role hardcoded
    `"member"`, and the dropdown offers "Co-Owner", which is not a real role).
    Fix: email-only field + real role picker, or send the extra fields.
    UI `app/(app)/akun/page.tsx:2626-2633`.
  - **A2 — Negative cash balance sign is silently flipped.** `/rekening` lists
    `cash` accounts but its `saldo` field lacks `allowNegative`, so editing an
    account holding **−Rp 50.000** re-saves it as **+Rp 50.000** with a success
    toast. `rekening/page.tsx:511` + `crud-config.ts:106` + `crud-modal.tsx:56-62`.
  - **A3 — Goal auto-debit writes a phantom ledger row.** The monthly cron
    increments `Goal.currentAmount`, picks an arbitrary account, and inserts a
    `type: transfer` transaction — but **never touches `Account.balance`**
    (`goals.service.ts:247-268`, comment at `:253-255`). The family sees a
    transaction that did not happen; reconciling against a real bank statement
    is impossible. Decide: back goals with a real account and move real money
    through `TransactionsService.create`, **or** drop the ledger row and label
    goals honestly as a manual tracker. The current middle state is the worst
    of both.
  - **A4 — Every newly created goal is permanently un-editable.**
    `currentAmount` is always sent and is `0` for a fresh goal, but the DTO
    validates `@IsPositive` (`@IsOptional` does not skip `0`) → every edit 400s
    into a generic toast, and the modal closes discarding the input.
    `lib/goals-utils.ts:13` × `goals/dto/update-goal.dto.ts:36-39`.
  - **A5 — Deleting a category silently destroys budgets and allow-lists.**
    `Budget.category` and `MemberCategoryAllowance.category` are
    `onDelete: Cascade`; the service does a bare delete with no dependant check
    (`categories.service.ts:104-110`). One click on a small `×` wipes budgets
    and per-member spending limits, with a dialog that only says "tidak bisa
    dikembalikan".
  - **A6 — Budgets leak private categories to members.** Every other shared read
    applies a privacy filter; `BudgetsService.findAll` applies none
    (`budgets.service.ts:31-75`), while `member` has `manage Budget`. A member
    sees the name, limit and exact spend of a category the owner marked private.

- [x] ### B — Reports that state things that are not true ✅
  - **B1 — The balance sheet can never fail to balance.** The "Total L + E" row
    renders `totalAssets`, not `totalLiabilities + netWorth`
    (`laporan/page.tsx:1410-1418`), and a green "✅ Balance Sheet Seimbang"
    banner renders unconditionally whenever data exists (`:1423-1435`). Compute
    the real identity, show the difference when it does not hold, and only claim
    balance when it is true.
  - **B2 — Negative cashflow renders as a positive number.** `fmt()` prepends
    `+` for non-negatives and then `Math.abs()` strips the minus for negatives
    (`laporan/page.tsx:1454`) — a negative Net Operasi/Net Cashflow shows as a
    bare positive figure, distinguished only by colour.
  - **B3 — Investing cashflow is a hard-coded zero presented as measured.**
    `reports.service.ts:559-562` returns zeros with a "placeholder" comment; the
    UI prints "Rp 0" with no disclosure. Also `Saldo Awal`/`Saldo Akhir` render
    nested _inside_ the investing block (`laporan/page.tsx:1509-1520`), and are
    back-derived from the current balance rather than being point-in-time
    (`reports.service.ts:564-565`).
  - **B4 — "Tren Kekayaan Bersih (6 Bulan)" is not net worth.** It is a
    cumulative running sum of income − expense starting at zero
    (`ringkasan/page.tsx:111` + `lib/chart-utils.ts:102-107`).
  - **B5 — /ringkasan's three headline cards cannot reconcile.** "Total Aset" is
    recomputed client-side as _positive-only account balances_
    (`ringkasan/page.tsx:83-86`), excluding investments and other assets that
    _are_ inside the net-worth figure beside it, and silently dropping overdrawn
    accounts. Use the API's own rollup.
  - **B6 — Exported "Ringkasan" ignores the selected period.**
    `exports.service.ts:222-227` calls `getSummary` with no anchor, so the export
    is always the trailing 6 months ending today while the screen shows the
    chosen period.
  - **B7 — Report period boundaries are built in browser-local time.**
    `lib/laporan-period.ts:43-68` uses the local `Date` constructor then
    `toISOString()`, with no timezone pin and no disclosure — the month boundary
    shifts by the viewer's UTC offset. Related: budget windows are server-local
    while `occurredAt` is parsed as UTC midnight (`budgets.service.ts:46-55`).
  - **B8 — Transfers render as red negatives in transaction lists**
    (`laporan/page.tsx:1007,1025`; `beranda/page.tsx:248`) while their category
    badge is neutral — the same row contradicts itself.
  - **B9 — Three different definitions of investment value on one tab**
    (`laporan/page.tsx:1653-1674` vs `:1661/1697` vs `:1792`). Worse than a
    naming inconsistency: the "Alokasi per Jenis" rollup on `development` today
    computes `parseFloat(inv.currentValue ?? inv.costBasisPerUnit) *
parseFloat(inv.quantity)` (`laporan/page.tsx:1655-1657`), but the API
    already returns `currentValue = currentPrice × quantity`
    (`investments.service.ts:94`). Only the `costBasisPerUnit` fallback is
    per-unit. So every holding that has a market price is squared by its
    quantity — 500 shares at Rp 10.000 render as Rp 2,5 M instead of Rp 5 jt,
    and the allocation percentages are wrong with it. The correct per-row value
    at `:1792` (`currentValue` used as-is) is what made the two disagree. Fix by
    correcting the rollup, not by propagating the bug for consistency.

  - **B10 — The balance sheet omits investments entirely.** `getBalanceSheet`
    (`reports.service.ts:446-470`) queries only `account`, `asset`, and
    `liability` — never `investment`. The dashboard's net worth is
    `accountsTotal + investmentsTotal + assetsTotal`
    (`dashboard.service.ts` `computeNetWorthBreakdown`), so for any family
    holding investments `/laporan` under-reports total assets and net worth by
    the whole portfolio while `/ringkasan` and `/beranda` report it correctly —
    and the page prints ✅ "Seimbang" over the gap. Found while checking why
    B1's identity check could never fail.
  - **B11 — `getBalanceSheet` accepts `asOfDate` and never uses it.** No date
    filter is applied to any of its three queries, so a balance sheet requested
    "per 31 Maret" silently shows today's balances.

- [ ] ### C — Budgets and goals behave unlike real budgets and goals
  - **C1 — Weekly and yearly budgets are selectable but not implemented.** The
    spend query is hardcoded to the calendar month regardless of `budget.period`
    (`budgets.service.ts:46-55`). A weekly grocery budget reads ~400% over
    forever; a yearly school-fee budget reads ~8% used until the money is gone.
    Implement the window or remove the two options.
  - **C2 — No budget edit or delete in the UI at all.** The API has both
    (`budgets.controller.ts:54-76`); `/anggaran` exposes neither. A typo in the
    limit is permanent.
  - **C3 — No period history, no rollover, no pro-rata.** Editing a limit
    rewrites all history; a budget created mid-month is measured against the
    whole month and fires an over-budget alert on day one.
  - **C4 — Budget 80% alert re-fires on every subsequent transaction** for the
    rest of the month (`transactions.service.ts:311-313,342-398`) — no
    already-alerted guard.
  - **C5 — Multiple budgets per category double-count** in the page totals
    (`anggaran/page.tsx:274-275`), reachable through the 409-fallback create path.
  - **C6 — Budget spend and report spend use different definitions of expense**
    (raw `tx.type` vs COA direction), so a savings-transfer category counts fully
    against its budget while contributing nothing to Beranda's expenses.
  - **C7 — Goal status is stored, never recomputed on read** — an overdue goal
    keeps its green "Sesuai Rencana" badge indefinitely (`goals.service.ts:101-107`),
    and the heuristic flags a brand-new long-horizon goal as `at_risk`
    (`:31-57`). No required-Rp/month projection is ever persisted or shown.
  - **C8 — "Sudah Terkumpul" at goal creation is silently discarded**
    (`goals.service.ts:120` hardcodes `0n`).
  - **C9 — No way to withdraw from a goal or zero it** (`@IsPositive` rejects 0).

- [ ] ### D — Financial products that are missing their core mechanics
  - **D1 — Liabilities cannot be edited, deleted, or paid.** `/liabilitas` is
    create-only; `remainingBalance` is typed once and can never change. There is
    no payment recording, no interest accrual, no amortisation/cicilan schedule,
    and no minimum-payment warning. For a credit card there is no statement
    balance, no available credit, no billing cycle. The `PATCH` endpoint exists
    and is never called (`liabilities.controller.ts:76`).
  - **D2 — Investments have no buy/sell, no lots, no history.** An "edit"
    overwrites quantity and cost basis wholesale; there is no realised P/L and no
    disposal path. `InvestmentPrice` exists but no investment-transaction model
    does.
  - **D3 — Investment prices are mock data, surfaced raw.** The detail row prints
    the literal string `mock` under "Sumber Harga" (`investasi/page.tsx:754`,
    from `mock-market-data.adapter.ts:25`), with no badge or warning — while the
    onboarding tour claims "harga & untung/rugi terupdate real-time"
    (`i18n/id.ts:663`). Either label the mock honestly everywhere or stop
    claiming real-time.
  - **D4 — Insurance premium payment records no expense.** "Bayar" only advances
    `renewalDate`; no transaction, no cashflow impact (`asuransi/page.tsx:902-924`).
    The copy is honest about this, but the premium never appears in expenses.
  - **D5 — Asset value estimates are unlabelled in every total.** The
    `(estimasi)` marker appears only on the row (`aset/page.tsx:402-407`); group
    totals and the "Total Aset" banner silently include depreciated/appreciated
    values. Assets also have no edit/delete UI, and the existing
    `GET /assets/:id/history` endpoint has no consumer.
  - **D6 — Beneficiary/heir under-allocation is never warned.** Over 100% is
    blocked at save; under 100% saves silently, and a row with a percentage but a
    blank name is dropped from both the sum and the payload
    (`asuransi/page.tsx:535-546`).

- [x] ### E — Zakat and tax must not state rulings they cannot support ✅
  - **E1 — Zakat asserts _wajib_ with no haul check.** The engine is a pure
    balance-sheet snapshot (`calculators.service.ts:39-48`); nothing stores a
    holding period, yet the copy claims "nisab & haul (1 tahun)"
    (`i18n/id.ts:1507`) and attaches a "Tunaikan Zakat Sekarang" CTA. Either
    implement haul or stop asserting obligation.
  - **E2 — Nisab is a hardcoded literal and the app's own gold price is unused.**
    `GOLD_PRICE_PER_GRAM = 1_100_000` (`calculators.service.ts:17-20`) and the
    figure is re-hardcoded in three i18n strings, while the owner-maintained
    `FamilyGroup.goldPricePerGram` built in EPIC-021 F sits unwired.
  - **E3 — The retirement calculator overstates by ~12×.** `/kalkulator` uses the
    **loan amortisation** formula for a savings goal
    (`kalkulator/page.tsx:546-551`): it prints Rp 21.808.818/month where the
    correct answer is Rp 1.808.818/month. The API already has the correct sinking
    fund formula (`calculators.service.ts:123-124`) and is never called. The API's
    own `projectedValue` is also wrong (`:127-130`).
  - **E4 — The progressive bracket table silently omits the 30% band**
    (`tax/page.tsx:48-53`) — rows do not sum to the headline tax above Rp 500jt.
  - **E5 — `isTaxDeductible` is an unvalidated free checkbox** feeding the
    persisted tax figure (`donations.service.ts:246-253` → `tax.service.ts:135-145`),
    with no type/recipient rule and no receipt requirement.
  - **E6 — Two divergent PPh21 engines** (`calculators.service.ts:29-35` vs
    `tax.service.ts:29-35`) — identical today, silently divergent after any edit;
    only one has golden tests.
  - **E7 — Zakat liabilities field means two different things** on `/kalkulator`
    ("Hutang / Liabilitas") vs `/donation` ("Utang Jatuh Tempo").

- [x] ### F — Errors, permissions and empty states ✅
  - **F1** — [x] Server error messages are swallowed app-wide. Bare
    `catch { toast.error(constant) }` in goals, investments, accounts, categories,
    donations and more — including 409s whose Indonesian text was written
    specifically to tell the user what to do (`accounts.service.ts:179-181`).
    Adopt one shared error surface.
  - **F2** — [x] Failed saves still close the modal and discard input
    (`crud-modal.tsx:130-137`) because page handlers swallow the error, so
    `onSubmit` never rejects.
  - **F3** — [x] Role-gating is absent in the UI. Accounts, COA, categories, budgets,
    goals and investments render full CRUD to every role while CASL restricts
    most of it to `owner` — the user fills a form and gets a 403. Also: a
    `member` can never create a budget, because the flow POSTs a category first
    and members only have `read Category`.
  - **F4** — [x] (already done, pre-existing) Uncaught Prisma constraint violations return 500.
    Duplicate account name (P2002), duplicate budget, COA in use (P2003) all
    surface as "Internal server error" instead of an explanatory 409.
  - **F5** — [x] Failed fetches render as successful empty states. `/mastercoa`
    ("Total Akun COA: 0"), `/dana` ("Total Dana Rp 0") and others have no
    `isError` branch — an API outage looks like an empty account.
  - **F6** — [x] Dead form fields across the app. Account edit renders Nama Bank /
    Nomor Rekening / Jenis that are never prefilled and never sent; `/akun`'s
    account form drops `isPrivate` (a privacy control) and `ownerUserId`; the
    e-wallet edit's provider select can silently rename an account; reference
    master-data groups open a full form and only reveal they are read-only after
    submit.
  - **F7** — [x] Category `kind` ↔ COA `direction` is unvalidated on both sides —
    an income category can be mapped to an EXPENSE COA account, and reports then
    classify its income as expense (`categories.service.ts:118-134`).

- [x] ### G — Responsive and modal layout pass ✅
  - **G1 (VERIFIED BLOCKER) — the warisan dialog becomes unusable on a phone once
    heirs are added.** Empty, it already fills 843 of 844px with **no internal
    scroll**. Measured at 390×844 after adding three heirs: the dialog grows to
    **1220px tall at `y = -188`** — the top is clipped, and "Simpan Aset Warisan"
    ends at `y = 1008`, i.e. **164px below the fold with no way to scroll to it**.
    A user who records more than one or two heirs cannot save. The same shape of
    risk applies to the insurance beneficiary editor and split-bill participants.
    Fix: give the dialog body `max-h-[85dvh] overflow-y-auto` — the `/asuransi`
    modal already does the right thing (full-screen _with_ internal scroll) and
    measures clean at both viewports.
  - **G2 — the onboarding welcome dialog blocks the whole app for a fresh
    session** (`fixed inset-0 z-50` overlay). Expected for a first-run tour, but
    it also blocks any deep link until dismissed; confirm it never re-appears for
    a returning user and that "Lewati" is always reachable.
  - **G3 — flag emoji render as tofu boxes** in the onboarding language picker on
    systems without an emoji-flag font. Use text labels or an inline SVG rather
    than depending on the host font stack.
  - Audit every dialog at 390×844 and 1440×900 with the Playwright harness
    (headless — no desktop required on this host) and fix: dialogs missing the
    `max-w-[N]` + `sm:max-w-[N]` pair, long forms (insurance beneficiaries,
    warisan heirs, split-bill participants) whose submit button can be pushed
    off-screen with no internal scroll, `grid-cols-*` without a mobile
    breakpoint, tables without an `overflow-x-auto` wrapper, and mobile bottom
    nav overlapping dialog actions.
  - Deliverable: `apps/web/tests/e2e/audit/ui-crawl.spec.ts` capturing per-route
    and per-modal screenshots plus console/network errors, kept as a regression
    harness.

## Open Design Decisions

1. **Goals: real money or honest tracker?** (gates A3, C9) — **DECIDED
   2026-08-04: honest tracker.** The phantom `type: transfer` transaction is
   removed; goals stay a manual target + progress figure, labelled as tracked
   separately from account balances. Real funding is deliberately out of scope
   and may become a later epic.
2. **Budget periods: implement or remove?** (gates C1) — **DECIDED 2026-08-04:
   implement.** The spend window must follow `budget.period` (weekly / monthly /
   yearly) in the service rather than always using the calendar month. Follow-on
   questions this raises — week start day, pro-rata on a mid-period create, and
   whether past periods are retained — are answered in group C with documented
   defaults (week starts Monday, no pro-rata, current period only) unless
   overridden.
3. **Zakat: implement haul or stop asserting?** (gates E1) — **DECIDED
   2026-08-04: keep the calculator, add the haul question.** Output is an
   estimate conditional on haul; `isObligated` requires nisab _and_ confirmed
   haul; nisab derives from the family gold price when set.
4. **Investment prices: keep the mock or gate the feature?** (gates D3)
   Recommendation: label every mock-derived figure as indicative (the pattern
   already used for FX and gold) and fix the tour copy; a real feed is a separate
   epic.
5. **Reporting timezone** (gates B7) — pin to `Asia/Jakarta` app-wide, or store
   and honour a per-family timezone? Recommendation: pin to WIB and disclose it.

## Acceptance Criteria

- No form collects a value the API discards; no form rejects input the label
  invites (A1, F6).
- No screen states an accounting identity it has not verified (B1), and no figure
  renders with the wrong sign (B2).
- Every mock or manually-maintained input is labelled as such wherever it is
  shown, including totals (D3, D5, E2).
- Server error messages reach the user; failed saves keep the user's input
  (F1, F2).
- Actions a role cannot perform are not offered to that role (F3).
- A failed fetch is visually distinct from an empty result (F5).
- Every dialog can be completed end-to-end at 390×844 without losing the submit
  button (G).
- Gates green: `scripts/qa.sh`, `scripts/test.sh`, `scripts/security-check.sh`.

## Test Plan

- **Unit:** budget window per period; goal status recomputation; the balance-sheet
  identity; cashflow sign formatting; sinking-fund vs amortisation formulas
  (golden values); nisab derived from the family gold price.
- **Integration:** category delete blocked or warned when budgets depend on it;
  private categories absent from a member's budget list; duplicate-name 409 shape.
- **E2E (Playwright, headless):** the `ui-crawl` harness at both viewports with
  zero console errors and zero unexplained 4xx/5xx; per-flow journeys for invite,
  budget create/edit, goal edit, cash-account negative balance round-trip.
- **Manual QA:** report numbers cross-checked against the transaction list for
  one month.

## Agent Routing

`code-agent` per task group; `ecc:typescript-reviewer` + `ecc:react-reviewer` on
every diff; `database-reviewer` for the cascade/constraint work (A5, F4);
`ecc:security-reviewer` for A6 and F3; `review-qa-agent` for the honest-UI
criteria. Gates via `test-agent` / `security-agent`; `deploy-agent` (DEV only).
Per task: `/task-work EPIC-022 <n>`.

## Done Signal

Each task group closes independently via `/task-work EPIC-022 <n>`. The epic
closes when the acceptance criteria hold across a fresh QA pass at both
viewports, and the `ui-crawl` harness reports zero console errors and zero
unexplained failed requests on every route.

## Automation Log

- 2026-08-04 — Epic created from a `/nerve` full-app audit. Six parallel agents
  read the UI and the API side by side across accounts/COA/categories,
  budgets/goals, reports pages, zakat/tax/calculators, and the
  assets/liabilities/insurance/investments surfaces; the family-invite defect was
  additionally reproduced live against the DEV API. Findings are grouped A–G by
  the kind of harm they do rather than by page, so the highest-harm work (money
  and truthfulness) is not queued behind cosmetics. Status set `on-progress`;
  five Open Design Decisions need human sign-off before their dependent groups
  start. No code changed.
- 2026-08-04 — Decisions 1, 2 and 3 signed off (goals = honest tracker; budget
  periods = implement; zakat = keep the calculator and add the haul question).
  Groups **A, B, E and G shipped** as PRs #226, #228, #225, #227, all merged to
  `development`. Four `code-agent`s ran in isolated worktrees, each followed by
  an adversarial reviewer instructed to disprove the fix rather than confirm it.
  That second pass earned its keep — **every group needed at least one more
  round, and the three worst defects of the wave were found by review, not by
  implementation**:
  - **The balance sheet never included investments.** `getBalanceSheet` queried
    only accounts, assets and liabilities, so `/laporan` under-reported net
    worth by the entire portfolio while `/ringkasan` and `/beranda` were right —
    under a green "Seimbang" banner. Found by asking why B1's identity check
    could not fail. Logged as B10; fixed via a shared `investmentPositionValue`
    used by both the dashboard rollup and the balance sheet, plus a
    cross-service parity spec.
  - **B1 was tautological twice.** First `totalLiabilities + netWorth` vs
    `totalAssets` (the API defines `netWorth = assets − liabilities`), then a
    client re-sum of `assets[]` vs `totalAssets` (the API computes that total by
    summing that same array). Now compared against `/dashboard/net-worth`, a
    genuinely separate service and query path, with `isBalanced: null` and no
    banner until both figures load.
  - **The mobile dialog fix was silently no-op'd where it mattered most.**
    `crud-modal.tsx` and `akun`'s category allow-list carried pre-existing `vh`
    caps that `tailwind-merge` correctly let win over the new `dvh` default, so
    the two dialogs most likely to overflow were exempt from their own fix.
    Also caught and fixed: investment values inflated by a factor of `quantity`
    (B9, live on `development` before this wave); legacy non-zakat rows flagged
    `isTaxDeductible` still cutting tax on every read (E5 read path + backfill);
    the retirement calculator using the loan-amortisation formula (E3, ~12×
    overstated); budget privacy filtering absent from create/update/remove and
    from transactions (A6); a check-then-act race on category delete, closed with
    Serializable isolation and a `P2034` → 409 mapping so the abort is honest
    rather than a bare 500; and `laporan-period.test.ts` passing only on a WIB
    machine (7 of 23 failed under `TZ=UTC`, which is what CI runs).
    Three stale hand-compiled `.js`/`.mjs` mirrors were deleted across the wave —
    Jest resolves `.js` before `.ts`, so they were shadowing real sources and
    hiding new exports from the gate runner.
    Gates green on every branch; CI green on all four PRs. Remaining in this
    epic: **C** (budget periods per decision 2, plus goal semantics), **D**
    (liabilities, investment lots, insurance premiums, asset history) and **F**
    (error surfacing, role gating, empty-vs-error states).
    Still unproven and deliberately stated: the `dvh` behaviour under mobile
    browser chrome cannot be demonstrated in headless desktop Chromium
    (`dvh === vh` there) — it needs WebKit or a real device.

- 2026-08-04 — **Live headless crawl completed** (Playwright/Chromium; this host
  has no desktop and none is needed): 22 routes × 2 viewports (1440×900 and
  390×844), 43 full-page screenshots, console + network capture, plus a modal
  geometry pass over 8 dialogs at both viewports.
  **The page-level surface is healthy** — no error banners, no horizontal
  overflow, no console errors beyond HTTP 429s caused by the audit's own request
  rate, and one `networkidle` timeout on `/investasi` (its price WebSocket never
  goes idle — a harness artifact, not a defect). Modal geometry measured clean on
  7 of 8 dialogs.
  **The crawl found one real deployment defect and one verified mobile blocker.**
  (a) DEV login was broken at crawl time: the running web container carried
  `BETTER_AUTH_URL=http://localhost:3000`, a value that exists only in
  `docker-compose.override.yml`, so the stack had been started without
  `-f docker-compose.yml` (most likely a `docker compose` run from an agent
  worktree with no repo-root `.env`). The browser bundle then called
  `localhost:3000` from the public origin and every sign-in was blocked by CORS.
  Fixed by redeploying through `scripts/deploy-dev.sh`; login verified working
  again. Worth a guard so it cannot recur silently. (b) G1 above.
- 2026-09-02 — Documentary QA audit (code vs. this log, no live DEV access
  from this sandbox; the repo has moved well past this log's 2026-08-04
  date — EPIC-023/024/027 have since landed and file paths moved, e.g.
  `apps/web/components/...` → `apps/web/src/components/...`).
  **A, B, E, G — confirmed done**, no contradictions between this log and
  the code (invitation `role`/`relationship` fields, balance-sheet's
  `/dashboard/net-worth` cross-check, investments now counted in
  `getBalanceSheet`, sinking-fund `projectedValue`, and the dialog
  `vh`-override removal all spot-checked directly).
  **C — genuinely still open**, matching this log: `budgets.service.ts`
  still computes a hardcoded month window regardless of `budget.period` —
  no `weekly`/`yearly` period-aware windowing exists anywhere in that file.
  **D — this log is stale in D's favour, not against it**: D1 (liabilities
  edit/delete/pay) and D4 (insurance payment moves real money) are **done**,
  merged under EPIC-024/025/026, not credited here. D2 (investment
  lot/buy-sell/realized P&L) is confirmed **still open** —
  `schema.prisma`'s `Investment` model still has one mutable
  `quantity`/`costBasisPerUnit`, no lot model exists.
  **F — worse than "not started", and mixed even where marked done**:
  F1's shared error-surface hook (`use-api-error.ts`) exists but has **zero
  callers** — 12 page files each duplicate their own
  `extractApiErrorMessage` instead, and `tujuan/page.tsx` still discards
  the server's real message on a bare `catch`. F2's `CrudModal` fix (stay
  open on a failed save) is real, but `rekening/page.tsx` swallows its own
  error internally before `CrudModal` ever sees it, so the modal still
  closes there on a failed save. F3 (role-gating in the UI) is confirmed
  still open — no `can(`/`myRole` gating anywhere in `anggaran/page.tsx`.
  F4 (Prisma-constraint → 409 mapping) is **more done than credited**:
  `P2002`/`P2003`/`P2034` are all handled with tests. F6 is partially done
  for accounts only.
  **Net: 4 of 7 groups (A, B, E, G) done; C fully open; D and F are each a
  real mix of done-elsewhere and still-broken, worse for F than this log's
  own "remaining: D, F" line implies.** Status unchanged (`on-progress`) —
  this is accurately reflected, not a case for `ready-for-qa`. Next
  actionable work, in the order a reviewer should pick it up: fix F1's dead
  hook (wire it into the 12 duplicated call sites, starting with
  `rekening/page.tsx` and `tujuan/page.tsx` since those two demonstrably
  still swallow real server errors), then C1's period-aware budget window,
  then D2's investment lot model.
