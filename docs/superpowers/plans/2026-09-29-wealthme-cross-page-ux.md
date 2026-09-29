# WealthMe Cross-Page UX and Form Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task after plan approval. Steps use checkbox syntax.

**Goal:** Correct the observed Beranda range mismatch, improve mobile hierarchy, and make primary input controls usable and reachable across WealthMe.

**Architecture:** Keep business data and page composition in their current route-level owners. Put the period control beside the net-worth chart it changes, render transaction totals in one compact local summary, and reflow the account hero at narrow widths. Raise common form controls to 44px only for coarse pointers in the existing design-system stylesheet, with one documented protected-file exception; add a short in-page link to Tax Center's existing calculator.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Jest/Testing Library, Playwright, existing WealthMe form tokens and i18n.

**Spec:** `docs/superpowers/specs/2026-09-29-wealthme-cross-page-ux-design.md`

## Global Constraints

- Keep this pass within the approved five-hour timebox where possible; prefer evidence-backed changes over cosmetic bulk edits.
- Indonesian copy uses conversational “kamu”; add every new user-facing string to `apps/web/src/i18n/types.ts`, `id.ts`, and `en.ts`.
- Avoid em dashes and decorative middle dots; helpers stay to one line; optional fields use “(opsional)”.
- Touch controls meet 44px on `(pointer: coarse)`; icon-only buttons keep accessible names.
- Money remains decimal string/BigInt based and displays through `useMoney()`; preserve current API error and role behavior.
- Do not touch API, Prisma, contracts, generated `dist`, environment files, production or staging.
- Preserve pre-existing local modifications. Stage only paths listed in each task.
- Do not edit protected files except Task 3's justified `design-system.css` touch-target rule; include its reason in that commit body.

## Review Focus

- A 12-month selection changes net-worth history only; it must never relabel the fixed six-month cashflow series. Test: `CashflowCard keeps the six-month title for its fixed series`.
- Long names and email addresses must not collide with the Akun profile action at 390px. Test: mobile account profile action and identity boxes do not intersect.
- Currency controls, primary actions, and selectors must remain at least 44px on coarse pointers. Test: mobile transaction and liability form controls meet the 44px bound.
- All three transaction totals must remain legible and available after the mobile summary is compressed. Test: mobile transaction summary retains income, expense, and net values.
- Tax Center's calculator jump must resolve to the existing PPh 21 input section without changing tax calculations. Test: calculator link points to the PPh section id.

---

### Task 1: Put the Beranda period control beside the net-worth history

**Files:**

- Modify: `apps/web/src/app/(app)/beranda/page.tsx`
- Modify: `apps/web/src/app/(app)/beranda/_components/hero-card.tsx`
- Modify: `apps/web/src/app/(app)/beranda/_components/cashflow-card.tsx`
- Test: `apps/web/src/app/(app)/beranda/_components/cashflow-period.test.tsx`
- Reuse existing i18n key: `beranda.periodToggleAriaLabel` in `apps/web/src/i18n/{types,id,en}.ts`

**Interfaces:**

- `BerandaHero` receives the existing `period: BerandaPeriod` and `onPeriodChange(next: BerandaPeriod): void` values now passed to `CashflowCard`.
- `CashflowCard` receives no period state and always renders `t.beranda.cashflowTitle6` for its fixed six-month feed.
- `useBerandaData(period)` and its `6m`/`12m` net-worth-history query remain unchanged.

- [ ] **Step 1: Add the failing period ownership test**

Create `cashflow-period.test.tsx` with tests named `period tabs are labeled as the net-worth history range` and `cashflow keeps the six-month title for its fixed series`. Assert:

```tsx
expect(
  screen.getByRole("tablist", { name: t.beranda.periodToggleAriaLabel }),
).toBeInTheDocument();
expect(screen.getByText(t.beranda.cashflowTitle6)).toBeInTheDocument();
expect(screen.queryByText(t.beranda.cashflowTitle12)).not.toBeInTheDocument();
```

The period-tab test also finds the text label `Rentang tren kekayaan`/`Wealth trend range`, clicks `12 Bln` and asserts `onPeriodChange` receives `"12M"`.

- [ ] **Step 2: Run the focused Jest test and confirm it fails**

Run: `cd apps/web && npx jest --runInBand src/app/\(app\)/beranda/_components/cashflow-period.test.tsx`
Expected: FAIL because the period tabs and variable title still belong to `CashflowCard`.

- [ ] **Step 3: Move period control to `BerandaHero`**

Keep the existing period values and query behavior. Place the tablist beside the net-worth history chart and make the cashflow title permanently six months. Do not add API behavior or new copy.

- [ ] **Step 4: Re-run the focused test**

Run: `cd apps/web && npx jest --runInBand src/app/\(app\)/beranda/_components/cashflow-period.test.tsx`
Expected: PASS; the same selection callback still controls net-worth history while cashflow stays six months.

- [ ] **Step 5: Commit Task 1**

