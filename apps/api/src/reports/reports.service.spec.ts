import { Test, type TestingModule } from "@nestjs/testing";

import { GENERIC_COA_CHART } from "../common/coa/default-coa-chart";
import { PrismaService } from "../prisma/prisma.service";

import { ReportsService } from "./reports.service";

import type { BalanceSheetDto } from "@wealthme/contracts";

const FAMILY_GROUP_ID = "fg-1";

interface FakeAccount {
  id: string;
  balance: bigint;
  type: string;
  name: string;
  institution: string | null;
  isPrivate: boolean;
}

interface FakeCategory {
  id: string;
  name: string;
  color: string | null;
  isPrivate: boolean;
  // EPIC-017: every category maps to a COA account; reports classify by its
  // direction, not the transaction type. `code`/`groupNum` are optional —
  // only the EPIC-023 Task B retry (CRITICAL 1) contribution-split fixtures
  // set them; every pre-existing fixture leaves them `undefined`, which
  // `contributionBucket` (reports.service.ts) treats as "not a group-3
  // Wealth Allocation account" — i.e. unchanged prior behavior.
  coaAccount: {
    direction: "INCOME" | "EXPENSE" | "TRANSFER";
    code?: string;
    groupNum?: number;
  };
}

interface FakeTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: bigint;
  type: "income" | "expense" | "transfer";
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
}

interface TxWhere {
  account?: { isPrivate: boolean };
  OR?: unknown;
  occurredAt?: { gte?: Date; lte?: Date };
}

// EPIC-023 B2/B3 — a fake `NetWorthSnapshot` row. `getBalanceSheet` does not
// query this model at all yet (it always computes LIVE balances — see the
// comment above it in reports.service.ts), and no `getReconciliationBridge`
// method exists yet either. This fixture type and the `netWorthSnapshot`
// mock below exist so the RED tests can express the fixtures a real
// implementation will need, without the fake doing any of that
// implementation's actual business logic (choosing "most recent on or
// before" is NOT done here — the mock only honors whatever `where`/
// `orderBy`/`take` shape it is called with, exactly like the other model
// mocks in this file already do for `account`/`transaction`).
interface FakeSnapshot {
  familyGroupId: string;
  date: Date;
  capturedAt: Date;
  totalCash: bigint;
  totalInvestments: bigint;
  totalAssets: bigint;
  totalLiabilities: bigint;
  netWorth: bigint;
}

interface SnapshotWhere {
  familyGroupId?: string;
  date?: { lte?: Date; gte?: Date };
}

function filterAndSortSnapshots(
  snapshots: FakeSnapshot[],
  where: SnapshotWhere | undefined,
  orderBy: { date?: "asc" | "desc" } | { date?: "asc" | "desc" }[] | undefined,
) {
  let rows = snapshots;
  if (where?.familyGroupId) {
    const fgId = where.familyGroupId;
    rows = rows.filter((s) => s.familyGroupId === fgId);
  }
  if (where?.date?.lte) {
    const lte = where.date.lte;
    rows = rows.filter((s) => s.date.getTime() <= lte.getTime());
  }
  if (where?.date?.gte) {
    const gte = where.date.gte;
    rows = rows.filter((s) => s.date.getTime() >= gte.getTime());
  }
  const directionEntry = Array.isArray(orderBy) ? orderBy[0] : orderBy;
  const direction = directionEntry?.date ?? "desc";
  return [...rows].sort((a, b) =>
    direction === "asc"
      ? a.date.getTime() - b.date.getTime()
      : b.date.getTime() - a.date.getTime(),
  );
}

/**
 * A minimal in-memory Prisma stand-in that honors the `isPrivate` and
 * transitive account/category `where` filters the service builds, so these
 * tests exercise real filtering behavior rather than just call shapes.
 */
function makeFakePrisma(
  accounts: FakeAccount[],
  categories: FakeCategory[],
  transactions: FakeTransaction[],
  // EPIC-023 B2/B3 — optional; every existing call site omits this and gets
  // the same "no snapshots" behavior as before (an empty array), so this is
  // additive and does not change any pre-existing test's fixtures.
  snapshots: FakeSnapshot[] = [],
) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function filterTx(rows: FakeTransaction[], where: TxWhere) {
    let out = rows;
    if (where.occurredAt?.gte) {
      const gte = where.occurredAt.gte;
      out = out.filter((t) => t.occurredAt.getTime() >= gte.getTime());
    }
    if (where.occurredAt?.lte) {
      const lte = where.occurredAt.lte;
      out = out.filter((t) => t.occurredAt.getTime() <= lte.getTime());
    }
    if (where.account?.isPrivate === false) {
      out = out.filter((t) => !accountById.get(t.accountId)?.isPrivate);
    }
    if (where.OR) {
      out = out.filter(
        (t) =>
          t.categoryId === null || !categoryById.get(t.categoryId)?.isPrivate,
      );
    }
    return out;
  }

  function withRelations(t: FakeTransaction) {
    const cat = t.categoryId ? categoryById.get(t.categoryId) : null;
    return {
      ...t,
      category: cat
        ? {
            id: cat.id,
            name: cat.name,
            color: cat.color,
            coaAccount: cat.coaAccount,
          }
        : null,
      account: { name: accountById.get(t.accountId)?.name ?? "" },
    };
  }

  return {
    account: {
      findMany: jest.fn(
        ({
          where,
          select,
        }: {
          where: { isPrivate?: boolean };
          select?: { transactions?: { where: TxWhere } };
        }) => {
          const rows =
            where.isPrivate === false
              ? accounts.filter((a) => !a.isPrivate)
              : accounts;
          return Promise.resolve(
            rows.map((a) => {
              const nestedWhere = select?.transactions?.where;
              const nestedTxs = nestedWhere
                ? filterTx(
                    transactions.filter((t) => t.accountId === a.id),
                    nestedWhere,
                  ).map(withRelations)
                : undefined;
              return { ...a, transactions: nestedTxs };
            }),
          );
        },
      ),
      // EPIC-023 Task B retry (CRITICAL 2) — `familyHasPrivateAccounts`
      // (reports.service.ts) only ever queries `{ familyGroupId, isPrivate:
      // true }`; this fake honors exactly that shape.
      findFirst: jest.fn(
        ({ where }: { where?: { isPrivate?: boolean } } = {}) => {
          const rows =
            where?.isPrivate === true
              ? accounts.filter((a) => a.isPrivate)
              : accounts;
          return Promise.resolve(rows[0] ?? null);
        },
      ),
    },
    asset: { findMany: jest.fn(() => Promise.resolve([])) },
    liability: { findMany: jest.fn(() => Promise.resolve([])) },
    // EPIC-022 (adversarial review round 3, finding 1) — getBalanceSheet
    // now also queries investments; the dedicated investments-bucket
    // coverage lives in reports-dashboard-networth-parity.spec.ts, this
    // default keeps the pre-existing privacy-enforcement fixtures (which
    // never mention investments) working unchanged.
    investment: { findMany: jest.fn(() => Promise.resolve([])) },
    transaction: {
      findMany: jest.fn(({ where }: { where: TxWhere }) =>
        Promise.resolve(filterTx(transactions, where).map(withRelations)),
      ),
    },
    // EPIC-023 B2/B3 — neither `getBalanceSheet` nor any
    // `getReconciliationBridge` calls this today; it exists so the RED
    // tests below can supply snapshot fixtures for whichever query shape
    // (`findMany` + `take`, or `findFirst`) the eventual implementation
    // uses. Purely generic where/orderBy/take handling — no "most recent
    // on or before" selection logic lives here, that is the service's job.
    netWorthSnapshot: {
      findMany: jest.fn(
        ({
          where,
          orderBy,
          take,
        }: {
          where?: SnapshotWhere;
          orderBy?: { date?: "asc" | "desc" } | { date?: "asc" | "desc" }[];
          take?: number;
        } = {}) => {
          const sorted = filterAndSortSnapshots(snapshots, where, orderBy);
          return Promise.resolve(take ? sorted.slice(0, take) : sorted);
        },
      ),
      findFirst: jest.fn(
        ({
          where,
          orderBy,
        }: {
          where?: SnapshotWhere;
          orderBy?: { date?: "asc" | "desc" } | { date?: "asc" | "desc" }[];
        } = {}) => {
          const sorted = filterAndSortSnapshots(snapshots, where, orderBy);
          return Promise.resolve(sorted[0] ?? null);
        },
      ),
    },
  };
}

