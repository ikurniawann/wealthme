import {
  ShieldCheck,
  Banknote,
  BriefcaseBusiness,
  Car,
  ChartPie,
  Coins,
  Gem,
  Palette,
  House,
  Landmark,
  Laptop,
  Package,
  PiggyBank,
  ScrollText,
  Shapes,
  TrendingUp,
  Wallet,
  Bitcoin,
  type LucideIcon,
} from "lucide-react";
import type {
  AssetClass,
  AssetOverviewRowDto,
  AssetsOverviewQuery,
} from "@wealthme/contracts";
import type { I18nDictionary } from "@/i18n/types";

/** Every filter the overview endpoint understands, as URL strings. */
export interface AsetFilters {
  q: string;
  class: "" | AssetClass;
  subtype: string;
  ownerUserId: string;
  minValue: string;
  maxValue: string;
  minQuantity: string;
  maxQuantity: string;
  unit: string;
  acquiredFrom: string;
  acquiredTo: string;
  status: "" | "active" | "sold" | "archived";
  completeness: "" | "complete" | "incomplete";
  sort: NonNullable<AssetsOverviewQuery["sort"]>;
  page: number;
}

export const EMPTY_FILTERS: AsetFilters = {
  q: "",
  class: "",
  subtype: "",
  ownerUserId: "",
  minValue: "",
  maxValue: "",
  minQuantity: "",
  maxQuantity: "",
  unit: "",
  acquiredFrom: "",
  acquiredTo: "",
  status: "",
  completeness: "",
  sort: "value_desc",
  page: 1,
};

export const PAGE_SIZE = 25;
export const CLASSES = [
  "dana_rekening",
  "investasi",
  "aset_fisik",
  "lainnya",
] as const satisfies readonly AssetClass[];
const SORTS = ["value_desc", "value_asc", "name_asc", "acquired_desc"] as const;
const STATUSES = ["active", "sold", "archived"] as const;
type TextKey = Exclude<
  keyof AsetFilters,
  "class" | "status" | "completeness" | "sort" | "page"
>;
const TEXT_KEYS: TextKey[] = [
  "q",
  "subtype",
  "ownerUserId",
  "minValue",
  "maxValue",
  "minQuantity",
  "maxQuantity",
  "unit",
  "acquiredFrom",
  "acquiredTo",
];

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | "" {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : "";
}

/** URL → filters. Unknown or malformed values fall back to the defaults. */
export function parseFilters(params: URLSearchParams): AsetFilters {
  const text = Object.fromEntries(
    TEXT_KEYS.map((k) => [k, params.get(k)?.trim() ?? ""]),
  ) as Record<TextKey, string>;
  const page = Number(params.get("page"));
  return {
    ...EMPTY_FILTERS,
    ...text,
    class: pick(params.get("class"), CLASSES),
    status: pick(params.get("status"), STATUSES),
    completeness: pick(params.get("completeness"), [
      "complete",
      "incomplete",
    ] as const),
    sort: pick(params.get("sort"), SORTS) || "value_desc",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** Filters → query string (defaults omitted). Shared by the URL and the API. */
export function filtersToQuery(f: AsetFilters): URLSearchParams {
  const out = new URLSearchParams();
  for (const k of TEXT_KEYS) if (f[k]) out.set(k, f[k]);
  if (f.class) out.set("class", f.class);
  if (f.status) out.set("status", f.status);
  if (f.completeness) out.set("completeness", f.completeness);
  if (f.sort !== "value_desc") out.set("sort", f.sort);
  if (f.page > 1) out.set("page", String(f.page));
  return out;
}

/** Filter keys shown as removable chips (tabs, sort and page are not chips). */
export function activeFilterKeys(f: AsetFilters): (keyof AsetFilters)[] {
  const keys: (keyof AsetFilters)[] = [
    "q",
    "subtype",
    "ownerUserId",
    "minValue",
    "maxValue",
    "unit",
    "minQuantity",
    "maxQuantity",
    "acquiredFrom",
    "acquiredTo",
    "status",
    "completeness",
  ];
  return keys.filter((k) => f[k] !== "");
}

/** Decimal IDR string → whole rupiah (half-up), exact for any magnitude. */
export function roundIdr(value: string): bigint {
  const negative = value.trim().startsWith("-");
  const [whole = "0", frac = ""] = value.replace("-", "").trim().split(".");
  let n = BigInt(whole || "0");
  if ((frac[0] ?? "0") >= "5") n += BigInt(1);
  return negative ? -n : n;
}

export function sumIdr(values: (string | null | undefined)[]): bigint {
  return values.reduce<bigint>(
    (acc, v) => (v ? acc + roundIdr(v) : acc),
    BigInt(0),
  );
}

/** Share of a part in a total, 0–100, one decimal; null when total ≤ 0. */
export function sharePct(part: string, total: string): number | null {
  const t = roundIdr(total);
  if (t <= BigInt(0)) return null;
  return Number((roundIdr(part) * BigInt(1000)) / t) / 10;
}

function intlLocale(locale: string): string {
  return locale === "en" ? "en-US" : "id-ID";
}

/** yyyy-mm-dd (calendar date) → "12 Jan 2023", never shifted by timezone. */
export function fmtDate(ymd: string | null, locale: string): string {
  if (!ymd) return "—";
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function fmtTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

export function fmtQty(q: string | null, locale: string): string {
  if (q == null) return "—";
  const n = Number(q);
  if (!Number.isFinite(n)) return q;
  return new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 4,
  }).format(n);
}

export function fmtPct(p: number, locale: string): string {
  return `${new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(p))}%`;
}

/** Digits only (thousand separators typed by the user are dropped). */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function fillCopy(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? String(values[k]) : m,
  );
}

