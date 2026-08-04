# EPIC-023: Family Roles, Money Mechanics & Report Correctness

status: backlog
environment: dev
retries: 0
phase: 4
priority: P0
area: Full-stack
source: Two `/grilling` sessions with the product owner, 2026-08-05 — 26 signed-off decisions, each grounded in code read during the session

## Goal

WealthMe models a family as three flat roles and treats every controversial
money movement as a plain expense. Both assumptions break the moment a real
household uses it: a driver cannot be given operational funds without seeing the
household ledger, a child cannot be onboarded without an email address, paying
down a mortgage is booked as a cost, and buying on credit reduces the bank
balance it never touched.

This epic implements the 26 decisions taken during two grilling sessions. It is
not a feature wishlist — every item below was traced to code first, and the
decision recorded is the product owner's, not the implementer's.

Three themes:

1. **Who may do what.** Kinship and authority become separate axes, so a
   grandmother can be trusted and a driver constrained without either being a
   special case. Dependants get accounts without email, and a PIN that unlocks a
   device rather than replacing a password.
2. **Money that moves for real.** Paying a premium, an instalment, or a friend's
   share of a bill becomes one linked transaction that debits a chosen account —
   never a status flag the user must then mirror by hand.
3. **Reports that survive an accountant.** Debt principal stops counting as an
   expense, receivables stop counting as income, and the balance sheet finally
   reconciles to the P&L through a named bridge.

## Evidence

Every finding below was read in code during the grilling sessions, not inferred.

- **`TAB_TYPES = ["income", "expense", "transfer", "expense"]`**
  (`transaction-dialog.tsx:24`) — the "Kartu Kredit" tab is a byte-identical
  copy of the expense tab. Buying on credit debits the bank account it never
  touched and never raises the card's debt.
- **`CategoryKind` is `income | expense` only** (`schema.prisma:26`), while the
  dialog filters categories with `c.kind === txType || c.kind === "both"`
  (`transaction-dialog.tsx:110-112`). On the Transfer tab nothing can match:
  the category dropdown is permanently empty.
- **`isBig = amount >= BigInt(5_000_000)`** (`transactions.service.ts:476`)
  only changes a notification title. "Konfirmasi Transaksi Besar" confirms
  nothing, and the threshold is hard-coded.
- **`rows = []` for non-CSV uploads**
  (`rekonsiliasi/page.tsx:718-721`) under a comment claiming "server handles
  parsing" — the server requires already-parsed rows (`UploadSyncDto`). Uploading
  an Excel or PDF statement reports success and imports nothing. CSV parsing is
  `l.split(",")` (breaks on any comma in a description) and multiplies every
  amount by 100 while the server stores whole rupiah.
- **`groupNum: 4 → direction: "INCOME"` and `groupNum: 5 → direction:
"EXPENSE"`** (`seed.ts:2452-2531`). Lending money out counts as revenue;
  repaying mortgage principal counts as a cost. On a Rp 5 jt instalment with
  Rp 1,5 jt interest that is **Rp 3,5 jt of fabricated expense every month**.
  Group 3 (Wealth Allocation) is correctly `TRANSFER` — the design is sound, two
  shelves are simply mis-pointed.
- **`Member` has no kinship field at all**; `Role` is `owner | member |
admin_staff` (`schema.prisma:12-16, 316-331`). Meanwhile
  `InsuranceBeneficiary.relationship` exists — the app knows "istri" for a policy
  beneficiary but not for an actual family member.
- **`FamilyGroup` has no settings columns**, so "Tampilkan Saldo ke Anggota"
  (`i18n/id.ts:522`) is not broken — it was never wired to anything.
- **`Invitation.email` is required** (`schema.prisma:304`), which blocks exactly
  the members this epic adds: young children, helpers, drivers.
- **`AiAdvisorService.buildContext` already scopes every query by
  `familyGroupId`** and the model is given a prepared summary rather than tools.
  Cross-family access is already impossible by construction; only per-family API
  keys are missing (`ai-advisor.module.ts:21-23` reads a single server env key).
- **`computeEstimatedValue` measures elapsed time from `Asset.createdAt`**
  (`assets.service.ts:30-42`) because `Asset` has no acquisition date, and the
  projected figure feeds net worth — wealth that changes with no real event.
