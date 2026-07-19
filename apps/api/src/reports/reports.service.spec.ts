import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { ReportsService } from "./reports.service";

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
  // direction, not the transaction type.
  coaAccount: { direction: "INCOME" | "EXPENSE" | "TRANSFER" };
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

/**
 * A minimal in-memory Prisma stand-in that honors the `isPrivate` and
 * transitive account/category `where` filters the service builds, so these
 * tests exercise real filtering behavior rather than just call shapes.
 */
function makeFakePrisma(
  accounts: FakeAccount[],
  categories: FakeCategory[],
  transactions: FakeTransaction[],
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
                  )
                : undefined;
              return { ...a, transactions: nestedTxs };
            }),
          );
        },
      ),
    },
    asset: { findMany: jest.fn(() => Promise.resolve([])) },
    liability: { findMany: jest.fn(() => Promise.resolve([])) },
    transaction: {
      findMany: jest.fn(({ where }: { where: TxWhere }) =>
        Promise.resolve(filterTx(transactions, where).map(withRelations)),
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
});