type AsetCopy = I18nDictionary["aset"];

/** Human label for a row subtype, looked up in the module that owns it. */
export function subtypeLabel(
  row: Pick<AssetOverviewRowDto, "sourceModule" | "subtype">,
  t: AsetCopy,
): string {
  const maps: Record<string, Record<string, string>> = {
    assets: t.assetTypeLabels,
    accounts: t.accountTypeLabels,
    investments: t.invTypeLabels,
  };
  return maps[row.sourceModule]?.[row.subtype] ?? row.subtype;
}

const ICONS: Record<string, LucideIcon> = {
  "accounts:bank": Landmark,
  "accounts:ewallet": Wallet,
  "accounts:cash": Banknote,
  "accounts:investment": BriefcaseBusiness,
  "accounts:property": House,
  "investments:saham": TrendingUp,
  "investments:reksa_dana": ChartPie,
  "investments:obligasi": ScrollText,
  "investments:emas": Coins,
  "investments:kripto": Bitcoin,
  "investments:deposito": PiggyBank,
  "investments:lainnya": Shapes,
  "assets:properti": House,
  "assets:kendaraan": Car,
  "assets:elektronik": Laptop,
  "assets:perhiasan": Gem,
  "assets:emas": Coins,
  "assets:seni_koleksi": Palette,
  "assets:lainnya": Package,
};
const CLASS_ICONS: Record<AssetClass, LucideIcon> = {
  dana_rekening: Landmark,
  investasi: TrendingUp,
  aset_fisik: House,
  polis_asuransi: ShieldCheck,
  lainnya: Package,
};

/** Icon for a row: exact module+subtype, then the class, then a package. */
export function rowIcon(
  row: Pick<AssetOverviewRowDto, "sourceModule" | "subtype" | "class">,
): LucideIcon {
  return (
    ICONS[`${row.sourceModule}:${row.subtype}`] ??
    CLASS_ICONS[row.class] ??
    Package
  );
}

/** Subtype filter options grouped by the module that defines them. */
export function subtypeGroups(
  t: AsetCopy,
): { label: string; options: { value: string; label: string }[] }[] {
  const toOptions = (m: Record<string, string>) =>
    Object.entries(m).map(([value, label]) => ({ value, label }));
  return [
    {
      label: t.v3.classes.dana_rekening,
      options: toOptions(t.accountTypeLabels),
    },
    { label: t.v3.classes.investasi, options: toOptions(t.invTypeLabels) },
    { label: t.v3.classes.aset_fisik, options: toOptions(t.assetTypeLabels) },
  ];
}

/** Detail link of the record that owns the row (A2 source module). */
export function detailHref(row: AssetOverviewRowDto): string {
  const own = row.sources.find((s) => s.module === row.sourceModule);
  return own?.href ?? row.sources[0]?.href ?? "#";
}

/** A physical asset the user can edit, archive or revalue on this page. */
export function isManagedAsset(row: AssetOverviewRowDto): boolean {
  return row.sourceModule === "assets";
}
