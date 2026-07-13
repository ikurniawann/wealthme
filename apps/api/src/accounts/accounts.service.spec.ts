import { Test, type TestingModule } from "@nestjs/testing";

import { CryptoService } from "../crypto/crypto.service";
import { PrismaService } from "../prisma/prisma.service";

import { AccountsService } from "./accounts.service";

const FAMILY_GROUP_ID = "fg-1";
const ACCOUNT_ID = "account-1";

function makePrisma() {
  return {
    account: { findUnique: jest.fn(), delete: jest.fn() },
    donation: { updateMany: jest.fn() },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    ),
  };
}

describe("AccountsService.remove", () => {
  let service: AccountsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: {} },
      ],
    }).compile();
    service = module.get(AccountsService);
  });

  it("clears dangling donation links before deleting the account", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.donation.updateMany.mockResolvedValue({ count: 1 });
    prisma.account.delete.mockResolvedValue({ id: ACCOUNT_ID });

    await service.remove(FAMILY_GROUP_ID, ACCOUNT_ID);

    expect(prisma.donation.updateMany).toHaveBeenCalledWith({
      where: { familyGroupId: FAMILY_GROUP_ID, accountId: ACCOUNT_ID },
      data: { accountId: null, transactionId: null },
    });
    expect(prisma.account.delete).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
