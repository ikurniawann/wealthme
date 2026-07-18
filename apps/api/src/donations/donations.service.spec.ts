import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { DonationsService } from "./donations.service";

const FAMILY_GROUP_ID = "fg-1";
const DONATION_ID = "don-1";
const ACCOUNT_ID = "account-1";
const TRANSACTION_ID = "tx-1";

const BASE_DONATION = {
  id: DONATION_ID,
  familyGroupId: FAMILY_GROUP_ID,
  type: "sedekah",
  recipient: "Panti Asuhan",
  amount: BigInt(100_000),
  currency: "IDR",
  donatedAt: new Date("2026-07-01T00:00:00.000Z"),
  isTaxDeductible: false,
  accountId: ACCOUNT_ID,
  transactionId: TRANSACTION_ID,
  receiptUrl: null,
  notes: null,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

function makePrisma() {
  const tx = {
    account: { findUnique: jest.fn(), update: jest.fn() },
    transaction: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    donation: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };

  return {
    donation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    account: { findUnique: jest.fn(), update: jest.fn() },
    transaction: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    tx,
  };
}

describe("DonationsService", () => {
  let service: DonationsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(DonationsService);
  });

  it("keeps the linked expense and account balance in sync when a donation changes", async () => {
    prisma.donation.findUnique.mockResolvedValue(BASE_DONATION);
    prisma.tx.donation.update.mockResolvedValue({
      ...BASE_DONATION,
      type: "infaq",
      recipient: "Rumah Singgah",
      amount: BigInt(150_000),
      donatedAt: new Date("2026-07-03T00:00:00.000Z"),
    });

    await service.update(FAMILY_GROUP_ID, DONATION_ID, {
      type: "infaq" as never,
      recipient: "Rumah Singgah",
      amount: "150000",
      donatedAt: "2026-07-03T00:00:00.000Z",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tx.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { balance: { increment: BigInt(-50_000) } },
    });
    expect(prisma.tx.transaction.update).toHaveBeenCalledWith({
      where: { id: TRANSACTION_ID, familyGroupId: FAMILY_GROUP_ID },
      data: {
        amount: BigInt(150_000),
        description: "Infaq: Rumah Singgah",
        occurredAt: new Date("2026-07-03T00:00:00.000Z"),
      },
    });
  });
});
