/**
 * Calendar helpers for the investment ledger (pure). Ledger dates are
 * "yyyy-mm-dd" strings; `@db.Date` columns hold them as UTC midnight.
 */

export const LEDGER_DEFAULT_TIME_ZONE = "Asia/Jakarta";
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function isValidYmd(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

export function ymdToDbDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function dbDateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's Asia/Jakarta calendar date. */
export function jakartaTodayYmd(now: Date = new Date()): string {
  return new Date(now.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** `n` calendar days (or Mon–Fri business days) after `ymd`. */
export function addDaysYmd(ymd: string, n: number, business: boolean): string {
  const d = ymdToDbDate(ymd);
  if (!business) {
    d.setUTCDate(d.getUTCDate() + n);
    return dbDateToYmd(d);
  }
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return dbDateToYmd(d);
}

function zoneOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string): number =>
    Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant of a ledger point, for the legacy `occurredAt` column and the
 * linked cash Transaction. Date-only → 00:00 Asia/Jakarta (start of day,
 * matching R6); timed → that wall time in `timeZone`.
 */
export function ledgerInstant(
  ymd: string,
  time: string | null,
  timeZone: string | null,
): Date {
  if (!time) return new Date(`${ymd}T00:00:00.000+07:00`);
  const tz = timeZone ?? LEDGER_DEFAULT_TIME_ZONE;
  const guess = new Date(`${ymd}T${time}:00.000Z`);
  const first = zoneOffsetMs(guess, tz);
  const instant = new Date(guess.getTime() - first);
  const second = zoneOffsetMs(instant, tz);
  return second === first ? instant : new Date(guess.getTime() - second);
}

/**
 * R6 key parts of a plain cash Transaction (top-up, withdrawal, expense …):
 * its Asia/Jakarta date and HH:MM. An occurredAt at exactly midnight
 * (Jakarta or UTC — how date-only entries are sent) counts as date-only, so
 * it sorts with the other date-only rows of that day by createdAt.
 */
export function cashKeyParts(occurredAt: Date): {
  effectiveDate: string;
  effectiveTime: string | null;
} {
  const local = new Date(occurredAt.getTime() + JAKARTA_OFFSET_MS);
  const iso = local.toISOString();
  const effectiveDate = iso.slice(0, 10);
  const jakartaMidnight = iso.slice(11, 23) === "00:00:00.000";
  const utcMidnight = occurredAt.toISOString().slice(11, 23) === "00:00:00.000";
  return {
    effectiveDate,
    effectiveTime: jakartaMidnight || utcMidnight ? null : iso.slice(11, 16),
  };
}
