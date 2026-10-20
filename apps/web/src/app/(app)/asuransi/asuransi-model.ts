/**
 * Asuransi page model (Task 24) — URL filter state, client-side filtering of
 * the policy list and small display helpers. No JSX, no React.
 *
 * Filtering runs on the already-fetched list (`GET …/insurances`) with the
 * same semantics as the API's own filters (holder, insured, provider, type,
 * policyType incl. "unset", status, due window on nextPremiumDueDate,
 * currency), so a filter change never costs a request.
 */
import type {
  InsuranceBenefitDto,
  InsuranceDto,
  InsuranceStatus,
} from "@wealthme/contracts";

export const PAGE_SIZE = 20;
/** Jadwal premi berikutnya: overdue dues + dues within this many days. */
export const SCHEDULE_WINDOW_DAYS = 60;
export const SCHEDULE_MAX_ROWS = 6;

export const DUE_WINDOWS = [
  "overdue",
  "d7",
  "d30",
  "month",
  "d90",
  "none",
] as const;
export type DueWindow = (typeof DUE_WINDOWS)[number];

export type AsuransiFilters = {
  q: string;
  holder: string;
  insured: string;
  provider: string;
  type: string;
  policyType: string;
  status: string;
  due: DueWindow | "";
  currency: string;
};

export const EMPTY_FILTERS: AsuransiFilters = {
  q: "",
  holder: "",
  insured: "",
  provider: "",
  type: "",
  policyType: "",
  status: "",
  due: "",
  currency: "",
};

const KEYS = Object.keys(EMPTY_FILTERS) as (keyof AsuransiFilters)[];

export function parseFilters(params: URLSearchParams): AsuransiFilters {
  const due = params.get("due") ?? "";
  return {
    ...Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ""])),
    due: (DUE_WINDOWS as readonly string[]).includes(due)
      ? (due as DueWindow)
      : "",
  } as AsuransiFilters;
}

export function filtersToQuery(filters: AsuransiFilters): URLSearchParams {
  const q = new URLSearchParams();
  for (const k of KEYS) {
    const v = filters[k].trim();
    if (v) q.set(k, v);
  }
  return q;
}

export function activeFilterCount(filters: AsuransiFilters): number {
  return KEYS.filter((k) => k !== "q" && filters[k]).length;
}

/** "u:<userId>" for a member, "n:<typed name>" for a free-text person. */
export function personKey(userId: string | null | undefined, name: string) {
  return userId ? `u:${userId}` : `n:${name.trim().toLowerCase()}`;
}

export function holderKey(p: InsuranceDto): string | null {
  if (p.holderUserId) return personKey(p.holderUserId, "");
  return p.holderName?.trim() ? personKey(null, p.holderName) : null;
}

export function insuredKeys(p: InsuranceDto): string[] {
  return (p.insured ?? []).map((i) => personKey(i.memberUserId, i.name));
}