function buildFixtures() {
  const accounts: FakeAccount[] = [
    {
      id: "acc-visible",
      balance: 1000n,
      type: "bank",
      name: "Visible",
      institution: "BCA",
      isPrivate: false,
    },
    {
      id: "acc-private",
      balance: 2000n,
      type: "bank",
      name: "Private",
      institution: "Mandiri",
      isPrivate: true,
    },
  ];
  const categories: FakeCategory[] = [
    {
      id: "cat-visible",
      name: "Public Cat",
      color: null,
      isPrivate: false,
      coaAccount: { direction: "INCOME" },
    },
    {
      id: "cat-private",
      name: "Private Cat",
      color: null,
      isPrivate: true,
      coaAccount: { direction: "EXPENSE" },
    },
  ];
  const now = new Date();
  const transactions: FakeTransaction[] = [
    {
      id: "tx-visible",
      accountId: "acc-visible",
      categoryId: null,
      amount: 500n,
      type: "income",
      description: null,
      occurredAt: now,
      createdAt: now,
    },
    {
      id: "tx-private-account",
      accountId: "acc-private",
      categoryId: null,
      amount: 300n,
      type: "expense",
      description: null,
      occurredAt: now,
      createdAt: now,
    },
    {
      id: "tx-private-category",
      accountId: "acc-visible",
      categoryId: "cat-private",
      amount: 200n,
      type: "expense",
      description: null,
      occurredAt: now,
      createdAt: now,
    },
  ];
  return { accounts, categories, transactions, now };
}

