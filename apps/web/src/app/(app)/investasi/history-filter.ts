const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The WIB calendar day of an ISO instant, independent of the browser's timezone. */
export function localDateKey(iso: string): string {
  const d = new Date(new Date(iso).getTime() + WIB_OFFSET_MS);
  return [
    String(d.getUTCFullYear()).padStart(4, "0"),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Inclusive on both ends; an empty bound is open. `from`/`to` are `YYYY-MM-DD`. */
export function filterByOccurredAt<T extends { occurredAt: string }>(
  rows: readonly T[],
  from: string,
  to: string,
): T[] {
  return rows.filter((row) => {
    const day = localDateKey(row.occurredAt);
    return (!from || day >= from) && (!to || day <= to);
  });
}
