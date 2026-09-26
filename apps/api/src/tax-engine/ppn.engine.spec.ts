import { ppnPreview } from "./ppn.engine";

describe("ppnPreview", () => {
  const J = 1_000_000n;
  it.each([
    ["2024-12-31", false, 110_000n, 1100],
    ["2025-01-15", true, 110_000n, 1100],
    ["2025-02-01", true, 120_000n, 1200],
    ["2026-09-26", false, 110_000n, 1100],
  ] as const)(
    "%s luxury=%s → PPN %s (effective %i bps)",
    (date, luxury, ppn, effectiveBps) => {
      expect(
        ppnPreview({ date, amount: J, luxury, priceIncludesPpn: false }),
      ).toMatchObject({ ppn, effectiveBps, totalWithPpn: J + ppn });
    },
  );
  it("non-luxury DPP is 11/12 of price", () => {
    expect(
      ppnPreview({
        date: "2026-09-26",
        amount: J,
        luxury: false,
        priceIncludesPpn: false,
      }),
    ).toMatchObject({ dpp: 916_667n, nominalBps: 1200 });
  });
  it("price-including mode extracts the PPN", () => {
    expect(
      ppnPreview({
        date: "2026-09-26",
        amount: 1_110_000n,
        luxury: false,
        priceIncludesPpn: true,
      }),
    ).toMatchObject({
      priceExcludingPpn: J,
      ppn: 110_000n,
      totalWithPpn: 1_110_000n,
    });
    expect(
      ppnPreview({
        date: "2026-09-26",
        amount: 1_120_000n,
        luxury: true,
        priceIncludesPpn: true,
      }),
    ).toMatchObject({ priceExcludingPpn: J, ppn: 120_000n });
  });
  it("rounds half-up: 999.999 → 110.000", () => {
    expect(
      ppnPreview({
        date: "2026-09-26",
        amount: 999_999n,
        luxury: false,
        priceIncludesPpn: false,
      }).ppn,
    ).toBe(110_000n);
  });
});
