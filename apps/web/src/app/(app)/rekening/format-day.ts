/** "15 Des 2026" / "15 Dec 2026" for a yyyy-mm-dd date, read in UTC. */
export function formatDay(iso: string, locale: "id" | "en"): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(
    locale === "en" ? "en-GB" : "id-ID",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
}