```bash
git add 'apps/web/src/app/(app)/beranda/page.tsx' 'apps/web/src/app/(app)/beranda/_components/hero-card.tsx' 'apps/web/src/app/(app)/beranda/_components/cashflow-card.tsx' 'apps/web/src/app/(app)/beranda/_components/cashflow-period.test.tsx'
git commit -m "fix: align beranda period control with wealth history"
```

### Task 2: Compact mobile transaction totals and prevent Akun profile overlap

**Files:**

- Create: `apps/web/src/app/(app)/transaksi/transaction-summary.tsx`
- Create: `apps/web/src/app/(app)/transaksi/transaction-summary.test.tsx`
- Modify: `apps/web/src/app/(app)/transaksi/page.tsx`
- Create: `apps/web/src/app/(app)/akun/profile-hero.tsx`
- Create: `apps/web/src/app/(app)/akun/profile-hero.test.tsx`
- Modify: `apps/web/src/app/(app)/akun/page.tsx`
- Create: `apps/web/tests/e2e/pages/cross-page-ux.mobile.spec.ts`

**Interfaces:**

- `TransactionSummary` takes the existing income, expense, and net display values and labels; it renders all three in one compact surface on mobile and a three-column summary from `sm` upward. It does not recompute money.
- `ProfileHero` takes the existing display name, email, role, member-since text, and edit callback; mobile layout places the edit action on a separate grid row while desktop keeps it at the end of the identity row.

- [ ] **Step 1: Write failing component tests**

In `transaction-summary.test.tsx`, add `retains all three totals and their labels in the compact summary`; assert the accessible group contains the exact income, expense, and net labels/values from props. In `profile-hero.test.tsx`, add `renders identity, role, and profile action without nesting the action in identity text`; assert the named button and identity values are separate elements.

Add two mobile E2E tests to `cross-page-ux.mobile.spec.ts`, using a 390×844 touch context and one serial demo login: `transaction list starts within the first viewport and all totals remain visible` checks all three summary labels and that “Daftar Transaksi” begins before y=844; `profile action does not overlap identity` checks the profile action and email bounding boxes do not intersect.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `cd apps/web && npx jest --runInBand src/app/\(app\)/transaksi/transaction-summary.test.tsx src/app/\(app\)/akun/profile-hero.test.tsx`
Expected: FAIL because the local components do not exist.

- [ ] **Step 3: Implement the route-local summary and profile hero**

Replace the three vertically stacked `StatCard`s with one summary surface using the same full money strings, sign/color meaning, transaction counts, and period details. Reflow Akun profile identity/action without changing profile data or save behavior.

- [ ] **Step 4: Run the focused tests**

Run: `cd apps/web && npx jest --runInBand src/app/\(app\)/transaksi/transaction-summary.test.tsx src/app/\(app\)/akun/profile-hero.test.tsx`
Expected: PASS; each original metric is still available and profile controls remain separately named.

Run: `cd apps/web && npx playwright test tests/e2e/pages/cross-page-ux.mobile.spec.ts --project=chromium --grep "transaction list|profile action" --reporter=list`
Expected: PASS at 390×844; the transaction list starts in the first viewport and the profile action does not intersect the email. Local web/API services and the existing demo account must be available.

- [ ] **Step 5: Commit Task 2**

```bash
git add 'apps/web/src/app/(app)/transaksi/page.tsx' 'apps/web/src/app/(app)/transaksi/transaction-summary.tsx' 'apps/web/src/app/(app)/transaksi/transaction-summary.test.tsx' 'apps/web/src/app/(app)/akun/page.tsx' 'apps/web/src/app/(app)/akun/profile-hero.tsx' 'apps/web/src/app/(app)/akun/profile-hero.test.tsx'
git commit -m "fix: improve transaction and account mobile hierarchy"
```

### Task 3: Meet coarse-pointer form control targets

**Files:**

- Modify, protected exception: `apps/web/src/app/design-system.css`
- Modify: `apps/web/tests/e2e/pages/cross-page-ux.mobile.spec.ts`

**Interfaces:**

- Add a coarse-pointer media rule after existing form overrides for `.input`, `.select`, `.textarea`, `.btn`, `.btn--icon`, `.segmented__item`, and `.date-range__trigger` so existing desktop density is unchanged. Include page-specific selectors for compact tax, reconciliation, donation, and calculator fields whose specificity would otherwise override the base rule.
- The E2E test uses a 390×844 Chromium context with `isMobile: true` and `hasTouch: true`; it logs in once using the existing demo test account and checks the login form, transaction dialog, and liability dialog without submitting.

- [ ] **Step 1: Add the failing coarse-pointer E2E test**

Test name: `form fields and primary actions meet 44px on coarse pointers`. Assert `matchMedia("(pointer: coarse)").matches` is true and each visible `.input`, `.select`, `.btn`, `.segmented__item`, and `.date-range__trigger` in the login, transaction-add, and liability-add surfaces has a bounding-box height of at least `44` pixels. Keep the flow read-only: never click Save.

- [ ] **Step 2: Run the test and confirm the 44px assertion fails**

Precondition: local web and API on their configured development ports with seeded demo data.

