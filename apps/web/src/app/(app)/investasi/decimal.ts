/** Fixed-point UI estimates only. API remains authoritative; 8 decimal places. */
const SCALE = BigInt(100000000);
export function decimal(value: string): bigint {
  if (!/^-?\d+(\.\d{1,8})?$/.test(value)) throw new Error("invalid decimal");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  return (
    BigInt(`${whole}${fraction.padEnd(8, "0")}`) *
    (value.startsWith("-") ? BigInt(-1) : BigInt(1))
  );
}
export function text(value: bigint): string {
  const sign = value < BigInt(0) ? "-" : "";
  const n = value < BigInt(0) ? -value : value;
  const fraction = (n % SCALE).toString().padStart(8, "0").replace(/0+$/, "");
  return `${sign}${n / SCALE}${fraction ? `.${fraction}` : ""}`;
}
export function add(a: string, b: string) {
  return text(decimal(a) + decimal(b));
}
export function subtract(a: string, b: string) {
  return text(decimal(a) - decimal(b));
}
export function multiply(a: string, b: string) {
  return text((decimal(a) * decimal(b)) / SCALE);
}
export function divide(a: string, b: string) {
  const divisor = decimal(b);
  if (divisor === BigInt(0)) throw new Error("zero divisor");
  return text((decimal(a) * SCALE) / divisor);
}
export function positive(value: string) {
  try {
    return decimal(value) > BigInt(0);
  } catch {
    return false;
  }
}

export function roundWhole(value: string): string {
  const n = decimal(value);
  const absolute = n < BigInt(0) ? -n : n;
  const rounded = (absolute + SCALE / BigInt(2)) / SCALE;
  return `${n < BigInt(0) ? "-" : ""}${rounded}`;
}
