import { ymdToDbDate } from "../investments/ledger/ledger-dates";
import { jakartaYmd } from "../investments/valuation/valuation-core";

export interface HistoryEffectiveFields {
  effectiveAt: Date;
  effectiveDate: Date;
  hasTime: boolean;
}

/**
 * Aset A4 — effective-time fields for a USER-dated AssetHistory row (Task 16
 * bridge until the Task 18 history API). A UTC-midnight instant is how the
 * web sends a date-only valuation: it is stored date-only on that calendar
 * date, never as a 00:00 clock time. Any other instant is a real time whose
 * calendar date is taken in Asia/Jakarta.
 */
export function historyEffectiveFields(at: Date): HistoryEffectiveFields {
  const ymd = at.toISOString().slice(0, 10);
  const dateOnly = at.getTime() === Date.parse(`${ymd}T00:00:00.000Z`);
  return {
    effectiveAt: at,
    effectiveDate: ymdToDbDate(dateOnly ? ymd : jakartaYmd(at)),
    hasTime: !dateOnly,
  };
}

/**
 * System writes (asset create/edit) carry the real insert instant, so they
 * always have a time — even one that happens to land on 00:00:00.000Z.
 */
export function nowEffectiveFields(
  now: Date = new Date(),
): HistoryEffectiveFields {
  return {
    effectiveAt: now,
    effectiveDate: ymdToDbDate(jakartaYmd(now)),
    hasTime: true,
  };
}
