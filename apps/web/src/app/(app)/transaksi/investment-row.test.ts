import {
  investmentBreakdown,
  parseInvestment,
  rowKind,
} from "./investment-row";

describe("parseInvestment", () => {
  it("reads side, quantity and symbol from a buy description", () => {
    expect(parseInvestment("Beli 0.0059 ETH @ 42000000 IDR")).toEqual({
      side: "buy",
      quantity: 0.0059,
      symbol: "ETH",
      unitPrice: 42000000,
    });
  });

  it("reads a sell description", () => {
    expect(parseInvestment("Jual 0.0001 ETH @ 44383742 IDR")).toMatchObject({
      side: "sell",
      quantity: 0.0001,
    });
  });

  it("returns null for ordinary descriptions", () => {
    expect(parseInvestment("Beli buku")).toBeNull();
    expect(parseInvestment(null)).toBeNull();
  });
});

describe("rowKind", () => {
  it("marks investment transfers, plain transfers and cash rows", () => {
    expect(
      rowKind({ type: "transfer", description: "Beli 2 BBCA @ 9000 IDR" }),
    ).toBe("investment");
    expect(rowKind({ type: "transfer", description: "Top up" })).toBe(
      "transfer",
    );
    expect(
      rowKind({ type: "expense", description: "Beli 2 BBCA @ 9 IDR" }),
    ).toBe("expense");
  });
});

describe("investmentBreakdown", () => {
  it("derives gross and fee from quantity x price versus the moved amount", () => {
    expect(
      investmentBreakdown({
        type: "transfer",
        description: "Jual 0.01 ETH @ 42000000 IDR",
        amount: "419000",
      }),
    ).toMatchObject({ gross: 420000, fee: 1000, net: 419000 });
  });

  it("returns null for non-investment rows", () => {
    expect(
      investmentBreakdown({
        type: "expense",
        description: "Jual 0.01 ETH @ 42000000 IDR",
        amount: "1",
      }),
    ).toBeNull();
  });
});
