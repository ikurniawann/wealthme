import { deriveInternalCode } from "./internal-code.util";

const TICKER_FORMAT = /^[A-Z0-9._-]{1,20}$/i;

describe("deriveInternalCode — E2E round-2 B1", () => {
  it("produces a code matching the ticker format, max 20 chars", () => {
    const code = deriveInternalCode("Deposito BRI 12 bulan");
    expect(code.length).toBeLessThanOrEqual(20);
    expect(code).toMatch(TICKER_FORMAT);
  });

  it("slugs the name into the allowed alnum/._- charset", () => {
    const code = deriveInternalCode("Emas Antam Fisik!");
    expect(code.startsWith("EMAS-ANTAM")).toBe(true);
    expect(code).toMatch(TICKER_FORMAT);
  });

  it("falls back to a generic prefix when the name has no allowed characters", () => {
    const code = deriveInternalCode("!!!");
    expect(code.startsWith("INV-")).toBe(true);
  });

  it("gives two identically-named holdings different codes", () => {
    const a = deriveInternalCode("Deposito BRI");
    const b = deriveInternalCode("Deposito BRI");
    expect(a).not.toBe(b);
  });
});
