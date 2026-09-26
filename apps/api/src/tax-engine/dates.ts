const DAY_MS = 86_400_000;
export const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
export const maxDate = (a: string, b: string) => (a > b ? a : b);
export const minDate = (a: string, b: string) => (a < b ? a : b);

const WIB_MS = 7 * (DAY_MS / 24);
export const wibYearStartUtc = (year: number) =>
  new Date(Date.UTC(year, 0, 1) - WIB_MS);
export const wibDateToUtc = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - WIB_MS);