/** Jakarta calendar day as YYYY-MM-DD (the API's schedule time zone). */
export function jakartaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthEnd(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

/** The premium due date only — never coverage end or policy renewal. */
export function nextDue(p: InsuranceDto): string | null {
  return p.nextPremiumDueDate ? p.nextPremiumDueDate.slice(0, 10) : null;
}

/**
 * The API's derived flag: a legacy due (the old overloaded renewalDate) that
 * looks like a coverage end — further out than one premium period. It is
 * NOT a premium due until the user confirms it: no countdown, no "jatuh
 * tempo" date, excluded from the schedule and the period totals. Read
 * defensively: an older API omits it (= not flagged).
 */
export function needsDueConfirmation(p: InsuranceDto): boolean {
  return (
    (p as InsuranceDto & { dueNeedsConfirmation?: boolean })
      .dueNeedsConfirmation === true
  );
}

export function isOverdue(p: InsuranceDto): boolean {
  if (needsDueConfirmation(p)) return false;
  return (
    p.premiumDueStatus === "overdue" ||
    (p.daysUntilNextPremium != null && p.daysUntilNextPremium < 0)
  );
}

function matchesDue(p: InsuranceDto, due: DueWindow, today: string): boolean {
  const d = needsDueConfirmation(p) ? null : nextDue(p);
  if (due === "none") return d === null;
  if (!d) return false;
  if (due === "overdue") return isOverdue(p);
  const end =
    due === "month"
      ? monthEnd(today)
      : addDays(today, due === "d7" ? 7 : due === "d30" ? 30 : 90);
  const start = due === "month" ? `${today.slice(0, 7)}-01` : today;
  return d >= start && d <= end;
}

export function applyFilters(
  list: InsuranceDto[],
  f: AsuransiFilters,
  today: string,
): InsuranceDto[] {
  const q = f.q.trim().toLowerCase();
  return list.filter((p) => {
    if (q) {
      const hay = [p.name, p.provider, p.policyNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.holder && holderKey(p) !== f.holder) return false;
    if (f.insured && !insuredKeys(p).includes(f.insured)) return false;
    if (f.provider && (p.provider ?? "") !== f.provider) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.policyType) {
      const pt = p.policyType ?? "unset";
      if (pt !== f.policyType) return false;
    }
    if (f.status && p.status !== f.status) return false;
    if (f.due && !matchesDue(p, f.due, today)) return false;
    if (f.currency && p.currency !== f.currency) return false;
    return true;
  });
}

/** Overdue first, then the soonest due; unscheduled policies last. */
export function sortByDue(list: InsuranceDto[]): InsuranceDto[] {
  return [...list].sort((a, b) => {
    const da = needsDueConfirmation(a) ? null : nextDue(a);
    const db = needsDueConfirmation(b) ? null : nextDue(b);
    if (da === db) return a.name.localeCompare(b.name);
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  });
}

export const PAYABLE_STATUSES: readonly InsuranceStatus[] = [
  "aktif",
  "masa_tenggang",
];

export function isPayable(p: InsuranceDto): boolean {
  return PAYABLE_STATUSES.includes(p.status);
}

/** Overdue dues + dues within the window, for active policies. */
export function scheduleRows(list: InsuranceDto[], today: string) {
  const limit = addDays(today, SCHEDULE_WINDOW_DAYS);
  return sortByDue(
    list.filter((p) => {
      const d = nextDue(p);
      return (
        isPayable(p) &&
        d !== null &&
        !needsDueConfirmation(p) &&
        (isOverdue(p) || d <= limit)
      );
    }),
  );
}

/** Paying policies whose due needs confirmation (own schedule group). */
export function dueConfirmRows(list: InsuranceDto[]): InsuranceDto[] {
  return list.filter((p) => isPayable(p) && needsDueConfirmation(p));
}

/** The benefit the list shows: the primary one, else the first with an amount. */
export function mainBenefit(p: InsuranceDto): InsuranceBenefitDto | null {
  const benefits = p.benefits ?? [];
  return (
    benefits.find((b) => b.isPrimary) ??
    benefits.find((b) => b.amount != null) ??
    benefits[0] ??
    null
  );
}

/** Shows only the last 4 characters of a policy number. */
export function maskPolicyNumber(no: string | null): string | null {
  const s = no?.trim();
  if (!s) return null;
  return s.length <= 4 ? s : `•••• ${s.slice(-4)}`;
}

export type DueTone = "overdue" | "soon" | "later" | "none";

export function dueTone(p: InsuranceDto): DueTone {
  const days = p.daysUntilNextPremium;
  if (!nextDue(p) || days == null || needsDueConfirmation(p)) return "none";
  if (isOverdue(p)) return "overdue";
  return days <= 14 ? "soon" : "later";
}

export type StatusTone = "good" | "warn" | "bad" | "muted";

export function statusTone(status: InsuranceStatus): StatusTone {
  if (status === "aktif") return "good";
  if (status === "masa_tenggang") return "warn";
  if (status === "lapse" || status === "dibatalkan") return "bad";
  return "muted";
}

export function fillCopy(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? String(values[k]) : m,
  );
}

const DATE_FORMATS = new Map<string, Intl.DateTimeFormat>();

/** "25 Okt 2026" — date-only values are formatted in UTC (no zone drift). */
export function formatDay(
  iso: string | null | undefined,
  locale: string,
  month: "short" | "long" = "short",
): string {
  if (!iso) return "—";
  const key = `${locale}:${month}`;
  let fmt = DATE_FORMATS.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
      day: "numeric",
      month,
      year: "numeric",
      timeZone: "UTC",
    });
    DATE_FORMATS.set(key, fmt);
  }
  return fmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

/** An amount in its own currency ("Rp 1.000.000.000", "US$ 250.000"). */
export function formatNative(
  amount: string | null | undefined,
  currency: string,
  locale: string,
): string {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const tag = locale === "en" ? "en-US" : "id-ID";
  if (currency === "IDR") {
    return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}`;
  }
  try {
    return new Intl.NumberFormat(tag, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${new Intl.NumberFormat(tag).format(n)}`;
  }
}

/** Replaces ISO dates inside an API message with the localized day. */
export function localizeDates(message: string, locale: string): string {
  return message.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) =>
    formatDay(d, locale, "long"),
  );
}

/** Totals per currency (Decimal strings summed as numbers for display). */
export function sumByCurrency<T>(
  rows: T[],
  pick: (row: T) => { currency: string; amount: string },
): { currency: string; total: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const { currency, amount } = pick(row);
    map.set(currency, (map.get(currency) ?? 0) + Number(amount));
  }
  return Array.from(map, ([currency, total]) => ({ currency, total }));
}
