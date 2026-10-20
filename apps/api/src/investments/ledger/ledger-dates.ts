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

/*
 * Floating occurredAt — the app-wide convention for `Transaction.occurredAt`
 * (see the add-transaction dialog's `occurredAtIso`): the user's wall-clock
 * date and time written as if it were UTC, `${date}T${HH:MM}:00.000Z`, and
 * date-only rows at `${date}T00:00:00.000Z`. Lists and reports bucket rows
 * by that UTC day, so cash legs and pocket transfers must be written the
 * same way or a date-only top up lands on the previous day.
 */

const WALL_CLOCK =
  /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** The literal wall-clock date/time of an ISO string, as a floating value
 *  (any offset is dropped: "2026-10-20T00:00:00+07:00" → 2026-10-20T00:00Z). */
export function floatingWallClock(iso: string): Date {
  const m = WALL_CLOCK.exec(iso);
  if (!m) return new Date(iso);
  return new Date(`${m[1]}T${m[2] ?? "00:00"}:00.000Z`);
}

/** Floating occurredAt of a ledger cash leg: Jakarta wall time of the point. */
export function floatingCashInstant(
  ymd: string,
  time: string | null,
  timeZone: string | null,
): Date {
  if (!time) return new Date(`${ymd}T00:00:00.000Z`);
  const instant = ledgerInstant(ymd, time, timeZone);
  const wall = new Date(instant.getTime() + JAKARTA_OFFSET_MS);
  wall.setUTCSeconds(0, 0);
  return wall;
}

/**
 * R6 key parts of a cash Transaction stored as a floating value. Rows written
 * before the floating fix stored date-only entries as Jakarta midnight
 * (previous day 17:00:00.000Z); that exact instant is still read as the
 * next day's date-only point.
 */
export function floatingKeyParts(occurredAt: Date): {
  effectiveDate: string;
  effectiveTime: string | null;
} {
  const iso = occurredAt.toISOString();
  if (iso.slice(11, 23) === "17:00:00.000") return cashKeyParts(occurredAt);
  return {
    effectiveDate: iso.slice(0, 10),
    effectiveTime:
      iso.slice(11, 23) === "00:00:00.000" ? null : iso.slice(11, 16),
  };
}
