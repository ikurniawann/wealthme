import "reflect-metadata";

import { AssetType, DonationType, InvestmentTxType } from "@prisma/client";
import request from "supertest";

import { createFxTestApp, FG, fxTesting } from "../../test/fx-testing";
import { AssetAttachmentsService } from "../assets/asset-attachments.service";
import { AssetsController } from "../assets/assets.controller";
import { AssetsService } from "../assets/assets.service";
import { DonationsController } from "../donations/donations.controller";
import { DonationsService } from "../donations/donations.service";
import { InheritanceController } from "../inheritance/inheritance.controller";
import { InheritanceService } from "../inheritance/inheritance.service";
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
  recordPrepayment: jest.fn(),
};
const insurances = { pay: jest.fn(), create: jest.fn() };
const donations = { create: jest.fn() };
const splitBills = { create: jest.fn() };
const inheritance = { create: jest.fn() };

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
        InheritanceController,
        DonationsController,
        SplitBillsController,
      ],
      providers: [
        { provide: AssetsService, useValue: assets },
        { provide: AssetAttachmentsService, useValue: {} },
        { provide: InvestmentsService, useValue: investments },
        { provide: LiabilitiesService, useValue: liabilities },
        { provide: InsurancesService, useValue: insurances },
        { provide: InheritanceService, useValue: inheritance },
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
      assets.recordValue,
      investments.recordTransaction,
      investments.create,
      investments.setManualPrice,
      liabilities.pay,
      liabilities.recordPrepayment,
      liabilities.create,
      insurances.pay,
      insurances.create,
      inheritance.create,
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

  it("liability prepay: SGD amount, audited as Liability prepay.amount (revisi K)", async () => {
    await http()
      .post(`/family-groups/${FG}/liabilities/liab-1/prepay`)
      .send({
        sourceAccountId: UUID,
        mode: "reduce_tenor",
        amount: "1",
        idempotencyKey: UUID,
        fxInputs: [{ field: "amount", currency: "SGD", amount: "1500.25" }],
      })
      .expect(200);
    expect(liabilities.recordPrepayment.mock.calls[0][2].amount).toBe(
      "21043698",
    );
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Liability",
      entityId: "liab-1",
      field: "prepay.amount",
    });
  });

  it("liability prepay: a replay skips the fx audit even with fxInputs (review fix 2)", async () => {
    liabilities.recordPrepayment.mockResolvedValueOnce({ replayed: true });

    await http()
      .post(`/family-groups/${FG}/liabilities/liab-1/prepay`)
      .send({
        sourceAccountId: UUID,
        mode: "reduce_tenor",
        amount: "1",
        idempotencyKey: UUID,
        fxInputs: [{ field: "amount", currency: "SGD", amount: "1500.25" }],
      })
      .expect(200);

    expect(fx.prisma.fxConversion.createMany).not.toHaveBeenCalled();
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

  // Review fix round 1, item 2 — CreateDonationDto.amount is `^\d+$`
  // (unsigned), so 0 is a valid IDR amount; the foreign path must accept it
  // too, not reject it as "not positive".
  it("donation: EUR 0.00 is accepted like IDR 0", async () => {
    await http()
      .post(`/family-groups/${FG}/donations`)
      .send({
        type: Object.values(DonationType)[0],
        recipient: "UNICEF",
        amount: "1",
        donatedAt: "2026-09-26",
        fxInputs: [{ field: "amount", currency: "EUR", amount: "0.00" }],
      })
      .expect(201);
    expect(donations.create.mock.calls[0][1].amount).toBe("0");
  });

  // Review fix round 1, item 3 — investment CREATE conversion test
  // (recordTransaction already covers the trade path).
  it("investment: create converts a SGD cost basis (decimal2)", async () => {
    await http()
      .post(`/family-groups/${FG}/investments`)
      .send({
        ticker: "BBCA",
        name: "Bank Central Asia",
        type: "saham",
        quantity: "10",
        costBasisPerUnit: "1",
        fxInputs: [
          { field: "costBasisPerUnit", currency: "SGD", amount: "15250.00" },
        ],
      })
      .expect(201);
    expect(investments.create.mock.calls[0][1].costBasisPerUnit).toBe(
      "213908607.43",
    );
  });

  // Review fix round 1, item 2 — SetManualPriceDto.price has no @Min, so 0
  // is a valid IDR price (e.g. a written-off holding); the foreign path
  // must accept it too.
  it("investment: setManualPrice accepts USD 0.00 like IDR 0", async () => {
    await http()
      .post(`/family-groups/${FG}/investments/inv-1/price`)
      .send({
        price: "1",
        fxInputs: [{ field: "price", currency: "USD", amount: "0.00" }],
      })
      .expect(201);
    expect(investments.setManualPrice.mock.calls[0][2].price).toBe("0.00");
  });

  // Review fix round 1, item 2 — CreateInvestmentTransactionDto.pricePerUnit
  // is documented ">= 0" (a gift/bonus lot at price 0); the foreign path
  // must accept it too, not reject it as "not positive".
  it("investment buy: USD 0.00 price per unit is accepted like IDR 0", async () => {
    await http()
      .post(`/family-groups/${FG}/investments/inv-1/transactions`)
      .send({
        type: Object.values(InvestmentTxType)[0],
        quantity: "2",
        pricePerUnit: "1",
        fxInputs: [{ field: "pricePerUnit", currency: "USD", amount: "0.00" }],
      })
      .expect(201);
    expect(investments.recordTransaction.mock.calls[0][2].pricePerUnit).toBe(
      "0.00",
    );
  });

  // Review fix round 1, item 3 — liability CREATE conversion test.
  // FxInputService.run() only overwrites the fxInputs-named fields before
  // calling the unchanged (sub-plan G) service method, so its interest
  // method / installment recompute still runs on the converted values —
  // not re-asserted here since liabilities.service.spec.ts (real service)
  // already covers that recompute and stays green.
  it("liability: create converts totalDebt and installmentAmount (SGD)", async () => {
    await http()
      .post(`/family-groups/${FG}/liabilities`)
      .send({
        name: "KPR Rumah",
        type: "kpr",
        totalDebt: "1",
        remainingBalance: "1",
        installmentAmount: "1",
        fxInputs: [
          { field: "totalDebt", currency: "SGD", amount: "50000.00" },
          { field: "installmentAmount", currency: "SGD", amount: "1500.00" },
        ],
      })
      .expect(201);
    expect(liabilities.create.mock.calls[0][1]).toMatchObject({
      totalDebt: "701339697",
      installmentAmount: "21040191",
    });
  });

  // Review fix round 1, item 3 — insurance CREATE conversion test.
  it("insurance: create converts premiumAmount and coverageAmount (AUD)", async () => {
    await http()
      .post(`/family-groups/${FG}/insurances`)
      .send({
        name: "Asuransi Jiwa",
        type: "jiwa",
        premiumAmount: "1",
        coverageAmount: "1",
        fxInputs: [
          { field: "premiumAmount", currency: "AUD", amount: "100.00" },
          { field: "coverageAmount", currency: "AUD", amount: "50000.00" },
        ],
      })
      .expect(201);
    expect(insurances.create.mock.calls[0][1]).toMatchObject({
      premiumAmount: "1259385",
      coverageAmount: "629692355",
    });
  });

  // Review fix round 1, item 3 — asset recordValue (history) conversion test.
  it("asset: recordValue converts a dated valuation (CNY)", async () => {
    await http()
      .post(`/family-groups/${FG}/assets/asset-1/history`)
      .send({
        value: "1",
        fxInputs: [{ field: "value", currency: "CNY", amount: "1000.00" }],
      })
      .expect(201);
    expect(assets.recordValue.mock.calls[0][2].value).toBe("2668446");
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Asset",
      entityId: "asset-1",
      field: "history.value",
    });
  });

  // Review fix round 1, item 3 — inheritance CREATE conversion test.
  it("inheritance: create converts estimatedValue (EUR)", async () => {
    await http()
      .post(`/family-groups/${FG}/inheritance`)
      .send({
        name: "Rumah warisan",
        assetType: "properti",
        estimatedValue: 1,
        fxInputs: [
          { field: "estimatedValue", currency: "EUR", amount: "500.00" },
        ],
      })
      .expect(201);
    expect(inheritance.create.mock.calls[0][1].estimatedValue).toBe(10213610);
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

  // Review fix round 1, item 1 — mismatched foreign shares must be rejected
  // BEFORE conversion, not silently absorbed into participant 0's residue.
  it("split bill: foreign shares that don't sum to the foreign total are rejected before the service runs", async () => {
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
        fxInputs: [
          { field: "totalAmount", currency: "USD", amount: "100.00" },
          {
            field: "participants.0.amountOwed",
            currency: "USD",
            amount: "10.00",
          },
          {
            field: "participants.1.amountOwed",
            currency: "USD",
            amount: "10.00",
          },
        ],
      })
      .expect(400);
    expect(splitBills.create).not.toHaveBeenCalled();
  });
});
