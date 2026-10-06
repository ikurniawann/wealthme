/**
 * `YYYY-MM-DD` for the user's LOCAL calendar day. `toISOString().slice(0, 10)`
 * is the UTC day, which in WIB (UTC+7) is still yesterday between 00:00 and
 * 07:00, so every default date would be one day behind.
 */
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
