/**
 * EPIC-023 Task C (D3/D5) — a `dependant`/`operational` viewer's account and
 * transaction search results must be restricted to rows they own or
 * personally recorded, same as every other read path. Category results stay
 * unscoped (shared taxonomy, not a financial value).
 */
import { Test, type TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { SearchService } from "./search.service";

const FAMILY_GROUP_ID = "fg-1";
const DRIVER_USER_ID = "user-driver";

interface FakeAccount {
  id: string;
  name: string;
  institution: string | null;
  ownerUserId: string | null;
}

interface FakeTransaction {
  id: string;
  description: string | null;
  accountId: string;
  createdByUserId: string | null;
}

/** A minimal in-memory Prisma stand-in honoring `ownerUserId`/`OR` filters. */
function makeFakePrisma(
  accounts: FakeAccount[],
  transactions: FakeTransaction[],
) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return {
    account: {
      findMany: jest.fn(({ where }: { where: { ownerUserId?: string } }) => {
        const rows =
          where.ownerUserId === undefined
            ? accounts
            : accounts.filter((a) => a.ownerUserId === where.ownerUserId);
        return Promise.resolve(rows);
      }),
    },
    category: { findMany: jest.fn(() => Promise.resolve([])) },
    transaction: {
      findMany: jest.fn(
        ({
          where,
        }: {
          where: {
            OR?: {
              account?: { ownerUserId?: string };
              createdByUserId?: string;
            }[];
          };
        }) => {
          if (!where.OR) return Promise.resolve(transactions);
          const rows = transactions.filter((t) =>
            where.OR?.some(
              (clause) =>
                clause.account?.ownerUserId ===
                  accountById.get(t.accountId)?.ownerUserId ||
                clause.createdByUserId === t.createdByUserId,
            ),
          );
          return Promise.resolve(rows);
        },
      ),
    },
  };
}

describe("SearchService row-scoped roles (dependant/operational)", () => {
  let service: SearchService;

  function buildFixtures() {
    const accounts: FakeAccount[] = [
      {
        id: "acc-driver",
        name: "Kas Sopir",
        institution: null,
        ownerUserId: DRIVER_USER_ID,
      },
      {
        id: "acc-shared",
        name: "Rekening Keluarga",
        institution: "Bank Mandiri",
        ownerUserId: null,
      },
    ];
    const transactions: FakeTransaction[] = [
      {
        id: "tx-driver",
        description: "Bensin mobil",
        accountId: "acc-driver",
        createdByUserId: DRIVER_USER_ID,
      },
      {
        id: "tx-family",
        description: "Belanja mobil keluarga",
        accountId: "acc-shared",
        createdByUserId: "user-head",
      },
    ];
    return { accounts, transactions };
  }

  async function buildService(
    accounts: FakeAccount[],
    transactions: FakeTransaction[],
  ) {
    const prisma = makeFakePrisma(accounts, transactions);
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return module.get(SearchService);
  }

  it("an operational viewer's account results exclude the family-shared account — DENIAL on concrete data", async () => {
    const { accounts, transactions } = buildFixtures();
    service = await buildService(accounts, transactions);

    const result = await service.search(
      FAMILY_GROUP_ID,
      "mobil",
      Role.operational,
      DRIVER_USER_ID,
    );

    const accountResults = result.results.filter((r) => r.type === "account");
    expect(accountResults.map((r) => r.id)).toEqual(["acc-driver"]);
  });

  it("a dependant's transaction results exclude a transaction on another member's account — DENIAL on concrete data", async () => {
    const { accounts, transactions } = buildFixtures();
    service = await buildService(accounts, transactions);

    const result = await service.search(
      FAMILY_GROUP_ID,
      "mobil",
      Role.dependant,
      DRIVER_USER_ID,
    );

    const txResults = result.results.filter((r) => r.type === "transaction");
    expect(txResults.map((r) => r.id)).toEqual(["tx-driver"]);
    expect(txResults.map((r) => r.id)).not.toContain("tx-family");
  });

  it("owner/member/admin_staff/spouse (null role) see every match, unrestricted", async () => {
    const { accounts, transactions } = buildFixtures();
    service = await buildService(accounts, transactions);

    const result = await service.search(FAMILY_GROUP_ID, "mobil");

    const accountResults = result.results.filter((r) => r.type === "account");
    const txResults = result.results.filter((r) => r.type === "transaction");
    expect(accountResults.map((r) => r.id).sort()).toEqual(
      ["acc-driver", "acc-shared"].sort(),
    );
    expect(txResults.map((r) => r.id).sort()).toEqual(
      ["tx-driver", "tx-family"].sort(),
    );
  });
});
