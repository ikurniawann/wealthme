import "reflect-metadata";

import request from "supertest";

import { createFxTestApp, FG, fxTesting } from "../../test/fx-testing";
import { AccountsController } from "../accounts/accounts.controller";
import { AccountsService } from "../accounts/accounts.service";
import { AllowanceRequestsController } from "../allowance-requests/allowance-requests.controller";
import { AllowanceRequestsService } from "../allowance-requests/allowance-requests.service";
import { BudgetsController } from "../budgets/budgets.controller";
import { BudgetsService } from "../budgets/budgets.service";
import { GoalsController } from "../goals/goals.controller";
import { GoalsService } from "../goals/goals.service";
import { TransactionsController } from "../transactions/transactions.controller";
import { TransactionsService } from "../transactions/transactions.service";

import type { INestApplication } from "@nestjs/common";

const UUID = "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e";
const accounts = { create: jest.fn(), update: jest.fn(), findOne: jest.fn() };
const transactions = { create: jest.fn(), update: jest.fn() };
const budgets = { create: jest.fn(), update: jest.fn() };
const goals = { create: jest.fn(), update: jest.fn(), contribute: jest.fn() };
const allowance = { create: jest.fn() };

describe("fx wiring — ledger routes (revisi I)", () => {
  let app: INestApplication;
  const fx = fxTesting();

  beforeAll(async () => {
    app = await createFxTestApp({
      controllers: [
        AccountsController,
        TransactionsController,
        BudgetsController,
        GoalsController,
        AllowanceRequestsController,
      ],
      providers: [
        { provide: AccountsService, useValue: accounts },
        { provide: TransactionsService, useValue: transactions },
        { provide: BudgetsService, useValue: budgets },
        { provide: GoalsService, useValue: goals },
        { provide: AllowanceRequestsService, useValue: allowance },
      ],
      fx,
    });
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    accounts.create.mockResolvedValue({ id: "acc-1" });
    accounts.update.mockResolvedValue({ id: "acc-1" });
    accounts.findOne.mockResolvedValue({ id: "acc-1", type: "bank" });
    transactions.create.mockResolvedValue({ id: "tx-1" });
    transactions.update.mockResolvedValue({ id: "tx-1" });
    budgets.create.mockResolvedValue({ id: "b-1" });
    goals.contribute.mockResolvedValue({
      contribution: { id: "gc-1" },
      goal: { id: "g-1" },
    });
    allowance.create.mockResolvedValue({ id: "ar-1" });
  });

  const http = () => request(app.getHttpServer());

  it("IDR create reaches the service unchanged, with no fxInputs key and no audit row", async () => {
    const body = { name: "BCA", type: "bank", balance: 5_000_000 };
    const res = await http().post(`/family-groups/${FG}/accounts`).send(body);
    expect(res.status).toBe(201);
    const sent = accounts.create.mock.calls[0][1];
    expect(sent).toEqual(expect.objectContaining(body));
    expect(sent).not.toHaveProperty("fxInputs");
    expect(fx.fxPort.getSnapshot).not.toHaveBeenCalled();
    expect(fx.prisma.fxConversion.createMany).not.toHaveBeenCalled();
  });

  it("server overwrites a tampered preview: USD 100.00 → 1.791.390", async () => {
    await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "Chase",
        type: "bank",
        balance: 1,
        fxInputs: [{ field: "balance", currency: "USD", amount: "100.00" }],
      })
      .expect(201);
    expect(accounts.create.mock.calls[0][1].balance).toBe(1_791_390);
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      familyGroupId: FG,
      entity: "Account",
      entityId: "acc-1",
      field: "balance",
      originalCurrency: "USD",
      createdByUserId: "u-owner",
    });
  });

  it("cash account accepts a negative foreign balance (USD -20.00 → -358.278)", async () => {
    await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "Dompet",
        type: "cash",
        balance: -358_278,
        fxInputs: [{ field: "balance", currency: "USD", amount: "-20.00" }],
      })
      .expect(201);
    expect(accounts.create.mock.calls[0][1].balance).toBe(-358_278);
  });

  it("bank account rejects a negative foreign balance before the service runs", async () => {
    const res = await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "BCA",
        type: "bank",
        balance: 0,
        fxInputs: [{ field: "balance", currency: "USD", amount: "-20.00" }],
      });
    expect(res.status).toBe(400);
    expect(accounts.create).not.toHaveBeenCalled();
  });

  it("cash edit without `type` still accepts USD -20 (type comes from the stored account)", async () => {
    accounts.findOne.mockResolvedValue({ id: "acc-cash", type: "cash" });
    await http()
      .patch(`/family-groups/${FG}/accounts/acc-cash`)
      .send({
        balance: 0,
        fxInputs: [{ field: "balance", currency: "USD", amount: "-20.00" }],
      })
      .expect(200);
    expect(accounts.findOne).toHaveBeenCalledWith(
      FG,
      "acc-cash",
      expect.anything(),
      expect.anything(),
      "u-owner",
    );
    expect(accounts.update.mock.calls[0][2].balance).toBe(-358_278);
  });

  it('`type: "cash"` sent for a stored bank account does NOT allow a negative foreign balance', async () => {
    accounts.findOne.mockResolvedValue({ id: "acc-1", type: "bank" });
    const res = await http()
      .patch(`/family-groups/${FG}/accounts/acc-1`)
      .send({
        type: "cash",
        balance: 0,
        fxInputs: [{ field: "balance", currency: "USD", amount: "-20.00" }],
      });
    expect(res.status).toBe(400);
    expect(accounts.update).not.toHaveBeenCalled();
  });

  it("PATCH without fxInputs never converts (editing keeps the stored IDR)", async () => {
    await http()
      .patch(`/family-groups/${FG}/accounts/acc-1`)
      .send({ name: "BCA Utama" })
      .expect(200);
    expect(accounts.findOne).not.toHaveBeenCalled();
    expect(fx.fxPort.getSnapshot).not.toHaveBeenCalled();
    expect(fx.prisma.fxConversion.createMany).not.toHaveBeenCalled();
  });

  it("rejects fxInputs naming IDR or a non-money field", async () => {
    await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "X",
        type: "bank",
        balance: 1,
        fxInputs: [{ field: "balance", currency: "IDR", amount: "1" }],
      })
      .expect(400);
    await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "X",
        type: "bank",
        balance: 1,
        fxInputs: [{ field: "name", currency: "USD", amount: "1.00" }],
      })
      .expect(400);
    expect(accounts.create).not.toHaveBeenCalled();
  });

  it("transaction create: a held expense is audited against its AllowanceRequest", async () => {
    transactions.create.mockResolvedValue({
      held: true,
      allowanceRequestId: "ar-9",
      amount: "179139",
    });
    await http()
      .post(`/family-groups/${FG}/transactions`)
      .send({
        accountId: UUID,
        amount: 1,
        type: "expense",
        occurredAt: "2026-09-26T00:00:00.000Z",
        fxInputs: [{ field: "amount", currency: "USD", amount: "10.00" }],
      });
    expect(transactions.create.mock.calls[0][1].amount).toBe(179_139);
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "AllowanceRequest",
      entityId: "ar-9",
    });
  });

  it("transaction PATCH audits against the route id", async () => {
    await http()
      .patch(`/family-groups/${FG}/transactions/tx-7`)
      .send({
        amount: 1,
        fxInputs: [{ field: "amount", currency: "JPY", amount: "1500" }],
      })
      .expect(200);
    expect(transactions.update.mock.calls[0][2].amount).toBe(170_511);
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Transaction",
      entityId: "tx-7",
    });
  });

  it("transaction adminFee is not convertible (IDR-only by design)", async () => {
    await http()
      .post(`/family-groups/${FG}/transactions`)
      .send({
        accountId: UUID,
        toAccountId: "6f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e",
        amount: 1,
        adminFee: 1,
        type: "transfer",
        occurredAt: "2026-09-26T00:00:00.000Z",
        fxInputs: [{ field: "adminFee", currency: "USD", amount: "1.00" }],
      })
      .expect(400);
  });

  it("budget limit converts (SGD)", async () => {
    await http()
      .post(`/family-groups/${FG}/budgets`)
      .send({
        categoryId: UUID,
        period: "monthly",
        limitAmount: 1,
        fxInputs: [
          { field: "limitAmount", currency: "SGD", amount: "1500.25" },
        ],
      })
      .expect(201);
    expect(budgets.create.mock.calls[0][1].limitAmount).toBe(21_043_698);
  });

  it("goal contribution converts its digit-string amount and audits the contribution id", async () => {
    await http()
      .post(`/family-groups/${FG}/goals/g-1/contributions`)
      .send({
        amount: "1",
        accountId: UUID,
        fxInputs: [{ field: "amount", currency: "USD", amount: "10.00" }],
      })
      .expect(201);
    expect(goals.contribute.mock.calls[0][2].amount).toBe("179139");
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "GoalContribution",
      entityId: "gc-1",
    });
  });

  it("allowance request converts (JPY, whole units)", async () => {
    await http()
      .post(`/family-groups/${FG}/allowance-requests`)
      .send({
        targetAccountId: UUID,
        amount: 1,
        fxInputs: [{ field: "amount", currency: "JPY", amount: "1500" }],
      })
      .expect(201);
    expect(allowance.create.mock.calls[0][2].amount).toBe(170_511);
  });
});
