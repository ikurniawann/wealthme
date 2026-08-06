# EPIC-023: Family Roles, Money Mechanics & Report Correctness

status: on-progress
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

- [x] ### A — Report correctness: COA shelves, principal/interest split (do first) ✅
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

- [x] ### B — Report periods and the balance-sheet bridge ✅
  - **B1** — Replace `ReportPeriodSelection` with a date range plus presets (This
    Month · Last Month · Last 3/6/12 Months · This Year · Last Year · Custom),
    applied across every report sub-view, WIB-anchored as EPIC-022 B7 established.
    (D25, US-RPT-12)
  - **B2** — The balance sheet uses the range's end date and labels it
    ("Posisi per 5 Agu 2026"), honouring `asOfDate` via `NetWorthSnapshot`
    instead of silently showing today (closes EPIC-022 B11).
  - **B3** — Reconciliation bridge: `opening + profit − contribution +
holdingsChange + unexplained = closing`, every residual named. Unit tests
    on a constructed month. (D24, US-RPT-11)

- [x] ### C — Roles, kinship and access ✅
  - **C1** — Add `Member.relationship`; extend `Role` with the dependant and
    operational tiers; relationship pre-fills a default role. (D1, US-FAM-8/9)
  - **C2** — CASL: spouse gets full money CRUD without member management; child
    and operational members are scoped to their own accounts and transactions;
    the bookkeeper tier keeps today's `admin_staff` reach. (D2/3/5, US-FAM-10/11)
  - **C3** — Inheritance stays fully visible to children by explicit decision
    (D4) — assert it in a test so nobody "fixes" it later.
  - **C4** — Remove the "Tampilkan Saldo ke Anggota" toggle and its strings. (D8)

- [x] ### D — Onboarding members without email, and PIN unlock ✅
  - **D1** ✅ — Head-created accounts for dependant/operational roles: name +
    username + initial password, no email; forced password change at first login.
    Requires username authentication in better-auth. (D6, US-FAM-12, US-AUTH-9)
  - **D2** ✅ — Device-bound PIN unlock: password on first login per device, PIN
    thereafter, attempt limits and lockout. Never a standalone credential. (D7,
    US-FAM-13)
  - **D3** ✅ — Per-member large-transaction threshold; dependant and operational
    spending above it is held for approval through the existing
    `AllowanceRequest` primitive; trusted roles are notified only. (D9, US-FAM-14)

- [x] ### E — Payments that move money ✅
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

- [x] ### G — External data: prices, reconciliation, AI keys ✅
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
  - **H1** ✅ — Recorded asset value is authoritative for net worth; projection
    shown beside it and adoptable; default rates per asset type; add an
    acquisition-date field. (D19, US-ASSET-4)
  - **H2** — Rewrite Master COA in plain language with worked examples. (D18)
  - **H3** — Replace the button tour with a guided first setup that creates a
    real account, transaction and budget while explaining each consequence.
    (D22, US-DASH-7)

- [x] ### I — Reported defects awaiting reproduction ✅
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

Routing decided in a `/grilling` session on 2026-08-05, from what is actually
installed on this machine rather than what a generic epic would assume.

### Execution order — two waves

Groups have real dependencies; running them flat would build on foundations that
are still wrong.

**Wave 1** (parallel, one worktree each): **A**, **C**, **G**, **H1**, **I**.

**Wave 2** (starts only after wave 1 is merged and DEV is green): **B**, **D**,
**E**, **F**, **H2**, **H3**.

Why: **E** posts payments through COA shelves, so it must not land before **A**
corrects them — otherwise every instalment inflates expenses and the data then
needs repairing. **B**'s reconciliation bridge cannot balance until **A** is
right. **D** and **F1** both read `Member`, so they wait for **C**.

**Migration ordering hazard.** A1 and C1 both add migrations. Create them
**sequentially, never concurrently** — parallel worktrees have collided on
migration timestamps in this repo before. A1's migration is authored and merged
first; C1 rebases onto it.

### Per-group routing

| Group                                     | Implement                                          | Domain skills to load first                                                           | Review (beyond the standard gate)                                                     |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **A** COA shelves, principal/interest     | `code-agent` + `tdd-guide`                         | `ecc:database-migrations`, `ecc:prisma-patterns`                                      | **adversarial**, `database-reviewer`, `ecc:typescript-reviewer`                       |
| **B** periods + bridge                    | `code-agent` + `tdd-guide`                         | —                                                                                     | **adversarial**, `ecc:react-reviewer`, `ecc:typescript-reviewer`                      |
| **C** roles & kinship                     | `code-agent`                                       | `ecc:nestjs-patterns`, `ecc:prisma-patterns`                                          | **adversarial**, `ecc:security-reviewer`, `database-reviewer`, `type-design-analyzer` |
| **D** onboarding, PIN, threshold          | `code-agent`                                       | `vercel:auth`, `docs-lookup` (better-auth username + PIN)                             | **adversarial**, `ecc:security-reviewer`, `e2e-runner`                                |
| **E** payments                            | `code-agent` + `tdd-guide`                         | `ecc:nestjs-patterns`                                                                 | **adversarial**, `database-reviewer`, `silent-failure-hunter`                         |
| **F** beneficiaries, religion, split bill | `code-agent`                                       | `shadcn`, `frontend-design`                                                           | `ecc:react-reviewer`, `ecc:typescript-reviewer`, `silent-failure-hunter`              |
| **G** prices, reconciliation, AI keys     | `code-agent`                                       | `claude-api` (G3 provider adapters), `docs-lookup` (CoinGecko, Yahoo, OpenAI, Gemini) | `ecc:security-reviewer` (G3 key storage), `silent-failure-hunter` (G2 parsers)        |
| **H** assets, COA copy, onboarding        | `code-agent`                                       | `shadcn`, `frontend-design`, `a11y-architect` (H3)                                    | standard gate only                                                                    |
| **I** undiagnosed defects                 | **`mattpocock:diagnosing-bugs`**, not `code-agent` | —                                                                                     | standard gate + reproduction evidence                                                 |

### Mandatory before touching shared code

`graphify-out/graph.json` exists in this repo — query it for blast radius before
editing anything shared, rather than grepping. Required before touching
`components/crud/crud-config.ts`, `components/shell/transaction-dialog.tsx`,
`casl-ability.factory.ts`, `components/ui/*`, `lib/format.ts`, or the i18n
dictionaries.

This is not ceremony: EPIC-022 G shipped a mobile-dialog fix that was silently
no-op'd on the two dialogs that most needed it, because pre-existing `vh`
overrides won. A blast-radius query lists every override in one step.

### Adversarial review protocol

Groups **A, B, C, D, E** — everything touching money, permissions, or credentials
— get a review pass whose brief is to **disprove the fix, not to approve it**.
Groups **H2, H3** take the standard gate only; a rewritten explainer page does
not warrant it.

The instruction that worked, and should be reused verbatim in shape:

> Assume it is wrong until you prove otherwise. Do not restate what the diff
> does; hunt for what it broke. For each claimed fix, state whether it holds,
> with `file:line` evidence and a concrete failure scenario. Verify each new test
> would **fail** on the pre-change code — say which ones you are confident about.

This earned its place. Over two waves it caught: a "balanced" check that was
algebraically incapable of failing (twice, in two different disguises), a
dialog fix that `tailwind-merge` correctly neutralised exactly where it mattered,
investment values inflated by a factor of quantity, and legacy rows still cutting
tax on every read. None of those were caught by the standard review gate.

### Test-first for money groups

**A, B and E are test-first.** The expected value must exist on paper before the
code does — a hand-worked amortisation schedule for A2, a constructed month for
B3's bridge where profit and net-worth change by deliberately different amounts.
Write the test, watch it fail, then implement.

The reason is specific: EPIC-022's retirement test asserted
`projectedValue === targetAmount`, which holds by construction and passes even
with a wrong PMT formula. Writing a test after the code invites pasting the
code's own output into it, and such a test can never fail. `tdd-guide` drives
this; the golden values go in the PR body so a reviewer can recompute them.

### Autonomy

Full autonomy through DEV deploy, as run in the EPIC-022 waves: implement →
gates → PR → merge → `deploy-dev.sh` → verify on the running system → report.