- **Insurance has no payment logic whatsoever**; `Liability` has no payment
  history and no link to any transaction or budget.
- **Report period selection is `{ year, month, day? }`**
  (`laporan-period.ts:13-20`) — a single calendar month, day, or year. No range,
  no "last N months", although `getPnl` and `getDetailReport` already accept
  `startDate`/`endDate`.
- **All 11 `data-tour` targets resolve correctly.** The onboarding tour is not
  broken; it teaches where buttons are rather than how the system works. Recorded
  as a product gap, not a defect.

## Decisions Taken

Signed off by the product owner during the grilling sessions. These are settled —
they are recorded here so implementation does not relitigate them.

**Family & access**

1. **Two axes.** `Member.relationship` (istri · anak · kakek · nenek · bibi ·
   supir · sekretaris · bendahara) is descriptive; `Member.role` carries
   permissions. Choosing a relationship pre-fills a default role that stays
   editable. Kinship is not authority.
2. **Spouse = financial co-owner.** Full CRUD over every money surface; cannot
   manage members or delete the family group. One accountable head remains.
3. **A child sees only their own transactions** — their sub-account and what
   they recorded. Not the household ledger.
4. **A child sees the full inheritance register.** Accepted consequence, stated
   once: family wealth can be inferred there even though the transaction path is
   closed.
5. **Helpers and drivers see their own account and its balance** — otherwise the
   role cannot function; a driver must know whether there is fuel money left.
6. **Dependants and operational members are created directly by the head**
   (name + username + initial password, no email), with a forced password change
   on first login. Spouse and bookkeeper still arrive by email invitation.
7. **PIN is a device unlock, not a credential.** First login on a device uses the
   password; afterwards the PIN unlocks that device. A new device needs the
   password again.
8. **"Tampilkan Saldo ke Anggota" is removed.** Roles become the single source of
   truth for visibility; two overlapping mechanisms are how privacy bugs are
   born.
9. **Large transactions gate for dependants and operational members** — held
   until the head approves — and merely notify trusted roles. The threshold is
   per member.

**Money mechanics**

10. **A payment is an ordinary linked transaction** carrying `liabilityId` /
    `insuranceId`. One ledger, one truth.
11. **Liabilities and premiums become FIXED budget lines automatically**; the
    budget page is where obligations are paid, choosing the source account.
    Deleting a liability is refused while its budget line exists — never a silent
    cascade.
12. **A credit card stays a liability.** Spending raises the card's debt and
    leaves the bank untouched; paying the bill uses the same Pay flow.
13. **The Transfer tab loses its category.** Moving money between your own
    accounts is neither income nor expense; the category appears when the money
    is actually spent.
14. **Beneficiaries and heirs link live to `Member`** — name and relationship
    flow from one place. Non-members are still entered by hand.

**External data**

15. **Automate what can be automated; label the rest.** Crypto via CoinGecko and
    IDX equities via Yahoo `.JK` (labelled delayed and unofficial). Mutual funds,
    bonds and gold stay manual with a "diinput manual, per <date>" label — the
    pattern already used for the family gold price.
16. **Bring-your-own AI key**, stored encrypted (AES-256-GCM, the same
    `CryptoService` used for account numbers), provider-agnostic across OpenAI,
    Claude and Gemini. A family with no key sees the advisor disabled with
    instructions — never a mock answer presented as advice.
17. **Reconciliation uses column mapping**, saved per bank as a template. Excel
    is parsed for real; PDF is refused honestly with a pointer to export CSV.

**Clarity & correctness**

18. **Master COA stays visible** and is rewritten in plain language. Risk
    recorded: a user who edits it incorrectly will break their own reports.
19. **Recorded asset value is the official net-worth figure**; the projection is
    shown beside it, labelled, with a "use this figure" action. Default rates per
    asset type, and a new acquisition-date field so elapsed time means something.
20. **Religion is a family setting** — zakat (2,5% of wealth, nisab, haul) or
    perpuluhan (10% of income) or neither, each with its own correct arithmetic.
    Tax deductibility widens beyond zakat to obligatory religious contributions
    per PP 60/2010, which currently excludes Christian users incorrectly.
21. **A shared split-bill link shows the recipient's share and how to pay**, and
    lets them claim they have transferred. The owner confirms, and only then does
    it become real income.