Run: `cd apps/web && npx playwright test tests/e2e/pages/cross-page-ux.mobile.spec.ts --project=chromium --grep "44px" --reporter=list`
Expected: FAIL on at least one currently sub-44px control.

- [ ] **Step 3: Add the coarse-pointer rule to `design-system.css`**

Set `min-height: 44px` for the listed form controls inside `@media (pointer: coarse)` after their existing component and page-specific overrides. Include `.recon-mapping-grid .select`, `.donation-tithe-grid .input`, `.tax-calculator-grid .input`, `.tax-calculator-grid .select`, and `.calc-panel .card__body > .grid .input/.select` so their more-specific 39px rules do not win. Give `.btn--icon` a 44px minimum width at coarse pointers. Preserve textarea's larger height and avoid changing fine-pointer desktop controls. Do not change unrelated token values.

Protected-file commit reason: shared `.input` and `.select` rules have no 44px minimum, and specialized tax/reconciliation controls set 39px; a route-by-route fix would duplicate the same requirement across the app's forms.

- [ ] **Step 4: Re-run the coarse-pointer test**

Run: `cd apps/web && npx playwright test tests/e2e/pages/cross-page-ux.mobile.spec.ts --project=chromium --grep "44px" --reporter=list`
Expected: PASS for login, transaction-add, and liability-add controls at ≥44px; no form is submitted or persisted.

- [ ] **Step 5: Commit Task 3 with the exception reason in the body**

```bash
git add apps/web/src/app/design-system.css apps/web/tests/e2e/pages/cross-page-ux.mobile.spec.ts
git commit -m "fix: size form controls for coarse pointers" -m "Reason: the shared field rules and compact form overrides were below 44px; one coarse-pointer rule fixes this across forms without changing desktop density."
```

### Task 4: Make the Tax Center calculator reachable from the first screen

**Files:**

- Modify: `apps/web/src/app/(app)/tax/page.tsx`
- Modify: `apps/web/src/app/(app)/tax/tax.test.tsx`
- Modify: `apps/web/src/i18n/types.ts`
- Modify: `apps/web/src/i18n/id.ts`
- Modify: `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Add the failing reachability test**

Test name: `offers a direct link to the existing PPh 21 calculator`. Assert the visible link has `href="#pph21-calculator"` and the existing calculator section has that id. The link label must come from i18n in both locales.

- [ ] **Step 2: Run the focused tax test and confirm it fails**

Run: `cd apps/web && npx jest --runInBand src/app/\(app\)/tax/tax.test.tsx`
Expected: FAIL because the link and target id do not exist.

- [ ] **Step 3: Add the concise in-page link**

Add the link next to the existing annual estimate summary and the target id to the existing PPh 21 calculator section. Do not reorder tax calculations, duplicate inputs, or change tax business logic.

- [ ] **Step 4: Run the focused tax test**

Run: `cd apps/web && npx jest --runInBand src/app/\(app\)/tax/tax.test.tsx`
Expected: PASS in Indonesian and English.

- [ ] **Step 5: Commit Task 4**

```bash
git add 'apps/web/src/app/(app)/tax/page.tsx' 'apps/web/src/app/(app)/tax/tax.test.tsx' apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "feat: add direct access to tax calculator"
```

### Task 5: Verify the cross-page and form pass

**Files:**

- Verify: Beranda, Transaksi, Akun, Tax Center, transaction dialog, and liability/KPR dialog at 390px and 1440px in light and dark themes.
- Verify: primary input flows listed in the spec using the read-only browser flow: rekening, cash/e-wallet, investment, asset, liability/KPR, insurance, budget, goal, donation, Tax Center, reconciliation, Split Bill, IAM, and Master Data.

- [ ] Run: `cd apps/web && npx jest --maxWorkers=2` — expect zero failures.
- [ ] Run: `cd apps/web && npx tsc --noEmit -p .` — expect exit 0.
- [ ] Run: `cd apps/web && npx eslint .` — expect exit 0.
- [ ] Run the new mobile E2E and the existing axe audit for `/login`, `/beranda`, `/transaksi`, `/laporan`, and `/akun`; expect no new serious/critical violations.
- [ ] Visually inspect changed routes at 390px and 1440px, light and dark; confirm list access, no overlap, 44px coarse-pointer controls, and theme-token colors.
- [ ] Inspect `git diff --check`, `git status`, and staged path list; ensure unrelated user-local changes are untouched.
- [ ] Push `feat/ux-g5` to `origin` after all gates pass; never force-push. Report any gate blocked by unavailable local services with exact evidence.

## Self-review

- Every design workstream maps to a task: data truth (1), mobile hierarchy (2), form target/field reachability (3–4), consistency and verification (3–5).
- The protected stylesheet exception is limited to the coarse-pointer target rule and includes the commit rationale.
- Five high-risk conditions have a named test or browser assertion in the owning task.
- No API, money calculation, permission, or persistence behavior changes are planned.
- The implementation is three focused UI changes plus one reachable-form link; full project gates remain in Task 5 to keep the five-hour cap visible.
