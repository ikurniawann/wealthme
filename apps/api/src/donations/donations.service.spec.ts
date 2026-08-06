import { BadRequestException } from "@nestjs/common";
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

  // ──────────────────────────────────────────────────────────────
  // EPIC-022 Group E (E5) — only zakat (to an approved amil) may be
  // marked tax deductible; other donation types must be rejected
  // rather than silently feeding TaxService's deductible total.
  // ──────────────────────────────────────────────────────────────

  describe("tax-deductibility type restriction (E5)", () => {
    it("rejects creating a non-zakat donation marked as tax deductible", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          type: "sedekah" as never,
          recipient: "Panti Asuhan",
          amount: "100000",
          donatedAt: "2026-07-01T00:00:00.000Z",
          isTaxDeductible: true,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("allows creating a zakat_maal donation marked as tax deductible", async () => {
      prisma.tx.donation.create.mockResolvedValue({
        ...BASE_DONATION,
        type: "zakat_maal",
        isTaxDeductible: true,
        accountId: null,
        transactionId: null,
      });

      await service.create(FAMILY_GROUP_ID, {
        type: "zakat_maal" as never,
        recipient: "BAZNAS",
        amount: "100000",
        donatedAt: "2026-07-01T00:00:00.000Z",
        isTaxDeductible: true,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("rejects updating a donation to tax-deductible when its type is not zakat", async () => {
      prisma.donation.findUnique.mockResolvedValue(BASE_DONATION); // type: "sedekah"

      await expect(
        service.update(FAMILY_GROUP_ID, DONATION_ID, {
          isTaxDeductible: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects updating a donation's type to a non-zakat type while it is still marked deductible", async () => {
      prisma.donation.findUnique.mockResolvedValue({
        ...BASE_DONATION,
        type: "zakat_maal",
        isTaxDeductible: true,
      });

      await expect(
        service.update(FAMILY_GROUP_ID, DONATION_ID, {
          type: "wakaf" as never,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // EPIC-023 F2 (D20, US-DON-6/7) — PP 60/2010 widens deductibility to
    // ANY obligatory religious contribution, not just zakat; `persepuluhan`
    // is the Christian equivalent and must now be accepted. Fails against
    // pre-F2 code, which only allowed zakat_maal/zakat_fitrah.
    it("allows creating a persepuluhan donation marked as tax deductible (PP 60/2010 widening)", async () => {
      prisma.tx.donation.create.mockResolvedValue({
        ...BASE_DONATION,
        type: "persepuluhan",
        isTaxDeductible: true,
        accountId: null,
        transactionId: null,
      });

      await service.create(FAMILY_GROUP_ID, {
        type: "persepuluhan" as never,
        recipient: "Gereja / Paroki",
        amount: "100000",
        donatedAt: "2026-07-01T00:00:00.000Z",
        isTaxDeductible: true,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    // EPIC-023 F2 (D20) — the widening is scoped to OBLIGATORY contributions
    // only; a voluntary offering (still recorded as `lainnya`, since there
    // is no dedicated "voluntary Christian offering" type) must still be
    // rejected — this is the negative counterpart to the test above.
    it("still rejects a voluntary donation type (lainnya) marked as tax deductible", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          type: "lainnya" as never,
          recipient: "Yayasan Sosial",
          amount: "100000",
          donatedAt: "2026-07-01T00:00:00.000Z",
          isTaxDeductible: true,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // EPIC-022 Group E (E5) — read-side defense in depth. The write guard
  // above only stops NEW rows; a row written by the old, unvalidated
  // code (the checkbox used to be selectable for any donation type)
  // must still be excluded from the deductible total on every read.
  // ──────────────────────────────────────────────────────────────

  describe("getTotalDeductibleAmount() excludes ineligible types (E5 read-side guard)", () => {
    it("excludes a legacy infaq row marked isTaxDeductible even though the DB still has it set", async () => {
      // Arrange — simulate pre-guard legacy data: an `infaq` row written
      // directly via Prisma (bypassing the service) with the deductible
      // flag already true, alongside a real zakat_maal donation.
      const legacyDonatedAt = new Date("2026-03-01T00:00:00.000Z");
      const seeded = [
        {
          ...BASE_DONATION,
          id: "don-legacy-infaq",
          type: "infaq",
          amount: BigInt(500_000),
          isTaxDeductible: true,
          donatedAt: legacyDonatedAt,
        },
        {
          ...BASE_DONATION,
          id: "don-real-zakat",
          type: "zakat_maal",
          amount: BigInt(2_000_000),
          isTaxDeductible: true,
          donatedAt: legacyDonatedAt,
        },
      ];

      // A faithful-enough fake: applies the same `where` predicates the
      // service builds against the seeded rows, so a regression that drops
      // the type filter would sum the legacy infaq row and fail this test.
      prisma.donation.aggregate.mockImplementation(
        async ({
          where,
        }: {
          where: {
            isTaxDeductible: boolean;
            type: { in: string[] };
            donatedAt: { gte: Date; lt: Date };
          };
        }) => {
          const matched = seeded.filter(
            (d) =>
              d.isTaxDeductible === where.isTaxDeductible &&
              where.type.in.includes(d.type) &&
              d.donatedAt >= where.donatedAt.gte &&
              d.donatedAt < where.donatedAt.lt,
          );
          const sum = matched.reduce((acc, d) => acc + d.amount, BigInt(0));
          return { _sum: { amount: sum } };
        },
      );

      // Act
      const total = await service.getTotalDeductibleAmount(
        FAMILY_GROUP_ID,
        2026,
      );

      // Assert — only the zakat_maal amount counts; the legacy infaq row
      // is excluded even though its isTaxDeductible flag is still true.
      expect(total).toBe(BigInt(2_000_000));
    });
  });
});