22. **Onboarding becomes a guided setup** that teaches by consequence — add an
    account, watch net worth appear; record an expense, watch it move.
23. **COA groups 4 and 5 become `TRANSFER`**, with a new "Bunga Pinjaman"
    expense category in group 2. The Pay button splits principal from interest
    using `Liability.interestRate`. A migration corrects existing families.
    **Historical report figures will change** — they become correct, and they will
    differ from what was seen before.
24. **The balance sheet reconciles to the P&L** through a named bridge built on
    `NetWorthSnapshot`: `opening net worth + (income − expenses) + change in
asset & investment values = closing net worth`. This is what answers "why is
    my profit 10 jt but my wealth up 15 jt".
25. **Reports use a date range with quick presets** — This Month, Last Month,
    Last 3/6/12 Months, This Year, Last Year, Custom — across every sub-report.
    The balance sheet uses the range's **end date** and says so. P&L comparison
    uses the equally-long range immediately before, which the existing engine
    already computes.
26. **Cash basis, stated on the report.** Revenue is recognised when money
    arrives, not when an invoice is raised.

## User Stories

| ID         | Story                                                                                                                                                                                              | Priority |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-FAM-8   | As a head of family, I want to record how each member is related to me (wife, child, driver, secretary), so that the app reflects my actual household rather than three generic roles.             | P0       |
| US-FAM-9   | As a head of family, I want a member's permissions to default from their relationship but stay editable, so that I can trust a grandmother fully and still restrict a driver.                      | P0       |
| US-FAM-10  | As a spouse, I want full control over every money surface without being able to remove family members, so that we are equal partners over the money while one head stays accountable.              | P0       |
| US-FAM-11  | As a child, I want to see only my own account and transactions, so that I can manage my allowance without reading the household's finances.                                                        | P0       |
| US-FAM-12  | As a head of family, I want to create accounts for my child and driver without an email address, so that people who have no email can still use the app.                                           | P0       |
| US-FAM-13  | As a driver, I want to unlock the app with a PIN on my own phone, so that I do not retype a password every time I record fuel.                                                                     | P1       |
| US-FAM-14  | As a head of family, I want spending above a limit I set per member to wait for my approval, so that money cannot leave before I have seen it.                                                     | P0       |
| US-AUTH-9  | As a member given an account by the head, I want to be forced to change my password at first login, so that nobody else keeps my credentials.                                                      | P0       |
| US-LIAB-3  | As a head of family, I want a new liability to appear in my monthly budget automatically, so that my plan reflects what I am actually obliged to pay.                                              | P0       |
| US-LIAB-4  | As a head of family, I want to pay an instalment from the budget page and choose the source account, so that the payment moves real money instead of flipping a status.                            | P0       |
| US-LIAB-5  | As a head of family, I want credit-card spending to raise the card's debt without touching my bank balance, so that my accounts reflect what actually happened.                                    | P0       |
| US-INS-4   | As a head of family, I want to pay a premium and have it debit a chosen account, so that I do not record the same payment twice by hand.                                                           | P0       |
| US-INS-5   | As a head of family, I want to choose beneficiaries from my family members, so that I do not retype names that the app already knows.                                                              | P1       |
| US-TXN-8   | As any user, I want the Transfer tab to stop asking for a category, so that I am not blocked by a dropdown that can never have options.                                                            | P1       |
| US-RPT-9   | As a head of family, I want repaying loan principal to stop counting as an expense, so that my profit and loss is not understated by thousands every month.                                        | P0       |
| US-RPT-10  | As a head of family, I want money I lend out to stop counting as income, so that my profit reflects earnings rather than movements.                                                                | P0       |
| US-RPT-11  | As a head of family, I want to see how my opening net worth became my closing net worth, so that I understand why profit and wealth changed by different amounts.                                  | P0       |
| US-RPT-12  | As any user, I want to filter every report by a date range or a quick preset such as "last 3 months", so that I can look at the period I care about rather than one calendar month.                | P0       |
| US-RPT-13  | As any user, I want the report to state that it is cash basis, so that I know why an unpaid invoice does not appear as revenue.                                                                    | P1       |
| US-INV-7   | As an investor, I want crypto and IDX equity prices to update automatically and everything else to be clearly labelled as manually entered, so that I never mistake a stale figure for a live one. | P1       |
| US-ASSET-4 | As a head of family, I want my recorded asset value to be the official one and any projection shown separately, so that my net worth only changes when something real happens.                     | P0       |
| US-DON-6   | As a Christian user, I want a tithe calculator rather than a zakat calculator relabelled, so that the figure I am shown is actually correct for my faith.                                          | P0       |
| US-DON-7   | As any user, I want obligatory religious contributions of my own faith to reduce my taxable income where the law allows, so that I am not excluded by a rule written only for zakat.               | P1       |
| US-SPLIT-5 | As a friend receiving a split-bill link, I want to see my share and where to transfer, so that the link is worth opening.                                                                          | P1       |
| US-SPLIT-6 | As a bill owner, I want to confirm a friend's claim before it becomes income, so that a claim is never mistaken for money received.                                                                | P1       |
| US-RECON-4 | As a head of family, I want to map my bank's columns once and reuse it, so that every future statement imports without work.                                                                       | P0       |
| US-RECON-5 | As a head of family, I want a PDF upload refused with a clear reason, so that I never believe an import succeeded when nothing was imported.                                                       | P0       |
| US-AI-5    | As a head of family, I want to supply my own AI provider key, so that the advisor works without anyone else paying for or reading my usage.                                                        | P1       |
| US-DASH-7  | As a new user, I want onboarding to build my first account, transaction and budget with me, so that I finish understanding how the system works instead of where the buttons are.                  | P1       |

