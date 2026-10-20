"use client";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type { InvestmentLedgerConflictDto } from "@wealthme/contracts";
import { apiErrorMessage } from "@/lib/api-error";
import { money } from "./portfolio-model";
import "./investment-conflict.css";

const COPY = {
  id: {
    INSUFFICIENT_FUNDS: "Dana tersedia tidak mencukupi",
    INSUFFICIENT_HOLDINGS: "Kepemilikan tidak mencukupi",
    HISTORY_CONFLICT: "Transaksi berikutnya ikut terdampak",
    at: "Pada",
    needed: "Dibutuhkan",
    available: "Tersedia",
    units: "unit",
    affected: "Transaksi yang terdampak",
  },
  en: {
    INSUFFICIENT_FUNDS: "Not enough available funds",
    INSUFFICIENT_HOLDINGS: "Not enough units held",
    HISTORY_CONFLICT: "Later transactions are affected",
    at: "At",
    needed: "Needed",
    available: "Available",
    units: "units",
    affected: "Affected transactions",
  },
};

/**
 * apiErrorMessage + rupiah grouping: ledger / pocket messages are written by
 * the API with bare BigInt strings ("tersedia Rp 1902850"); show them as
 * "Rp 1.902.850" (id) / "Rp 1,902,850" (en).
 */
export function investmentErrorMessage(
  err: unknown,
  fallback: string,
  locale: string,
): string {
  return groupRupiah(apiErrorMessage(err, fallback), locale);
}

/** "Rp 1902850" / "Rp -50000000" inside server copy → grouped digits. */
export function groupRupiah(text: string, locale: string): string {
  const group = new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID");
  return text.replace(
    /Rp\s?(-?)(\d{4,})(?!\d|[.,]\d)/g,
    (_, minus: string, digits: string) =>
      `${minus ? "−" : ""}Rp ${group.format(BigInt(digits))}`,
  );
}

/** "2026-10-20" or "2026-10-20 09:15" → "20 Okt 2026" / "20 Okt 2026 09.15". */
export function conflictPoint(at: string, locale: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(at);
  if (!match) return at;
  const date = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${match[1]}T00:00:00Z`));
  return match[2]
    ? `${date} ${match[2]}${locale === "id" ? "." : ":"}${match[3]}`
    : date;
}

/**
 * The structured 409 ledger conflict (forwarded by the API's exception
 * filter): which point fails, the amounts in the user's locale, and the later
 * rows the change would break. Renders nothing for any other failure.
 */
export function InvestmentConflict({ error }: { error: unknown }) {
  const { locale } = useLocale();
  const { hideBalance } = useMoney();
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    !("at" in error)
  )
    return null;
  const conflict = error as Partial<InvestmentLedgerConflictDto>;
  const copy = locale === "en" ? COPY.en : COPY.id;
  const title =
    conflict.code && conflict.code in copy
      ? copy[conflict.code as keyof typeof COPY.id]
      : copy.HISTORY_CONFLICT;
  const amount = (value: string | undefined) => {
    if (value == null) return "—";
    if (conflict.unit === "units")
      return `${new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
        maximumFractionDigits: 8,
      }).format(Number(value))} ${copy.units}`;
    return money(value, "IDR", locale, hideBalance);
  };
  return (
    <div className="iv-notice iv-conflict" role="alert">
      <strong>{title}</strong>
      <dl>
        <div>
          <dt>{copy.at}</dt>
          <dd>{conflict.at ? conflictPoint(conflict.at, locale) : "—"}</dd>
        </div>
        {conflict.needed && conflict.needed !== "0" && (
          <div>
            <dt>{copy.needed}</dt>
            <dd>{amount(conflict.needed)}</dd>
          </div>
        )}
        <div>
          <dt>{copy.available}</dt>
          <dd>{amount(conflict.available)}</dd>
        </div>
      </dl>
      {Array.isArray(conflict.conflicts) && conflict.conflicts.length > 0 && (
        <>
          <p>{copy.affected}</p>
          <ul>
            {conflict.conflicts.map((row) => (
              <li key={`${row.transactionId}-${row.date}`}>
                {conflictPoint(row.date, locale)} ·{" "}
                {groupRupiah(row.reason, locale)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