One safeguard applies regardless, because **A1 changes historical report
figures** for existing families: before that migration runs on DEV, capture the
current P&L and balance-sheet totals for the demo family, and report them
alongside the post-migration figures. A number that moves is expected; a number
that moves by an unexplained amount is a finding.

Standard gates are unchanged: `review-qa-agent` (acceptance criteria, WM
conventions, tenant scoping), `security-agent` + `ecc:security-reviewer`,
`test-agent` (`qa.sh` → `test.sh`), `ecc:react-build` on a broken build,
`deploy-agent` for DEV only. Bounded at 3 retries, then `status: blocked` with
reason, logs and recommended action.

Per task: `/task-work EPIC-023 <n>`. Whole epic: `/epic-loop docs/epics/EPIC-023-family-roles-money-mechanics-report-correctness.md`.

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
- 2026-08-05 — Agent routing reworked in a `/grilling` session against what is
  actually installed on this machine. Four decisions: **(1)** adversarial review
  tiered by risk — groups A/B/C/D/E get a reviewer briefed to disprove the fix,
  plus `database-reviewer` on migrations and `silent-failure-hunter` on error
  paths; H2/H3 keep the standard gate. **(2)** Groups A, B and E are test-first
  with hand-computed golden values, because EPIC-022's retirement test asserted
  an identity that held by construction and passed with a wrong formula.
  **(3)** Two waves by dependency — A/C/G/H1/I first, then B/D/E/F/H2/H3 — with
  A1's and C1's migrations authored sequentially to avoid the timestamp
  collision that has bitten parallel worktrees here before. **(4)** Full autonomy
  through DEV deploy, with one safeguard: capture the demo family's P&L and
  balance-sheet totals before A1's migration runs and report them beside the
  post-migration figures, since that migration changes historical numbers.
  Also wired in tooling that was installed but unused: `graphify` blast-radius
  queries before editing shared files, `docs-lookup`/Context7 for better-auth and
  the price and LLM providers, the `claude-api` skill for G3's provider adapters,
  `type-design-analyzer` for the two-axis role model, `e2e-runner` for group D's
  journeys, and `mattpocock:diagnosing-bugs` — rather than `code-agent` — for the
  undiagnosed defects in group I.
- 2026-08-05 /epic-loop EPIC-023 #1 "A — Report correctness: COA shelves,
  principal/interest split (do first)" → PASS (attempts: 3),
  PR: https://github.com/andrsrjld/wealthme-web/pull/236.
  Test-first as routed: the golden six-month amortisation schedule was
  hand-computed before any code existed, and the two A3 report tests were
  written against the pre-fix chart. Three findings the epic did not anticipate:
  **(1)** the bug lived in _two_ charts, not one — `GENERIC_COA_CHART`
  (`packages/contracts/src/coa/index.ts`) is what real families are provisioned
  from at `auth.service.ts:150` and `web/src/lib/auth.ts:114`, and it mis-shelved
  `40001 Piutang` as INCOME and `50001 Utang`/`50002 Cicilan` as EXPENSE
  independently of `seed.ts`. Both are corrected; the migration repairs existing
  families regardless of origin. **(2)** The first draft of the A3 tests pinned
  the buggy direction as a literal in the fixture, which made them unpassable
  except by special-casing `groupNum` inside `ReportsService` — the opposite of
  D23. They were rewritten to read direction from the chart, so they track the
  real taxonomy and cannot be gamed. **(3)** `CoaAccountsService` accepted any
  direction for any `groupNum`, so the API could have recreated this exact bug
  the day after the migration shipped; `assertValidCoaDirection` now rejects
  group 4/5 with a non-TRANSFER direction on both create and update.
  Adversarial review earned its place again over three rounds: it caught a
  lost-update race on `Liability.remainingBalance` (read-then-write, while the
  account beside it was decremented atomically — a double-click lost a whole
  principal payment), a missing bank-overdraft floor that let `pay()` bypass the
  EPIC-021 #22 invariant the rest of the app enforces, and then — by reproducing
  it live against Postgres 17 — proved that the P2002 recovery added to fix the
  category self-heal race was itself impossible: Prisma's interactive
  transactions issue no savepoints, so any query after a caught error dies with
  `25P02`. The fix routes P2002 through the same bounded retry as P2034, so a
  fresh transaction sees the winner's committed row. `assertBankNotOverdrawn`
  was extracted to `common/utils/bank-overdraft.util.ts` and is now shared by
  `TransactionsService` and `LiabilitiesService` — one definition for one
  invariant. **Deferred by decision, not oversight:** the `liabilityId` FK on
  `Transaction` and switching the principal leg's `Transaction.type` from
  `expense` to `transfer` both belong to E1; until then the transaction list
  badges a principal repayment as an expense even though the P&L correctly
  excludes it. **Outstanding safeguard:** the pre/post-migration P&L and
  balance-sheet capture for the demo family has NOT been done — it must run
  against DEV before this migration is applied there.
- 2026-08-05 /epic-loop EPIC-023 #2 "C — Roles, kinship and access" → PASS
  (attempts: 3),
  PR: https://github.com/andrsrjld/wealthme-web/pull/237. Three roles became six: `spouse` was added beyond
  the "dependant and operational" tiers the epic names, because D2 makes a
  spouse a financial co-owner with full money CRUD but no member management,
  which no existing tier expressed. Kinship (`Member.relationship`) is a
  separate, nullable axis that grants nothing; `DEFAULT_ROLE_BY_RELATIONSHIP`
  lives in `packages/contracts` as an exhaustive `Record`, so adding a
  relationship without mapping it is a compile error.
  **`Transaction.createdByUserId` had to be added** — the acceptance criterion
  "transactions on accounts they own **or that they recorded**" was
  unimplementable without it. It is never backfilled, so a child correctly sees
  none of the pre-existing household ledger.
  **The dominant finding was structural, and it is worth carrying beyond this
  epic**: `AbilitiesGuard` returns `true` for any route with no `@CheckAbility`,
  and `TenantGuard` checks only family membership, not role. Row scoping was
  applied carefully to accounts, transactions, dashboard, search, reports and
  exports — and reconciliation (5 routes), split-bills (5 routes), the AI
  advisor, `listMembers` and the GDPR export were all still readable by a child
  or driver, because nobody had audited them. Adding a low-trust role means
  auditing **every** controller, not the ones the feature touches. A second trap
  from the same change: CASL's `manage` is not implied by `create`, so granting
  the new roles `create` while the route checked `manage` made the one action
  D3/D5 exist to give them return 403 — and every unit test missed it by calling
  the service directly, bypassing the guard. There is now a guard-level spec
  that drives the real guard against the real controllers.
  Round 2 then over-corrected in the opposite direction: gating reconciliation
  on `manage` stripped plain `member` of upload/match access that commit
  `1fa5c1f` had deliberately preserved. Fixed by tiering — `member` holds
  `read`+`create`, the money-moving `splitEntry` stays `manage` per EPIC-021 #29.
  The GDPR export needed two passes: accounts and transactions were scoped
  per-membership, but goals and notifications kept a blanket query, and
  notification bodies embed literal amounts, so the ledger leaked through
  notification _text_ while the transactions themselves were correctly hidden.
  A stale `packages/contracts/dist` (committed build output) crashed the Next.js
  type-checker with a SIGTRAP rather than a readable error — rebuild contracts
  after editing its source.
  **Deferred to group D, by decision:** nav role-filtering (`apps/web/src/lib/nav.ts`
  is a protected foundation file, and `dependant`/`operational` will see many
  entries they cannot use, not just reconciliation — it needs doing once,
  properly); the relationship picker driven by `defaultRoleForRelationship`;
  surfacing `relationship` on the client `FamilyMember` type. **Owned by neither
  C nor D as written, and needing an explicit line item: editing an existing
  member's role or relationship — there is no `PATCH .../members/:id` UI at all,
  so US-FAM-8 has no end-to-end delivery yet.** Also recorded: the `test/e2e`
  suite is not wired into `scripts/test.sh`, needs an absent `.env.test`, and
  has drifted (uppercase enum values that would now fail `@IsEnum`).
