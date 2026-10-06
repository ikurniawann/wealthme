import {
  convertToIdr,
  formatScaled,
  type FxCurrencyCode,
  type FxRatesResponse,
} from "@wealthme/contracts";
import type { CurrencyCode } from "@/hooks/currencies";

import { formatRupiah } from "@/lib/format";

export function currencySymbol(code: CurrencyCode, locale: "id" | "en") {
  const intlLocale = locale === "en" ? "en-US" : "id-ID";
  return (
    new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
      numberingSystem: "latn",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? code
  );
}

// E2E round-2 B1 — a decimal-capable field (decimals > 0) sometimes gets
// USD/copy-paste input like "9500.50" instead of the id-ID "9500,50". A
// lone "." followed by exactly 1-2 trailing digits can never be a genuine
// thousands group (those are always 3 digits), so on decimal-capable
// fields only, reinterpret it as the decimal separator before the normal
// "." = thousands parsing runs. 0-decimal (IDR integer) fields are never
// touched — "." always means thousands there.
function normalizeDotDecimal(raw: string, decimals: number): string {
  if (decimals <= 0 || raw.includes(",")) return raw;
  const lastDot = raw.lastIndexOf(".");
  if (lastDot === -1 || raw.indexOf(".") !== lastDot) return raw;
  const tail = raw.slice(lastDot + 1);
  const head = raw.slice(0, lastDot);
  if (!/^\d{1,2}$/.test(tail) || !/\d/.test(head)) return raw;
  return `${head},${tail}`;
}

/** Live id-ID formatting while typing: "." thousands, "," decimals (at most `decimals`). */
export function formatMoneyTyping(
  raw: string,
  decimals: number,
  allowNegative = false,
): string {
  const normalized = normalizeDotDecimal(raw, decimals);
  const negative = allowNegative && normalized.trim().startsWith("-");
  const commaAt = normalized.indexOf(",");
  const hasComma = decimals > 0 && commaAt !== -1;
  const intSource = hasComma ? normalized.slice(0, commaAt) : normalized;
  const frac = hasComma
    ? normalized
        .slice(commaAt + 1)
        .replace(/\D/g, "")
        .slice(0, decimals)
    : "";
  const intDigits = intSource.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!intDigits && !hasComma) return negative ? "-" : "";
  const grouped = (intDigits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}${hasComma ? `,${frac}` : ""}`;
}

export function toCanonicalAmount(display: string): string | null {
  const negative = display.trim().startsWith("-");
  const [intPart = "", fracPart = ""] = display.split(",");
  const intDigits = intPart.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const frac = fracPart.replace(/\D/g, "");
  if (!intDigits && !frac) return null;
  const body = frac ? `${intDigits || "0"}.${frac}` : intDigits || "0";
  return negative ? `-${body}` : body;
}

export function canonicalToTyping(
  canonical: string,
  decimals: number,
  allowNegative = false,
): string {
  return formatMoneyTyping(
    canonical.replace(".", ","),
    decimals,
    allowNegative,
  );
}

export function idrPreview(
  canonical: string | null,
  currency: FxCurrencyCode,
  rates: FxRatesResponse | undefined,
  targetScale: 0 | 2,
): bigint | null {
  if (canonical === null) return null;
  const idrPerUnit = currency === "IDR" ? "1" : rates?.idrPerUnit[currency];
  if (!idrPerUnit) return null;
  try {
    return convertToIdr({
      amount: canonical,
      currency,
      idrPerUnit,
      targetScale,
    });
  } catch {
    // Unparseable while typing (e.g. "1,") simply has no preview yet.
    return null;
  }
}

export function formatIdrPreview(value: bigint, scale: 0 | 2): string {
  if (scale === 0) return formatRupiah(Number(value));
  const [intPart, frac] = formatScaled(value, 2).split(".");
  return `Rp\u00A0${Number(intPart).toLocaleString("id-ID")},${frac}`;
}

export function formatRatePerUnit(idrPerUnit: string): string {
  return Number(idrPerUnit).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRateDate(rateDate: string, locale: string): string {
  return new Date(`${rateDate}T00:00:00.000Z`).toLocaleDateString(
    locale === "en" ? "en-GB" : "id-ID",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
}
