# WealthMe — User Stories

> Companion to `PRD.md`. Stories use `As a {role}, I want {capability}, so that {outcome}`.
> Roles: **Personal** (individual user), **Owner** (family owner), **Member** (family member), **Admin** (admin-staff: sekretaris/supir/ART).
> Each story carries an ID (`US-{domain}-{n}`), priority (P0–P2), owning epic, and acceptance criteria.
> Stories in domains 1–3 are largely **delivered** (EPIC-001/002); 4–16 are **planned**.

---

## 1. Authentication & Profile — EPIC-001, EPIC-005

| ID        | Story                                                                                                                 | Priority | Epic         |
| --------- | --------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| US-AUTH-1 | As a Personal user, I want to register with email/password, so that I can create my account.                          | P0       | EPIC-001 ✅  |
| US-AUTH-2 | As a Personal user, I want to log in with email/password, so that I can access my data.                               | P0       | EPIC-001 ✅  |
| US-AUTH-3 | As a Personal user, I want to sign in with Google, so that I can onboard without a new password.                      | P0       | EPIC-001 ✅  |
| US-AUTH-4 | As a Personal user, I want to change my password and set a PIN/biometric, so that my account is secure.               | P1       | EPIC-005     |
| US-AUTH-5 | As a Personal user, I want to edit my profile (name, email, avatar), so that my identity is accurate.                 | P1       | EPIC-005     |
| US-AUTH-6 | As a Personal user, I want to set my currency, language, date format, and theme, so that the app fits my preferences. | P1       | EPIC-005     |
| US-AUTH-7 | As a Personal user, I want to view and revoke active sessions, so that I control account access.                      | P2       | EPIC-005     |
| US-AUTH-8 | As a Personal user, I want to export my data and delete my account, so that I control my privacy (PDP).               | P2       | EPIC-005/007 |

**Acceptance:** Auth source of truth in NestJS (Passport+JWT); web uses Auth.js session carrying API JWT; passwords hashed argon2id; profile changes persist and reflect across pages; account deletion purges PII per PDP.

---

## 2. Dashboard & Summary — EPIC-002 ✅

| ID        | Story                                                                                                                          | Priority |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| US-DASH-1 | As a Personal user, I want to see my total net worth on the home screen, so that I know my financial position at a glance.     | P0       |
| US-DASH-2 | As a Personal user, I want to filter the wealth trend by period (1M/3M/6M/1Y/All), so that I can see growth over time.         | P1       |
| US-DASH-3 | As a Personal user, I want a wealth-allocation donut (investments/accounts/assets/other), so that I see my diversification.    | P1       |
| US-DASH-4 | As a Personal user, I want a monthly cashflow bar chart, so that I see income vs expense trends.                               | P1       |
| US-DASH-5 | As a Personal user, I want summary cards (cash/accounts/investments/assets/liabilities), so that each domain total is visible. | P0       |
| US-DASH-6 | As a Personal user, I want goal-progress and an AI-insight banner on the dashboard, so that I get nudges toward my targets.    | P2       |

**Acceptance:** Net worth = cash + investments + assets − liabilities; all values from live aggregation API; period filter re-fetches; donut + bar render from real data.

---

## 3. Transactions — EPIC-002 ✅

| ID       | Story                                                                                                                      | Priority |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-TXN-1 | As a Personal user, I want to add an income/expense/transfer manually, so that I can record money movement.                | P0       |
| US-TXN-2 | As a Personal user, I want to scan a receipt (OCR) to auto-fill a transaction, so that I save typing.                      | P1       |
| US-TXN-3 | As a Personal user, I want to filter transactions (all/in/out/transfer/credit-card), so that I find what I need.           | P1       |
| US-TXN-4 | As a Personal user, I want transactions grouped by date with income/expense/net summary, so that I read my history easily. | P1       |
| US-TXN-5 | As a Personal user, I want to tag a category and account on each transaction, so that reports are accurate.                | P0       |
| US-TXN-6 | As a Personal user, I want a transfer between accounts to update both balances, so that my totals stay correct.            | P0       |
| US-TXN-7 | As a Personal user, I want to search transactions via the command palette (⌘K), so that I navigate quickly.                | P2       |