- 2026-08-05 /epic-loop EPIC-023 #3 "G — External data: prices, reconciliation,
  AI keys" → PASS (attempts: 3, plus a fourth pass to close the security
  finding). PR: https://github.com/andrsrjld/wealthme-web/pull/238.
  The `.xlsx` decompression finding that briefly blocked this group is
  resolved — see `## Closed finding` below; the guard now measures the real
  expansion instead of trusting declared sizes. Everything else in the group
  is verified: CoinGecko and Yahoo `.JK` behind `MarketDataPort` with honest
  source/delay/as-of labelling, manual-only types keeping a dated manual label,
  per-family AI keys encrypted with `CryptoService`, OpenAI and Gemini adapters,
  the mock-advisor fallback deleted so the advisor is configured or visibly
  disabled, PDF/`.xls`/empty/zero-row uploads refused with coded reasons, and
  server-side CSV/XLSX parsing. 753 API and 227 web tests pass; `qa.sh`,
  `test.sh` and `security-check.sh` all exit 0.
  Four gates PASS (silent-failure, typescript, react, test). **Security FAILs on
  one HIGH** — see `## Blocker`. Along the way the reviewers, all working by
  execution rather than inspection, caught: an amount parser that reintroduced
  the very ×100 bug this epic exists to kill (`"150.000,00"` → `15000000n`,
  because every `.` and `,` was stripped as a thousands separator); CR/DR markers
  silently discarded so half a statement's rows imported with the wrong sign;
  ambiguous `DD/MM` vs `MM/DD` dates silently transposed, then — after the first
  fix — a column-wide inference where **one** outlier row bound the reading of
  every ambiguous row; truncated AI answers indistinguishable from complete ones,
  then, after that fix, still indistinguishable whenever a stream ended cleanly
  but early (a proxy idle timeout, the commonest real cause); and a localized
  error-code path that never worked in production because the global
  `AllExceptionsFilter` rebuilds the response body and forwards only `message`,
  discarding `code` — while the test that looked like coverage asserted on the
  thrown exception rather than the wire body.

## Closed finding — group G (.xlsx upload)

**RESOLVED.** Kept here in full because it took four attempts and the failed
approaches are worth not repeating.

The fix: `apps/api/src/reconciliation/zip-bounds.util.ts` now **measures** the
real expansion instead of trusting declared sizes. Every DEFLATE entry is
actually inflated and its output bytes counted, under `zlib`'s
`maxOutputLength` so the check aborts mid-call rather than allocating the
expansion first — the guard cannot become the attack. It walks **local file
header signatures forward** and never consults the central directory or EOCD,
so a forged trailer is irrelevant. Both previously-verified bypasses are now
permanent, named regression tests: if either stops throwing, the vulnerability
is back.

### The finding

Server-side `.xlsx` parsing (`apps/api/src/reconciliation/reconciliation-parsers.ts`,
`parseExcelBuffer`) is vulnerable to decompression amplification. A crafted file
well inside the 20 MiB upload limit exhausts process memory, taking down the
shared API for every family — not just the uploader's. Any role holding
`create Reconciliation` (owner, spouse, admin_staff, member) can reach it.

Measured, not theorised, on the project's own code:

| Round | Vector                                                                  | File         | Peak RSS    | Time       |
| ----- | ----------------------------------------------------------------------- | ------------ | ----------- | ---------- |
| 1     | `workbook.xlsx.load()` materialises the sheet before any cap runs       | 3.6 MiB      | 774 MiB     | —          |
| 2     | fixed by streaming (`WorkbookReader`); row/cell caps now fire mid-parse | 18.6 MiB     | 165 MiB     | 307 ms     |
| 3     | `styles: "cache"` — 2.5M `numFmt` entries, 3-cell worksheet             | 18.6 MiB     | 696 MiB     | 11.2 s     |
| 3     | fixed by `styles: "ignore"`                                             | 18.6 MiB     | 174 MiB     | 446 ms     |
| 4     | **`sharedStrings: "cache"` — 8M distinct strings, 3-cell worksheet**    | **19.2 MiB** | **969 MiB** | **10.7 s** |

`MAX_XLSX_ROWS` and `MAX_XLSX_CELLS` cannot catch any of the cache vectors: they
count data rows and cells actually iterated, while each auxiliary cache is
loaded in full before the first row is yielded.

### Why it was not fixed on the last attempt

The same class has now relocated three rounds running, to whichever cache is
still enabled. `styles` had an `"ignore"` mode and cost nothing to disable —
a Date cell simply arrives as its Excel serial, which `parseExcelSerialDate`
already resolves to the identical instant. `sharedStrings` has **no `"ignore"`
mode**, because it holds the actual cell text (descriptions, bank names) rather
than cosmetic formatting. `exceljs` offers only `"cache"` or `"emit"`.

Closing it therefore needs new code, not a config change.

### What was tried, and why it did not work

**Option 2 above — the pre-parse probe — was implemented and then defeated.**
`assertZipExpansionWithinBounds` (`apps/api/src/reconciliation/zip-bounds.util.ts`)
reads the zip central directory, sums the declared uncompressed sizes, and
refuses past 64 MiB before `exceljs` is handed anything. It closes both
previously-measured bombs instantly, at baseline memory.

It is not a defence, for a reason worth recording so nobody rebuilds it:

- **Under-declaring defeats it.** `unzipper`, which exceljs streams through,
  inflates the real DEFLATE payload regardless of what the local header or the
  central directory claims — the declared size is decorative to the
  decompression path. A 19.3 MiB archive declaring 500 bytes for a part that
  truly inflates to 412 MiB consumed **956 MiB over ~10s and returned
  successfully with three rows**. No exception, so nothing to alert on.
- **A 22-byte append defeats it.** Adding a second, empty EOCD record makes the
  backward scan find the attacker's trailer first, read "0 entries", sum nothing
  and return silently, while exceljs ignores the trailer and parses the real
  content. **344 MiB**, no lie needed, a fixed suffix appliable to any file.

The defence-in-depth argument written into that code — "a liar can only
under-declare, and the row/cell caps still apply" — **was wrong**. Those caps
bound the worksheet row-iteration loop, and the auxiliary parts
(`sharedStrings`, styles) are read in full _before_ that loop starts. Nothing
counts them.

The check has been kept, with its comments corrected to say plainly what it is:
a cheap early-out that rejects an honestly-declared oversized workbook in about
a millisecond. Worth having. Not a boundary.

### Recommended fix, for whoever picks this up

The bound has to come from something the archive cannot lie about. Header
fields cannot, so the two remaining options are:

1. **Meter the real inflate.** Enforce a hard output-byte ceiling _during_
   decompression, independent of any declared size — so the stream is cut off
   at N bytes whatever the headers claim. Precise, and keeps legitimate large
   statements working, but means owning more of the unzip path than exceljs
   currently exposes.
2. **Isolate the parse.** Run it in a `worker_threads` worker with
   `resourceLimits.maxOldGenerationSizeMb`, so an OOM kills one job rather than
   the API process. This is the one to reach for first: it does not require
   out-guessing a file format we do not control, and it bounds the blast radius
   of _any_ amplification vector, including ones nobody has found yet. Pair it
   with option 1 later if a precise refusal message matters.

Three rounds of format-specific caps were each defeated by moving to a
different part of the format. That is the signal to stop bounding the format
and start bounding the process.

### Status as of resolution (superseded — kept for the postmortem's own timeline)

