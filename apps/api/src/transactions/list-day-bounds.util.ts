/**
 * `GET /transactions?from=&to=` day bounds.
 *
 * The web sends plain `YYYY-MM-DD` days. `new Date("2026-10-20")` is UTC
 * midnight, i.e. 07:00 WIB — so `from` skipped the first seven hours of the
 * day and `to` cut the day off at 07:00 WIB. A date-only top up (stored at
 * 00:00 WIB) vanished from "today". Plain days are read as Asia/Jakarta
 * (UTC+7, no DST) calendar days, inclusive; full ISO instants pass through.
 */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function listFromBound(from: string): Date {
  return ISO_DAY.test(from)
    ? new Date(Date.parse(`${from}T00:00:00.000Z`) - WIB_OFFSET_MS)
    : new Date(from);
}

export function listToBound(to: string): Date {
  return ISO_DAY.test(to)
    ? new Date(Date.parse(`${to}T00:00:00.000Z`) - WIB_OFFSET_MS + DAY_MS - 1)
    : new Date(to);
}
