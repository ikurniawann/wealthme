"use client";

import { useLocale } from "@/hooks/use-locale";
import { formatRupiah } from "@/lib/format";

import { formatBps } from "./format-bps";
import { TaxRuleBadge } from "./tax-rule-badge";
import { useTaxRules } from "./use-tax-api";

/** `TaxRuleDetailDto.value` for `final.savingsInterest` / `final.depositoInterest`. */
function hasRateShape(
  v: unknown,
): v is { rateBps: number; minPrincipal: string } {
  return typeof v === "object" && v !== null && "rateBps" in v;
}

/**
 * Task 11 (sub-plan L) — /rekening's compact interest-tax notice. Decision
 * (polish): /rekening lost its banners in batch 7b, so this stays a single
 * inline line (no card/border), not a reintroduced banner. Renders nothing
 * while loading or on error/unexpected shape — a missing info hint must
 * never break the page.
 */
export function AccountTaxNotice() {
  const { t } = useLocale();
  const { data, isPending, isError } = useTaxRules([
    "final.savingsInterest",
    "final.depositoInterest",
  ]);

  if (isPending || isError || !data) return null;
  const rule = data.find((r) => hasRateShape(r.value));
  if (!rule || !hasRateShape(rule.value)) return null;

  const { rateBps, minPrincipal } = rule.value;
  const body = t.tax.account.body
    .replace("{rate}", formatBps(rateBps))
    .replace("{threshold}", formatRupiah(Number(minPrincipal)));

  return (
    <div className="flex flex-wrap items-baseline gap-1.5 text-[11.5px] text-muted-foreground">
      <span className="font-semibold text-foreground">
        {t.tax.account.title}:
      </span>
      <span>{body}</span>
      <TaxRuleBadge rules={data} />
    </div>
  );
}
