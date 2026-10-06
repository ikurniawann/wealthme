import { formatRupiah } from "./rupiah.util";

describe("formatRupiah", () => {
  it("groups thousands with dots and a space after Rp", () => {
    expect(formatRupiah(BigInt(5_000_000))).toBe("Rp 5.000.000");
    expect(formatRupiah(2_000_000)).toBe("Rp 2.000.000");
    expect(formatRupiah("1256780000")).toBe("Rp 1.256.780.000");
    expect(formatRupiah(BigInt(0))).toBe("Rp 0");
    expect(formatRupiah(999)).toBe("Rp 999");
  });

  it("puts the sign before the symbol", () => {
    expect(formatRupiah(BigInt(-4_200_000))).toBe("-Rp 4.200.000");
    expect(formatRupiah(-10_700_000)).toBe("-Rp 10.700.000");
  });

  it("never prints decimals and keeps bigint precision", () => {
    expect(formatRupiah(1234.6)).toBe("Rp 1.235");
    expect(formatRupiah(BigInt("9007199254740993"))).toBe(
      "Rp 9.007.199.254.740.993",
    );
  });

  it("treats a non-numeric string as zero", () => {
    expect(formatRupiah("abc")).toBe("Rp 0");
  });
});
