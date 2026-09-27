"use client";

import { useState } from "react";

import { useLocale } from "@/hooks/use-locale";
import { formatRupiah } from "@/lib/format";

import { formatBps } from "./format-bps";
import { usePpnPreview } from "./use-tax-api";

const wibDate = (iso: string): string =>
  new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

const digits = (amount: string): string =>
  amount.split(".")[0]!.replace(/\D/g, "") || "0";

/**
 * Task 11 (sub-plan L) — the collapsed "Info PPN" hint shown in an
 * expense's purchase context (`TransactionDetailDialog`). Read-only: it
 * previews the VAT already inside the receipt total, never touches the
 * transaction. The preview query is enabled only once the `<details>` is
 * opened, so mounting it per dialog open does not fire a request.
 */
export function PpnHint({
  amount,
  occurredAt,
}: {
  amount: string;
  occurredAt: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [luxury, setLuxury] = useState(false);

  const { data: result } = usePpnPreview(
    open
      ? {
          date: wibDate(occurredAt),
          amount: digits(amount),
          luxury,
          priceIncludesPpn: true,
        }
      : null,
  );

  return (
    <details className="mt-2" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-[12px] font-semibold text-muted-foreground">
        {t.tax.ppn.summary}
      </summary>
      <div className="mt-2 space-y-1.5 rounded-[10px] border bg-card p-2.5 text-[12px]">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={luxury}
            onChange={(e) => setLuxury(e.target.checked)}
          />
          {t.tax.ppn.luxuryToggle}
        </label>
        {result && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t.tax.ppn.dppLabel}
              </span>
              <span className="mono">{formatRupiah(Number(result.dpp))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t.tax.ppn.ppnLabel}
              </span>
              <span className="mono">{formatRupiah(Number(result.ppn))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t.tax.ppn.effectiveLabel}
              </span>
              <span className="mono">{formatBps(result.effectiveBps)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t.tax.ppn.mechanismNote
                .replace("{nominal}", formatBps(result.nominalBps))
                .replace("{effective}", formatBps(result.effectiveBps))}
            </p>
          </>
        )}
        <p className="text-[11px] text-muted-foreground">
          {t.tax.ppn.infoOnly}
        </p>
      </div>
    </details>
  );
}
