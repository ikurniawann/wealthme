import "reflect-metadata";

import { AssetType, DonationType, InvestmentTxType } from "@prisma/client";
import request from "supertest";

import { createFxTestApp, FG, fxTesting } from "../../test/fx-testing";
import { AssetAttachmentsService } from "../assets/asset-attachments.service";
import { AssetsController } from "../assets/assets.controller";
import { AssetsService } from "../assets/assets.service";
import { DonationsController } from "../donations/donations.controller";
import { DonationsService } from "../donations/donations.service";
import { InsurancesController } from "../insurances/insurances.controller";
import { InsurancesService } from "../insurances/insurances.service";
import { InvestmentsController } from "../investments/investments.controller";
import { InvestmentsService } from "../investments/investments.service";
import { LiabilitiesController } from "../liabilities/liabilities.controller";
import { LiabilitiesService } from "../liabilities/liabilities.service";
import { SplitBillsController } from "../split-bills/split-bills.controller";
import { SplitBillsService } from "../split-bills/split-bills.service";

import type { INestApplication } from "@nestjs/common";

const UUID = "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e";
const assets = { create: jest.fn(), update: jest.fn(), recordValue: jest.fn() };
const investments = {
  recordTransaction: jest.fn(),
  setManualPrice: jest.fn(),
  create: jest.fn(),
};
const liabilities = {
  pay: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  purchase: jest.fn(),
};
const insurances = { pay: jest.fn() };
const donations = { create: jest.fn() };
const splitBills = { create: jest.fn() };

describe("fx wiring — holdings & obligations (revisi I)", () => {
  let app: INestApplication;
  const fx = fxTesting();

  beforeAll(async () => {
    app = await createFxTestApp({
      controllers: [
        AssetsController,
        InvestmentsController,
        LiabilitiesController,
        InsurancesController,
        DonationsController,
        SplitBillsController,
      ],
      providers: [
        { provide: AssetsService, useValue: assets },
        { provide: AssetAttachmentsService, useValue: {} },
        { provide: InvestmentsService, useValue: investments },
        { provide: LiabilitiesService, useValue: liabilities },
        { provide: InsurancesService, useValue: insurances },
        { provide: DonationsService, useValue: donations },
        { provide: SplitBillsService, useValue: splitBills },
      ],
      fx,
    });
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    for (const m of [
      assets.create,
      investments.recordTransaction,
      liabilities.pay,
      liabilities.create,
      insurances.pay,
      donations.create,
      splitBills.create,
    ]) {
      m.mockResolvedValue({ id: "row-1" });
    }
  });
  const http = () => request(app.getHttpServer());

  it("asset: CNY value and a signed JPY value change", async () => {
    await http()
      .post(`/family-groups/${FG}/assets`)
      .send({
        name: "Apartemen Shanghai",
        type: Object.values(AssetType)[0],
        currentValue: "1",
        valueChangeAmount: "-1",
        fxInputs: [
          { field: "currentValue", currency: "CNY", amount: "5000.00" },
          { field: "valueChangeAmount", currency: "JPY", amount: "-1000" },
        ],
      })
      .expect(201);
    expect(assets.create.mock.calls[0][1]).toMatchObject({
      currentValue: "13342229",
      valueChangeAmount: "-113674",
    });
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data,
    ).toHaveLength(2);
  });

  it("investment buy: USD price per unit keeps sen (decimal2)", async () => {
    await http()
      .post(`/family-groups/${FG}/investments/inv-1/transactions`)
      .send({
        type: Object.values(InvestmentTxType)[0],
        quantity: "2",
        pricePerUnit: "1",
        fxInputs: [{ field: "pricePerUnit", currency: "USD", amount: "99.99" }],
      })
      .expect(201);
    expect(investments.recordTransaction.mock.calls[0][2].pricePerUnit).toBe(
      "1791210.85",
    );
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Investment",
      entityId: "inv-1",
      field: "trade.pricePerUnit",
      idrAmount: "1791210.85",
    });
  });

  it("liability pay: SGD amount, audited as Liability pay.amount", async () => {
    await http()
      .post(`/family-groups/${FG}/liabilities/liab-1/pay`)
      .send({
        sourceAccountId: UUID,
        amount: "1",
        fxInputs: [{ field: "amount", currency: "SGD", amount: "1500.25" }],
      })
      .expect(200);
    expect(liabilities.pay.mock.calls[0][2].amount).toBe("21043698");
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Liability",
      entityId: "liab-1",
      field: "pay.amount",
    });
  });

  it("an IDR liability save sends no fxInputs to the service", async () => {
    liabilities.update.mockResolvedValue({ id: "liab-1" });
    await http()
      .patch(`/family-groups/${FG}/liabilities/liab-1`)
      .send({ remainingBalance: "450000000" })
      .expect(200);
    const sent = liabilities.update.mock.calls[0][2];
    expect(sent).toEqual(
      expect.objectContaining({ remainingBalance: "450000000" }),
    );
    expect(sent).not.toHaveProperty("fxInputs");
    expect(fx.fxPort.getSnapshot).not.toHaveBeenCalled();
  });

  it("insurance premium pay: AUD 1,200.00", async () => {
    await http()
      .post(`/family-groups/${FG}/insurances/ins-1/pay`)
      .send({
        sourceAccountId: UUID,
        amount: "1",
        fxInputs: [{ field: "amount", currency: "AUD", amount: "1200.00" }],
      })
      .expect(200);
    expect(insurances.pay.mock.calls[0][2].amount).toBe("15112617");
  });

  it("donation: EUR 75.50", async () => {
    await http()
      .post(`/family-groups/${FG}/donations`)
      .send({
        type: Object.values(DonationType)[0],
        recipient: "UNICEF",
        amount: "1",
        donatedAt: "2026-09-26",
        fxInputs: [{ field: "amount", currency: "EUR", amount: "75.50" }],
      })
      .expect(201);
    expect(donations.create.mock.calls[0][1].amount).toBe("1542255");
  });

  it("split bill: converts total + shares and settles the residue on participant 0", async () => {
    await http()
      .post(`/family-groups/${FG}/split-bills`)
      .send({
        title: "Makan Tokyo",
        payoutAccountId: UUID,
        totalAmount: 3,
        participants: [
          { name: "A", amountOwed: 1 },
          { name: "B", amountOwed: 1 },
          { name: "C", amountOwed: 1 },
        ],
        fxInputs: [
          { field: "totalAmount", currency: "USD", amount: "10.00" },
          {
            field: "participants.0.amountOwed",
            currency: "USD",
            amount: "3.33",
          },
          {
            field: "participants.1.amountOwed",
            currency: "USD",
            amount: "3.33",
          },
          {
            field: "participants.2.amountOwed",
            currency: "USD",
            amount: "3.34",
          },
        ],
      })
      .expect(201);
    const sent = splitBills.create.mock.calls[0][1];
    expect(sent.totalAmount).toBe(179_139);
    expect(
      sent.participants.map((p: { amountOwed: number }) => p.amountOwed),
    ).toEqual([59_654, 59_653, 59_832]);
  });

  it("split bill: a partial fxInputs set is rejected before the service runs", async () => {
    await http()
      .post(`/family-groups/${FG}/split-bills`)
      .send({
        title: "X",
        payoutAccountId: UUID,
        totalAmount: 2,
        participants: [
          { name: "A", amountOwed: 1 },
          { name: "B", amountOwed: 1 },
        ],
        fxInputs: [{ field: "totalAmount", currency: "USD", amount: "10.00" }],
      })
      .expect(400);
    expect(splitBills.create).not.toHaveBeenCalled();
  });
});