**Acceptance:** CRUD updates account balances atomically; filters/summary match DB; OCR scan endpoint returns pre-filled fields (human confirms before save); categories seeded with icon+type.

---

## 4. Investments — EPIC-003

| ID       | Story                                                                                                                                   | Priority |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-INV-1 | As a Personal user, I want to add a holding (stock/mutual fund/gold/bond/crypto/etc.) with cost basis, so that my portfolio is tracked. | P0       |
| US-INV-2 | As a Personal user, I want to see current value and return (Rp & %) per holding, so that I know performance.                            | P0       |
| US-INV-3 | As a Personal user, I want portfolio prices to refresh on schedule, so that valuations stay current.                                    | P1       |
| US-INV-4 | As a Personal user, I want live price updates without reload, so that I see market moves in real time.                                  | P2       |
| US-INV-5 | As a Personal user, I want to edit/delete a holding, so that my portfolio reflects reality.                                             | P1       |
| US-INV-6 | As a Personal user, I want the investment table to scroll horizontally on mobile, so that all columns are usable.                       | P2       |

**Acceptance:** P&L = current value − cost basis; ROI formula per `@wealthme/contracts`; scheduled refresh via BullMQ + `MarketDataPort` (mock first); WebSocket push updates UI; net-worth rollup consistent with dashboard.

---

## 5. Assets & Liabilities — EPIC-003

| ID         | Story                                                                                                                               | Priority |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-ASSET-1 | As a Personal user, I want to add an asset (house/land/vehicle/business/collection) with value, so that it counts toward net worth. | P0       |
| US-ASSET-2 | As a Personal user, I want to see asset value history, so that I track appreciation/depreciation.                                   | P2       |
| US-LIAB-1  | As a Personal user, I want to add a liability (KPR/vehicle loan/credit card/loan), so that my debt is tracked.                      | P0       |
| US-LIAB-2  | As a Personal user, I want to see payment ratio / remaining balance per liability, so that I know my debt load.                     | P1       |
| US-ASSET-3 | As a Personal user, I want assets grouped (cash/investment/asset/liability) on one page, so that I see a unified balance view.      | P1       |

**Acceptance:** Assets/liabilities feed net-worth rollup; grouped list matches dashboard totals; liability ratios computed in BE; unit tests for rollup pass.

---

## 6. Insurance — EPIC-003

| ID       | Story                                                                                                                                     | Priority |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-INS-1 | As a Personal user, I want to add an insurance policy (life/vehicle/property) with premium and renewal date, so that coverage is tracked. | P1       |
| US-INS-2 | As a Personal user, I want a renewal reminder, so that I don't miss a payment.                                                            | P2       |
| US-INS-3 | As a Personal user, I want a coverage summary of active policies, so that I see my protection at a glance.                                | P2       |

**Acceptance:** Policy CRUD with status (active/lapsed); renewal date drives a notification trigger; Asuransi page wired to API.

---

## 7. Reports (16 tabs) — EPIC-004

| ID       | Story                                                                                                            | Priority |
| -------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| US-RPT-1 | As a Personal user, I want a Summary report for a chosen period, so that I see income/expense/net at a glance.   | P0       |
| US-RPT-2 | As a Personal user, I want Daily/Monthly/Yearly reports, so that I analyze trends at different granularities.    | P1       |
| US-RPT-3 | As an Owner, I want a Family Group report, so that I see shared balances and per-member spending.                | P1       |
| US-RPT-4 | As a Personal user, I want a Bank report (balance + movement per account), so that I reconcile accounts.         | P1       |
| US-RPT-5 | As a Personal user, I want a Detail report (full transaction table) with export, so that I audit everything.     | P1       |
| US-RPT-6 | As a Personal user, I want a Cash-Flow (Aliran Dana) Sankey view, so that I see source→allocation visually.      | P2       |
| US-RPT-7 | As a Personal user, I want P&L, Balance Sheet, and Cashflow statements, so that I read accounting-grade reports. | P1       |
| US-RPT-8 | As a Personal user, I want to export any report to PDF/Excel, so that I can share or archive it.                 | P1       |

**Acceptance:** Each tab aggregates correctly for the selected period; P&L/Balance Sheet/Cashflow are internally consistent and balance; export jobs produce correct files server-side; 16 tabs scroll horizontally on mobile.