## Tasks

- [ ] ### A — Report correctness: COA shelves, principal/interest split (do first)
  - **A1** — Change seeded COA groups 4 (Receivable) and 5 (Payable) from
    `INCOME`/`EXPENSE` to `TRANSFER`; add a "Bunga Pinjaman" category in group 2
    with direction `EXPENSE`. Additive migration correcting existing families'
    `CoaAccount` rows. (D23, US-RPT-9, US-RPT-10)
  - **A2** — The Pay action splits a payment using `Liability.interestRate`:
    principal reduces `remainingBalance` through a `TRANSFER`-direction category,
    interest posts as an expense. Golden test on a known amortisation schedule.
  - **A3** — Regression test proving a principal repayment no longer appears in
    P&L expenses and a loan disbursement no longer appears as revenue.
  - **A4** — State the cash basis in the P&L header, both locales. (D26, US-RPT-13)

- [ ] ### B — Report periods and the balance-sheet bridge
  - **B1** — Replace `ReportPeriodSelection` with a date range plus presets (This
    Month · Last Month · Last 3/6/12 Months · This Year · Last Year · Custom),
    applied across every report sub-view, WIB-anchored as EPIC-022 B7 established.
    (D25, US-RPT-12)
  - **B2** — The balance sheet uses the range's end date and labels it
    ("Posisi per 5 Agu 2026"), honouring `asOfDate` via `NetWorthSnapshot`
    instead of silently showing today (closes EPIC-022 B11).
  - **B3** — Reconciliation bridge: `opening + (income − expenses) + asset &
investment revaluation = closing`, every residual named. Unit tests on a
    constructed month. (D24, US-RPT-11)

- [ ] ### C — Roles, kinship and access
  - **C1** — Add `Member.relationship`; extend `Role` with the dependant and
    operational tiers; relationship pre-fills a default role. (D1, US-FAM-8/9)
  - **C2** — CASL: spouse gets full money CRUD without member management; child
    and operational members are scoped to their own accounts and transactions;
    the bookkeeper tier keeps today's `admin_staff` reach. (D2/3/5, US-FAM-10/11)
  - **C3** — Inheritance stays fully visible to children by explicit decision
    (D4) — assert it in a test so nobody "fixes" it later.
  - **C4** — Remove the "Tampilkan Saldo ke Anggota" toggle and its strings. (D8)

- [ ] ### D — Onboarding members without email, and PIN unlock
  - **D1** — Head-created accounts for dependant/operational roles: name +
    username + initial password, no email; forced password change at first login.
    Requires username authentication in better-auth. (D6, US-FAM-12, US-AUTH-9)
  - **D2** — Device-bound PIN unlock: password on first login per device, PIN
    thereafter, attempt limits and lockout. Never a standalone credential. (D7,
    US-FAM-13)
  - **D3** — Per-member large-transaction threshold; dependant and operational
    spending above it is held for approval through the existing
    `AllowanceRequest` primitive; trusted roles are notified only. (D9, US-FAM-14)

