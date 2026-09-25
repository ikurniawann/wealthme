/** The local (WIB in production) calendar day of an ISO instant — the same day the list prints. */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  return [
    String(d.getFullYear()).padStart(4, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
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