describe("ReportsService privacy enforcement", () => {
  let service: ReportsService;
  let prisma: ReturnType<typeof makeFakePrisma>;
  let fixtures: ReturnType<typeof buildFixtures>;

  beforeEach(async () => {
    fixtures = buildFixtures();
    prisma = makeFakePrisma(
      fixtures.accounts,
      fixtures.categories,
      fixtures.transactions,
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ReportsService);
  });

  it("getSummary: member excludes private-tied income/expense from totals", async () => {
    const member = await service.getSummary(
      FAMILY_GROUP_ID,
      "monthly",
      1,
      false,
    );
    expect(member.totalIncome).toBe(500);
    expect(member.totalExpense).toBe(0);

    const owner = await service.getSummary(FAMILY_GROUP_ID, "monthly", 1, true);
    expect(owner.totalIncome).toBe(500);
    expect(owner.totalExpense).toBe(500); // 300 + 200
  });

  it("getBankReport: member excludes the private account and its private-category transactions", async () => {
    const now = fixtures.now;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    const member = await service.getBankReport(
      FAMILY_GROUP_ID,
      start,
      now,
      false,
    );
    expect(member.banks.map((b) => b.accountName)).toEqual(["Visible"]);
    expect(member.banks[0]?.income).toBe(500);
    expect(member.banks[0]?.expense).toBe(0); // private-category tx excluded
    expect(member.totalExpense).toBe(0);

    const owner = await service.getBankReport(
      FAMILY_GROUP_ID,
      start,
      now,
      true,
    );
    expect(owner.banks.map((b) => b.accountName).sort()).toEqual(
      ["Private", "Visible"].sort(),
    );
    expect(owner.totalExpense).toBe(500); // 300 (private acct) + 200 (private cat)
  });

  it("getDetailReport: member excludes private-tied transactions from the list and totals", async () => {
    const now = fixtures.now;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    const member = await service.getDetailReport(
      FAMILY_GROUP_ID,
      start,
      now,
      false,
    );
    expect(member.transactions.map((t) => t.id)).toEqual(["tx-visible"]);
    expect(member.count).toBe(1);
    expect(member.totalExpense).toBe(0);

    const owner = await service.getDetailReport(
      FAMILY_GROUP_ID,
      start,
      now,
      true,
    );
    expect(owner.count).toBe(3);
    expect(owner.totalExpense).toBe(500);
  });

  it("getPnl: member excludes private-tied transactions from current AND previous period totals", async () => {
    const start = new Date(fixtures.now);
    start.setDate(start.getDate() - 5);
    const end = new Date(fixtures.now);
    end.setDate(end.getDate() + 5);
    // Land inside the previous period the service derives from [start, end].
    const prevPeriodDate = new Date(start.getTime() - 1);
    fixtures.transactions.push({
      id: "tx-prev-private",
      accountId: "acc-private",
      categoryId: null,
      amount: 999n,
      type: "expense",
      description: null,
      occurredAt: prevPeriodDate,
      createdAt: prevPeriodDate,
    });

    const member = await service.getPnl(FAMILY_GROUP_ID, start, end, false);
    expect(member.expenses).toBe(0);
    expect(member.previousExpenses).toBe(0);

    const owner = await service.getPnl(FAMILY_GROUP_ID, start, end, true);
    expect(owner.expenses).toBe(500);
    expect(owner.previousExpenses).toBe(999);
  });

  it("getBalanceSheet: member excludes the private account's balance from the cash bucket and net worth", async () => {
    const member = await service.getBalanceSheet(
      FAMILY_GROUP_ID,
      fixtures.now,
      false,
    );
    const memberCash = member.assets.find(
      (a) => a.category === "Kas & Setara Kas",
    );
    expect(memberCash?.amount).toBe(1000);
    expect(member.netWorth).toBe(1000);

    const owner = await service.getBalanceSheet(
      FAMILY_GROUP_ID,
      fixtures.now,
      true,
    );
    const ownerCash = owner.assets.find(
      (a) => a.category === "Kas & Setara Kas",
    );
    expect(ownerCash?.amount).toBe(3000);
    expect(owner.netWorth).toBe(3000);
  });

  it("getCashflowStatement: member excludes the private account's balance and private-tied transactions", async () => {
    const now = fixtures.now;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    const member = await service.getCashflowStatement(
      FAMILY_GROUP_ID,
      start,
      now,
      false,
    );
    expect(member.operatingOutflows).toBe(0);
    expect(member.closingBalance).toBe(1000);

    const owner = await service.getCashflowStatement(
      FAMILY_GROUP_ID,
      start,
      now,
      true,
    );
    expect(owner.operatingOutflows).toBe(500);
    expect(owner.closingBalance).toBe(3000);
  });

  it("getSankey: member excludes private-tied transactions from the flow totals", async () => {
    const now = fixtures.now;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    const member = await service.getSankey(FAMILY_GROUP_ID, start, now, false);
    // No visible expense transactions for a member viewer, so no income→
    // expense links can form.
    expect(member.links.length).toBe(0);

    const owner = await service.getSankey(FAMILY_GROUP_ID, start, now, true);
    expect(owner.links.length).toBeGreaterThan(0);
    const totalLinkValue = owner.links.reduce((s, l) => s + l.value, 0);
    expect(totalLinkValue).toBeGreaterThan(0);
  });

  it("classifies by COA direction, not tx.type (EPIC-017 REPLACE)", async () => {
    // An expense-TYPE transaction whose category maps to a TRANSFER (wealth
    // allocation) COA account must NOT count as a P&L expense — it is a
    // wealth allocation, not spending.
    const now = new Date();
    const accounts: FakeAccount[] = [
      {
        id: "a1",
        balance: 0n,
        type: "bank",
        name: "A",
        institution: null,
        isPrivate: false,
      },
    ];
    const categories: FakeCategory[] = [
      {
        id: "c-transfer",
        name: "Tabungan",
        color: null,
        isPrivate: false,
        coaAccount: { direction: "TRANSFER" },
      },
    ];
    const transactions: FakeTransaction[] = [
      {
        id: "t1",
        accountId: "a1",
        categoryId: "c-transfer",
        amount: 1000n,
        type: "expense",
        description: null,
        occurredAt: now,
        createdAt: now,
      },
    ];
    const p = makeFakePrisma(accounts, categories, transactions);
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: p }],
    }).compile();
    const svc = mod.get(ReportsService);
    const start = new Date(now.getTime() - 86_400_000);
    const end = new Date(now.getTime() + 86_400_000);

    const pnl = await svc.getPnl(FAMILY_GROUP_ID, start, end, true);
    expect(pnl.expenses).toBe(0); // classified TRANSFER, excluded from expenses

    const cf = await svc.getCashflowStatement(
      FAMILY_GROUP_ID,
      start,
      end,
      true,
    );
    expect(cf.operatingOutflows).toBe(0); // excluded from operating cashflow too
  });

  it("getBankReport + getDetailReport also classify by COA direction, not tx.type (EPIC-017 consistency gap)", async () => {
    // Same TRANSFER-mapped-category fixture as the PNL/Cashflow regression
    // above — Ringkasan/PNL/Arus Kas already excluded it; Bank + Detail must
    // now match instead of still counting it via tx.type.
    const now = new Date();
    const accounts: FakeAccount[] = [
      {
        id: "a1",
        balance: 0n,
        type: "bank",
        name: "A",
        institution: null,
        isPrivate: false,
      },
    ];
    const categories: FakeCategory[] = [
      {
        id: "c-transfer",
        name: "Tabungan",
        color: null,
        isPrivate: false,
        coaAccount: { direction: "TRANSFER" },
      },
    ];
    const transactions: FakeTransaction[] = [
      {
        id: "t1",
        accountId: "a1",
        categoryId: "c-transfer",
        amount: 1000n,
        type: "expense",
        description: null,
        occurredAt: now,
        createdAt: now,
      },
    ];
    const p = makeFakePrisma(accounts, categories, transactions);
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: p }],
    }).compile();
    const svc = mod.get(ReportsService);
    const start = new Date(now.getTime() - 86_400_000);
    const end = new Date(now.getTime() + 86_400_000);

    const bank = await svc.getBankReport(FAMILY_GROUP_ID, start, end, true);
    expect(bank.totalExpense).toBe(0);
    expect(bank.banks[0]?.expense).toBe(0);

    const detail = await svc.getDetailReport(FAMILY_GROUP_ID, start, end, true);
    expect(detail.totalExpense).toBe(0);
    // The row itself is still listed (with its own recorded type) — only the
    // aggregate totals are COA-classified.
    expect(detail.transactions[0]?.type).toBe("expense");
  });

  it("getSummary: bounds the category breakdown to the anchor's trailing-months window (EPIC-022 finding 5)", async () => {
    // Reproduces the exact scenario B6 introduced: exporting "as of March"
    // (a historical anchor) while real transactions exist beyond that
    // month. totalIncome/points were already bounded via monthKeys, but
    // topIncomeCategories previously summed every transaction from
    // startDate through the unbounded upper end — this test fails on the
    // pre-fix code (amount would be 6000, not 1000).
    const accounts: FakeAccount[] = [
      {
        id: "a1",
        balance: 0n,
        type: "bank",
        name: "A",
        institution: null,
        isPrivate: false,
      },
    ];
    const categories: FakeCategory[] = [
      {
        id: "c-income",
        name: "Gaji",
        color: null,
        isPrivate: false,
        coaAccount: { direction: "INCOME" },
      },
    ];
    const inWindow = new Date(2026, 2, 10); // March 10, 2026 — inside the window
    const afterWindow = new Date(2026, 3, 5); // April 5, 2026 — after the anchor's month
    const transactions: FakeTransaction[] = [
      {
        id: "t-march",
        accountId: "a1",
        categoryId: "c-income",
        amount: 1_000n,
        type: "income",
        description: null,
        occurredAt: inWindow,
        createdAt: inWindow,
      },
      {
        id: "t-april-leak",
        accountId: "a1",
        categoryId: "c-income",
        amount: 5_000n,
        type: "income",
        description: null,
        occurredAt: afterWindow,
        createdAt: afterWindow,
      },
    ];
    const p = makeFakePrisma(accounts, categories, transactions);
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: p }],
    }).compile();
    const svc = mod.get(ReportsService);

    const anchor = new Date(2026, 2, 15); // March 15, 2026 — a mid-month anchor
    const summary = await svc.getSummary(
      FAMILY_GROUP_ID,
      "monthly",
      1,
      true,
      anchor,
    );

    expect(summary.totalIncome).toBe(1_000);
    expect(summary.topIncomeCategories).toHaveLength(1);
    expect(summary.topIncomeCategories[0]?.amount).toBe(1_000);
  });

  // EPIC-023 Task A3 — regression tests proving a group-5 (Account Payable)
  // principal repayment no longer appears in P&L expenses and a group-4
  // (Account Receivable) loan disbursement no longer appears as P&L revenue
  // (acceptance criterion: "Given money lent to a friend and recorded against
  // a group-4 category / When the P&L for that period is opened / Then the
  // amount does not appear as revenue").
  //
  // The fixtures read their direction from `GENERIC_COA_CHART` — the chart the
  // app actually provisions for every new family (auth.service.ts:150,
  // web/src/lib/auth.ts:114) — instead of hardcoding a literal. That is
  // deliberate: it makes the assertion track the real taxonomy. The tests fail
  // today because codes 50002/40001 are shelved as EXPENSE/INCOME, and go
  // green only when A1 moves groups 4 and 5 to TRANSFER. They cannot be
  // satisfied by special-casing groupNum inside ReportsService, which would
  // contradict decision D23.
  const chartDirection = (
    code: string,
  ): FakeCategory["coaAccount"]["direction"] => {
    const entry = GENERIC_COA_CHART.find((c) => c.code === code);
    if (!entry) {
      throw new Error(`COA code ${code} is missing from GENERIC_COA_CHART`);
    }
    return entry.direction;
  };

  it("getPnl: a mortgage principal repayment (group-5 Payable category) does not appear in P&L expenses (EPIC-023 A3)", async () => {
    const now = new Date();
    const accounts: FakeAccount[] = [
      {
        id: "a1",
        balance: 0n,
        type: "bank",
        name: "A",
        institution: null,
        isPrivate: false,
      },
    ];
    const categories: FakeCategory[] = [
      {
        id: "c-legit-expense",
        name: "Makan & Minum",
        color: null,
        isPrivate: false,
        coaAccount: { direction: "EXPENSE" },
      },
      {
        id: "c-mortgage-principal",
        name: "Cicilan Pokok KPR",
        color: null,
        isPrivate: false,
        // "Cicilan" — the group-5 Account Payable shelf a mortgage instalment
        // lands on. Read from the chart, not hardcoded (see note above).
        coaAccount: { direction: chartDirection("50002") },
      },
    ];
    const transactions: FakeTransaction[] = [
      {
        id: "t-legit-expense",
        accountId: "a1",
        categoryId: "c-legit-expense",
        amount: 500_000n,
        type: "expense",
        description: null,
        occurredAt: now,
        createdAt: now,
      },
      {
        id: "t-mortgage-principal",
        accountId: "a1",
        categoryId: "c-mortgage-principal",
        amount: 3_500_000n,
        type: "expense",
        description: "Cicilan KPR — pokok",
        occurredAt: now,
        createdAt: now,
      },
    ];
    const p = makeFakePrisma(accounts, categories, transactions);
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: p }],
    }).compile();
    const svc = mod.get(ReportsService);
    const start = new Date(now.getTime() - 86_400_000);
    const end = new Date(now.getTime() + 86_400_000);

    const pnl = await svc.getPnl(FAMILY_GROUP_ID, start, end, true);

    // Only the legitimate expense should count — the mortgage principal
    // repayment must not inflate P&L expenses.
    expect(pnl.expenses).toBe(500_000);
    expect(
      pnl.expenseBreakdown.find((b) => b.categoryName === "Cicilan Pokok KPR"),
    ).toBeUndefined();
  });

  it("getPnl: a loan disbursement (group-4 Receivable category) does not appear as P&L revenue (EPIC-023 A3)", async () => {
    const now = new Date();
    const accounts: FakeAccount[] = [
      {
        id: "a1",
        balance: 0n,
        type: "bank",
        name: "A",
        institution: null,
        isPrivate: false,
      },
    ];
    const categories: FakeCategory[] = [
      {
        id: "c-legit-income",
        name: "Gaji",
        color: null,
        isPrivate: false,
        coaAccount: { direction: "INCOME" },
      },
      {
        id: "c-loan-out",
        name: "Pinjaman ke Teman",
        color: null,
        isPrivate: false,
        // "Piutang" — the group-4 Account Receivable shelf money lent out
        // lands on. Read from the chart, not hardcoded (see note above).
        coaAccount: { direction: chartDirection("40001") },
      },
    ];
    const transactions: FakeTransaction[] = [
      {
        id: "t-legit-income",
        accountId: "a1",
        categoryId: "c-legit-income",
        amount: 25_850_000n,
        type: "income",
        description: null,
        occurredAt: now,
        createdAt: now,
      },
      {
        id: "t-loan-out",
        accountId: "a1",
        categoryId: "c-loan-out",
        amount: 2_000_000n,
        // Money lent out leaves the giver's cash — recorded as an outflow —
        // but is mapped to a (mis-seeded) group-4 category. COA
        // classification, not tx.type, decides P&L direction (EPIC-017), so
        // it is currently wrongly picked up as revenue.
        type: "expense",
        description: "Pinjaman ke Budi",
        occurredAt: now,
        createdAt: now,
      },
    ];
    const p = makeFakePrisma(accounts, categories, transactions);
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: p }],
    }).compile();
    const svc = mod.get(ReportsService);
    const start = new Date(now.getTime() - 86_400_000);
    const end = new Date(now.getTime() + 86_400_000);

    const pnl = await svc.getPnl(FAMILY_GROUP_ID, start, end, true);

    // Only the legitimate income should count — the loan disbursement must
    // not inflate P&L revenue.
    expect(pnl.revenue).toBe(25_850_000);
    expect(
      pnl.revenueBreakdown.find((b) => b.categoryName === "Pinjaman ke Teman"),
    ).toBeUndefined();
  });

  // EPIC-023 Task B (B2) — RED phase. `getBalanceSheet` currently ignores
  // its `asOfDate` argument for data selection: the comment directly above
  // it in reports.service.ts documents that it always computes LIVE
  // account/asset/liability/investment balances (this is the still-open gap
  // named EPIC-022 B11). These tests pin the behaviour B2 must land: the
  // balance sheet must read the `NetWorthSnapshot` at/before the range's end
  // date, not "today" and not a live recompute.
  //
  // Every fixture's LIVE account balance (999,000,000, below) deliberately
  // matches NONE of the snapshot net-worth figures, so a correct
  // (snapshot-reading) implementation and today's (live-reading)
  // implementation diverge on a real number, not by coincidence.
  describe("getBalanceSheet — honours the range's end date via NetWorthSnapshot (EPIC-023 B2, closes EPIC-022 B11)", () => {
    const LIVE_ACCOUNT_BALANCE = 999_000_000n;

    function makeSnapshot(
      dateIso: string,
      figures: {
        cash: bigint;
        investments: bigint;
        assets: bigint;
        liabilities: bigint;
      },
    ): FakeSnapshot {
      return {
        familyGroupId: FAMILY_GROUP_ID,
        date: new Date(dateIso),
        capturedAt: new Date(dateIso),
        totalCash: figures.cash,
        totalInvestments: figures.investments,
        totalAssets: figures.assets,
        totalLiabilities: figures.liabilities,
        netWorth:
          figures.cash +
          figures.investments +
          figures.assets -
          figures.liabilities,
      };
    }

    // Three months of snapshots, netWorth 80,000,000 / 125,000,000 /
    // 170,000,000 — three DISTINCT values so "which one got used" is never
    // ambiguous.
    const snapshots: FakeSnapshot[] = [
      makeSnapshot("2026-06-30T00:00:00.000Z", {
        cash: 60_000_000n,
        investments: 40_000_000n,
        assets: 0n,
        liabilities: 20_000_000n,
      }), // netWorth 80,000,000
      makeSnapshot("2026-07-31T00:00:00.000Z", {
        cash: 90_000_000n,
        investments: 60_000_000n,
        assets: 0n,
        liabilities: 25_000_000n,
      }), // netWorth 125,000,000
      makeSnapshot("2026-08-31T00:00:00.000Z", {
        cash: 120_000_000n,
        investments: 80_000_000n,
        assets: 0n,
        liabilities: 30_000_000n,
      }), // netWorth 170,000,000
    ];

    function buildPrisma() {
      const accounts: FakeAccount[] = [
        {
          id: "a-live",
          balance: LIVE_ACCOUNT_BALANCE,
          type: "bank",
          name: "Live",
          institution: null,
          isPrivate: false,
        },
      ];
      return makeFakePrisma(accounts, [], [], snapshots);
    }

    it("a range ending exactly on a snapshot date reports THAT snapshot's figures, not live totals", async () => {
      const prisma = buildPrisma();
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      // Range ends exactly on 31 Jul 2026 — the MIDDLE snapshot.
      const rangeEnd = new Date("2026-07-31T16:59:59.999Z");
      const balanceSheet = await svc.getBalanceSheet(
        FAMILY_GROUP_ID,
        rangeEnd,
        true,
      );

      expect(balanceSheet.netWorth).toBe(125_000_000);
      expect(balanceSheet.totalAssets).toBe(90_000_000 + 60_000_000); // cash + investments, no physical-asset bucket this month
      expect(balanceSheet.totalLiabilities).toBe(25_000_000);
      // Not live, not June, not August.
      expect(balanceSheet.netWorth).not.toBe(Number(LIVE_ACCOUNT_BALANCE));
      expect(balanceSheet.netWorth).not.toBe(80_000_000);
      expect(balanceSheet.netWorth).not.toBe(170_000_000);
    });

    it("a range ending between two snapshots uses the most recent snapshot ON OR BEFORE that date — never a later one", async () => {
      const prisma = buildPrisma();
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      // 15 Aug 2026 — after the 31 Jul snapshot, before the 31 Aug one.
      const rangeEnd = new Date("2026-08-15T16:59:59.999Z");
      const balanceSheet = await svc.getBalanceSheet(
        FAMILY_GROUP_ID,
        rangeEnd,
        true,
      );

      // Must fall back to 31 Jul (125,000,000) — NOT reach forward to the
      // 31 Aug snapshot (170,000,000), which would be "using a later
      // snapshot", and not the live total either.
      expect(balanceSheet.netWorth).toBe(125_000_000);
      expect(balanceSheet.netWorth).not.toBe(170_000_000);
      expect(balanceSheet.netWorth).not.toBe(Number(LIVE_ACCOUNT_BALANCE));
    });

    it("a range ending before every snapshot does not silently invent a figure — honest 'no data', not a zero masquerading as real", async () => {
      const prisma = buildPrisma();
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      // 1 Jan 2026 — before the earliest (30 Jun 2026) snapshot.
      const rangeEnd = new Date("2026-01-01T00:00:00.000Z");
      const balanceSheet = await svc.getBalanceSheet(
        FAMILY_GROUP_ID,
        rangeEnd,
        true,
      );

      // The contract this pins down: an explicit "no snapshot available"
      // signal — `BalanceSheetDto` does not have this field yet; whoever
      // lands B2 must add one (or an equivalent honest signal) rather than
      // reporting netWorth: 0 (indistinguishable from "a real zero net
      // worth") or falling back to live totals.
      const result = balanceSheet as BalanceSheetDto & {
        dataAvailable?: boolean;
      };
      expect(result.dataAvailable).toBe(false);
      expect(balanceSheet.assets).toEqual([]);
      expect(balanceSheet.liabilities).toEqual([]);
    });
  });

  // EPIC-023 Task B (B3) — RED phase. `getReconciliationBridge` does not
  // exist on `ReportsService` yet.
  //
  // THE FIGURES BELOW ARE HAND-COMPUTED and must NEVER be replaced with
  // values read back from the bridge's own output. Adversarial review on
  // this epic has twice caught a "balanced" check that was algebraically
  // incapable of failing, in two different disguises — see
  // `computeBalanceSheetIdentity`'s history in
  // apps/web/src/lib/laporan-utils.test.ts (round 1: totalAssets =
  // totalLiabilities + netWorth, unfalsifiable because netWorth is DEFINED
  // as their difference; round 2: re-summing a breakdown array the API
  // itself built by summing the same array). If `getReconciliationBridge`
  // derives `revaluation` as `closing - opening - profit`, then asserting
  // `opening + profit + revaluation === closing` is that same tautology a
  // third time — it cannot fail, whatever the code does. Every term here is
  // independently known from the fixtures, and the FIRST assertions in each
  // test are on the named component figures, not the sum.
  describe("getReconciliationBridge — hand-computed month (EPIC-023 B3)", () => {
    function makeSnapshot(
      dateIso: string,
      figures: {
        cash: bigint;
        investments: bigint;
        assets: bigint;
        liabilities: bigint;
      },
    ): FakeSnapshot {
      return {
        familyGroupId: FAMILY_GROUP_ID,
        date: new Date(dateIso),
        capturedAt: new Date(dateIso),
        totalCash: figures.cash,
        totalInvestments: figures.investments,
        totalAssets: figures.assets,
        totalLiabilities: figures.liabilities,
        netWorth:
          figures.cash +
          figures.investments +
          figures.assets -
          figures.liabilities,
      };
    }

    // August 2026, WIB-pinned exactly like getPeriodDateRange({year:2026,
    // month:8, day:null}) would produce.
    const START = new Date("2026-07-31T17:00:00.000Z"); // Aug 1 2026 00:00:00.000 WIB
    const END = new Date("2026-08-31T16:59:59.999Z"); // Aug 31 2026 23:59:59.999 WIB

    it("names the 8,000,000 investment gain as its own revaluation figure — not merely 'the equation balances', and shows the principal repayment as net-worth-neutral", async () => {
      const accounts: FakeAccount[] = [
        {
          id: "a1",
          balance: 0n,
          type: "bank",
          name: "A",
          institution: null,
          isPrivate: false,
        },
      ];
      const categories: FakeCategory[] = [
        {
          id: "c-income",
          name: "Gaji",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "INCOME" },
        },
        {
          id: "c-expense",
          name: "Belanja Bulanan",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "EXPENSE" },
        },
        {
          id: "c-principal",
          name: "Cicilan Pokok",
          color: null,
          isPrivate: false,
          // Group A (EPIC-023 A1) moved COA groups 4/5 to TRANSFER — a
          // principal repayment must NOT appear in profit.
          coaAccount: { direction: "TRANSFER" },
        },
      ];
      const transactions: FakeTransaction[] = [
        {
          id: "t-income",
          accountId: "a1",
          categoryId: "c-income",
          amount: 25_000_000n,
          type: "income",
          description: null,
          occurredAt: new Date("2026-08-10T00:00:00.000Z"),
          createdAt: new Date("2026-08-10T00:00:00.000Z"),
        },
        {
          id: "t-expense",
          accountId: "a1",
          categoryId: "c-expense",
          amount: 10_000_000n,
          type: "expense",
          description: null,
          occurredAt: new Date("2026-08-12T00:00:00.000Z"),
          createdAt: new Date("2026-08-12T00:00:00.000Z"),
        },
        {
          id: "t-principal",
          accountId: "a1",
          categoryId: "c-principal",
          amount: 5_000_000n,
          type: "expense",
          description: "Cicilan pokok KPR",
          occurredAt: new Date("2026-08-15T00:00:00.000Z"),
          createdAt: new Date("2026-08-15T00:00:00.000Z"),
        },
      ];
      // Opening (1 Aug): cash 100,000,000 · investments 50,000,000 ·
      // assets 200,000,000 · liabilities 80,000,000 -> netWorth
      // 270,000,000. Kept explicit per-field so every figure in this test
      // is traceable straight to the brief's hand-computed month.
      const snapshots: FakeSnapshot[] = [
        makeSnapshot("2026-08-01T00:00:00.000Z", {
          cash: 100_000_000n,
          investments: 50_000_000n,
          assets: 200_000_000n,
          liabilities: 80_000_000n,
        }), // netWorth 270,000,000
        // Closing (31 Aug): cash 100,000,000 + 25,000,000 (income) -
        // 10,000,000 (expense) - 5,000,000 (principal) = 110,000,000;
        // investments 50,000,000 + 8,000,000 (revaluation) = 58,000,000;
        // assets unchanged at 200,000,000; liabilities 80,000,000 -
        // 5,000,000 (principal) = 75,000,000 -> netWorth 293,000,000.
        makeSnapshot("2026-08-31T00:00:00.000Z", {
          cash: 110_000_000n,
          investments: 58_000_000n,
          assets: 200_000_000n,
          liabilities: 75_000_000n,
        }), // netWorth 293,000,000
      ];
      const prisma = makeFakePrisma(
        accounts,
        categories,
        transactions,
        snapshots,
      );
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      const bridge = await svc.getReconciliationBridge(
        FAMILY_GROUP_ID,
        START,
        END,
        true,
      );

      // 1. Revaluation asserted against the independently-known input
      //    (58,000,000 - 50,000,000 = 8,000,000) — NOT derived from
      //    opening/closing/profit.
      expect(bridge.investmentRevaluation).toBe(8_000_000);
      expect(bridge.assetRevaluation).toBe(0); // 200,000,000 - 200,000,000: physical assets untouched
      // 2. Profit asserted independently (25,000,000 income - 10,000,000
      //    expense). The 5,000,000 principal repayment is TRANSFER-
      //    classified (group A) and must NOT reduce profit.
      expect(bridge.profit).toBe(15_000_000);
      // 3. Opening/closing read from the SNAPSHOTS, not recomputed.
      expect(bridge.opening).toBe(270_000_000);
      expect(bridge.closing).toBe(293_000_000);
      // 4. Only now does the bridge sum: net worth moved 23,000,000 while
      //    profit was only 15,000,000 — the remaining 8,000,000 is named
      //    revaluation, and the principal repayment (cash -5,000,000,
      //    liabilities -5,000,000) is net-worth-neutral, so it needs no
      //    term of its own here.
      expect(
        bridge.opening +
          bridge.profit +
          bridge.assetRevaluation +
          bridge.investmentRevaluation,
      ).toBe(bridge.closing);
    });

    it("CHEAT DETECTOR — a distinct asset revaluation and investment revaluation in the SAME month must be reported separately, not as one combined residual", async () => {
      // An implementation deriving a single `closing - opening - profit`
      // residual can get the COMBINED total (11,000,000) right without ever
      // computing the two components individually — it has no way to also
      // report them as 3,000,000 and 8,000,000 on their own. That is
      // exactly what this test is designed to catch: it asserts the two
      // components SEPARATELY, before it ever looks at their sum.
      const accounts: FakeAccount[] = [
        {
          id: "a1",
          balance: 0n,
          type: "bank",
          name: "A",
          institution: null,
          isPrivate: false,
        },
      ];
      const categories: FakeCategory[] = [
        {
          id: "c-income",
          name: "Gaji",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "INCOME" },
        },
        {
          id: "c-expense",
          name: "Belanja Bulanan",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "EXPENSE" },
        },
      ];
      const transactions: FakeTransaction[] = [
        {
          id: "t-income",
          accountId: "a1",
          categoryId: "c-income",
          amount: 25_000_000n,
          type: "income",
          description: null,
          occurredAt: new Date("2026-08-10T00:00:00.000Z"),
          createdAt: new Date("2026-08-10T00:00:00.000Z"),
        },
        {
          id: "t-expense",
          accountId: "a1",
          categoryId: "c-expense",
          amount: 10_000_000n,
          type: "expense",
          description: null,
          occurredAt: new Date("2026-08-12T00:00:00.000Z"),
          createdAt: new Date("2026-08-12T00:00:00.000Z"),
        },
      ];
      const snapshots: FakeSnapshot[] = [
        makeSnapshot("2026-08-01T00:00:00.000Z", {
          cash: 100_000_000n,
          investments: 50_000_000n,
          assets: 200_000_000n,
          liabilities: 80_000_000n,
        }), // netWorth 270,000,000
        // No principal repayment this month: cash 100,000,000 + 25,000,000
        // - 10,000,000 = 115,000,000; investments 50,000,000 + 8,000,000 =
        // 58,000,000; assets 200,000,000 + 3,000,000 = 203,000,000;
        // liabilities unchanged 80,000,000 -> netWorth 296,000,000.
        makeSnapshot("2026-08-31T00:00:00.000Z", {
          cash: 115_000_000n,
          investments: 58_000_000n,
          assets: 203_000_000n,
          liabilities: 80_000_000n,
        }), // netWorth 296,000,000
      ];
      const prisma = makeFakePrisma(
        accounts,
        categories,
        transactions,
        snapshots,
      );
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      const bridge = await svc.getReconciliationBridge(
        FAMILY_GROUP_ID,
        START,
        END,
        true,
      );

      expect(bridge.assetRevaluation).toBe(3_000_000);
      expect(bridge.investmentRevaluation).toBe(8_000_000);
      expect(bridge.assetRevaluation).not.toBe(bridge.investmentRevaluation);
      // The combined total alone is NOT sufficient proof — a
      // residual-splitting implementation could satisfy this line while
      // still failing the two named-component assertions above.
      expect(bridge.assetRevaluation + bridge.investmentRevaluation).toBe(
        11_000_000,
      );
      expect(
        bridge.opening +
          bridge.profit +
          bridge.assetRevaluation +
          bridge.investmentRevaluation,
      ).toBe(bridge.closing);
    });
  });

  // EPIC-023 Task B retry (CRITICAL 1) — `assetRevaluation`/
  // `investmentRevaluation` used to be the RAW snapshot diff, conflating
  // market revaluation with a cash-funded CONTRIBUTION (a COA group-3
  // "Wealth Allocation" TRANSFER moving cash into an Investment/Asset with
  // no automatic ledger link back to it). The fix subtracts the period's own
  // contribution from each raw diff so only market movement remains.
  describe("getReconciliationBridge — contributions vs revaluation (EPIC-023 Task B retry, CRITICAL 1)", () => {
    function makeSnapshot(
      dateIso: string,
      figures: {
        cash: bigint;
        investments: bigint;
        assets: bigint;
        liabilities: bigint;
      },
    ): FakeSnapshot {
      return {
        familyGroupId: FAMILY_GROUP_ID,
        date: new Date(dateIso),
        capturedAt: new Date(dateIso),
        totalCash: figures.cash,
        totalInvestments: figures.investments,
        totalAssets: figures.assets,
        totalLiabilities: figures.liabilities,
        netWorth:
          figures.cash +
          figures.investments +
          figures.assets -
          figures.liabilities,
      };
    }

    // August 2026, WIB-pinned exactly like the "hand-computed month" describe
    // above.
    const START = new Date("2026-07-31T17:00:00.000Z"); // Aug 1 2026 00:00:00.000 WIB
    const END = new Date("2026-08-31T16:59:59.999Z"); // Aug 31 2026 23:59:59.999 WIB

    const accounts: FakeAccount[] = [
      {
        id: "a1",
        balance: 0n,
        type: "bank",
        name: "A",
        institution: null,
        isPrivate: false,
      },
    ];

    it("the reviewer's exact scenario: a pure contribution with no market movement is NOT counted as an 8/10 jt gain", async () => {
      // Opening 270,000,000 (cash 100,000,000 / investments 50,000,000 /
      // assets 200,000,000 / liabilities 80,000,000). One income of
      // 25,000,000. One "Investasi" TRANSFER of 10,000,000 moving cash into
      // a holding with NO market movement. True closing: 295,000,000 — the
      // transfer is net-worth-neutral (cash down 10 jt, investments up 10
      // jt), so net worth only moves by the 25,000,000 income.
      const categories: FakeCategory[] = [
        {
          id: "c-income",
          name: "Gaji",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "INCOME" },
        },
        {
          id: "c-invest",
          name: "Investasi",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "TRANSFER", groupNum: 3, code: "30002" },
        },
      ];
      const transactions: FakeTransaction[] = [
        {
          id: "t-income",
          accountId: "a1",
          categoryId: "c-income",
          amount: 25_000_000n,
          type: "income",
          description: null,
          occurredAt: new Date("2026-08-10T00:00:00.000Z"),
          createdAt: new Date("2026-08-10T00:00:00.000Z"),
        },
        {
          id: "t-invest-contribution",
          accountId: "a1",
          categoryId: "c-invest",
          amount: 10_000_000n,
          type: "expense",
          description: "Alokasi ke investasi",
          occurredAt: new Date("2026-08-15T00:00:00.000Z"),
          createdAt: new Date("2026-08-15T00:00:00.000Z"),
        },
      ];
      const snapshots: FakeSnapshot[] = [
        makeSnapshot("2026-08-01T00:00:00.000Z", {
          cash: 100_000_000n,
          investments: 50_000_000n,
          assets: 200_000_000n,
          liabilities: 80_000_000n,
        }), // netWorth 270,000,000
        // cash: 100,000,000 + 25,000,000 (income) - 10,000,000 (contribution)
        // = 115,000,000; investments: 50,000,000 + 10,000,000 (contribution,
        // NO market movement) = 60,000,000; assets/liabilities unchanged.
        makeSnapshot("2026-08-31T00:00:00.000Z", {
          cash: 115_000_000n,
          investments: 60_000_000n,
          assets: 200_000_000n,
          liabilities: 80_000_000n,
        }), // netWorth 295,000,000
      ];
      const prisma = makeFakePrisma(
        accounts,
        categories,
        transactions,
        snapshots,
      );
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      const bridge = await svc.getReconciliationBridge(
        FAMILY_GROUP_ID,
        START,
        END,
        true,
      );

      // Named component figures FIRST, independently of the sum.
      expect(bridge.opening).toBe(270_000_000);
      expect(bridge.closing).toBe(295_000_000);
      expect(bridge.profit).toBe(25_000_000);
      expect(bridge.investmentContribution).toBe(10_000_000);
      expect(bridge.assetContribution).toBe(0);
      // The contribution is entirely market-movement-free — the raw
      // snapshot diff (60,000,000 - 50,000,000 = 10,000,000) must NOT
      // surface as the revaluation once the contribution is subtracted.
      expect(bridge.investmentRevaluation).toBe(0);
      expect(bridge.assetRevaluation).toBe(0);
      // The bridge genuinely balances: 270,000,000 + 25,000,000 + 0 + 0 =
      // 295,000,000 — NOT the old buggy 305,000,000 (opening + profit +
      // raw 10,000,000 "revaluation").
      expect(
        bridge.opening +
          bridge.profit +
          bridge.assetRevaluation +
          bridge.investmentRevaluation,
      ).toBe(bridge.closing);
    });

    it("a contribution AND a real revaluation in the SAME period are not confused with each other", async () => {
      const categories: FakeCategory[] = [
        {
          id: "c-income",
          name: "Gaji",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "INCOME" },
        },
        {
          id: "c-expense",
          name: "Belanja Bulanan",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "EXPENSE" },
        },
        {
          id: "c-invest",
          name: "Investasi",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "TRANSFER", groupNum: 3, code: "30002" },
        },
        // A DIFFERENT group-3 code (not the "Investasi" one) — asset-
        // directed, e.g. a savings/emergency-fund allocation.
        {
          id: "c-tabungan",
          name: "Tabungan",
          color: null,
          isPrivate: false,
          coaAccount: { direction: "TRANSFER", groupNum: 3, code: "30001" },
        },
      ];
      const transactions: FakeTransaction[] = [
        {
          id: "t-income",
          accountId: "a1",
          categoryId: "c-income",
          amount: 25_000_000n,
          type: "income",
          description: null,
          occurredAt: new Date("2026-08-10T00:00:00.000Z"),
          createdAt: new Date("2026-08-10T00:00:00.000Z"),
        },
        {
          id: "t-expense",
          accountId: "a1",
          categoryId: "c-expense",
          amount: 10_000_000n,
          type: "expense",
          description: null,
          occurredAt: new Date("2026-08-12T00:00:00.000Z"),
          createdAt: new Date("2026-08-12T00:00:00.000Z"),
        },
        {
          id: "t-invest-contribution",
          accountId: "a1",
          categoryId: "c-invest",
          amount: 10_000_000n,
          type: "expense",
          description: "Alokasi ke investasi",
          occurredAt: new Date("2026-08-15T00:00:00.000Z"),
          createdAt: new Date("2026-08-15T00:00:00.000Z"),
        },
        {
          id: "t-tabungan-contribution",
          accountId: "a1",
          categoryId: "c-tabungan",
          amount: 5_000_000n,
          type: "expense",
          description: "Alokasi ke tabungan",
          occurredAt: new Date("2026-08-16T00:00:00.000Z"),
          createdAt: new Date("2026-08-16T00:00:00.000Z"),
        },
      ];
      const snapshots: FakeSnapshot[] = [
        makeSnapshot("2026-08-01T00:00:00.000Z", {
          cash: 100_000_000n,
          investments: 50_000_000n,
          assets: 200_000_000n,
          liabilities: 80_000_000n,
        }), // netWorth 270,000,000
        // cash: 100,000,000 + 25,000,000 - 10,000,000 - 10,000,000
        // (investment contribution) - 5,000,000 (asset/tabungan
        // contribution) = 100,000,000; investments: 50,000,000 +
        // 10,000,000 (contribution) + 8,000,000 (market gain) =
        // 68,000,000; assets: 200,000,000 + 5,000,000 (contribution) +
        // 3,000,000 (market gain) = 208,000,000; liabilities unchanged.
        makeSnapshot("2026-08-31T00:00:00.000Z", {
          cash: 100_000_000n,
          investments: 68_000_000n,
          assets: 208_000_000n,
          liabilities: 80_000_000n,
        }), // netWorth 296,000,000
      ];
      const prisma = makeFakePrisma(
        accounts,
        categories,
        transactions,
        snapshots,
      );
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      const bridge = await svc.getReconciliationBridge(
        FAMILY_GROUP_ID,
        START,
        END,
        true,
      );

      expect(bridge.opening).toBe(270_000_000);
      expect(bridge.closing).toBe(296_000_000);
      expect(bridge.profit).toBe(15_000_000);
      expect(bridge.investmentContribution).toBe(10_000_000);
      expect(bridge.assetContribution).toBe(5_000_000);
      // Market-movement-only remainder: raw diffs (18,000,000 and
      // 8,000,000) MINUS the contribution — proves the contribution was
      // actually subtracted, not merely zero by coincidence.
      expect(bridge.investmentRevaluation).toBe(8_000_000);
      expect(bridge.assetRevaluation).toBe(3_000_000);
      expect(bridge.investmentRevaluation).not.toBe(18_000_000);
      expect(bridge.assetRevaluation).not.toBe(8_000_000);
      expect(
        bridge.opening +
          bridge.profit +
          bridge.assetRevaluation +
          bridge.investmentRevaluation,
      ).toBe(bridge.closing);
    });
  });

  // EPIC-023 Task B retry (CRITICAL 2) — `NetWorthSnapshot` rows are
  // captured with privacy fully open (dashboard.service.ts's
  // `captureSnapshot` always calls `computeNetWorthBreakdown(..., true)`),
  // so a viewer who may not see private items (a plain `member`) must not
  // be shown one once the family holds any private account.
  describe("getBalanceSheet / getReconciliationBridge — privacy vs snapshot (EPIC-023 Task B retry, CRITICAL 2)", () => {
    function makeSnapshot(dateIso: string): FakeSnapshot {
      // Mirrors the finding's exact reproduction: a public account
      // (10,000,000) and a private one (999,000,000) — the snapshot totals
      // include BOTH regardless of privacy.
      return {
        familyGroupId: FAMILY_GROUP_ID,
        date: new Date(dateIso),
        capturedAt: new Date(dateIso),
        totalCash: 1_009_000_000n,
        totalInvestments: 0n,
        totalAssets: 0n,
        totalLiabilities: 0n,
        netWorth: 1_009_000_000n,
      };
    }

    const accountsWithPrivate: FakeAccount[] = [
      {
        id: "a-public",
        balance: 10_000_000n,
        type: "bank",
        name: "Public",
        institution: null,
        isPrivate: false,
      },
      {
        id: "a-private",
        balance: 999_000_000n,
        type: "bank",
        name: "Private",
        institution: null,
        isPrivate: true,
      },
    ];
    const accountsAllPublic: FakeAccount[] = [
      {
        id: "a-public",
        balance: 10_000_000n,
        type: "bank",
        name: "Public",
        institution: null,
        isPrivate: false,
      },
    ];

    it("getBalanceSheet: a member viewer must NOT see the snapshot once the family holds a private account", async () => {
      const snapshots = [makeSnapshot("2026-08-31T00:00:00.000Z")];
      const prisma = makeFakePrisma(accountsWithPrivate, [], [], snapshots);
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      const balanceSheet = await svc.getBalanceSheet(
        FAMILY_GROUP_ID,
        new Date("2026-08-31T16:59:59.999Z"),
        false, // member
      );

      // The regression this guards: a member must NOT see 1,009,000,000
      // (the owner's own figure, hidden money included).
      expect(balanceSheet.netWorth).not.toBe(1_009_000_000);
      expect(balanceSheet.netWorth).toBe(0);
      expect(balanceSheet.totalAssets).toBe(0);
      expect(balanceSheet.assets).toEqual([]);
      expect(balanceSheet.liabilities).toEqual([]);
      expect(balanceSheet.dataAvailable).toBe(false);
      expect(balanceSheet.restrictedForViewer).toBe(true);
    });

    it("getBalanceSheet: the owner viewer still sees the snapshot in full, even though the family holds a private account", async () => {
      const snapshots = [makeSnapshot("2026-08-31T00:00:00.000Z")];
      const prisma = makeFakePrisma(accountsWithPrivate, [], [], snapshots);
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      const balanceSheet = await svc.getBalanceSheet(
        FAMILY_GROUP_ID,
        new Date("2026-08-31T16:59:59.999Z"),
        true, // owner
      );

      expect(balanceSheet.netWorth).toBe(1_009_000_000);
      expect(balanceSheet.dataAvailable).toBe(true);
      expect(balanceSheet.restrictedForViewer).toBe(false);
    });

    it("getBalanceSheet: a member viewer sees the snapshot normally when the family holds NO private accounts", async () => {
      const snapshots = [makeSnapshot("2026-08-31T00:00:00.000Z")];
      const prisma = makeFakePrisma(accountsAllPublic, [], [], snapshots);
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      const balanceSheet = await svc.getBalanceSheet(
        FAMILY_GROUP_ID,
        new Date("2026-08-31T16:59:59.999Z"),
        false, // member
      );

      expect(balanceSheet.netWorth).toBe(1_009_000_000);
      expect(balanceSheet.dataAvailable).toBe(true);
      expect(balanceSheet.restrictedForViewer).toBe(false);
    });

    it("getReconciliationBridge: a member viewer must NOT see opening/closing once the family holds a private account", async () => {
      const snapshots = [
        makeSnapshot("2026-08-01T00:00:00.000Z"),
        makeSnapshot("2026-08-31T00:00:00.000Z"),
      ];
      const prisma = makeFakePrisma(accountsWithPrivate, [], [], snapshots);
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      const bridge = await svc.getReconciliationBridge(
        FAMILY_GROUP_ID,
        new Date("2026-07-31T17:00:00.000Z"),
        new Date("2026-08-31T16:59:59.999Z"),
        false, // member
      );

      expect(bridge.opening).toBe(0);
      expect(bridge.closing).toBe(0);
      expect(bridge.opening).not.toBe(1_009_000_000);
      expect(bridge.dataAvailable).toBe(false);
      expect(bridge.restrictedForViewer).toBe(true);
    });

    it("getReconciliationBridge: a member viewer sees opening/closing normally when the family holds NO private accounts", async () => {
      const snapshots = [
        makeSnapshot("2026-08-01T00:00:00.000Z"),
        makeSnapshot("2026-08-31T00:00:00.000Z"),
      ];
      const prisma = makeFakePrisma(accountsAllPublic, [], [], snapshots);
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const svc = mod.get(ReportsService);

      const bridge = await svc.getReconciliationBridge(
        FAMILY_GROUP_ID,
        new Date("2026-07-31T17:00:00.000Z"),
        new Date("2026-08-31T16:59:59.999Z"),
        false, // member
      );

      expect(bridge.opening).toBe(1_009_000_000);
      expect(bridge.closing).toBe(1_009_000_000);
      expect(bridge.dataAvailable).toBe(true);
      expect(bridge.restrictedForViewer).toBe(false);
    });
  });
});
