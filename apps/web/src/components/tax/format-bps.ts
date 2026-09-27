/** `bps` (basis points, 1/100 of a percent) as a percent string: `21 → "0,21%"`, `null → "—"`. */
export function formatBps(bps: number | null): string {
  if (bps === null) return "—";
  const whole = Math.trunc(bps / 100);
  const frac = String(bps % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return frac ? `${whole},${frac}%` : `${whole}%`;
}
