import { BadRequestException } from "@nestjs/common";

import {
  AccountReconcileService,
  RECONCILE_DESCRIPTION,
} from "./account-reconcile.service";

function setup(account: { type: string; balance: string }) {
  const accounts = {
    findOne: jest.fn().mockResolvedValue({ id: "a1", ...account }),
  };
  const prisma = { account: { update: jest.fn().mockResolvedValue({}) } };
  const transactions = {
    create: jest.fn().mockResolvedValue({ id: "t1" }),
  };
  const service = new AccountReconcileService(
    accounts as never,
    prisma as never,
    transactions as never,
  );
  return { service, accounts, prisma, transactions };
}

describe("AccountReconcileService", () => {
  it("only stamps the account when the counted balance already matches", async () => {
    const { service, prisma, transactions } = setup({
      type: "cash",
      balance: "500000",
    });
    const r = await service.reconcile("f1", "a1", 500000, undefined);
    expect(transactions.create).not.toHaveBeenCalled();
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: "a1", familyGroupId: "f1" },
      data: { lastReconciledAt: expect.any(Date) },
    });
    expect(r).toMatchObject({ adjustment: "0", held: false });
  });

  it("books a shortfall as one expense without the overdraft floor", async () => {
    const { service, transactions } = setup({
      type: "ewallet",
      balance: "1250000",
    });
    const r = await service.reconcile("f1", "a1", 1000000, undefined);
    expect(transactions.create).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({
        accountId: "a1",
        type: "expense",
        amount: 250000,
        description: RECONCILE_DESCRIPTION,
      }),
      undefined,
      { enforceBankFloor: false },
    );
    expect(r.adjustment).toBe("-250000");
  });

  it("books a surplus as income", async () => {
    const { service, transactions } = setup({
      type: "cash",
      balance: "-20000",
    });
    await service.reconcile("f1", "a1", 30000, undefined);
    expect(transactions.create.mock.calls[0][1]).toMatchObject({
      type: "income",
      amount: 50000,
    });
  });

  it("leaves the stamp alone while the adjustment waits for approval", async () => {
    const { service, prisma, transactions } = setup({
      type: "cash",
      balance: "100000",
    });
    transactions.create.mockResolvedValue({
      held: true,
      allowanceRequestId: "r1",
    });
    const r = await service.reconcile("f1", "a1", 0, undefined);
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(r.held).toBe(true);
  });

  it("refuses a negative counted balance for an e-wallet", async () => {
    const { service, transactions } = setup({ type: "ewallet", balance: "0" });
    await expect(
      service.reconcile("f1", "a1", -1, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactions.create).not.toHaveBeenCalled();
  });
});