- [ ] ### E — Payments that move money
  - **E1** — `Transaction` gains optional `liabilityId` / `insuranceId`; paying
    creates one linked transaction, debits the chosen account, and updates the
    obligation atomically. (D10, US-LIAB-4, US-INS-4)
  - **E2** — Adding a liability or insurance creates a FIXED budget line; the
    budget page lists this period's obligations with a Pay action and a source
    account picker; deleting a liability is refused while its budget exists.
    (D11, US-LIAB-3)
  - **E3** — Credit card: the transaction dialog's card tab selects a card from
    liabilities, raises its debt, and leaves bank balances untouched. Remove the
    duplicated `TAB_TYPES` entry. (D12, US-LIAB-5)
  - **E4** — Remove the category field from the Transfer tab. (D13, US-TXN-8)

- [ ] ### F — Beneficiaries, religion, split bill
  - **F1** — Beneficiary and heir pickers read from `Member`, with name and
    relationship live-linked; free text remains for non-members. (D14, US-INS-5)
  - **F2** — Family religion setting driving zakat / perpuluhan / neither, each
    with its own arithmetic and copy; widen tax deductibility to obligatory
    religious contributions per PP 60/2010. (D20, US-DON-6/7)
  - **F3** — Shared split-bill link shows the recipient's share and payment
    destination and accepts a "saya sudah transfer" claim; the owner confirms,
    which posts real income to a chosen account. Token unguessable and revocable.
    (D21, US-SPLIT-5/6)

- [ ] ### G — External data: prices, reconciliation, AI keys
  - **G1** — Wire CoinGecko for crypto and Yahoo `.JK` for IDX equities behind
    the existing `MarketDataPort`; label them delayed and unofficial. Mutual
    funds, bonds and gold keep manual entry with a dated manual label. Per-type
    investment forms. (D15, US-INV-7)
  - **G2** — Reconciliation column mapping with per-bank templates; parse Excel
    for real; fix the CSV parser (quoted fields, no ×100); refuse PDF with a
    clear reason instead of importing zero rows. (D17, US-RECON-4/5)
  - **G3** — Per-family AI provider keys stored encrypted; OpenAI and Gemini
    adapters beside the existing Claude one; advisor disabled with instructions
    when no key is set, never a mock answer. (D16, US-AI-5)

- [ ] ### H — Assets, Master COA, onboarding
  - **H1** — Recorded asset value is authoritative for net worth; projection
    shown beside it and adoptable; default rates per asset type; add an
    acquisition-date field. (D19, US-ASSET-4)
  - **H2** — Rewrite Master COA in plain language with worked examples. (D18)
  - **H3** — Replace the button tour with a guided first setup that creates a
    real account, transaction and budget while explaining each consequence.
    (D22, US-DASH-7)

- [ ] ### I — Reported defects awaiting reproduction
  - **I1** — Tax Center "Gagal menyimpan data pajak": reproduce against DEV,
    capture the API status and log, then fix. Not yet diagnosed — no assumption
    recorded.
  - **I2** — Split-bill dialog responsiveness at 390×844: re-measure; EPIC-022 G
    may already cover it. Report the measurement either way.

## Acceptance Criteria

Written to `docs/product/ACCEPTANCE-CRITERIA.md`.

**Report correctness**

```
Given a liability with a 12% annual rate and a Rp 5.000.000 instalment
When  the head pays it from the budget page
Then  the P&L expense increases only by the interest portion
And   the remaining balance decreases by the principal portion
And   the family's net worth is unchanged by the principal movement
```

```
Given money lent to a friend and recorded against a group-4 category
When  the P&L for that period is opened
Then  the amount does not appear as revenue
```

```
Given a report period of "Last 3 Months"
When  the balance sheet is opened
Then  it states the single date it represents ("Posisi per <end date>")
And   the reconciliation bridge's closing figure equals the balance sheet's net worth
```

**Access**

