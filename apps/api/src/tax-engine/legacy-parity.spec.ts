import { computeNetTax } from "../tax/tax.service";

// Frozen from today's float engine (pph21.util.ts before revisi L) — never edit these rows.
const LEGACY_GOLDEN = [
  { gross: "0", ptkp: "54000000", zakat: "0", netTax: "0" },
  { gross: "54000000", ptkp: "54000000", zakat: "0", netTax: "0" },
  { gross: "60000000", ptkp: "54000000", zakat: "0", netTax: "150000" },
  { gross: "61234567", ptkp: "54000000", zakat: "0", netTax: "208600" },
  { gross: "120000000", ptkp: "63000000", zakat: "2500000", netTax: "2425000" },
  { gross: "123456789", ptkp: "58500000", zakat: "1234567", netTax: "2886100" },
  { gross: "180000000", ptkp: "72000000", zakat: "0", netTax: "9300000" },
  {
    gross: "250000000",
    ptkp: "54000000",
    zakat: "10000000",
    netTax: "21000000",
  },
  { gross: "350000000", ptkp: "67500000", zakat: "0", netTax: "38125000" },
  { gross: "600000000", ptkp: "54000000", zakat: "0", netTax: "106000000" },
  {
    gross: "1000000000",
    ptkp: "58500000",
    zakat: "25000000",
    netTax: "217150000",
  },
  { gross: "6000000000", ptkp: "72000000", zakat: "0", netTax: "1766700000" },
  {
    gross: "999999999999999",
    ptkp: "54000000",
    zakat: "0",
    netTax: "349999672999650",
  },
  { gross: "50000000", ptkp: "54000000", zakat: "100000000", netTax: "0" },
] as const;

describe("legacy TaxRecord netTax parity (revisi L must not change existing records)", () => {
  it.each(LEGACY_GOLDEN)(
    "gross $gross ptkp $ptkp zakat $zakat → $netTax",
    (row) => {
      expect(
        computeNetTax(
          BigInt(row.gross),
          BigInt(row.ptkp),
          BigInt(row.zakat),
        ).toString(),
      ).toBe(row.netTax);
    },
  );
});
