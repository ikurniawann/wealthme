import { Logger, ServiceUnavailableException } from "@nestjs/common";

import { fxTesting, TEST_SNAPSHOT } from "../../test/fx-testing";

const SPEC = { balance: { kind: "int" as const, allowNegative: true } };

describe("FxInputService.run — revisi I", () => {
  it("passes the DTO through untouched when fxInputs is absent (no snapshot, no audit)", async () => {
    const { service, fxPort, prisma } = fxTesting();
    const persist = jest.fn().mockResolvedValue({ id: "acc-1" });
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: { name: "BCA", balance: 5000 },
        spec: SPEC,
      },
      persist,
    );
    expect(persist).toHaveBeenCalledWith({ name: "BCA", balance: 5000 });
    expect(fxPort.getSnapshot).not.toHaveBeenCalled();
    expect(prisma.fxConversion.createMany).not.toHaveBeenCalled();
  });

  it("an empty fxInputs array is the same as none, and the key is stripped", async () => {
    const { service, fxPort } = fxTesting();
    const persist = jest.fn().mockResolvedValue({ id: "acc-1" });
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: { balance: 5000, fxInputs: [] },
        spec: SPEC,
      },
      persist,
    );
    expect(persist).toHaveBeenCalledWith({ balance: 5000 });
    expect(fxPort.getSnapshot).not.toHaveBeenCalled();
  });

  it("overwrites the client preview with the server conversion and records the audit row", async () => {
    const { service, prisma } = fxTesting();
    const persist = jest.fn().mockResolvedValue({ id: "acc-9" });
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: {
          balance: 1,
          fxInputs: [{ field: "balance", currency: "USD", amount: "100.00" }],
        },
        spec: SPEC,
      },
      persist,
    );
    expect(persist).toHaveBeenCalledWith({ balance: 1_791_390 });
    expect(prisma.fxConversion.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          familyGroupId: "fg-1",
          entity: "Account",
          entityId: "acc-9",
          field: "balance",
          originalAmount: "100.00",
          originalCurrency: "USD",
          idrAmount: "1791390",
          idrPerUnit: "17913.899851",
          rateDate: new Date("2026-09-25T00:00:00.000Z"),
          rateSource: "frankfurter",
          rateStale: false,
          createdByUserId: "u-1",
        }),
      ],
    });
  });

  it("uses entityId + fieldPrefix for action routes (e.g. liability pay)", async () => {
    const { service, prisma } = fxTesting();
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: null,
        entity: "Liability",
        entityId: "liab-1",
        fieldPrefix: "pay",
        dto: {
          amount: "1",
          fxInputs: [{ field: "amount", currency: "SGD", amount: "10.00" }],
        },
        spec: { amount: { kind: "digits", positive: true } },
      },
      jest.fn().mockResolvedValue({ id: "liab-1" }),
    );
    expect(
      prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Liability",
      entityId: "liab-1",
      field: "pay.amount",
      createdByUserId: null,
    });
  });

  it("locate() picks the entity from the result (held expense → AllowanceRequest)", async () => {
    const { service, prisma } = fxTesting();
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Transaction",
        locate: (r: {
          held?: true;
          allowanceRequestId?: string;
          id?: string;
        }) =>
          r.held
            ? { entity: "AllowanceRequest", entityId: r.allowanceRequestId! }
            : { entity: "Transaction", entityId: r.id! },
        dto: {
          amount: 1,
          fxInputs: [{ field: "amount", currency: "USD", amount: "5.00" }],
        },
        spec: { amount: { kind: "int", positive: true } },
      },
      jest.fn().mockResolvedValue({ held: true, allowanceRequestId: "ar-1" }),
    );
    expect(
      prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "AllowanceRequest",
      entityId: "ar-1",
    });
  });

  it("still returns the persisted result when locate() throws after commit (no duplicate-write retry)", async () => {
    const { service, prisma } = fxTesting();
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const result = await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Transaction",
        locate: () => {
          throw new Error("locate blew up");
        },
        dto: {
          amount: 1,
          fxInputs: [{ field: "amount", currency: "USD", amount: "5.00" }],
        },
        spec: { amount: { kind: "int", positive: true } },
      },
      jest.fn().mockResolvedValue({ id: "acc-1" }),
    );
    expect(result).toEqual({ id: "acc-1" });
    expect(prisma.fxConversion.createMany).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("locate() threw"),
      expect.any(String),
    );
    errorSpy.mockRestore();
  });

  it("does not call persist when resolution fails (400 before any write)", async () => {
    const { service } = fxTesting();
    const persist = jest.fn();
    await expect(
      service.run(
        {
          familyGroupId: "fg-1",
          userId: "u-1",
          entity: "Account",
          dto: {
            balance: 1,
            fxInputs: [{ field: "name", currency: "USD", amount: "1.00" }],
          },
          spec: SPEC,
        },
        persist,
      ),
    ).rejects.toThrow("fxInputs");
    expect(persist).not.toHaveBeenCalled();
  });

  it("logs and still returns when the audit insert fails", async () => {
    const { service, prisma } = fxTesting();
    prisma.fxConversion.createMany.mockRejectedValueOnce(new Error("db down"));
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const result = await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: {
          balance: 1,
          fxInputs: [{ field: "balance", currency: "USD", amount: "1.00" }],
        },
        spec: SPEC,
      },
      jest.fn().mockResolvedValue({ id: "acc-1" }),
    );
    expect(result).toEqual({ id: "acc-1" });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("fx_conversions insert failed after commit"),
      expect.any(String),
    );
    errorSpy.mockRestore();
  });

  it("I2 — refuses an fxInputs write with 503 when the snapshot is indicative", async () => {
    const { service, prisma } = fxTesting({
      ...TEST_SNAPSHOT,
      source: "indicative",
      stale: true,
    });
    const persist = jest.fn().mockResolvedValue({ id: "acc-1" });
    await expect(
      service.run(
        {
          familyGroupId: "fg-1",
          userId: "u-1",
          entity: "Account",
          dto: {
            balance: 1,
            fxInputs: [{ field: "balance", currency: "USD", amount: "1.00" }],
          },
          spec: SPEC,
        },
        persist,
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(persist).not.toHaveBeenCalled();
    expect(prisma.fxConversion.createMany).not.toHaveBeenCalled();
  });

  // Revisi K bug 2 — the web app used to map EVERY 503 to the FX refusal
  // toast, because it matched on HTTP status alone. The 503's response body
  // now carries a machine code so the web app can match on THIS specific
  // refusal instead of the status shared by every 503.
  it("Revisi K bug 2 — the 503's response body carries code: FX_RATE_UNAVAILABLE", async () => {
    const { service } = fxTesting({
      ...TEST_SNAPSHOT,
      source: "indicative",
      stale: true,
    });
    const persist = jest.fn().mockResolvedValue({ id: "acc-1" });
    try {
      await service.run(
        {
          familyGroupId: "fg-1",
          userId: "u-1",
          entity: "Account",
          dto: {
            balance: 1,
            fxInputs: [{ field: "balance", currency: "USD", amount: "1.00" }],
          },
          spec: SPEC,
        },
        persist,
      );
      throw new Error("expected service.run to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      const response = (err as ServiceUnavailableException).getResponse();
      expect(response).toMatchObject({ code: "FX_RATE_UNAVAILABLE" });
    }
  });

  it("I2 — an IDR submission (no fxInputs) is unaffected by an indicative snapshot", async () => {
    const { service, fxPort } = fxTesting({
      ...TEST_SNAPSHOT,
      source: "indicative",
      stale: true,
    });
    const persist = jest.fn().mockResolvedValue({ id: "acc-1" });
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: { name: "BCA", balance: 5000 },
        spec: SPEC,
      },
      persist,
    );
    expect(persist).toHaveBeenCalledWith({ name: "BCA", balance: 5000 });
    expect(fxPort.getSnapshot).not.toHaveBeenCalled();
  });

  it("the transform hook runs after overrides and before persist", async () => {
    const { service } = fxTesting();
    const persist = jest.fn().mockResolvedValue({ id: "x" });
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: {
          balance: 1,
          fxInputs: [{ field: "balance", currency: "USD", amount: "1.00" }],
        },
        spec: SPEC,
        transform: (d) => ({ ...d, balance: (d.balance as number) + 1 }),
      },
      persist,
    );
    expect(persist).toHaveBeenCalledWith({ balance: 17_915 });
  });
});
