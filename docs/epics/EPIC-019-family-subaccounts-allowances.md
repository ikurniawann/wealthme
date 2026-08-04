# EPIC-019: Family Sub-Accounts & Role-Scoped Allowances

status: on-progress
environment: dev
retries: 0
phase: 4
priority: P1
area: Full-stack
source: User request 2026-07-24 (item #2 — "akun bank anak/pembantu/supir dapat saldo & anggaran dari akun ayah")

## Goal

Give a family **owner** (ayah) real control over each member's and staff's money
inside one family group:

1. **Per-member linked accounts.** A child (anak), maid (pembantu), and driver
   (supir) each have their own bank account that is **owned by their own
   WealthMe login** — not just a shared family account. Today every `Account`
   is scoped only by `familyGroupId`, so it belongs to the whole family with no
   per-person owner (`schema.prisma:305-325`); there is no way to say "this is
   anak's account."
2. **Funded from the owner's master account.** The owner allocates money from
   the family master account into a member's account ("dapat saldo dari akun
   ayah"). Staff can request an allowance ("pembantu minta anggaran belanja",
   "supir minta anggaran operasional") that the owner grants.
3. **Constrained by role.** A maid's account is limited to shopping
   (`belanja`) spending; a driver's to operational (`operasional`) spending.
   Today `Role` is only `owner | member | admin_staff` (`schema.prisma:12-16`)
   and roles differ **only** in CASL permissions with zero per-category or
   per-member spending constraint.

This is the user's stated #1 vision for the app and the largest single build in
the current backlog. It **supersedes EPIC-018 Task B** ("per-member pockets"),
which specified the same nullable `ownerUserId` foundation but not the funding
or role-constraint layers — build the ownership foundation **here** to avoid
double-work, and treat EPIC-018 Decision #1 as resolved toward "build."

Every task group is additive and backward-compatible: existing null-owner,
unconstrained family accounts keep behaving exactly as they do today.

## Evidence

Verified against the current tree, 2026-07-24:

- **No per-member account owner exists.** `Account` (`schema.prisma:305-325`) is
  scoped only by `familyGroupId`; the only member-facing flag is `isPrivate`
  (`:316`), a hide toggle from EPIC-016 B4 — a private account is still a
  _family_ account, not a member-owned one. Confirmed: no `ownerUserId` /
  `createdByUserId` column on any financial model.
- **Members already exist as first-class rows.** `Member` (`schema.prisma:291-303`)
  links `userId` ↔ `familyGroupId` with a `Role`, and `Invitation`
  (`:275-289`) already invites people into a family group by email + role. So
  "anak/pembantu/supir logs into their own WealthMe" is already possible — what
  is missing is owning/constraining their money.
- **Roles carry no money semantics.** `Role` (`schema.prisma:12-16`) is
  `owner | member | admin_staff`; there is no `pembantu` vs `supir` distinction
  and no mechanism binding a role (or member) to an allowed category set.
- **Transfers exist as a transaction type but not as an owner→member funding
  flow.** `TransactionType.transfer` (`schema.prisma:31-35`) exists;
  there is no request/approve/allowance model, no allocation from a master
  account to a member account.
- **EPIC-018 already flagged this fork.** `EPIC-018` Task B + Open Design
  Decision #1 (`docs/epics/EPIC-018-member-model-i18n-responsive.md:105-122,