```
Given a member whose role is child
When  they open the transaction list
Then  they see only transactions on accounts they own or that they recorded
And   they can still open the full inheritance register (explicit decision D4)
```

```
Given a member whose role is operational and a per-member threshold of Rp 500.000
When  they record a Rp 750.000 expense
Then  the transaction is held pending the head's approval
And   no account balance changes until the head approves
```

```
Given a head creating an account for a driver with no email
When  the driver logs in for the first time
Then  they are required to set a new password before reaching any page
```

**Money mechanics**

```
Given a credit card recorded as a liability
When  a purchase is recorded on the credit-card tab
Then  the card's outstanding debt increases by that amount
And   no bank or cash account balance changes
```

```
Given an unpaid insurance premium
When  the head presses Bayar and selects a source account
Then  one transaction is created linked to that policy
And   the selected account's balance decreases by the premium
And   the renewal date advances
```

**Honesty**

- No screen states a figure whose basis it hides: the P&L declares cash basis;
  every manually-maintained price carries its entry date; every automated price
  carries its source and delay.
- A PDF statement upload is refused with a reason. No upload ever reports success
  while importing zero rows.
- The AI advisor is either configured or visibly disabled — never a mock answer
  rendered as advice.
- Deleting a liability that still has a budget line is refused with a message
  naming what blocks it.

**Checklist**

- [ ] Historical report changes from A1 are announced in-product before they land
- [ ] Every new user-visible string exists in both locales
- [ ] `scripts/qa.sh`, `scripts/test.sh`, `scripts/security-check.sh` green
- [ ] Each new test fails against pre-fix code

## Definition of Done

See [`../DEFINITION-OF-DONE.md`](../DEFINITION-OF-DONE.md). Additionally for this
epic:

- The principal/interest split is verified against a hand-computed amortisation
  schedule, not against the implementation's own output.
- Every permission change is proven by a test that asserts a **denial**, not only
  a success.
- The reconciliation bridge is proven on a constructed month where profit and net
  worth change by deliberately different amounts.

## Test Plan

- **Unit** — amortisation split; COA direction classification per group; the
  reconciliation bridge; date-range presets under a non-WIB `TZ`; tithe versus
  zakat arithmetic.
- **Integration** — a child cannot read another member's transaction; an
  operational member's over-threshold spend is held; a credit-card purchase leaves
  bank balances untouched; a premium payment debits exactly one account.
- **E2E (Playwright, headless)** — head creates a driver account without email;
  driver logs in, changes password, records an expense, requests funds; head
  approves and money moves; a shared split-bill link is opened by an
  unauthenticated visitor.
- **Manual QA** — one month of real figures reconciled by hand against the bridge.

## Agent Routing

`code-agent` per task group, each in its own worktree. `ecc:typescript-reviewer`
and `ecc:react-reviewer` on every diff; `database-reviewer` for the migration in
A1 and the schema changes in C1/E1; `ecc:security-reviewer` for group C and D
(permissions, credentials, PIN) and G3 (key storage). Adversarial review before
merge on every group — the last two waves each needed a second round, and the
three worst defects were found by review rather than implementation. Gates via
`test-agent` / `security-agent`; `deploy-agent` for DEV only.

Per task: `/task-work EPIC-023 <n>`.

## Done Signal

Each group closes independently through `/task-work`. The epic closes when the
acceptance criteria hold on DEV against a family that has a spouse, a child and a
driver, holds a mortgage and a credit card, and has at least one month of history
whose P&L and balance sheet reconcile through the bridge.

## Automation Log

- 2026-08-05 — Epic created from two `/grilling` sessions with the product owner.
  Twenty-six decisions signed off, each grounded in code read during the session
  rather than assumed. Four findings surfaced that were not on the owner's list:
  the credit-card tab is a duplicate of the expense tab; the Transfer tab's
  category dropdown can never populate; "Konfirmasi Transaksi Besar" only renames
  a notification; and COA groups 4 and 5 mis-classify receivables as income and
  debt principal as expense — the last fabricating roughly Rp 3,5 jt of expense
  per month on a typical mortgage instalment. Two reported defects (Tax Center
  save failure, split-bill dialog responsiveness) are recorded as group I
  **without** a diagnosis, to be reproduced rather than guessed. Status
  `backlog`; set `on-progress` to start. No code changed.
