import { BadRequestException } from "@nestjs/common";

import { TEST_SNAPSHOT } from "../../test/fx-testing";

import { applyFxOverrides, resolveFxInputs } from "./fx-input.resolve";

import type { FxFieldSpec } from "./fx-input.resolve";

const SPEC: FxFieldSpec = {
  balance: { kind: "int", allowNegative: true },
  amount: { kind: "digits", positive: true, max: 999_999_999_999n },
  pricePerUnit: { kind: "decimal2", positive: true },
  "participants.*.amountOwed": { kind: "int" },
};

describe("resolveFxInputs — revisi I", () => {
  it("converts an int field and records the audit payload", () => {
    const r = resolveFxInputs(
      [{ field: "balance", currency: "USD", amount: "100.00" }],
      SPEC,
      TEST_SNAPSHOT,
    );
    expect(r.overrides).toEqual([{ path: "balance", value: 1_791_390 }]);
    expect(r.pending).toEqual([
      {
        field: "balance",
        originalAmount: "100.00",
        originalCurrency: "USD",
        idrAmount: "1791390",
        idrPerUnit: "17913.899851",
        rateDate: "2026-09-25",
        rateSource: "frankfurter",
        rateStale: false,
      },
    ]);
  });

  it("digits fields become digit strings, decimal2 fields keep sen", () => {
    const r = resolveFxInputs(
      [
        { field: "amount", currency: "JPY", amount: "1500" },
        { field: "pricePerUnit", currency: "USD", amount: "12.34" },
      ],
      SPEC,
      TEST_SNAPSHOT,
    );
    expect(r.overrides).toEqual([
      { path: "amount", value: "170511" },
      { path: "pricePerUnit", value: "221057.52" },
    ]);
  });

  it("negative allowed only when the spec allows it", () => {
    expect(
      resolveFxInputs(
        [{ field: "balance", currency: "USD", amount: "-20.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ).overrides,
    ).toEqual([{ path: "balance", value: -358_278 }]);
    expect(() =>
      resolveFxInputs(
        [{ field: "amount", currency: "USD", amount: "-1.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("positive fields reject zero", () => {
    expect(() =>
      resolveFxInputs(
        [{ field: "amount", currency: "USD", amount: "0.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("enforces max after conversion", () => {
    expect(() =>
      resolveFxInputs(
        [{ field: "amount", currency: "EUR", amount: "99999999.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects a field outside the spec", () => {
    expect(() =>
      resolveFxInputs(
        [{ field: "familyGroupId", currency: "USD", amount: "1.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects a duplicate field", () => {
    expect(() =>
      resolveFxInputs(
        [
          { field: "balance", currency: "USD", amount: "1.00" },
          { field: "balance", currency: "SGD", amount: "1.00" },
        ],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("JPY rejects decimals with 400, not a silent round", () => {
    expect(() =>
      resolveFxInputs(
        [{ field: "balance", currency: "JPY", amount: "10.50" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("matches array paths through the * rule", () => {
    const r = resolveFxInputs(
      [
        {
          field: "participants.1.amountOwed",
          currency: "USD",
          amount: "10.00",
        },
      ],
      SPEC,
      TEST_SNAPSHOT,
    );
    expect(r.overrides).toEqual([
      { path: "participants.1.amountOwed", value: 179_139 },
    ]);
  });

  it("labels a stale snapshot on every pending row", () => {
    const r = resolveFxInputs(
      [{ field: "balance", currency: "USD", amount: "1.00" }],
      SPEC,
      { ...TEST_SNAPSHOT, stale: true, source: "indicative" },
    );
    expect(r.pending[0]).toMatchObject({
      rateStale: true,
      rateSource: "indicative",
    });
  });
});

describe("applyFxOverrides — revisi I", () => {
  it("returns a new object and never mutates the input", () => {
    const dto = {
      name: "Kas",
      balance: 1,
      participants: [{ amountOwed: 1 }, { amountOwed: 2 }],
    };
    const out = applyFxOverrides(dto, [
      { path: "balance", value: 99 },
      { path: "participants.1.amountOwed", value: 7 },
    ]);
    expect(out).toEqual({
      name: "Kas",
      balance: 99,
      participants: [{ amountOwed: 1 }, { amountOwed: 7 }],
    });
    expect(dto.balance).toBe(1);
    expect(dto.participants[1].amountOwed).toBe(2);
  });

  it("rejects an array index that does not exist", () => {
    expect(() =>
      applyFxOverrides({ participants: [{ amountOwed: 1 }] }, [
        { path: "participants.3.amountOwed", value: 1 },
      ]),
    ).toThrow(BadRequestException);
  });
});