---

## 8. Calculators — EPIC-004

| ID        | Story                                                                                                                                 | Priority |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-CALC-1 | As a Personal user, I want an investment compound-interest projection, so that I plan growth.                                         | P1       |
| US-CALC-2 | As a Personal user, I want a KPR/credit installment calculator, so that I plan loan affordability.                                    | P1       |
| US-CALC-3 | As a Personal user, I want a pension calculator, so that I plan retirement.                                                           | P2       |
| US-CALC-4 | As a Personal user, I want a Zakat Maal calculator (2.5% + nisab check), so that I compute my obligation.                             | P1       |
| US-CALC-5 | As a Personal user, I want a PPh 21 progressive calculator (UU HPP, PTKP, biaya jabatan, zakat deduction), so that I estimate my tax. | P1       |

**Acceptance:** All financial math is deterministic in BE/`contracts` (never LLM); calculator outputs match the demo reference values exactly (golden-value tests); zakat result feeds the tax deduction.

---

## 9. Family Finance — EPIC-005

| ID       | Story                                                                                                                                                          | Priority |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-FAM-1 | As an Owner, I want to create a family group, so that I coordinate household finances.                                                                         | P0       |
| US-FAM-2 | As an Owner, I want to invite members by email, so that they join my group.                                                                                    | P0       |
| US-FAM-3 | As an Owner, I want to add an admin-staff with input-only, category-limited permission, so that staff can record transactions without seeing private balances. | P1       |
| US-FAM-4 | As a Member, I want to see shared wallets/goals/reports but NOT other members' private balances, so that privacy is preserved.                                 | P0       |
| US-FAM-5 | As an Owner, I want shared goals across the family, so that we save toward common targets.                                                                     | P1       |
| US-FAM-6 | As an Owner, I want every admin-staff action recorded in an audit log, so that I have accountability.                                                          | P1       |
| US-FAM-7 | As an Owner, I want RBAC enforced server-side (not just UI), so that permissions can't be bypassed.                                                            | P0       |

**Acceptance:** Tenancy via TenantInterceptor (`userId`/`familyGroupId`) + Postgres RLS; CASL abilities per role; member cannot query another member's private balance (RBAC E2E test); all admin actions in `audit_logs`.

---

## 10. Inheritance / Warisan — EPIC-005

| ID       | Story                                                                                                                                      | Priority |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| US-INH-1 | As an Owner, I want to add an inheritance asset (property/cash/securities/shares) with value and documents, so that my estate is recorded. | P1       |
| US-INH-2 | As an Owner, I want to assign which heirs can see each asset, so that I control visibility.                                                | P1       |
| US-INH-3 | As an Heir (Member), I want to see inheritance assets I'm permitted to view, so that the estate is transparent.                            | P1       |
| US-INH-4 | As an Owner, I want to upload supporting documents (SHM/BPKB/certificates), so that proof is attached.                                     | P2       |

**Acceptance:** Heir-visibility toggle enforced server-side; documents stored in MinIO via `StoragePort`, downloadable by permitted heirs only; inheritance total displayed on the Warisan hero.

---

## 11. Donations & Zakat — EPIC-004 (calc) + EPIC-005 (records)

| ID       | Story                                                                                                                                           | Priority |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-DON-1 | As a Personal user, I want to record a donation (zakat/sedekah/social/wakaf) with institution and funding source, so that my giving is tracked. | P1       |
| US-DON-2 | As a Personal user, I want a Zakat Maal calculator inline, so that I compute before recording.                                                  | P1       |
| US-DON-3 | As a Personal user, I want donation history by category, so that I review my annual giving.                                                     | P2       |
| US-DON-4 | As a Personal user, I want recorded zakat to count as a tax deduction in Tax Center, so that my tax is accurate.                                | P1       |
| US-DON-5 | As a Personal user, I want a yearly donation total on the hero, so that I see my impact.                                                        | P2       |

**Acceptance:** Donation records persist with category + source; zakat records produce a deduction input consumed by the PPh 21 service; history filters by category and year.

---

## 12. Tax Center — EPIC-004 (calc) + EPIC-005 (records)