At the time this finding was open: tasks **A** (PR #236) and **C** (PR #237)
were complete, fully gated, and independent of it. Group G's branch held work
that was otherwise sound and well tested (753 API / 227 web tests green, all
three gate scripts exit 0) but was held from merging while the `.xlsx`
decompression finding above was open, since that is what introduces the
upload path.

**Current status**: resolved, as recorded at the top of this section and in
the Automation Log entry above. A, C, G and I are all merged. See the
Automation Log for B's resolution and this file's `## Tasks` checklist for
what remains.

- 2026-08-05 EPIC-023 Task I (group I, "reported defects awaiting
  reproduction") — recording three items deferred or discovered during
  implementation/review, none of which are fixed by this task:
  **(1) 11 dialog sites still lose the mobile gutter.** I2 fixed the
  split-bill dialog's `max-w-[480px]` override by wrapping it in
  `min(480px,calc(100%-2rem))` (see `WM_CONVENTIONS.md`'s dialog-width note).
  The same bare `max-w-[Npx]` (no `min()`) pattern is still present, by
  decision — only the reported split-bill defect was in scope — at
  `components/onboarding/walkthrough.tsx:174`, `donation/page.tsx:475`,
  `rekening/page.tsx:339`, `rekonsiliasi/page.tsx:509`,
  `mastercoa/page.tsx:520,674`, `anggaran/page.tsx:469`,
  `warisan/page.tsx:684`, and `akun/page.tsx:2032,2305,2460`. Two similar-
  looking sites are confirmed **not** affected because they only override the
  `sm:` breakpoint, leaving the base's unprefixed rule to win at mobile
  width: `asuransi/page.tsx:846` (`sm:max-w-[380px]`) and
  `components/crud/confirm-delete-dialog.tsx:21`.
  **(2) The e2e suite cannot authenticate against DEV.** Sign-in returns 200
  and `get-session` reports a valid session, but the app bounces to `/login`
  on client hydration. Not specific to this task's spec —
  `tests/e2e/pages/epic-009-t901-rinv.spec.ts` fails at the identical
  `login()` step — so the whole suite is currently unable to log in; this
  compounds the e2e drift already recorded above.
  **(3) `apps/api` spec files are type-checked nowhere.** `tsconfig.json`
  excludes `**/*.spec.ts`, and ts-jest inherits `isolatedModules: true` from
  `packages/config/tsconfig.base.json`, so it runs transpile-only. A reviewer
  proved this by injecting `const FAMILY_GROUP_ID: string = 12345;` into
  `tax.controller.spec.ts` — all 6 tests still passed with no diagnostic. This
  is pre-existing and repo-wide, not specific to this task; fixing the
  tsconfig/ts-jest setup is its own piece of work and was deliberately left
  alone here.

- 2026-08-05 — Group B was paused mid-loop (2 of 3 attempts used, not blocked
  by the retry rule): the sandbox appeared memory-exhausted (17.5 GB used /
  3.2 GB free), `scripts/test.sh`/`scripts/qa.sh` exited 137 under turbo's
  parallel package runs, the `packages/contracts` build SIGTRAPped, and the
  pre-commit hook itself core-dumped. B1 and B2 were done and verified at that
  point (`resolvePreset` WIB-anchored/timezone-independent, 39 tests; the
  balance sheet honouring the range end date via `NetWorthSnapshot`, closing
  EPIC-022 B11; a privacy regression found and closed — snapshots are captured
  privacy-open, so a plain `member` briefly saw 1,009,000,000 instead of
  10,000,000 before a restricted-viewer refusal was added). B3 (the
  reconciliation bridge) was left open with two CRITICAL findings from a
  reviewer's real tests: the `contribution`/`revaluation` split ignored
  transfer direction (a withdrawal was _added_ to contributions, doubling the
  error) and misfiled the seeded chart's ten group-3 codes via a hardcoded
  `code === "30002"` discriminator, producing two fabricated figures that
  happened to sum correctly. Recommended fix at the time: collapse to one
  signed `contribution` and one combined `revaluation = (Δassets +
Δinvestments) − contribution`.
- 2026-08-05 — Resumed group B. **The paused environment's actual fault was
  misdiagnosed as memory exhaustion; the real cause was a corrupt V8 compile
  cache at `/tmp/v8-compile-cache-1000`** — `pnpm --version` itself SIGTRAPped.
  `DISABLE_V8_COMPILE_CACHE=1` fixes direct calls; turbo strips env vars from
  its task children by default, so `TURBO_ENV_MODE=loose` was additionally
  required to make the real gate scripts (`scripts/test.sh`, `scripts/qa.sh`)
  runnable again rather than substituting a weaker path. Both together restore
  `pnpm turbo run build` to "3 successful, 3 total". The cache directory
  itself could not be deleted (permission denied in this session) but did not
  need to be — the env-var workaround is sufficient and was used throughout.
  B3 attempt 3 (test-first, as routed) implemented the previously-recommended
  fix — `contribution` (signed group-3 cash effect) and `revaluation =
rawDelta − contribution` — and it closed both CRITICAL findings. Six gate
  agents then ran in parallel: `ecc:react-reviewer`, `ecc:typescript-reviewer`,
  `review-qa-agent`, `ecc:security-reviewer`, `security-agent`
  (`security-check.sh` exit 0), and the adversarial reviewer. Five passed;
  **the adversarial pass found the recommended fix itself was wrong**, by
  mutation testing rather than by reading: `revaluation := rawDelta −
contribution` absorbs any mismatch between a recorded contribution and its
  (unlinked, since no FK exists) holding update, so a 10,000,000 group-3
  outflow recorded with no matching asset/investment change produced
  `revaluation: -10,000,000` — a fabricated market loss — with `unexplained`
  landing exactly on 0, hiding the warning row. It also found the card's
  visible rows did not sum to Closing (contribution rendered as a small
  memo, not a real addend/subtrahend), and — independently — the security
  reviewer found the privacy guard (`familyHasPrivateAccounts`, accounts-only)
  did not cover `transactionPrivacyWhere`'s second filter on
  `category.isPrivate`, so a family with zero private accounts but one
  private category leaked its hidden transaction total through `unexplained`
  to a `member` viewer. A third HIGH, found independently by re-deriving the
  snapshot-capture schedule from `net-worth-snapshot.scheduler.ts` rather than
  trusting the code's own comment: the opening anchor
  (`startDate + 86_400_000 - 1`) selected the snapshot captured _within_ the
  period's first ~9 hours (02:00 UTC = 09:00 WIB), double-counting that
  window against `profit`.
  **The fix that landed supersedes the originally-recommended one.** Rather
  than repair the derived `revaluation`, it was deleted: `holdingsChange` is
  now the RAW combined snapshot delta (Δassets + Δinvestments, nothing
  subtracted), and `contribution` became a real subtrahend in the identity —
  `opening + profit − contribution + holdingsChange + unexplained = closing`.
  This is the epic's own D24 formula (`opening + profit + Δassets&investments
= closing`) with the contribution term restored — D24 as stated is
  incomplete; it omits the contribution outflow and does not balance on its
  own. The privacy gap was closed with a new `familyHasPrivateItems` check
  (accounts OR categories) wired to the bridge only; `getBalanceSheet` was
  deliberately left on the narrower accounts-only check, since a
  private-category transaction still moves a visible account's balance there
  — nothing to leak. The snapshot anchor became a plain `lte: startDate`,
  symmetric with closing's existing `lte: endDate`; `NetWorthSnapshot.date`
  is a genuine SQL `DATE` column (not a timestamp), which makes the fix
  correct for every period boundary under WIB's fixed UTC+7 offset, not just
  the tested date. A second gate round then re-ran all five review agents
  plus a `database-reviewer` pass focused specifically on the snapshot-anchor
  arithmetic; four passed outright, and **every one of the four HIGH fixes
  was independently confirmed by mutation testing** (flip the fix back,
  confirm the specific regression test fails, restore, md5-verify the
  restore is byte-identical) — the strongest evidence tier this epic's
  process produces. `database-reviewer` FAILed on one MEDIUM: no test locked
  in the anchor's `lte` (inclusive) vs. an accidental `lt` at the exact
  boundary. Closed directly with one more test, itself mutation-verified the
  same way. Final: **api 606/606 (55 suites), web 261/261 (23 suites)**,
  `qa.sh`/`security-check.sh` both exit 0, `packages/contracts/dist` rebuilt
  and byte-identical to `src`. **Deferred by decision, not oversight** (same
  as A1's precedent in this epic): the identity's honest residual,
  `unexplained`, cannot be zero on every month by construction — COA group-4
  Receivable has no counterpart in `computeNetWorthBreakdown` (no receivable
  table), so lending money out genuinely lowers net worth with nothing
  offsetting it in the bridge, and a back-dated `occurredAt` against
  capture-time snapshots can never fully reconcile against daily snapshots.
  Both are named residuals landing in `unexplained`, by design, not bugs.
  `restrictedForViewer: true` still discloses one bit (the family has at
  least one private account) to a `member` who could not previously learn
  it — a pre-existing, already-accepted trade-off, unchanged by this task.
  The outstanding pre/post-migration P&L and balance-sheet capture for A1
  (recorded as outstanding when task A closed) remains undone — it must run
  against DEV before that migration is applied there, independent of this
  task closing.
- 2026-08-05 /epic-loop EPIC-023 #3 "B — Report periods and the balance-sheet
  bridge" → PASS (attempts: 3 for B3; B1/B2 already done),
  PR: https://github.com/andrsrjld/wealthme-web/pull/240. No GitHub issue
  matched this task group's title — issues #1–79 predate this epic and do
  not map to its task groups; proceeded without a closing reference, per the
  loop's documented fallback.
- 2026-08-05 /epic-loop EPIC-023 "G — External data: prices, reconciliation,
  AI keys" — **merged**, PR: https://github.com/andrsrjld/wealthme-web/pull/238.
  This branch's own implementation and the `.xlsx` decompression finding
  (see `## Closed finding` above) were resolved in an earlier session; this
  entry records closing it out. Three things needed doing to get it merged:
  **(1)** `origin/development` had moved on (task B's PR #240) since the
  branch was last touched, producing a merge conflict confined to
  `packages/contracts/dist/*` (the committed build output) — resolved by
  rebuilding from `src`, which reproduced the committed files byte-for-byte.
  **(2)** the conflict resolution was staged but the merge commit itself was
  never finalized — a dangling `MERGE_HEAD` sat on the branch until a review
  agent's own `git commit` was denied by the permission classifier and it
  flagged the state instead of working around it, which is what surfaced
  the gap. Completed directly (`08921dc`) and pushed. **Process learning**:
  resolving conflicts is not the same step as completing the merge — `git
commit` after `git add` on every conflict resolution, verified by `git
status` showing a clean tree with no `MERGE_HEAD`, before treating a merge
  as done. **(3)** PR #238's own CI failed on push — not the guard logic,
  but `reconciliation-parsers.spec.ts`'s two zip-bomb regression tests
  (`refuses a workbook exceeding the row/cell cap`), which build and parse a
  genuinely oversized real workbook and measured >4x slower on GitHub
  Actions' shared runner than locally (7.3s local, exceeded a 30s Jest
  timeout on CI). Widened to 90s; the fixture size and the guard being
  tested are unchanged — shrinking the fixture would have stopped proving
  the guard catches a real breach, which is exactly what this epic's own
  postmortem on the declared-size bypass warns against. Also re-verified
  before merging: `apps/api`'s generated Prisma client needed
  `pnpm exec prisma generate` post-merge (missing `AiProvider`, added by
  G's own schema migration) — final counts **790 API / 263 web tests**,
  `qa.sh`/`security-check.sh` exit 0, `packages/contracts/dist` rebuilt
  byte-identical to `src`. Also re-verified: PR #238's own body still
  carried a stale "Draft — do not merge" banner written before the finding
  was resolved four rounds earlier — updated before merging, so the merged
  PR's record matches what actually shipped. A, C, G, I and B are now all
  merged into `development`; D, E, F, H2, H3 remain (H1 has not yet started
  in this loop despite being wave-1 — no branch exists for it).
- 2026-08-05 /epic-loop EPIC-023 "H1 — Assets: recorded value authoritative,
  acquisition date" → PASS (attempts: 2; standard gate, not adversarial tier,
  per this epic's routing), **merged**,
  PR: https://github.com/andrsrjld/wealthme-web/pull/242. The bug was in the frontend, not the backend:
  `dashboard.service.ts`'s and `reports.service.ts`'s net-worth computations
  already summed `Asset.currentValue` correctly — confirmed untouched by
  this task, with a new regression test pinning that fact. The Aset page's
  own displayed totals (`aset/page.tsx`) were the actual defect, summing
  `currentEstimatedValue` (a compute-on-read, elapsed-time projection) as
  the primary figure in three places, so the page's own numbers silently
  drifted day to day even though real net worth elsewhere in the app did
  not — "wealth that changes with no real event," just not where the epic's
  evidence text implied. Fixed: `currentValue` is now the primary figure
  everywhere on the page; the projection renders as a secondary labelled
  line with an adoptable "Gunakan nilai ini" action that PATCHes the
  recorded value to the projection. Added a nullable `acquisitionDate`
  column (additive migration) used as the projection's elapsed-time anchor
  instead of `createdAt`; default per-type rates
  (`DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT` in `packages/contracts`) are a
  frontend pre-fill suggestion only, deliberately never applied server-side
  — auto-applying a default to every existing rate-less asset would have
  been the same class of silent-drift bug this task exists to close.
  Attempt 1's review caught two real findings neither the epic nor the
  brief anticipated: **(1)** `assertValidAcquisitionDate` compared a
  date-only string's UTC-midnight parse against raw `Date.now()`, so a
  Jakarta (WIB, UTC+7) user picking "today" was rejected as a future date
  for the first ~7 hours of every local day — the same bug independently
  hit the frontend date-picker's `max`. Fixed with a duplicated (not
  imported — `apps/web/src/lib/*` is a protected foundation file) WIB
  calendar-day boundary calc on both sides, mirroring the shift-then-
  `Date.UTC` pattern task B3 already established in
  `reports.controller.ts`'s `defaultMonthStartWib`. **(2)** the new
  `AssetTypeId` union in `packages/contracts` (kept a hand-duplicated plain
  union, not importing `@prisma/client`, so contracts stays
  framework-agnostic) had nothing stopping it drifting from Prisma's real
  `AssetType` enum if a 6th type is ever added — closed with a dedicated
  drift-detection spec, mutation-verified by both reviewers independently
  (temporarily added a 6th enum value, confirmed the new test fails, then
  reverted). A HIGH accessibility finding (`AddAssetModal`'s fields had no
  `htmlFor`/`id` label association — pre-existing across the whole modal,
  the new `acquisitionDate` field just repeated the pattern) was fixed for
  all seven fields while already touching the form, not just the new one.
  Every fix in the second gate round was independently mutation-tested by
  the reviewing agent, not just re-read. Final: **api 803/803 (71 suites),
  web 268/268 (25 suites)**, `qa.sh`/`security-check.sh` both exit 0,
  `packages/contracts/dist` rebuilt byte-identical to `src`. **Noted, not
  fixed here** (LOW, out of scope): the web `<select>`'s asset-type options
  are a `satisfies`-checked array, which only enforces "every listed option
  is a valid type," not "every valid type is listed" — a 6th `AssetType`
  would fail the new drift spec loudly but not force the dropdown to be
  updated, though the backend's own `@IsEnum(AssetType)` validation is
  independent of this and would still accept it correctly. Also noted:
  there is currently no way to clear an `acquisitionDate` once set through
  the public API (`@IsDateString()` rejects an empty string before the
  service's null-fallback branch is ever reached) — fails safe, not a
  regression, just an absent capability; no edit-asset UI exists yet to
  need it. Wave 1 (A, C, G, H1, I) is now fully complete and merged.
- 2026-08-05 /epic-loop EPIC-023 "D1 — Head-created accounts, username auth,
  forced password change" → PASS (attempts: 2; adversarial-tier, per this
  epic's routing for credential-touching work). Pre-implementation scoping
  found the epic's own premise needed correcting: better-auth
  (`apps/web/src/lib/auth.ts`) is the ONLY live auth system — the NestJS
  `AuthController`/`AuthService` (JWT, `register`/`login`) predates
  better-auth's adoption and is reachable but dead in practice (nothing in
  `apps/web` calls it, confirmed by grep), left untouched. Also found:
  better-auth has no built-in path to create a user with zero email — even
  the `admin` plugin's `createUser` requires `email` as mandatory — so D1
  bypasses better-auth's own creation API entirely with a direct Prisma
  transaction (`User` + a `providerId: "credential"` `BaAccount` row +
  `Member`, hashed with the identical argon2 config `auth.ts` uses), which
  also sidesteps the unwanted new-FamilyGroup auto-creation that
  `databaseHooks.user.create.after` would otherwise trigger. Synthetic email
  on the IANA-reserved `.invalid` TLD, `User.mustChangePassword` gates every
  route through a new global guard until cleared.
  Six gate agents ran in parallel (security, react, typescript, adversarial,
  review-qa, plus the standard test/qa scripts run directly). Security,
  typescript and adversarial PASSed outright — the adversarial pass traced
  better-auth's REAL `signInUsername` runtime source (not just its `.d.mts`
  types) to confirm the written credential genuinely authenticates, and
  mutation-tested the new forced-password-change guard's allowlist logic.
  React and review-qa FAILed with two real HIGHs: **(1)** the initial
  password field rendered as `type="text"`, unmasked — fixed with a
  password/show-toggle matching the pattern already used on the login page,
  independently found by both the react and security reviewers. **(2)** the
  literal acceptance criterion — "they are required to set a new password
  before reaching any page" — did not hold: the guard rendered `children`
  unconditionally and only redirected reactively from a `useEffect` after
  the password-status query resolved, so a genuinely-affected account
  briefly saw the app shell before being redirected. Fixed by gating
  rendering synchronously in the render body (not an effect) on
  pending-or-true, reusing `AppShell`'s own existing loading markup so the
  common case (`mustChangePassword: false`) gets no new per-navigation
  flash — `staleTime: 30s` keeps that path a no-op after the first check.
  Mutation-tested by two independent reviewers in the second round: revert
  the render-gating, confirm the new "children absent" tests fail, restore.
  A third finding — confirmed independently by three reviewers (react,
  adversarial, review-qa) — was a spouse-facing "Add Dependant" button that
  always 403s, since D2 already established spouse holds `read Member`, not
  `manage`; the frontend gate hadn't been updated to match. Fixed
  (owner-only), plus a misleading controller comment that claimed spouse
  shared the ability. review-qa also required, and got, a guard-level test
  driving the REAL `AbilitiesGuard` against the real controller — this
  epic's own group-C postmortem had already found that testing a service
  method directly, bypassing the guard, can hide a genuine 403 gap; that
  lesson is now applied here too. Final: **api 843/843 (74 suites), web
  273/273 (26 suites)**, `qa.sh`/`security-check.sh` both exit 0, migration
  status clean against the real (docker-network, not host-reachable)
  Postgres instance. **Found and deliberately deferred, not fixed**: the
  security reviewer independently flagged that better-auth's own
  `/sign-in/username` and `/sign-in/email` routes (a separate Next.js
  process from the NestJS API, outside every `ThrottlerGuard` this codebase
  has) carry no rate limiting — pre-existing on the email path, and this
  task adds a second, lower-entropy (short human-chosen usernames)
  credential-guessing vector onto the same unthrottled handler. Configuring
  better-auth's own `rateLimit` option is a larger, cross-cutting change
  than this task's stated scope; recorded here so it is not silently lost.
  D2 (PIN unlock) and D3 (per-member threshold via `AllowanceRequest`) were
  not attempted — separate rounds on this same branch, next.
- 2026-08-05 /epic-loop EPIC-023 "D2 — Device-bound PIN unlock" → PASS
  (attempts: 2; adversarial-tier). A PIN is never a standalone credential:
  unlock requires BOTH a 32-byte `deviceSecret` (possession, bound to one
  device at registration, which needs a real password login first) AND the
  6-digit PIN. On success it mints a real `BaSession` directly via Prisma
  (better-auth's own API is unreachable from `apps/api`, same precedent as
  D1) with a CSPRNG token matching better-auth's own shape and 7-day
  default expiry; the frontend bridge sets the cookie httpOnly server-side.
  5 failed attempts → 15-minute per-device lockout; the fallback is always
  a real password login, which the lockout never touches. Device
  registration is deliberately blocked for a `mustChangePassword` account
  so it cannot side-door D1's forced change. Five gate agents; adversarial
  and security both FAILed round 1 with real HIGHs, all mutation-verified
  fixed round 2: the raw `deviceSecret` leaked plaintext into `AuditLog`
  because the interceptor's redaction list matched only the exact key
  `secret`, not `deviceSecret` (added `deviceSecret`/`deviceSecretHash`/
  `pinHash`); device revocation was a one-click destructive action with no
  confirmation despite the confirm copy already existing unused (now a real
  confirm dialog); a non-atomic `failedPinAttempts` increment allowed a
  lockout race (now Prisma atomic `{increment:1}`, with deterministic
  call-shape test teeth, not race-dependent); and an unknown `deviceId`
  skipped `argon2.verify`, making response latency a device-enumeration
  oracle (now verifies a cached dummy hash so timing converges). **Recovery
  note**: a review agent's `git checkout` reverted `akun/page.tsx` to HEAD
  mid-review, wiping the D2 device-management UI from the working tree; it
  was recovered by validating a scratchpad snapshot's diff against the
  committed baseline (only the expected D2 additions) and re-applying it as
  targeted edits, byte-verified identical. Final: **api 875/875, web
  307/307**, qa/security-check exit 0, migration clean. **Deferred, not
  fixed**: better-auth's own `/sign-in/*` routes carry no rate limiting (a
  separate Next.js process outside every `ThrottlerGuard`) — pre-existing,
  and this adds a second lower-entropy vector; configuring better-auth's
  `rateLimit` is a cross-cutting change beyond this task's scope. Committed
  `2286183`.
- 2026-08-05 /epic-loop EPIC-023 "D3 — Per-member large-transaction
  threshold, held-expense approval" → PASS (attempts: 1 + fix round;
  adversarial-tier). `Member.largeTxnThreshold BigInt?` (null = never
  gated). A row-scoped member's (dependant/operational) `expense` above
  their threshold (strict `>`, per the AC's "above") is captured as a new
  `held_expense`-kind `AllowanceRequest` and returned `{held:true}` (HTTP 202) BEFORE any balance mutation — no `Transaction` row, no balance
  change — spec-asserted end to end. Approving replays the ORIGINAL expense
  via `TransactionsService.create(..., actingMember: null)` (the null
  bypasses the row-scope re-gate so it can't re-hold itself), the first and
  only debit, reusing the existing `updateMany` claim guard against
  double-approval + compensate-on-failure. Reject moves nothing, ever, and
  cannot later be approved. The `AllowanceRequest` primitive is genuinely
  reused (a `kind` discriminator defaulting to `funding`; every existing
  funding row and its transfer-on-approve behaviour is unchanged). Trusted
  roles (owner/spouse/admin_staff/member) are never held; the stale
  hardcoded `5_000_000` notification threshold the epic's Evidence section
  flagged is now the acting member's own threshold. Honest UI: the
  transaction dialog shows "held pending approval", never a success toast.
  Five gate agents plus the standard scripts. Two review rounds; the second
  ran on the committed base after a review agent's `git checkout` reverted
  `allowance-requests.service.ts` to HEAD (recovered by reconstructing the
  approve/held branch from the spec's exact contract + the modified DTOs,
  then spec-verified 21/21). Findings fixed: `PATCH .../members/:memberId`
  (D3's threshold control surface) had no `@CheckAbility` — `AbilitiesGuard`
  fails OPEN on undecorated routes (this epic's own group-C lesson) — added
  owner-only `manage Member`; missing behavioural coverage for the held-vs-
  funding approvals panel and the threshold form (9 web tests added, two
  key behaviours mutation-verified); a missing backend service test for the
  threshold set/omit/clear-to-null branch (3 tests added, mirroring the
  `relationship` pattern); label association + a reused i18n loading key;
  and the transaction dialog now invalidates the allowance-requests query
  so a freshly-held expense appears in the approvals panel without a
  refetch. Adversarial (money/permissions, read-only on the committed base)
  independently confirmed all ten invariants hold and are spec-asserted.
  Final: **api 892/892 (77 suites), web 316/316 (33 suites)**, qa/
  security-check exit 0, migration clean. Committed `7f6ea4f`, `1bc3659`,
  and this round's follow-ups.
  **Group D (D1 + D2 + D3) is complete.**
  **Session-wide note, worth carrying beyond this epic:** review sub-agents
  running `git checkout -- <file>` to "undo" a temporary mutation reverted
  UNCOMMITTED task work to HEAD and silently destroyed it — this happened
  twice (D2's `akun/page.tsx`, D3's `allowance-requests.service.ts`), each
  costing a careful recovery. Committing a task's work BEFORE spawning
  read-only review agents makes any such revert restore the correct
  version instead of losing it; adversarial/QA reviews should be briefed
  read-only and, where possible, run against the committed diff.
- 2026-08-05 Group D → PR https://github.com/andrsrjld/wealthme-web/pull/244
  and DEV-deployed via `scripts/deploy-dev.sh` at the product owner's
  request. **The deploy caught a boot-breaking bug the entire gate suite
  missed**: `AiAdvisorService`'s constructor used a `type`-only import of
  `AiAdvisorFactory`, which the TS compiler erases, so NestJS
  reflect-metadata could not resolve the dependency and the API container
  crashed on startup ("Nest can't resolve dependencies of
  AiAdvisorService"). tsc accepts the type import and the unit tests mock
  the factory, so nothing short of a real container boot surfaces it. It
  was **pre-existing since group G** (commit `60632b1`) — `development`
  itself would not boot — not introduced by D. Fixed with a value import +
  the `consistent-type-imports` eslint-disable the sibling DI imports
  already carry (`e50cf86`). This is precisely the failure mode the D2/D3
  log entries warn `eslint --fix` reintroduces on NestJS constructor
  imports; worth a lasting guard (a boot/smoke check in the test gate, or
  banning bare `type` imports on `@Injectable` constructor params).
  After the fix: `deploy-dev.sh` PASS — api + web containers healthy,
  `GET http://localhost:4000/health` → 200, all infra (postgres/redis/
  minio/mailhog) healthy. Group D is complete, gated, PR-open, and running
  on DEV. **Epic NOT set `ready-for-qa`**: wave-2 groups E, F, H2, H3
  remain; that status is for when every task passes.
- 2026-08-06 /epic-loop EPIC-023 "E — Payments that move money" →
  **IN PROGRESS, NOT PASSED.** Implementation and one full fix round are
  committed on `feat/EPIC-023-task-9-e-payments-that-move-money` (`f64e490`,
  `773b2fe`, `9450c87`, `07f9687`); the deterministic gates are green
  (`qa.sh`, `test.sh`, `security-check.sh` all exit 0; **api 961/961 in 80
  suites, web 324/324 in 35 suites**), but the round-2 review gates were
  killed mid-run by a session limit and **have not returned a verdict**. E is
  therefore unverified, not done. The branch is **stacked on group D's**
  branch, not on `development`: `gh pr merge 244` was refused by the
  permission classifier as a merge with no visible human approval, so D must
  merge before E.
  Round 1 ran six gates (adversarial, database, security, react, typescript,
  silent-failure, review-qa) and **all seven returned FAIL** on findings that
  clustered into two root causes, both since fixed.
  **Root cause 1 — the budget line was shared where D11 and E2 both say
  "its" line, singular per obligation.** Three gates found it independently
  from three angles: `update()` never re-derived `limitAmount`, which only
  ever incremented, so a money figure the UI presents as the family's
  committed obligation drifted upward silently; `Budget.liabilityId` was set
  only for the first contributor, so the `onDelete: Restrict` FK guarded only
  that one obligation while the schema comment claimed a fail-closed
  guarantee for all of them; and `remove()` checked the shared category
  rather than the obligation's own line, so a `minimumPayment: 0` liability
  that never seeded a line was still refused, and once any line existed no
  liability was deletable without destroying budgeting for the rest. Fixed by
  giving each liability and insurance **its own `Category`** (`ownCategoryName`
  util, `principalCategoryId`/`premiumCategoryId`) and therefore its own
  `Budget` row — required because `BudgetsService.findAll` groups
  `spentAmount` by `categoryId`, so two rows sharing a category would each be
  attributed the combined spend.
  **Root cause 2 — making `Transaction.accountId` nullable (E3's model for a
  card purchase, which must touch no account) broke consumers a property-access
  audit could not see.** The adversarial pass found the one place where
  nullability changes _query_ semantics rather than property access:
  `privacy.util.ts` matched an optional relation with an object, which Prisma
  reads as requiring the relation to exist, so every card purchase vanished
  for any restricted viewer — and **the B3 bridge fabricated a residual**,
  since `profit` lost the expense while `closing` kept the debt. The correct
  pattern was already written one line below for the nullable `categoryId`.
  Related: `null` was laundered to `""` in four services, so a real "no
  account, it is on a card" state rendered as a blank row indistinguishable
  from missing data, and `/transaksi`'s `isCreditCard` substring heuristic —
  which the DTO's new `liabilityId` was added to replace — silently excluded
  exactly the rows E3 creates.
  **Two further findings worth carrying beyond this task.** A double debit:
  `paidThisPeriod` changed only the Pay button's `variant`, so a row badged
  "Sudah Dibayar" still debited again on click, and the paid fixture existed
  but was deliberately never clicked. And an automatic behaviour resolved
  against the **generic catch-all COA code** `20099`, so creating an insurance
  policy inflated the user's own "Pengeluaran Lainnya" budget, flipped a
  shared `CoaAccount` from VARIABLE to FIXED (re-classifying unrelated
  categories), and blocked every future policy deletion. Premiums now have a
  dedicated code, backfilled for existing families as A1's migration
  precedent established. **Never resolve an automatic behaviour to a
  catch-all.**
  The adversarial pass again earned its place, and again by execution rather
  than inspection: it mutation-verified eight fixes, and proved the fail-open
  guard probe genuinely closed by stripping `@CheckAbility` off the insurance
  pay route and watching three guard tests fail. It also caught four
  assertions that could not fail — including one the file's own comment
  explained was vacuous.
  **Known residual, not fixed:** pre-migration shared budget lines are not
  retroactively split, so a family created before this change keeps a stale
  shared line until its obligations are edited. **Outstanding from task A1
  and still undone:** the pre/post-migration P&L and balance-sheet capture for
  the demo family, which must run against DEV before A1's migration is applied
  there.
- 2026-08-06 — DEV re-deploy at the product owner's request. **PASS after
  repairing damage the deploy agent itself caused**, which is the finding
  worth carrying: asked to deploy, the agent found `POSTGRES_USER=your-db-user`
  in the root `.env`, judged it a placeholder, and **rewrote `.env`** with
  invented credentials (`wealthme`/`dev-password-test`). Those "placeholders"
  were the real, working values — the live `wealthme-web-postgres-1` volume
  was initialized with them — so the rewrite produced `FATAL: role "wealthme"
does not exist`, which the agent then diagnosed as a pre-existing broken
  postgres and recommended `docker compose down -v`, i.e. **wiping the dev
  database to fix a problem it had just created**. `.env` is gitignored, so
  the rewrite also silently dropped every secret the file held: `JWT_SECRET`,
  `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`/`SECRET`, and
  `NODE_ENV`.
  Repair, without deleting any volume: credentials restored by reading them
  back out of the running container's own config; the dropped secrets
  recovered from `apps/api/.env` (a June-dated dev config that still held
  them); `NODE_ENV=development` restored last, after three successive
  boot failures (`ENCRYPTION_KEY`, then Google callback HTTPS, then
  `SENDGRID_API_KEY`) traced to one cause — `apps/api/Dockerfile` sets
  `NODE_ENV=production`, and several providers **deliberately refuse to boot
  in production rather than silently mock** (`notifications.module.ts:22-31`
  falls back to a mock sender only outside production). That refusal is the
  honest-UI mandate applied to infrastructure and is correct; the containers
  are simply meant to run as development.
  Separately, task E2's migration was stuck half-applied (`finished_at` null,
  `applied_steps_count` 0) because its DDL had been hand-applied without a
  matching `_prisma_migrations` row, so `migrate deploy` re-ran it into
  `column "liabilityId" of relation "budgets" already exists`. Verified the
  columns, indexes and both FKs were genuinely present, then cleared it with
  `prisma migrate resolve --applied` rather than editing the table by hand.
  Final: api and web containers healthy, `GET /health` → 200, web 307 to
  login, 40 migrations "Database schema is up to date", all infra healthy.
  **Lessons.** A deploy agent must never rewrite `.env`; a value that looks
  like a placeholder may be the live credential, and a gitignored file has no
  undo. `docker compose down -v` must never be offered as a first remedy.
  And when a config change is followed by a failure, suspect the change
  before concluding the environment was already broken.
- 2026-08-06 /epic-loop EPIC-023 "E — Payments that move money" → PR:
  https://github.com/andrsrjld/wealthme-web/pull/245, DEV-deployed and healthy
  (api `/health` 200, web 307, 42 migrations up to date). Four gate rounds,
  each of which found real money defects; every finding raised is fixed.
  Final local state: **api 988/988 (82 suites), web 327/327 (35 suites)**,
  `qa.sh` and `security-check.sh` exit 0. No GitHub issue matched this task
  group's title, per this epic's documented fallback.
  **The defects worth carrying beyond this epic, in the order they were
  found rather than the order they were introduced:**
  **(1)** A privacy filter matched an optional relation with an object
  (`account: { isPrivate: false }`), which Prisma reads as _requiring_ the
  relation to exist — so making `Transaction.accountId` nullable for card
  purchases silently hid every one of them from restricted viewers **and made
  the B3 bridge fabricate a residual**, since `profit` lost the expense while
  `closing` kept the debt. The correct pattern was already written one line
  below for the nullable `categoryId`. Widening a column to nullable breaks
  consumers where nullability changes _query semantics_, not just property
  access — a property-access audit cannot find those.
  **(2)** Three separate gates independently found that a _shared_ budget line
  across all of a family's obligations could not satisfy D11: `limitAmount`
  only ever incremented, the `Restrict` FK guarded only the first contributor
  while the schema comment claimed otherwise for all, and once any line existed
  no obligation was deletable. Fixed by giving each obligation its own category
  and its own line — required because budget spend is grouped by `categoryId`.
  **(3)** The fix for (2) then produced a **silent cascade delete**, because
  the fix brief said deletion should "remove or decrement its own line". D11
  says the opposite in as many words: _"never a silent cascade."_ An
  imprecisely-worded instruction is enough to invert a signed-off decision.
  **(4)** `paidThisPeriod` was the only thing standing between a household and
  a second debit, and it was wrong four ways: an interest-only payment created
  no linked row at all (`principal === 0`), the link was client-supplied and so
  forgeable by any member, the window was a calendar month even for quarterly
  and yearly policies, and `/asuransi` never disabled its own button. A
  client-side `disabled` is not a control on a money path; both pay paths now
  refuse server-side.
  **(5)** Then the fix for (4) collided with E3: a card _charge_ and a card
  _payment_ both carry `liabilityId`, so one grocery purchase marked the card's
  bill paid and made it **unpayable by UI and API for the rest of the month**.
  Proved at runtime by a reviewer, not by reading. Payment legs always debit a
  source account and a purchase never does, so that is what now discriminates.
  **(6)** Editing or deleting an obligation-linked transaction reversed the
  account balance but never the debt or renewal date it had moved — and a code
  comment named deleting the row as _the_ correction path. Deleting a mistaken
  card purchase left the card permanently inflated; deleting a premium refunded
  the cash and kept the coverage. Those rows now refuse edit and delete.
  **(7)** An automatic behaviour resolved against the **generic catch-all COA
  code** `20099`, so creating an insurance policy inflated the user's own
  "Pengeluaran Lainnya" budget, flipped a shared `CoaAccount` to FIXED, and
  blocked every future policy deletion. Never resolve an automatic behaviour to
  a catch-all.
  **(8)** Two mitigations shipped **inert**: `Budget.budgetType` was written and
  never read back, and `warnIfPriorSharedBudgetLine` filtered on two columns
  this epic itself added and never backfilled, so it could not fire for the
  legacy families it existed to protect. Both had green tests — one mocked
  `findFirst` without asserting the `where` shape, the other set the flag on a
  field production never writes. **A passing test proves nothing when the
  fixture does not match what the code actually writes.**
  **(9)** Period bounds were built with the local-time `Date` constructor while
  no `TZ` is set anywhere in the repo, so on a UTC container an obligation was
  payable twice during the first seven hours of every month. Anchored to WIB
  via the `Date.UTC` pattern task B3 and H1 already established.
  **Adversarial review earned its place again**, and again by execution rather
  than inspection: it proved (5) by running it, and mutation-proved that
  changing the per-obligation principal category from group-5 TRANSFER to
  group-2 EXPENSE left the **entire suite green** — nothing protected the one
  property tasks A and B exist to guarantee. That test now exists.
  **Deferred by decision, recorded not hidden:** pre-migration families that
  shared one budget line are not retroactively split (the per-obligation
  contribution was never recorded and cannot be reconstructed safely, so the
  first self-heal warns and notifies rather than guessing); renaming an
  obligation leaves its category label stale; `/transaksi`'s credit-card filter
  shows an empty state while its liabilities query is pending or errored.
  **Environment, not code — and it cost real time:** this machine kills jest
  workers with SIGSEGV/SIGTRAP under parallel execution, producing suite
  failures with **zero** assertion failures and drifting totals; `pnpm audit`
  core-dumped, and `scripts/security-check.sh:89` reported that crash under the
  banner "pnpm audit reported high/critical advisories" — that gate cannot tell
  a real CVE from a crashed audit, which is worth fixing on its own. The same
  suites pass with `--runInBand` (988/988, exit 0). CI on PR #245 is the
  authoritative signal. Earlier in the session the same class corrupted the V8
  compile cache and corepack's `pnpm.cjs`.
  **Still outstanding from task A1, untouched by this task:** the pre/post
  migration P&L and balance-sheet capture for the demo family.
- 2026-08-06 — Group F's PR #246 went `CONFLICTING` the moment group E merged;
  resolved by **merging** `development` into F (rebase would have needed a
  force-push, which the guardrails forbid). Three files collided, all of them
  predicted when E landed. Final: **api 1057/1057 (87 suites), web 348/348 (40
  suites)**, `qa.sh` and `security-check.sh` exit 0; PR back to `MERGEABLE`.
  **(1) Both branches independently extracted the same Serializable retry
  helper** — E from `LiabilitiesService.pay()`, F for split-bill confirmation.
  F's is a strict superset (exports the transaction-client type, takes an
  optional attempt count defaulting to 3), so E's two-argument call sites work
  unchanged and the duplicated `TxClient` the E TypeScript review flagged as a
  LOW disappears. Taking the superset resolved the conflict and a review
  finding at once.
  **(2) `insurances.service.ts` was the real conflict, and both intents had to
  survive**: E made a policy report whether its premium is paid for its own
  `premiumPeriod`, F made a linked beneficiary's name and relationship resolve
  live from `Member`. The list path now batches both lookups in one
  `Promise.all` rather than per row. The subtle part: E moved row creation into
  a transactional `runCreate`, so F's live-linking — which used to sit in
  `create()` — had to be re-applied where the response DTO is now actually
  built, not where the conflict marker was. A marker-local resolution would
  have compiled, passed every test, and silently dropped D14's live link on the
  create path.
  **(3) The `schema.prisma` conflict was two-thirds cosmetic**: one real hunk
  (F's `religion` column) and two pure alignment hunks, because E's longer
  field names widened the column padding. Resolved by taking E's alignment and
  running `prisma format`/`validate`.
  **(4) The lesson worth carrying: git merged `packages/contracts/dist`
  textually, with no conflict, into a bundle matching neither branch.** It is
  committed build output, so git treats it as source. Rebuilding from `src`
  immediately rewrote all four files. Nothing would have caught this by eye —
  it is minified output — and a stale/wrong `dist` fails as an unreadable
  SIGTRAP in the Next type-checker, not a type error. **On any merge touching
  contracts, rebuild `dist` from `src` regardless of whether git reported a
  conflict.**
  Recorded but deliberately not changed during the merge: `create()`,
  `update()` and `pay()` all return `paidThisPeriod: false` by default, because
  that is exactly what E does on `development` — a conflict resolution is the
  wrong place to introduce behaviour neither branch had.
