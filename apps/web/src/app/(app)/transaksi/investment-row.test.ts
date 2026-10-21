import type { TransactionDto } from "@wealthme/contracts";
import { investmentBreakdown, isInvestmentTx, rowKind } from "./investment-row";

type Leg = NonNullable<TransactionDto["investment"]>;

const leg = (over: Partial<Leg> = {}): Leg => ({
  id: "inv-1",
  ticker: "ETH",
  name: "Ethereum",
  side: "sell",
  quantity: "0.01",
  unitPrice: "42000000",
  gross: "420000",
  fee: "1000",
  net: "419000",
  currency: "IDR",
  ...over,
});

describe("investmentBreakdown", () => {
  it("reads the structured investment field", () => {
    expect(investmentBreakdown({ investment: leg() })).toEqual({
      id: "inv-1",
      symbol: "ETH",
      name: "Ethereum",
      side: "sell",
      quantity: 0.01,
      unitPrice: 42000000,
      gross: 420000,
      fee: 1000,
      net: 419000,
      isIdr: true,
    });
  });

  it("drops rupiah figures for a foreign-currency ledger row", () => {
    expect(
      investmentBreakdown({ investment: leg({ currency: "USD" }) }),
    ).toMatchObject({ unitPrice: null, gross: null, fee: null, isIdr: false });
  });

  it("is null when the field is absent, whatever the description says", () => {
    expect(investmentBreakdown({ investment: null })).toBeNull();
    expect(investmentBreakdown({})).toBeNull();
  });
});

describe("rowKind", () => {
  it("marks investment legs, plain transfers and cash rows", () => {
    expect(rowKind({ type: "transfer", investment: leg() })).toBe("investment");
    expect(isInvestmentTx({ investment: leg() })).toBe(true);
    expect(rowKind({ type: "transfer" })).toBe("transfer");
    expect(rowKind({ type: "expense", investment: null })).toBe("expense");
  });
});
