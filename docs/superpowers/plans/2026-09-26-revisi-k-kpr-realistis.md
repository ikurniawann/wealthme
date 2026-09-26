# Revisi K — KPR Realistis (tiered fixed, floating history, schemes, prepayment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The client asked: "Perhitungan KPR harus disesuaikan: kadang bunga fix, kadang floating sesuai kebijakan bank pemberi KPR; sesuaikan dengan use case nyata di Indonesia dengan data 2026." This plan makes KPR interest match how Indonesian mortgages are really sold in 2026. It covers five things: (a) tiered rate periods (an ordered list of fixed tiers, then floating); (b) a floating-rate history the user records, with the installment re-annuitised from each change; (c) scheme presets (FLPP, konvensional, berjenjang, syariah murabahah, syariah MMQ/ijarah) whose example numbers are visibly labelled as examples; (d) early repayment — simulated first, then **recorded** (full or partial, reduce-tenor or reduce-installment, with a penalty); (e) manual rate input on every period. It also unifies the due-day rule — with a 5-day grace window, on the WIB calendar — so the Pay "Cicilan" preset and the installment `pay()` books are always the same installment, marked "Telat" when late.

**Architecture:**

- **Engine.** A new pure module `rate-plan.util.ts` models a KPR as `RatePlan = { segments, floatingChanges }`. `amortisation.util.ts`'s single `buildSchedule` is generalised from G's "recompute once when the fixed period ends" to "re-annuitise the remaining balance over the remaining tenor whenever the rate regime changes". A regime changes at a segment boundary or at a recorded floating change.
- **One source of rates.** The schedule, the pay split, the payment preview, `currentInstallment`, the budget line and the new prepayment simulator all read rates through `rateAt(ratePlanOf(input), period)`. No installment or interest math is duplicated.
- **Storage.** Three new tenant-scoped child tables hold the data: `liability_rate_periods`, `liability_floating_rates` and `liability_prepayments`. They are joined by `liabilities.installmentFromPeriod` and `transactions.liabilityPrepaymentId`.
- **Legacy rows.** A read-time adapter (`legacyRatePlan`) presents G's `fixedRateMonths` + `floatingRate` as a two-segment plan, so existing rows are neither migrated nor changed. That adapter provably reproduces G's golden schedules: G's untouched `amortisation.util.spec.ts` stays green.
- **One due installment.** `dueInstallment(akad, now, tenor)` returns the installment being paid today: the latest one due while it is at most 5 days late, otherwise the next, on the WIB calendar day. The schedule's first row, the Pay preset (`currentInstallmentAmount`), the period `pay()`/preview book, and the budget line all use it.
- **Prepayment.**
  - `GET :id/prepayment-preview` simulates by running `buildSchedule` before and after the prepayment.
  - `POST :id/prepay` records the same computation. It debits the source account through the pay path's overdraft guard and books the principal (TRANSFER, a dedicated category, never the budget line's) and the penalty (EXPENSE, new COA `20011`).
  - It persists the new installment and tenor with `installmentFromPeriod`, so the schedule, Pay preset and budget line follow.
  - It is idempotent per `idempotencyKey`, and exempt from the one-installment-payment-per-month guard.

**Tech Stack:**

- API: NestJS 11, Prisma 6.19 (PostgreSQL), class-validator/class-transformer, Jest + ts-jest, supertest.
- Web: Next.js 16 App Router, React 19, TanStack Query, Jest + Testing Library.
- Shared types: `@wealthme/contracts`. Workspace: pnpm.

**Spec / research:** The client requirement quoted in the Goal, plus `docs/research/2026-09-26-kpr-indonesia.md` (read it fully before Task 1). Every number below that comes from it is cited as **[R§n]**. The plan builds on sub-plan G (`docs/superpowers/plans/2026-09-25-revisi-g-liabilitas-bunga.md`, merged into this branch) and stays compatible with sub-plan I (`docs/superpowers/plans/2026-09-26-revisi-i-multi-currency.md`, in progress on this branch).

## Global Constraints

- **Workspace.** Work only in the worktree `/home/wit/WORK/vibes/wealthme-web-revisi-g` on branch `feat/revisi-i-multi-currency`.
- **Concurrent agent (sub-plan I).** Another agent is concurrently editing the web money forms on this branch.
  - Before every task, run `git pull --rebase` or `git log -1` and check `git status`.
  - Never touch amount inputs in `LiabilityModal` or `PayLiabilityDialog`. K's web edits are limited to the KPR rate block, the Detail dialog's schedule, and new files.
  - If `page.tsx` has uncommitted changes that are not yours, stop and report instead of editing.
- **Protected files (never edit):** `apps/web/src/app/globals.css`, `apps/web/src/app/design-system.css`, `apps/web/src/lib/*`, `apps/web/src/components/ui/*`, `apps/web/src/components/wm/*`, `apps/web/src/components/charts/*`, `apps/web/src/components/shell/*`, `apps/web/src/app/layout.tsx`, `packages/config/*`.
- **i18n.** Every new user-visible string goes into **all three** of `apps/web/src/i18n/types.ts`, `id.ts` and `en.ts`, under `liabilitas.kpr` (dictionaries use `satisfies I18nDictionary`).
- **Controllers.** DTO classes used by `@Body()`/`@Query()` are value imports preceded by `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`. Services injected through constructors follow the same rule.
- **Never run `eslint --fix` on an API service, controller or module file.** It rewrites DI imports to `import type` and breaks Nest boot while the specs stay green (project memory: "eslint --fix breaks Nest DI"). Fix lint by hand.
- **Money and rates.** Money is BigInt on the API and a digit string on the wire. Rates are `Decimal(5,2)` strings parsed with `parseRateScaledByHundred`. All math is BigInt with round-half-up; never `Number`/`parseFloat` in API math.
- **Rate bounds.** Rates are accepted from `0` to `30.00` % (`MAX_KPR_RATE_PERCENT`). The prepayment penalty is accepted from `0` to `10.00` %.
- **Migrations.**
  - Migrations are additive only. The new migration folder must sort after the latest one on the branch. Re-run `ls apps/api/prisma/migrations` before Tasks 5 and 9; if something newer than `20260926090000_revisi_i_fx_rates_and_conversions` exists, bump K's timestamp past it.
  - Never hand-apply DDL with psql (project memory: "Never hand-apply DDL"). Migrations reach databases only through `prisma migrate deploy`.
  - After a schema change, run `pnpm exec prisma generate` from `apps/api`.
- **Contracts.** `packages/contracts/dist` is committed. After editing `packages/contracts/src`, run `pnpm --filter @wealthme/contracts build` and `git add packages/contracts/dist`, or the web build dies.
- **Sub-plan I compatibility.**
  - Rate periods and floating history are percentages, not money.
  - The **preview** amount is a read-only query parameter and is IDR-only by design: I's `fxInputs` audits writes, not simulations.
  - The **recorded** prepayment amount is persisted money that debits an account, so it gets an fx spec: `FX_FIELD_SPECS.liabilityPrepayment = { amount: { kind: "digits", positive: true } }`. `POST :id/prepay` runs through `fxInputs.run(... fieldPrefix: "prepay")`, exactly like `pay`.
  - The penalty is derived server-side from the (converted) IDR principal, so it needs no spec.
  - The web simulator stays IDR-only: the loan is IDR, and API clients can still send `fxInputs`.
  - The existing `fxInputs.run(...)` wrappers on create/update/pay stay as they are.
- **Tests.** Run only the focused jest commands each task names. No `next build`, no full `turbo` runs.
- **Lint.** Every touched file must pass `pnpm exec eslint <files>` (exit 0), run from the owning app directory.
- **Commits.** Use Conventional Commits. End each message with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
  ```
- **Comments.** No code comments unless the WHY is non-obvious, and then one line at most.
- **Husky.** The post-commit hook may print "post-commit script failed (code 1)" (graphify). The commit still lands. Never use `--no-verify`.
- **UI tasks (11, 12, 13).** Invoke the `taste-skill:taste-skill` skill before writing TSX and follow its pre-flight. Reuse the page's existing classes (`.field`, `.label`, `.input`, `.select`, `.hint`, `.notice notice--info|warning`, `.badge badge--info|warning`, `.btn btn--outline|ghost btn--sm`, `.table table--num`). Add no new CSS.
- **Honest UI.**
  - Every preset rate that is not official is shown with a "Contoh" badge next to it. A notice tells the user to check it against their bank's offer letter (SP3K). Official FLPP figures get a "Resmi" badge.
  - Floating schedule rows carry an "Estimasi" badge.
  - The prepayment panel labels its numbers as a simulation until the user confirms "Catat pelunasan". The confirmation states the exact debit (principal + penalty).

## Key design decisions (read before coding)

1. **Legacy G rows are handled by a read-time adapter, not a backfill.**
   - The adapter is `legacyRatePlan(interestRate, fixedRateMonths, floatingRate)`, used when a liability has no `liability_rate_periods` rows.
   - Why not a backfill:
     - It would duplicate the truth into two places: the G columns, plus new rows that must be kept in sync or dropped (not additive).
     - It would rewrite every KPR row on deploy.
     - It would change nothing numerically, because the adapter reproduces G's golden schedules exactly (proved in Task 2 by keeping G's `amortisation.util.spec.ts` untouched and green, plus an explicit "legacy terms = explicit plan" test).
   - A legacy row upgrades lazily: the first time it is saved through the new form, the server writes period rows and nulls `fixedRateMonths`/`floatingRate`. Because the periods are equal to the old pair, the stored (possibly user-overridden) installment is kept (Task 6b test).
2. **Rate regime and re-annuitisation.** Installment `k` accrues at `rateAt(plan, k)`.
   - `anuitas` schedules re-annuitise (`computeInstallment` on the current balance over the remaining months) at every row whose regime (segment index + applied floating change) differs from the previous row. This matches the research: "the bank recalculates the installment using the current outstanding principal and the remaining tenor" **[R§3]**.
   - On the first projected row, a re-annuitisation happens when that row's regime differs from the **anchor** period's regime. The anchor is `installmentFromPeriod ?? 1`: the period the stored installment was computed for. With no anchor this is G's behaviour (a schedule starting past the fixed period re-annuitises). A recorded prepayment sets the anchor to its period, so a reduce-tenor installment is not silently re-annuitised in a floating regime (Task 2 "installmentAnchorPeriod" test: 4.869.889 kept vs 4.857.320 without the anchor).
3. **When a floating change takes effect — the whole-month rule.** Installment `k` accrues over `[akad + (k−1) months, akad + k months)`, and there is no daily proration: monthly rest **[R§3]**, marked uncertain there, so we pick the simplest honest rule.
   - A rate whose effective date falls **on** a window start applies to that installment.
   - A **mid-window** date applies from the next installment. So `effectivePeriodFor(akad 2026-01-15, 2031-01-15) = 61` and `(…, 2031-01-20) = 62`.
   - A change recorded while the loan is still in a fixed tier is stored, and bites at the first floating period (it is the bank rate in force when floating starts).
   - Fixed tiers ignore recorded changes.
4. **Unified due day with a 5-day grace window (user decisions).** One function, `dueInstallment(akad, now, tenor)` (Task 3), returns `{ period, late }`: the installment being paid today. Installment `k` falls due `k` months after the akad.
   - From its due day through **5 days late**, `k` is still the installment being paid, at its own (possibly older tier) rate. `late` is true from day +1.
   - From day +6, the installment being paid is `k + 1`.
   - The result is clamped to `[1, tenor]` (past maturity it is `late`), and is `1` without an akad date.
   - Days are the **WIB (Asia/Jakarta, UTC+7) calendar day** of `now`, compared with the akad's stored calendar date. A payment at 00:00–07:00 WIB is not a day off. There is no per-family timezone yet; revisit when one exists.
   - The schedule's first row, `currentInstallmentAmount` (the Pay "Cicilan" preset), the rate `pay()`/`payment-preview` book, and the budget line all use this one number. `LiabilityDto.currentInstallmentLate` makes the Pay dialog show "Telat" during the grace window (Task 12).
   - This replaces G's `settledPeriod = max(1, monthsElapsed)` / `firstPeriod = monthsElapsed + 1`, which disagreed on due days and near tier boundaries.
   - Right after `pay()` settles `k`, the budget line is re-derived for `k + 1` (dated loans only).
   - Residual, by design: we do not track which installment was paid. On a day inside the window **after** paying, `currentInstallmentAmount` still shows `k`, re-annuitised on the reduced balance. Pay is disabled then anyway (`paidThisPeriod`).
   - Known G quirk kept: `monthsElapsed` compares day-of-month, so an akad on the 29th–31st counts short months late.
5. **Early repayment is recordable (user decision).**
   - **Preview.** The preview (`GET :id/prepayment-preview`) and the recording (`POST :id/prepay`) run the same `simulatePrepayment` on the same state, so the recorded numbers equal the previewed ones for the same day.
   - **Recording, in one Serializable transaction:**
     - Debit the source account by principal + penalty (the same `assertBankNotOverdrawn` as `pay()`).
     - Insert a `liability_prepayments` row.
     - Decrement `remainingBalance` by the principal.
     - Persist the new terms:
       - reduce-installment → new `installmentAmount`/`minimumPayment`, `installmentFromPeriod = d`;
       - reduce-tenor → `tenorMonths = d − 1 + n′`, installment kept, `installmentFromPeriod = d`;
       - full → `minimumPayment = 0` (the budget line is removed).
     - Post two transactions, both linked by `liabilityId` + `liabilityPrepaymentId`:
       - the principal as a TRANSFER on a dedicated family category "Pelunasan Dipercepat Pinjaman" (group-5 COA). It is deliberately **not** the liability's own principal category, so the extra principal never shows as overspending the monthly installment budget line.
       - the penalty as an EXPENSE on a category backed by the new COA `20011` "Penalti Pelunasan Pinjaman". This follows the "never reuse a catch-all code for automatic behaviour" precedent of 20009/20010; the migration backfills the COA account for existing families.
     - Re-sync the budget line.
   - **Corrections after a prepayment (judge fix).** A term-changing PATCH on a prepaid (anchored) loan must not fall back to G's contract installment (`totalDebt` over the possibly shortened tenor).
     - Task 9 re-annuitises the remaining balance from the installment now due, through the shared engine, and moves the anchor there.
     - If that is impossible (not anuitas, or no tenor), the PATCH is refused with 400.
   - **Guard exception.** `assertNotAlreadyPaidThisPeriod` and `paidThisPeriod` ignore rows with a `liabilityPrepaymentId`. A prepayment never blocks, or counts as, the month's installment. Prepayments are not limited per month.
   - **Idempotency.** `idempotencyKey` (UUID, generated by the client once per simulation) is unique per liability. A repeated or concurrent submit returns the first record with `replayed: true`. A concurrent loser hits P2002, is retried by `runSerializableWithRetry`, and then finds the winner.
   - **Protected rows.** Prepayment transactions carry `liabilityId`, so `TransactionsService` already refuses to edit or delete them (C4). Corrections go through the liability PATCH, as for `pay()`.

6. **Scheme presets live in the web.** They sit in `apps/web/src/app/(app)/liabilitas/kpr-presets.ts` as prefill data only. The server stores `kprScheme` as a label and enforces only structural rules:
   - FLPP and murabahah must be a single fixed period for the full tenor.
   - FLPP tenor is at most 480 months **[R§4]**.

   Rates are never forced, so the user can override any period (requirement e).

7. **Preset numbers and their sources** (research date 2026-09-26):

   | Preset (`KprPresetId`) | Periods                                                    | Label                                         | Source                                                                           |
   | ---------------------- | ---------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
   | `flpp_tapak`           | fixed 5.00 % full tenor, tenor ≤ 480                       | **Resmi**                                     | Kementerian PKP / Kepmen 1722/KPTS/M/2026 **[R§4]**                              |
   | `flpp_rusun`           | fixed 6.00 % full tenor, tenor ≤ 480                       | **Resmi**                                     | same **[R§4]**                                                                   |
   | `konvensional`         | fixed 36 bln 2.75 %, then floating 11.00 %                 | Contoh                                        | BCA 2026 promo fixed 3 th 2.75 %, current floating ~11 % **[R§1, R§2]**          |
   | `berjenjang`           | fixed 24 bln 3.50 %, fixed 12 bln 5.50 %, floating 11.00 % | Contoh                                        | client's own example; floating ~11 % **[R§2]**                                   |
   | `syariah_murabahah`    | fixed margin 6.00 % full tenor                             | Contoh                                        | fixed-margin range 4.5–6 % (unverified primary) **[R§5]**                        |
   | `syariah_mmq`          | fixed 12 bln 3.30 %, then floating 11.00 %                 | Contoh + "no public syariah reset index" note | BSI ~3.3 % year 1 (unverified primary) **[R§5]**; no reset index found **[R§7]** |
   | `manual`               | one empty fixed period                                     | —                                             | —                                                                                |

   Default prepayment penalty: **1.00 %**, labelled as an example and editable. The research gives 1–3 % as common and up to 7 % **[R§6]**.

## Review Focus

1. **Boundary months between periods (the G off-by-one class).**
   - For a berjenjang loan (24 @ 3.50, 12 @ 5.50, floating 11.00, akad 2026-01-15), period 24 is tier 1 and period 25 is tier 2 in every consumer.
   - Schedule rows 24 and 25 are Rp 2.899.799 and Rp 3.390.269; row 37 is Rp 4.869.888.
   - Unified due day with 5-day grace (akad 2026-01-15), for payments and previews:
     - 2028-01-14 (the day before #24), 2028-01-15 (#24's due day) and 2028-01-20 (5 days late, "Telat") book #24 at 3.50 % (interest 1.353.973 on 464.219.240).
     - 2028-01-21 (day +6) and 2028-02-15 book #25 at 5.50 % (interest 2.127.672).
     - The Pay preset agrees: Rp 2.899.799 on 2028-01-15/20 (late on the 20th), Rp 3.390.269 on 2028-01-21.
   - G legacy pair (8 % × 36, then 11 %), late tier-boundary payment:
     - Paying 4.182.200 on 2029-01-20 (#36, 5 days late) books 8 % (interest 3.103.938, principal 1.078.262).
     - The budget line moves to #37 at 11 % over 204 months: **5.041.728**.
     - On 2029-01-21 the preset is #37, 5.053.432 (interest 4.267.915).
   - WIB: 2028-01-20T16:59:59Z is still #24; 2028-01-20T17:00Z (00:00 WIB on day +6) is #25.
   - Tests: Task 1, "segment boundaries"; Task 2, "berjenjang 500 jt…"; Task 3, `dueInstallment` ×12 plus "preset = booked" ×6 and the late pay; Task 6a, "boundary: …" ×5 and "Pay preset …" ×3; Task 12, Pay "Telat".
2. **Rate change mid-month versus the installment date.**
   - A change effective 2031-01-15 applies from installment 61; one effective 2031-01-16 or 2031-01-20 applies from 62.
   - A change recorded during a fixed tier applies only at 37.
   - Two changes landing on the same period: the later date wins.
   - Tests: Task 1, "effectivePeriodFor"; Task 2, "mid-month change"; Task 6a, `ratePlanFromRows` "same-period dates".
3. **Past tenor / overdue.** Past maturity with Rp 1.000.000 left and a recorded change to 9.75 %, there is exactly one payoff row: Rp 1.008.125 (interest 8.125). A floating change dated so late that it affects no installment is refused with 400. `dueInstallmentPeriod` clamps to the last installment. Tests: Task 2, "past tenor"; Task 3, "past maturity"; Task 7, "past maturity".
4. **0 % promo period.** At 0 % for 12 bln, then 10 % floating, on 120 jt / 120 bln:
   - Installments 1–12 are Rp 1.000.000 with 0 interest.
   - Row 13 re-annuitises to Rp 1.520.498, and the last row is Rp 1.520.511.
   - No division by zero.
   - Test: Task 2, "0% promo".
5. **Murabahah flat-installment equality.** 300 jt / 6.00 % / 180 bln:
   - Rows 1–179 are all exactly Rp 2.531.570.
   - The last row absorbs rounding: Rp 2.531.721.
   - Total paid (the "harga jual" equivalent) is Rp 455.682.751.
   - The server refuses a floating period on murabahah/FLPP.
   - Tests: Task 2, "murabahah"; Task 5, validation "murabahah with a floating tail".
6. **Prepayment golden numbers.** 400 jt left, 180 bln, 11.00 %, installment 4.546.388:
   - Prepaying 100 jt with 1 % penalty (Rp 1.000.000):
     - Reduce-installment: new installment Rp 3.409.791, tenor stays 180, interest saved Rp 104.587.451.
     - Reduce-tenor: installment kept, tenor 180 → **102**, interest saved Rp 255.703.278.
   - On berjenjang at period 13, reduce-tenor still steps up at 25 and 37 (196 months, new tenor 208).
   - **Recorded == previewed:**
     - Reduce-installment persists installment 3.409.791 from #61.
     - Reduce-tenor persists tenor 162 with 4.546.388 kept, and the schedule read back afterwards has 102 rows.
     - Full with 2.5 % debits 410.000.000 and removes the budget line.
   - Tests: Task 4; Task 10 "recordPrepayment".
7. **Penalty rounding.** Round-half-up to the rupiah: 1 % of 12.345.650 = **123.457**; of 12.345.649 = 123.456; 1.25 % of 33.333.333 = 416.667. Test: Task 4, "prepaymentPenalty"; the recorded `penaltyAmount` equals it (Task 10).
8. **Legacy rows unchanged.**
   - G's `amortisation.util.spec.ts` passes unmodified.
   - The only edits to `liabilities.service.spec.ts` / `liabilities.controller.spec.ts` are: the new mock delegates; the new routes in the guard arrays; and the one explicitly listed due-day line in Task 3 (the shared `FLOATING_INSTALLMENT` constant in "current installment after the KPR fixed period (final fix 2)": `tenorMonths` 203 → 204, because 2029-02-20 is inside #37's grace window).
   - No migration touches existing rows.
   - A legacy KPR saved through the new form keeps its overridden installment.
   - Tests: Task 2, full `src/liabilities` run; Task 6b, "legacy upgrade".
9. **Tenant scoping and ability on floating history.**
   - Every query filters `familyGroupId` (loads, deletes, duplicate checks).
   - GET needs `read Liability`; POST/DELETE need `manage Liability`.
   - dependant/operational/anonymous are refused.
   - The same holds for `POST :id/prepay` (`manage Liability`): the source account and the idempotency lookup are family-scoped.
   - Tests: Task 7 guard spec and service "other family"; Task 10 PERMISSION/DENIAL and "other family".
10. **Prepayment safety.**
    - A double submit posts once (web button disabled while pending plus server idempotency); a concurrent duplicate becomes a replay, not a 500 or a second debit.
    - A prepayment never trips or satisfies the monthly installment guard.
    - The bank overdraft floor applies to principal + penalty.
    - The fx-converted amount is audited as `Liability prepay.amount`.
    - Tests: Task 10 ("replay", "concurrent", "guard exception", "overdraft", fx wiring); Task 9 ("prepayment rows are ignored by the installment guard"); Task 13 ("posts once").
11. **Term corrections after a prepayment (judge HIGH).**
    - On the berjenjang loan prepaid to tenor 166 (4.869.889 anchored at #61), a tenor correction to 180 must write **4.524.568** (328.462.235 over 120 months at 11 %), and a floating correction to 10.50 % must write **4.767.352** (106 months). Never G's `totalDebt`-based contract installment.
    - The budget line follows.
    - A switch to flat on a prepaid loan is refused.
    - Tests: Task 9 "…re-annuitises what is left…" ×2 and "…is refused".
12. **Orphaned floating history (judge MEDIUM).** A PATCH that would leave recorded floating changes without a floating period, or that switches the loan off anuitas, is refused with the same 400 as `validateRatePeriods`. Tests: Task 6b "orphaned history"; Task 5 validation "dropping floating while history exists".

## Out of scope (deliberately untouched)

- **Per-installment paid tracking.** See the decision 4 residual. The monthly calendar guard is unchanged.
- **Prepayment history list/undo UI.** Rows are protected ledger entries; corrections go through the liability PATCH, as for `pay()`.
- **Interest accrued between the last installment and the prepayment date.** Monthly rest is assumed, and the preview says so **[R§3]**.
- **A floating change recorded later with an effective period at or before a prepayment's anchor.** It does not re-annuitise the anchored installment. Record rate notices before prepayments.
- **Fees** (provisi 1 %, admin, appraisal, roya): these are one-off costs, not interest math. Several are unverified primary **[R§6]**.
- **Floating caps**, which were not found in the 2026 market **[R§1]**. SBDK auto-fetch from `data.ojk.go.id` **[R§2]** — the user records bank notices manually (requirement b).
- **Other readers of `liabilities`** (`dashboard`, `reports`, `ai-advisor`, `billing-cycle`) keep reading balances only. The penalty expense reaches reports through the ordinary expense ledger.
- **Daily-rest interest accrual** — research uncertainty 2 **[R§ Uncertainties]**; monthly rest is assumed (decision 3).

## Resolved questions (user decisions, 2026-09-26)

1. **Due day.** Unify the Pay preset and `pay()` on one installment, with a 5-day grace window ("Telat") on the WIB calendar (decision 4, Task 3).
2. **Prepayment.** Recordable in K (decision 5, Tasks 9, 10, 13).

## File Map

| File                                                                                                                                                                                                    | Responsibility                                                                                                                                                                                          | Tasks                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `apps/api/src/liabilities/rate-plan.util.ts` (+ `.spec.ts`)                                                                                                                                             | Pure plan model: segments, `rateAt`, regimes, legacy adapter                                                                                                                                            | 1                      |
| `apps/api/src/liabilities/amortisation.util.ts`                                                                                                                                                         | `effectivePeriodFor`, `ratePlanOf`, plan-aware `buildSchedule` (+ `installmentAnchorPeriod`), `dueInstallment`/`dueInstallmentPeriod`/`localCalendarDay`/`DUE_GRACE_DAYS`, exported `roundHalfUpDivide` | 1, 2, 3                |
| `apps/api/src/liabilities/amortisation.rate-plan.spec.ts`, `amortisation.due-installment.spec.ts`                                                                                                       | K golden schedules; due-day rule (G's spec stays untouched)                                                                                                                                             | 2, 3                   |
| `apps/api/src/liabilities/prepayment.util.ts` (+ `.spec.ts`)                                                                                                                                            | Penalty, months-to-payoff, before/after simulation plus the terms to persist                                                                                                                            | 4, 8                   |
| `apps/api/prisma/schema.prisma` + `migrations/20260926120000_revisi_k_kpr_rate_plans`, `migrations/20260926130000_revisi_k_liability_prepayments`                                                       | Rate-plan tables; prepayment table, `installmentFromPeriod`, `transactions.liabilityPrepaymentId`, COA 20011 backfill                                                                                   | 5, 9                   |
| `packages/contracts/src/coa/index.ts` + `apps/api/src/common/coa/default-coa-chart.spec.ts`                                                                                                             | COA `20011` Penalti Pelunasan Pinjaman in `GENERIC_COA_CHART`                                                                                                                                           | 9                      |
| `apps/api/src/liabilities/rate-plan.validation.ts` (+ `.spec.ts`)                                                                                                                                       | Period/scheme/rate validation (400s)                                                                                                                                                                    | 5                      |
| `apps/api/src/liabilities/dto/*` (`rate-period`, `create-floating-rate`, `prepayment-preview-query`, `record-prepayment`, `create/update-liability`, `liability-response`, `create-liability.dto.spec`) | Wire validation + response classes                                                                                                                                                                      | 5, 7, 8, 10            |
| `packages/contracts/src/liabilities/index.ts` (+ committed `dist/`)                                                                                                                                     | Web types                                                                                                                                                                                               | 5, 10                  |
| `apps/api/src/liabilities/rate-plan.rows.ts` (+ `.spec.ts`)                                                                                                                                             | Tenant-scoped load (6a) / replace (6b) of K rows; rows → `RatePlan`                                                                                                                                     | 6a, 6b                 |
| `apps/api/src/liabilities/liabilities.service.ts` + `liabilities.service.rate-plan.spec.ts`                                                                                                             | Due day; readers (6a); writers + orphan check (6b); prepayment persistence, re-anchoring, recording                                                                                                     | 3, 5, 6a, 6b, 8, 9, 10 |
| `apps/api/src/liabilities/liabilities.service.spec.ts`                                                                                                                                                  | Due-day boundary tests + the one listed G constant change (Task 3); two mock delegates (Task 6a)                                                                                                        | 3, 6a                  |
| `apps/api/src/liabilities/liability-floating-rates.service.ts` + `.controller.ts` + specs, `liabilities.module.ts`                                                                                      | Floating history CRUD + budget resync                                                                                                                                                                   | 7                      |
| `apps/api/src/liabilities/liabilities.controller.ts` + `.spec.ts`                                                                                                                                       | `GET :id/prepayment-preview`, `POST :id/prepay`                                                                                                                                                         | 8, 10                  |
| `apps/api/src/fx/fx-field-specs.ts` + `fx-wiring-holdings.spec.ts`                                                                                                                                      | `liabilityPrepayment` fx spec                                                                                                                                                                           | 10                     |
| `apps/web/src/app/(app)/liabilitas/kpr-presets.ts` (+ `.test.ts`), `kpr-rate-periods-field.tsx`, `api-error.ts`                                                                                         | Presets, editor, shared error helper                                                                                                                                                                    | 11                     |
| `apps/web/src/app/(app)/liabilitas/schedule-rate-cell.tsx`, `kpr-floating-rates-panel.tsx` (+ test)                                                                                                     | Detail: rate column, floating history                                                                                                                                                                   | 12                     |
| `apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.tsx` (+ `.test.tsx`)                                                                                                                        | Simulator (12), "Catat pelunasan" (13)                                                                                                                                                                  | 12, 13                 |
| `apps/web/src/app/(app)/liabilitas/page.tsx` + `liabilitas.test.tsx`                                                                                                                                    | Modal seam, Detail seam, Pay "Telat" seam, `onRecorded` wiring                                                                                                                                          | 5, 11, 12, 13          |
| `apps/web/src/app/(app)/anggaran/obligations-section.test.tsx`                                                                                                                                          | Fixture gains new required fields                                                                                                                                                                       | 5                      |
| `apps/web/src/i18n/{types,id,en}.ts`                                                                                                                                                                    | `liabilitas.kpr.*` strings                                                                                                                                                                              | 11, 12, 13             |

All golden numbers in this plan were produced by a standalone BigInt reference implementation of the engine below. The pure API code was itself executed against G's untouched spec plus every new pure spec in this plan: 109/109 passing. That covers Tasks 1, 2, 3's `dueInstallment`, 4, 5's validation and 6a's `ratePlanFromRows`.

---

### Task 1: Rate plan model + `effectivePeriodFor` (pure)

**Files:**

- Create: `apps/api/src/liabilities/rate-plan.util.ts`
- Create: `apps/api/src/liabilities/rate-plan.util.spec.ts`
- Modify: `apps/api/src/liabilities/amortisation.util.ts` (add `effectivePeriodFor` right after `monthsElapsed`, ~line 207)

**Interfaces:**

- Consumes: `monthsElapsed(start: Date, now: Date): number` (existing, amortisation.util).
- Produces (exported from `./rate-plan.util`; this module imports nothing):
  - `type RatePeriodKind = "fixed" | "floating"` (string-identical to the Prisma enum added in Task 5).
  - `interface RateSegment { kind: RatePeriodKind; months: number | null; ratePercent: string }` — `months: null` only on the last segment.
  - `interface FloatingRateChange { effectivePeriod: number; ratePercent: string }`.
  - `interface RatePlan { segments: RateSegment[]; floatingChanges: FloatingRateChange[] }`, where `floatingChanges` is sorted by `effectivePeriod`.
  - `interface ResolvedRate { ratePercent: string; kind: RatePeriodKind; segmentIndex: number; changeIndex: number }`.
  - Functions:
    - `legacyRatePlan(baseRatePercent: string, fixedRateMonths: number | null, floatingRatePercent: string | null): RatePlan`
    - `segmentStartPeriods(plan): number[]`
    - `segmentIndexAt(plan, period): number`
    - `rateAt(plan, period): ResolvedRate`
    - `sameRateRegime(a: ResolvedRate, b: ResolvedRate): boolean`
    - `hasFloatingSegment(plan): boolean`
- Produces, in `./amortisation.util`: `effectivePeriodFor(startDate: Date, effectiveDate: Date): number` (whole-month rule, decision 3).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/liabilities/rate-plan.util.spec.ts`:

```ts
import { effectivePeriodFor } from "./amortisation.util";
import {
  hasFloatingSegment,
  legacyRatePlan,
  rateAt,
  sameRateRegime,
  segmentIndexAt,
  segmentStartPeriods,
  type RatePlan,
} from "./rate-plan.util";

// Berjenjang: 3.50% yr 1-2, 5.50% yr 3, floating 11.00% after.
const BERJENJANG: RatePlan = {
  segments: [
    { kind: "fixed", months: 24, ratePercent: "3.50" },
    { kind: "fixed", months: 12, ratePercent: "5.50" },
    { kind: "floating", months: null, ratePercent: "11.00" },
  ],
  floatingChanges: [],
};

describe("rate plan — revisi K", () => {
  it("segment boundaries: 24 is tier 1, 25 is tier 2, 36 is tier 2, 37 floats", () => {
    expect(segmentStartPeriods(BERJENJANG)).toEqual([1, 25, 37]);
    expect(
      [1, 24, 25, 36, 37, 240].map((p) => segmentIndexAt(BERJENJANG, p)),
    ).toEqual([0, 0, 1, 1, 2, 2]);
    expect(rateAt(BERJENJANG, 24).ratePercent).toBe("3.50");
    expect(rateAt(BERJENJANG, 25).ratePercent).toBe("5.50");
    expect(rateAt(BERJENJANG, 37)).toEqual({
      ratePercent: "11.00",
      kind: "floating",
      segmentIndex: 2,
      changeIndex: -1,
    });
  });

  it("a recorded floating change applies from its effective period, never inside a fixed tier", () => {
    const plan: RatePlan = {
      ...BERJENJANG,
      floatingChanges: [
        { effectivePeriod: 10, ratePercent: "10.25" },
        { effectivePeriod: 61, ratePercent: "9.75" },
      ],
    };
    expect(rateAt(plan, 10).ratePercent).toBe("3.50");
    expect(rateAt(plan, 37)).toEqual({
      ratePercent: "10.25",
      kind: "floating",
      segmentIndex: 2,
      changeIndex: 0,
    });
    expect(rateAt(plan, 60).ratePercent).toBe("10.25");
    expect(rateAt(plan, 61)).toEqual({
      ratePercent: "9.75",
      kind: "floating",
      segmentIndex: 2,
      changeIndex: 1,
    });
    expect(sameRateRegime(rateAt(plan, 60), rateAt(plan, 61))).toBe(false);
    expect(sameRateRegime(rateAt(plan, 61), rateAt(plan, 62))).toBe(true);
  });

  it("legacy G pair reads as fixed-then-floating; missing half means one fixed segment", () => {
    expect(legacyRatePlan("8.00", 36, "11.00").segments).toEqual([
      { kind: "fixed", months: 36, ratePercent: "8.00" },
      { kind: "floating", months: null, ratePercent: "11.00" },
    ]);
    expect(legacyRatePlan("8.00", 36, null).segments).toEqual([
      { kind: "fixed", months: null, ratePercent: "8.00" },
    ]);
    expect(hasFloatingSegment(legacyRatePlan("8.00", null, "11.00"))).toBe(
      false,
    );
  });
});

describe("effectivePeriodFor — revisi K (whole-month rule)", () => {
  const AKAD = new Date("2026-01-15T00:00:00.000Z");
  it.each([
    ["2026-01-15", 1],
    ["2031-01-10", 61],
    ["2031-01-15", 61],
    ["2031-01-16", 62],
    ["2031-01-20", 62],
  ])("rate effective %s -> first period %i", (iso, period) => {
    expect(effectivePeriodFor(AKAD, new Date(`${iso}T00:00:00.000Z`))).toBe(
      period,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/liabilities/rate-plan.util.spec.ts`
Expected: FAIL with "Cannot find module './rate-plan.util'", plus `effectivePeriodFor` is not exported.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/liabilities/rate-plan.util.ts`:

```ts
/**
 * Revisi K — a KPR's rate plan: ordered rate periods (fixed tiers, then an
 * optional floating tail) plus the floating-rate changes the user recorded.
 * Pure data + lookups; the money math stays in amortisation.util.ts.
 */

export type RatePeriodKind = "fixed" | "floating";

export interface RateSegment {
  kind: RatePeriodKind;
  /** Installments this segment covers; null = runs to maturity (last segment only). */
  months: number | null;
  ratePercent: string;
}

export interface FloatingRateChange {
  /** First installment period that accrues at `ratePercent` (see effectivePeriodFor). */
  effectivePeriod: number;
  ratePercent: string;
}

export interface RatePlan {
  segments: RateSegment[];
  /** Sorted by effectivePeriod ascending, no duplicates. */
  floatingChanges: FloatingRateChange[];
}

export interface ResolvedRate {
  ratePercent: string;
  kind: RatePeriodKind;
  segmentIndex: number;
  /** Index of the applied floating change, -1 when the segment's own rate applies. */
  changeIndex: number;
}

/** G's single fixedRateMonths + floatingRate pair, read as a two-segment plan. */
export function legacyRatePlan(
  baseRatePercent: string,
  fixedRateMonths: number | null,
  floatingRatePercent: string | null,
): RatePlan {
  if (fixedRateMonths !== null && floatingRatePercent !== null) {
    return {
      segments: [
        {
          kind: "fixed",
          months: fixedRateMonths,
          ratePercent: baseRatePercent,
        },
        { kind: "floating", months: null, ratePercent: floatingRatePercent },
      ],
      floatingChanges: [],
    };
  }
  return {
    segments: [{ kind: "fixed", months: null, ratePercent: baseRatePercent }],
    floatingChanges: [],
  };
}

/** 1-based first period of each segment, e.g. [24, 12, null] -> [1, 25, 37]. */
export function segmentStartPeriods(plan: RatePlan): number[] {
  const starts: number[] = [];
  let start = 1;
  for (const segment of plan.segments) {
    starts.push(start);
    start += segment.months ?? 0;
  }
  return starts;
}

export function segmentIndexAt(plan: RatePlan, period: number): number {
  let start = 1;
  for (const [index, segment] of plan.segments.entries()) {
    if (segment.months === null || period < start + segment.months) {
      return index;
    }
    start += segment.months;
  }
  return plan.segments.length - 1;
}

/**
 * The rate installment `period` accrues at. Inside a floating segment the
 * latest recorded change with effectivePeriod <= period wins, including one
 * recorded while the loan was still fixed (it is the bank rate in force when
 * floating starts); fixed segments ignore recorded changes.
 */
export function rateAt(plan: RatePlan, period: number): ResolvedRate {
  const segmentIndex = segmentIndexAt(plan, period);
  const segment = plan.segments[segmentIndex];
  if (!segment) throw new Error("rate plan has no segments");
  if (segment.kind === "fixed") {
    return {
      ratePercent: segment.ratePercent,
      kind: "fixed",
      segmentIndex,
      changeIndex: -1,
    };
  }
  let changeIndex = -1;
  for (const [index, change] of plan.floatingChanges.entries()) {
    if (change.effectivePeriod <= period) changeIndex = index;
  }
  return {
    ratePercent:
      plan.floatingChanges[changeIndex]?.ratePercent ?? segment.ratePercent,
    kind: "floating",
    segmentIndex,
    changeIndex,
  };
}

/** True when two periods sit under the same segment AND the same recorded change. */
export function sameRateRegime(a: ResolvedRate, b: ResolvedRate): boolean {
  return a.segmentIndex === b.segmentIndex && a.changeIndex === b.changeIndex;
}

export function hasFloatingSegment(plan: RatePlan): boolean {
  return plan.segments.some((segment) => segment.kind === "floating");
}
```

In `apps/api/src/liabilities/amortisation.util.ts`, insert this directly after the closing `}` of `monthsElapsed`:

```ts
/**
 * First installment period that accrues wholly at a rate effective on
 * `effectiveDate`: installment k accrues over [start+(k-1) mo, start+k mo),
 * so a date on a window start applies to that window, a mid-window date to
 * the next one (no daily proration).
 */
export function effectivePeriodFor(
  startDate: Date,
  effectiveDate: Date,
): number {
  const elapsed = monthsElapsed(startDate, effectiveDate);
  return effectiveDate.getUTCDate() === startDate.getUTCDate()
    ? elapsed + 1
    : elapsed + 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `pnpm exec jest src/liabilities/rate-plan.util.spec.ts src/liabilities/amortisation.util.spec.ts`
Expected: PASS. The new spec has 8 tests, and G's spec is unchanged and green.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/rate-plan.util.ts src/liabilities/rate-plan.util.spec.ts src/liabilities/amortisation.util.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/rate-plan.util.ts apps/api/src/liabilities/rate-plan.util.spec.ts apps/api/src/liabilities/amortisation.util.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): KPR rate plan model with tiered periods and floating changes

rateAt resolves the rate an installment accrues at: fixed tiers ignore
recorded changes, floating segments take the latest change in force.
effectivePeriodFor applies a rate from the first whole installment month.
legacyRatePlan reads G's fixedRateMonths/floatingRate as a two-segment plan.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 2: Plan-aware `buildSchedule` (one engine for every consumer)

**Files:**

- Modify: `apps/api/src/liabilities/amortisation.util.ts` — import block (top), `roundHalfUpDivide` (~line 67), `rateForPeriod` (~lines 179-198), `ScheduleInput` (~lines 209-225), `buildSchedule` (~lines 235-308)
- Create: `apps/api/src/liabilities/amortisation.rate-plan.spec.ts`
- Do **not** modify `apps/api/src/liabilities/amortisation.util.spec.ts`. It is the legacy-parity proof.

**Interfaces:**

- Consumes: Task 1's `legacyRatePlan`, `rateAt`, `sameRateRegime`, `RatePlan`.
- Produces (from `./amortisation.util`):
  - `roundHalfUpDivide(numerator: bigint, denominator: bigint): bigint` is now **exported** (Task 4 uses it).
  - `ScheduleInput` gains two optional fields:
    - `ratePlan?: RatePlan` — when absent, the legacy `fixedRateMonths`/`floatingRatePercent` apply via `legacyRatePlan`.
    - `recomputeAtStart?: boolean` — `true` forces a re-annuitisation at row 0, `false` forbids it, `undefined` means "only when row 0's regime differs from the anchor's".
    - `installmentAnchorPeriod?: number` (default `1`) — the period whose regime `installmentAmount` was computed for. Task 9 feeds it from `liabilities.installmentFromPeriod`, which a recorded prepayment sets.
  - `ratePlanOf(input: ScheduleInput): RatePlan` is the single place that picks K's plan or the legacy adapter. Tasks 4, 6a and 8 call it.
  - `rateForPeriod` keeps its signature (G's tests) and becomes a thin reader over `legacyRatePlan`.
  - `ScheduleRow` is **unchanged** (G's `toEqual` goldens depend on its shape).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/liabilities/amortisation.rate-plan.spec.ts`:

```ts
import {
  buildSchedule,
  computeInstallment,
  currentInstallment,
} from "./amortisation.util";

import type { RatePlan } from "./rate-plan.util";

const BERJENJANG: RatePlan = {
  segments: [
    { kind: "fixed", months: 24, ratePercent: "3.50" },
    { kind: "fixed", months: 12, ratePercent: "5.50" },
    { kind: "floating", months: null, ratePercent: "11.00" },
  ],
  floatingChanges: [],
};
const LEGACY_OFF = { fixedRateMonths: null, floatingRatePercent: null };
const KPR_500 = {
  method: "anuitas" as const,
  remainingBalance: 500_000_000n,
  originalPrincipal: 500_000_000n,
  annualInterestRatePercent: "3.50",
  installmentAmount: 2_899_799n,
  remainingMonths: 240,
  firstPeriod: 1,
  ...LEGACY_OFF,
};

describe("buildSchedule over a rate plan — revisi K golden schedules", () => {
  it("berjenjang 500 jt / 240 bln: re-annuitises at 25 and 37, pays off exactly", () => {
    expect(
      computeInstallment({
        method: "anuitas",
        principal: 500_000_000n,
        annualInterestRatePercent: "3.50",
        tenorMonths: 240,
      }),
    ).toBe(2_899_799n);
    const rows = buildSchedule({ ...KPR_500, ratePlan: BERJENJANG });
    expect(rows).toHaveLength(240);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 2_899_799n,
      interest: 1_458_333n,
      principal: 1_441_466n,
      remaining: 498_558_534n,
    });
    expect(rows[23]).toEqual({
      period: 24,
      installment: 2_899_799n,
      interest: 1_358_468n,
      principal: 1_541_331n,
      remaining: 464_219_240n,
    });
    expect(rows[24]).toEqual({
      period: 25,
      installment: 3_390_269n,
      interest: 2_127_672n,
      principal: 1_262_597n,
      remaining: 462_956_643n,
    });
    expect(rows[35]).toEqual({
      period: 36,
      installment: 3_390_269n,
      interest: 2_062_537n,
      principal: 1_327_732n,
      remaining: 448_680_240n,
    });
    expect(rows[36]).toEqual({
      period: 37,
      installment: 4_869_888n,
      interest: 4_112_902n,
      principal: 756_986n,
      remaining: 447_923_254n,
    });
    expect(rows[239]).toEqual({
      period: 240,
      installment: 4_870_149n,
      interest: 44_238n,
      principal: 4_825_911n,
      remaining: 0n,
    });
    expect(rows.reduce((s, r) => s + r.principal, 0n)).toBe(500_000_000n);
  });

  it("mid-tier start (period 30) re-annuitises the current balance at tier 2", () => {
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 457_848_118n,
      remainingMonths: 211,
      firstPeriod: 30,
      ratePlan: BERJENJANG,
    });
    expect(rows[0]).toEqual({
      period: 30,
      installment: 3_390_269n,
      interest: 2_098_471n,
      principal: 1_291_798n,
      remaining: 456_556_320n,
    });
    expect(rows[7]?.installment).toBe(4_869_888n);
    expect(rows).toHaveLength(211);
  });

  it("recorded floating change at 61 re-annuitises there; 60 keeps the seeded rate", () => {
    const rows = buildSchedule({
      ...KPR_500,
      ratePlan: {
        ...BERJENJANG,
        floatingChanges: [{ effectivePeriod: 61, ratePercent: "9.75" }],
      },
    });
    expect(rows[59]).toEqual({
      period: 60,
      installment: 4_869_888n,
      interest: 3_936_130n,
      principal: 933_758n,
      remaining: 428_462_235n,
    });
    expect(rows[60]).toEqual({
      period: 61,
      installment: 4_538_969n,
      interest: 3_481_256n,
      principal: 1_057_713n,
      remaining: 427_404_522n,
    });
    expect(rows[239]).toEqual({
      period: 240,
      installment: 4_538_946n,
      interest: 36_582n,
      principal: 4_502_364n,
      remaining: 0n,
    });
  });

  it("mid-month change (effective period 62): 61 still at 11.00", () => {
    const rows = buildSchedule({
      ...KPR_500,
      ratePlan: {
        ...BERJENJANG,
        floatingChanges: [{ effectivePeriod: 62, ratePercent: "9.75" }],
      },
    });
    expect(rows[60]).toEqual({
      period: 61,
      installment: 4_869_888n,
      interest: 3_927_570n,
      principal: 942_318n,
      remaining: 427_519_917n,
    });
    expect(rows[61]).toEqual({
      period: 62,
      installment: 4_540_194n,
      interest: 3_473_599n,
      principal: 1_066_595n,
      remaining: 426_453_322n,
    });
  });

  it("a change recorded during the fixed tiers only bites at 37", () => {
    const rows = buildSchedule({
      ...KPR_500,
      ratePlan: {
        ...BERJENJANG,
        floatingChanges: [{ effectivePeriod: 10, ratePercent: "10.25" }],
      },
    });
    expect(rows[9]?.interest).toBe(1_420_050n);
    expect(rows[35]?.installment).toBe(3_390_269n);
    expect(rows[36]).toEqual({
      period: 37,
      installment: 4_653_225n,
      interest: 3_832_477n,
      principal: 820_748n,
      remaining: 447_859_492n,
    });
  });

  it("0% promo 12 bln then 10% floating: no interest, then re-annuitised at 13", () => {
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 120_000_000n,
      originalPrincipal: 120_000_000n,
      annualInterestRatePercent: "0",
      installmentAmount: 1_000_000n,
      remainingMonths: 120,
      ratePlan: {
        segments: [
          { kind: "fixed", months: 12, ratePercent: "0" },
          { kind: "floating", months: null, ratePercent: "10.00" },
        ],
        floatingChanges: [],
      },
    });
    expect(rows[11]).toEqual({
      period: 12,
      installment: 1_000_000n,
      interest: 0n,
      principal: 1_000_000n,
      remaining: 108_000_000n,
    });
    expect(rows[12]).toEqual({
      period: 13,
      installment: 1_520_498n,
      interest: 900_000n,
      principal: 620_498n,
      remaining: 107_379_502n,
    });
    expect(rows[119]).toEqual({
      period: 120,
      installment: 1_520_511n,
      interest: 12_566n,
      principal: 1_507_945n,
      remaining: 0n,
    });
  });

  it("murabahah 300 jt / 6.00% / 180 bln: every installment equal, last absorbs rounding", () => {
    const installment = computeInstallment({
      method: "anuitas",
      principal: 300_000_000n,
      annualInterestRatePercent: "6.00",
      tenorMonths: 180,
    });
    expect(installment).toBe(2_531_570n);
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 300_000_000n,
      originalPrincipal: 300_000_000n,
      annualInterestRatePercent: "6.00",
      installmentAmount: installment,
      remainingMonths: 180,
      ratePlan: {
        segments: [{ kind: "fixed", months: null, ratePercent: "6.00" }],
        floatingChanges: [],
      },
    });
    expect(rows.slice(0, 179).every((r) => r.installment === installment)).toBe(
      true,
    );
    expect(rows[179]).toEqual({
      period: 180,
      installment: 2_531_721n,
      interest: 12_596n,
      principal: 2_519_125n,
      remaining: 0n,
    });
    expect(rows.reduce((s, r) => s + r.installment, 0n)).toBe(455_682_751n);
  });

  it("FLPP 150 jt / 5.00% / 480 bln", () => {
    const installment = computeInstallment({
      method: "anuitas",
      principal: 150_000_000n,
      annualInterestRatePercent: "5.00",
      tenorMonths: 480,
    });
    expect(installment).toBe(723_295n);
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 150_000_000n,
      originalPrincipal: 150_000_000n,
      annualInterestRatePercent: "5.00",
      installmentAmount: installment,
      remainingMonths: 480,
      ratePlan: {
        segments: [{ kind: "fixed", months: null, ratePercent: "5.00" }],
        floatingChanges: [],
      },
    });
    expect(rows).toHaveLength(480);
    expect(rows[479]).toEqual({
      period: 480,
      installment: 723_106n,
      interest: 3_000n,
      principal: 720_106n,
      remaining: 0n,
    });
  });

  it("past tenor: one payoff row at the latest recorded floating rate", () => {
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 1_000_000n,
      remainingMonths: 1,
      firstPeriod: 240,
      ratePlan: {
        ...BERJENJANG,
        floatingChanges: [{ effectivePeriod: 61, ratePercent: "9.75" }],
      },
    });
    expect(rows).toEqual([
      {
        period: 240,
        installment: 1_008_125n,
        interest: 8_125n,
        principal: 1_000_000n,
        remaining: 0n,
      },
    ]);
  });

  it("currentInstallment follows the plan: tier 1 at 13, tier 2 at 30", () => {
    expect(
      currentInstallment({
        ...KPR_500,
        remainingBalance: 482_422_215n,
        remainingMonths: 228,
        firstPeriod: 13,
        ratePlan: BERJENJANG,
      }),
    ).toBe(2_899_799n);
    expect(
      currentInstallment({
        ...KPR_500,
        remainingBalance: 457_848_118n,
        remainingMonths: 211,
        firstPeriod: 30,
        ratePlan: BERJENJANG,
      }),
    ).toBe(3_390_269n);
  });

  it("legacy G terms and the equivalent explicit plan give identical schedules", () => {
    const legacy = buildSchedule({
      ...KPR_500,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      fixedRateMonths: 36,
      floatingRatePercent: "11.00",
    });
    const explicit = buildSchedule({
      ...KPR_500,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      ratePlan: {
        segments: [
          { kind: "fixed", months: 36, ratePercent: "8.00" },
          { kind: "floating", months: null, ratePercent: "11.00" },
        ],
        floatingChanges: [],
      },
    });
    expect(explicit).toEqual(legacy);
    expect(legacy[36]?.installment).toBe(5_053_432n);
  });
});
describe("installmentAnchorPeriod — revisi K (recorded prepayment)", () => {
  // Berjenjang loan at #61 (floating 11%), 100 jt prepaid with reduce-tenor:
  // installment 4.869.889 kept, tenor 60 + 106 = 166, anchored at #61.
  const PERSISTED = {
    method: "anuitas" as const,
    remainingBalance: 328_462_235n,
    originalPrincipal: 500_000_000n,
    annualInterestRatePercent: "3.50",
    installmentAmount: 4_869_889n,
    remainingMonths: 106,
    firstPeriod: 61,
    fixedRateMonths: null,
    floatingRatePercent: null,
    ratePlan: BERJENJANG,
  };

  it("anchored at the prepayment period: the stored installment is used as-is and pays off at #166", () => {
    const rows = buildSchedule({ ...PERSISTED, installmentAnchorPeriod: 61 });
    expect(rows[0]).toEqual({
      period: 61,
      installment: 4_869_889n,
      interest: 3_010_904n,
      principal: 1_858_985n,
      remaining: 326_603_250n,
    });
    expect(rows[12]?.installment).toBe(4_869_889n);
    expect(rows).toHaveLength(106);
    expect(rows[105]).toEqual({
      period: 166,
      installment: 2_633_995n,
      interest: 23_926n,
      principal: 2_610_069n,
      remaining: 0n,
    });
  });

  it("without the anchor the floating regime would silently re-annuitise it (4.857.320)", () => {
    expect(buildSchedule(PERSISTED)[0]?.installment).toBe(4_857_320n);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/liabilities/amortisation.rate-plan.spec.ts`
Expected: FAIL. It fails at compile (TS2353 "'ratePlan' does not exist in type 'ScheduleInput'"), or, if ts-jest is lenient, the tier-2 row 25 still shows 2.899.799.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/liabilities/amortisation.util.ts`:

(a) Insert right before `export type InterestMethod = …`:

```ts
import {
  legacyRatePlan,
  rateAt,
  sameRateRegime,
  type RatePlan,
} from "./rate-plan.util";
```

(b) Export the rounding helper. Replace `function roundHalfUpDivide(numerator: bigint, denominator: bigint): bigint {` with:

```ts
export function roundHalfUpDivide(
  numerator: bigint,
  denominator: bigint,
): bigint {
```

(c) Delete `function isFloatingPeriod(…) { … }` entirely, and replace the body of `rateForPeriod` so that the function reads:

```ts
/** G's lookup, now a thin reader over the legacy two-segment plan. */
export function rateForPeriod(input: RatePeriodInput): string {
  return rateAt(
    legacyRatePlan(
      input.baseRatePercent,
      input.fixedRateMonths,
      input.floatingRatePercent,
    ),
    input.period,
  ).ratePercent;
}
```

(d) In `interface ScheduleInput`, replace

```ts
  fixedRateMonths: number | null;
  floatingRatePercent: string | null;
  /** Caps the rows built; defaults to MAX_SCHEDULE_ROWS. */
  maxRows?: number;
}
```

with

```ts
  /** Legacy G terms; ignored when `ratePlan` is set. */
  fixedRateMonths: number | null;
  floatingRatePercent: string | null;
  /** Revisi K rate periods + recorded floating changes. */
  ratePlan?: RatePlan;
  /** Re-annuitise at the first row: true forces, false forbids, undefined = only when the rate regime differs from the anchor's. */
  recomputeAtStart?: boolean;
  /** Period whose rate regime `installmentAmount` was computed for (1 = the akad; a recorded prepayment moves it). */
  installmentAnchorPeriod?: number;
  /** Caps the rows built; defaults to MAX_SCHEDULE_ROWS. */
  maxRows?: number;
}
```

(e) Insert directly above `export function buildSchedule`:

```ts
/** The plan a schedule runs on: K's rate periods, else G's legacy pair read as one. */
export function ratePlanOf(input: ScheduleInput): RatePlan {
  return (
    input.ratePlan ??
    legacyRatePlan(
      input.annualInterestRatePercent,
      input.fixedRateMonths,
      input.floatingRatePercent,
    )
  );
}
```

(f) In `buildSchedule`, replace everything from `const denominator = rateDenominator(input.rateIsMonthly);` down to (and including) the closing `}` of the `if (input.method === "anuitas" && …) { … }` block with:

```ts
  const denominator = rateDenominator(input.rateIsMonthly);
  const plan = ratePlanOf(input);
  const rows: ScheduleRow[] = [];
  let balance = input.remainingBalance;
  let installment = input.installmentAmount ?? 0n;
  let previous = rateAt(plan, input.installmentAnchorPeriod ?? 1);

  for (let i = 0; i < maxRows && balance > 0n; i += 1) {
    const period = input.firstPeriod + i;
    const rate = rateAt(plan, period);
    const regimeChanged =
      i === 0
        ? (input.recomputeAtStart ?? !sameRateRegime(rate, previous))
        : !sameRateRegime(rate, previous);
    previous = rate;
    const ratePercent = rate.ratePercent;
    if (
      input.method === "anuitas" &&
      input.remainingMonths !== null &&
      regimeChanged
    ) {
      // Banks re-annuitise the outstanding balance over the remaining tenor at every rate change.
      installment = computeInstallment({
        method: "anuitas",
        principal: balance,
        annualInterestRatePercent: ratePercent,
        tenorMonths: input.remainingMonths - i,
        rateIsMonthly: input.rateIsMonthly,
      });
    }
```

(g) Further down in the same loop, replace `period: ratePeriod.period,` inside `rows.push({ … })` with `period,`. The rest of the loop (interestDue, payoff, isLastPeriod, the push, `if (principal === 0n) break;`) is unchanged.

The full resulting `buildSchedule`, for reference:

```ts
export function buildSchedule(input: ScheduleInput): ScheduleRow[] {
  const maxRows = Math.min(
    MAX_SCHEDULE_ROWS,
    input.maxRows ?? MAX_SCHEDULE_ROWS,
    input.remainingMonths ?? MAX_SCHEDULE_ROWS,
  );
  const equalPrincipal =
    input.method === "efektif" &&
    input.installmentAmount === null &&
    input.remainingMonths !== null
      ? roundHalfUpDivide(input.remainingBalance, BigInt(input.remainingMonths))
      : null;
  if (input.installmentAmount === null && equalPrincipal === null) return [];

  const denominator = rateDenominator(input.rateIsMonthly);
  const plan = ratePlanOf(input);
  const rows: ScheduleRow[] = [];
  let balance = input.remainingBalance;
  let installment = input.installmentAmount ?? 0n;
  let previous = rateAt(plan, input.installmentAnchorPeriod ?? 1);

  for (let i = 0; i < maxRows && balance > 0n; i += 1) {
    const period = input.firstPeriod + i;
    const rate = rateAt(plan, period);
    const regimeChanged =
      i === 0
        ? (input.recomputeAtStart ?? !sameRateRegime(rate, previous))
        : !sameRateRegime(rate, previous);
    previous = rate;
    const ratePercent = rate.ratePercent;
    if (
      input.method === "anuitas" &&
      input.remainingMonths !== null &&
      regimeChanged
    ) {
      // Banks re-annuitise the outstanding balance over the remaining tenor at every rate change.
      installment = computeInstallment({
        method: "anuitas",
        principal: balance,
        annualInterestRatePercent: ratePercent,
        tenorMonths: input.remainingMonths - i,
        rateIsMonthly: input.rateIsMonthly,
      });
    }

    const interestDue = monthlyInterestDue({
      method: input.method,
      originalPrincipal: input.originalPrincipal,
      balance,
      rateScaled: parseRateScaledByHundred(ratePercent),
      denominator,
    });
    const payoff = balance + interestDue;
    const isLastPeriod =
      input.remainingMonths !== null && i === input.remainingMonths - 1;
    const scheduled =
      equalPrincipal !== null ? equalPrincipal + interestDue : installment;
    const payment = isLastPeriod || scheduled > payoff ? payoff : scheduled;
    const interest = interestDue > payment ? payment : interestDue;
    const principal = payment - interest;
    balance -= principal;

    rows.push({
      period,
      installment: payment,
      interest,
      principal,
      remaining: balance,
    });
    if (principal === 0n) break;
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS. The new spec has 13 tests; `amortisation.util.spec.ts` (G, untouched), `liabilities.service.spec.ts` and `liabilities.controller.spec.ts` are all still green.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/amortisation.util.ts src/liabilities/amortisation.rate-plan.spec.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/amortisation.util.ts apps/api/src/liabilities/amortisation.rate-plan.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): re-annuitise KPR schedules at every rate change

buildSchedule runs on a RatePlan (tiers, floating tail, recorded changes)
and re-annuitises the remaining balance over the remaining tenor whenever
the rate regime changes. G's fixed/floating pair goes through the same
path via legacyRatePlan; G's golden spec passes untouched.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 3: One due installment (5-day grace, WIB calendar) for the Pay preset, `pay()`, preview, schedule and budget line

**Files:**

- Modify: `apps/api/src/liabilities/amortisation.util.ts` (add `DUE_GRACE_DAYS`, `localCalendarDay`, `dueInstallment` and `dueInstallmentPeriod` right after `effectivePeriodFor`)
- Create: `apps/api/src/liabilities/amortisation.due-installment.spec.ts`
- Modify: `apps/api/src/liabilities/liabilities.service.ts` — imports, `scheduleInputFor`, `currentInstallmentFor`, `budgetContribution`, delete `settledPeriod`, `splitLiabilityPayment`, `runPayment`'s budget sync
- Modify: `apps/api/src/liabilities/liabilities.service.spec.ts` — **one** listed G test update + a new `describe` of boundary tests

**Interfaces:**

- Consumes: `monthsElapsed` (existing).
- Produces:
  - **From `./amortisation.util`:**
    - `DUE_GRACE_DAYS = 5`.
    - `localCalendarDay(now): Date` — the WIB (Asia/Jakarta, UTC+7, no DST) calendar day, as UTC midnight.
    - `dueInstallment(startDate: Date | null, now: Date, tenorMonths: number | null): { period: number; late: boolean }`.
    - `dueInstallmentPeriod(...) = dueInstallment(...).period`.
  - **The rule (user decision).** Installment `k` falls due `k` months after the akad. The installment being paid today is the latest one already due while it is **at most 5 days late** (due day through +5 → `k`, `late` from +1); from +6 it is `k + 1`.
    - The result is clamped to `tenorMonths`; past maturity it is `late: true`. Without an akad date it is `1`.
    - Days are compared on the **WIB calendar day** of `now` against the akad's stored calendar date (UTC midnight, as the date picker writes it). A payment at 06:30 WIB is therefore not a day early.
    - No per-family timezone exists yet; Asia/Jakarta is the app default. Revisit when the schema gains a family timezone.
  - **In `liabilities.service.ts`:**
    - `scheduleInputFor(liability, now, firstPeriod?: number)`: `firstPeriod` defaults to `dueInstallmentPeriod(...)`, and `remainingMonths = max(1, tenor − firstPeriod + 1)`.
    - `currentInstallmentFor(liability, now, firstPeriod?)` and `budgetContribution(liability, now, firstPeriod?)` pass it through.
    - `settledPeriod` is deleted. `splitLiabilityPayment` books `dueInstallmentPeriod(...)`.
    - `runPayment` re-derives the budget line for `min(settled + 1, tenor)` on dated loans.
    - Task 5 exposes `late` as `LiabilityDto.currentInstallmentLate`; Task 12 shows "Telat" in the Pay dialog.
  - **G tests changed — exactly one line**, in `liabilities.service.spec.ts` › `describe("current installment after the KPR fixed period (final fix 2)")`: the shared constant `FLOATING_INSTALLMENT` goes from `tenorMonths: 203` to `204`, with its comment rewritten.
    - Its `NOW` (2029-02-20) is 5 days after #37's due day, so #37 is still the installment being paid, with 204 left.
    - The three tests reading the constant pass unchanged through it:
      - `exposes the re-amortised floating installment as currentInstallmentAmount, matching schedule row 1`
      - `pay re-derives the budget line to the installment now due, not the stale fixed-period one` — "Settles #37" stays true, and its next-installment expectation of 203 stays correct.
      - `update re-derives the budget line to the installment now due`
  - **G tests re-verified, unchanged:**
    - `paying installment #36 on its due date still books the fixed rate`
    - `paying installment #37 on its due date books the floating rate`
    - `paying before the first due date counts as installment #1, never period 0`
    - `is the stored installment inside the fixed period` (2027-06-20 is #17 five days late — still a fixed-tier installment)
    - `uses the floating rate for a KPR installment past its fixed period, like pay()`
    - `anuitas 12 months into a 240-month KPR continues from period 13 on the current balance` (2026-09-25 is +15 after #12)
    - `past its tenor: a single payoff row, never an empty or negative schedule`

- [ ] **Step 1: Write the failing tests**

(a) Create `apps/api/src/liabilities/amortisation.due-installment.spec.ts`:

```ts
import {
  DUE_GRACE_DAYS,
  dueInstallment,
  dueInstallmentPeriod,
} from "./amortisation.util";

describe("dueInstallment — revisi K (5-day grace, WIB calendar)", () => {
  const AKAD = new Date("2026-01-15T00:00:00.000Z");

  it.each([
    ["before the first due date", "2026-01-10T08:00:00.000Z", 1, false],
    ["on the akad day itself", "2026-01-15T08:00:00.000Z", 1, false],
    ["the day before #24 falls due", "2028-01-14T08:00:00.000Z", 24, false],
    ["on #24's due day", "2028-01-15T08:00:00.000Z", 24, false],
    ["#24 one day late", "2028-01-16T08:00:00.000Z", 24, true],
    [
      "#24 five days late (last grace day)",
      "2028-01-20T08:00:00.000Z",
      24,
      true,
    ],
    ["six days after #24: #25 is next", "2028-01-21T08:00:00.000Z", 25, false],
    [
      "the day before #25 (tier boundary)",
      "2028-02-14T08:00:00.000Z",
      25,
      false,
    ],
    ["on #25's due day (tier boundary)", "2028-02-15T08:00:00.000Z", 25, false],
    [
      "past maturity: clamped to the last installment, late",
      "2046-06-01T08:00:00.000Z",
      240,
      true,
    ],
  ])("%s (%s) -> #%s, late %s", (_label, now, period, late) => {
    expect(dueInstallment(AKAD, new Date(now), 240)).toEqual({ period, late });
  });

  it("uses the WIB calendar day: 23:59 WIB on day +5 is still #24, 00:00 WIB on day +6 is #25", () => {
    expect(
      dueInstallmentPeriod(AKAD, new Date("2028-01-20T16:59:59.000Z"), 240),
    ).toBe(24);
    expect(
      dueInstallmentPeriod(AKAD, new Date("2028-01-20T17:00:00.000Z"), 240),
    ).toBe(25);
    // 06:30 WIB on #24's due day is 23:30 UTC the day before — still the due day in WIB.
    expect(
      dueInstallment(AKAD, new Date("2028-01-14T23:30:00.000Z"), 240),
    ).toEqual({ period: 24, late: false });
  });

  it("no akad date: installment 1; no tenor: not clamped; grace is 5 days", () => {
    expect(
      dueInstallmentPeriod(null, new Date("2030-01-01T00:00:00.000Z"), 240),
    ).toBe(1);
    expect(
      dueInstallmentPeriod(AKAD, new Date("2046-06-01T08:00:00.000Z"), null),
    ).toBe(245);
    expect(DUE_GRACE_DAYS).toBe(5);
  });
});
```

(b) In `apps/api/src/liabilities/liabilities.service.spec.ts`, `describe("current installment after the KPR fixed period (final fix 2)")`, replace

```ts
// 2029-02-20: 37 months elapsed, so the next installment is #38 with 203 left.
const NOW = new Date("2029-02-20T00:00:00.000Z");
const FLOATING_INSTALLMENT = computeInstallment({
  method: "anuitas",
  principal: BigInt(450_000_000),
  annualInterestRatePercent: "11.00",
  tenorMonths: 203,
});
```

with

```ts
// Revisi K due day: 2029-02-20 is 5 days after #37 fell due — inside the
// grace window, so #37 is still the installment being paid, with 204 left.
const NOW = new Date("2029-02-20T00:00:00.000Z");
const FLOATING_INSTALLMENT = computeInstallment({
  method: "anuitas",
  principal: BigInt(450_000_000),
  annualInterestRatePercent: "11.00",
  tenorMonths: 204,
});
```

Nothing else in that `describe` changes.

(c) Append a new top-level-inner `describe` at the end of the `describe("LiabilitiesService", …)` block (before its final `});`):

```ts
describe("unified due day — revisi K (Pay preset = installment pay() books)", () => {
  // G legacy pair: 8% fixed for 36 bln, then 11% floating; akad 2026-01-15.
  const KPR_36 = {
    ...BASE,
    type: "kpr",
    interestMethod: "anuitas",
    totalDebt: BigInt(500_000_000),
    remainingBalance: BigInt(465_590_716),
    interestRate: { toString: () => "8.00" },
    tenorMonths: 240,
    startDate: new Date("2026-01-15T00:00:00.000Z"),
    installmentAmount: BigInt(4_182_200),
    minimumPayment: BigInt(4_182_200),
    fixedRateMonths: 36,
    floatingRate: { toString: () => "11.00" },
    principalCategoryId: "cat-principal",
  };

  it.each([
    ["the day before #36", "2029-01-14T08:00:00.000Z", "4182200", "3103938"],
    ["#36's due day", "2029-01-15T08:00:00.000Z", "4182200", "3103938"],
    [
      "#36 one day late (grace)",
      "2029-01-16T08:00:00.000Z",
      "4182200",
      "3103938",
    ],
    [
      "#36 five days late (last grace day)",
      "2029-01-20T08:00:00.000Z",
      "4182200",
      "3103938",
    ],
    [
      "six days after #36: #37 at the floating rate",
      "2029-01-21T08:00:00.000Z",
      "5053432",
      "4267915",
    ],
    ["the day before #37", "2029-02-14T08:00:00.000Z", "5053432", "4267915"],
  ])(
    "%s: the preset and the booked split are the same installment",
    async (_label, now, preset, interest) => {
      prisma.liability.findMany.mockResolvedValue([KPR_36]);
      prisma.liability.findUnique.mockResolvedValue(KPR_36);

      const [dto] = await service.findAll("fg-1", new Date(now));
      const preview = await service.previewPayment(
        "fg-1",
        "lid-1",
        preset,
        new Date(now),
      );

      expect(dto?.currentInstallmentAmount).toBe(preset);
      expect(preview.interest).toBe(interest);
      // Paying exactly the preset settles that installment: principal = preset - its interest.
      expect(BigInt(preview.principal)).toBe(BigInt(preset) - BigInt(interest));
    },
  );

  it("a late payment inside the grace window settles #36 at 8% and moves the budget line to #37: 5.041.728", async () => {
    prisma.liability.findUnique.mockResolvedValue(KPR_36);
    prisma.account.findUnique.mockResolvedValue({
      id: "acc-1",
      familyGroupId: "fg-1",
      type: "bank",
      balance: BigInt(50_000_000),
      name: "BCA",
    });
    prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
    prisma.liability.update.mockResolvedValue(KPR_36);

    await service.pay(
      "fg-1",
      "lid-1",
      { sourceAccountId: "acc-1", amount: "4182200" },
      new Date("2029-01-20T08:00:00.000Z"),
    );

    // 465,590,716 x 8%/12 = 3,103,938 interest -> 1,078,262 principal (the old tier's rate).
    expect(prisma.liability.update).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-1" },
      data: { remainingBalance: { decrement: BigInt(1_078_262) } },
    });
    // #37 re-annuitised at 11% over 204 months on 464,512,454.
    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ limitAmount: BigInt(5_041_728) }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/amortisation.due-installment.spec.ts src/liabilities/liabilities.service.spec.ts`
Expected: FAIL. You should see:

- `dueInstallment is not a function`;
- on 2029-01-15 the preset is `5053432` (old `elapsed + 1` rule);
- on 2029-01-16 and 2029-01-20 the old rule still reports #37;
- `FLOATING_INSTALLMENT` (204) no longer matches the old #38 schedule row.

- [ ] **Step 3: Write minimal implementation**

(a) In `apps/api/src/liabilities/amortisation.util.ts`, insert directly after `effectivePeriodFor`:

```ts
/** Days after its due day an installment still counts as the one being paid (user decision, revisi K). */
export const DUE_GRACE_DAYS = 5;
// Asia/Jakarta (WIB, UTC+7, no DST): the app's calendar; there is no per-family timezone setting.
const APP_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `now`'s WIB calendar day as a UTC-midnight Date (akad dates are stored as UTC midnight of their calendar day). */
export function localCalendarDay(now: Date): Date {
  const shifted = new Date(now.getTime() + APP_UTC_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

export interface DueInstallment {
  /** The installment the Pay preset shows and pay() settles. */
  period: number;
  /** Past its due day (inside the grace window, or past maturity). */
  late: boolean;
}

/**
 * The installment being paid today: the latest one already due while it is
 * at most DUE_GRACE_DAYS late, otherwise the next one (installment k falls
 * due k months after the akad), clamped to [1, tenor]. The schedule's first
 * row, the Pay preset, pay()/preview and the budget line all use it.
 */
export function dueInstallment(
  startDate: Date | null,
  now: Date,
  tenorMonths: number | null,
): DueInstallment {
  if (startDate === null) return { period: 1, late: false };
  const today = localCalendarDay(now);
  const elapsed = monthsElapsed(startDate, today);
  const lastDue = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth() + elapsed,
    startDate.getUTCDate(),
  );
  const daysLate = Math.round((today.getTime() - lastDue) / DAY_MS);
  const inGrace = elapsed >= 1 && daysLate <= DUE_GRACE_DAYS;
  const period = inGrace ? elapsed : elapsed + 1;
  if (tenorMonths !== null && period > tenorMonths) {
    return { period: tenorMonths, late: true };
  }
  return { period, late: inGrace && daysLate > 0 };
}

export function dueInstallmentPeriod(
  startDate: Date | null,
  now: Date,
  tenorMonths: number | null,
): number {
  return dueInstallment(startDate, now, tenorMonths).period;
}
```

(b) In `apps/api/src/liabilities/liabilities.service.ts`:

1. In the `./amortisation.util` import, add `dueInstallmentPeriod` and remove `monthsElapsed`. Task 5 adds `dueInstallment`. Nothing else in the service uses it once `settledPeriod` is gone; if something does, keep it.
2. Replace the whole `scheduleInputFor` function with:

   ```ts
   /** Schedule inputs from the liability's current state, starting at `firstPeriod` (default: the installment due on or after `now`). */
   function scheduleInputFor(
     liability: InstallmentTerms,
     now: Date,
     firstPeriod?: number,
   ): ScheduleInput {
     const tenor = liability.tenorMonths;
     const first =
       firstPeriod ?? dueInstallmentPeriod(liability.startDate, now, tenor);
     return {
       method: liability.interestMethod,
       remainingBalance: liability.remainingBalance,
       originalPrincipal: liability.totalDebt,
       annualInterestRatePercent: liability.interestRate.toString(),
       rateIsMonthly: liability.type === "kartu_kredit",
       installmentAmount:
         liability.installmentAmount ??
         (liability.minimumPayment > BigInt(0)
           ? liability.minimumPayment
           : null),
       remainingMonths: tenor === null ? null : Math.max(1, tenor - first + 1),
       firstPeriod: first,
       fixedRateMonths: liability.fixedRateMonths,
       floatingRatePercent: liability.floatingRate?.toString() ?? null,
     };
   }
   ```

3. Replace `currentInstallmentFor` and `budgetContribution` with:

   ```ts
   // Derived per read/write instead of stored, so crossing into the floating period needs no cron.
   function currentInstallmentFor(
     liability: InstallmentTerms,
     now: Date,
     firstPeriod?: number,
   ): bigint | null {
     return currentInstallment(scheduleInputFor(liability, now, firstPeriod));
   }

   /** Budget line limit: the installment due; a liability with no minimumPayment has no line. */
   function budgetContribution(
     liability: InstallmentTerms,
     now: Date,
     firstPeriod?: number,
   ): bigint {
     if (liability.minimumPayment <= BigInt(0)) return BigInt(0);
     return (
       currentInstallmentFor(liability, now, firstPeriod) ??
       liability.minimumPayment
     );
   }
   ```

4. Delete `settledPeriod` and its comment. In `splitLiabilityPayment`, replace `period: settledPeriod(liability.startDate, now),` with:

   ```ts
         period: dueInstallmentPeriod(
           liability.startDate,
           now,
           liability.tenorMonths,
         ),
   ```

5. In `runPayment`, directly before `if (liability.minimumPayment > BigInt(0)) {` (the budget sync), add:

   ```ts
   // The installment just settled is no longer outstanding: the line tracks the next one.
   const settled = dueInstallmentPeriod(
     liability.startDate,
     now,
     liability.tenorMonths,
   );
   const nextPeriod =
     liability.startDate === null
       ? undefined
       : Math.min(settled + 1, liability.tenorMonths ?? settled + 1);
   ```

   Then pass `nextPeriod` as the third argument of that `budgetContribution({ … }, now)` call: `budgetContribution({ …unchanged… }, now, nextPeriod)`.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS. The new pure spec has 12 tests and the new service `describe` has 7. The G `describe` passes with the one-line constant change; every other G test is unchanged and green.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/amortisation.util.ts src/liabilities/amortisation.due-installment.spec.ts src/liabilities/liabilities.service.ts src/liabilities/liabilities.service.spec.ts`
Expected: exit 0 (hand-fix only).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/amortisation.util.ts apps/api/src/liabilities/amortisation.due-installment.spec.ts apps/api/src/liabilities/liabilities.service.ts apps/api/src/liabilities/liabilities.service.spec.ts
git commit -m "$(cat <<'EOF'
fix(liabilities): Pay preset and pay() mean the same installment

dueInstallment picks the installment being paid today: the latest one due
while it is at most 5 days late (grace), otherwise the next, on the WIB
calendar day. The schedule's first row, currentInstallmentAmount, the
pay/preview split and the budget line all use it; after a payment the
budget line tracks the next installment. Replaces G's max(1, elapsed) vs
elapsed+1 pair, which disagreed on due days and near tier boundaries.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 4: Early-repayment simulation (pure)

**Files:**

- Create: `apps/api/src/liabilities/prepayment.util.ts`
- Create: `apps/api/src/liabilities/prepayment.util.spec.ts`

**Interfaces:**

- Consumes: Task 2's `buildSchedule`, `currentInstallment`, `ratePlanOf`, `roundHalfUpDivide`, `parseRateScaledByHundred`, `ScheduleInput`; Task 1's `rateAt`.
- Produces (from `./prepayment.util`):
  - `type PrepaymentMode = "full" | "reduce_tenor" | "reduce_installment"`.
  - `prepaymentPenalty(prepaidPrincipal: bigint, penaltyPercent: string): bigint` — round-half-up.
  - `monthsToPayOff(balance: bigint, annualRatePercent: string, installment: bigint): number | null` — implemented with `buildSchedule`, so it has no interest math of its own.
  - `simulatePrepayment(input: { schedule: ScheduleInput; mode: PrepaymentMode; amount: bigint; penaltyPercent: string }): PrepaymentResult`.
    - Throws `RangeError` when the amount is ≤ 0 or greater than the balance, or when reduce-tenor cannot pay off.
    - `PrepaymentResult = { mode; prepaidPrincipal; penalty; cashOutNow; installmentBefore: bigint | null; installmentAfter: bigint | null; remainingMonthsBefore: number; remainingMonthsAfter: number; totalInterestBefore; totalInterestAfter; interestSaved; netSaving; newInstallmentAmount: bigint | null; newTenorMonths: number | null }`. All money fields are `bigint`; `netSaving` may be negative.
    - `newInstallmentAmount` / `newTenorMonths` are exactly what Task 10 persists from `schedule.firstPeriod` on:
      - reduce-installment → the re-annuitised installment, with tenor `null` (unchanged);
      - reduce-tenor → the kept installment, with tenor `firstPeriod − 1 + months`;
      - full → both `null`.
  - Semantics:
    - The prepayment lands right before the next installment (`schedule.firstPeriod`). Interest accrued since the last installment is not modelled (monthly rest, **[R§3]**).
    - Reduce-installment re-annuitises now over the same remaining months.
    - Reduce-tenor keeps the current installment, and finds the new month count at the current rate. Future tier or floating changes still re-annuitise over that shortened tenor.
    - A partial prepayment equal to the balance reports `mode: "full"`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/liabilities/prepayment.util.spec.ts`:

```ts
import {
  monthsToPayOff,
  prepaymentPenalty,
  simulatePrepayment,
} from "./prepayment.util";

import type { ScheduleInput } from "./amortisation.util";
import type { RatePlan } from "./rate-plan.util";

const FLOATING_11: RatePlan = {
  segments: [{ kind: "fixed", months: null, ratePercent: "11.00" }],
  floatingChanges: [],
};
// 400 jt left, 180 bln left, 11.00%: installment 4.546.388.
const AT_61: ScheduleInput = {
  method: "anuitas",
  remainingBalance: 400_000_000n,
  originalPrincipal: 500_000_000n,
  annualInterestRatePercent: "11.00",
  installmentAmount: 4_546_388n,
  remainingMonths: 180,
  firstPeriod: 61,
  fixedRateMonths: null,
  floatingRatePercent: null,
  ratePlan: FLOATING_11,
};
const BERJENJANG: RatePlan = {
  segments: [
    { kind: "fixed", months: 24, ratePercent: "3.50" },
    { kind: "fixed", months: 12, ratePercent: "5.50" },
    { kind: "floating", months: null, ratePercent: "11.00" },
  ],
  floatingChanges: [],
};
const BERJENJANG_AT_13: ScheduleInput = {
  ...AT_61,
  remainingBalance: 482_422_215n,
  annualInterestRatePercent: "3.50",
  installmentAmount: 2_899_799n,
  remainingMonths: 228,
  firstPeriod: 13,
  ratePlan: BERJENJANG,
};

describe("prepaymentPenalty — revisi K", () => {
  it("rounds half up to the rupiah", () => {
    expect(prepaymentPenalty(12_345_650n, "1.00")).toBe(123_457n);
    expect(prepaymentPenalty(12_345_649n, "1.00")).toBe(123_456n);
    expect(prepaymentPenalty(33_333_333n, "1.25")).toBe(416_667n);
    expect(prepaymentPenalty(100_000_000n, "0")).toBe(0n);
  });
});

describe("monthsToPayOff — revisi K", () => {
  it("300 jt at 11.00% with 4.546.388/bln takes 102 months; an installment below interest never pays off", () => {
    expect(monthsToPayOff(300_000_000n, "11.00", 4_546_388n)).toBe(102);
    expect(monthsToPayOff(300_000_000n, "11.00", 2_750_000n)).toBeNull();
  });
});

describe("simulatePrepayment — revisi K golden numbers", () => {
  it("partial 100 jt, reduce installment: 4.546.388 -> 3.409.791, tenor kept", () => {
    const r = simulatePrepayment({
      schedule: AT_61,
      mode: "reduce_installment",
      amount: 100_000_000n,
      penaltyPercent: "1.00",
    });
    expect(r).toEqual({
      mode: "reduce_installment",
      prepaidPrincipal: 100_000_000n,
      penalty: 1_000_000n,
      cashOutNow: 101_000_000n,
      installmentBefore: 4_546_388n,
      installmentAfter: 3_409_791n,
      remainingMonthsBefore: 180,
      remainingMonthsAfter: 180,
      totalInterestBefore: 418_349_734n,
      totalInterestAfter: 313_762_283n,
      interestSaved: 104_587_451n,
      netSaving: 103_587_451n,
      newInstallmentAmount: 3_409_791n,
      newTenorMonths: null,
    });
  });

  it("partial 100 jt, reduce tenor: installment kept, 180 -> 102 months", () => {
    const r = simulatePrepayment({
      schedule: AT_61,
      mode: "reduce_tenor",
      amount: 100_000_000n,
      penaltyPercent: "1.00",
    });
    expect(r.installmentAfter).toBe(4_546_388n);
    expect(r.remainingMonthsAfter).toBe(102);
    expect(r.totalInterestAfter).toBe(162_646_456n);
    expect(r.interestSaved).toBe(255_703_278n);
    expect(r.netSaving).toBe(254_703_278n);
    // Persisted: installment kept from #61, tenor 60 + 102 = 162.
    expect(r.newInstallmentAmount).toBe(4_546_388n);
    expect(r.newTenorMonths).toBe(162);
  });

  it("full payoff: penalty on the whole balance, every future interest rupiah saved", () => {
    const r = simulatePrepayment({
      schedule: AT_61,
      mode: "full",
      amount: 0n,
      penaltyPercent: "2.50",
    });
    expect(r.prepaidPrincipal).toBe(400_000_000n);
    expect(r.penalty).toBe(10_000_000n);
    expect(r.cashOutNow).toBe(410_000_000n);
    expect(r.installmentAfter).toBeNull();
    expect(r.remainingMonthsAfter).toBe(0);
    expect(r.interestSaved).toBe(418_349_734n);
    expect(r.newInstallmentAmount).toBeNull();
    expect(r.newTenorMonths).toBeNull();
  });

  it("partial equal to the balance is reported as full", () => {
    expect(
      simulatePrepayment({
        schedule: AT_61,
        mode: "reduce_tenor",
        amount: 400_000_000n,
        penaltyPercent: "1.00",
      }).mode,
    ).toBe("full");
  });

  it("berjenjang at 13, 50 jt reduce tenor: 196 months, still steps up at 25 and 37", () => {
    const r = simulatePrepayment({
      schedule: BERJENJANG_AT_13,
      mode: "reduce_tenor",
      amount: 50_000_000n,
      penaltyPercent: "1.00",
    });
    expect(r.penalty).toBe(500_000n);
    expect(r.installmentAfter).toBe(2_899_799n);
    expect(r.remainingMonthsAfter).toBe(196);
    expect(r.interestSaved).toBe(158_148_844n);
    expect(r.newTenorMonths).toBe(208);
  });

  it("berjenjang at 13, 50 jt reduce installment: 2.599.253 now", () => {
    const r = simulatePrepayment({
      schedule: BERJENJANG_AT_13,
      mode: "reduce_installment",
      amount: 50_000_000n,
      penaltyPercent: "1.00",
    });
    expect(r.installmentAfter).toBe(2_599_253n);
    expect(r.remainingMonthsAfter).toBe(228);
    expect(r.interestSaved).toBe(60_788_997n);
  });

  it("rejects 0 and more than the balance", () => {
    expect(() =>
      simulatePrepayment({
        schedule: AT_61,
        mode: "reduce_tenor",
        amount: 0n,
        penaltyPercent: "1.00",
      }),
    ).toThrow(RangeError);
    expect(() =>
      simulatePrepayment({
        schedule: AT_61,
        mode: "reduce_tenor",
        amount: 400_000_001n,
        penaltyPercent: "1.00",
      }),
    ).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/liabilities/prepayment.util.spec.ts`
Expected: FAIL with "Cannot find module './prepayment.util'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/liabilities/prepayment.util.ts`:

```ts
/**
 * Revisi K — early-repayment (pelunasan dipercepat) simulation. Read-only:
 * it reuses buildSchedule for both the "before" and "after" projections, so
 * no installment math lives here.
 */
import {
  buildSchedule,
  currentInstallment,
  parseRateScaledByHundred,
  ratePlanOf,
  roundHalfUpDivide,
  type ScheduleInput,
  type ScheduleRow,
} from "./amortisation.util";
import { rateAt } from "./rate-plan.util";

export type PrepaymentMode = "full" | "reduce_tenor" | "reduce_installment";

// (percent scale 100) * (fixed-point scale 100)
const PERCENT_DENOMINATOR = 10_000n;

/** Penalty on the prepaid principal, round-half-up to the rupiah. */
export function prepaymentPenalty(
  prepaidPrincipal: bigint,
  penaltyPercent: string,
): bigint {
  return roundHalfUpDivide(
    prepaidPrincipal * parseRateScaledByHundred(penaltyPercent),
    PERCENT_DENOMINATOR,
  );
}

/** Months a level `installment` needs to clear `balance` at a constant annual rate; null if it never does. */
export function monthsToPayOff(
  balance: bigint,
  annualRatePercent: string,
  installment: bigint,
): number | null {
  const rows = buildSchedule({
    method: "anuitas",
    remainingBalance: balance,
    originalPrincipal: balance,
    annualInterestRatePercent: annualRatePercent,
    installmentAmount: installment,
    remainingMonths: null,
    firstPeriod: 1,
    fixedRateMonths: null,
    floatingRatePercent: null,
  });
  return rows.at(-1)?.remaining === 0n ? rows.length : null;
}

export interface PrepaymentInput {
  schedule: ScheduleInput;
  mode: PrepaymentMode;
  /** Ignored for "full" (the whole remaining balance is prepaid). */
  amount: bigint;
  penaltyPercent: string;
}

export interface PrepaymentResult {
  mode: PrepaymentMode;
  prepaidPrincipal: bigint;
  penalty: bigint;
  cashOutNow: bigint;
  installmentBefore: bigint | null;
  installmentAfter: bigint | null;
  remainingMonthsBefore: number;
  remainingMonthsAfter: number;
  totalInterestBefore: bigint;
  totalInterestAfter: bigint;
  interestSaved: bigint;
  netSaving: bigint;
  /** What recording persists: the installment and tenor from `schedule.firstPeriod` on (null = unchanged / paid off). */
  newInstallmentAmount: bigint | null;
  newTenorMonths: number | null;
}

function totalInterest(rows: ScheduleRow[]): bigint {
  return rows.reduce((sum, row) => sum + row.interest, 0n);
}

interface AfterState {
  rows: ScheduleRow[];
  newInstallmentAmount: bigint | null;
  newTenorMonths: number | null;
}

function afterState(input: PrepaymentInput, balanceAfter: bigint): AfterState {
  if (balanceAfter === 0n) {
    return { rows: [], newInstallmentAmount: null, newTenorMonths: null };
  }
  const base = { ...input.schedule, remainingBalance: balanceAfter };
  if (input.mode === "reduce_installment") {
    const rows = buildSchedule({ ...base, recomputeAtStart: true });
    return {
      rows,
      newInstallmentAmount: rows[0]?.installment ?? null,
      newTenorMonths: null,
    };
  }
  const installment = currentInstallment(input.schedule);
  const months =
    installment === null
      ? null
      : monthsToPayOff(
          balanceAfter,
          rateAt(ratePlanOf(input.schedule), input.schedule.firstPeriod)
            .ratePercent,
          installment,
        );
  if (installment === null || months === null) {
    throw new RangeError("installment never pays off the balance");
  }
  return {
    rows: buildSchedule({
      ...base,
      installmentAmount: installment,
      remainingMonths: months,
      recomputeAtStart: false,
    }),
    newInstallmentAmount: installment,
    newTenorMonths: input.schedule.firstPeriod - 1 + months,
  };
}

/**
 * Prepays `amount` of principal right before the next installment
 * (`schedule.firstPeriod`); accrued interest since the last installment is
 * not modelled (monthly rest).
 */
export function simulatePrepayment(input: PrepaymentInput): PrepaymentResult {
  const balance = input.schedule.remainingBalance;
  const prepaid = input.mode === "full" ? balance : input.amount;
  if (prepaid <= 0n || prepaid > balance) {
    throw new RangeError("prepayment must be > 0 and <= the remaining balance");
  }
  const before = buildSchedule(input.schedule);
  const after = afterState(input, balance - prepaid);
  const penalty = prepaymentPenalty(prepaid, input.penaltyPercent);
  const totalInterestBefore = totalInterest(before);
  const totalInterestAfter = totalInterest(after.rows);
  const interestSaved = totalInterestBefore - totalInterestAfter;
  return {
    mode: prepaid === balance ? "full" : input.mode,
    prepaidPrincipal: prepaid,
    penalty,
    cashOutNow: prepaid + penalty,
    installmentBefore: before[0]?.installment ?? null,
    installmentAfter: after.rows[0]?.installment ?? null,
    remainingMonthsBefore: before.length,
    remainingMonthsAfter: after.rows.length,
    totalInterestBefore,
    totalInterestAfter,
    interestSaved,
    netSaving: interestSaved - penalty,
    newInstallmentAmount: after.newInstallmentAmount,
    newTenorMonths: after.newTenorMonths,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `pnpm exec jest src/liabilities/prepayment.util.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/prepayment.util.ts src/liabilities/prepayment.util.spec.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/prepayment.util.ts apps/api/src/liabilities/prepayment.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): simulate KPR early repayment (full, reduce tenor, reduce installment)

Before/after projections both come from buildSchedule; the penalty is a
round-half-up percentage of the prepaid principal. Read-only by design.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 5: Schema, migration, validation, DTOs, contracts, response shape

**Files:**

- Modify: `apps/api/prisma/schema.prisma` — enums after `enum InterestMethod` (~line 127); the `model Liability` block after `floatingRate` (~line 1241); two new models after `model Liability`.
- Create: `apps/api/prisma/migrations/20260926120000_revisi_k_kpr_rate_plans/migration.sql`
- Create: `apps/api/src/liabilities/rate-plan.validation.ts`, `apps/api/src/liabilities/rate-plan.validation.spec.ts`
- Create: `apps/api/src/liabilities/dto/rate-period.dto.ts`
- Modify: `apps/api/src/liabilities/dto/create-liability.dto.ts`, `apps/api/src/liabilities/dto/update-liability.dto.ts`, `apps/api/src/liabilities/dto/create-liability.dto.spec.ts`
- Modify: `apps/api/src/liabilities/dto/liability-response.dto.ts`
- Modify: `apps/api/src/liabilities/liabilities.service.ts` — imports, `LiabilityRow`, `toLiabilityDto`, `getSchedule`
- Create: `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts`
- Modify: `packages/contracts/src/liabilities/index.ts` (+ rebuilt `packages/contracts/dist`)
- Modify: `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx:90` and `:156`, `apps/web/src/app/(app)/anggaran/obligations-section.test.tsx:103`

**Interfaces:**

- Consumes: Tasks 1–2 (`RateSegment`, `RatePeriodKind`, `rateAt`, `sameRateRegime`, `hasFloatingSegment`, `ratePlanOf`, `parseRateScaledByHundred`).
- Produces:
  - **Prisma.**
    - `enum KprScheme { konvensional berjenjang flpp syariah_murabahah syariah_mmq }` and `enum RatePeriodKind { fixed floating }`.
    - `Liability.kprScheme KprScheme?`, plus the relations `ratePeriods`, `floatingRates`.
    - `LiabilityRatePeriod { id, familyGroupId, liabilityId, sequence Int, kind RatePeriodKind, months Int?, ratePercent Decimal(5,2) }` with unique `(liabilityId, sequence)`.
    - `LiabilityFloatingRate { id, familyGroupId, liabilityId, effectiveDate Date, ratePercent Decimal(5,2), note VarChar(200)?, createdByUserId String?, createdAt }` with unique `(liabilityId, effectiveDate)`.
    - Both child tables are `ON DELETE CASCADE` from `liabilities` and indexed on `familyGroupId`.
  - **`./rate-plan.validation`:**
    - `type KprSchemeValue`, `MAX_KPR_RATE_PERCENT = "30.00"`, `FLPP_MAX_TENOR_MONTHS = 480`.
    - `assertKprRate(ratePercent, field): void`.
    - `validateKprScheme(type, scheme): KprSchemeValue | null`.
    - `validateRatePeriods({ type, interestMethod, tenorMonths, kprScheme, periods, hasFloatingHistory }): RateSegment[]`.
    - `sameSegments(a: RateSegment[], b: RateSegment[]): boolean`.
    - All failures throw `BadRequestException` with an Indonesian message.
  - **Request DTOs.** `CreateLiabilityDto` and `UpdateLiabilityDto` gain `kprScheme?: KprScheme` and `ratePeriods?: RatePeriodDto[]` (1–10 entries). `RatePeriodDto = { kind; months?: number | null (1..600); ratePercent: /^\d{1,2}(\.\d{1,2})?$/ }`.
  - **Responses.**
    - `LiabilityResponseDto` gains `kprScheme: string | null`, `ratePeriods: LiabilityRatePeriodResponseDto[]` (always `[]` until Task 6a loads rows) , `currentRatePercent: string` and `currentInstallmentLate: boolean` (from `dueInstallment(...).late`, Task 3).
    - `LiabilityScheduleResponseDto` gains `rateBands: LiabilityRateBandDto[]` (`{ fromPeriod, toPeriod, ratePercent, kind }`) and `hasFloatingPeriod: boolean`.
    - Schedule **rows are unchanged**.
  - **Service helpers** (module-private in `liabilities.service.ts`):
    - `currentRateFor(liability, now): string`
    - `rateBandsFor(plan: RatePlan, rows: ScheduleRow[]): LiabilityRateBandDto[]`
    - `LiabilityRow` is now **exported** and gains `kprScheme?: KprSchemeValue | null`.
  - **Contracts:**
    - `KprScheme`, `RatePeriodKind`, `PrepaymentMode`.
    - `LiabilityRatePeriodDto`, `LiabilityRateBandDto`, `LiabilityFloatingRateDto`, `CreateLiabilityFloatingRateDto`, `LiabilityPrepaymentPreviewDto`.
    - The new fields on `LiabilityDto`, `Create/UpdateLiabilityDto` and `LiabilityScheduleDto`.

- [ ] **Step 1: Write the failing tests**

(a) Create `apps/api/src/liabilities/rate-plan.validation.spec.ts`:

```ts
import { BadRequestException } from "@nestjs/common";

import { legacyRatePlan } from "./rate-plan.util";
import {
  assertKprRate,
  sameSegments,
  validateKprScheme,
  validateRatePeriods,
} from "./rate-plan.validation";

const BERJENJANG = [
  { kind: "fixed" as const, months: 24, ratePercent: "3.50" },
  { kind: "fixed" as const, months: 12, ratePercent: "5.50" },
  { kind: "floating" as const, months: null, ratePercent: "11.00" },
];
const OK = {
  type: "kpr",
  interestMethod: "anuitas" as const,
  tenorMonths: 240,
  kprScheme: "berjenjang" as const,
  periods: BERJENJANG,
  hasFloatingHistory: false,
};

describe("validateRatePeriods — revisi K", () => {
  it("returns engine segments for a valid berjenjang plan", () => {
    expect(validateRatePeriods(OK)).toEqual(BERJENJANG);
  });

  it("omitted months on the last period means to maturity", () => {
    expect(
      validateRatePeriods({
        ...OK,
        kprScheme: "flpp",
        periods: [{ kind: "fixed", ratePercent: "5.00" }],
      }),
    ).toEqual([{ kind: "fixed", months: null, ratePercent: "5.00" }]);
  });

  it.each([
    ["not a KPR", { type: "kendaraan" }],
    ["not anuitas", { interestMethod: "flat" as const }],
    ["no tenor", { tenorMonths: null }],
    ["bounded periods fill the tenor", { tenorMonths: 36 }],
    [
      "open-ended period before the last",
      {
        periods: [
          { kind: "fixed" as const, months: null, ratePercent: "3.50" },
          ...BERJENJANG.slice(1),
        ],
      },
    ],
    ["last period bounded", { periods: BERJENJANG.slice(0, 2) }],
    [
      "rate above 30%",
      {
        periods: [
          { kind: "fixed" as const, months: null, ratePercent: "30.01" },
        ],
        kprScheme: null,
      },
    ],
    [
      "murabahah with a floating tail",
      { kprScheme: "syariah_murabahah" as const },
    ],
    [
      "FLPP over 480 months",
      {
        kprScheme: "flpp" as const,
        tenorMonths: 481,
        periods: [
          { kind: "fixed" as const, months: null, ratePercent: "5.00" },
        ],
      },
    ],
    [
      "dropping floating while history exists",
      {
        hasFloatingHistory: true,
        kprScheme: null,
        periods: [
          { kind: "fixed" as const, months: null, ratePercent: "6.00" },
        ],
      },
    ],
  ])("rejects: %s", (_label, patch) => {
    expect(() => validateRatePeriods({ ...OK, ...patch })).toThrow(
      BadRequestException,
    );
  });

  it("accepts 30.00% and 0% exactly", () => {
    expect(() => assertKprRate("30.00", "r")).not.toThrow();
    expect(() => assertKprRate("0", "r")).not.toThrow();
  });
});

describe("validateKprScheme — revisi K", () => {
  it("only a KPR carries a scheme", () => {
    expect(validateKprScheme("kpr", "flpp")).toBe("flpp");
    expect(validateKprScheme("kendaraan", undefined)).toBeNull();
    expect(() => validateKprScheme("kendaraan", "flpp")).toThrow(
      BadRequestException,
    );
  });
});

describe("sameSegments — revisi K", () => {
  it("compares rates by value and months exactly", () => {
    const a = legacyRatePlan("5.5", 36, "11").segments;
    expect(sameSegments(a, legacyRatePlan("5.50", 36, "11.00").segments)).toBe(
      true,
    );
    expect(sameSegments(a, legacyRatePlan("5.50", 24, "11.00").segments)).toBe(
      false,
    );
    expect(sameSegments(a, legacyRatePlan("5.51", 36, "11.00").segments)).toBe(
      false,
    );
    expect(sameSegments(a, a.slice(0, 1))).toBe(false);
  });
});
```

(b) Append to `apps/api/src/liabilities/dto/create-liability.dto.spec.ts` (after the last `});`):

```ts
describe("Create/UpdateLiabilityDto — revisi K rate periods", () => {
  const KPR = { ...BASE, type: "kpr" };
  const BERJENJANG = [
    { kind: "fixed", months: 24, ratePercent: "3.50" },
    { kind: "fixed", months: 12, ratePercent: "5.50" },
    { kind: "floating", months: null, ratePercent: "11.00" },
  ];

  it("accepts a berjenjang plan with a scheme", async () => {
    expect(
      await invalidProps(CreateLiabilityDto, {
        ...KPR,
        kprScheme: "berjenjang",
        ratePeriods: BERJENJANG,
      }),
    ).toEqual([]);
  });

  it.each([
    ["kprScheme", "kpr_biasa"],
    ["ratePeriods", []],
    ["ratePeriods", [{ kind: "tetap", ratePercent: "5" }]],
    ["ratePeriods", [{ kind: "fixed", months: 0, ratePercent: "5" }]],
    ["ratePeriods", [{ kind: "fixed", ratePercent: "5,5" }]],
    ["ratePeriods", [{ kind: "fixed", ratePercent: "100" }]],
    [
      "ratePeriods",
      Array.from({ length: 11 }, () => ({
        kind: "fixed",
        months: 1,
        ratePercent: "5",
      })),
    ],
  ])("CreateLiabilityDto rejects %s = %j", async (field, value) => {
    expect(
      await invalidProps(CreateLiabilityDto, { ...KPR, [field]: value }),
    ).toContain(field);
  });

  it("UpdateLiabilityDto validates ratePeriods the same way", async () => {
    expect(
      await invalidProps(UpdateLiabilityDto, { ratePeriods: BERJENJANG }),
    ).toEqual([]);
    expect(
      await invalidProps(UpdateLiabilityDto, {
        ratePeriods: [{ kind: "fixed", months: 0, ratePercent: "5" }],
      }),
    ).toContain("ratePeriods");
  });
});
```

(c) Create `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts`. This is the shared K harness; Tasks 6a, 6b, 7, 8, 9 and 10 append `describe` blocks inside the top-level `describe`.

```ts
import { Test } from "@nestjs/testing";

import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";

import { LiabilitiesService } from "./liabilities.service";

jest.mock("../transactions/transaction-alerts.util", () => ({
  checkBudgetAlert: jest.fn(),
  checkCashFlowAlert: jest.fn(),
  notifyTransaction: jest.fn(),
}));

function makePrisma() {
  const prisma = {
    liability: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    liabilityRatePeriod: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    liabilityFloatingRate: { findMany: jest.fn().mockResolvedValue([]) },
    account: { findUnique: jest.fn(), update: jest.fn() },
    member: { findUnique: jest.fn() },
    category: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ coaAccountId: "coa-5" }),
      create: jest.fn(),
    },
    coaAccount: { findFirst: jest.fn(), update: jest.fn() },
    budget: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

// Berjenjang 500 jt / 240 bln, akad 2026-01-15: 3.50% x24, 5.50% x12, floating 11.00%.
const KPR = {
  id: "lid-1",
  familyGroupId: "fg-1",
  name: "KPR BTN",
  institution: "BTN",
  type: "kpr",
  totalDebt: 500_000_000n,
  remainingBalance: 500_000_000n,
  minimumPayment: 2_899_799n,
  interestRate: { toString: () => "3.50" },
  dueDate: null,
  autoAdvanceDueDate: false,
  notes: null,
  currency: "IDR",
  interestMethod: "anuitas",
  tenorMonths: 240,
  startDate: new Date("2026-01-15T00:00:00.000Z"),
  installmentAmount: 2_899_799n,
  fixedRateMonths: null,
  floatingRate: null,
  kprScheme: "berjenjang",
  principalCategoryId: "cat-principal",
  createdAt: new Date("2026-01-15T00:00:00.000Z"),
  updatedAt: new Date("2026-01-15T00:00:00.000Z"),
};
// G-era row: 8% fixed 36 bln then 11% floating, no K rows.
const LEGACY_KPR = {
  ...KPR,
  interestRate: { toString: () => "8.00" },
  installmentAmount: 4_182_200n,
  minimumPayment: 4_182_200n,
  fixedRateMonths: 36,
  floatingRate: { toString: () => "11.00" },
  kprScheme: null,
};

describe("LiabilitiesService — revisi K", () => {
  let service: LiabilitiesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = makePrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LiabilitiesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { send: jest.fn(), sendEmail: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(LiabilitiesService);
  });

  describe("response shape (legacy rows)", () => {
    it("findAll exposes currentRatePercent from the plan, no scheme, no stored periods", async () => {
      prisma.liability.findMany.mockResolvedValue([LEGACY_KPR]);

      const [dto] = await service.findAll(
        "fg-1",
        new Date("2029-02-20T00:00:00.000Z"),
      );

      expect(dto?.currentRatePercent).toBe("11.00");
      // #37 fell due 2029-02-15: 2029-02-20 is inside the 5-day grace window.
      expect(dto?.currentInstallmentLate).toBe(true);
      expect(dto?.kprScheme).toBeNull();
      expect(dto?.ratePeriods).toEqual([]);
    });

    it("getSchedule returns rate bands over the rows and flags the floating tail", async () => {
      prisma.liability.findUnique.mockResolvedValue(LEGACY_KPR);

      const schedule = await service.getSchedule(
        "fg-1",
        "lid-1",
        new Date("2026-01-20T00:00:00.000Z"),
      );

      expect(schedule.rows).toHaveLength(240);
      expect(schedule.rateBands).toEqual([
        { fromPeriod: 1, toPeriod: 36, ratePercent: "8.00", kind: "fixed" },
        {
          fromPeriod: 37,
          toPeriod: 240,
          ratePercent: "11.00",
          kind: "floating",
        },
      ]);
      expect(schedule.hasFloatingPeriod).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/rate-plan.validation.spec.ts src/liabilities/dto/create-liability.dto.spec.ts src/liabilities/liabilities.service.rate-plan.spec.ts`
Expected: FAIL. You should see "Cannot find module './rate-plan.validation'", the DTO accepts `kprScheme: "kpr_biasa"` (no error property), and `currentRatePercent` is undefined.

- [ ] **Step 3a: Schema + migration**

In `apps/api/prisma/schema.prisma`, after the closing `}` of `enum InterestMethod`, add:

```prisma

enum KprScheme {
  konvensional
  berjenjang
  flpp
  syariah_murabahah
  syariah_mmq
}

enum RatePeriodKind {
  fixed
  floating
}
```

In `model Liability`, directly after `floatingRate        Decimal?      @db.Decimal(5, 2)`, add:

```prisma
  // Revisi K — scheme label; tiered periods and recorded floating changes live in child tables.
  kprScheme           KprScheme?
  ratePeriods         LiabilityRatePeriod[]
  floatingRates       LiabilityFloatingRate[]
```

After the closing `}` of `model Liability`, add:

```prisma

// Revisi K — ordered KPR rate periods; only the last (months null) runs to maturity.
model LiabilityRatePeriod {
  id            String         @id @default(uuid())
  familyGroupId String
  liabilityId   String
  sequence      Int
  kind          RatePeriodKind
  months        Int?
  ratePercent   Decimal        @db.Decimal(5, 2)
  liability     Liability      @relation(fields: [liabilityId], references: [id], onDelete: Cascade)

  @@unique([liabilityId, sequence])
  @@index([familyGroupId])
  @@map("liability_rate_periods")
}

// Revisi K — floating-rate changes the user recorded from bank notices.
model LiabilityFloatingRate {
  id              String    @id @default(uuid())
  familyGroupId   String
  liabilityId     String
  effectiveDate   DateTime  @db.Date
  ratePercent     Decimal   @db.Decimal(5, 2)
  note            String?   @db.VarChar(200)
  createdByUserId String?
  createdAt       DateTime  @default(now())
  liability       Liability @relation(fields: [liabilityId], references: [id], onDelete: Cascade)

  @@unique([liabilityId, effectiveDate])
  @@index([familyGroupId])
  @@map("liability_floating_rates")
}
```

Create `apps/api/prisma/migrations/20260926120000_revisi_k_kpr_rate_plans/migration.sql`:

```sql
-- Revisi K: KPR scheme label, tiered rate periods, recorded floating-rate changes. Additive; existing rows untouched.
CREATE TYPE "KprScheme" AS ENUM ('konvensional', 'berjenjang', 'flpp', 'syariah_murabahah', 'syariah_mmq');

CREATE TYPE "RatePeriodKind" AS ENUM ('fixed', 'floating');

ALTER TABLE "liabilities" ADD COLUMN "kprScheme" "KprScheme";

CREATE TABLE "liability_rate_periods" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" "RatePeriodKind" NOT NULL,
    "months" INTEGER,
    "ratePercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "liability_rate_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "liability_floating_rates" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "note" VARCHAR(200),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liability_floating_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "liability_rate_periods_liabilityId_sequence_key" ON "liability_rate_periods"("liabilityId", "sequence");

CREATE INDEX "liability_rate_periods_familyGroupId_idx" ON "liability_rate_periods"("familyGroupId");

CREATE UNIQUE INDEX "liability_floating_rates_liabilityId_effectiveDate_key" ON "liability_floating_rates"("liabilityId", "effectiveDate");

CREATE INDEX "liability_floating_rates_familyGroupId_idx" ON "liability_floating_rates"("familyGroupId");

ALTER TABLE "liability_rate_periods" ADD CONSTRAINT "liability_rate_periods_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "liability_floating_rates" ADD CONSTRAINT "liability_floating_rates_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Run (from `apps/api`): `pnpm exec prisma generate`
Expected: `✔ Generated Prisma Client`.

Verify the hand-written SQL against Prisma's own diff. No database is needed:

```bash
cd apps/api
PREV=$(mktemp --suffix=.prisma) && git show HEAD:apps/api/prisma/schema.prisma > "$PREV"
pnpm exec prisma migrate diff --from-schema-datamodel "$PREV" --to-schema-datamodel prisma/schema.prisma --script
```

Expected: the same statements as `migration.sql` (statement order and blank lines may differ). If they differ in substance, use Prisma's output.

- [ ] **Step 3b: Validation module**

Create `apps/api/src/liabilities/rate-plan.validation.ts`:

```ts
import { BadRequestException } from "@nestjs/common";

import {
  parseRateScaledByHundred,
  type InterestMethod,
} from "./amortisation.util";

import type { RatePeriodKind, RateSegment } from "./rate-plan.util";

export type KprSchemeValue =
  | "konvensional"
  | "berjenjang"
  | "flpp"
  | "syariah_murabahah"
  | "syariah_mmq";

export const MAX_KPR_RATE_PERCENT = "30.00";
// Kepmen PKP No. 1722/KPTS/M/2026 — FLPP tenor up to 40 years.
export const FLPP_MAX_TENOR_MONTHS = 480;
const FIXED_FULL_TENOR_SCHEMES: ReadonlySet<KprSchemeValue> = new Set([
  "flpp",
  "syariah_murabahah",
]);

export interface RatePeriodInput {
  kind: RatePeriodKind;
  months?: number | null;
  ratePercent: string;
}

export function assertKprRate(ratePercent: string, field: string): void {
  if (
    parseRateScaledByHundred(ratePercent) >
    parseRateScaledByHundred(MAX_KPR_RATE_PERCENT)
  ) {
    throw new BadRequestException(
      `${field} must be between 0 and ${MAX_KPR_RATE_PERCENT}`,
    );
  }
}

export function validateKprScheme(
  type: string,
  scheme: KprSchemeValue | null | undefined,
): KprSchemeValue | null {
  if (scheme && type !== "kpr") {
    throw new BadRequestException("Skema KPR hanya untuk liabilitas KPR");
  }
  return scheme ?? null;
}

/** Checks a submitted period list against the loan's terms and returns it as engine segments. */
export function validateRatePeriods(input: {
  type: string;
  interestMethod: InterestMethod;
  tenorMonths: number | null;
  kprScheme: KprSchemeValue | null;
  periods: RatePeriodInput[];
  hasFloatingHistory: boolean;
}): RateSegment[] {
  if (input.type !== "kpr") {
    throw new BadRequestException("Periode bunga hanya untuk KPR");
  }
  if (input.interestMethod !== "anuitas") {
    throw new BadRequestException("Periode bunga KPR memakai metode anuitas");
  }
  if (input.tenorMonths === null) {
    throw new BadRequestException("Isi tenor sebelum periode bunga");
  }
  const lastIndex = input.periods.length - 1;
  const segments = input.periods.map((period, index): RateSegment => {
    const months = period.months ?? null;
    if ((index === lastIndex) !== (months === null)) {
      throw new BadRequestException(
        "Hanya periode terakhir yang berlaku sampai akhir tenor",
      );
    }
    assertKprRate(period.ratePercent, `ratePeriods[${index}].ratePercent`);
    return { kind: period.kind, months, ratePercent: period.ratePercent };
  });
  const boundedMonths = segments.reduce((sum, s) => sum + (s.months ?? 0), 0);
  if (boundedMonths >= input.tenorMonths) {
    throw new BadRequestException(
      "Total periode bertenggat harus lebih pendek dari tenor",
    );
  }
  if (
    input.kprScheme !== null &&
    FIXED_FULL_TENOR_SCHEMES.has(input.kprScheme) &&
    (segments.length !== 1 || segments[0]?.kind !== "fixed")
  ) {
    throw new BadRequestException(
      "Skema ini berbunga/margin tetap sepanjang tenor — satu periode fixed",
    );
  }
  if (input.kprScheme === "flpp" && input.tenorMonths > FLPP_MAX_TENOR_MONTHS) {
    throw new BadRequestException("Tenor FLPP maksimal 480 bulan (40 tahun)");
  }
  if (
    input.hasFloatingHistory &&
    !segments.some((s) => s.kind === "floating")
  ) {
    throw new BadRequestException(
      "Hapus riwayat bunga floating sebelum menghapus periode floating",
    );
  }
  return segments;
}

/** Same periods, comparing rates by value ("5.5" equals "5.50"). */
export function sameSegments(a: RateSegment[], b: RateSegment[]): boolean {
  return (
    a.length === b.length &&
    a.every((segment, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        segment.kind === other.kind &&
        segment.months === other.months &&
        parseRateScaledByHundred(segment.ratePercent) ===
          parseRateScaledByHundred(other.ratePercent)
      );
    })
  );
}
```

- [ ] **Step 3c: Request DTOs**

Create `apps/api/src/liabilities/dto/rate-period.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RatePeriodKind } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

export class RatePeriodDto {
  @ApiProperty({ enum: RatePeriodKind })
  @IsEnum(RatePeriodKind)
  kind!: RatePeriodKind;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: 600,
    description:
      "Installments this period covers; null/omitted only on the last period (runs to maturity)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  months?: number | null;

  @ApiProperty({ description: "Annual rate or margin, e.g. '3.50' (0-30)" })
  @IsString()
  @Matches(/^\d{1,2}(\.\d{1,2})?$/, {
    message: "ratePercent must be a decimal string",
  })
  ratePercent!: string;
}
```

In **both** `create-liability.dto.ts` and `update-liability.dto.ts`:

- Add `import { Type } from "class-transformer";` after the `@nestjs/swagger` import.
- Change the `@prisma/client` import to `import { InterestMethod, KprScheme, LiabilityType } from "@prisma/client";`.
- Add `ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested` to the `class-validator` import, keeping it alphabetical.
- Add `import { RatePeriodDto } from "./rate-period.dto";` after the `fx-input.dto` import.
- Insert directly before `@FxInputsProperty()`:

```ts
  @ApiPropertyOptional({
    enum: KprScheme,
    description: "KPR scheme label (kpr only)",
  })
  @IsOptional()
  @IsEnum(KprScheme)
  kprScheme?: KprScheme;

  @ApiPropertyOptional({
    type: [RatePeriodDto],
    description:
      "Revisi K — ordered rate periods (kpr + anuitas); supersedes fixedRateMonths/floatingRate",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RatePeriodDto)
  ratePeriods?: RatePeriodDto[];

```

- [ ] **Step 3d: Response DTOs**

In `apps/api/src/liabilities/dto/liability-response.dto.ts`, insert **above** `export class LiabilityResponseDto`. Classes referenced by `type: [...]` must be declared first, or the decorator hits the TDZ.

```ts
export class LiabilityRatePeriodResponseDto {
  @ApiProperty({ enum: ["fixed", "floating"] }) kind!: "fixed" | "floating";
  @ApiProperty({ nullable: true, type: Number }) months!: number | null;
  @ApiProperty() ratePercent!: string;
}
```

In `LiabilityResponseDto`, after the `floatingRate` property, add:

```ts
  @ApiProperty({
    nullable: true,
    type: String,
    enum: [
      "konvensional",
      "berjenjang",
      "flpp",
      "syariah_murabahah",
      "syariah_mmq",
    ],
  })
  kprScheme!: string | null;
  @ApiProperty({ type: [LiabilityRatePeriodResponseDto] })
  ratePeriods!: LiabilityRatePeriodResponseDto[];
  @ApiProperty({ description: "Annual rate the next installment accrues at" })
  currentRatePercent!: string;
  @ApiProperty({
    description:
      "The installment now due is past its due day (inside the 5-day grace window) or the loan is past maturity",
  })
  currentInstallmentLate!: boolean;
```

Insert **above** `export class LiabilityScheduleResponseDto`:

```ts
export class LiabilityRateBandDto {
  @ApiProperty() fromPeriod!: number;
  @ApiProperty() toPeriod!: number;
  @ApiProperty() ratePercent!: string;
  @ApiProperty({ enum: ["fixed", "floating"] }) kind!: "fixed" | "floating";
}
```

In `LiabilityScheduleResponseDto`, after `rows`, add:

```ts
  @ApiProperty({
    type: [LiabilityRateBandDto],
    description: "Consecutive rows sharing one rate; floating bands are estimates",
  })
  rateBands!: LiabilityRateBandDto[];
  @ApiProperty() hasFloatingPeriod!: boolean;
```

- [ ] **Step 3e: Service response mapping**

In `apps/api/src/liabilities/liabilities.service.ts`:

(1) Replace the `./amortisation.util` import block with:

```ts
import {
  buildSchedule,
  computeInstallment,
  currentInstallment,
  defaultInterestMethod,
  monthsElapsed,
  parseRateScaledByHundred,
  dueInstallment,
  rateForPeriod,
  ratePlanOf,
  splitPayment,
  type InterestMethod,
  type SplitPaymentResult,
  type ScheduleInput,
  type ScheduleRow,
} from "./amortisation.util";
import {
  hasFloatingSegment,
  rateAt,
  sameRateRegime,
  type RatePlan,
  type ResolvedRate,
} from "./rate-plan.util";
import { type KprSchemeValue } from "./rate-plan.validation";
```

and add `LiabilityRateBandDto` to the `import type { … } from "./dto/liability-response.dto";` list.

(2) Change `type LiabilityRow = {` to `export type LiabilityRow = {`, and add `kprScheme?: KprSchemeValue | null;` after `floatingRate: { toString(): string } | null;`.

(3) Insert after `function budgetContribution(…) { … }`:

```ts
/** Annual rate the next installment (the schedule's first row) accrues at. */
function currentRateFor(liability: InstallmentTerms, now: Date): string {
  const input = scheduleInputFor(liability, now);
  return rateAt(ratePlanOf(input), input.firstPeriod).ratePercent;
}

/** Consecutive schedule rows under one rate regime, for the web's rate column. */
function rateBandsFor(
  plan: RatePlan,
  rows: ScheduleRow[],
): LiabilityRateBandDto[] {
  const bands: LiabilityRateBandDto[] = [];
  let previous: ResolvedRate | null = null;
  for (const row of rows) {
    const rate = rateAt(plan, row.period);
    const last = bands.at(-1);
    if (last && previous && sameRateRegime(previous, rate)) {
      last.toPeriod = row.period;
    } else {
      bands.push({
        fromPeriod: row.period,
        toPeriod: row.period,
        ratePercent: rate.ratePercent,
        kind: rate.kind,
      });
    }
    previous = rate;
  }
  return bands;
}
```

(4) In `toLiabilityDto`, after `floatingRate: liability.floatingRate?.toString() ?? null,`, add:

```ts
    kprScheme: liability.kprScheme ?? null,
    ratePeriods: [],
    currentRatePercent: currentRateFor(liability, now),
    currentInstallmentLate: dueInstallment(
      liability.startDate,
      now,
      liability.tenorMonths,
    ).late,
```

Task 6a replaces `ratePeriods: []` with the stored rows. No K rows can exist before Task 6b writes them.

(5) In `getSchedule`, replace

```ts
const rows = buildSchedule(scheduleInputFor(liability, now));
```

with

```ts
const input = scheduleInputFor(liability, now);
const rows = buildSchedule(input);
const plan = ratePlanOf(input);
```

and add to the returned object, after `rows: …`:

```ts
      rateBands: rateBandsFor(plan, rows),
      hasFloatingPeriod: hasFloatingSegment(plan),
```

- [ ] **Step 3f: Contracts**

In `packages/contracts/src/liabilities/index.ts`:

After `export type InterestMethod = …;`, add:

```ts
export type KprScheme =
  | "konvensional"
  | "berjenjang"
  | "flpp"
  | "syariah_murabahah"
  | "syariah_mmq";

export type RatePeriodKind = "fixed" | "floating";

export type PrepaymentMode = "full" | "reduce_tenor" | "reduce_installment";

// Revisi K — one KPR rate period; months null = runs to maturity (last period only).
export interface LiabilityRatePeriodDto {
  kind: RatePeriodKind;
  months: number | null;
  ratePercent: string;
}
```

In `LiabilityDto`, after `floatingRate: string | null;`, add:

```ts
  kprScheme: KprScheme | null;
  ratePeriods: LiabilityRatePeriodDto[];
  // Annual rate the next installment accrues at.
  currentRatePercent: string;
  // The installment now due is late (5-day grace window) or the loan is past maturity: the Pay dialog shows "Telat".
  currentInstallmentLate: boolean;
```

In **both** `CreateLiabilityDto` and `UpdateLiabilityDto`, after `floatingRate?: string;`, add:

```ts
  kprScheme?: KprScheme;
  ratePeriods?: LiabilityRatePeriodDto[];
```

Replace `export interface LiabilityScheduleDto { … }` with:

```ts
// Consecutive schedule rows sharing one rate; floating bands are estimates.
export interface LiabilityRateBandDto {
  fromPeriod: number;
  toPeriod: number;
  ratePercent: string;
  kind: RatePeriodKind;
}

export interface LiabilityScheduleDto {
  liabilityId: string;
  interestMethod: InterestMethod;
  installmentAmount: string | null;
  rows: LiabilityScheduleRowDto[];
  rateBands: LiabilityRateBandDto[];
  hasFloatingPeriod: boolean;
}
```

Append at the end of the file:

```ts
// Revisi K — a floating-rate change the user recorded from a bank notice.
export interface LiabilityFloatingRateDto {
  id: string;
  // YYYY-MM-DD
  effectiveDate: string;
  ratePercent: string;
  // First installment accruing at this rate; null when the loan has no Tanggal Akad.
  effectivePeriod: number | null;
  note: string | null;
  createdAt: string;
}

export interface CreateLiabilityFloatingRateDto {
  effectiveDate: string;
  ratePercent: string;
  note?: string;
}

// Revisi K — read-only early-repayment simulation; nothing is recorded.
export interface LiabilityPrepaymentPreviewDto {
  liabilityId: string;
  mode: PrepaymentMode;
  prepaidPrincipal: string;
  penaltyPercent: string;
  penalty: string;
  cashOutNow: string;
  installmentBefore: string | null;
  installmentAfter: string | null;
  remainingMonthsBefore: number;
  remainingMonthsAfter: number;
  totalInterestBefore: string;
  totalInterestAfter: string;
  interestSaved: string;
  // May be negative when the penalty exceeds the interest saved.
  netSaving: string;
  // True when the projection runs into a floating period (assumes today's floating rate persists).
  assumesCurrentFloatingRate: boolean;
}
```

Run (repo root): `pnpm --filter @wealthme/contracts build`
Expected: build succeeds, and `packages/contracts/dist/index.d.ts` contains `LiabilityPrepaymentPreviewDto`.

- [ ] **Step 3g: Web fixtures**

- In `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx`, inside `baseLiability`, after `floatingRate: null,` (line 90), add:

  ```ts
      kprScheme: null,
      ratePeriods: [],
      currentRatePercent: "2.25",
      currentInstallmentLate: false,
  ```

  In the schedule mock response (line ~156), after `rows: scheduleRows,`, add:

  ```ts
          rateBands: [],
          hasFloatingPeriod: false,
  ```

- In `apps/web/src/app/(app)/anggaran/obligations-section.test.tsx`, after `floatingRate: null,` (line 103), add the same four `LiabilityDto` lines as for `baseLiability`.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS. Every suite is green, including G's unchanged `liabilities.service.spec.ts` and `amortisation.util.spec.ts`. The new validation spec has 15 tests, the DTO spec has 9 more, and the K service spec has 2.

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(liabilitas|anggaran)"`
Expected: PASS with unchanged counts.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: no errors in files this task touched. Errors in sub-plan I's in-flight files are not yours; report them without fixing.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/rate-plan.validation.ts src/liabilities/rate-plan.validation.spec.ts src/liabilities/dto/rate-period.dto.ts src/liabilities/dto/create-liability.dto.ts src/liabilities/dto/update-liability.dto.ts src/liabilities/dto/create-liability.dto.spec.ts src/liabilities/dto/liability-response.dto.ts src/liabilities/liabilities.service.ts src/liabilities/liabilities.service.rate-plan.spec.ts`
Expected: exit 0. Fix by hand; no `--fix` on the service.

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/liabilitas/liabilitas.test.tsx" "src/app/(app)/anggaran/obligations-section.test.tsx"`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260926120000_revisi_k_kpr_rate_plans apps/api/src/liabilities/rate-plan.validation.ts apps/api/src/liabilities/rate-plan.validation.spec.ts apps/api/src/liabilities/dto apps/api/src/liabilities/liabilities.service.ts apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts packages/contracts/src/liabilities/index.ts packages/contracts/dist "apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx" "apps/web/src/app/(app)/anggaran/obligations-section.test.tsx"
git commit -m "$(cat <<'EOF'
feat(liabilities): KPR rate-period and floating-rate tables, validation, response shape

Additive migration: KprScheme/RatePeriodKind enums, liabilities.kprScheme,
liability_rate_periods and liability_floating_rates (tenant-indexed,
cascade from liabilities). Existing rows are untouched. DTOs accept
ratePeriods; responses expose currentRatePercent and schedule rate bands.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 6a: Load K rows and wire the plan into every reader (findAll / schedule / payment preview / pay / budget line)

**Files:**

- Create: `apps/api/src/liabilities/rate-plan.rows.ts`, `apps/api/src/liabilities/rate-plan.rows.spec.ts`
- Modify: `apps/api/src/liabilities/liabilities.service.ts` — imports, `LiabilityRow`/`InstallmentTerms`, `scheduleInputFor`, `withRatePlan`, `toLiabilityDto`, `splitLiabilityPayment`, `findAll`, `getSchedule`, `previewPayment`, `runPayment`; also a new public `resyncBudgetLine`
- Modify: `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts` (append)
- Modify: `apps/api/src/liabilities/liabilities.service.spec.ts` — **only** `makePrisma()`: add the two delegates below, so G's tests keep a harmless `[]` default.

**Interfaces:**

- Consumes:
  - Task 1: `RatePeriodKind`, `RatePlan`, `legacyRatePlan`.
  - Task 2: `ratePlanOf`, `effectivePeriodFor`.
  - Task 3: `dueInstallmentPeriod`, `scheduleInputFor(…, firstPeriod?)`.
  - Task 5: the Prisma delegates `liabilityRatePeriod` / `liabilityFloatingRate`, `currentRateFor`, `rateBandsFor`.
- Produces:
  - **`./rate-plan.rows`:**
    - `RatePeriodRow`, `FloatingRateRow`, `RatePlanRows`, `EMPTY_RATE_PLAN_ROWS`.
    - `type RatePlanClient = Pick<TxClient, "liabilityRatePeriod" | "liabilityFloatingRate">`.
    - `loadRatePlanRows(client, familyGroupId, liabilityIds)` — two queries total, both filtered by `familyGroupId`.
    - `ratePlanFromRows(rows, terms): RatePlan | undefined` — `undefined` means "no K data, G's columns apply".
  - **`LiabilitiesService`:**
    - `LiabilityRow` gains `ratePlanRows?: RatePlanRows`.
    - New module helper `withRatePlan(client, familyGroupId, row)`.
    - New public `resyncBudgetLine(tx, familyGroupId, liability: LiabilityRow, now)` (Task 7 calls it).
    - Every reader that feeds `scheduleInputFor` attaches `ratePlanRows` first, so the schedule, pay split, payment preview, `currentInstallmentAmount`, `currentRatePercent` and the budget line all see the same plan.
  - Writers (create/update) come in Task 6b. Until then, no K period rows can exist outside tests.

- [ ] **Step 1: Write the failing tests**

(a) Create `apps/api/src/liabilities/rate-plan.rows.spec.ts`:

```ts
import {
  EMPTY_RATE_PLAN_ROWS,
  loadRatePlanRows,
  ratePlanFromRows,
} from "./rate-plan.rows";
import { rateAt } from "./rate-plan.util";

const TERMS = {
  interestRate: { toString: () => "8.00" },
  fixedRateMonths: 36,
  floatingRate: { toString: () => "11.00" },
  startDate: new Date("2026-01-15T00:00:00.000Z"),
};
function floating(id: string, iso: string, rate: string) {
  return {
    id,
    liabilityId: "lid-1",
    effectiveDate: new Date(`${iso}T00:00:00.000Z`),
    ratePercent: { toString: () => rate },
    note: null,
    createdAt: new Date("2026-09-26T00:00:00.000Z"),
  };
}

describe("ratePlanFromRows — revisi K", () => {
  it("no K rows: undefined, so G's legacy columns drive the schedule untouched", () => {
    expect(ratePlanFromRows(EMPTY_RATE_PLAN_ROWS, TERMS)).toBeUndefined();
  });

  it("stored periods win over the legacy columns, ordered by sequence", () => {
    const plan = ratePlanFromRows(
      {
        ratePeriods: [
          {
            liabilityId: "lid-1",
            sequence: 1,
            kind: "floating",
            months: null,
            ratePercent: { toString: () => "11" },
          },
          {
            liabilityId: "lid-1",
            sequence: 0,
            kind: "fixed",
            months: 24,
            ratePercent: { toString: () => "3.5" },
          },
        ],
        floatingRates: [],
      },
      TERMS,
    );
    expect(plan?.segments).toEqual([
      { kind: "fixed", months: 24, ratePercent: "3.5" },
      { kind: "floating", months: null, ratePercent: "11" },
    ]);
  });

  it("history on a legacy G row rides on the legacy segments; same-period dates -> later date wins", () => {
    const plan = ratePlanFromRows(
      {
        ratePeriods: [],
        floatingRates: [
          floating("r2", "2031-01-20", "9.50"),
          floating("r1", "2031-01-16", "9.75"),
        ],
      },
      TERMS,
    );
    expect(plan?.segments[0]).toEqual({
      kind: "fixed",
      months: 36,
      ratePercent: "8.00",
    });
    expect(plan?.floatingChanges).toEqual([
      { effectivePeriod: 62, ratePercent: "9.75" },
      { effectivePeriod: 62, ratePercent: "9.50" },
    ]);
    expect(plan && rateAt(plan, 62).ratePercent).toBe("9.50");
    expect(plan && rateAt(plan, 61).ratePercent).toBe("11.00");
  });

  it("history without a start date cannot be placed and is ignored", () => {
    const plan = ratePlanFromRows(
      {
        ratePeriods: [],
        floatingRates: [floating("r1", "2031-01-15", "9.75")],
      },
      { ...TERMS, startDate: null },
    );
    expect(plan?.floatingChanges).toEqual([]);
  });
});

describe("loadRatePlanRows — revisi K", () => {
  it("one tenant-scoped query per table, grouped per liability", async () => {
    const period = (liabilityId: string) => ({
      liabilityId,
      sequence: 0,
      kind: "fixed",
      months: null,
      ratePercent: { toString: () => "5.00" },
    });
    const client = {
      liabilityRatePeriod: {
        findMany: jest.fn().mockResolvedValue([period("a"), period("b")]),
      },
      liabilityFloatingRate: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const rows = await loadRatePlanRows(client as never, "fg-1", [
      "a",
      "b",
      "c",
    ]);

    expect(client.liabilityRatePeriod.findMany).toHaveBeenCalledWith({
      where: { familyGroupId: "fg-1", liabilityId: { in: ["a", "b", "c"] } },
      orderBy: [{ liabilityId: "asc" }, { sequence: "asc" }],
    });
    expect(client.liabilityFloatingRate.findMany).toHaveBeenCalledWith({
      where: { familyGroupId: "fg-1", liabilityId: { in: ["a", "b", "c"] } },
      orderBy: [{ liabilityId: "asc" }, { effectiveDate: "asc" }],
    });
    expect(rows.get("a")?.ratePeriods).toHaveLength(1);
    expect(rows.get("b")?.ratePeriods).toHaveLength(1);
    expect(rows.get("c")).toEqual({ ratePeriods: [], floatingRates: [] });
  });

  it("no ids: no queries", async () => {
    const client = {
      liabilityRatePeriod: { findMany: jest.fn() },
      liabilityFloatingRate: { findMany: jest.fn() },
    };
    expect((await loadRatePlanRows(client as never, "fg-1", [])).size).toBe(0);
    expect(client.liabilityRatePeriod.findMany).not.toHaveBeenCalled();
  });
});
```

(b) In `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts`, add this constant right after `const KPR = { … };`:

```ts
const PERIOD_ROWS = [
  {
    liabilityId: "lid-1",
    sequence: 0,
    kind: "fixed",
    months: 24,
    ratePercent: { toString: () => "3.50" },
  },
  {
    liabilityId: "lid-1",
    sequence: 1,
    kind: "fixed",
    months: 12,
    ratePercent: { toString: () => "5.50" },
  },
  {
    liabilityId: "lid-1",
    sequence: 2,
    kind: "floating",
    months: null,
    ratePercent: { toString: () => "11.00" },
  },
];
```

Then, inside the top-level `describe("LiabilitiesService — revisi K", …)` after the `"response shape (legacy rows)"` block, add:

```ts
describe("rate plan readers", () => {
  function withPeriods() {
    prisma.liabilityRatePeriod.findMany.mockResolvedValue(PERIOD_ROWS);
  }

  it("schedule at 2028-02-21 (six days after #25 fell due): next installment #26 re-annuitised in tier 2, floating from #37", async () => {
    withPeriods();
    prisma.liability.findUnique.mockResolvedValue({
      ...KPR,
      remainingBalance: 462_956_643n,
    });

    const schedule = await service.getSchedule(
      "fg-1",
      "lid-1",
      new Date("2028-02-21T00:00:00.000Z"),
    );

    expect(schedule.rows[0]).toEqual({
      period: 26,
      installment: "3390269",
      interest: "2121885",
      principal: "1268384",
      remaining: "461688259",
    });
    expect(schedule.rows).toHaveLength(215);
    expect(schedule.rateBands).toEqual([
      { fromPeriod: 26, toPeriod: 36, ratePercent: "5.50", kind: "fixed" },
      { fromPeriod: 37, toPeriod: 240, ratePercent: "11.00", kind: "floating" },
    ]);
    expect(prisma.liabilityRatePeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyGroupId: "fg-1", liabilityId: { in: ["lid-1"] } },
      }),
    );
  });

  it.each([
    ["2028-01-14T08:00:00.000Z", "1353973", "2036296"],
    ["2028-01-15T08:00:00.000Z", "1353973", "2036296"],
    ["2028-01-20T08:00:00.000Z", "1353973", "2036296"],
    ["2028-01-21T08:00:00.000Z", "2127672", "1262597"],
    ["2028-02-15T08:00:00.000Z", "2127672", "1262597"],
  ])(
    "boundary: a payment on %s books interest %s (#24 from the day before through 5 days late in tier 1, #25 from day +6 in tier 2)",
    async (now, interest, principal) => {
      withPeriods();
      prisma.liability.findUnique.mockResolvedValue({
        ...KPR,
        remainingBalance: 464_219_240n,
      });

      const preview = await service.previewPayment(
        "fg-1",
        "lid-1",
        "3390269",
        new Date(now),
      );

      expect(preview.interest).toBe(interest);
      expect(preview.principal).toBe(principal);
    },
  );

  it.each([
    ["2028-01-15T08:00:00.000Z", 465_760_571n, "2899799", "3.50", false],
    ["2028-01-20T08:00:00.000Z", 465_760_571n, "2899799", "3.50", true],
    ["2028-01-21T08:00:00.000Z", 464_219_240n, "3390269", "5.50", false],
  ])(
    "Pay preset on %s is the installment pay() books (5-day grace at the tier boundary)",
    async (now, balance, preset, rate, late) => {
      withPeriods();
      prisma.liability.findMany.mockResolvedValue([
        { ...KPR, remainingBalance: balance },
      ]);

      const [dto] = await service.findAll("fg-1", new Date(now));

      expect(dto?.currentInstallmentAmount).toBe(preset);
      expect(dto?.currentRatePercent).toBe(rate);
      expect(dto?.currentInstallmentLate).toBe(late);
    },
  );

  it("floating history: a change effective 2031-01-15 bites at installment 61, not 60", async () => {
    withPeriods();
    prisma.liabilityFloatingRate.findMany.mockResolvedValue([
      {
        id: "fr-1",
        liabilityId: "lid-1",
        effectiveDate: new Date("2031-01-15T00:00:00.000Z"),
        ratePercent: { toString: () => "9.75" },
        note: null,
        createdAt: new Date("2031-01-10T00:00:00.000Z"),
      },
    ]);
    prisma.liability.findUnique.mockResolvedValue({
      ...KPR,
      remainingBalance: 428_462_235n,
    });

    const on60 = await service.previewPayment(
      "fg-1",
      "lid-1",
      "4869888",
      new Date("2031-01-15T08:00:00.000Z"),
    );
    const on61 = await service.previewPayment(
      "fg-1",
      "lid-1",
      "4869888",
      new Date("2031-02-15T08:00:00.000Z"),
    );

    expect(on60.interest).toBe("3927570");
    expect(on61.interest).toBe("3481256");
  });

  it("pay books the tier-2 interest the preview showed and syncs the budget line to the plan", async () => {
    withPeriods();
    const row = { ...KPR, remainingBalance: 464_219_240n };
    prisma.liability.findUnique.mockResolvedValue(row);
    prisma.account.findUnique.mockResolvedValue({
      id: "acc-1",
      familyGroupId: "fg-1",
      type: "bank",
      balance: 50_000_000n,
      name: "BCA",
    });
    prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
    prisma.liability.update.mockResolvedValue({
      ...row,
      remainingBalance: 462_956_643n,
    });

    const dto = await service.pay(
      "fg-1",
      "lid-1",
      { sourceAccountId: "acc-1", amount: "3390269" },
      new Date("2028-02-15T08:00:00.000Z"),
    );

    expect(prisma.liability.update).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-1" },
      data: { remainingBalance: { decrement: 1_262_597n } },
    });
    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ limitAmount: 3_390_269n }),
      }),
    );
    expect(dto.currentRatePercent).toBe("5.50");
    expect(dto.ratePeriods).toHaveLength(3);
  });

  it("findAll loads every liability's rows in one tenant-scoped query per table", async () => {
    prisma.liability.findMany.mockResolvedValue([
      KPR,
      { ...LEGACY_KPR, id: "lid-2" },
    ]);
    withPeriods();

    const dtos = await service.findAll(
      "fg-1",
      new Date("2028-02-21T00:00:00.000Z"),
    );

    expect(prisma.liabilityRatePeriod.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.liabilityRatePeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyGroupId: "fg-1",
          liabilityId: { in: ["lid-1", "lid-2"] },
        },
      }),
    );
    expect(dtos[0]?.ratePeriods).toEqual([
      { kind: "fixed", months: 24, ratePercent: "3.50" },
      { kind: "fixed", months: 12, ratePercent: "5.50" },
      { kind: "floating", months: null, ratePercent: "11.00" },
    ]);
    expect(dtos[0]?.currentRatePercent).toBe("5.50");
    expect(dtos[1]?.ratePeriods).toEqual([]);
    expect(dtos[1]?.currentRatePercent).toBe("8.00");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/rate-plan.rows.spec.ts src/liabilities/liabilities.service.rate-plan.spec.ts`
Expected: FAIL. You should see "Cannot find module './rate-plan.rows'", the schedule's first installment is still 2.899.799 (tier 1), and so on.

- [ ] **Step 3: Write minimal implementation**

(a) Create `apps/api/src/liabilities/rate-plan.rows.ts`:

```ts
import { type TxClient } from "../common/utils/serializable-retry.util";

import { effectivePeriodFor } from "./amortisation.util";
import {
  legacyRatePlan,
  type RatePeriodKind,
  type RatePlan,
  type RateSegment,
} from "./rate-plan.util";

export interface RatePeriodRow {
  liabilityId: string;
  sequence: number;
  kind: RatePeriodKind;
  months: number | null;
  ratePercent: { toString(): string };
}

export interface FloatingRateRow {
  id: string;
  liabilityId: string;
  effectiveDate: Date;
  ratePercent: { toString(): string };
  note: string | null;
  createdAt: Date;
}

export interface RatePlanRows {
  ratePeriods: RatePeriodRow[];
  floatingRates: FloatingRateRow[];
}

export const EMPTY_RATE_PLAN_ROWS: RatePlanRows = {
  ratePeriods: [],
  floatingRates: [],
};

export type RatePlanClient = Pick<
  TxClient,
  "liabilityRatePeriod" | "liabilityFloatingRate"
>;

export interface RatePlanTerms {
  interestRate: { toString(): string };
  fixedRateMonths: number | null;
  floatingRate: { toString(): string } | null;
  startDate: Date | null;
}

/** K rows for many liabilities: two queries total, both tenant-scoped. */
export async function loadRatePlanRows(
  client: RatePlanClient,
  familyGroupId: string,
  liabilityIds: string[],
): Promise<Map<string, RatePlanRows>> {
  if (liabilityIds.length === 0) return new Map();
  const where = { familyGroupId, liabilityId: { in: liabilityIds } };
  const [ratePeriods, floatingRates] = await Promise.all([
    client.liabilityRatePeriod.findMany({
      where,
      orderBy: [{ liabilityId: "asc" }, { sequence: "asc" }],
    }),
    client.liabilityFloatingRate.findMany({
      where,
      orderBy: [{ liabilityId: "asc" }, { effectiveDate: "asc" }],
    }),
  ]);
  return new Map(
    liabilityIds.map((id) => [
      id,
      {
        ratePeriods: ratePeriods.filter((row) => row.liabilityId === id),
        floatingRates: floatingRates.filter((row) => row.liabilityId === id),
      },
    ]),
  );
}

/** K's stored plan; undefined when the liability has no K rows, so G's legacy columns apply unchanged. */
export function ratePlanFromRows(
  rows: RatePlanRows,
  terms: RatePlanTerms,
): RatePlan | undefined {
  if (rows.ratePeriods.length === 0 && rows.floatingRates.length === 0) {
    return undefined;
  }
  const segments: RateSegment[] =
    rows.ratePeriods.length > 0
      ? [...rows.ratePeriods]
          .sort((a, b) => a.sequence - b.sequence)
          .map((row) => ({
            kind: row.kind,
            months: row.months,
            ratePercent: row.ratePercent.toString(),
          }))
      : legacyRatePlan(
          terms.interestRate.toString(),
          terms.fixedRateMonths,
          terms.floatingRate?.toString() ?? null,
        ).segments;
  const start = terms.startDate;
  // Stable sorts: two dates landing on the same period keep date order, so the later one wins.
  const floatingChanges =
    start === null
      ? []
      : [...rows.floatingRates]
          .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime())
          .map((row) => ({
            effectivePeriod: effectivePeriodFor(start, row.effectiveDate),
            ratePercent: row.ratePercent.toString(),
          }))
          .sort((a, b) => a.effectivePeriod - b.effectivePeriod);
  return { segments, floatingChanges };
}
```

(b) `apps/api/src/liabilities/liabilities.service.ts`:

1. **Imports.**
   - In the `./amortisation.util` import, remove `rateForPeriod`.
   - Add below the `./amortisation.util` import:

     ```ts
     import {
       EMPTY_RATE_PLAN_ROWS,
       loadRatePlanRows,
       ratePlanFromRows,
       type RatePlanClient,
       type RatePlanRows,
     } from "./rate-plan.rows";
     ```

2. **Types.** In `LiabilityRow`, after `kprScheme?: KprSchemeValue | null;`, add `ratePlanRows?: RatePlanRows;`. In `InstallmentTerms`'s `Pick<…>` union, add `| "ratePlanRows"`.

3. **`scheduleInputFor`.** In the returned object, after `floatingRatePercent: …,`, add:

   ```ts
       ratePlan: liability.ratePlanRows
         ? ratePlanFromRows(liability.ratePlanRows, liability)
         : undefined,
   ```

4. **New helper.** Add after `rateBandsFor`:

   ```ts
   async function withRatePlan<T extends { id: string }>(
     client: RatePlanClient,
     familyGroupId: string,
     row: T,
   ): Promise<T & { ratePlanRows: RatePlanRows }> {
     const rows = await loadRatePlanRows(client, familyGroupId, [row.id]);
     return { ...row, ratePlanRows: rows.get(row.id) ?? EMPTY_RATE_PLAN_ROWS };
   }
   ```

5. **`toLiabilityDto`.** Replace `ratePeriods: [],` with:

   ```ts
       ratePeriods: (liability.ratePlanRows?.ratePeriods ?? []).map((row) => ({
         kind: row.kind,
         months: row.months,
         ratePercent: row.ratePercent.toString(),
       })),
   ```

6. **`splitLiabilityPayment`.** Replace the `annualInterestRatePercent: rateForPeriod({ … }),` property with:

   ```ts
       annualInterestRatePercent: rateAt(
         ratePlanOf(scheduleInputFor(liability, now)),
         dueInstallmentPeriod(liability.startDate, now, liability.tenorMonths),
       ).ratePercent,
   ```

7. **`findAll`.** Replace the final `return liabilities.map(…)` with:

   ```ts
   const plans = await loadRatePlanRows(
     this.prisma,
     familyGroupId,
     liabilities.map((l) => l.id),
   );
   return liabilities.map((l) =>
     toLiabilityDto(
       { ...l, ratePlanRows: plans.get(l.id) },
       paidSet.has(l.id),
       now,
     ),
   );
   ```

8. **`getSchedule`.** Replace `const input = scheduleInputFor(liability, now);` with:

   ```ts
   const planned = await withRatePlan(this.prisma, familyGroupId, liability);
   const input = scheduleInputFor(planned, now);
   ```

9. **`previewPayment`.** After the `if (!liability) throw …` guard, add `const planned = await withRatePlan(this.prisma, familyGroupId, liability);`. Pass `planned` (not `liability`) to `splitLiabilityPayment`, and use `planned.remainingBalance` in `remainingAfter`.

10. **`runPayment`.**
    - After the `if (!liability) throw …` guard, add `const planned = await withRatePlan(tx, familyGroupId, liability);`.
    - Pass `planned` to `splitLiabilityPayment(…)`.
    - In the `budgetContribution({ ...liability, remainingBalance: … })` call, spread `planned` instead of `liability`.
    - Change the final `liability: toLiabilityDto(updated, false, now),` to `liability: toLiabilityDto({ ...updated, ratePlanRows: planned.ratePlanRows }, false, now),`.

11. **Public resync** — add as the first method after `syncPrincipalBudgetLine`:

    ```ts
      /** Revisi K — re-derives this liability's budget line after its rate plan changed the current installment. */
      async resyncBudgetLine(
        tx: TxClient,
        familyGroupId: string,
        liability: LiabilityRow,
        now: Date,
      ): Promise<void> {
        if (liability.minimumPayment <= BigInt(0)) return;
        await this.syncPrincipalBudgetLine(
          tx,
          familyGroupId,
          liability,
          budgetContribution(liability, now),
        );
      }
    ```

(c) In `apps/api/src/liabilities/liabilities.service.spec.ts` (`makePrisma`, after the `liability: { … },` entry), add exactly:

```ts
    // Revisi K — no K rows by default, so every G test runs on the legacy columns.
    liabilityRatePeriod: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    liabilityFloatingRate: { findMany: jest.fn().mockResolvedValue([]) },
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS.

- The rows spec has 6 tests.
- The K service spec has 14: 2 from Task 5, plus 12 readers.
- G's `liabilities.service.spec.ts` passes with only the two `makePrisma` delegates added. Its exact `findUnique({ where })` assertion on `previewPayment` still holds, because K rows come from separate queries.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/rate-plan.rows.ts src/liabilities/rate-plan.rows.spec.ts src/liabilities/liabilities.service.ts src/liabilities/liabilities.service.spec.ts src/liabilities/liabilities.service.rate-plan.spec.ts`
Expected: exit 0 (hand-fix only).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/rate-plan.rows.ts apps/api/src/liabilities/rate-plan.rows.spec.ts apps/api/src/liabilities/liabilities.service.ts apps/api/src/liabilities/liabilities.service.spec.ts apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): KPR rate plan drives schedule, pay split, preview and budget line

Every reader loads the liability's rate periods and floating changes with
tenant-scoped queries (two per request) and runs the one plan-aware
engine; G rows without K data keep their legacy columns.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 6b: Rate-period writers — create / update / legacy upgrade / orphaned history

**Files:**

- Modify: `apps/api/src/liabilities/rate-plan.rows.ts` (add `replaceRatePeriods`)
- Modify: `apps/api/src/liabilities/liabilities.service.ts` — imports, `assertNotMixedRateTerms`, `create`/`runCreate`, `runUpdate`
- Modify: `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts` (append)

**Interfaces:**

- Consumes:
  - Task 6a: `loadRatePlanRows`, `ratePlanFromRows`, `EMPTY_RATE_PLAN_ROWS`, `withRatePlan`, `PERIOD_ROWS`.
  - Task 5: `validateRatePeriods`, `validateKprScheme`, `sameSegments`, `KprSchemeValue`.
  - Task 1: `RateSegment`, `hasFloatingSegment`.
- Produces:
  - `replaceRatePeriods(client, familyGroupId, liabilityId, segments, floatingRates): Promise<RatePlanRows>`.
  - `runUpdate` builds `nextTerms` (the loan as it will be after the PATCH). Task 9 uses it to re-anchor a prepaid installment.
  - **Rules enforced** (400):
    - `ratePeriods` together with `fixedRateMonths`/`floatingRate` in one request.
    - `fixedRateMonths`/`floatingRate` sent for a liability that already has periods.
    - Any update whose resulting terms break the stored periods (not KPR, not anuitas, tenor ≤ bounded months).
    - **Orphaned floating history:** recorded floating changes with no floating period left (or a non-anuitas method), with the same message as `validateRatePeriods`.
  - On update, the installment is recomputed only when a term _value_ changed. Rate periods are compared by value (`sameSegments`), so re-sending G's pair as equal periods keeps a user override.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts`:

- Add `import { BadRequestException } from "@nestjs/common";` as the first import line.
- Add `import { computeInstallment } from "./amortisation.util";` above the `./liabilities.service` import.
- Add this constant right after `PERIOD_ROWS`:

```ts
const BERJENJANG_BODY = [
  { kind: "fixed", months: 24, ratePercent: "3.50" },
  { kind: "fixed", months: 12, ratePercent: "5.50" },
  { kind: "floating", months: null, ratePercent: "11.00" },
] as never;
```

Then, after Task 6a's `"rate plan readers"` block, add:

```ts
describe("rate plan writers", () => {
  function withPeriods() {
    prisma.liabilityRatePeriod.findMany.mockResolvedValue(PERIOD_ROWS);
  }

  it("create: stores berjenjang periods, derives interestRate and the tier-1 installment, nulls the legacy pair", async () => {
    prisma.liability.create.mockResolvedValue({ ...KPR });

    await service.create("fg-1", {
      name: "KPR BTN",
      type: "kpr" as never,
      totalDebt: "500000000",
      remainingBalance: "500000000",
      interestRate: "9.99",
      tenorMonths: 240,
      kprScheme: "berjenjang" as never,
      ratePeriods: BERJENJANG_BODY,
    });

    expect(prisma.liability.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        interestMethod: "anuitas",
        interestRate: "3.50",
        installmentAmount: 2_899_799n,
        minimumPayment: 2_899_799n,
        fixedRateMonths: null,
        floatingRate: null,
        kprScheme: "berjenjang",
      }),
    });
    expect(prisma.liabilityRatePeriod.createMany).toHaveBeenCalledWith({
      data: [
        {
          liabilityId: "lid-1",
          familyGroupId: "fg-1",
          sequence: 0,
          kind: "fixed",
          months: 24,
          ratePercent: "3.50",
        },
        {
          liabilityId: "lid-1",
          familyGroupId: "fg-1",
          sequence: 1,
          kind: "fixed",
          months: 12,
          ratePercent: "5.50",
        },
        {
          liabilityId: "lid-1",
          familyGroupId: "fg-1",
          sequence: 2,
          kind: "floating",
          months: null,
          ratePercent: "11.00",
        },
      ],
    });
    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ limitAmount: 2_899_799n }),
      }),
    );
  });

  it.each([
    ["with fixedRateMonths", { fixedRateMonths: 36 }],
    ["on a kendaraan", { type: "kendaraan" as never }],
  ])("create: ratePeriods %s is refused", async (_label, patch) => {
    await expect(
      service.create("fg-1", {
        name: "KPR",
        type: "kpr" as never,
        totalDebt: "500000000",
        remainingBalance: "500000000",
        tenorMonths: 240,
        ratePeriods: BERJENJANG_BODY,
        ...patch,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.liability.create).not.toHaveBeenCalled();
  });

  it("legacy upgrade: G's pair re-sent as equal periods writes rows, nulls the pair, keeps an overridden installment", async () => {
    const overridden = {
      ...LEGACY_KPR,
      installmentAmount: 4_200_000n,
      minimumPayment: 4_200_000n,
    };
    prisma.liability.findUnique.mockResolvedValue(overridden);
    prisma.liability.findUniqueOrThrow.mockResolvedValue(overridden);
    prisma.liability.update.mockResolvedValue(overridden);

    await service.update(
      "fg-1",
      "lid-1",
      {
        ratePeriods: [
          { kind: "fixed", months: 36, ratePercent: "8" },
          { kind: "floating", months: null, ratePercent: "11" },
        ] as never,
      },
      new Date("2026-03-01T00:00:00.000Z"),
    );

    expect(prisma.liability.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          installmentAmount: 4_200_000n,
          minimumPayment: 4_200_000n,
          fixedRateMonths: null,
          floatingRate: null,
        }),
      }),
    );
    expect(prisma.liabilityRatePeriod.createMany).toHaveBeenCalledWith({
      data: [
        {
          liabilityId: "lid-1",
          familyGroupId: "fg-1",
          sequence: 0,
          kind: "fixed",
          months: 36,
          ratePercent: "8",
        },
        {
          liabilityId: "lid-1",
          familyGroupId: "fg-1",
          sequence: 1,
          kind: "floating",
          months: null,
          ratePercent: "11",
        },
      ],
    });
  });

  it("a real tier change recomputes the installment from the new first-tier rate", async () => {
    withPeriods();
    prisma.liability.findUnique.mockResolvedValue(KPR);
    prisma.liability.findUniqueOrThrow.mockResolvedValue(KPR);
    prisma.liability.update.mockResolvedValue(KPR);

    await service.update(
      "fg-1",
      "lid-1",
      {
        ratePeriods: [
          { kind: "fixed", months: 24, ratePercent: "3.00" },
          { kind: "fixed", months: 12, ratePercent: "5.50" },
          { kind: "floating", months: null, ratePercent: "11.00" },
        ] as never,
      },
      new Date("2026-03-01T00:00:00.000Z"),
    );

    const expected = computeInstallment({
      method: "anuitas",
      principal: 500_000_000n,
      annualInterestRatePercent: "3.00",
      tenorMonths: 240,
    });
    expect(expected).toBe(2_772_988n);
    expect(prisma.liability.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          interestRate: "3.00",
          installmentAmount: expected,
        }),
      }),
    );
  });

  it.each([
    ["fixedRateMonths on a row that has periods", { fixedRateMonths: 36 }],
    ["a tenor no longer longer than the bounded periods", { tenorMonths: 36 }],
    ["switching a planned KPR to flat", { interestMethod: "flat" as never }],
  ])("update refuses %s", async (_label, dto) => {
    withPeriods();
    prisma.liability.findUnique.mockResolvedValue(KPR);
    prisma.liability.findUniqueOrThrow.mockResolvedValue(KPR);

    await expect(service.update("fg-1", "lid-1", dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.liability.update).not.toHaveBeenCalled();
  });

  it("orphaned history: a legacy row with recorded floating changes refuses a PATCH that leaves them no floating period", async () => {
    prisma.liabilityFloatingRate.findMany.mockResolvedValue([
      {
        id: "fr-1",
        liabilityId: "lid-1",
        effectiveDate: new Date("2031-01-15T00:00:00.000Z"),
        ratePercent: { toString: () => "9.75" },
        note: null,
        createdAt: new Date("2031-01-10T00:00:00.000Z"),
      },
    ]);
    prisma.liability.findUnique.mockResolvedValue(LEGACY_KPR);
    prisma.liability.findUniqueOrThrow.mockResolvedValue(LEGACY_KPR);

    await expect(
      service.update("fg-1", "lid-1", { interestMethod: "flat" as never }),
    ).rejects.toThrow(
      "Hapus riwayat bunga floating sebelum menghapus periode floating",
    );
    expect(prisma.liability.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/liabilities.service.rate-plan.spec.ts -t "rate plan writers"`
Expected: FAIL. You should see `createMany` never called, `interestRate` not derived from period 1, no 400 for mixed terms, and the orphaned-history PATCH succeeds.

- [ ] **Step 3: Write minimal implementation**

(a) Append to `apps/api/src/liabilities/rate-plan.rows.ts`:

```ts
/** Rewrites a liability's periods (sequence = array order) and returns the rows as now stored. */
export async function replaceRatePeriods(
  client: Pick<TxClient, "liabilityRatePeriod">,
  familyGroupId: string,
  liabilityId: string,
  segments: RateSegment[],
  floatingRates: FloatingRateRow[],
): Promise<RatePlanRows> {
  const ratePeriods = segments.map((segment, sequence) => ({
    liabilityId,
    sequence,
    kind: segment.kind,
    months: segment.months,
    ratePercent: segment.ratePercent,
  }));
  await client.liabilityRatePeriod.deleteMany({
    where: { familyGroupId, liabilityId },
  });
  await client.liabilityRatePeriod.createMany({
    data: ratePeriods.map((row) => ({ ...row, familyGroupId })),
  });
  return { ratePeriods, floatingRates };
}
```

(b) `apps/api/src/liabilities/liabilities.service.ts`:

1. **Imports.**
   - Add `replaceRatePeriods` to the `./rate-plan.rows` import (Task 6a).
   - Extend the `./rate-plan.util` import with `type RateSegment`.
   - Change the `./rate-plan.validation` import to:

     ```ts
     import {
       sameSegments,
       validateKprScheme,
       validateRatePeriods,
       type KprSchemeValue,
     } from "./rate-plan.validation";
     ```

2. **New helper.** Add after `withRatePlan`:

   ```ts
   function assertNotMixedRateTerms(dto: {
     ratePeriods?: unknown;
     fixedRateMonths?: number;
     floatingRate?: string;
   }): void {
     if (
       dto.ratePeriods !== undefined &&
       (dto.fixedRateMonths !== undefined || dto.floatingRate !== undefined)
     ) {
       throw new BadRequestException(
         "Kirim ratePeriods atau fixedRateMonths/floatingRate, bukan keduanya",
       );
     }
   }
   ```

3. **`create`.** Replace everything from `const interestMethod =` down to the `runSerializableWithRetry(...)` call (inclusive) with:

   ```ts
   const interestMethod = dto.interestMethod ?? defaultInterestMethod(dto.type);
   assertMethodAllowed(dto.type, interestMethod);
   const kprScheme = validateKprScheme(dto.type, dto.kprScheme);
   assertNotMixedRateTerms(dto);
   const segments = dto.ratePeriods
     ? validateRatePeriods({
         type: dto.type,
         interestMethod,
         tenorMonths: dto.tenorMonths ?? null,
         kprScheme,
         periods: dto.ratePeriods,
         hasFloatingHistory: false,
       })
     : null;
   const interestRate = segments?.[0]?.ratePercent ?? dto.interestRate ?? "0";
   const installmentAmount = resolveInstallment({
     method: interestMethod,
     totalDebt,
     interestRate,
     tenorMonths: dto.tenorMonths ?? null,
     override: dto.installmentAmount
       ? guardBigInt("installmentAmount", dto.installmentAmount)
       : undefined,
   });
   // A fixed installment IS the monthly obligation: it drives the budget line and the Pay preset.
   const minimumPayment =
     installmentAmount ??
     (dto.minimumPayment
       ? guardBigInt("minimumPayment", dto.minimumPayment)
       : BigInt(0));

   const liability = await runSerializableWithRetry(this.prisma, (tx) =>
     this.runCreate(tx, familyGroupId, dto, {
       totalDebt,
       remainingBalance,
       minimumPayment,
       installmentAmount,
       interestMethod,
       interestRate,
       kprScheme,
       segments,
     }),
   );
   ```

4. **`runCreate`.**
   - Extend the `amounts` parameter type with `interestRate: string; kprScheme: KprSchemeValue | null; segments: RateSegment[] | null;`.
   - In `data`, set `interestRate: amounts.interestRate,`, `fixedRateMonths: amounts.segments ? null : (dto.fixedRateMonths ?? null),`, `floatingRate: amounts.segments ? null : (dto.floatingRate ?? null),`, and add `kprScheme: amounts.kprScheme,`.
   - Replace everything after `const created = await tx.liability.create({ data });` with:

     ```ts
         const ratePlanRows = amounts.segments
           ? await replaceRatePeriods(
               tx,
               familyGroupId,
               created.id,
               amounts.segments,
               [],
             )
           : EMPTY_RATE_PLAN_ROWS;
         const planned = { ...created, ratePlanRows };

         if (amounts.minimumPayment > BigInt(0)) {
           await this.syncPrincipalBudgetLine(
             tx,
             familyGroupId,
             planned,
             budgetContribution({ ...data, ratePlanRows }, new Date()),
           );
         }

         return planned;
       }
     ```

5. **`runUpdate`.**
   - Right after `const existing = await tx.liability.findUniqueOrThrow({ … });`, add:

     ```ts
     const existingRows =
       (await loadRatePlanRows(tx, familyGroupId, [id])).get(id) ??
       EMPTY_RATE_PLAN_ROWS;
     ```

   - Replace the `const resolvedInterestRate = …;` statement **and** the `const termsChanged = …;` statement with:

     ```ts
     const kprScheme =
       dto.kprScheme !== undefined
         ? validateKprScheme(type, dto.kprScheme)
         : (existing.kprScheme ?? null);
     assertNotMixedRateTerms(dto);
     const hasStoredPeriods = existingRows.ratePeriods.length > 0;
     if (
       hasStoredPeriods &&
       (dto.fixedRateMonths !== undefined || dto.floatingRate !== undefined)
     ) {
       throw new BadRequestException(
         "KPR ini memakai periode bunga — kirim ratePeriods, bukan fixedRateMonths/floatingRate",
       );
     }
     const previousSegments = ratePlanOf(
       scheduleInputFor({ ...existing, ratePlanRows: existingRows }, now),
     ).segments;
     const nextPeriods =
       dto.ratePeriods ?? (hasStoredPeriods ? previousSegments : null);
     const validated =
       nextPeriods === null
         ? null
         : validateRatePeriods({
             type,
             interestMethod,
             tenorMonths,
             kprScheme,
             periods: nextPeriods,
             hasFloatingHistory: existingRows.floatingRates.length > 0,
           });
     // Rows are rewritten only when the caller sent periods; otherwise they were just re-checked.
     const segments = dto.ratePeriods ? validated : null;
     const ratePlanChanged =
       segments !== null && !sameSegments(segments, previousSegments);
     const resolvedInterestRate =
       segments?.[0]?.ratePercent ??
       dto.interestRate ??
       existing.interestRate.toString();
     // Fix round 1 (Important #2) — compare resolved VALUES, not DTO field presence (see G).
     const termsChanged =
       type !== existing.type ||
       interestMethod !== existing.interestMethod ||
       tenorMonths !== existing.tenorMonths ||
       parseRateScaledByHundred(resolvedInterestRate) !==
         parseRateScaledByHundred(existing.interestRate.toString()) ||
       totalDebt !== existing.totalDebt ||
       ratePlanChanged;
     ```

   - Directly after `termsChanged`, add the resulting terms and the orphaned-history check. `validateRatePeriods` already covers rows that have periods; this covers legacy rows too. G's PATCH cannot null the legacy pair (`dto.floatingRate ?? existing…`), so on a legacy row the reachable path is a method switch; the check itself is plan-generic.

     ```ts
     // The loan as it will be after this PATCH (Task 9 re-anchors a prepaid installment from it).
     const nextTerms = {
       ...existing,
       type,
       interestMethod,
       tenorMonths,
       totalDebt,
       remainingBalance,
       interestRate: resolvedInterestRate,
       fixedRateMonths: segments
         ? null
         : (dto.fixedRateMonths ?? existing.fixedRateMonths),
       floatingRate: segments
         ? null
         : (dto.floatingRate ?? existing.floatingRate),
       ratePlanRows: segments
         ? {
             ratePeriods: segments.map((segment, sequence) => ({
               liabilityId: id,
               sequence,
               ...segment,
             })),
             floatingRates: existingRows.floatingRates,
           }
         : existingRows,
     };
     // Recorded floating changes need a floating period on an anuitas loan to apply to.
     if (
       existingRows.floatingRates.length > 0 &&
       (interestMethod !== "anuitas" ||
         !hasFloatingSegment(ratePlanOf(scheduleInputFor(nextTerms, now))))
     ) {
       throw new BadRequestException(
         "Hapus riwayat bunga floating sebelum menghapus periode floating",
       );
     }
     ```

   - In `data`, set `interestRate: segments?.[0]?.ratePercent ?? dto.interestRate ?? existing.interestRate,`, `fixedRateMonths: segments ? null : (dto.fixedRateMonths ?? existing.fixedRateMonths),`, `floatingRate: segments ? null : (dto.floatingRate ?? existing.floatingRate),`, and add `kprScheme,`.
   - Replace everything after `const updated = await tx.liability.update({ … });` with:

     ```ts
         const ratePlanRows = segments
           ? await replaceRatePeriods(
               tx,
               familyGroupId,
               id,
               segments,
               existingRows.floatingRates,
             )
           : existingRows;

         await this.syncPrincipalBudgetLine(
           tx,
           familyGroupId,
           { ...updated, principalCategoryId: existing.principalCategoryId },
           budgetContribution({ ...existing, ...data, ratePlanRows }, now),
         );

         return { ...updated, ratePlanRows };
       }
     ```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS. The K service spec has 23 tests: 14, plus 9 writers.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/rate-plan.rows.ts src/liabilities/liabilities.service.ts src/liabilities/liabilities.service.rate-plan.spec.ts`
Expected: exit 0 (hand-fix only).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/rate-plan.rows.ts apps/api/src/liabilities/liabilities.service.ts apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): create and update KPR rate periods

Create/update validate and store ordered rate periods (legacy pair nulled;
equal periods keep a user-overridden installment) and refuse an update
that would orphan recorded floating-rate history.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 7: Floating-rate history endpoints (tenant-scoped, ability-guarded, validated)

**Files:**

- Create: `apps/api/src/liabilities/dto/create-floating-rate.dto.ts`
- Modify: `apps/api/src/liabilities/dto/liability-response.dto.ts` (append `LiabilityFloatingRateResponseDto`)
- Create: `apps/api/src/liabilities/liability-floating-rates.service.ts`, `apps/api/src/liabilities/liability-floating-rates.service.spec.ts`
- Create: `apps/api/src/liabilities/liability-floating-rates.controller.ts`, `apps/api/src/liabilities/liability-floating-rates.controller.spec.ts`
- Modify: `apps/api/src/liabilities/liabilities.module.ts`
- Modify: `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts` (append a `resyncBudgetLine` block)

**Interfaces:**

- Consumes:
  - Task 6a: `LiabilitiesService.resyncBudgetLine(tx, familyGroupId, liability: LiabilityRow, now)`, `loadRatePlanRows`, `ratePlanFromRows`, `EMPTY_RATE_PLAN_ROWS`, `FloatingRateRow`, `RatePlanRows`.
  - Task 5: `assertKprRate`.
  - Task 1: `legacyRatePlan`, `hasFloatingSegment`.
  - Task 2: `effectivePeriodFor`.
  - Also `runSerializableWithRetry` and `TxClient` (`common/utils/serializable-retry.util`).
- Produces:
  - Routes under `family-groups/:familyGroupId/liabilities/:id/floating-rates`, all `@PageAccess("liabilities")`:
    - `GET /` → `read Liability` → `LiabilityFloatingRateResponseDto[]` (ascending by date).
    - `POST /` (body `{ effectiveDate: "YYYY-MM-DD", ratePercent: "9.75", note? }`) → `manage Liability` → 201 with `LiabilityFloatingRateResponseDto`.
    - `DELETE /:rateId` → `manage Liability` → 204.
  - `LiabilityFloatingRatesService.list(fg, id)`, `.add(fg, id, dto, userId: string | null, now = new Date())`, `.remove(fg, id, rateId, now = new Date())`.
  - Errors:
    - 404: liability outside the family, or an unknown `rateId`.
    - 400: no Tanggal Akad; no floating period in the plan (murabahah/FLPP/single rate); effective date before the akad; effective date past the last installment (`effectivePeriodFor > tenorMonths`); rate > 30.
    - 409: duplicate date (pre-check, and also P2002 after retries).
  - Writes run in `runSerializableWithRetry` and re-sync the budget line in the same transaction.

- [ ] **Step 1: Write the failing tests**

(a) Create `apps/api/src/liabilities/liability-floating-rates.service.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { LiabilityFloatingRatesService } from "./liability-floating-rates.service";

const NOW = new Date("2031-02-20T00:00:00.000Z");
const KPR = {
  id: "lid-1",
  familyGroupId: "fg-1",
  name: "KPR BTN",
  type: "kpr",
  interestMethod: "anuitas",
  interestRate: { toString: () => "8.00" },
  tenorMonths: 240,
  startDate: new Date("2026-01-15T00:00:00.000Z"),
  fixedRateMonths: 36,
  floatingRate: { toString: () => "11.00" },
  minimumPayment: 4_182_200n,
  remainingBalance: 427_404_522n,
};
const EXISTING = {
  id: "fr-0",
  liabilityId: "lid-1",
  effectiveDate: new Date("2030-01-15T00:00:00.000Z"),
  ratePercent: { toString: () => "10.50" },
  note: null,
  createdAt: new Date("2030-01-10T00:00:00.000Z"),
};

function makePrisma() {
  const prisma = {
    liability: { findUnique: jest.fn().mockResolvedValue(KPR) },
    liabilityRatePeriod: { findMany: jest.fn().mockResolvedValue([]) },
    liabilityFloatingRate: {
      findMany: jest.fn().mockResolvedValue([EXISTING]),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

describe("LiabilityFloatingRatesService — revisi K", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let liabilities: { resyncBudgetLine: jest.Mock };
  let service: LiabilityFloatingRatesService;

  beforeEach(() => {
    prisma = makePrisma();
    liabilities = { resyncBudgetLine: jest.fn() };
    service = new LiabilityFloatingRatesService(
      prisma as never,
      liabilities as never,
    );
  });

  it("add: stores the change tenant-scoped, returns its first installment, re-syncs the budget line in the same transaction", async () => {
    const created = {
      id: "fr-1",
      liabilityId: "lid-1",
      effectiveDate: new Date("2031-01-15T00:00:00.000Z"),
      ratePercent: { toString: () => "9.75" },
      note: null,
      createdAt: NOW,
    };
    prisma.liabilityFloatingRate.create.mockResolvedValue(created);

    const dto = await service.add(
      "fg-1",
      "lid-1",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      "user-1",
      NOW,
    );

    expect(prisma.liability.findUnique).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-1" },
    });
    expect(prisma.liabilityFloatingRate.create).toHaveBeenCalledWith({
      data: {
        familyGroupId: "fg-1",
        liabilityId: "lid-1",
        effectiveDate: new Date("2031-01-15T00:00:00.000Z"),
        ratePercent: "9.75",
        note: null,
        createdByUserId: "user-1",
      },
    });
    expect(dto).toEqual({
      id: "fr-1",
      effectiveDate: "2031-01-15",
      ratePercent: "9.75",
      effectivePeriod: 61,
      note: null,
      createdAt: NOW.toISOString(),
    });
    expect(liabilities.resyncBudgetLine).toHaveBeenCalledWith(
      prisma,
      "fg-1",
      expect.objectContaining({
        id: "lid-1",
        ratePlanRows: { ratePeriods: [], floatingRates: [EXISTING, created] },
      }),
      NOW,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("add: a liability of another family is a 404 and nothing is written", async () => {
    prisma.liability.findUnique.mockResolvedValue(null);

    await expect(
      service.add(
        "fg-2",
        "lid-1",
        { effectiveDate: "2031-01-15", ratePercent: "9.75" },
        null,
        NOW,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.liabilityFloatingRate.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      "before the akad",
      { effectiveDate: "2026-01-14", ratePercent: "9.75" },
      {},
    ],
    ["past maturity", { effectiveDate: "2046-01-15", ratePercent: "9.75" }, {}],
    ["above 30%", { effectiveDate: "2031-01-15", ratePercent: "30.01" }, {}],
    [
      "without a Tanggal Akad",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      { startDate: null },
    ],
    [
      "on a loan with no floating period",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      { fixedRateMonths: null, floatingRate: null },
    ],
    [
      "on a flat loan",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      { interestMethod: "flat" },
    ],
  ])("add: 400 %s", async (_label, dto, patch) => {
    prisma.liability.findUnique.mockResolvedValue({ ...KPR, ...patch });

    await expect(service.add("fg-1", "lid-1", dto, null, NOW)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.liabilityFloatingRate.create).not.toHaveBeenCalled();
  });

  it("add: a second change on the same date is a 409", async () => {
    await expect(
      service.add(
        "fg-1",
        "lid-1",
        { effectiveDate: "2030-01-15", ratePercent: "9.75" },
        null,
        NOW,
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.liabilityFloatingRate.create).not.toHaveBeenCalled();
  });

  it("add: a concurrent duplicate (P2002 after retries) is a 409, not a 500", async () => {
    prisma.liabilityFloatingRate.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      service.add(
        "fg-1",
        "lid-1",
        { effectiveDate: "2031-01-15", ratePercent: "9.75" },
        null,
        NOW,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("remove: deletes by id AND liability AND family, then re-syncs without it", async () => {
    await service.remove("fg-1", "lid-1", "fr-0", NOW);

    expect(prisma.liabilityFloatingRate.deleteMany).toHaveBeenCalledWith({
      where: { id: "fr-0", liabilityId: "lid-1", familyGroupId: "fg-1" },
    });
    expect(liabilities.resyncBudgetLine).toHaveBeenCalledWith(
      prisma,
      "fg-1",
      expect.objectContaining({
        ratePlanRows: { ratePeriods: [], floatingRates: [] },
      }),
      NOW,
    );
  });

  it("remove: an id that is not this liability's is a 404", async () => {
    await expect(
      service.remove("fg-1", "lid-1", "fr-other", NOW),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.liabilityFloatingRate.deleteMany).not.toHaveBeenCalled();
  });

  it("list: tenant-scoped, with each change's first installment", async () => {
    expect(await service.list("fg-1", "lid-1")).toEqual([
      {
        id: "fr-0",
        effectiveDate: "2030-01-15",
        ratePercent: "10.50",
        effectivePeriod: 49,
        note: null,
        createdAt: "2030-01-10T00:00:00.000Z",
      },
    ]);
    expect(prisma.liabilityFloatingRate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyGroupId: "fg-1", liabilityId: { in: ["lid-1"] } },
      }),
    );
  });
});
```

(b) Create `apps/api/src/liabilities/liability-floating-rates.controller.spec.ts`:

```ts
/**
 * Revisi K — AbilitiesGuard fails OPEN on an undecorated route, so every new
 * route is proven here against the REAL guard + CaslAbilityFactory (mirrors
 * liabilities.controller.spec.ts).
 */
import "reflect-metadata";

import { ForbiddenException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";

import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";

import { LiabilityFloatingRatesController } from "./liability-floating-rates.controller";
import { LiabilityFloatingRatesService } from "./liability-floating-rates.service";

import type { ExecutionContext } from "@nestjs/common";

function buildContext(
  controller: LiabilityFloatingRatesController,
  handler: keyof LiabilityFloatingRatesController,
  role: Role | null,
): ExecutionContext {
  const member = role ? { id: "m-1", userId: "u-1", role } : null;
  const req = {
    tenantContext: member
      ? { userId: member.userId, familyGroupId: "fg-1", role, member }
      : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => controller[handler],
    getClass: () => LiabilityFloatingRatesController,
  } as unknown as ExecutionContext;
}

describe("LiabilityFloatingRatesController (real AbilitiesGuard)", () => {
  const guard = new AbilitiesGuard(new Reflector(), new CaslAbilityFactory());
  const controller = new LiabilityFloatingRatesController({} as never);

  it("PERMISSION — owner/member/spouse can list, add and remove", () => {
    for (const role of [Role.owner, Role.member, Role.spouse]) {
      for (const handler of ["list", "add", "remove"] as const) {
        expect(guard.canActivate(buildContext(controller, handler, role))).toBe(
          true,
        );
      }
    }
  });

  it("PERMISSION — admin_staff can list but not add or remove", () => {
    expect(
      guard.canActivate(buildContext(controller, "list", Role.admin_staff)),
    ).toBe(true);
    for (const handler of ["add", "remove"] as const) {
      expect(() =>
        guard.canActivate(buildContext(controller, handler, Role.admin_staff)),
      ).toThrow(ForbiddenException);
    }
  });

  it("DENIAL — dependant/operational/anonymous are refused every route", () => {
    for (const role of [Role.dependant, Role.operational, null]) {
      for (const handler of ["list", "add", "remove"] as const) {
        expect(() =>
          guard.canActivate(buildContext(controller, handler, role)),
        ).toThrow(ForbiddenException);
      }
    }
  });
});

describe("LiabilityFloatingRatesController over HTTP", () => {
  async function bootstrap() {
    const service = {
      list: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue({ id: "fr-1" }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [LiabilityFloatingRatesController],
      providers: [
        { provide: LiabilityFloatingRatesService, useValue: service },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    return { app, service };
  }

  it("POST validates the body before the service (the DTO is a value import)", async () => {
    const { app, service } = await bootstrap();
    await request(app.getHttpServer())
      .post("/family-groups/fg-1/liabilities/lid-1/floating-rates")
      .send({ effectiveDate: "2031-02-30", ratePercent: "9.75" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/family-groups/fg-1/liabilities/lid-1/floating-rates")
      .send({ effectiveDate: "2031-01-15", ratePercent: "9,75" })
      .expect(400);
    expect(service.add).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post("/family-groups/fg-1/liabilities/lid-1/floating-rates")
      .send({ effectiveDate: "2031-01-15", ratePercent: "9.75" })
      .expect(201);
    expect(service.add).toHaveBeenCalledWith(
      "fg-1",
      "lid-1",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      null,
    );
    await app.close();
  });

  it("DELETE routes the rate id and answers 204", async () => {
    const { app, service } = await bootstrap();
    await request(app.getHttpServer())
      .delete("/family-groups/fg-1/liabilities/lid-1/floating-rates/fr-1")
      .expect(204);
    expect(service.remove).toHaveBeenCalledWith("fg-1", "lid-1", "fr-1");
    await app.close();
  });
});
```

(c) Append inside the top-level `describe` of `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts`:

```ts
describe("resyncBudgetLine", () => {
  it("re-derives the line from the plan including a recorded floating change (9.75% from #61)", async () => {
    await service.resyncBudgetLine(
      prisma as never,
      "fg-1",
      {
        ...KPR,
        remainingBalance: 427_404_522n,
        ratePlanRows: {
          ratePeriods: PERIOD_ROWS,
          floatingRates: [
            {
              id: "fr-1",
              liabilityId: "lid-1",
              effectiveDate: new Date("2031-01-15T00:00:00.000Z"),
              ratePercent: { toString: () => "9.75" },
              note: null,
              createdAt: new Date("2031-01-10T00:00:00.000Z"),
            },
          ],
        },
      } as never,
      new Date("2031-02-21T00:00:00.000Z"),
    );

    // Next is #62 with 179 left: 427,404,522 re-annuitised at 9.75%.
    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ limitAmount: 4_538_969n }),
      }),
    );
  });

  it("does nothing for a liability with no scheduled payment", async () => {
    await service.resyncBudgetLine(
      prisma as never,
      "fg-1",
      { ...KPR, minimumPayment: 0n } as never,
      new Date("2031-02-21T00:00:00.000Z"),
    );
    expect(prisma.budget.upsert).not.toHaveBeenCalled();
    expect(prisma.budget.deleteMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/liability-floating-rates src/liabilities/liabilities.service.rate-plan.spec.ts -t "LiabilityFloatingRates|resyncBudgetLine"`
Expected: FAIL with "Cannot find module './liability-floating-rates.service'" and "Cannot find module './liability-floating-rates.controller'". The `resyncBudgetLine` tests pass already (Task 6a); they pin the number.

- [ ] **Step 3: Write minimal implementation**

(a) Create `apps/api/src/liabilities/dto/create-floating-rate.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateFloatingRateDto {
  @ApiProperty({
    description: "Date the new rate takes effect (bank notice), YYYY-MM-DD",
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "effectiveDate must be YYYY-MM-DD",
  })
  @IsDateString({ strict: true })
  effectiveDate!: string;

  @ApiProperty({ description: "New annual floating rate, e.g. '9.75' (0-30)" })
  @IsString()
  @Matches(/^\d{1,2}(\.\d{1,2})?$/, {
    message: "ratePercent must be a decimal string",
  })
  ratePercent!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
```

(b) Append to `apps/api/src/liabilities/dto/liability-response.dto.ts`:

```ts
export class LiabilityFloatingRateResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: "YYYY-MM-DD" }) effectiveDate!: string;
  @ApiProperty() ratePercent!: string;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: "First installment accruing at this rate",
  })
  effectivePeriod!: number | null;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty() createdAt!: string;
}
```

(c) Create `apps/api/src/liabilities/liability-floating-rates.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  runSerializableWithRetry,
  type TxClient,
} from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { effectivePeriodFor } from "./amortisation.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LiabilitiesService } from "./liabilities.service";
import {
  EMPTY_RATE_PLAN_ROWS,
  loadRatePlanRows,
  ratePlanFromRows,
  type FloatingRateRow,
  type RatePlanRows,
} from "./rate-plan.rows";
import { hasFloatingSegment, legacyRatePlan } from "./rate-plan.util";
import { assertKprRate } from "./rate-plan.validation";

import type { CreateFloatingRateDto } from "./dto/create-floating-rate.dto";
import type { LiabilityFloatingRateResponseDto } from "./dto/liability-response.dto";

type LiabilityRecord = NonNullable<
  Awaited<ReturnType<TxClient["liability"]["findUnique"]>>
>;

const DUPLICATE_DATE_MESSAGE =
  "Sudah ada perubahan bunga pada tanggal ini — hapus dulu yang lama";

function toDto(
  row: FloatingRateRow,
  startDate: Date | null,
): LiabilityFloatingRateResponseDto {
  return {
    id: row.id,
    effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
    ratePercent: row.ratePercent.toString(),
    effectivePeriod: startDate
      ? effectivePeriodFor(startDate, row.effectiveDate)
      : null,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function assertFloatingRateAllowed(
  liability: LiabilityRecord,
  rows: RatePlanRows,
  effectiveDate: Date,
): void {
  const start = liability.startDate;
  if (start === null) {
    throw new BadRequestException(
      "Isi tanggal akad sebelum mencatat bunga floating",
    );
  }
  const plan =
    ratePlanFromRows(rows, liability) ??
    legacyRatePlan(
      liability.interestRate.toString(),
      liability.fixedRateMonths,
      liability.floatingRate?.toString() ?? null,
    );
  if (liability.interestMethod !== "anuitas" || !hasFloatingSegment(plan)) {
    throw new BadRequestException(
      "Liabilitas ini tidak punya periode bunga floating",
    );
  }
  const akadDay = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  if (effectiveDate.getTime() < akadDay) {
    throw new BadRequestException(
      "Tanggal efektif tidak boleh sebelum tanggal akad",
    );
  }
  if (
    liability.tenorMonths !== null &&
    effectivePeriodFor(start, effectiveDate) > liability.tenorMonths
  ) {
    throw new BadRequestException(
      "Tanggal efektif melewati cicilan terakhir — tidak memengaruhi cicilan mana pun",
    );
  }
}

@Injectable()
export class LiabilityFloatingRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liabilities: LiabilitiesService,
  ) {}

  async list(
    familyGroupId: string,
    liabilityId: string,
  ): Promise<LiabilityFloatingRateResponseDto[]> {
    const liability = await this.findLiability(
      this.prisma,
      familyGroupId,
      liabilityId,
    );
    const rows = await this.rowsFor(this.prisma, familyGroupId, liabilityId);
    return rows.floatingRates.map((row) => toDto(row, liability.startDate));
  }

  async add(
    familyGroupId: string,
    liabilityId: string,
    dto: CreateFloatingRateDto,
    userId: string | null,
    now: Date = new Date(),
  ): Promise<LiabilityFloatingRateResponseDto> {
    assertKprRate(dto.ratePercent, "ratePercent");
    const effectiveDate = new Date(`${dto.effectiveDate}T00:00:00.000Z`);
    try {
      return await runSerializableWithRetry(this.prisma, async (tx) => {
        const liability = await this.findLiability(
          tx,
          familyGroupId,
          liabilityId,
        );
        const rows = await this.rowsFor(tx, familyGroupId, liabilityId);
        assertFloatingRateAllowed(liability, rows, effectiveDate);
        if (
          rows.floatingRates.some(
            (row) => row.effectiveDate.getTime() === effectiveDate.getTime(),
          )
        ) {
          throw new ConflictException(DUPLICATE_DATE_MESSAGE);
        }
        const created = await tx.liabilityFloatingRate.create({
          data: {
            familyGroupId,
            liabilityId,
            effectiveDate,
            ratePercent: dto.ratePercent,
            note: dto.note ?? null,
            createdByUserId: userId,
          },
        });
        await this.liabilities.resyncBudgetLine(
          tx,
          familyGroupId,
          {
            ...liability,
            ratePlanRows: {
              ...rows,
              floatingRates: [...rows.floatingRates, created],
            },
          },
          now,
        );
        return toDto(created, liability.startDate);
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(DUPLICATE_DATE_MESSAGE);
      }
      throw err;
    }
  }

  async remove(
    familyGroupId: string,
    liabilityId: string,
    rateId: string,
    now: Date = new Date(),
  ): Promise<void> {
    await runSerializableWithRetry(this.prisma, async (tx) => {
      const liability = await this.findLiability(
        tx,
        familyGroupId,
        liabilityId,
      );
      const rows = await this.rowsFor(tx, familyGroupId, liabilityId);
      if (!rows.floatingRates.some((row) => row.id === rateId)) {
        throw new NotFoundException("Floating rate not found");
      }
      await tx.liabilityFloatingRate.deleteMany({
        where: { id: rateId, liabilityId, familyGroupId },
      });
      await this.liabilities.resyncBudgetLine(
        tx,
        familyGroupId,
        {
          ...liability,
          ratePlanRows: {
            ...rows,
            floatingRates: rows.floatingRates.filter(
              (row) => row.id !== rateId,
            ),
          },
        },
        now,
      );
    });
  }

  private async findLiability(
    client: Pick<TxClient, "liability">,
    familyGroupId: string,
    liabilityId: string,
  ): Promise<LiabilityRecord> {
    const liability = await client.liability.findUnique({
      where: { id: liabilityId, familyGroupId },
    });
    if (!liability) throw new NotFoundException("Liability not found");
    return liability;
  }

  private async rowsFor(
    client: Pick<TxClient, "liabilityRatePeriod" | "liabilityFloatingRate">,
    familyGroupId: string,
    liabilityId: string,
  ): Promise<RatePlanRows> {
    const rows = await loadRatePlanRows(client, familyGroupId, [liabilityId]);
    return rows.get(liabilityId) ?? EMPTY_RATE_PLAN_ROWS;
  }
}
```

(d) Create `apps/api/src/liabilities/liability-floating-rates.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateFloatingRateDto } from "./dto/create-floating-rate.dto";
import { LiabilityFloatingRateResponseDto } from "./dto/liability-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LiabilityFloatingRatesService } from "./liability-floating-rates.service";

import type { Request } from "express";

@ApiTags("liabilities")
@ApiBearerAuth()
@PageAccess("liabilities")
@Controller("family-groups/:familyGroupId/liabilities/:id/floating-rates")
export class LiabilityFloatingRatesController {
  constructor(private readonly floatingRates: LiabilityFloatingRatesService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Recorded KPR floating-rate changes, oldest first" })
  @ApiResponse({ status: 200, type: [LiabilityFloatingRateResponseDto] })
  list(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<LiabilityFloatingRateResponseDto[]> {
    return this.floatingRates.list(familyGroupId, id);
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Record a floating-rate change from a bank notice; the installment re-annuitises from its first whole month",
  })
  @ApiResponse({ status: 201, type: LiabilityFloatingRateResponseDto })
  @ApiResponse({
    status: 400,
    description: "Invalid date/rate or no floating period",
  })
  @ApiResponse({
    status: 409,
    description: "A change on this date already exists",
  })
  add(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: CreateFloatingRateDto,
    @Req() req: Request,
  ): Promise<LiabilityFloatingRateResponseDto> {
    return this.floatingRates.add(
      familyGroupId,
      id,
      dto,
      req.tenantContext?.userId ?? null,
    );
  }

  @Delete(":rateId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "rateId", type: String })
  @ApiOperation({ summary: "Delete a recorded floating-rate change" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Liability or rate not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("rateId") rateId: string,
  ): Promise<void> {
    return this.floatingRates.remove(familyGroupId, id, rateId);
  }
}
```

(e) In `apps/api/src/liabilities/liabilities.module.ts`:

- Import `LiabilityFloatingRatesController` and `LiabilityFloatingRatesService`.
- Set `controllers: [LiabilitiesController, LiabilityFloatingRatesController]` and `providers: [LiabilitiesService, LiabilityFloatingRatesService]`.
- Keep `exports: [LiabilitiesService]`.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS. The floating-rates service spec has 13 tests, the controller spec has 5, and the K service spec has 2 more (25 total). Everything else is unchanged.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/dto/create-floating-rate.dto.ts src/liabilities/dto/liability-response.dto.ts src/liabilities/liability-floating-rates.service.ts src/liabilities/liability-floating-rates.service.spec.ts src/liabilities/liability-floating-rates.controller.ts src/liabilities/liability-floating-rates.controller.spec.ts src/liabilities/liabilities.module.ts src/liabilities/liabilities.service.rate-plan.spec.ts`
Expected: exit 0 (hand-fix; never `--fix` on the service/controller/module).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/dto/create-floating-rate.dto.ts apps/api/src/liabilities/dto/liability-response.dto.ts apps/api/src/liabilities/liability-floating-rates.service.ts apps/api/src/liabilities/liability-floating-rates.service.spec.ts apps/api/src/liabilities/liability-floating-rates.controller.ts apps/api/src/liabilities/liability-floating-rates.controller.spec.ts apps/api/src/liabilities/liabilities.module.ts apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): record KPR floating-rate changes from bank notices

GET/POST/DELETE .../liabilities/:id/floating-rates, ability-guarded and
tenant-scoped. A change must fall between the akad and the last
installment, needs a floating period, and is unique per date (409). Each
write re-syncs the budget line in the same serializable transaction.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 8: `GET :id/prepayment-preview` (read-only simulation endpoint)

**Files:**

- Modify: `apps/api/src/liabilities/prepayment.util.ts` (add two constants)
- Create: `apps/api/src/liabilities/dto/prepayment-preview-query.dto.ts`
- Modify: `apps/api/src/liabilities/dto/liability-response.dto.ts` (append `LiabilityPrepaymentPreviewResponseDto`)
- Modify: `apps/api/src/liabilities/liabilities.service.ts` (new `previewPrepayment`)
- Modify: `apps/api/src/liabilities/liabilities.controller.ts` (new route) and `apps/api/src/liabilities/liabilities.controller.spec.ts` (`readRoutes` + an HTTP block)
- Modify: `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts` (append)

**Interfaces:**

- Consumes:
  - Task 4: `simulatePrepayment`, `PrepaymentMode`, `PrepaymentInput`, `PrepaymentResult`.
  - Task 6a: `withRatePlan`, `scheduleInputFor`; the existing `guardBigInt`.
  - Task 2: `ratePlanOf`.
  - Task 1: `rateAt`.
- Produces:
  - `DEFAULT_PREPAYMENT_PENALTY_PERCENT = "1.00"` and `MAX_PREPAYMENT_PENALTY_PERCENT = "10.00"`, exported from `./prepayment.util`.
  - Route `GET family-groups/:familyGroupId/liabilities/:id/prepayment-preview?mode=full|reduce_tenor|reduce_installment&amount=<digits>&penaltyPercent=<d.dd>`:
    - Requires `read Liability`, the same ability as `payment-preview`. It is read-only: no `$transaction`, no writes.
    - Returns `LiabilityPrepaymentPreviewResponseDto`, which matches the contract `LiabilityPrepaymentPreviewDto` from Task 5. Money is sent as strings; `assumesCurrentFloatingRate` is true when the last installment falls in a floating period.
  - `LiabilitiesService.previewPrepayment(familyGroupId, id, query: { mode; amount?; penaltyPercent? }, now = new Date())`.
    - 404: liability outside the family.
    - 400: not anuitas, or no tenor; `amount` missing on a partial prepayment; amount ≤ 0 or greater than the balance; penalty above 10 %.
  - **IDR-only** (Global Constraints): this is a query on a non-persisting route, so it has no `fxInputs`.

- [ ] **Step 1: Write the failing tests**

(a) Append inside the top-level `describe` of `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts`:

```ts
describe("previewPrepayment", () => {
  // Single-rate 11% KPR, akad 2021-01-15: 2026-01-21 is six days after #60 fell due, so #61 (180 left) is being paid.
  const AT_61 = {
    ...KPR,
    interestRate: { toString: () => "11.00" },
    remainingBalance: 400_000_000n,
    installmentAmount: 4_546_388n,
    minimumPayment: 4_546_388n,
    startDate: new Date("2021-01-15T00:00:00.000Z"),
    kprScheme: null,
  };
  const NOW = new Date("2026-01-21T00:00:00.000Z");

  it("reduce installment: golden numbers as strings, read-only", async () => {
    prisma.liability.findUnique.mockResolvedValue(AT_61);

    expect(
      await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "reduce_installment", amount: "100000000" },
        NOW,
      ),
    ).toEqual({
      liabilityId: "lid-1",
      mode: "reduce_installment",
      prepaidPrincipal: "100000000",
      penaltyPercent: "1.00",
      penalty: "1000000",
      cashOutNow: "101000000",
      installmentBefore: "4546388",
      installmentAfter: "3409791",
      remainingMonthsBefore: 180,
      remainingMonthsAfter: 180,
      totalInterestBefore: "418349734",
      totalInterestAfter: "313762283",
      interestSaved: "104587451",
      netSaving: "103587451",
      assumesCurrentFloatingRate: false,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.liability.update).not.toHaveBeenCalled();
  });

  it("reduce tenor: 180 -> 102 months at the same installment", async () => {
    prisma.liability.findUnique.mockResolvedValue(AT_61);

    const preview = await service.previewPrepayment(
      "fg-1",
      "lid-1",
      { mode: "reduce_tenor", amount: "100000000", penaltyPercent: "1.00" },
      NOW,
    );

    expect(preview.installmentAfter).toBe("4546388");
    expect(preview.remainingMonthsAfter).toBe(102);
    expect(preview.interestSaved).toBe("255703278");
  });

  it("full payoff ignores amount and applies the penalty to the whole balance", async () => {
    prisma.liability.findUnique.mockResolvedValue(AT_61);

    const preview = await service.previewPrepayment(
      "fg-1",
      "lid-1",
      { mode: "full", penaltyPercent: "2.50" },
      NOW,
    );

    expect(preview.penalty).toBe("10000000");
    expect(preview.cashOutNow).toBe("410000000");
    expect(preview.remainingMonthsAfter).toBe(0);
  });

  it("berjenjang at #13: reduce tenor keeps the tier step-ups and flags the floating assumption", async () => {
    prisma.liabilityRatePeriod.findMany.mockResolvedValue(PERIOD_ROWS);
    prisma.liability.findUnique.mockResolvedValue({
      ...KPR,
      remainingBalance: 482_422_215n,
    });

    const preview = await service.previewPrepayment(
      "fg-1",
      "lid-1",
      { mode: "reduce_tenor", amount: "50000000" },
      new Date("2027-01-21T00:00:00.000Z"),
    );

    expect(preview.penalty).toBe("500000");
    expect(preview.remainingMonthsAfter).toBe(196);
    expect(preview.interestSaved).toBe("158148844");
    expect(preview.assumesCurrentFloatingRate).toBe(true);
  });

  it.each([
    ["no amount on a partial prepayment", { mode: "reduce_tenor" as const }],
    [
      "an amount above the balance",
      { mode: "reduce_tenor" as const, amount: "400000001" },
    ],
    ["a zero amount", { mode: "reduce_installment" as const, amount: "0" }],
    ["a penalty above 10%", { mode: "full" as const, penaltyPercent: "10.01" }],
  ])("400: %s", async (_label, query) => {
    prisma.liability.findUnique.mockResolvedValue(AT_61);

    await expect(
      service.previewPrepayment("fg-1", "lid-1", query, NOW),
    ).rejects.toThrow(BadRequestException);
  });

  it("400 for a liability that is not an anuitas loan", async () => {
    prisma.liability.findUnique.mockResolvedValue({
      ...AT_61,
      interestMethod: "flat",
    });

    await expect(
      service.previewPrepayment("fg-1", "lid-1", { mode: "full" }, NOW),
    ).rejects.toThrow(BadRequestException);
  });

  it("404 for a liability of another family (tenant-scoped lookup)", async () => {
    prisma.liability.findUnique.mockResolvedValue(null);

    await expect(
      service.previewPrepayment("fg-2", "lid-1", { mode: "full" }, NOW),
    ).rejects.toThrow("Liability not found");
    expect(prisma.liability.findUnique).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-2" },
    });
  });
});
```

(b) In `apps/api/src/liabilities/liabilities.controller.spec.ts`, add `"previewPrepayment",` to the `readRoutes` array (after `"previewPayment",`). Then append at the end of the file:

```ts
describe("LiabilitiesController — GET :id/prepayment-preview over HTTP", () => {
  async function bootstrap() {
    const service = {
      previewPrepayment: jest.fn().mockResolvedValue({
        liabilityId: "lid-1",
        mode: "reduce_tenor",
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [LiabilitiesController],
      providers: [
        { provide: LiabilitiesService, useValue: service },
        ...fxTesting().providers,
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    return { app, service };
  }

  it("routes mode, amount and penalty to previewPrepayment", async () => {
    const { app, service } = await bootstrap();

    await request(app.getHttpServer())
      .get("/family-groups/fg-1/liabilities/lid-1/prepayment-preview")
      .query({
        mode: "reduce_tenor",
        amount: "100000000",
        penaltyPercent: "1.00",
      })
      .expect(200);

    expect(service.previewPrepayment).toHaveBeenCalledWith("fg-1", "lid-1", {
      mode: "reduce_tenor",
      amount: "100000000",
      penaltyPercent: "1.00",
    });
    await app.close();
  });

  it.each([
    [{ mode: "sebagian" }],
    [{ mode: "reduce_tenor", amount: "1e8" }],
    [{ mode: "full", penaltyPercent: "1,5" }],
  ])(
    "rejects %j before the service (the query DTO is a value import)",
    async (query) => {
      const { app, service } = await bootstrap();

      await request(app.getHttpServer())
        .get("/family-groups/fg-1/liabilities/lid-1/prepayment-preview")
        .query(query)
        .expect(400);

      expect(service.previewPrepayment).not.toHaveBeenCalled();
      await app.close();
    },
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/liabilities.service.rate-plan.spec.ts src/liabilities/liabilities.controller.spec.ts -t "previewPrepayment|prepayment-preview|PERMISSION|DENIAL"`
Expected: FAIL with "service.previewPrepayment is not a function", and `controller[handler]` is undefined for `previewPrepayment`.

- [ ] **Step 3: Write minimal implementation**

(a) In `apps/api/src/liabilities/prepayment.util.ts`, after `const PERCENT_DENOMINATOR = 10_000n;`, add:

```ts
// Research: commonly 1-3% of the prepaid principal, up to 7% (docs/research/2026-09-26-kpr-indonesia.md §6).
export const DEFAULT_PREPAYMENT_PENALTY_PERCENT = "1.00";
export const MAX_PREPAYMENT_PENALTY_PERCENT = "10.00";
```

(b) Create `apps/api/src/liabilities/dto/prepayment-preview-query.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";

import type { PrepaymentMode } from "../prepayment.util";

const MODES: PrepaymentMode[] = ["full", "reduce_tenor", "reduce_installment"];

export class PrepaymentPreviewQueryDto {
  @ApiProperty({ enum: MODES })
  @IsIn(MODES)
  mode!: PrepaymentMode;

  @ApiPropertyOptional({
    description:
      "Principal to prepay, whole rupiah (IDR only); required unless mode=full",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "amount must be a numeric string" })
  amount?: string;

  @ApiPropertyOptional({
    description: "Penalty % of the prepaid principal (0-10), default 1.00",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}(\.\d{1,2})?$/, {
    message: "penaltyPercent must be a decimal string",
  })
  penaltyPercent?: string;
}
```

(c) Append to `apps/api/src/liabilities/dto/liability-response.dto.ts`:

```ts
export class LiabilityPrepaymentPreviewResponseDto {
  @ApiProperty() liabilityId!: string;
  @ApiProperty({ enum: ["full", "reduce_tenor", "reduce_installment"] })
  mode!: "full" | "reduce_tenor" | "reduce_installment";
  @ApiProperty() prepaidPrincipal!: string;
  @ApiProperty() penaltyPercent!: string;
  @ApiProperty() penalty!: string;
  @ApiProperty() cashOutNow!: string;
  @ApiProperty({ nullable: true, type: String })
  installmentBefore!: string | null;
  @ApiProperty({ nullable: true, type: String })
  installmentAfter!: string | null;
  @ApiProperty() remainingMonthsBefore!: number;
  @ApiProperty() remainingMonthsAfter!: number;
  @ApiProperty() totalInterestBefore!: string;
  @ApiProperty() totalInterestAfter!: string;
  @ApiProperty() interestSaved!: string;
  @ApiProperty({
    description: "May be negative (penalty above interest saved)",
  })
  netSaving!: string;
  @ApiProperty({
    description:
      "True when the projection runs into a floating period (today's floating rate assumed to persist)",
  })
  assumesCurrentFloatingRate!: boolean;
}
```

(d) In `apps/api/src/liabilities/liabilities.service.ts`:

- Add the import:

  ```ts
  import {
    DEFAULT_PREPAYMENT_PENALTY_PERCENT,
    MAX_PREPAYMENT_PENALTY_PERCENT,
    simulatePrepayment,
    type PrepaymentInput,
    type PrepaymentMode,
    type PrepaymentResult,
  } from "./prepayment.util";
  ```

- Add `LiabilityPrepaymentPreviewResponseDto` to the `import type` list from `./dto/liability-response.dto`.
- Add after `assertNotMixedRateTerms`:

```ts
function simulateOrReject(input: PrepaymentInput): PrepaymentResult {
  try {
    return simulatePrepayment(input);
  } catch (err) {
    if (err instanceof RangeError) {
      throw new BadRequestException(
        "Jumlah pelunasan harus lebih dari 0 dan tidak melebihi sisa pokok",
      );
    }
    throw err;
  }
}
```

Add this public method directly after `previewPayment`:

```ts
  /** Revisi K — early-repayment simulation on the current state; nothing is recorded. */
  async previewPrepayment(
    familyGroupId: string,
    id: string,
    query: { mode: PrepaymentMode; amount?: string; penaltyPercent?: string },
    now: Date = new Date(),
  ): Promise<LiabilityPrepaymentPreviewResponseDto> {
    const liability = await this.prisma.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!liability) {
      throw new NotFoundException("Liability not found");
    }
    if (
      liability.interestMethod !== "anuitas" ||
      liability.tenorMonths === null
    ) {
      throw new BadRequestException(
        "Simulasi pelunasan hanya untuk cicilan anuitas dengan tenor",
      );
    }
    const penaltyPercent =
      query.penaltyPercent ?? DEFAULT_PREPAYMENT_PENALTY_PERCENT;
    if (
      parseRateScaledByHundred(penaltyPercent) >
      parseRateScaledByHundred(MAX_PREPAYMENT_PENALTY_PERCENT)
    ) {
      throw new BadRequestException(
        `penaltyPercent must be between 0 and ${MAX_PREPAYMENT_PENALTY_PERCENT}`,
      );
    }
    if (query.mode !== "full" && query.amount === undefined) {
      throw new BadRequestException(
        "amount is required for a partial prepayment",
      );
    }
    const amount =
      query.amount === undefined
        ? BigInt(0)
        : guardBigInt("amount", query.amount);

    const planned = await withRatePlan(this.prisma, familyGroupId, liability);
    const schedule = scheduleInputFor(planned, now);
    const result = simulateOrReject({
      schedule,
      mode: query.mode,
      amount,
      penaltyPercent,
    });
    return {
      liabilityId: liability.id,
      mode: result.mode,
      prepaidPrincipal: result.prepaidPrincipal.toString(),
      penaltyPercent,
      penalty: result.penalty.toString(),
      cashOutNow: result.cashOutNow.toString(),
      installmentBefore: result.installmentBefore?.toString() ?? null,
      installmentAfter: result.installmentAfter?.toString() ?? null,
      remainingMonthsBefore: result.remainingMonthsBefore,
      remainingMonthsAfter: result.remainingMonthsAfter,
      totalInterestBefore: result.totalInterestBefore.toString(),
      totalInterestAfter: result.totalInterestAfter.toString(),
      interestSaved: result.interestSaved.toString(),
      netSaving: result.netSaving.toString(),
      assumesCurrentFloatingRate:
        rateAt(ratePlanOf(schedule), liability.tenorMonths).kind ===
        "floating",
    };
  }
```

(e) In `apps/api/src/liabilities/liabilities.controller.ts`:

- Add `LiabilityPrepaymentPreviewResponseDto` to the `./dto/liability-response.dto` import.
- Add a value import preceded by the disable comment:

  ```ts
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  import { PrepaymentPreviewQueryDto } from "./dto/prepayment-preview-query.dto";
  ```

- Insert this route directly after `previewPayment(...) { … }`:

```ts
  @Get(":id/prepayment-preview")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Early-repayment simulation (full / reduce tenor / reduce installment); read-only, records nothing",
  })
  @ApiResponse({ status: 200, type: LiabilityPrepaymentPreviewResponseDto })
  @ApiResponse({ status: 404, description: "Liability not found" })
  @ApiResponse({
    status: 400,
    description: "Not an anuitas loan, invalid amount or penalty",
  })
  previewPrepayment(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Query() query: PrepaymentPreviewQueryDto,
  ): Promise<LiabilityPrepaymentPreviewResponseDto> {
    return this.liabilitiesService.previewPrepayment(familyGroupId, id, query);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS. The K service spec has 10 more tests (35 total); the controller spec has 4 more, and the PERMISSION/DENIAL tests now cover `previewPrepayment`.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/prepayment.util.ts src/liabilities/dto/prepayment-preview-query.dto.ts src/liabilities/dto/liability-response.dto.ts src/liabilities/liabilities.service.ts src/liabilities/liabilities.controller.ts src/liabilities/liabilities.controller.spec.ts src/liabilities/liabilities.service.rate-plan.spec.ts`
Expected: exit 0 (hand-fix only).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/prepayment.util.ts apps/api/src/liabilities/dto/prepayment-preview-query.dto.ts apps/api/src/liabilities/dto/liability-response.dto.ts apps/api/src/liabilities/liabilities.service.ts apps/api/src/liabilities/liabilities.controller.ts apps/api/src/liabilities/liabilities.controller.spec.ts apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): KPR early-repayment preview endpoint

GET .../liabilities/:id/prepayment-preview simulates full, reduce-tenor
and reduce-installment prepayment with an editable penalty (default 1%)
on the liability's real rate plan. Read-only; flags when the projection
assumes today's floating rate persists.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 9: Prepayment persistence foundation — schema, COA 20011, anchored installment, guard exception

**Files:**

- Modify: `apps/api/prisma/schema.prisma` — new enum `PrepaymentMode`, `model Liability` (after `floatingRates`), new `model LiabilityPrepayment`, `model Transaction` (after `insuranceId` / its relation / indexes)
- Create: `apps/api/prisma/migrations/20260926130000_revisi_k_liability_prepayments/migration.sql`
- Modify: `packages/contracts/src/coa/index.ts` (+ rebuilt `packages/contracts/dist`), `apps/api/src/common/coa/default-coa-chart.spec.ts`
- Modify: `apps/api/src/liabilities/liabilities.service.ts` — `LiabilityRow`/`InstallmentTerms`, `scheduleInputFor`, `reanchoredInstallment` + `runUpdate`, `paidThisPeriodIds`, `assertNotAlreadyPaidThisPeriod`
- Modify: `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts` (append)

**Interfaces:**

- Consumes:
  - Task 2: `ScheduleInput.installmentAnchorPeriod`.
  - Task 3: `scheduleInputFor`.
  - Task 6a: `withRatePlan`, the `PERIOD_ROWS` harness.
  - Task 6b: `nextTerms` in `runUpdate`.
- Produces:
  - **Prisma.**
    - `enum PrepaymentMode { full reduce_tenor reduce_installment }`.
    - `Liability.installmentFromPeriod Int?` and `Liability.prepayments`.
    - `LiabilityPrepayment { id, familyGroupId, liabilityId, idempotencyKey, mode, principalAmount BigInt, penaltyPercent Decimal(5,2), penaltyAmount BigInt, sourceAccountId, effectivePeriod Int, installmentBefore BigInt?, installmentAfter BigInt?, tenorMonthsBefore Int, tenorMonthsAfter Int, createdByUserId?, occurredAt, createdAt }` with unique `(liabilityId, idempotencyKey)`. It cascades from `liabilities`.
    - `Transaction.liabilityPrepaymentId String?` (FK `ON DELETE SET NULL`, indexed).
  - **COA.** `GENERIC_COA_CHART` gains `{ code: "20011", name: "Penalti Pelunasan Pinjaman", groupNum: 2, direction: "EXPENSE", budgetType: "VARIABLE" }`, which new families get at registration. The migration backfills it for existing families (idempotent, same pattern as 20010).
  - **Engine wiring.** `scheduleInputFor` passes `installmentAnchorPeriod: liability.installmentFromPeriod ?? undefined`, so the schedule, Pay preset and budget line honour a recorded prepayment's stored installment.
  - **Updates.**
    - A term-changing PATCH on a **prepaid** (anchored) loan without an explicit `installmentAmount` re-annuitises the remaining balance from the installment now due, through the shared engine (`reanchoredInstallment`); the anchor moves there. If that is impossible (not anuitas, or no tenor) the PATCH is refused with 400.
    - An unanchored loan keeps G's behaviour: the contract installment, anchor `null`.
    - Every other PATCH keeps the anchor and the installment.
  - **Guard exception.** `paidThisPeriodIds` and `assertNotAlreadyPaidThisPeriod` add `liabilityPrepaymentId: null` to their `where`, so a prepayment never blocks, or counts as, the month's installment.

- [ ] **Step 1: Write the failing tests**

(a) Append to `apps/api/src/common/coa/default-coa-chart.spec.ts`, inside its `describe` (after the 20010 test):

```ts
it("has a group-2 prepayment-penalty EXPENSE account at code 20011, distinct from interest and the catch-all (revisi K)", () => {
  expect(GENERIC_COA_CHART.find((c) => c.code === "20011")).toEqual({
    code: "20011",
    name: "Penalti Pelunasan Pinjaman",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE",
  });
});
```

(b) Append inside the top-level `describe` of `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts`:

```ts
describe("prepayment persistence (installmentFromPeriod, guard exception)", () => {
  // State after recording 100 jt reduce-tenor at #61 on the berjenjang loan:
  // installment 4.869.889 kept from #61, tenor 60 + 106 = 166. NOW is six
  // days after #60 fell due, so #61 is the installment being paid.
  const PREPAID = {
    ...KPR,
    remainingBalance: 328_462_235n,
    installmentAmount: 4_869_889n,
    minimumPayment: 4_869_889n,
    tenorMonths: 166,
    installmentFromPeriod: 61,
  };
  const NOW = new Date("2031-01-21T00:00:00.000Z");

  beforeEach(() => {
    prisma.liabilityRatePeriod.findMany.mockResolvedValue(PERIOD_ROWS);
  });

  it("schedule and Pay preset use the stored installment from its anchor period", async () => {
    prisma.liability.findUnique.mockResolvedValue(PREPAID);
    prisma.liability.findMany.mockResolvedValue([PREPAID]);

    const schedule = await service.getSchedule("fg-1", "lid-1", NOW);
    const [dto] = await service.findAll("fg-1", NOW);

    expect(schedule.rows[0]).toEqual({
      period: 61,
      installment: "4869889",
      interest: "3010904",
      principal: "1858985",
      remaining: "326603250",
    });
    expect(schedule.rows).toHaveLength(106);
    expect(schedule.rows[105]?.period).toBe(166);
    expect(dto?.currentInstallmentAmount).toBe("4869889");
  });

  it("without the anchor the same row would be re-annuitised (the column is really read)", async () => {
    prisma.liability.findUnique.mockResolvedValue({
      ...PREPAID,
      installmentFromPeriod: null,
    });

    const schedule = await service.getSchedule("fg-1", "lid-1", NOW);

    expect(schedule.rows[0]?.installment).toBe("4857320");
  });

  it("a notes-only PATCH keeps the anchor and the prepaid installment", async () => {
    prisma.liability.findUnique.mockResolvedValue(PREPAID);
    prisma.liability.findUniqueOrThrow.mockResolvedValue(PREPAID);
    prisma.liability.update.mockResolvedValue(PREPAID);

    await service.update("fg-1", "lid-1", { notes: "cek" }, NOW);

    expect(prisma.liability.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          installmentAmount: 4_869_889n,
          installmentFromPeriod: 61,
        }),
      }),
    );
  });

  it.each([
    ["a tenor correction to 180 bln", { tenorMonths: 180 }, 4_524_568n],
    [
      "a floating-rate correction to 10.50%",
      {
        ratePeriods: [
          { kind: "fixed", months: 24, ratePercent: "3.50" },
          { kind: "fixed", months: 12, ratePercent: "5.50" },
          { kind: "floating", months: null, ratePercent: "10.50" },
        ],
      },
      4_767_352n,
    ],
  ])(
    "%s on a prepaid loan re-annuitises what is left from the installment now due (never totalDebt over the tenor)",
    async (_label, dto, installment) => {
      prisma.liability.findUnique.mockResolvedValue(PREPAID);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(PREPAID);
      prisma.liability.update.mockResolvedValue(PREPAID);

      await service.update("fg-1", "lid-1", dto as never, NOW);

      // 328,462,235 left from #61: 180 - 61 + 1 = 120 months at 11.00%, or 106 months at 10.50%.
      expect(prisma.liability.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            installmentAmount: installment,
            minimumPayment: installment,
            installmentFromPeriod: 61,
          }),
        }),
      );
      expect(prisma.budget.upsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ limitAmount: installment }),
        }),
      );
    },
  );

  it("a term change a prepaid loan cannot be re-annuitised under (switch to flat) is refused", async () => {
    const legacyPrepaid = {
      ...PREPAID,
      fixedRateMonths: null,
      floatingRate: null,
    };
    prisma.liabilityRatePeriod.findMany.mockResolvedValue([]);
    prisma.liability.findUnique.mockResolvedValue(legacyPrepaid);
    prisma.liability.findUniqueOrThrow.mockResolvedValue(legacyPrepaid);

    await expect(
      service.update("fg-1", "lid-1", { interestMethod: "flat" as never }, NOW),
    ).rejects.toThrow("pelunasan dipercepat");
    expect(prisma.liability.update).not.toHaveBeenCalled();
  });

  it("prepayment rows are ignored by the installment guard and by paidThisPeriod", async () => {
    prisma.liability.findMany.mockResolvedValue([PREPAID]);
    await service.findAll("fg-1", NOW);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: { not: null },
          liabilityPrepaymentId: null,
        }),
      }),
    );

    prisma.liability.findUnique.mockResolvedValue(PREPAID);
    prisma.account.findUnique.mockResolvedValue({
      id: "acc-1",
      familyGroupId: "fg-1",
      type: "bank",
      balance: 50_000_000n,
      name: "BCA",
    });
    prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
    prisma.liability.update.mockResolvedValue(PREPAID);
    await service.pay(
      "fg-1",
      "lid-1",
      { sourceAccountId: "acc-1", amount: "4869889" },
      NOW,
    );
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          liabilityId: "lid-1",
          accountId: { not: null },
          liabilityPrepaymentId: null,
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/common/coa/default-coa-chart.spec.ts src/liabilities/liabilities.service.rate-plan.spec.ts -t "20011|prepayment persistence"`
Expected: FAIL. You should see:

- no 20011 entry in the chart;
- the anchored row shows `4857320` (the anchor is not read yet);
- `installmentFromPeriod` is missing from the update data;
- a tenor correction writes G's contract installment from `totalDebt` instead of 4.524.568;
- `liabilityPrepaymentId` is missing from the guard `where`.

- [ ] **Step 3a: Schema + migration**

In `apps/api/prisma/schema.prisma`, after `enum RatePeriodKind { … }` (Task 5), add:

```prisma

enum PrepaymentMode {
  full
  reduce_tenor
  reduce_installment
}
```

In `model Liability`, after `floatingRates       LiabilityFloatingRate[]`, add:

```prisma
  // Revisi K — period the stored installment was computed for; a recorded prepayment moves it (null = the akad).
  installmentFromPeriod Int?
  prepayments           LiabilityPrepayment[]
```

After `model LiabilityFloatingRate { … }`, add:

```prisma

// Revisi K — a recorded early repayment (pelunasan dipercepat). Replay-safe per idempotencyKey.
model LiabilityPrepayment {
  id                String         @id @default(uuid())
  familyGroupId     String
  liabilityId       String
  idempotencyKey    String
  mode              PrepaymentMode
  principalAmount   BigInt
  penaltyPercent    Decimal        @db.Decimal(5, 2)
  penaltyAmount     BigInt
  sourceAccountId   String
  effectivePeriod   Int
  installmentBefore BigInt?
  installmentAfter  BigInt?
  tenorMonthsBefore Int
  tenorMonthsAfter  Int
  createdByUserId   String?
  occurredAt        DateTime
  createdAt         DateTime       @default(now())
  liability         Liability      @relation(fields: [liabilityId], references: [id], onDelete: Cascade)
  transactions      Transaction[]

  @@unique([liabilityId, idempotencyKey])
  @@index([familyGroupId])
  @@map("liability_prepayments")
}
```

In `model Transaction`:

- After `insuranceId      String?`, add `liabilityPrepaymentId String?`.
- After the `insurance … @relation(…)` line, add `liabilityPrepayment LiabilityPrepayment? @relation(fields: [liabilityPrepaymentId], references: [id], onDelete: SetNull)`.
- After `@@index([insuranceId])`, add `@@index([liabilityPrepaymentId])`.

Create `apps/api/prisma/migrations/20260926130000_revisi_k_liability_prepayments/migration.sql`. Re-check `ls apps/api/prisma/migrations`: it must sort after Task 5's migration and after anything newer on the branch.

```sql
-- Revisi K: recordable KPR prepayments. Additive; existing rows untouched.
CREATE TYPE "PrepaymentMode" AS ENUM ('full', 'reduce_tenor', 'reduce_installment');

ALTER TABLE "liabilities" ADD COLUMN "installmentFromPeriod" INTEGER;

CREATE TABLE "liability_prepayments" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "mode" "PrepaymentMode" NOT NULL,
    "principalAmount" BIGINT NOT NULL,
    "penaltyPercent" DECIMAL(5,2) NOT NULL,
    "penaltyAmount" BIGINT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "effectivePeriod" INTEGER NOT NULL,
    "installmentBefore" BIGINT,
    "installmentAfter" BIGINT,
    "tenorMonthsBefore" INTEGER NOT NULL,
    "tenorMonthsAfter" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liability_prepayments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "liability_prepayments_liabilityId_idempotencyKey_key" ON "liability_prepayments"("liabilityId", "idempotencyKey");

CREATE INDEX "liability_prepayments_familyGroupId_idx" ON "liability_prepayments"("familyGroupId");

ALTER TABLE "liability_prepayments" ADD CONSTRAINT "liability_prepayments_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD COLUMN "liabilityPrepaymentId" TEXT;

CREATE INDEX "transactions_liabilityPrepaymentId_idx" ON "transactions"("liabilityPrepaymentId");

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_liabilityPrepaymentId_fkey" FOREIGN KEY ("liabilityPrepaymentId") REFERENCES "liability_prepayments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dedicated prepayment-penalty expense account for every existing family
-- (GENERIC_COA_CHART "20011"); same idempotent backfill as 20009/20010.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "coa_accounts"
  ("id", "familyGroupId", "code", "name", "groupNum", "direction", "budgetType", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  fg."id",
  '20011',
  'Penalti Pelunasan Pinjaman',
  2,
  'EXPENSE'::"CoaDirection",
  'VARIABLE'::"CoaBudgetType",
  now(),
  now()
FROM "family_groups" fg
ON CONFLICT ("familyGroupId", "code") DO NOTHING;
```

Run (from `apps/api`): `pnpm exec prisma generate`
Expected: `✔ Generated Prisma Client`.

Verify the DDL against Prisma's diff (the COA `INSERT` is data, so it is not part of the diff):

```bash
cd apps/api
PREV=$(mktemp --suffix=.prisma) && git show HEAD:apps/api/prisma/schema.prisma > "$PREV"
pnpm exec prisma migrate diff --from-schema-datamodel "$PREV" --to-schema-datamodel prisma/schema.prisma --script
```

Expected: the same DDL statements as the migration.

- [ ] **Step 3b: COA chart**

In `packages/contracts/src/coa/index.ts`, directly after the `code: "20010"` entry's closing `},`, add:

```ts
  // Revisi K — a recorded KPR prepayment's penalty is a real expense with its
  // own account (never interest 20009, never the 20099 catch-all).
  {
    code: "20011",
    name: "Penalti Pelunasan Pinjaman",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: "VARIABLE",
  },
```

Run (repo root): `pnpm --filter @wealthme/contracts build`
Expected: build succeeds.

- [ ] **Step 3c: Service**

In `apps/api/src/liabilities/liabilities.service.ts`:

1. **Types.** In `LiabilityRow`, after `ratePlanRows?: RatePlanRows;`, add `installmentFromPeriod?: number | null;`. In `InstallmentTerms`'s `Pick<…>` union, add `| "installmentFromPeriod"`.
2. **`scheduleInputFor`.** In the returned object, after `ratePlan: …,`, add:

   ```ts
       installmentAnchorPeriod: liability.installmentFromPeriod ?? undefined,
   ```

3. **`runUpdate` — a prepaid loan re-annuitises instead of reverting to the contract installment.**

   Why re-annuitise rather than refuse:
   - Correcting a rate, tenor or type after a prepayment is normal (a bank notice, a typo).
   - G's `resolveInstallment` would re-derive the installment from `totalDebt` over the (possibly shortened) tenor. For example, 500 jt at 3.50 % over 166 bln is 3.804.132, not what is owed. The budget line would inherit the wrong number.
   - The shared engine already implements the bank's rule for any change: re-annuitise the remaining balance over the remaining months **[R§3]**. So the corrected installment is computed exactly like a regime change, with no new math.
   - The months are counted from the installment now due (`d`), not from the old anchor: `remainingBalance` is today's balance, and installments paid since the prepayment have already used up months. `d` equals the anchor when nothing has been paid since. The anchor moves to `d`.
   - Only a change that cannot be annuitised (a non-anuitas method, or no tenor) is refused with 400.

   Steps:
   - Add this module-private helper after `withRatePlan`:

     ```ts
     /** A prepaid loan's installment after a term correction: what is left, re-annuitised from the installment now due (shared engine). */
     function reanchoredInstallment(
       terms: InstallmentTerms,
       now: Date,
     ): { installmentAmount: bigint | null; installmentFromPeriod: number } {
       const input = scheduleInputFor(terms, now);
       const [row] = buildSchedule({
         ...input,
         installmentAmount: BigInt(0),
         recomputeAtStart: true,
         maxRows: 1,
       });
       return {
         installmentAmount: row?.installment ?? null,
         installmentFromPeriod: input.firstPeriod,
       };
     }
     ```

   - Directly after Task 6b's `nextTerms` + orphaned-history check, add:

     ```ts
     // Revisi K — after a recorded prepayment the contract installment (totalDebt over the tenor) no longer applies.
     const reanchor =
       termsChanged &&
       amounts.installmentAmount === undefined &&
       (existing.installmentFromPeriod ?? null) !== null;
     if (reanchor && (interestMethod !== "anuitas" || tenorMonths === null)) {
       throw new BadRequestException(
         "Pinjaman ini punya pelunasan dipercepat tercatat — hanya cicilan anuitas dengan tenor yang bisa dihitung ulang",
       );
     }
     const reanchored = reanchor ? reanchoredInstallment(nextTerms, now) : null;
     ```

   - Change the `installmentAmount` expression so the re-anchored value comes first among the fallbacks:

     ```ts
     const installmentAmount =
       amounts.installmentAmount !== undefined
         ? amounts.installmentAmount
         : reanchored
           ? reanchored.installmentAmount
           : termsChanged
             ? resolveInstallment({
                 method: interestMethod,
                 totalDebt,
                 interestRate: resolvedInterestRate,
                 tenorMonths,
                 override: undefined,
               })
             : existing.installmentAmount;
     ```

   - In `data`, after `installmentAmount,`, add:

     ```ts
           installmentFromPeriod: reanchored
             ? reanchored.installmentFromPeriod
             : termsChanged
               ? null
               : (existing.installmentFromPeriod ?? null),
     ```

4. **`paidThisPeriodIds`.** In its `transaction.findMany` `where`, after `accountId: { not: null },`, add:

   ```ts
           // Revisi K — a recorded prepayment is never "this period's installment".
           liabilityPrepaymentId: null,
   ```

5. **`assertNotAlreadyPaidThisPeriod`.** In its `transaction.findFirst` `where`, after `accountId: { not: null },`, add the same two lines.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities src/common/coa src/auth/auth.service.spec.ts`
Expected: PASS. The K service spec has 7 more tests and the chart spec 1 more. G's liabilities specs are green unchanged (their guard assertions use `objectContaining`). `auth.service.spec.ts` still passes because it reads `GENERIC_COA_CHART.length` dynamically.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/liabilities.service.ts src/liabilities/liabilities.service.rate-plan.spec.ts src/common/coa/default-coa-chart.spec.ts`
Expected: exit 0 (hand-fix only).

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260926130000_revisi_k_liability_prepayments packages/contracts/src/coa/index.ts packages/contracts/dist apps/api/src/common/coa/default-coa-chart.spec.ts apps/api/src/liabilities/liabilities.service.ts apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): prepayment ledger foundation for KPR

Additive migration: liability_prepayments (idempotency key per liability),
liabilities.installmentFromPeriod, transactions.liabilityPrepaymentId, and
a dedicated 20011 prepayment-penalty expense account backfilled for every
family. The schedule honours the anchored installment, a term correction on a
prepaid loan re-annuitises what is left, and prepayment rows never count
as the month's installment payment.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 10: `POST :id/prepay` — record a prepayment (debit, principal + penalty legs, persisted terms, idempotent, fx-aware)

**Files:**

- Modify: `apps/api/src/liabilities/prepayment.util.ts` (export `PREPAYMENT_MODES`)
- Create: `apps/api/src/liabilities/dto/record-prepayment.dto.ts`
- Modify: `apps/api/src/liabilities/dto/liability-response.dto.ts` (append two classes)
- Modify: `apps/api/src/fx/fx-field-specs.ts` (`liabilityPrepayment`), `apps/api/src/fx/fx-wiring-holdings.spec.ts`
- Modify: `apps/api/src/liabilities/liabilities.service.ts` — helpers, `previewPrepayment` refactor, `recordPrepayment` + private helpers
- Modify: `apps/api/src/liabilities/liabilities.controller.ts` + `.spec.ts`
- Modify: `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts` (`makePrisma` + append)
- Modify: `packages/contracts/src/liabilities/index.ts` (+ rebuilt `dist`)

**Interfaces:**

- Consumes:
  - Task 4: `simulatePrepayment` (`newInstallmentAmount`, `newTenorMonths`).
  - Task 8: `DEFAULT_/MAX_PREPAYMENT_PENALTY_PERCENT`, `simulateOrReject`.
  - Task 9: the schema, and `installmentFromPeriod` read through `scheduleInputFor`.
  - Task 6a: `withRatePlan`, `toLiabilityDto`.
  - Existing: `assertBankNotOverdrawn`, `syncPrincipalBudgetLine`, `runSerializableWithRetry`, `FxInputService.run`.
- Produces:
  - **Route** `POST family-groups/:familyGroupId/liabilities/:id/prepay` (`manage Liability`, `@HttpCode(200)`).
    - Body `RecordPrepaymentDto { sourceAccountId: uuid; mode: "full"|"reduce_tenor"|"reduce_installment"; amount?: digits (required unless full, refused for full); penaltyPercent?: d.dd (default 1.00, ≤ 10); idempotencyKey: uuid; fxInputs? }`.
    - Response `LiabilityPrepaymentRecordResponseDto { liability: LiabilityResponseDto; prepayment: LiabilityPrepaymentResponseDto; replayed: boolean }`.
  - `FX_FIELD_SPECS.liabilityPrepayment = { amount: { kind: "digits", positive: true } }`, audited as `Liability` / `prepay.amount`.
  - `LiabilitiesService.recordPrepayment(familyGroupId, id, dto, userId: string | null, now = new Date())`.
  - **Shared helpers** (module-private): `parsePrepaymentRequest(query)` and `assertPrepayable(liability)`. `previewPrepayment` now uses them too, so preview and record apply identical rules.
  - **Contracts:** `RecordLiabilityPrepaymentDto`, `LiabilityPrepaymentDto`, `LiabilityPrepaymentRecordResultDto`.
  - **Errors:**
    - 404: liability, or source account, outside the family.
    - 400: not an anuitas loan with a tenor; amount rules; penalty > 10; overdraft on principal + penalty; no group-5 / 20011 COA.
    - 409: a same-named user category bound to another COA.
    - Replay: 200 with `replayed: true` and no writes.

- [ ] **Step 1: Write the failing tests**

(a) In `apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts`:

- Add `import { Prisma } from "@prisma/client";` after the `@nestjs/testing` import.
- In `makePrisma()`, add:

  ```ts
      liabilityPrepayment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
  ```

Then append inside the top-level `describe`:

```ts
describe("recordPrepayment", () => {
  // Single-rate 11% KPR, akad 2021-01-15: 2026-01-21 is six days after #60 fell due, so #61 (180 left) is being paid.
  const AT_61 = {
    ...KPR,
    interestRate: { toString: () => "11.00" },
    remainingBalance: 400_000_000n,
    installmentAmount: 4_546_388n,
    minimumPayment: 4_546_388n,
    startDate: new Date("2021-01-15T00:00:00.000Z"),
    kprScheme: null,
    installmentFromPeriod: null,
  };
  const NOW = new Date("2026-01-21T00:00:00.000Z");
  const KEY = "0b6f3f0e-8c1d-4a55-9e2f-3c5d7a9b1e20";
  const BCA = {
    id: "acc-1",
    familyGroupId: "fg-1",
    type: "bank",
    balance: 500_000_000n,
    name: "BCA",
  };
  const RECORDED = {
    id: "pp-1",
    familyGroupId: "fg-1",
    liabilityId: "lid-1",
    idempotencyKey: KEY,
    mode: "reduce_installment",
    principalAmount: 100_000_000n,
    penaltyPercent: { toString: () => "1.00" },
    penaltyAmount: 1_000_000n,
    sourceAccountId: "acc-1",
    effectivePeriod: 61,
    installmentBefore: 4_546_388n,
    installmentAfter: 3_409_791n,
    tenorMonthsBefore: 240,
    tenorMonthsAfter: 240,
    createdByUserId: "user-1",
    occurredAt: NOW,
    createdAt: NOW,
  };

  function arrange(row: object = AT_61, account: object = BCA) {
    prisma.liability.findUnique.mockResolvedValue(row);
    prisma.account.findUnique.mockResolvedValue(account);
    prisma.coaAccount.findFirst
      .mockResolvedValueOnce({ id: "coa-5", name: "Utang" })
      .mockResolvedValueOnce({
        id: "coa-20011",
        name: "Penalti Pelunasan Pinjaman",
      });
    prisma.category.findFirst
      .mockResolvedValueOnce({ id: "cat-prepay", coaAccountId: "coa-5" })
      .mockResolvedValueOnce({ id: "cat-penalty", coaAccountId: "coa-20011" });
    prisma.liabilityPrepayment.create.mockImplementation(
      ({ data }: { data: object }) =>
        Promise.resolve({ id: "pp-1", createdAt: NOW, ...data }),
    );
    prisma.liability.update.mockResolvedValue(row);
  }
  const record = (body: object, userId: string | null = "user-1") =>
    service.recordPrepayment(
      "fg-1",
      "lid-1",
      { sourceAccountId: "acc-1", idempotencyKey: KEY, ...body } as never,
      userId,
      NOW,
    );

  it("reduce installment: debits principal + penalty, books both legs, persists 3.409.791 from #61", async () => {
    arrange();

    const res = await record({
      mode: "reduce_installment",
      amount: "100000000",
    });

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: "acc-1", familyGroupId: "fg-1" },
      data: { balance: { decrement: 101_000_000n } },
    });
    expect(prisma.liability.update).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-1" },
      data: {
        remainingBalance: { decrement: 100_000_000n },
        installmentAmount: 3_409_791n,
        minimumPayment: 3_409_791n,
        installmentFromPeriod: 61,
      },
    });
    expect(prisma.liabilityPrepayment.create).toHaveBeenCalledWith({
      data: {
        familyGroupId: "fg-1",
        liabilityId: "lid-1",
        idempotencyKey: KEY,
        mode: "reduce_installment",
        principalAmount: 100_000_000n,
        penaltyPercent: "1.00",
        penaltyAmount: 1_000_000n,
        sourceAccountId: "acc-1",
        effectivePeriod: 61,
        installmentBefore: 4_546_388n,
        installmentAfter: 3_409_791n,
        tenorMonthsBefore: 240,
        tenorMonthsAfter: 240,
        createdByUserId: "user-1",
        occurredAt: NOW,
      },
    });
    expect(prisma.transaction.create).toHaveBeenNthCalledWith(1, {
      data: {
        familyGroupId: "fg-1",
        accountId: "acc-1",
        categoryId: "cat-prepay",
        amount: 100_000_000n,
        type: "transfer",
        liabilityId: "lid-1",
        liabilityPrepaymentId: "pp-1",
        description: "Pelunasan dipercepat KPR BTN",
        occurredAt: NOW,
      },
    });
    expect(prisma.transaction.create).toHaveBeenNthCalledWith(2, {
      data: {
        familyGroupId: "fg-1",
        accountId: "acc-1",
        categoryId: "cat-penalty",
        amount: 1_000_000n,
        type: "expense",
        liabilityId: "lid-1",
        liabilityPrepaymentId: "pp-1",
        description: "Penalti pelunasan KPR BTN",
        occurredAt: NOW,
      },
    });
    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ limitAmount: 3_409_791n }),
      }),
    );
    expect(res.replayed).toBe(false);
    expect(res.prepayment).toEqual({
      id: "pp-1",
      mode: "reduce_installment",
      principalAmount: "100000000",
      penaltyPercent: "1.00",
      penaltyAmount: "1000000",
      effectivePeriod: 61,
      installmentBefore: "4546388",
      installmentAfter: "3409791",
      tenorMonthsBefore: 240,
      tenorMonthsAfter: 240,
      occurredAt: NOW.toISOString(),
    });
  });

  it("reduce tenor: installment kept, tenor 240 -> 162, and the schedule read back has 102 rows", async () => {
    arrange();

    await record({ mode: "reduce_tenor", amount: "100000000" });

    expect(prisma.liability.update).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-1" },
      data: {
        remainingBalance: { decrement: 100_000_000n },
        installmentAmount: 4_546_388n,
        minimumPayment: 4_546_388n,
        installmentFromPeriod: 61,
        tenorMonths: 162,
      },
    });
    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ limitAmount: 4_546_388n }),
      }),
    );

    prisma.liability.findUnique.mockResolvedValue({
      ...AT_61,
      remainingBalance: 300_000_000n,
      tenorMonths: 162,
      installmentFromPeriod: 61,
    });
    const schedule = await service.getSchedule("fg-1", "lid-1", NOW);
    expect(schedule.rows).toHaveLength(102);
    expect(schedule.rows[0]?.installment).toBe("4546388");
    expect(schedule.rows[101]?.remaining).toBe("0");
  });

  it("full payoff at 2.5%: debits 410.000.000, zeroes the obligation and removes the budget line", async () => {
    arrange();

    const res = await record({ mode: "full", penaltyPercent: "2.50" });

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: "acc-1", familyGroupId: "fg-1" },
      data: { balance: { decrement: 410_000_000n } },
    });
    expect(prisma.liability.update).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-1" },
      data: {
        remainingBalance: { decrement: 400_000_000n },
        minimumPayment: 0n,
      },
    });
    expect(prisma.budget.deleteMany).toHaveBeenCalledWith({
      where: { familyGroupId: "fg-1", liabilityId: "lid-1" },
    });
    expect(res.prepayment.installmentAfter).toBeNull();
    expect(res.prepayment.penaltyAmount).toBe("10000000");
  });

  it("zero penalty books no penalty leg", async () => {
    arrange();

    await record({
      mode: "reduce_tenor",
      amount: "100000000",
      penaltyPercent: "0",
    });

    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
  });

  it("replay: the same idempotencyKey returns the first record and writes nothing", async () => {
    arrange();
    prisma.liabilityPrepayment.findFirst.mockResolvedValue(RECORDED);

    const res = await record({
      mode: "reduce_installment",
      amount: "100000000",
    });

    expect(prisma.liabilityPrepayment.findFirst).toHaveBeenCalledWith({
      where: {
        familyGroupId: "fg-1",
        liabilityId: "lid-1",
        idempotencyKey: KEY,
      },
    });
    expect(res.replayed).toBe(true);
    expect(res.prepayment.id).toBe("pp-1");
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.liabilityPrepayment.create).not.toHaveBeenCalled();
  });

  it("concurrent double submit: the loser's P2002 retries into a replay, never a second debit or a 500", async () => {
    arrange();
    prisma.liabilityPrepayment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(RECORDED);
    prisma.liabilityPrepayment.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await record({
      mode: "reduce_installment",
      amount: "100000000",
    });

    expect(res.replayed).toBe(true);
    expect(prisma.liabilityPrepayment.create).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("guard exception: an installment already paid this month does not block a prepayment", async () => {
    arrange();
    prisma.transaction.findFirst.mockResolvedValue({ id: "tx-installment" });

    const res = await record({ mode: "reduce_tenor", amount: "100000000" });

    expect(res.replayed).toBe(false);
    expect(prisma.liabilityPrepayment.create).toHaveBeenCalled();
  });

  it.each([
    ["no amount on a partial prepayment", { mode: "reduce_tenor" }],
    ["an amount on a full payoff", { mode: "full", amount: "1" }],
    [
      "an amount above the balance",
      { mode: "reduce_tenor", amount: "400000001" },
    ],
    ["a zero amount", { mode: "reduce_installment", amount: "0" }],
    ["a penalty above 10%", { mode: "full", penaltyPercent: "10.01" }],
  ])("400: %s", async (_label, body) => {
    arrange();

    await expect(record(body)).rejects.toThrow(BadRequestException);
    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it("400 when the bank account cannot cover principal + penalty (overdraft floor)", async () => {
    arrange(AT_61, { ...BCA, balance: 100_500_000n });

    await expect(
      record({ mode: "reduce_tenor", amount: "100000000" }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it("400 for a liability that is not an anuitas loan", async () => {
    arrange({ ...AT_61, interestMethod: "flat" });

    await expect(record({ mode: "full" })).rejects.toThrow(BadRequestException);
  });

  it("404 for another family's liability or source account (tenant-scoped lookups)", async () => {
    arrange();
    prisma.liability.findUnique.mockResolvedValueOnce(null);
    await expect(record({ mode: "full" })).rejects.toThrow(
      "Liability not found",
    );

    prisma.account.findUnique.mockResolvedValueOnce(null);
    await expect(record({ mode: "full" })).rejects.toThrow(
      "Account acc-1 not found",
    );
    expect(prisma.account.findUnique).toHaveBeenCalledWith({
      where: { id: "acc-1", familyGroupId: "fg-1" },
    });
  });

  it("409 when a user's own category already uses the prepayment name on another COA", async () => {
    arrange();
    prisma.category.findFirst.mockReset();
    prisma.category.findFirst.mockResolvedValueOnce({
      id: "cat-user",
      coaAccountId: "coa-other",
    });

    await expect(
      record({ mode: "reduce_tenor", amount: "100000000" }),
    ).rejects.toThrow("Pelunasan Dipercepat Pinjaman");
  });
});
```

(b) In `apps/api/src/liabilities/liabilities.controller.spec.ts`, add `"recordPrepayment",` to `manageRoutes` (after `"pay",`), then append:

```ts
describe("LiabilitiesController — POST :id/prepay over HTTP", () => {
  const UUID = "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e";

  async function bootstrap() {
    const service = {
      recordPrepayment: jest.fn().mockResolvedValue({ replayed: false }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [LiabilitiesController],
      providers: [
        { provide: LiabilitiesService, useValue: service },
        ...fxTesting().providers,
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    return { app, service };
  }

  it("routes a valid body to recordPrepayment with the acting user", async () => {
    const { app, service } = await bootstrap();
    const body = {
      sourceAccountId: UUID,
      mode: "reduce_tenor",
      amount: "100000000",
      idempotencyKey: UUID,
    };

    await request(app.getHttpServer())
      .post("/family-groups/fg-1/liabilities/lid-1/prepay")
      .send(body)
      .expect(200);

    expect(service.recordPrepayment).toHaveBeenCalledWith(
      "fg-1",
      "lid-1",
      body,
      null,
    );
    await app.close();
  });

  it.each([
    [{ sourceAccountId: UUID, mode: "reduce_tenor", amount: "1" }],
    [
      {
        sourceAccountId: UUID,
        mode: "sebagian",
        amount: "1",
        idempotencyKey: UUID,
      },
    ],
    [{ sourceAccountId: "acc-1", mode: "full", idempotencyKey: UUID }],
  ])(
    "rejects %j before the service (the DTO is a value import)",
    async (body) => {
      const { app, service } = await bootstrap();

      await request(app.getHttpServer())
        .post("/family-groups/fg-1/liabilities/lid-1/prepay")
        .send(body)
        .expect(400);

      expect(service.recordPrepayment).not.toHaveBeenCalled();
      await app.close();
    },
  );
});
```

(c) In `apps/api/src/fx/fx-wiring-holdings.spec.ts`:

- Add `recordPrepayment: jest.fn(),` to the `liabilities` mock object, and `liabilities.recordPrepayment,` to the `beforeEach` list.
- Add after the `"liability pay: …"` test:

```ts
it("liability prepay: SGD amount, audited as Liability prepay.amount (revisi K)", async () => {
  await http()
    .post(`/family-groups/${FG}/liabilities/liab-1/prepay`)
    .send({
      sourceAccountId: UUID,
      mode: "reduce_tenor",
      amount: "1",
      idempotencyKey: UUID,
      fxInputs: [{ field: "amount", currency: "SGD", amount: "1500.25" }],
    })
    .expect(200);
  expect(liabilities.recordPrepayment.mock.calls[0][2].amount).toBe("21043698");
  expect(
    fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
  ).toMatchObject({
    entity: "Liability",
    entityId: "liab-1",
    field: "prepay.amount",
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/liabilities.service.rate-plan.spec.ts src/liabilities/liabilities.controller.spec.ts src/fx/fx-wiring-holdings.spec.ts -t "recordPrepayment|prepay|PERMISSION|DENIAL"`
Expected: FAIL. You should see "service.recordPrepayment is not a function", a 404 on `POST …/prepay`, and `controller.recordPrepayment` undefined in the guard tests.

- [ ] **Step 3: Write minimal implementation**

(a) In `apps/api/src/liabilities/prepayment.util.ts`, after `export type PrepaymentMode = …;`, add:

```ts
export const PREPAYMENT_MODES: readonly PrepaymentMode[] = [
  "full",
  "reduce_tenor",
  "reduce_installment",
];
```

(b) Create `apps/api/src/liabilities/dto/record-prepayment.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, Matches } from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";
import { PREPAYMENT_MODES, type PrepaymentMode } from "../prepayment.util";

export class RecordPrepaymentDto {
  @ApiProperty({
    description: "Account debited for principal + penalty (same family group)",
  })
  @IsUUID()
  sourceAccountId!: string;

  @ApiProperty({ enum: PREPAYMENT_MODES })
  @IsIn(PREPAYMENT_MODES)
  mode!: PrepaymentMode;

  @ApiPropertyOptional({
    description:
      "Principal to prepay, whole rupiah; required unless mode=full, refused for full",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "amount must be a numeric string" })
  amount?: string;

  @ApiPropertyOptional({
    description: "Penalty % of the prepaid principal (0-10), default 1.00",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}(\.\d{1,2})?$/, {
    message: "penaltyPercent must be a decimal string",
  })
  penaltyPercent?: string;

  @ApiProperty({
    description:
      "Client-generated UUID, one per simulation; a repeat returns the first record",
  })
  @IsUUID()
  idempotencyKey!: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
```

(c) Append to `apps/api/src/liabilities/dto/liability-response.dto.ts`:

```ts
export class LiabilityPrepaymentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ["full", "reduce_tenor", "reduce_installment"] })
  mode!: "full" | "reduce_tenor" | "reduce_installment";
  @ApiProperty() principalAmount!: string;
  @ApiProperty() penaltyPercent!: string;
  @ApiProperty() penaltyAmount!: string;
  @ApiProperty({ description: "Installment the prepayment landed before" })
  effectivePeriod!: number;
  @ApiProperty({ nullable: true, type: String })
  installmentBefore!: string | null;
  @ApiProperty({ nullable: true, type: String })
  installmentAfter!: string | null;
  @ApiProperty() tenorMonthsBefore!: number;
  @ApiProperty() tenorMonthsAfter!: number;
  @ApiProperty() occurredAt!: string;
}

export class LiabilityPrepaymentRecordResponseDto {
  @ApiProperty({ type: LiabilityResponseDto }) liability!: LiabilityResponseDto;
  @ApiProperty({ type: LiabilityPrepaymentResponseDto })
  prepayment!: LiabilityPrepaymentResponseDto;
  @ApiProperty({
    description: "True when this idempotencyKey was already recorded",
  })
  replayed!: boolean;
}
```

(d) In `apps/api/src/fx/fx-field-specs.ts`, after `liabilityPayment: …,`, add:

```ts
  // Revisi K — a recorded KPR prepayment debits an account like a payment does.
  liabilityPrepayment: { amount: { kind: "digits", positive: true } },
```

(e) In `apps/api/src/liabilities/liabilities.service.ts`:

1. **Imports.**
   - Change the `@prisma/client` import to `import { type Prisma, type Role } from "@prisma/client";`.
   - Add `PrepaymentResult` to the `./prepayment.util` import.
   - Add `LiabilityPrepaymentRecordResponseDto, LiabilityPrepaymentResponseDto` to the `import type` list from `./dto/liability-response.dto`.
   - Add `import type { RecordPrepaymentDto } from "./dto/record-prepayment.dto";`.
2. **Constants.** Below `LOAN_INTEREST_COA_CODES`, add:

```ts
// Revisi K — a recorded prepayment's legs (decision 5): the principal on its
// own family TRANSFER category (never the liability's budget-line category),
// the penalty on the dedicated 20011 expense account.
const PREPAYMENT_CATEGORY_NAME = "Pelunasan Dipercepat Pinjaman";
const PREPAYMENT_PENALTY_COA_CODE = "20011";
```

3. **Module-private helpers.** Add after `simulateOrReject`:

```ts
interface PrepaymentRequest {
  mode: PrepaymentMode;
  amount: bigint;
  penaltyPercent: string;
}

/** The same rules for preview and record. */
function parsePrepaymentRequest(query: {
  mode: PrepaymentMode;
  amount?: string;
  penaltyPercent?: string;
}): PrepaymentRequest {
  const penaltyPercent =
    query.penaltyPercent ?? DEFAULT_PREPAYMENT_PENALTY_PERCENT;
  if (
    parseRateScaledByHundred(penaltyPercent) >
    parseRateScaledByHundred(MAX_PREPAYMENT_PENALTY_PERCENT)
  ) {
    throw new BadRequestException(
      `penaltyPercent must be between 0 and ${MAX_PREPAYMENT_PENALTY_PERCENT}`,
    );
  }
  if (query.mode === "full" && query.amount !== undefined) {
    throw new BadRequestException(
      "amount is not used for a full payoff — the whole remaining balance is prepaid",
    );
  }
  if (query.mode !== "full" && query.amount === undefined) {
    throw new BadRequestException(
      "amount is required for a partial prepayment",
    );
  }
  return {
    mode: query.mode,
    amount:
      query.amount === undefined
        ? BigInt(0)
        : guardBigInt("amount", query.amount),
    penaltyPercent,
  };
}

function assertPrepayable(liability: {
  interestMethod: string;
  tenorMonths: number | null;
}): void {
  if (
    liability.interestMethod !== "anuitas" ||
    liability.tenorMonths === null
  ) {
    throw new BadRequestException(
      "Simulasi pelunasan hanya untuk cicilan anuitas dengan tenor",
    );
  }
}

/** Liability columns a recorded prepayment rewrites (decision 5). */
function prepaidTerms(
  result: PrepaymentResult,
  fromPeriod: number,
): {
  minimumPayment: bigint;
  installmentAmount?: bigint;
  installmentFromPeriod?: number;
  tenorMonths?: number;
} {
  if (result.mode === "full" || result.newInstallmentAmount === null) {
    return { minimumPayment: BigInt(0) };
  }
  return {
    installmentAmount: result.newInstallmentAmount,
    minimumPayment: result.newInstallmentAmount,
    installmentFromPeriod: fromPeriod,
    ...(result.newTenorMonths === null
      ? {}
      : { tenorMonths: result.newTenorMonths }),
  };
}

function toPrepaymentDto(row: {
  id: string;
  mode: PrepaymentMode;
  principalAmount: bigint;
  penaltyPercent: { toString(): string };
  penaltyAmount: bigint;
  effectivePeriod: number;
  installmentBefore: bigint | null;
  installmentAfter: bigint | null;
  tenorMonthsBefore: number;
  tenorMonthsAfter: number;
  occurredAt: Date;
}): LiabilityPrepaymentResponseDto {
  return {
    id: row.id,
    mode: row.mode,
    principalAmount: row.principalAmount.toString(),
    penaltyPercent: row.penaltyPercent.toString(),
    penaltyAmount: row.penaltyAmount.toString(),
    effectivePeriod: row.effectivePeriod,
    installmentBefore: row.installmentBefore?.toString() ?? null,
    installmentAfter: row.installmentAfter?.toString() ?? null,
    tenorMonthsBefore: row.tenorMonthsBefore,
    tenorMonthsAfter: row.tenorMonthsAfter,
    occurredAt: row.occurredAt.toISOString(),
  };
}
```

4. **`previewPrepayment` refactor** (behaviour unchanged, except that it now also refuses an amount on a full payoff).
   - Replace everything from `if (\n      liability.interestMethod !== "anuitas" ||` down to (and including) the `const amount = … guardBigInt("amount", query.amount);` statement with:

     ```ts
     assertPrepayable(liability);
     const request = parsePrepaymentRequest(query);
     ```

   - Change `const result = simulateOrReject({ schedule, mode: query.mode, amount, penaltyPercent });` to `const result = simulateOrReject({ schedule, ...request });`.
   - In the returned object, change `penaltyPercent,` to `penaltyPercent: request.penaltyPercent,`.
   - `assumesCurrentFloatingRate` needs a non-null tenor: use `liability.tenorMonths ?? 1`, which is safe after `assertPrepayable`.

5. **Public method + private helpers.** Add directly after `previewPrepayment`:

```ts
  /**
   * Revisi K — records an early repayment (decision 5): debit, principal +
   * penalty legs, persisted installment/tenor from the prepayment's period,
   * budget re-sync, all in one Serializable transaction. Replay-safe per
   * idempotencyKey; deliberately NOT subject to the monthly installment guard.
   */
  async recordPrepayment(
    familyGroupId: string,
    id: string,
    dto: Omit<RecordPrepaymentDto, "fxInputs">,
    userId: string | null,
    now: Date = new Date(),
  ): Promise<LiabilityPrepaymentRecordResponseDto> {
    const request = parsePrepaymentRequest(dto);
    return runSerializableWithRetry(this.prisma, (tx) =>
      this.runPrepayment(tx, familyGroupId, id, dto, request, userId, now),
    );
  }

  private async runPrepayment(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: Omit<RecordPrepaymentDto, "fxInputs">,
    request: PrepaymentRequest,
    userId: string | null,
    now: Date,
  ): Promise<LiabilityPrepaymentRecordResponseDto> {
    const liability = await tx.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!liability) {
      throw new NotFoundException("Liability not found");
    }
    const planned = await withRatePlan(tx, familyGroupId, liability);

    const replay = await tx.liabilityPrepayment.findFirst({
      where: { familyGroupId, liabilityId: id, idempotencyKey: dto.idempotencyKey },
    });
    if (replay) {
      return {
        liability: toLiabilityDto(planned, false, now),
        prepayment: toPrepaymentDto(replay),
        replayed: true,
      };
    }

    assertPrepayable(liability);
    const sourceAccount = await tx.account.findUnique({
      where: { id: dto.sourceAccountId, familyGroupId },
    });
    if (!sourceAccount) {
      throw new NotFoundException(`Account ${dto.sourceAccountId} not found`);
    }

    const schedule = scheduleInputFor(planned, now);
    const result = simulateOrReject({ schedule, ...request });
    await assertBankNotOverdrawn(
      tx,
      familyGroupId,
      sourceAccount.id,
      result.cashOutNow,
    );
    await tx.account.update({
      where: { id: sourceAccount.id, familyGroupId },
      data: { balance: { decrement: result.cashOutNow } },
    });

    const tenorBefore = liability.tenorMonths ?? 0;
    const prepayment = await tx.liabilityPrepayment.create({
      data: {
        familyGroupId,
        liabilityId: id,
        idempotencyKey: dto.idempotencyKey,
        mode: result.mode,
        principalAmount: result.prepaidPrincipal,
        penaltyPercent: request.penaltyPercent,
        penaltyAmount: result.penalty,
        sourceAccountId: sourceAccount.id,
        effectivePeriod: schedule.firstPeriod,
        installmentBefore: result.installmentBefore,
        installmentAfter: result.newInstallmentAmount,
        tenorMonthsBefore: tenorBefore,
        tenorMonthsAfter: result.newTenorMonths ?? tenorBefore,
        createdByUserId: userId,
        occurredAt: now,
      },
    });

    const terms = prepaidTerms(result, schedule.firstPeriod);
    const updated = await tx.liability.update({
      where: { id, familyGroupId },
      data: { remainingBalance: { decrement: result.prepaidPrincipal }, ...terms },
    });

    await this.bookPrepaymentLegs(
      tx,
      familyGroupId,
      liability,
      sourceAccount.id,
      prepayment.id,
      result,
      now,
    );

    await this.syncPrincipalBudgetLine(
      tx,
      familyGroupId,
      { ...planned, ...terms },
      budgetContribution(
        {
          ...planned,
          ...terms,
          remainingBalance: liability.remainingBalance - result.prepaidPrincipal,
        },
        now,
      ),
    );

    return {
      liability: toLiabilityDto(
        { ...updated, ratePlanRows: planned.ratePlanRows },
        false,
        now,
      ),
      prepayment: toPrepaymentDto(prepayment),
      replayed: false,
    };
  }

  private async bookPrepaymentLegs(
    tx: TxClient,
    familyGroupId: string,
    liability: { id: string; name: string },
    accountId: string,
    prepaymentId: string,
    result: PrepaymentResult,
    occurredAt: Date,
  ): Promise<void> {
    const principalCategoryId = await this.resolveSystemCategoryId(
      tx,
      familyGroupId,
      { groupNum: 5, direction: "TRANSFER" },
      PREPAYMENT_CATEGORY_NAME,
    );
    await tx.transaction.create({
      data: {
        familyGroupId,
        accountId,
        categoryId: principalCategoryId,
        amount: result.prepaidPrincipal,
        type: "transfer",
        liabilityId: liability.id,
        liabilityPrepaymentId: prepaymentId,
        description: `Pelunasan dipercepat ${liability.name}`,
        occurredAt,
      },
    });
    if (result.penalty <= BigInt(0)) return;
    const penaltyCategoryId = await this.resolveSystemCategoryId(
      tx,
      familyGroupId,
      { code: PREPAYMENT_PENALTY_COA_CODE },
    );
    await tx.transaction.create({
      data: {
        familyGroupId,
        accountId,
        categoryId: penaltyCategoryId,
        amount: result.penalty,
        type: "expense",
        liabilityId: liability.id,
        liabilityPrepaymentId: prepaymentId,
        description: `Penalti pelunasan ${liability.name}`,
        occurredAt,
      },
    });
  }

  /** Finds or creates the family's category for a system COA; `name` defaults to the COA's own name. */
  private async resolveSystemCategoryId(
    tx: TxClient,
    familyGroupId: string,
    coaWhere: Prisma.CoaAccountWhereInput,
    name?: string,
  ): Promise<string> {
    const coaAccount = await tx.coaAccount.findFirst({
      where: { familyGroupId, ...coaWhere },
      orderBy: { code: "asc" },
    });
    if (!coaAccount) {
      throw new BadRequestException(
        "Akun COA untuk pelunasan dipercepat belum tersedia di keluarga ini",
      );
    }
    const categoryName = name ?? coaAccount.name;
    const existing = await tx.category.findFirst({
      where: { familyGroupId, name: categoryName, kind: "expense" },
      select: { id: true, coaAccountId: true },
    });
    if (existing) {
      if (existing.coaAccountId === coaAccount.id) return existing.id;
      throw new ConflictException(
        `Kategori "${categoryName}" sudah dipakai untuk akun COA lain — ganti nama kategori itu dulu`,
      );
    }
    const created = await tx.category.create({
      data: {
        familyGroupId,
        name: categoryName,
        kind: "expense",
        coaAccountId: coaAccount.id,
      },
    });
    return created.id;
  }
```

(f) In `apps/api/src/liabilities/liabilities.controller.ts`:

- Add `LiabilityPrepaymentRecordResponseDto` to the response-DTO import.
- Add the value import with its disable comment:

  ```ts
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  import { RecordPrepaymentDto } from "./dto/record-prepayment.dto";
  ```

- Insert after the `pay(...) { … }` route:

```ts
  @Post(":id/prepay")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Record an early repayment (full / reduce tenor / reduce installment): debits principal + penalty, persists the new terms; idempotent per idempotencyKey",
  })
  @ApiResponse({ status: 200, type: LiabilityPrepaymentRecordResponseDto })
  @ApiResponse({ status: 404, description: "Liability or account not found" })
  @ApiResponse({
    status: 400,
    description: "Not an anuitas loan, invalid amount/penalty, or overdraft",
  })
  @ApiResponse({ status: 409, description: "Category name conflict" })
  recordPrepayment(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: RecordPrepaymentDto,
    @Req() req: Request,
  ): Promise<LiabilityPrepaymentRecordResponseDto> {
    const userId = req.tenantContext?.userId ?? null;
    return this.fxInputs.run(
      {
        familyGroupId,
        userId,
        entity: "Liability",
        entityId: id,
        fieldPrefix: "prepay",
        dto,
        spec: FX_FIELD_SPECS.liabilityPrepayment,
      },
      (converted) =>
        this.liabilitiesService.recordPrepayment(
          familyGroupId,
          id,
          converted,
          userId,
        ),
    );
  }
```

(g) Append to `packages/contracts/src/liabilities/index.ts`:

```ts
// Revisi K — record an early repayment (the simulator's "Catat pelunasan").
export interface RecordLiabilityPrepaymentDto {
  sourceAccountId: string;
  mode: PrepaymentMode;
  amount?: string;
  penaltyPercent?: string;
  // Client UUID, one per simulation; a repeat returns the first record.
  idempotencyKey: string;
}

export interface LiabilityPrepaymentDto {
  id: string;
  mode: PrepaymentMode;
  principalAmount: string;
  penaltyPercent: string;
  penaltyAmount: string;
  effectivePeriod: number;
  installmentBefore: string | null;
  installmentAfter: string | null;
  tenorMonthsBefore: number;
  tenorMonthsAfter: number;
  occurredAt: string;
}

export interface LiabilityPrepaymentRecordResultDto {
  liability: LiabilityDto;
  prepayment: LiabilityPrepaymentDto;
  replayed: boolean;
}
```

Run (repo root): `pnpm --filter @wealthme/contracts build`
Expected: build succeeds.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities src/fx`
Expected: PASS.

- The K service spec has 16 more tests (`recordPrepayment`).
- The controller spec has 4 more, and PERMISSION/DENIAL now cover `recordPrepayment`: owner/member/spouse allowed; admin_staff, dependant, operational and anonymous refused.
- The fx holdings spec has 1 more.
- Task 8's `previewPrepayment` tests are still green.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/prepayment.util.ts src/liabilities/dto/record-prepayment.dto.ts src/liabilities/dto/liability-response.dto.ts src/liabilities/liabilities.service.ts src/liabilities/liabilities.controller.ts src/liabilities/liabilities.controller.spec.ts src/liabilities/liabilities.service.rate-plan.spec.ts src/fx/fx-field-specs.ts src/fx/fx-wiring-holdings.spec.ts`
Expected: exit 0 (hand-fix; never `--fix` on the service/controller).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/prepayment.util.ts apps/api/src/liabilities/dto/record-prepayment.dto.ts apps/api/src/liabilities/dto/liability-response.dto.ts apps/api/src/liabilities/liabilities.service.ts apps/api/src/liabilities/liabilities.controller.ts apps/api/src/liabilities/liabilities.controller.spec.ts apps/api/src/liabilities/liabilities.service.rate-plan.spec.ts apps/api/src/fx/fx-field-specs.ts apps/api/src/fx/fx-wiring-holdings.spec.ts packages/contracts/src/liabilities/index.ts packages/contracts/dist
git commit -m "$(cat <<'EOF'
feat(liabilities): record KPR early repayments

POST .../liabilities/:id/prepay debits principal + penalty (overdraft
floor applies), books the principal on a dedicated transfer category and
the penalty on COA 20011, and persists the reduced installment or tenor
from the prepayment's period so schedule, Pay preset and budget line
follow. Idempotent per idempotencyKey (a concurrent duplicate becomes a
replay); exempt from the monthly installment guard; fxInputs-aware.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 11: Web — scheme presets + rate-period editor in the add/edit form

**Before you start:** invoke `taste-skill:taste-skill` and follow its pre-flight for this form section. Run `git status`: if `apps/web/src/app/(app)/liabilitas/page.tsx` has changes that are not yours (sub-plan I's money inputs), stop and report. Otherwise rebase or pull first, and touch only the lines named below.

**Files:**

- Create: `apps/web/src/app/(app)/liabilitas/kpr-presets.ts`, `apps/web/src/app/(app)/liabilitas/kpr-presets.test.ts`
- Create: `apps/web/src/app/(app)/liabilitas/kpr-rate-periods-field.tsx`
- Create: `apps/web/src/app/(app)/liabilitas/api-error.ts` (moved helper)
- Modify: `apps/web/src/app/(app)/liabilitas/page.tsx` — imports; delete the local `extractApiErrorMessage` (~lines 69-86); `LiabilityBody` (~lines 330-347); `LiabilityModal` state (~lines 401-405); `handleSubmit` (~lines 474-512); the interest-rate field (~lines 661-673); the `type === "kpr"` block (~lines 728-758).
- Modify: `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx` — replace the test `"kpr: anuitas with fixed period + floating rate"` (~lines 539-570).
- Modify: `apps/web/src/i18n/types.ts`, `id.ts`, `en.ts`.

**Interfaces:**

- Consumes (contracts, from Task 5): `KprScheme`, `RatePeriodKind`, `LiabilityRatePeriodDto`, and `LiabilityDto.{ratePeriods, kprScheme, fixedRateMonths, floatingRate, interestRate}`.
- Produces:
  - **`./kpr-presets`:**
    - Types: `KprPresetId`, `RateSource = "official" | "example" | "user"`, `RatePeriodDraft { kind; months: string; ratePercent: string; source }`, `KprPlanDraft { presetId; scheme: KprScheme | null; periods }`.
    - Constants: `KPR_PRESETS`, `MAX_RATE_PERIODS = 10`, `DEFAULT_PREPAYMENT_PENALTY_PERCENT = "1.00"` (Task 12 uses it).
    - Functions: `presetById`, `draftFromPreset(id)`, `draftFromLiability(liability)`, `toRatePeriodsBody(periods): LiabilityRatePeriodDto[] | null`.
  - **`<KprRatePeriodsField value onChange />`.** Input labels follow `"<label> · Periode <n>"`, e.g. `Bunga/tahun (%) · Periode 1`. A rate taken from a preset shows a `Contoh` or `Resmi` badge until the user edits it.
  - **`extractApiErrorMessage(err, fallback)`**, exported from `./api-error` (Task 12 uses it).
  - **i18n:** `t.liabilitas.kpr.*` (form keys; Task 12 appends detail keys). G's now-unused `fieldFixedRateMonthsLabel` / `fieldFloatingRateLabel` are removed from all three files.
  - **Behaviour:**
    - For `type === "kpr" && interestMethod === "anuitas"`, the form hides the single rate input and shows the editor. It sends `ratePeriods`, `kprScheme` and `interestRate = ratePeriods[0].ratePercent`, and never sends `fixedRateMonths`/`floatingRate`.
    - An incomplete editor blocks submit with a toast.
    - Editing a G-era KPR prefills its pair as two **unlabelled** periods (they are the user's own numbers).

- [ ] **Step 1: Write the failing tests**

(a) Create `apps/web/src/app/(app)/liabilitas/kpr-presets.test.ts`:

```ts
import type { LiabilityDto } from "@wealthme/contracts";

import {
  draftFromLiability,
  draftFromPreset,
  toRatePeriodsBody,
} from "./kpr-presets";

describe("draftFromPreset (revisi K)", () => {
  it("berjenjang: example periods from the research, a fresh copy every call", () => {
    const draft = draftFromPreset("berjenjang");
    expect(draft).toEqual({
      presetId: "berjenjang",
      scheme: "berjenjang",
      periods: [
        { kind: "fixed", months: "24", ratePercent: "3.50", source: "example" },
        { kind: "fixed", months: "12", ratePercent: "5.50", source: "example" },
        {
          kind: "floating",
          months: "",
          ratePercent: "11.00",
          source: "example",
        },
      ],
    });
    const [first] = draft.periods;
    if (first) first.ratePercent = "9.00";
    expect(draftFromPreset("berjenjang").periods[0]?.ratePercent).toBe("3.50");
  });

  it("FLPP rates are official; manual starts empty as the user's own", () => {
    expect(draftFromPreset("flpp_rusun").periods).toEqual([
      { kind: "fixed", months: "", ratePercent: "6.00", source: "official" },
    ]);
    expect(draftFromPreset("flpp_tapak").scheme).toBe("flpp");
    expect(draftFromPreset("manual")).toEqual({
      presetId: "manual",
      scheme: null,
      periods: [{ kind: "fixed", months: "", ratePercent: "", source: "user" }],
    });
  });
});

describe("toRatePeriodsBody (revisi K)", () => {
  it("last period runs to maturity; Indonesian decimal commas are normalised", () => {
    expect(
      toRatePeriodsBody([
        { kind: "fixed", months: "24", ratePercent: "3,5", source: "user" },
        {
          kind: "floating",
          months: "999",
          ratePercent: "11",
          source: "example",
        },
      ]),
    ).toEqual([
      { kind: "fixed", months: 24, ratePercent: "3.5" },
      { kind: "floating", months: null, ratePercent: "11" },
    ]);
  });

  it.each([
    [
      "an empty rate",
      [{ kind: "fixed", months: "", ratePercent: "", source: "user" }],
    ],
    [
      "a zero-month tier",
      [
        { kind: "fixed", months: "0", ratePercent: "3.5", source: "user" },
        { kind: "floating", months: "", ratePercent: "11", source: "user" },
      ],
    ],
    [
      "a rate above 30%",
      [{ kind: "fixed", months: "", ratePercent: "31", source: "user" }],
    ],
    ["no periods", []],
  ] as const)("returns null for %s", (_label, periods) => {
    expect(toRatePeriodsBody([...periods])).toBeNull();
  });
});

describe("draftFromLiability (revisi K)", () => {
  const base = {
    type: "kpr",
    interestRate: "8",
    fixedRateMonths: null,
    floatingRate: null,
    kprScheme: null,
    ratePeriods: [],
  } as unknown as LiabilityDto;

  it("stored periods come back as the user's own numbers (never labelled examples)", () => {
    const draft = draftFromLiability({
      ...base,
      kprScheme: "flpp",
      ratePeriods: [{ kind: "fixed", months: null, ratePercent: "6.00" }],
    });
    expect(draft).toEqual({
      presetId: "flpp_rusun",
      scheme: "flpp",
      periods: [
        { kind: "fixed", months: "", ratePercent: "6.00", source: "user" },
      ],
    });
  });

  it("a G-era fixed/floating pair becomes two periods", () => {
    expect(
      draftFromLiability({ ...base, fixedRateMonths: 36, floatingRate: "11" })
        .periods,
    ).toEqual([
      { kind: "fixed", months: "36", ratePercent: "8", source: "user" },
      { kind: "floating", months: "", ratePercent: "11", source: "user" },
    ]);
  });

  it("a plain rate becomes one period to maturity", () => {
    expect(draftFromLiability(base).periods).toEqual([
      { kind: "fixed", months: "", ratePercent: "8", source: "user" },
    ]);
  });
});
```

(b) In `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx`, replace the whole `it("kpr: anuitas with fixed period + floating rate", async () => { … });` block with:

```tsx
it("kpr: berjenjang preset prefills labelled example periods, each overridable (revisi K)", async () => {
  const user = userEvent.setup();
  render(<LiabilitasPage />);
  const dialog = await openAddDialog(user);

  await user.type(dialog.getByLabelText("Nama"), "KPR BTN");
  await user.selectOptions(dialog.getByLabelText("Jenis"), "kpr");
  await user.type(
    dialog.getByLabelText("Total Utang / Limit (Rp)"),
    "500000000",
  );
  await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "500000000");
  await user.type(dialog.getByLabelText("Tenor (bulan)"), "240");
  expect(
    dialog.queryByLabelText("Bunga Fixed/Tahun (%)"),
  ).not.toBeInTheDocument();
  await user.selectOptions(dialog.getByLabelText("Skema KPR"), "berjenjang");

  expect(dialog.getByText(/bukan penawaran bank Anda/)).toBeInTheDocument();
  expect(dialog.getAllByText("Contoh")).toHaveLength(3);
  const tier1 = dialog.getByLabelText("Bunga/tahun (%) · Periode 1");
  expect(tier1).toHaveValue("3.50");
  await user.clear(tier1);
  await user.type(tier1, "3,25");
  expect(dialog.getAllByText("Contoh")).toHaveLength(2);

  await user.click(dialog.getByRole("button", { name: /simpan liabilitas/i }));

  await waitFor(() => expect(postBodies).toHaveLength(1));
  expect(postBodies[0]).toEqual(
    expect.objectContaining({
      type: "kpr",
      interestMethod: "anuitas",
      interestRate: "3.25",
      tenorMonths: 240,
      kprScheme: "berjenjang",
      ratePeriods: [
        { kind: "fixed", months: 24, ratePercent: "3.25" },
        { kind: "fixed", months: 12, ratePercent: "5.50" },
        { kind: "floating", months: null, ratePercent: "11.00" },
      ],
    }),
  );
  expect(postBodies[0]).not.toHaveProperty("fixedRateMonths");
  expect(postBodies[0]).not.toHaveProperty("floatingRate");
});

it("kpr: FLPP preset carries the official 5% rate, badged Resmi, not Contoh (revisi K)", async () => {
  const user = userEvent.setup();
  render(<LiabilitasPage />);
  const dialog = await openAddDialog(user);

  await user.type(dialog.getByLabelText("Nama"), "Rumah Subsidi");
  await user.selectOptions(dialog.getByLabelText("Jenis"), "kpr");
  await user.type(
    dialog.getByLabelText("Total Utang / Limit (Rp)"),
    "150000000",
  );
  await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "150000000");
  await user.type(dialog.getByLabelText("Tenor (bulan)"), "480");
  await user.selectOptions(dialog.getByLabelText("Skema KPR"), "flpp_tapak");

  expect(dialog.getByText(/Tarif resmi FLPP 2026/)).toBeInTheDocument();
  expect(dialog.getByText("Resmi")).toBeInTheDocument();
  expect(dialog.queryByText("Contoh")).not.toBeInTheDocument();

  await user.click(dialog.getByRole("button", { name: /simpan liabilitas/i }));

  await waitFor(() => expect(postBodies).toHaveLength(1));
  expect(postBodies[0]).toEqual(
    expect.objectContaining({
      kprScheme: "flpp",
      interestRate: "5.00",
      ratePeriods: [{ kind: "fixed", months: null, ratePercent: "5.00" }],
    }),
  );
});

it("kpr: editing a G-era KPR shows its own pair as unlabelled periods and PATCHes ratePeriods (revisi K)", async () => {
  liabilitiesFixture = [
    baseLiability({
      name: "KPR BTN",
      type: "kpr",
      interestMethod: "anuitas",
      interestRate: "8",
      totalDebt: "500000000",
      remainingBalance: "450000000",
      minimumPayment: "4182200",
      installmentAmount: "4182200",
      currentInstallmentAmount: "4182200",
      tenorMonths: 240,
      fixedRateMonths: 36,
      floatingRate: "11",
    }),
  ];
  const user = userEvent.setup();
  render(<LiabilitasPage />);

  await user.click(await screen.findByRole("button", { name: "Edit" }));
  const dialog = within(await screen.findByRole("dialog"));

  expect(dialog.queryByText("Contoh")).not.toBeInTheDocument();
  expect(dialog.getByLabelText("Bunga/tahun (%) · Periode 1")).toHaveValue("8");
  expect(dialog.getByLabelText("Lama (bulan) · Periode 1")).toHaveValue("36");
  expect(dialog.getByLabelText("Bunga/tahun (%) · Periode 2")).toHaveValue(
    "11",
  );

  await user.click(dialog.getByRole("button", { name: /simpan liabilitas/i }));

  await waitFor(() =>
    expect(mockApiFetch.mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(
      true,
    ),
  );
  const patch = mockApiFetch.mock.calls.find(([, o]) => o?.method === "PATCH");
  const body = JSON.parse(patch?.[1]?.body ?? "{}") as Record<string, unknown>;
  expect(body.ratePeriods).toEqual([
    { kind: "fixed", months: 36, ratePercent: "8" },
    { kind: "floating", months: null, ratePercent: "11" },
  ]);
  expect(body).not.toHaveProperty("fixedRateMonths");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/liabilitas"`
Expected: FAIL. You should see "Cannot find module './kpr-presets'" and "Unable to find a label with the text of: Skema KPR".

- [ ] **Step 3a: i18n**

In `apps/web/src/i18n/types.ts`, after `type LiabilitasInterestMethodId = …;` (line 208), add:

```ts
type LiabilitasKprPresetId =
  | "manual"
  | "flpp_tapak"
  | "flpp_rusun"
  | "konvensional"
  | "berjenjang"
  | "syariah_murabahah"
  | "syariah_mmq";
```

In the `liabilitas` block, delete `fieldFixedRateMonthsLabel: string;` and `fieldFloatingRateLabel: string;`. After `tenorMonthsSuffix: string;`, add:

```ts
/** Revisi K — KPR rate structure (form); Task 12 adds the detail keys. */
kpr: {
  planLegend: string;
  presetLabel: string;
  presetNames: Record<LiabilitasKprPresetId, string>;
  officialRateNote: string;
  exampleRateNote: string;
  mmqResetNote: string;
  exampleBadge: string;
  officialBadge: string;
  periodLabel: string;
  periodKindLabel: string;
  kindFixed: string;
  kindFloating: string;
  periodMonthsLabel: string;
  periodToMaturity: string;
  periodRateLabel: string;
  periodMarginLabel: string;
  addPeriod: string;
  removePeriod: string;
  planHint: string;
  planInvalid: string;
}
```

In `apps/web/src/i18n/id.ts` `liabilitas` block, delete the `fieldFixedRateMonthsLabel` and `fieldFloatingRateLabel` lines. After `tenorMonthsSuffix: " bulan",`, add:

```ts
    kpr: {
      planLegend: "Struktur bunga KPR",
      presetLabel: "Skema KPR",
      presetNames: {
        manual: "Manual — isi sendiri",
        flpp_tapak: "FLPP rumah tapak — 5% tetap",
        flpp_rusun: "FLPP rumah susun — 6% tetap",
        konvensional: "Konvensional — fixed lalu floating",
        berjenjang: "Fixed berjenjang lalu floating",
        syariah_murabahah: "Syariah murabahah — margin tetap",
        syariah_mmq: "Syariah MMQ/ijarah — tetap lalu ditinjau ulang",
      },
      officialRateNote:
        "Tarif resmi FLPP 2026 (Kementerian PKP): 5% rumah tapak, 6% rumah susun, tetap sepanjang tenor hingga 40 tahun.",
      exampleRateNote:
        'Bunga bertanda "Contoh" diambil dari data publik 2026, bukan penawaran bank Anda. Cocokkan dengan surat penawaran (SP3K) sebelum menyimpan.',
      mmqResetNote:
        "Belum ada acuan publik untuk tarif setelah ditinjau ulang; contoh memakai bunga floating konvensional.",
      exampleBadge: "Contoh",
      officialBadge: "Resmi",
      periodLabel: "Periode",
      periodKindLabel: "Tipe bunga",
      kindFixed: "Fixed",
      kindFloating: "Floating",
      periodMonthsLabel: "Lama (bulan)",
      periodToMaturity: "Sampai akhir tenor",
      periodRateLabel: "Bunga/tahun (%)",
      periodMarginLabel: "Margin/tahun (%)",
      addPeriod: "Tambah periode",
      removePeriod: "Hapus periode",
      planHint:
        "Cicilan dihitung ulang (anuitas) dari sisa pokok dan sisa tenor setiap kali bunga berganti.",
      planInvalid:
        "Lengkapi setiap periode: lama minimal 1 bulan (kecuali periode terakhir) dan bunga 0–30%.",
    },
```

In `apps/web/src/i18n/en.ts` `liabilitas` block, delete the same two keys. After `tenorMonthsSuffix: " months",`, add:

```ts
    kpr: {
      planLegend: "Mortgage rate structure",
      presetLabel: "Mortgage scheme",
      presetNames: {
        manual: "Manual — enter your own",
        flpp_tapak: "FLPP landed house — 5% fixed",
        flpp_rusun: "FLPP apartment — 6% fixed",
        konvensional: "Conventional — fixed then floating",
        berjenjang: "Tiered fixed then floating",
        syariah_murabahah: "Sharia murabahah — fixed margin",
        syariah_mmq: "Sharia MMQ/ijarah — fixed then reset",
      },
      officialRateNote:
        "Official 2026 FLPP rates (Ministry of Housing): 5% landed house, 6% apartment, fixed for the whole tenor, up to 40 years.",
      exampleRateNote:
        'Rates marked "Example" come from public 2026 data, not your bank\'s offer. Check them against your offer letter (SP3K) before saving.',
      mmqResetNote:
        "There is no public reference for the post-reset rate; the example uses a conventional floating rate.",
      exampleBadge: "Example",
      officialBadge: "Official",
      periodLabel: "Period",
      periodKindLabel: "Rate type",
      kindFixed: "Fixed",
      kindFloating: "Floating",
      periodMonthsLabel: "Length (months)",
      periodToMaturity: "Until maturity",
      periodRateLabel: "Rate/year (%)",
      periodMarginLabel: "Margin/year (%)",
      addPeriod: "Add period",
      removePeriod: "Remove period",
      planHint:
        "The installment is re-annuitised from the remaining principal and tenor every time the rate changes.",
      planInvalid:
        "Complete every period: at least 1 month (except the last) and a rate of 0–30%.",
    },
```

- [ ] **Step 3b: Presets module**

Create `apps/web/src/app/(app)/liabilitas/kpr-presets.ts`:

```ts
import type {
  KprScheme,
  LiabilityDto,
  LiabilityRatePeriodDto,
  RatePeriodKind,
} from "@wealthme/contracts";

export type KprPresetId =
  | "manual"
  | "flpp_tapak"
  | "flpp_rusun"
  | "konvensional"
  | "berjenjang"
  | "syariah_murabahah"
  | "syariah_mmq";

/** Where a shown rate came from; "user" once typed or loaded from a saved liability. */
export type RateSource = "official" | "example" | "user";

export interface RatePeriodDraft {
  kind: RatePeriodKind;
  /** Digits; ignored on the last period, which runs to maturity. */
  months: string;
  ratePercent: string;
  source: RateSource;
}

export interface KprPlanDraft {
  presetId: KprPresetId;
  scheme: KprScheme | null;
  periods: RatePeriodDraft[];
}

interface KprPreset {
  id: KprPresetId;
  scheme: KprScheme | null;
  source: RateSource;
  periods: ReadonlyArray<Omit<RatePeriodDraft, "source">>;
}

export const MAX_RATE_PERIODS = 10;
// Research: commonly 1-3% of the prepaid principal (docs/research/2026-09-26-kpr-indonesia.md §6).
export const DEFAULT_PREPAYMENT_PENALTY_PERCENT = "1.00";
const MAX_RATE_PERCENT = 30;
const RATE_PATTERN = /^\d{1,2}(\.\d{1,2})?$/;

const MANUAL: KprPreset = {
  id: "manual",
  scheme: null,
  source: "user",
  periods: [{ kind: "fixed", months: "", ratePercent: "" }],
};

// Figures: docs/research/2026-09-26-kpr-indonesia.md §1, §2, §4, §5 (2026). Only FLPP is official.
export const KPR_PRESETS: readonly KprPreset[] = [
  MANUAL,
  {
    id: "flpp_tapak",
    scheme: "flpp",
    source: "official",
    periods: [{ kind: "fixed", months: "", ratePercent: "5.00" }],
  },
  {
    id: "flpp_rusun",
    scheme: "flpp",
    source: "official",
    periods: [{ kind: "fixed", months: "", ratePercent: "6.00" }],
  },
  {
    id: "konvensional",
    scheme: "konvensional",
    source: "example",
    periods: [
      { kind: "fixed", months: "36", ratePercent: "2.75" },
      { kind: "floating", months: "", ratePercent: "11.00" },
    ],
  },
  {
    id: "berjenjang",
    scheme: "berjenjang",
    source: "example",
    periods: [
      { kind: "fixed", months: "24", ratePercent: "3.50" },
      { kind: "fixed", months: "12", ratePercent: "5.50" },
      { kind: "floating", months: "", ratePercent: "11.00" },
    ],
  },
  {
    id: "syariah_murabahah",
    scheme: "syariah_murabahah",
    source: "example",
    periods: [{ kind: "fixed", months: "", ratePercent: "6.00" }],
  },
  {
    id: "syariah_mmq",
    scheme: "syariah_mmq",
    source: "example",
    periods: [
      { kind: "fixed", months: "12", ratePercent: "3.30" },
      { kind: "floating", months: "", ratePercent: "11.00" },
    ],
  },
];

export function presetById(id: KprPresetId): KprPreset {
  return KPR_PRESETS.find((preset) => preset.id === id) ?? MANUAL;
}

export function draftFromPreset(id: KprPresetId): KprPlanDraft {
  const preset = presetById(id);
  return {
    presetId: preset.id,
    scheme: preset.scheme,
    periods: preset.periods.map((period) => ({
      ...period,
      source: preset.source,
    })),
  };
}

function ownPeriod(
  kind: RatePeriodKind,
  months: number | null,
  ratePercent: string,
): RatePeriodDraft {
  return {
    kind,
    months: months === null ? "" : String(months),
    ratePercent,
    source: "user",
  };
}

function presetIdFor(liability: LiabilityDto): KprPresetId {
  if (liability.kprScheme === null) return "manual";
  if (liability.kprScheme !== "flpp") return liability.kprScheme;
  return Number(liability.ratePeriods[0]?.ratePercent) === 6
    ? "flpp_rusun"
    : "flpp_tapak";
}

/** A saved liability's rates are the user's own numbers, never labelled as examples. */
export function draftFromLiability(liability: LiabilityDto): KprPlanDraft {
  const base = {
    presetId: presetIdFor(liability),
    scheme: liability.kprScheme,
  };
  if (liability.ratePeriods.length > 0) {
    return {
      ...base,
      periods: liability.ratePeriods.map((p) =>
        ownPeriod(p.kind, p.months, p.ratePercent),
      ),
    };
  }
  if (liability.fixedRateMonths !== null && liability.floatingRate !== null) {
    return {
      ...base,
      periods: [
        ownPeriod("fixed", liability.fixedRateMonths, liability.interestRate),
        ownPeriod("floating", null, liability.floatingRate),
      ],
    };
  }
  return {
    ...base,
    periods: [
      ownPeriod(
        "fixed",
        null,
        Number(liability.interestRate) > 0 ? liability.interestRate : "",
      ),
    ],
  };
}

/** Wire body for the periods, or null while any period is incomplete. */
export function toRatePeriodsBody(
  periods: RatePeriodDraft[],
): LiabilityRatePeriodDto[] | null {
  const lastIndex = periods.length - 1;
  const body = periods.map((period, index) => ({
    kind: period.kind,
    months: index === lastIndex ? null : Number(period.months),
    ratePercent: period.ratePercent.trim().replace(",", "."),
  }));
  const valid =
    body.length > 0 &&
    body.every(
      (p) =>
        RATE_PATTERN.test(p.ratePercent) &&
        Number(p.ratePercent) <= MAX_RATE_PERCENT &&
        (p.months === null || (Number.isInteger(p.months) && p.months >= 1)),
    );
  return valid ? body : null;
}
```

- [ ] **Step 3c: Editor component**

Create `apps/web/src/app/(app)/liabilitas/kpr-rate-periods-field.tsx`:

```tsx
"use client";

import { Plus, Trash2 } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";

import {
  KPR_PRESETS,
  MAX_RATE_PERIODS,
  draftFromPreset,
  type KprPlanDraft,
  type KprPresetId,
  type RatePeriodDraft,
} from "./kpr-presets";

export function KprRatePeriodsField({
  value,
  onChange,
}: {
  value: KprPlanDraft;
  onChange: (next: KprPlanDraft) => void;
}) {
  const { t } = useLocale();
  const k = t.liabilitas.kpr;
  const lastIndex = value.periods.length - 1;
  const isSyariah =
    value.scheme === "syariah_murabahah" || value.scheme === "syariah_mmq";
  const rateLabel = isSyariah ? k.periodMarginLabel : k.periodRateLabel;
  const hasExample = value.periods.some((p) => p.source === "example");
  const hasOfficial = value.periods.some((p) => p.source === "official");

  function update(index: number, patch: Partial<RatePeriodDraft>) {
    onChange({
      ...value,
      periods: value.periods.map((period, i) =>
        i === index ? { ...period, ...patch } : period,
      ),
    });
  }

  function addPeriod() {
    const tier: RatePeriodDraft = {
      kind: "fixed",
      months: "12",
      ratePercent: "",
      source: "user",
    };
    onChange({
      ...value,
      periods: [
        ...value.periods.slice(0, lastIndex),
        tier,
        ...value.periods.slice(lastIndex),
      ],
    });
  }

  function removePeriod(index: number) {
    onChange({
      ...value,
      periods: value.periods.filter((_, i) => i !== index),
    });
  }

  return (
    <fieldset className="field mt-3">
      <legend className="label">{k.planLegend}</legend>
      <label className="label" htmlFor="kpr-preset">
        {k.presetLabel}
      </label>
      <select
        id="kpr-preset"
        className="select"
        value={value.presetId}
        onChange={(e) =>
          onChange(draftFromPreset(e.target.value as KprPresetId))
        }
      >
        {KPR_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {k.presetNames[preset.id]}
          </option>
        ))}
      </select>
      {hasOfficial && (
        <div className="notice notice--info mt-2">{k.officialRateNote}</div>
      )}
      {hasExample && (
        <div className="notice notice--warning mt-2">
          {k.exampleRateNote}
          {value.presetId === "syariah_mmq" ? ` ${k.mmqResetNote}` : ""}
        </div>
      )}

      <ol className="mt-2 space-y-2">
        {value.periods.map((period, index) => {
          const n = index + 1;
          const suffix = ` · ${k.periodLabel} ${n}`;
          const isLast = index === lastIndex;
          return (
            <li key={index} className="rounded-lg border p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold">
                <span>
                  {k.periodLabel} {n}
                </span>
                <span className="flex items-center gap-1.5">
                  {period.source === "example" && (
                    <span className="badge badge--warning">
                      {k.exampleBadge}
                    </span>
                  )}
                  {period.source === "official" && (
                    <span className="badge badge--info">{k.officialBadge}</span>
                  )}
                  {value.periods.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      aria-label={`${k.removePeriod}${suffix}`}
                      onClick={() => removePeriod(index)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </span>
              </div>
              <div className="field-row">
                <div className="field mt-0">
                  <label className="label" htmlFor={`kpr-period-${n}-kind`}>
                    {k.periodKindLabel}
                    <span className="sr-only">{suffix}</span>
                  </label>
                  <select
                    id={`kpr-period-${n}-kind`}
                    className="select"
                    value={period.kind}
                    onChange={(e) =>
                      update(index, {
                        kind: e.target.value as RatePeriodDraft["kind"],
                      })
                    }
                  >
                    <option value="fixed">{k.kindFixed}</option>
                    <option value="floating">{k.kindFloating}</option>
                  </select>
                </div>
                <div className="field mt-0">
                  {isLast ? (
                    <>
                      <span className="label">{k.periodMonthsLabel}</span>
                      <div className="input t-muted">{k.periodToMaturity}</div>
                    </>
                  ) : (
                    <>
                      <label
                        className="label"
                        htmlFor={`kpr-period-${n}-months`}
                      >
                        {k.periodMonthsLabel}
                        <span className="sr-only">{suffix}</span>
                      </label>
                      <input
                        id={`kpr-period-${n}-months`}
                        className="input mono"
                        inputMode="numeric"
                        value={period.months}
                        onChange={(e) =>
                          update(index, {
                            months: e.target.value.replace(/\D/g, ""),
                          })
                        }
                      />
                    </>
                  )}
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor={`kpr-period-${n}-rate`}>
                    {rateLabel}
                    <span className="sr-only">{suffix}</span>
                  </label>
                  <input
                    id={`kpr-period-${n}-rate`}
                    className="input mono"
                    inputMode="decimal"
                    value={period.ratePercent}
                    onChange={(e) =>
                      update(index, {
                        ratePercent: e.target.value,
                        source: "user",
                      })
                    }
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {value.periods.length < MAX_RATE_PERIODS && (
        <button
          type="button"
          className="btn btn--outline btn--sm mt-2"
          onClick={addPeriod}
        >
          <Plus className="size-4" aria-hidden="true" /> {k.addPeriod}
        </button>
      )}
      <div className="hint">{k.planHint}</div>
    </fieldset>
  );
}
```

The accessible name of the rate input is `"Bunga/tahun (%) · Periode 1"`: the `sr-only` span carries the suffix, so the visible label stays short. Check that `sr-only` exists (a Tailwind utility). If `getByLabelText` does not match because of whitespace, keep the suffix string exactly `" · Periode 1"` as built above.

- [ ] **Step 3d: Move the error helper, wire the modal**

Create `apps/web/src/app/(app)/liabilitas/api-error.ts`. The function body moves **verbatim** from `page.tsx` (lines ~69-86), with `export` added and the comments shortened:

```ts
// Mirrors the local `extractApiErrorMessage` helper already used on
// /rekening, /dana, /tax, /mastercoa, /akun, /masterdata — the server's real
// message must reach the user instead of a generic fallback.
export function extractApiErrorMessage(err: unknown, fallback: string): string {
  // Only trust the message when the object also carries the ApiError shape's
  // `status`, otherwise a raw network/abort error would leak verbatim.
  return err && typeof err === "object" && "status" in err && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}
```

In `apps/web/src/app/(app)/liabilitas/page.tsx`:

1. **Imports.**
   - Delete the local `extractApiErrorMessage` function and its comment block.
   - Add after the `@wealthme/contracts` type import:

     ```ts
     import { extractApiErrorMessage } from "./api-error";
     import {
       draftFromLiability,
       draftFromPreset,
       toRatePeriodsBody,
       type KprPlanDraft,
     } from "./kpr-presets";
     import { KprRatePeriodsField } from "./kpr-rate-periods-field";
     ```

   - Add `KprScheme` and `LiabilityRatePeriodDto` to the `import type { … } from "@wealthme/contracts";` list.

2. **`LiabilityBody`.** Replace `fixedRateMonths?: number;` and `floatingRate?: string;` with:

   ```ts
     kprScheme?: KprScheme;
     ratePeriods?: LiabilityRatePeriodDto[];
   ```

3. **State.** In `LiabilityModal`, replace the two states `fixedRateMonths` / `floatingRate` (the `useState(editing?.fixedRateMonths …)` and `useState(editing?.floatingRate ?? "")` lines) with:

   ```ts
   const [kprPlan, setKprPlan] = useState<KprPlanDraft>(() =>
     editing ? draftFromLiability(editing) : draftFromPreset("manual"),
   );
   ```

   and after `const usesTenor = interestMethod !== "efektif";`, add:

   ```ts
   const usesRatePlan = type === "kpr" && interestMethod === "anuitas";
   ```

4. **`handleSubmit`.**
   - Delete `const fixedDigits = toDigits(fixedRateMonths);`.
   - After `const tenorDigits = toDigits(tenorMonths);`, add:

     ```ts
     const ratePeriods = usesRatePlan
       ? toRatePeriodsBody(kprPlan.periods)
       : undefined;
     if (ratePeriods === null) {
       toast.error(t.liabilitas.kpr.planInvalid);
       return;
     }
     ```

   - In the `mutation.mutate({ … })` body, replace `interestRate: toDecimalString(interestRate),` with:

     ```ts
           interestRate: usesRatePlan
             ? ratePeriods?.[0]?.ratePercent
             : toDecimalString(interestRate),
     ```

   - Replace the two lines `fixedRateMonths: …` and `floatingRate: …` with:

     ```ts
           kprScheme: usesRatePlan ? (kprPlan.scheme ?? undefined) : undefined,
           ratePeriods,
     ```

5. **Interest-rate field.** Wrap the `<div className="field mt-0">` that contains `htmlFor="liability-interest-rate"` in `{!usesRatePlan && ( … )}`.
6. **KPR block.** Replace the whole `{type === "kpr" && ( <div className="field-row mt-3"> … liability-fixed-months … liability-floating-rate … </div> )}` block with:

   ```tsx
   {
     usesRatePlan && (
       <KprRatePeriodsField value={kprPlan} onChange={setKprPlan} />
     );
   }
   ```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(liabilitas|anggaran)"`
Expected: PASS. `kpr-presets.test.ts` has 10 tests; `liabilitas.test.tsx` has 2 more (one G test replaced by three). All other tests are unchanged.

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: no errors in files this task touched.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/liabilitas/kpr-presets.ts" "src/app/(app)/liabilitas/kpr-presets.test.ts" "src/app/(app)/liabilitas/kpr-rate-periods-field.tsx" "src/app/(app)/liabilitas/api-error.ts" "src/app/(app)/liabilitas/page.tsx" "src/app/(app)/liabilitas/liabilitas.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/liabilitas/kpr-presets.ts" "apps/web/src/app/(app)/liabilitas/kpr-presets.test.ts" "apps/web/src/app/(app)/liabilitas/kpr-rate-periods-field.tsx" "apps/web/src/app/(app)/liabilitas/api-error.ts" "apps/web/src/app/(app)/liabilitas/page.tsx" "apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(web): KPR scheme presets and per-period rate editor

FLPP (official 5%/6%), konvensional, berjenjang, murabahah and MMQ presets
prefill rate periods; non-official figures carry a "Contoh" badge and an
SP3K check notice until the user edits them. Every period is manually
overridable; saved rates always read as the user's own.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 12: Web — Detail dialog: rate column with "Estimasi", floating history panel, prepayment simulator

**Before you start:** invoke `taste-skill:taste-skill` (a data-dense panel inside an existing `dialog--wide`, using the existing classes only). Check `git status` for foreign edits in `page.tsx`, as in Task 11.

**Files:**

- Create: `apps/web/src/app/(app)/liabilitas/schedule-rate-cell.tsx`
- Create: `apps/web/src/app/(app)/liabilitas/kpr-floating-rates-panel.tsx`, `apps/web/src/app/(app)/liabilitas/kpr-floating-rates-panel.test.tsx`
- Create: `apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.tsx`, `apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.test.tsx`
- Modify: `apps/web/src/app/(app)/liabilitas/page.tsx` — `LiabilityDetailDialog` (~lines 1055-1350), plus a one-block seam at the top of `PayLiabilityDialog`'s `<DialogBody>` (the "Telat" notice; sub-plan I's amount inputs are untouched)
- Modify: `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx` — schedule mock variables, a floating-rates GET branch, one new test
- Modify: `apps/web/src/i18n/types.ts`, `id.ts`, `en.ts` (append to `liabilitas.kpr`)

**Interfaces:**

- Consumes:
  - Contracts from Task 5: `LiabilityScheduleDto.{rateBands, hasFloatingPeriod}`, `LiabilityRateBandDto`, `LiabilityFloatingRateDto`, `LiabilityPrepaymentPreviewDto`, `PrepaymentMode`.
  - Task 7 routes (`GET/POST …/floating-rates`, `DELETE …/floating-rates/:rateId`) and the Task 8 route (`GET …/prepayment-preview`).
  - Task 11's `extractApiErrorMessage` and `DEFAULT_PREPAYMENT_PENALTY_PERCENT`.
- Produces:
  - `<ScheduleRateCell bands period estimateLabel />`.
  - `<KprFloatingRatesPanel familyGroupId liabilityId token onChanged />`, with query key `["liabilities", familyGroupId, "floating-rates", liabilityId]`. That key sits under `queryKeys.liabilities.all`, so the page's `invalidateLiabilityRelatedQueries` refreshes it, the schedule, the list and the budget together.
  - `<KprPrepaymentSimulator familyGroupId liabilityId token />`. It fetches on submit only, and its prepayment amount is IDR-only (Global Constraints).
  - The Detail dialog shows both panels only for `type === "kpr" && interestMethod === "anuitas"`, and the history panel only when the schedule has a floating period.

- [ ] **Step 1: Write the failing tests**

(a) Create `apps/web/src/app/(app)/liabilitas/kpr-floating-rates-panel.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as idDict } from "../../../i18n/id";

import { KprFloatingRatesPanel } from "./kpr-floating-rates-panel";

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));
// DateField's calendar popover is covered by its own tests; a plain input keeps this spec about the panel.
jest.mock("../../../components/wm", () => ({
  DateField: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const k = idDict.liabilitas.kpr;
const PATH = "/family-groups/fg-1/liabilities/liab-1/floating-rates";
const RATE = {
  id: "fr-1",
  effectiveDate: "2031-01-15",
  ratePercent: "9.75",
  effectivePeriod: 61,
  note: null,
  createdAt: "2031-01-10T00:00:00.000Z",
};

function renderPanel() {
  const onChanged = jest.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <KprFloatingRatesPanel
        familyGroupId="fg-1"
        liabilityId="liab-1"
        token="t"
        onChanged={onChanged}
      />
    </QueryClientProvider>,
  );
  return onChanged;
}

describe("KprFloatingRatesPanel (revisi K)", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("lists recorded changes with the installment each one starts at", async () => {
    mockApiFetch.mockResolvedValue([RATE]);
    renderPanel();

    expect(await screen.findByText("9.75%")).toBeInTheDocument();
    expect(screen.getByText(/berlaku dari cicilan ke-61/)).toBeInTheDocument();
  });

  it("records a change: POSTs the date and a dot-decimal rate, then refreshes", async () => {
    mockApiFetch.mockImplementation(
      (_url: string, opts?: { method?: string }) =>
        Promise.resolve(opts?.method === "POST" ? RATE : []),
    );
    const onChanged = renderPanel();
    const user = userEvent.setup();

    expect(await screen.findByText(k.historyEmpty)).toBeInTheDocument();
    await user.type(screen.getByLabelText(k.historyDateLabel), "2031-01-15");
    await user.type(screen.getByLabelText(k.historyRateLabel), "9,75");
    await user.click(screen.getByRole("button", { name: k.historyAddButton }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith(
      PATH,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          effectiveDate: "2031-01-15",
          ratePercent: "9.75",
        }),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith(k.historySaved);
  });

  it("shows the server's 409 message instead of a generic error", async () => {
    const message =
      "Sudah ada perubahan bunga pada tanggal ini — hapus dulu yang lama";
    mockApiFetch.mockImplementation(
      (_url: string, opts?: { method?: string }) =>
        opts?.method === "POST"
          ? Promise.reject({ status: 409, message })
          : Promise.resolve([]),
    );
    renderPanel();
    const user = userEvent.setup();

    await screen.findByText(k.historyEmpty);
    await user.type(screen.getByLabelText(k.historyDateLabel), "2031-01-15");
    await user.type(screen.getByLabelText(k.historyRateLabel), "9.75");
    await user.click(screen.getByRole("button", { name: k.historyAddButton }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
  });

  it("deletes a change by id", async () => {
    mockApiFetch.mockImplementation(
      (_url: string, opts?: { method?: string }) =>
        Promise.resolve(opts?.method === "DELETE" ? undefined : [RATE]),
    );
    const onChanged = renderPanel();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: `${k.historyDeleteButton} 2031-01-15`,
      }),
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith(
      `${PATH}/fr-1`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
```

(b) Create `apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as idDict } from "../../../i18n/id";

import { KprPrepaymentSimulator } from "./kpr-prepayment-simulator";

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const k = idDict.liabilitas.kpr;
const BASE_URL = "/family-groups/fg-1/liabilities/liab-1/prepayment-preview?";
const PREVIEW = {
  liabilityId: "liab-1",
  mode: "reduce_installment",
  prepaidPrincipal: "100000000",
  penaltyPercent: "1.00",
  penalty: "1000000",
  cashOutNow: "101000000",
  installmentBefore: "4546388",
  installmentAfter: "3409791",
  remainingMonthsBefore: 180,
  remainingMonthsAfter: 180,
  totalInterestBefore: "418349734",
  totalInterestAfter: "313762283",
  interestSaved: "104587451",
  netSaving: "103587451",
  assumesCurrentFloatingRate: true,
};

function renderSimulator() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <KprPrepaymentSimulator
        familyGroupId="fg-1"
        liabilityId="liab-1"
        token="t"
      />
    </QueryClientProvider>,
  );
}

describe("KprPrepaymentSimulator (revisi K)", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("says it records nothing, defaults the penalty to the labelled 1% example, and fetches only on submit", () => {
    renderSimulator();

    expect(screen.getByText(k.prepaySimulationNote)).toBeInTheDocument();
    expect(screen.getByLabelText(k.prepayPenaltyLabel)).toHaveValue("1.00");
    expect(screen.getByText(k.prepayPenaltyHint)).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("reduce installment: sends mode, penalty and the digits of the amount; shows the server's numbers", async () => {
    mockApiFetch.mockResolvedValue(PREVIEW);
    renderSimulator();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("radio", { name: k.prepayModes.reduce_installment }),
    );
    await user.type(screen.getByLabelText(k.prepayAmountLabel), "100000000");
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `${BASE_URL}mode=reduce_installment&penaltyPercent=1.00&amount=100000000`,
        expect.objectContaining({ token: "t" }),
      ),
    );
    expect(await screen.findByText(/3\.409\.791/)).toBeInTheDocument();
    expect(screen.getByText(/104\.587\.451/)).toBeInTheDocument();
    expect(screen.getByText(k.prepayEstimateNote)).toBeInTheDocument();
  });

  it("full payoff sends no amount", async () => {
    mockApiFetch.mockResolvedValue({ ...PREVIEW, mode: "full" });
    renderSimulator();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: k.prepayModes.full }));
    expect(
      screen.queryByLabelText(k.prepayAmountLabel),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `${BASE_URL}mode=full&penaltyPercent=1.00`,
        expect.anything(),
      ),
    );
  });

  it("shows the server's 400 message", async () => {
    mockApiFetch.mockRejectedValue({
      status: 400,
      message:
        "Jumlah pelunasan harus lebih dari 0 dan tidak melebihi sisa pokok",
    });
    renderSimulator();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(k.prepayAmountLabel), "999999999999");
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    expect(
      await screen.findByText(/tidak melebihi sisa pokok/),
    ).toBeInTheDocument();
  });
});
```

(c) In `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx`:

- Next to `let scheduleRows …`, add:

  ```ts
  let scheduleBands: {
    fromPeriod: number;
    toPeriod: number;
    ratePercent: string;
    kind: "fixed" | "floating";
  }[] = [];
  let scheduleHasFloating = false;
  ```

- In the schedule mock, change the Task 5 literals to `rateBands: scheduleBands,` and `hasFloatingPeriod: scheduleHasFloating,`.
- In `beforeEach`, after `scheduleRows = SCHEDULE_ROWS;`, add `scheduleBands = []; scheduleHasFloating = false;`.
- In `mockApiFetch`, directly before the final `return Promise.reject(new Error(\`unexpected url…\`))`, add:

  ```ts
  if (
    url ===
    `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/floating-rates`
  ) {
    return Promise.resolve([]);
  }
  ```

- Add this test next to the other Detail tests:

  ```tsx
  it("kpr detail: rate column badges floating rows Estimasi and shows history + prepayment panels (revisi K)", async () => {
    liabilitiesFixture = [
      baseLiability({
        name: "KPR BTN",
        type: "kpr",
        interestMethod: "anuitas",
        tenorMonths: 240,
        installmentAmount: "4182200",
        currentInstallmentAmount: "4182200",
      }),
    ];
    scheduleRows = [
      {
        period: 36,
        installment: "3390269",
        interest: "2062537",
        principal: "1327732",
        remaining: "448680240",
      },
      {
        period: 37,
        installment: "4869888",
        interest: "4112902",
        principal: "756986",
        remaining: "447923254",
      },
    ];
    scheduleBands = [
      { fromPeriod: 36, toPeriod: 36, ratePercent: "5.50", kind: "fixed" },
      { fromPeriod: 37, toPeriod: 37, ratePercent: "11.00", kind: "floating" },
    ];
    scheduleHasFloating = true;
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Detail" }));
    const dialog = within(await screen.findByRole("dialog"));
    const table = within(await dialog.findByRole("table"));

    expect(table.getByText("5.50%")).toBeInTheDocument();
    expect(table.getAllByText("Estimasi")).toHaveLength(1);
    expect(
      dialog.getByText(/Baris floating adalah estimasi/),
    ).toBeInTheDocument();
    expect(
      await dialog.findByText("Riwayat bunga floating"),
    ).toBeInTheDocument();
    expect(
      dialog.getByText("Simulasi pelunasan dipercepat"),
    ).toBeInTheDocument();
  });
  ```

(d) Also in `liabilitas.test.tsx`, add next to the Pay tests:

```tsx
it("Pay dialog marks an installment inside its 5-day grace window as Telat (revisi K)", async () => {
  liabilitiesFixture = [baseLiability({ currentInstallmentLate: true })];
  const user = userEvent.setup();
  render(<LiabilitasPage />);

  await user.click(await screen.findByRole("button", { name: "Bayar" }));
  const dialog = within(await screen.findByRole("dialog"));

  expect(dialog.getByText("Telat")).toBeInTheDocument();
  expect(dialog.getByText(/masa tenggang 5 hari/)).toBeInTheDocument();
});

it("Pay dialog shows no Telat notice for an installment that is not late", async () => {
  const user = userEvent.setup();
  render(<LiabilitasPage />);

  await user.click(await screen.findByRole("button", { name: "Bayar" }));
  const dialog = within(await screen.findByRole("dialog"));

  expect(dialog.queryByText("Telat")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/liabilitas"`
Expected: FAIL. You should see "Cannot find module './kpr-floating-rates-panel'" and "Cannot find module './kpr-prepayment-simulator'", and the page test finds no "5.50%".

- [ ] **Step 3a: i18n (append to `liabilitas.kpr` in all three files)**

`types.ts`: after `type LiabilitasKprPresetId …`, add `type LiabilitasPrepaymentModeId = "full" | "reduce_tenor" | "reduce_installment";`. Inside `kpr: { … }`, after `planInvalid: string;`, add:

```ts
scheduleRateHeader: string;
floatingEstimateBadge: string;
floatingEstimateNote: string;
historyTitle: string;
historyHint: string;
historyEmpty: string;
historyLoadFailed: string;
historyDateLabel: string;
historyRateLabel: string;
historyAddButton: string;
historyDeleteButton: string;
historyFromPeriodPrefix: string;
historySaved: string;
historyDeleted: string;
historySaveFailed: string;
prepayTitle: string;
prepaySimulationNote: string;
prepayModeLabel: string;
prepayModes: Record<LiabilitasPrepaymentModeId, string>;
prepayAmountLabel: string;
prepayPenaltyLabel: string;
prepayPenaltyHint: string;
prepaySubmit: string;
prepayResultPenalty: string;
prepayResultCashOut: string;
prepayResultInstallment: string;
prepayResultTenor: string;
prepayResultMonthsSuffix: string;
prepayResultInterestSaved: string;
prepayResultNetSaving: string;
prepayEstimateNote: string;
prepayFailed: string;
```

`id.ts` (after `planInvalid: …,`):

```ts
      scheduleRateHeader: "Bunga",
      floatingEstimateBadge: "Estimasi",
      floatingEstimateNote:
        "Baris floating adalah estimasi: dihitung dengan bunga floating terakhir yang diketahui, yang bisa diubah bank kapan saja.",
      historyTitle: "Riwayat bunga floating",
      historyHint:
        "Catat dari pemberitahuan bank. Bunga baru berlaku mulai cicilan penuh pertama sejak tanggal efektif; cicilan dihitung ulang dari sisa pokok dan sisa tenor.",
      historyEmpty:
        "Belum ada perubahan tercatat — jadwal memakai bunga floating dari periode bunga.",
      historyLoadFailed: "Riwayat bunga gagal dimuat.",
      historyDateLabel: "Tanggal efektif",
      historyRateLabel: "Bunga baru/tahun (%)",
      historyAddButton: "Catat perubahan",
      historyDeleteButton: "Hapus perubahan",
      historyFromPeriodPrefix: "berlaku dari cicilan ke-",
      historySaved: "Perubahan bunga dicatat",
      historyDeleted: "Perubahan bunga dihapus",
      historySaveFailed: "Gagal menyimpan perubahan bunga",
      prepayTitle: "Simulasi pelunasan dipercepat",
      prepaySimulationNote:
        "Simulasi saja — tidak mencatat pembayaran apa pun. Pelunasan penuh yang benar-benar dibayar dicatat lewat tombol Bayar.",
      prepayModeLabel: "Jenis pelunasan",
      prepayModes: {
        full: "Lunas penuh",
        reduce_tenor: "Sebagian — tenor lebih pendek",
        reduce_installment: "Sebagian — cicilan lebih kecil",
      },
      prepayAmountLabel: "Pokok yang dilunasi (Rp)",
      prepayPenaltyLabel: "Penalti (%)",
      prepayPenaltyHint:
        "Contoh 1% — umumnya 1–3% dari pokok yang dilunasi (bisa sampai 7%), sering lebih ringan di masa floating. Cek perjanjian kredit Anda.",
      prepaySubmit: "Hitung simulasi",
      prepayResultPenalty: "Penalti",
      prepayResultCashOut: "Total dibayar sekarang",
      prepayResultInstallment: "Cicilan",
      prepayResultTenor: "Sisa tenor",
      prepayResultMonthsSuffix: " bln",
      prepayResultInterestSaved: "Bunga yang dihemat",
      prepayResultNetSaving: "Hemat bersih (setelah penalti)",
      prepayEstimateNote:
        "Estimasi: bunga floating ke depan diasumsikan tetap, dan bunga berjalan sejak cicilan terakhir tidak dihitung.",
      prepayFailed: "Simulasi gagal",
```

`en.ts` (after `planInvalid: …,`):

```ts
      scheduleRateHeader: "Rate",
      floatingEstimateBadge: "Estimate",
      floatingEstimateNote:
        "Floating rows are estimates: they use the latest known floating rate, which the bank may change at any time.",
      historyTitle: "Floating-rate history",
      historyHint:
        "Record it from your bank's notice. The new rate applies from the first whole installment after the effective date; the installment is recalculated from the remaining principal and tenor.",
      historyEmpty:
        "No changes recorded yet — the schedule uses the floating rate from the rate periods.",
      historyLoadFailed: "Could not load the rate history.",
      historyDateLabel: "Effective date",
      historyRateLabel: "New rate/year (%)",
      historyAddButton: "Record change",
      historyDeleteButton: "Delete change",
      historyFromPeriodPrefix: "applies from installment #",
      historySaved: "Rate change recorded",
      historyDeleted: "Rate change deleted",
      historySaveFailed: "Could not save the rate change",
      prepayTitle: "Early repayment simulation",
      prepaySimulationNote:
        "Simulation only — nothing is recorded. A full payoff you actually made is recorded with Pay.",
      prepayModeLabel: "Repayment type",
      prepayModes: {
        full: "Pay off in full",
        reduce_tenor: "Partial — shorter tenor",
        reduce_installment: "Partial — smaller installment",
      },
      prepayAmountLabel: "Principal to prepay (Rp)",
      prepayPenaltyLabel: "Penalty (%)",
      prepayPenaltyHint:
        "Example 1% — commonly 1–3% of the prepaid principal (up to 7%), often lower in the floating period. Check your credit agreement.",
      prepaySubmit: "Run simulation",
      prepayResultPenalty: "Penalty",
      prepayResultCashOut: "Total paid now",
      prepayResultInstallment: "Installment",
      prepayResultTenor: "Remaining tenor",
      prepayResultMonthsSuffix: " mo",
      prepayResultInterestSaved: "Interest saved",
      prepayResultNetSaving: "Net saving (after penalty)",
      prepayEstimateNote:
        "Estimate: future floating rates are assumed unchanged, and interest accrued since the last installment is not included.",
      prepayFailed: "Simulation failed",
```

Also add, in the `liabilitas` block **outside** `kpr` (the Pay dialog serves every liability type):

- `types.ts`: after `tenorMonthsSuffix: string;`, add `payLateBadge: string;` and `payLateNote: string;`.
- `id.ts`: `payLateBadge: "Telat",` and `payLateNote: "Cicilan ini sudah lewat jatuh tempo — masih dihitung sebagai cicilan yang sama selama masa tenggang 5 hari.",`.
- `en.ts`: `payLateBadge: "Late",` and `payLateNote: "This installment is past its due date — it still counts as the same installment during the 5-day grace window.",`.

- [ ] **Step 3b: Components**

Create `apps/web/src/app/(app)/liabilitas/schedule-rate-cell.tsx`:

```tsx
import type { LiabilityRateBandDto } from "@wealthme/contracts";

export function ScheduleRateCell({
  bands,
  period,
  estimateLabel,
}: {
  bands: LiabilityRateBandDto[];
  period: number;
  estimateLabel: string;
}) {
  const band = bands.find(
    (b) => period >= b.fromPeriod && period <= b.toPeriod,
  );
  if (!band) return <>—</>;
  return (
    <>
      {band.ratePercent}%
      {band.kind === "floating" && (
        <span className="badge badge--warning ml-1">{estimateLabel}</span>
      )}
    </>
  );
}
```

Create `apps/web/src/app/(app)/liabilitas/kpr-floating-rates-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { LiabilityFloatingRateDto } from "@wealthme/contracts";

import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { DateField } from "@/components/wm";

import { extractApiErrorMessage } from "./api-error";

function formatDay(isoDate: string, locale: Locale): string {
  const [year = 1970, month = 1, day = 1] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(
    locale === "id" ? "id-ID" : "en-US",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

export function KprFloatingRatesPanel({
  familyGroupId,
  liabilityId,
  token,
  onChanged,
}: {
  familyGroupId: string;
  liabilityId: string;
  token: string | undefined;
  onChanged: () => void;
}) {
  const { t, locale } = useLocale();
  const k = t.liabilitas.kpr;
  const [effectiveDate, setEffectiveDate] = useState("");
  const [ratePercent, setRatePercent] = useState("");
  const path = `/family-groups/${familyGroupId}/liabilities/${liabilityId}/floating-rates`;

  const ratesQuery = useQuery<LiabilityFloatingRateDto[]>({
    queryKey: ["liabilities", familyGroupId, "floating-rates", liabilityId],
    queryFn: ({ signal }) =>
      apiFetch<LiabilityFloatingRateDto[]>(path, { token, signal }),
    enabled: Boolean(token),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      apiFetch<LiabilityFloatingRateDto>(path, {
        method: "POST",
        token,
        body: JSON.stringify({
          effectiveDate,
          ratePercent: ratePercent.trim().replace(",", "."),
        }),
      }),
    onSuccess: () => {
      setEffectiveDate("");
      setRatePercent("");
      toast.success(k.historySaved);
      onChanged();
    },
    onError: (err: unknown) =>
      toast.error(extractApiErrorMessage(err, k.historySaveFailed)),
  });

  const deleteMutation = useMutation({
    mutationFn: (rateId: string) =>
      apiFetch<void>(`${path}/${rateId}`, { method: "DELETE", token }),
    onSuccess: () => {
      toast.success(k.historyDeleted);
      onChanged();
    },
    onError: (err: unknown) =>
      toast.error(extractApiErrorMessage(err, k.historySaveFailed)),
  });

  const canAdd = Boolean(effectiveDate && ratePercent.trim());
  const rates = ratesQuery.data ?? [];

  return (
    <section
      className="rounded-lg border p-3.5"
      aria-labelledby="kpr-floating-title"
    >
      <div id="kpr-floating-title" className="mb-1 text-[12.5px] font-bold">
        {k.historyTitle}
      </div>
      <div className="hint mt-0">{k.historyHint}</div>

      {ratesQuery.isError ? (
        <div className="mt-2 text-[12px] text-destructive">
          {k.historyLoadFailed}
        </div>
      ) : rates.length === 0 ? (
        <div className="mt-2 text-[12px] text-muted-foreground">
          {ratesQuery.isLoading ? "…" : k.historyEmpty}
        </div>
      ) : (
        <ul className="mt-2 divide-y">
          {rates.map((rate) => (
            <li
              key={rate.id}
              className="flex items-center justify-between py-1.5 text-[12.5px]"
            >
              <span>
                <span className="mono font-semibold">{rate.ratePercent}%</span>
                {" · "}
                {formatDay(rate.effectiveDate, locale)}
                {rate.effectivePeriod !== null && (
                  <span className="t-muted">
                    {" · "}
                    {k.historyFromPeriodPrefix}
                    {rate.effectivePeriod}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                aria-label={`${k.historyDeleteButton} ${rate.effectiveDate}`}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(rate.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="field-row mt-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (canAdd) addMutation.mutate();
        }}
      >
        <div className="field mt-0">
          <label className="label" htmlFor="kpr-floating-date">
            {k.historyDateLabel}
          </label>
          <DateField
            id="kpr-floating-date"
            value={effectiveDate}
            locale={locale}
            label={k.historyDateLabel}
            onChange={setEffectiveDate}
          />
        </div>
        <div className="field mt-0">
          <label className="label" htmlFor="kpr-floating-rate">
            {k.historyRateLabel}
          </label>
          <input
            id="kpr-floating-rate"
            className="input mono"
            inputMode="decimal"
            value={ratePercent}
            onChange={(e) => setRatePercent(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn--outline btn--sm"
          disabled={!canAdd || addMutation.isPending}
        >
          {k.historyAddButton}
        </button>
      </form>
    </section>
  );
}
```

Create `apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  LiabilityPrepaymentPreviewDto,
  PrepaymentMode,
} from "@wealthme/contracts";

import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah } from "@/lib/format";

import { extractApiErrorMessage } from "./api-error";
import { DEFAULT_PREPAYMENT_PENALTY_PERCENT } from "./kpr-presets";

const MODES: readonly PrepaymentMode[] = [
  "reduce_tenor",
  "reduce_installment",
  "full",
];

function rupiah(value: string | null): string {
  return value === null ? "—" : formatRupiah(Number(value));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="t-xs t-muted">{label}</dt>
      <dd className="mono text-[13.5px] font-bold">{value}</dd>
    </div>
  );
}

// The amount is IDR-only on purpose: a read-only simulation of an IDR loan (see revisi-k plan, Global Constraints).
export function KprPrepaymentSimulator({
  familyGroupId,
  liabilityId,
  token,
}: {
  familyGroupId: string;
  liabilityId: string;
  token: string | undefined;
}) {
  const { t } = useLocale();
  const k = t.liabilitas.kpr;
  const [mode, setMode] = useState<PrepaymentMode>("reduce_tenor");
  const [amount, setAmount] = useState("");
  const [penaltyPercent, setPenaltyPercent] = useState(
    DEFAULT_PREPAYMENT_PENALTY_PERCENT,
  );
  const [search, setSearch] = useState<string | null>(null);

  const previewQuery = useQuery<LiabilityPrepaymentPreviewDto>({
    queryKey: [
      "liabilities",
      familyGroupId,
      "prepayment-preview",
      liabilityId,
      search,
    ],
    queryFn: ({ signal }) =>
      apiFetch<LiabilityPrepaymentPreviewDto>(
        `/family-groups/${familyGroupId}/liabilities/${liabilityId}/prepayment-preview?${search ?? ""}`,
        { token, signal },
      ),
    enabled: Boolean(token && search),
    retry: false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({
      mode,
      penaltyPercent: penaltyPercent.trim().replace(",", "."),
    });
    if (mode !== "full") {
      const digits = amount.replace(/\D/g, "");
      if (!digits) return;
      params.set("amount", digits);
    }
    setSearch(params.toString());
  }

  const result = previewQuery.data;

  return (
    <section
      className="rounded-lg border p-3.5"
      aria-labelledby="kpr-prepay-title"
    >
      <div id="kpr-prepay-title" className="mb-1 text-[12.5px] font-bold">
        {k.prepayTitle}
      </div>
      <div className="notice notice--info">{k.prepaySimulationNote}</div>

      <form className="mt-2" onSubmit={handleSubmit}>
        <fieldset className="field mt-0">
          <legend className="label">{k.prepayModeLabel}</legend>
          <div className="segmented">
            {MODES.map((m) => (
              <label key={m} className="segmented__item">
                <input
                  type="radio"
                  name="kpr-prepay-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />{" "}
                {k.prepayModes[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field-row mt-2">
          {mode !== "full" && (
            <div className="field mt-0">
              <label className="label" htmlFor="kpr-prepay-amount">
                {k.prepayAmountLabel}
              </label>
              <input
                id="kpr-prepay-amount"
                className="input mono"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              />
            </div>
          )}
          <div className="field mt-0">
            <label className="label" htmlFor="kpr-prepay-penalty">
              {k.prepayPenaltyLabel}
            </label>
            <input
              id="kpr-prepay-penalty"
              className="input mono"
              inputMode="decimal"
              aria-describedby="kpr-prepay-penalty-hint"
              value={penaltyPercent}
              onChange={(e) => setPenaltyPercent(e.target.value)}
            />
          </div>
        </div>
        <div className="hint" id="kpr-prepay-penalty-hint">
          {k.prepayPenaltyHint}
        </div>
        <button type="submit" className="btn btn--outline btn--sm mt-2">
          {k.prepaySubmit}
        </button>
      </form>

      {previewQuery.isError && (
        <div className="mt-2 text-[12px] text-destructive">
          {extractApiErrorMessage(previewQuery.error, k.prepayFailed)}
        </div>
      )}
      {result && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-muted p-3.5">
            <Stat
              label={k.prepayResultPenalty}
              value={rupiah(result.penalty)}
            />
            <Stat
              label={k.prepayResultCashOut}
              value={rupiah(result.cashOutNow)}
            />
            <Stat
              label={k.prepayResultInstallment}
              value={`${rupiah(result.installmentBefore)} → ${rupiah(result.installmentAfter)}`}
            />
            <Stat
              label={k.prepayResultTenor}
              value={`${result.remainingMonthsBefore} → ${result.remainingMonthsAfter}${k.prepayResultMonthsSuffix}`}
            />
            <Stat
              label={k.prepayResultInterestSaved}
              value={rupiah(result.interestSaved)}
            />
            <Stat
              label={k.prepayResultNetSaving}
              value={rupiah(result.netSaving)}
            />
          </dl>
          {result.assumesCurrentFloatingRate && (
            <div className="hint">{k.prepayEstimateNote}</div>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 3c: Detail dialog seam (`page.tsx`, `LiabilityDetailDialog` only)**

1. **Imports.** Add:

   ```ts
   import { KprFloatingRatesPanel } from "./kpr-floating-rates-panel";
   import { KprPrepaymentSimulator } from "./kpr-prepayment-simulator";
   import { ScheduleRateCell } from "./schedule-rate-cell";
   ```

2. **Locals.** In `LiabilityDetailDialog`, after `const { t, locale } = useLocale();`, add `const queryClient = useQueryClient();`. After `const scheduleRows = …;`, add:

   ```ts
   const rateBands = scheduleQuery.data?.rateBands ?? [];
   const hasFloatingPeriod = scheduleQuery.data?.hasFloatingPeriod ?? false;
   ```

3. **Header cell.** In the schedule `<thead>`, directly after the `amortisationScheduleHeaderDate` `<th>`, add `<th>{t.liabilitas.kpr.scheduleRateHeader}</th>`.
4. **Row cell.** In each `<tr>`, directly after the date `<td>`, add:

   ```tsx
   <td className="mono whitespace-nowrap">
     <ScheduleRateCell
       bands={rateBands}
       period={row.period}
       estimateLabel={t.liabilitas.kpr.floatingEstimateBadge}
     />
   </td>
   ```

5. **Estimate notice.** Directly after `<div className="hint">{t.liabilitas.amortisationDisclaimer}</div>`, add:

   ```tsx
   {
     hasFloatingPeriod && (
       <div className="notice notice--warning mt-2">
         {t.liabilitas.kpr.floatingEstimateNote}
       </div>
     );
   }
   ```

6. **Panels.** Directly before `{/* Prototype's `.notice` note row (liabilitas.html:405). */}`, add:

   ```tsx
   {
     item.type === "kpr" &&
       item.interestMethod === "anuitas" &&
       familyGroupId && (
         <>
           {hasFloatingPeriod && (
             <KprFloatingRatesPanel
               familyGroupId={familyGroupId}
               liabilityId={item.id}
               token={token}
               onChanged={() =>
                 invalidateLiabilityRelatedQueries(queryClient, familyGroupId)
               }
             />
           )}
           <KprPrepaymentSimulator
             familyGroupId={familyGroupId}
             liabilityId={item.id}
             token={token}
           />
         </>
       );
   }
   ```

- [ ] **Step 3d: Pay dialog "Telat" seam (`PayLiabilityDialog`)**

Insert as the first child of `PayLiabilityDialog`'s `<DialogBody>` (above the preset `.field`):

```tsx
{
  item.currentInstallmentLate && (
    <div className="notice notice--warning" role="status">
      <span className="badge badge--danger">{t.liabilitas.payLateBadge}</span>{" "}
      {t.liabilitas.payLateNote}
    </div>
  );
}
```

The "Cicilan" preset keeps its label and value (`currentInstallmentAmount`). During the grace window that value _is_ the late installment, and `pay()` books that same installment (Task 3).

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(liabilitas|anggaran)"`
Expected: PASS. The panel spec has 4 tests, the simulator spec has 4, and `liabilitas.test.tsx` has 3 more (Detail + two Pay "Telat"). Existing Detail tests (kartu kredit fixtures) are unchanged, because the K panels do not render for them.

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: no errors in files this task touched.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/liabilitas/schedule-rate-cell.tsx" "src/app/(app)/liabilitas/kpr-floating-rates-panel.tsx" "src/app/(app)/liabilitas/kpr-floating-rates-panel.test.tsx" "src/app/(app)/liabilitas/kpr-prepayment-simulator.tsx" "src/app/(app)/liabilitas/kpr-prepayment-simulator.test.tsx" "src/app/(app)/liabilitas/page.tsx" "src/app/(app)/liabilitas/liabilitas.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 6: Visual check (optional but recommended)**

If a dev server is already running for this worktree, open `/liabilitas` and check a berjenjang KPR at 375 px and 1440 px:

- The Detail rate column fits without horizontal scroll beyond the existing `table-wrap`.
- The "Estimasi" badges read clearly in both themes.

Do not start a production build.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/liabilitas/schedule-rate-cell.tsx" "apps/web/src/app/(app)/liabilitas/kpr-floating-rates-panel.tsx" "apps/web/src/app/(app)/liabilitas/kpr-floating-rates-panel.test.tsx" "apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.tsx" "apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.test.tsx" "apps/web/src/app/(app)/liabilitas/page.tsx" "apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(web): KPR detail shows rate per installment, floating history and prepayment simulator

The schedule gains a rate column; floating rows are badged "Estimasi" with
a note that the bank may change the rate. Users record floating changes
from bank notices, and simulate full or partial prepayment (reduce tenor
vs installment) with an editable, example-labelled penalty. Nothing in
the simulator is recorded.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

### Task 13: Web — "Catat pelunasan": record the simulated prepayment

**Before you start:** invoke `taste-skill:taste-skill` (a money-moving confirmation inside an existing panel; existing classes only). Check `git status` for foreign edits in `page.tsx`, as in Task 11.

**Files:**

- Modify (full replacement): `apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.tsx`
- Modify (full replacement): `apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.test.tsx`
- Modify: `apps/web/src/app/(app)/liabilitas/page.tsx` — only the `<KprPrepaymentSimulator … />` element in `LiabilityDetailDialog`
- Modify: `apps/web/src/i18n/types.ts`, `id.ts`, `en.ts` (append to `liabilitas.kpr`; reword `prepaySimulationNote`)

**Interfaces:**

- Consumes:
  - Task 10 route `POST …/liabilities/:id/prepay`.
  - Contracts `RecordLiabilityPrepaymentDto` and `LiabilityPrepaymentRecordResultDto`.
  - Task 12 simulator and page seam; Task 11 `extractApiErrorMessage`.
  - `queryKeys.accounts.all` (read-only use of `@/lib/query-keys`).
- Produces:
  - `<KprPrepaymentSimulator familyGroupId liabilityId token onRecorded makeIdempotencyKey? />`.
    - Each simulation stores its exact request plus a fresh idempotency key (`crypto.randomUUID()` by default; tests inject one).
    - "Catat pelunasan" needs a source account and then an explicit confirmation stating the exact debit.
    - The confirm button is disabled while pending, and the same key is reused, so a double click or a retry posts at most one prepayment.
    - On success it shows a toast and calls `onRecorded()` (the page passes `invalidateLiabilityRelatedQueries`), then clears the simulation.
  - **IDR-only on the web by design** (Global Constraints). The API also accepts `fxInputs`.

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.test.tsx` with:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as idDict } from "../../../i18n/id";

import { KprPrepaymentSimulator } from "./kpr-prepayment-simulator";

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const k = idDict.liabilitas.kpr;
const BASE = "/family-groups/fg-1/liabilities/liab-1";
const PREVIEW_URL = `${BASE}/prepayment-preview?`;
const ACCOUNTS = [{ id: "acc-1", name: "BCA Tabungan", institution: "BCA" }];
const PREVIEW = {
  liabilityId: "liab-1",
  mode: "reduce_installment",
  prepaidPrincipal: "100000000",
  penaltyPercent: "1.00",
  penalty: "1000000",
  cashOutNow: "101000000",
  installmentBefore: "4546388",
  installmentAfter: "3409791",
  remainingMonthsBefore: 180,
  remainingMonthsAfter: 180,
  totalInterestBefore: "418349734",
  totalInterestAfter: "313762283",
  interestSaved: "104587451",
  netSaving: "103587451",
  assumesCurrentFloatingRate: true,
};

function routeApi(opts: {
  preview?: unknown;
  previewError?: unknown;
  record?: () => Promise<unknown>;
}) {
  mockApiFetch.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === "/family-groups/fg-1/accounts") {
      return Promise.resolve(ACCOUNTS);
    }
    if (url.startsWith(PREVIEW_URL)) {
      return opts.previewError
        ? Promise.reject(opts.previewError)
        : Promise.resolve(opts.preview);
    }
    if (url === `${BASE}/prepay` && init?.method === "POST") {
      return opts.record ? opts.record() : Promise.resolve({ replayed: false });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

function renderSimulator() {
  const onRecorded = jest.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <KprPrepaymentSimulator
        familyGroupId="fg-1"
        liabilityId="liab-1"
        token="t"
        onRecorded={onRecorded}
        makeIdempotencyKey={() => "key-1"}
      />
    </QueryClientProvider>,
  );
  return onRecorded;
}

async function simulateReduceInstallment(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(
    screen.getByRole("radio", { name: k.prepayModes.reduce_installment }),
  );
  await user.type(screen.getByLabelText(k.prepayAmountLabel), "100000000");
  await user.click(screen.getByRole("button", { name: k.prepaySubmit }));
  await screen.findByText(/3\.409\.791/);
}

async function chooseAccount(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "BCA Tabungan · BCA" });
  await user.selectOptions(
    screen.getByLabelText(k.recordAccountLabel),
    "acc-1",
  );
}

function prepayPosts() {
  return mockApiFetch.mock.calls.filter(
    ([url, init]) => url === `${BASE}/prepay` && init?.method === "POST",
  );
}

describe("KprPrepaymentSimulator (revisi K)", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("labels the numbers a simulation, defaults the penalty to the 1% example, and fetches nothing up front", () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();

    expect(screen.getByText(k.prepaySimulationNote)).toBeInTheDocument();
    expect(screen.getByLabelText(k.prepayPenaltyLabel)).toHaveValue("1.00");
    expect(screen.getByText(k.prepayPenaltyHint)).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("reduce installment: sends mode, penalty and the amount digits; shows the server's numbers", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);

    expect(mockApiFetch).toHaveBeenCalledWith(
      `${PREVIEW_URL}mode=reduce_installment&penaltyPercent=1.00&amount=100000000`,
      expect.objectContaining({ token: "t" }),
    );
    expect(screen.getByText(/104\.587\.451/)).toBeInTheDocument();
    expect(screen.getByText(k.prepayEstimateNote)).toBeInTheDocument();
  });

  it("full payoff sends no amount", async () => {
    routeApi({ preview: { ...PREVIEW, mode: "full" } });
    renderSimulator();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: k.prepayModes.full }));
    expect(
      screen.queryByLabelText(k.prepayAmountLabel),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `${PREVIEW_URL}mode=full&penaltyPercent=1.00`,
        expect.anything(),
      ),
    );
  });

  it("shows the server's 400 message for a bad simulation", async () => {
    routeApi({
      previewError: {
        status: 400,
        message:
          "Jumlah pelunasan harus lebih dari 0 dan tidak melebihi sisa pokok",
      },
    });
    renderSimulator();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(k.prepayAmountLabel), "999999999999");
    await user.click(screen.getByRole("button", { name: k.prepaySubmit }));

    expect(
      await screen.findByText(/tidak melebihi sisa pokok/),
    ).toBeInTheDocument();
  });

  it("Catat pelunasan needs a source account, then a confirmation stating the exact debit", async () => {
    routeApi({ preview: PREVIEW });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);

    expect(screen.getByRole("button", { name: k.recordButton })).toBeDisabled();
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Rp 101\.000\.000/);
    expect(prepayPosts()).toHaveLength(0);
  });

  it("records the simulated request exactly, with its idempotency key, then refreshes", async () => {
    routeApi({ preview: PREVIEW });
    const onRecorded = renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));
    await user.click(
      screen.getByRole("button", { name: k.recordConfirmButton }),
    );

    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
    const [, init] = prepayPosts()[0] ?? [];
    expect(JSON.parse(init.body)).toEqual({
      mode: "reduce_installment",
      penaltyPercent: "1.00",
      amount: "100000000",
      sourceAccountId: "acc-1",
      idempotencyKey: "key-1",
    });
    expect(toastSuccess).toHaveBeenCalledWith(k.recordSaved);
  });

  it("a double click posts once", async () => {
    let settle: (value: unknown) => void = () => undefined;
    routeApi({
      preview: PREVIEW,
      record: () => new Promise((resolve) => (settle = resolve)),
    });
    renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));
    const confirm = screen.getByRole("button", { name: k.recordConfirmButton });
    await user.dblClick(confirm);

    expect(prepayPosts()).toHaveLength(1);
    settle({ replayed: false });
  });

  it("a failed record keeps the simulation and shows the server's message", async () => {
    routeApi({
      preview: PREVIEW,
      record: () =>
        Promise.reject({
          status: 400,
          message:
            'Saldo rekening bank "BCA Tabungan" tidak mencukupi untuk transaksi ini.',
        }),
    });
    const onRecorded = renderSimulator();
    const user = userEvent.setup();

    await simulateReduceInstallment(user);
    await chooseAccount(user);
    await user.click(screen.getByRole("button", { name: k.recordButton }));
    await user.click(
      screen.getByRole("button", { name: k.recordConfirmButton }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Saldo rekening bank "BCA Tabungan" tidak mencukupi untuk transaksi ini.',
      ),
    );
    expect(onRecorded).not.toHaveBeenCalled();
    expect(screen.getByText(/3\.409\.791/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/liabilitas/kpr-prepayment-simulator"`
Expected: FAIL. You should see "Unable to find a label with the text of: Rekening sumber", and the `onRecorded` / `makeIdempotencyKey` props are unknown.

- [ ] **Step 3a: i18n**

In `types.ts` `liabilitas.kpr`, after `prepayFailed: string;`, add:

```ts
recordAccountLabel: string;
recordAccountPlaceholder: string;
recordButton: string;
recordConfirmPrefix: string;
recordConfirmBreakdown: string;
recordConfirmButton: string;
recordCancelButton: string;
recordSaved: string;
recordFailed: string;
```

In `id.ts`, change `prepaySimulationNote` to:

```ts
      prepaySimulationNote:
        "Angka di bawah hanya simulasi — belum ada yang dicatat sampai Anda menekan Catat pelunasan dan mengonfirmasi.",
```

and after `prepayFailed: …,`, add:

```ts
      recordAccountLabel: "Rekening sumber",
      recordAccountPlaceholder: "Pilih rekening",
      recordButton: "Catat pelunasan",
      recordConfirmPrefix: "Rekening akan didebit ",
      recordConfirmBreakdown:
        " (pokok + penalti). Sisa pokok, cicilan atau tenor, jadwal, dan anggaran ikut diperbarui.",
      recordConfirmButton: "Ya, catat",
      recordCancelButton: "Batal",
      recordSaved: "Pelunasan dipercepat dicatat",
      recordFailed: "Gagal mencatat pelunasan",
```

In `en.ts`, change `prepaySimulationNote` to:

```ts
      prepaySimulationNote:
        "The figures below are a simulation — nothing is recorded until you press Record prepayment and confirm.",
```

and after `prepayFailed: …,`, add:

```ts
      recordAccountLabel: "Source account",
      recordAccountPlaceholder: "Choose an account",
      recordButton: "Record prepayment",
      recordConfirmPrefix: "The account will be debited ",
      recordConfirmBreakdown:
        " (principal + penalty). The remaining principal, installment or tenor, schedule and budget follow.",
      recordConfirmButton: "Yes, record it",
      recordCancelButton: "Cancel",
      recordSaved: "Prepayment recorded",
      recordFailed: "Could not record the prepayment",
```

- [ ] **Step 3b: Component**

Replace `apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  LiabilityPrepaymentPreviewDto,
  LiabilityPrepaymentRecordResultDto,
  PrepaymentMode,
  RecordLiabilityPrepaymentDto,
} from "@wealthme/contracts";

import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import { extractApiErrorMessage } from "./api-error";
import { DEFAULT_PREPAYMENT_PENALTY_PERCENT } from "./kpr-presets";

const MODES: readonly PrepaymentMode[] = [
  "reduce_tenor",
  "reduce_installment",
  "full",
];

type AccountOption = { id: string; name: string; institution: string | null };
type PrepaymentRequest = Pick<
  RecordLiabilityPrepaymentDto,
  "mode" | "amount" | "penaltyPercent"
>;

function rupiah(value: string | null): string {
  return value === null ? "—" : formatRupiah(Number(value));
}

function toSearch(request: PrepaymentRequest): string {
  const params = new URLSearchParams({
    mode: request.mode,
    penaltyPercent:
      request.penaltyPercent ?? DEFAULT_PREPAYMENT_PENALTY_PERCENT,
  });
  if (request.amount !== undefined) params.set("amount", request.amount);
  return params.toString();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="t-xs t-muted">{label}</dt>
      <dd className="mono text-[13.5px] font-bold">{value}</dd>
    </div>
  );
}

// IDR-only on the web on purpose (revisi-k plan, Global Constraints); the API also accepts fxInputs.
export function KprPrepaymentSimulator({
  familyGroupId,
  liabilityId,
  token,
  onRecorded,
  makeIdempotencyKey = () => crypto.randomUUID(),
}: {
  familyGroupId: string;
  liabilityId: string;
  token: string | undefined;
  onRecorded: () => void;
  makeIdempotencyKey?: () => string;
}) {
  const { t } = useLocale();
  const k = t.liabilitas.kpr;
  const [mode, setMode] = useState<PrepaymentMode>("reduce_tenor");
  const [amount, setAmount] = useState("");
  const [penaltyPercent, setPenaltyPercent] = useState(
    DEFAULT_PREPAYMENT_PENALTY_PERCENT,
  );
  // The request the shown result was computed for, and the key that records it at most once.
  const [simulated, setSimulated] = useState<{
    request: PrepaymentRequest;
    idempotencyKey: string;
  } | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [confirming, setConfirming] = useState(false);

  const base = `/family-groups/${familyGroupId}/liabilities/${liabilityId}`;
  const search = simulated ? toSearch(simulated.request) : null;

  const previewQuery = useQuery<LiabilityPrepaymentPreviewDto>({
    queryKey: [
      "liabilities",
      familyGroupId,
      "prepayment-preview",
      liabilityId,
      search,
    ],
    queryFn: ({ signal }) =>
      apiFetch<LiabilityPrepaymentPreviewDto>(
        `${base}/prepayment-preview?${search ?? ""}`,
        { token, signal },
      ),
    enabled: Boolean(token && search),
    retry: false,
  });
  const result = previewQuery.data;

  const accountsQuery = useQuery<AccountOption[]>({
    queryKey: queryKeys.accounts.all(familyGroupId),
    queryFn: ({ signal }) =>
      apiFetch<AccountOption[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
        signal,
      }),
    enabled: Boolean(token && result),
  });

  const recordMutation = useMutation({
    mutationFn: (body: RecordLiabilityPrepaymentDto) =>
      apiFetch<LiabilityPrepaymentRecordResultDto>(`${base}/prepay`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success(k.recordSaved);
      setConfirming(false);
      setSimulated(null);
      onRecorded();
    },
    onError: (err: unknown) =>
      toast.error(extractApiErrorMessage(err, k.recordFailed)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = amount.replace(/\D/g, "");
    if (mode !== "full" && !digits) return;
    setConfirming(false);
    setSimulated({
      request: {
        mode,
        penaltyPercent: penaltyPercent.trim().replace(",", "."),
        ...(mode === "full" ? {} : { amount: digits }),
      },
      idempotencyKey: makeIdempotencyKey(),
    });
  }

  function handleRecord() {
    if (!simulated || !sourceAccountId || recordMutation.isPending) return;
    recordMutation.mutate({
      ...simulated.request,
      sourceAccountId,
      idempotencyKey: simulated.idempotencyKey,
    });
  }

  return (
    <section
      className="rounded-lg border p-3.5"
      aria-labelledby="kpr-prepay-title"
    >
      <div id="kpr-prepay-title" className="mb-1 text-[12.5px] font-bold">
        {k.prepayTitle}
      </div>
      <div className="notice notice--info">{k.prepaySimulationNote}</div>

      <form className="mt-2" onSubmit={handleSubmit}>
        <fieldset className="field mt-0">
          <legend className="label">{k.prepayModeLabel}</legend>
          <div className="segmented">
            {MODES.map((m) => (
              <label key={m} className="segmented__item">
                <input
                  type="radio"
                  name="kpr-prepay-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />{" "}
                {k.prepayModes[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field-row mt-2">
          {mode !== "full" && (
            <div className="field mt-0">
              <label className="label" htmlFor="kpr-prepay-amount">
                {k.prepayAmountLabel}
              </label>
              <input
                id="kpr-prepay-amount"
                className="input mono"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              />
            </div>
          )}
          <div className="field mt-0">
            <label className="label" htmlFor="kpr-prepay-penalty">
              {k.prepayPenaltyLabel}
            </label>
            <input
              id="kpr-prepay-penalty"
              className="input mono"
              inputMode="decimal"
              aria-describedby="kpr-prepay-penalty-hint"
              value={penaltyPercent}
              onChange={(e) => setPenaltyPercent(e.target.value)}
            />
          </div>
        </div>
        <div className="hint" id="kpr-prepay-penalty-hint">
          {k.prepayPenaltyHint}
        </div>
        <button type="submit" className="btn btn--outline btn--sm mt-2">
          {k.prepaySubmit}
        </button>
      </form>

      {previewQuery.isError && (
        <div className="mt-2 text-[12px] text-destructive">
          {extractApiErrorMessage(previewQuery.error, k.prepayFailed)}
        </div>
      )}
      {result && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-muted p-3.5">
            <Stat
              label={k.prepayResultPenalty}
              value={rupiah(result.penalty)}
            />
            <Stat
              label={k.prepayResultCashOut}
              value={rupiah(result.cashOutNow)}
            />
            <Stat
              label={k.prepayResultInstallment}
              value={`${rupiah(result.installmentBefore)} → ${rupiah(result.installmentAfter)}`}
            />
            <Stat
              label={k.prepayResultTenor}
              value={`${result.remainingMonthsBefore} → ${result.remainingMonthsAfter}${k.prepayResultMonthsSuffix}`}
            />
            <Stat
              label={k.prepayResultInterestSaved}
              value={rupiah(result.interestSaved)}
            />
            <Stat
              label={k.prepayResultNetSaving}
              value={rupiah(result.netSaving)}
            />
          </dl>
          {result.assumesCurrentFloatingRate && (
            <div className="hint">{k.prepayEstimateNote}</div>
          )}

          <div className="mt-3 rounded-lg border p-3">
            <div className="field mt-0">
              <label className="label" htmlFor="kpr-prepay-account">
                {k.recordAccountLabel}
              </label>
              <select
                id="kpr-prepay-account"
                className="select"
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
              >
                <option value="">{k.recordAccountPlaceholder}</option>
                {(accountsQuery.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.institution ? `${a.name} · ${a.institution}` : a.name}
                  </option>
                ))}
              </select>
            </div>
            {confirming ? (
              <div className="notice notice--warning mt-2" role="alert">
                <span>
                  {k.recordConfirmPrefix}
                  <strong className="mono">{rupiah(result.cashOutNow)}</strong>
                  {k.recordConfirmBreakdown}
                </span>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={recordMutation.isPending}
                    onClick={handleRecord}
                  >
                    {k.recordConfirmButton}
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    disabled={recordMutation.isPending}
                    onClick={() => setConfirming(false)}
                  >
                    {k.recordCancelButton}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--sm mt-2"
                disabled={!sourceAccountId}
                onClick={() => setConfirming(true)}
              >
                {k.recordButton}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
```

A double submit is stopped three ways: the confirm button is disabled while the mutation is pending; `handleRecord` ignores calls while pending; and a request that still gets through reuses the same idempotency key, so the server replays it instead of debiting twice (Task 10).

- [ ] **Step 3c: Page seam**

In `apps/web/src/app/(app)/liabilitas/page.tsx` (`LiabilityDetailDialog`), add the `onRecorded` prop to the existing `<KprPrepaymentSimulator … />`:

```tsx
<KprPrepaymentSimulator
  familyGroupId={familyGroupId}
  liabilityId={item.id}
  token={token}
  onRecorded={() =>
    invalidateLiabilityRelatedQueries(queryClient, familyGroupId)
  }
/>
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(liabilitas|anggaran)"`
Expected: PASS. The simulator spec has 8 tests, replacing Task 12's 4; the page tests are unchanged and green.

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: no errors in files this task touched.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/liabilitas/kpr-prepayment-simulator.tsx" "src/app/(app)/liabilitas/kpr-prepayment-simulator.test.tsx" "src/app/(app)/liabilitas/page.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.tsx" "apps/web/src/app/(app)/liabilitas/kpr-prepayment-simulator.test.tsx" "apps/web/src/app/(app)/liabilitas/page.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(web): record a simulated KPR prepayment ("Catat pelunasan")

After a simulation the user picks a source account and confirms the
exact debit (principal + penalty); the simulated request is posted once
with its own idempotency key, then the liability, schedule, budget and
accounts refresh. The simulation stays on screen if recording fails.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
EOF
)"
```

---

## Self-Review

**Task list:**

1. Rate plan model + `effectivePeriodFor` (pure)
2. Plan-aware `buildSchedule` + `installmentAnchorPeriod` (pure)
3. Unified due installment: 5-day grace, WIB calendar; drives the Pay preset, `pay()`, preview, schedule and budget line
4. Early-repayment simulation (pure), including the terms to persist
5. Schema, migration, validation, DTOs, contracts, response shape
   6a. Load K rows and wire the plan into every reader
   6b. Rate-period writers: create, update, legacy upgrade, orphaned-history guard
6. Floating-rate history endpoints
7. `GET :id/prepayment-preview`
8. Prepayment persistence foundation: schema, COA 20011, anchored installment, re-anchoring term corrections, guard exception
9. `POST :id/prepay`: record a prepayment
10. Web: presets + rate-period editor
11. Web: Detail rate column, floating history, simulator, Pay "Telat"
12. Web: "Catat pelunasan"

**Spec coverage:**

| Requirement                                                                                                                       | Where it is covered                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) Tiered rate periods                                                                                                           | Tasks 1–2 (engine), 5, 6a, 6b (storage/wiring), 11 (editor)                                                                                                                                                                                         |
| (b) Floating history, re-annuitised on remaining balance + tenor                                                                  | Tasks 1–2 (`effectivePeriodFor`, regime changes), 6a (reads), 6b (orphan guard), 7 (CRUD + budget resync), 12 (panel)                                                                                                                               |
| (c) Scheme presets; examples labelled; FLPP labelled official                                                                     | Decision 7, Task 5 (structural validation, FLPP ≤ 480), Task 11 (presets, badges, notices)                                                                                                                                                          |
| (d) Early repayment: partial/full, reduce-tenor vs reduce-installment, editable penalty with a researched default, **recordable** | Decision 5; Tasks 4, 8 (simulate), 9, 10 (record), 12, 13 (UI)                                                                                                                                                                                      |
| (e) Manual override on every period                                                                                               | Task 11 (every rate editable; editing clears the example badge); the server never forces rates (decision 6)                                                                                                                                         |
| User decision: Pay preset = installment `pay()` books, 5-day grace, "Telat"                                                       | Decision 4; Task 3 (pure rule ×12 incl. WIB, preset = booked ×6, late pay 5.041.728; the one listed G constant change); Task 6a boundary ×5 + preset ×3; Task 5 `currentInstallmentLate`; Task 12 Pay "Telat"                                       |
| User decision 2: recordable prepayment                                                                                            |                                                                                                                                                                                                                                                     |
| – debit via the pay path's overdraft guard                                                                                        | Task 10 "reduce installment", "overdraft"                                                                                                                                                                                                           |
| – separate penalty leg on a new penalty category                                                                                  | COA 20011, Task 9; Task 10 legs, "zero penalty", "409"                                                                                                                                                                                              |
| – exception to the one-per-month guard                                                                                            | Task 9 "prepayment rows are ignored…"; Task 10 "guard exception"                                                                                                                                                                                    |
| – reduce-tenor / reduce-installment persisted and followed by schedule, currentInstallment, budget                                | Task 9 anchor tests; Task 10 update data, budget, schedule read-back                                                                                                                                                                                |
| Judge HIGH: term correction after a prepayment                                                                                    | Decision 5; Task 9 re-anchoring (4.524.568 / 4.767.352), refusal for flat                                                                                                                                                                           |
| Judge MEDIUM: orphaned floating history                                                                                           | Task 6b orphan check + test                                                                                                                                                                                                                         |
| Judge LOW: WIB day                                                                                                                | Decision 4; Task 3 `localCalendarDay` + WIB tests                                                                                                                                                                                                   |
| Judge LOW: split Task 6                                                                                                           | Tasks 6a (readers) / 6b (writers)                                                                                                                                                                                                                   |
| – tenant-scoped + ability-guarded                                                                                                 | Task 10 "404…", PERMISSION/DENIAL                                                                                                                                                                                                                   |
| – idempotency against double submit                                                                                               | Task 10 "replay", "concurrent"; Task 13 "posts once"                                                                                                                                                                                                |
| – fxInputs                                                                                                                        | Task 10 fx spec + wiring test                                                                                                                                                                                                                       |
| – web UI                                                                                                                          | Task 13                                                                                                                                                                                                                                             |
| Legacy rows unchanged                                                                                                             | Decision 1; G's amortisation spec untouched (Task 2); legacy-upgrade test (Task 6b); the one G service-spec line change is listed by name (Task 3)                                                                                                  |
| One shared engine (BigInt, round-half-up)                                                                                         | `dueInstallmentPeriod` + `rateAt(ratePlanOf(…))` + `buildSchedule` feed schedule, pay split, preview, `currentInstallment`, budget line, prepayment preview **and** record (Tasks 2, 3, 4, 6a, 8, 10; Task 9's re-anchoring reuses `buildSchedule`) |
| Floating history tenant-scoped, ability-guarded, validated                                                                        | Task 7                                                                                                                                                                                                                                              |
| Honest UI                                                                                                                         | Tasks 11–13: Contoh/Resmi badges, SP3K notice, Estimasi rows, "simulasi" note, a confirmation stating the exact debit                                                                                                                               |
| i18n in types/id/en                                                                                                               | Tasks 11, 12, 13                                                                                                                                                                                                                                    |
| Protected files untouched                                                                                                         | Only route-local files, `page.tsx` and i18n are edited; `@/lib/query-keys` is only imported                                                                                                                                                         |
| DTO value-import convention                                                                                                       | Tasks 7, 8, 10                                                                                                                                                                                                                                      |
| Migrations after the latest one                                                                                                   | Task 5 (`20260926120000`), Task 9 (`20260926130000`); re-check before running                                                                                                                                                                       |
| Sub-plan I compatibility                                                                                                          | Global Constraints: preview is IDR-only; the recorded amount has `FX_FIELD_SPECS.liabilityPrepayment`                                                                                                                                               |

**Review Focus → tests:**

| Focus                               | Tests                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Boundary months / due day / grace   | Task 1 "segment boundaries"; Task 2 berjenjang goldens; Task 3 ×19; Task 6a `boundary:` ×5, "Pay preset" ×3             |
| Mid-month change                    | Task 1 `effectivePeriodFor` ×5; Task 2 "mid-month change"; Task 6a rows "same-period dates"; Task 6a "floating history" |
| Past tenor                          | Task 2 "past tenor"; Task 3 "past maturity"; Task 7 "past maturity"                                                     |
| 0 % promo                           | Task 2                                                                                                                  |
| Murabahah equality                  | Task 2; Task 5 validation                                                                                               |
| Prepayment golden numbers           | Task 4; Task 8; Task 10 (recorded == previewed)                                                                         |
| Penalty rounding                    | Task 4; Task 10 `penaltyAmount`                                                                                         |
| Legacy rows unchanged               | Task 2 (G spec untouched + parity test); Task 3 (listed G constant only); Task 6b "legacy upgrade"                      |
| Term corrections after a prepayment | Task 9                                                                                                                  |
| Orphaned floating history           | Task 6b; Task 5 validation                                                                                              |
| Prepayment safety                   | Tasks 9, 10, 13                                                                                                         |

**Type consistency.** These names are used identically in every task:

- `RatePlan`, `RateSegment`, `ResolvedRate`, `ratePlanOf`, `rateAt`, `sameRateRegime`, `sameSegments` (in `rate-plan.validation`)
- `dueInstallment`/`dueInstallmentPeriod`, `DUE_GRACE_DAYS`, `localCalendarDay`, `currentInstallmentLate`; `installmentAnchorPeriod` (engine) ↔ `installmentFromPeriod` (column); `nextTerms`, `reanchoredInstallment`
- `RatePlanRows`, `loadRatePlanRows`, `ratePlanFromRows`, `replaceRatePeriods`, `withRatePlan`, `resyncBudgetLine`
- `simulatePrepayment` (`newInstallmentAmount`, `newTenorMonths`), `PrepaymentMode`, `PREPAYMENT_MODES`, `parsePrepaymentRequest`, `assertPrepayable`, `prepaidTerms`
- `recordPrepayment`, `RecordPrepaymentDto` / `RecordLiabilityPrepaymentDto`, `LiabilityPrepaymentResponseDto` / `LiabilityPrepaymentDto`, `LiabilityPrepaymentRecordResponseDto` / `LiabilityPrepaymentRecordResultDto`
- `LiabilityRateBandDto` (`fromPeriod`/`toPeriod`/`ratePercent`/`kind`)
- `LiabilityFloatingRateDto.effectivePeriod: number | null`
- `LiabilityPrepaymentPreviewDto.assumesCurrentFloatingRate`
- the query key prefix `["liabilities", familyGroupId, …]`

**Verification provenance.** This pure code was executed against G's unmodified `amortisation.util.spec.ts` plus all the new pure specs: 109/109 passing, ts-jest strict with `noUncheckedIndexedAccess`.

- Tasks 1, 2 (including the anchor), 3 (`dueInstallment` with grace + WIB) and 4 (including `newInstallmentAmount`/`newTenorMonths`);
- Task 5's validation;
- Task 6a's `ratePlanFromRows`.

Every golden number was also cross-checked with an independent BigInt script. The due-day service expectations (3.103.938 / 4.267.915 / 5.053.432 / late-pay budget 5.041.728), the re-anchoring values (4.524.568 / 4.767.352) and the record expectations (3.409.791, tenor 162/102 rows, 4.869.889 vs 4.857.320) come from those same runs.

The service, controller, DTO and web code was written against the files on this branch at commit `4a4be3a`, but has not been executed. Implementers must treat the named test commands as the gate.
