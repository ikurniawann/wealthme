import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { CoaAccountsService } from "./coa-accounts.service";

const FAMILY_GROUP_ID = "fg-1";
const ACCOUNT_ID = "coa-1";

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function makePrisma() {
  return {
    coaAccount: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
  };
}

function buildRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ACCOUNT_ID,
    familyGroupId: FAMILY_GROUP_ID,
    code: "20001",
    name: "Household Needs",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: null,
    parentCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("CoaAccountsService", () => {
  let service: CoaAccountsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoaAccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CoaAccountsService);
  });

  describe("create — EPIC-021 #4 auto-gen", () => {
    it("auto-generates the next free code within the group's range when code is omitted", async () => {
      prisma.coaAccount.findMany.mockResolvedValueOnce([
        { code: "20001" },
        { code: "20002" },
      ]);
      prisma.coaAccount.create.mockResolvedValue(buildRow({ code: "20003" }));

      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Household Needs",
        groupNum: 2,
        direction: "EXPENSE",
      });

      expect(prisma.coaAccount.findMany).toHaveBeenCalledWith({
        where: { familyGroupId: FAMILY_GROUP_ID, groupNum: 2 },
        select: { code: true },
      });
      expect(prisma.coaAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: "20003" }),
        }),
      );
      expect(result.code).toBe("20003");
    });

    it("treats a blank code the same as an omitted one (auto-gen)", async () => {
      prisma.coaAccount.findMany.mockResolvedValueOnce([]);
      prisma.coaAccount.create.mockResolvedValue(buildRow({ code: "20001" }));

      await service.create(FAMILY_GROUP_ID, {
        code: "   ",
        name: "Household Needs",
        groupNum: 2,
        direction: "EXPENSE",
      });

      expect(prisma.coaAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: "20001" }),
        }),
      );
    });

    it("accepts a caller-supplied code that matches the group prefix", async () => {
      prisma.coaAccount.create.mockResolvedValue(buildRow({ code: "20077" }));

      const result = await service.create(FAMILY_GROUP_ID, {
        code: "20077",
        name: "Custom",
        groupNum: 2,
        direction: "EXPENSE",
      });

      expect(prisma.coaAccount.findMany).not.toHaveBeenCalled();
      expect(result.code).toBe("20077");
    });

    it("rejects a caller-supplied code whose first digit does not match groupNum", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          code: "10001",
          name: "Wrong Group",
          groupNum: 2,
          direction: "EXPENSE",
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.coaAccount.create).not.toHaveBeenCalled();
    });

    it("rejects a duplicate code with a 409 Conflict", async () => {
      prisma.coaAccount.create.mockRejectedValue(uniqueViolation());

      await expect(
        service.create(FAMILY_GROUP_ID, {
          code: "20001",
          name: "Duplicate",
          groupNum: 2,
          direction: "EXPENSE",
        }),
      ).rejects.toThrow(ConflictException);
    });

    // EPIC-023 review follow-up — group 4/5 (Receivable/Payable) must stay
    // TRANSFER; accepting INCOME/EXPENSE for them would silently recreate the
    // COA-shelving bug this epic's migration fixed.
    it("rejects an EXPENSE direction for a group-5 (Account Payable) account", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          code: "50001",
          name: "Utang",
          groupNum: 5,
          direction: "EXPENSE",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.coaAccount.create).not.toHaveBeenCalled();
    });

    it("rejects an INCOME direction for a group-4 (Account Receivable) account", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          code: "40001",
          name: "Piutang",
          groupNum: 4,
          direction: "INCOME",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.coaAccount.create).not.toHaveBeenCalled();
    });

    it("accepts TRANSFER direction for a group-4/5 account", async () => {
      prisma.coaAccount.create.mockResolvedValue(
        buildRow({ code: "50001", groupNum: 5, direction: "TRANSFER" }),
      );

      const result = await service.create(FAMILY_GROUP_ID, {
        code: "50001",
        name: "Utang",
        groupNum: 5,
        direction: "TRANSFER",
      });

      expect(result.direction).toBe("TRANSFER");
    });
  });

  describe("update — EPIC-021 #4 / Decision #11 editable code", () => {
    it("updates the code when it still satisfies the group-prefix invariant", async () => {
      prisma.coaAccount.findUnique.mockResolvedValue(buildRow());
      prisma.coaAccount.update.mockResolvedValue(buildRow({ code: "20042" }));

      const result = await service.update(FAMILY_GROUP_ID, ACCOUNT_ID, {
        code: "20042",
      });

      expect(prisma.coaAccount.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { code: "20042" },
      });
      expect(result.code).toBe("20042");
    });

    it("rejects an updated code whose first digit no longer matches the account's groupNum", async () => {
      prisma.coaAccount.findUnique.mockResolvedValue(buildRow({ groupNum: 2 }));

      await expect(
        service.update(FAMILY_GROUP_ID, ACCOUNT_ID, { code: "30001" }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.coaAccount.update).not.toHaveBeenCalled();
    });

    it("rejects a blank code on update", async () => {
      prisma.coaAccount.findUnique.mockResolvedValue(buildRow());

      await expect(
        service.update(FAMILY_GROUP_ID, ACCOUNT_ID, { code: "  " }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects changing groupNum without an updated code that matches the new group", async () => {
      prisma.coaAccount.findUnique.mockResolvedValue(
        buildRow({ code: "20001", groupNum: 2 }),
      );

      await expect(
        service.update(FAMILY_GROUP_ID, ACCOUNT_ID, { groupNum: 3 }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.coaAccount.update).not.toHaveBeenCalled();
    });

    it("allows changing groupNum together with a matching new code", async () => {
      prisma.coaAccount.findUnique.mockResolvedValue(
        buildRow({ code: "20001", groupNum: 2 }),
      );
      prisma.coaAccount.update.mockResolvedValue(
        buildRow({ code: "30001", groupNum: 3 }),
      );

      const result = await service.update(FAMILY_GROUP_ID, ACCOUNT_ID, {
        groupNum: 3,
        code: "30001",
      });

      expect(result.groupNum).toBe(3);
      expect(result.code).toBe("30001");
    });

    it("rejects a duplicate code on update with a 409 Conflict", async () => {
      prisma.coaAccount.findUnique.mockResolvedValue(buildRow());
      prisma.coaAccount.update.mockRejectedValue(uniqueViolation());

      await expect(
        service.update(FAMILY_GROUP_ID, ACCOUNT_ID, { code: "20099" }),
      ).rejects.toThrow(ConflictException);
    });

    it("leaves the code untouched when not provided in the patch", async () => {
      prisma.coaAccount.findUnique.mockResolvedValue(buildRow());
      prisma.coaAccount.update.mockResolvedValue(buildRow({ name: "Renamed" }));

      await service.update(FAMILY_GROUP_ID, ACCOUNT_ID, { name: "Renamed" });

      expect(prisma.coaAccount.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { name: "Renamed" },
      });
    });

    // EPIC-023 review follow-up — checked against the EFFECTIVE (post-patch)
    // groupNum/direction so a PATCH touching only one of the two fields is
    // still caught, not just a combined `{ groupNum, direction }` payload.
    it("rejects patching an existing group-5 account's direction away from TRANSFER", async () => {
      prisma.coaAccount.findUnique.mockResolvedValue(
        buildRow({ groupNum: 5, direction: "TRANSFER", code: "50001" }),
      );

      await expect(
        service.update(FAMILY_GROUP_ID, ACCOUNT_ID, { direction: "EXPENSE" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.coaAccount.update).not.toHaveBeenCalled();
    });

    it("rejects patching groupNum to 4 while direction stays EXPENSE", async () => {
      prisma.coaAccount.findUnique.mockResolvedValue(
        buildRow({ groupNum: 2, direction: "EXPENSE", code: "20001" }),
      );

      await expect(
        service.update(FAMILY_GROUP_ID, ACCOUNT_ID, {
          groupNum: 4,
          code: "40001",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.coaAccount.update).not.toHaveBeenCalled();
    });
  });
});
