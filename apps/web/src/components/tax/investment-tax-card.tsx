"use client";

import Link from "next/link";
import { canAccessPage } from "@wealthme/contracts";

import { SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { formatRupiah } from "@/lib/format";

import { TaxRuleBadge } from "./tax-rule-badge";
import { useInvestmentTaxEstimate, useSetCryptoExchange } from "./use-tax-api";

import type { CryptoExchangeKind, FinalTaxLineDto } from "@wealthme/contracts";

const KRIPTO_INSTRUMENTS = new Set(["kripto_domestik", "kripto_luar"]);

/** `2026-09-27T.. +7h → 2026-09-27` — the same WIB-anchored tax-year rule
 * every other tax surface uses (see `ppn-hint.tsx`, `account-tax-notice.tsx`). */
function wibDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Task 11 (sub-plan L) — /investasi's final-tax summary card: the total
 * estimated final tax across this year's holdings (`FinalTaxEstimateDto`
 * via `useInvestmentTaxEstimate`), its top 5 lines, and a per-line exchange
 * select for kripto lines (server re-derives the rate on change).
 */
export function InvestmentTaxCard() {
  const { t } = useLocale();
  const { access } = useMyAccess();
  const year = Number(wibDate(new Date().toISOString()).slice(0, 4));
  const { data: result, isPending } = useInvestmentTaxEstimate(year);
  const setCryptoExchange = useSetCryptoExchange(year);

  const canViewTax = !!access && canAccessPage(access, "tax", "view");
  const lines = result?.lines ?? [];
  const topLines = [...lines]
    .sort((a, b) => Number(b.tax ?? 0) - Number(a.tax ?? 0))
    .slice(0, 5);

  function handleExchangeChange(
    line: FinalTaxLineDto,
    exchange: CryptoExchangeKind,
  ) {
    if (!line.investmentId) return;
    setCryptoExchange.mutate({
      investmentId: line.investmentId,
      cryptoExchange: exchange,
    });
  }

  if (isPending) return null;

  return (
    <SectionCard title={t.tax.invest.title}>
      {lines.length === 0 ? (
        <div className="hint">{t.tax.invest.empty}</div>
      ) : (
        <div className="space-y-2.5">
          <div className="table-wrap">
            <table className="table table--num">
              <tbody>
                {topLines.map((line, idx) => (
                  <tr
                    key={
                      line.investmentId ??
                      line.entryId ??
                      `${line.instrument}-${idx}`
                    }
                  >
                    <td>
                      <div>{t.tax.final.instruments[line.instrument]}</div>
                      {line.label && (
                        <div className="text-[11px] text-muted-foreground">
                          {line.label}
                        </div>
                      )}
                      {line.caveat && (
                        <div className="text-[11px] text-muted-foreground">
                          {t.tax.final.caveats[line.caveat]}
                        </div>
                      )}
                    </td>
                    <td className="mono">
                      {line.tax === null ? "—" : formatRupiah(Number(line.tax))}
                    </td>
                    <td>
                      <TaxRuleBadge rules={[line.rule]} />
                    </td>
                    <td>
                      {KRIPTO_INSTRUMENTS.has(line.instrument) && (
                        <>
                          <label
                            className="sr-only"
                            htmlFor={`exchange-${line.investmentId}`}
                          >
                            {t.tax.invest.exchangeLabel}
                          </label>
                          <select
                            id={`exchange-${line.investmentId}`}
                            aria-label={t.tax.invest.exchangeLabel}
                            className="select"
                            defaultValue={
                              line.instrument === "kripto_luar"
                                ? "luar_negeri"
                                : "domestik"
                            }
                            onChange={(e) =>
                              handleExchangeChange(
                                line,
                                e.target.value as CryptoExchangeKind,
                              )
                            }
                          >
                            <option value="domestik">
                              {t.tax.invest.exchangeOptions.domestik}
                            </option>
                            <option value="luar_negeri">
                              {t.tax.invest.exchangeOptions.luar_negeri}
                            </option>
                          </select>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!result && (
            <div className="text-[13px] font-semibold">
              {t.tax.final.totalPrefix}{" "}
              <span className="mono text-primary">
                {formatRupiah(Number(result.totalTax))}
              </span>
            </div>
          )}
          {canViewTax && (
            <Link
              href="/tax#pajak-final"
              className="text-[12px] font-semibold text-primary hover:underline"
            >
              {t.tax.invest.viewInTax}
            </Link>
          )}
        </div>
      )}
    </SectionCard>
  );
}
