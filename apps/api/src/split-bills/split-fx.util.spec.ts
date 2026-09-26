import { BadRequestException } from "@nestjs/common";

import { assertSplitFxComplete, settleSplitRounding } from "./split-fx.util";

const base = {
  title: "Makan Tokyo",
  payoutAccountId: "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e",
  totalAmount: 1,
  participants: [
    { name: "A", amountOwed: 1 },
    { name: "B", amountOwed: 1 },
    { name: "C", amountOwed: 1 },
  ],
};

describe("split bill FX — revisi I", () => {
  it("split bill: residue goes to participant 0 so the shares still sum to the total", () => {
    // USD 10.00 = 179139; 3.33 → 59653 (×2), 3.34 → 59832; sum 179138, residue +1.
    const out = settleSplitRounding({
      ...base,
      totalAmount: 179_139,
      participants: [
        { name: "A", amountOwed: 59_653 },
        { name: "B", amountOwed: 59_653 },
        { name: "C", amountOwed: 59_832 },
      ],
    });
    expect(out.participants.map((p) => p.amountOwed)).toEqual([
      59_654, 59_653, 59_832,
    ]);
    expect(out.participants.reduce((s, p) => s + p.amountOwed, 0)).toBe(
      out.totalAmount,
    );
  });

  it("returns the same object when there is no residue", () => {
    const dto = { ...base, totalAmount: 3 };
    expect(settleSplitRounding(dto)).toBe(dto);
  });

  it("requires the total AND every share in ONE currency", () => {
    const all = [
      { field: "totalAmount", currency: "USD" as const, amount: "10.00" },
      {
        field: "participants.0.amountOwed",
        currency: "USD" as const,
        amount: "3.33",
      },
      {
        field: "participants.1.amountOwed",
        currency: "USD" as const,
        amount: "3.33",
      },
      {
        field: "participants.2.amountOwed",
        currency: "USD" as const,
        amount: "3.34",
      },
    ];
    expect(() =>
      assertSplitFxComplete({ ...base, fxInputs: all }),
    ).not.toThrow();
    expect(() =>
      assertSplitFxComplete({ ...base, fxInputs: all.slice(0, 3) }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertSplitFxComplete({
        ...base,
        fxInputs: [...all.slice(0, 3), { ...all[3], currency: "SGD" as const }],
      }),
    ).toThrow(BadRequestException);
    expect(() => assertSplitFxComplete(base)).not.toThrow();
  });

  it("rejects fxInputs whose foreign shares do not sum exactly to the foreign total", () => {
    // USD 100.00 total but only USD 10.00 + USD 10.00 of shares — a mismatch
    // the IDR path's sum===total check would reject; the foreign path must
    // reject it too, in USD minor units, BEFORE conversion.
    const mismatched = {
      ...base,
      participants: [
        { name: "A", amountOwed: 1 },
        { name: "B", amountOwed: 1 },
      ],
      fxInputs: [
        { field: "totalAmount", currency: "USD" as const, amount: "100.00" },
        {
          field: "participants.0.amountOwed",
          currency: "USD" as const,
          amount: "10.00",
        },
        {
          field: "participants.1.amountOwed",
          currency: "USD" as const,
          amount: "10.00",
        },
      ],
    };
    expect(() => assertSplitFxComplete(mismatched)).toThrow(
      BadRequestException,
    );
  });

  it("I1 — a JPY amount with decimals (JPY has none) throws 400, not an unguarded RangeError", () => {
    // JPY has 0 minor-unit decimals; parseMinor("1000.5", "JPY") throws
    // RangeError inside parseMinor, which assertSplitFxComplete must catch
    // and turn into a BadRequestException (400), not let bubble as a 500.
    const jpyDecimals = {
      ...base,
      participants: [
        { name: "A", amountOwed: 1 },
        { name: "B", amountOwed: 1 },
      ],
      fxInputs: [
        { field: "totalAmount", currency: "JPY" as const, amount: "1000.5" },
        {
          field: "participants.0.amountOwed",
          currency: "JPY" as const,
          amount: "500",
        },
        {
          field: "participants.1.amountOwed",
          currency: "JPY" as const,
          amount: "500.5",
        },
      ],
    };
    expect(() => assertSplitFxComplete(jpyDecimals)).toThrow(
      BadRequestException,
    );
  });

  it("accepts fxInputs whose foreign shares sum exactly to the foreign total", () => {
    const exact = {
      ...base,
      participants: [
        { name: "A", amountOwed: 1 },
        { name: "B", amountOwed: 1 },
      ],
      fxInputs: [
        { field: "totalAmount", currency: "USD" as const, amount: "20.00" },
        {
          field: "participants.0.amountOwed",
          currency: "USD" as const,
          amount: "10.00",
        },
        {
          field: "participants.1.amountOwed",
          currency: "USD" as const,
          amount: "10.00",
        },
      ],
    };
    expect(() => assertSplitFxComplete(exact)).not.toThrow();
  });
});
