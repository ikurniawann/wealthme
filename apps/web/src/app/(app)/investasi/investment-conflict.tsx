"use client";
import { useLocale } from "@/hooks/use-locale";
import type { InvestmentLedgerConflictDto } from "@wealthme/contracts";
export function InvestmentConflict({ error }: { error: unknown }) {
  const { t } = useLocale();
  const f = t.investasi.forms;
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    !("at" in error)
  )
    return null;
  const conflict = error as Partial<InvestmentLedgerConflictDto>;
  return (
    <div className="iv-notice" role="alert">
      <div>
        <strong>{conflict.code}</strong>
        <p>
          {f.date}: {conflict.at}
        </p>
        <p>
          {f.transactionValue}: {conflict.needed} · {t.investasi.v3.available}:{" "}
          {conflict.available} {conflict.unit}
        </p>
        {Array.isArray(conflict.conflicts) && (
          <ul>
            {conflict.conflicts.map((row) => (
              <li key={row.transactionId}>
                {row.date} · {row.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
