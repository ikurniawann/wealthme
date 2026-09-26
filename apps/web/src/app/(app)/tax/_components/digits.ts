// EPIC-024 Group E (E1) — TaxRecord persists grossIncome/ptkp/netTax as
// Postgres BigInt (schema.prisma), and the API's DTOs cap accepted amounts
// at 999_999_999_999_999. Clamping client-side at the same ceiling keeps a
// mis-paste of a huge number from ever reaching the API only to bounce off
// a 400 the user can't make sense of. Field-agnostic name — the same
// ceiling clamps every money-ish field on /tax.
export const MAX_TAX_INPUT = 999_999_999_999_999;

// Extract the digit string a Rupiah-formatted input actually represents,
// without ever round-tripping through a JS `number`. `String(aFloat)` uses
// exponential notation once the value hits 1e21 (e.g. "1e+21"), which fails
// the API's `/^\d+$/`-style numeric-string validation outright — building
// the payload from the raw digits sidesteps that class of bug entirely,
// on top of the MAX_TAX_INPUT clamp above.
export function toClampedDigitString(value: string, max: number): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digits === "") return "0";
  if (digits.length > String(max).length) return String(max);
  const asNumber = Number(digits);
  return asNumber > max ? String(max) : digits;
}