| ID       | Story                                                                                                                 | Priority |
| -------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| US-TAX-1 | As a Personal user, I want a PPh 21 progressive calculator, so that I estimate tax owed.                              | P1       |
| US-TAX-2 | As a Personal user, I want to see my SPT status (filed/unfiled, withheld), so that I know my obligations.             | P2       |
| US-TAX-3 | As a Personal user, I want to upload/download tax documents (1721-A1, BPE, zakat receipts), so that records are kept. | P2       |
| US-TAX-4 | As a Personal user, I want zakat to reduce my taxable income automatically, so that the estimate is correct.          | P1       |

**Acceptance:** PPh 21 deterministic per UU HPP; live PKP/effective-rate output; documents in MinIO via `StoragePort`; zakat deduction wired from Donations.

---

## 13. Split Bill — EPIC-005

| ID         | Story                                                                                                      | Priority |
| ---------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| US-SPLIT-1 | As a Personal user, I want to create a split bill (equal/custom) with participants, so that I share costs. | P1       |
| US-SPLIT-2 | As a Personal user, I want a public share link, so that participants see their share without an account.   | P1       |
| US-SPLIT-3 | As a Personal user, I want to track who has paid, so that I follow up.                                     | P1       |
| US-SPLIT-4 | As a Personal user, I want to send a WhatsApp reminder, so that I nudge unpaid participants.               | P2       |

**Acceptance:** Share link is publicly openable (`wealthme.id/split/...`); per-participant pay status updates and reflects on the link; split math (equal/custom + tax/tip) matches the calculator.

---

## 14. Bank Reconciliation — EPIC-005

| ID         | Story                                                                                                            | Priority |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| US-RECON-1 | As a Personal user, I want to upload a bank statement (PDF/Excel), so that the system can match it.              | P2       |
| US-RECON-2 | As a Personal user, I want the system to match statement lines to my transactions, so that I find discrepancies. | P2       |
| US-RECON-3 | As a Personal user, I want AI suggestions to add missing transactions, so that my records are complete.          | P2       |

**Acceptance:** 4-step stepper (upload→scan→match→done); parser handles common bank formats; split-view shows statement vs system with ✅/⚠️/❌; missing-entry suggestions can be one-click added.

---

## 15. AI Advisor — EPIC-006

| ID      | Story                                                                                                            | Priority |
| ------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| US-AI-1 | As a Personal user, I want to chat with an AI advisor grounded on my data, so that I get personalized guidance.  | P1       |
| US-AI-2 | As a Personal user, I want streaming responses with quick-question shortcuts, so that the chat feels responsive. | P2       |
| US-AI-3 | As a Personal user, I want wealth/spending analysis on request, so that I understand my finances.                | P1       |
| US-AI-4 | As a Personal user, I want goal and investment recommendations, so that I improve my plan.                       | P2       |

**Acceptance:** Advisor uses `claude-sonnet-4-6` via `AiAdvisorPort` (streaming), grounded on the user's real data; financial math stays deterministic in BE (advisor explains, never computes zakat/tax); disclaimers shown.

---

## 16. Notifications — EPIC-002 ✅ (real delivery EPIC-006)

| ID         | Story                                                                                                     | Priority |
| ---------- | --------------------------------------------------------------------------------------------------------- | -------- |
| US-NOTIF-1 | As a Personal user, I want to see in-app notifications with an unread badge, so that I don't miss alerts. | P1 ✅    |
| US-NOTIF-2 | As a Personal user, I want to toggle notification types, so that I control what I receive.                | P2       |
| US-NOTIF-3 | As a Personal user, I want a budget-overrun alert when I hit ≥80% of a category, so that I curb spending. | P1 ✅    |

**Acceptance:** Real-time in-app via WebSocket/SSE; accurate unread badge (delivered in EPIC-002); real email/push delivery via `NotificationPort` lands in EPIC-006; per-category toggles persist.

---

## Coverage Check

All 21 product pages (PRD Appendix A) map to at least one story domain above. Domains 1–3 + 16 (partial) are delivered in EPIC-001/002; domains 4–15 + 16 (delivery) are planned in EPIC-003→007. The Akun page is covered by domain 1 (US-AUTH-4..8) and wired via EPIC-005 task **T-505**.