146-156`) specify the nullable `ownerUserId` foundation and mark the
  member-model choice as "PIVOTAL — must be made first." This epic is where
  that decision lands.

## Tasks

- [x] ### A — Per-member account ownership + member-login linking
  - Schema: add a **nullable** `ownerUserId` FK to `Account`
    (`schema.prisma:305-325`), tenant-scoped within the family group; nullable
    so existing rows stay "family-shared." Additive migration only (no drops,
    no failing non-null backfill). This is the EPIC-018 Task B foundation.
  - Reads: account/transaction/report/dashboard queries gain a **"mine vs
    family"** lens; a member sees their own owned account(s) plus shared
    family data per the existing owner/admin_staff/member CASL rules.
  - Writes: the owner can assign/reassign an account's `ownerUserId` to any
    member of the same family group (validated against `Member`); reject
    cross-tenant / non-member user ids.
  - UI: on `/akun`, an owner can **link a bank account to a family member**
    (anak/pembantu/supir) and a member sees their linked account under a
    "Milik saya" view. Preserve full backward compatibility for null-owner data.

- [x] ### B — Owner → member funding (allowance)
  - **Gated on Open Design Decision #1 and #2.**
  - Let the owner allocate money from the master account into a member's
    account, and let a member/staff **request** an allowance the owner grants.
  - Model per Decision #1: either a real balance-moving **transfer ledger**
    (member's `balance` actually increases, money leaves the master account) or
    a non-moving **allowance/budget cap** (a periodic spending ceiling, no
    balance movement). Per Decision #2: owner-push only, or member-request →
    owner-approve (adds a request model + a notification to the owner, reusing
    the existing `Notification` model).
  - Surface allocation/allowance history and remaining balance/allowance to
    both the owner and the member.

- [x] ### C — Role-scoped category constraints
  - **Gated on Open Design Decision #3.**
  - Constrain a member/staff account to a specific spending category set:
    pembantu → `belanja`, supir → `operasional`. Enforce on **both** the
    allowance/spend path and the transaction-create path (server-side, not just
    UI), so a constrained member cannot record spending outside their allowed
    categories.
  - Mechanism per Decision #3: a per-member category **allow-list** (flexible,
    additive) or an extended role taxonomy. Enforcement must be tenant- and
    member-scoped and covered by CASL.

- [x] ### D — Member / staff view
  - A constrained member/staff sees, on login: their linked account, current
    balance/allowance, remaining allowance, their allowed category(ies), and a
    "request allowance" action (if Decision #2 = request→approve).
  - Owner sees a per-member roll-up: who has what account, how much was
    allocated, how much remains, recent requests.

## Open Design Decisions

Resolve with the user (AskUserQuestion) **before** the dependent task starts —
matching EPIC-016/018's build-vs-relabel sign-off pattern. These are genuine
forks, not defaults.

1. **Funding model — PIVOTAL (gates Task B).** "dapat saldo dari akun ayah":
   - **(A) Real transfer ledger** — money actually moves: the master account's
     `balance` decreases, the member account's `balance` increases, recorded as
     a `transfer` transaction. Member spends real money. _Matches the literal
     wording "dapat saldo"; recommended._
   - **(B) Allowance / budget cap only** — no balance movement; the owner sets a
     periodic spending ceiling per member/category (extends `Budget`). Simpler,
     but the member account shows no real balance. Choose A or B before Task B.

2. **Allocation direction (gates Task B).** "pembantu minta anggaran":
   - **(i) Member requests → owner approves** — a request model + owner
     notification + approve/reject. Matches "minta"; more UX/build.
   - **(ii) Owner pushes allocations** unilaterally — simpler; no request model.
     Recommendation: (i), since staff "requesting" is explicit in the ask.

3. **Role-constraint mechanism (gates Task C).**
   - **(a) Per-member category allow-list** — a join table binding a member to
     allowed categories. Flexible, additive, supports any role/category combo.
     Recommended.
   - **(b) Extend the `Role` enum** with `pembantu` / `supir` sub-roles and
     hard-code their category sets. Rigid; a schema enum change.

4. **Relationship to EPIC-018 Task B.** This epic **supersedes** EPIC-018 Task B
   (per-member pockets) — confirm we build `ownerUserId` here and mark
   EPIC-018 Task B / Decision #1 as resolved, so the foundation is not built
   twice.

## Acceptance Criteria

- `Account` has a real, tenant-scoped, **nullable** `ownerUserId`; an owner can
  link an account to a family member and that member sees it under "Milik saya";
  null-owner accounts behave exactly as before (backward compatible); no
  cross-tenant or cross-member leak.
- Owner→member funding works per the chosen Decision #1/#2 model: an owner can
  fund (or grant a requested allowance to) a member account, and both sides see
  the resulting balance/allowance and its history.
- A constrained member/staff **cannot** record or request spending outside
  their allowed category set — enforced server-side, verified by an integration
  test that rejects a disallowed category.
- CASL still enforces owner/admin_staff/member on shared family data;
  constrained members can manage only their own account within their allowed
  categories.
- All static gates green: `scripts/qa.sh`, `scripts/test.sh`,
  `scripts/security-check.sh`. The additive migration applies cleanly on a DB
  with existing null-owner rows.

## Test Plan

- **Unit:** owner-scoping helper returns correct "mine vs family" sets per role;
  category allow-list check accepts allowed / rejects disallowed categories;
  funding math (transfer debits master, credits member — Decision A) or
  allowance-cap math (Decision B) is correct and never goes negative.
- **Integration:** account create/update validates `ownerUserId` within the
  family group (rejects cross-member / cross-tenant ids); funding endpoint moves
  balance atomically (A) or records the cap (B); transaction-create is rejected
  for a constrained member using a disallowed category; additive migration
  applies on existing null-owner rows.
- **E2E (Playwright):** owner links an account to a member and funds it → member
  logs in, sees the linked account + balance/allowance, records an allowed spend
  (succeeds) and a disallowed-category spend (blocked); (request flow, Decision
  2i) member requests an allowance → owner receives a notification → approves →
  member balance/allowance updates.
- **Smoke:** `/akun`, `/transaksi`, `/anggaran`, `/beranda` load after DEV
  deploy for both an owner and a constrained member.

## Agent Routing

Foundation + schema: `database-reviewer` + `/ecc:prisma-patterns` /
`/ecc:database-migrations` (additive `ownerUserId`, allow-list table),
`nestjs-best-practices` for the funding/allowance service + guards. Security is
central: `ecc:security-reviewer` + `security-agent` for tenant + cross-member
isolation, CASL own-vs-shared, and server-side category enforcement. Frontend:
`code-agent` + `shadcn` for the `/akun` link UI, member view, and request flow;
`ecc:react-reviewer` + `ecc:typescript-reviewer` post-edit on every diff;
`review-qa-agent` for WealthMe acceptance-criteria + honest-UI checks. Gates via
`test-agent` / `security-agent`; `deploy-agent` (DEV only). Per task:
`/task-work EPIC-019 <n>`. Each Open Design Decision above must be confirmed
with the user (AskUserQuestion) before its dependent task starts.

## Done Signal

Each task group closes independently via `/task-work EPIC-019 <n>`. The epic
closes when: an owner can link and fund per-member accounts; constrained
members/staff are held to their allowed categories server-side; the member view
shows real balance/allowance; the funding/approval model chosen in the Open
Design Decisions is implemented and gated; and the acceptance criteria hold
across a fresh QA pass of `/akun`, `/transaksi`, and `/anggaran` for both an
owner and a constrained member.

## Automation Log

- **2026-08-04 — /nerve: all four task groups shipped (PR #214).** Open Design
  Decisions resolved as recommended and implemented: **#1 = (A) real transfer
  ledger** — funding moves actual balances through the EPIC-021 B
  `toAccountId` primitive; **#2 = (i) member requests → owner approves** —
  `AllowanceRequest` model with notifications both directions; **#3 = (a)
  per-member category allow-list** — `MemberCategoryAllowance` join table;
  **#4** — this epic supersedes EPIC-018 Task B, which stays dropped there.
  Task A adds a nullable `Account.ownerUserId` (additive migration) validated
  against same-group membership, an `owner=me|family|all` list filter, ownership
  badges plus a "Milik saya" chip on /rekening, and reverts owned accounts to
  family-shared inside the same transaction as member removal. Task B adds the
  request→approve flow: a member requests funds for an account they own, the
  owner sees a pending panel on /akun and approves by picking a source account,
  which executes a real transfer. Task C enforces the allow-list server-side at
  the single transactions choke point, on create **and** on the effective
  post-patch state of an update; owner/admin*staff and members with an empty
  list stay unrestricted (backward compatible). Task D gives the member their
  balance and request action, and the owner a per-member roll-up.
  **Review found and fixed a CRITICAL money bug:** approval executed the
  transfer and \_then* wrote the status in a separate statement, with only a
  plain read guarding "pending" — two concurrent approvals could transfer twice.
  It now claims the row atomically (`updateMany` conditional on
  `status: "pending"` → 409 if already decided) _before_ transferring, and
  compensates the claim if the transfer throws; covered by double-approve,
  approve-vs-reject race, and transfer-failure tests. Also fixed: missing
  accounts/transactions cache invalidation after a real balance move, missing
  request-list invalidation on create, `Role` enum usage, an array-size cap, and
  a requester index. Security review PASS (owner-only CASL on decide, tenant
  guards, row-scoped reads, notification content non-injectable). Gates: api 31
  suites / 308 tests, web 13 suites / 122 tests, qa + test green.
