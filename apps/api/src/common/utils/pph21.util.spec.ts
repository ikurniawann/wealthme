import { CalculatorsService } from "../../calculators/calculators.service";
import { computeNetTax } from "../../tax/tax.service";

// EPIC-022 Group E (E6) — regression guard for the two PPh 21 call sites.
// `CalculatorsService.calculatePph21` (the interactive calculators) and
// `TaxService.computeNetTax` (the persisted tax record) both now delegate
// to `pph21.util.ts`; this test proves they still agree across a spread of
// incomes so a future edit to one path cannot silently diverge from the
// other without failing here.
describe("PPh 21 engines stay in sync (calculators.service vs tax.service)", () => {
  const calculators = new CalculatorsService();

  it.each([
    0, 12_000_000, 100_000_000, 300_000_000, 1_060_000_000, 6_060_000_000,
  ])(
    "gross income %i produces the same totalTax via both engines",
    (grossIncome) => {
      const fromCalculators = calculators.calculatePph21({ grossIncome });
      const fromTaxService = computeNetTax(
        BigInt(grossIncome),
        BigInt(fromCalculators.ptkp),
        BigInt(fromCalculators.zakatDeduction),
      );

      expect(fromTaxService).toBe(BigInt(fromCalculators.totalTax));
    },
  );
});
