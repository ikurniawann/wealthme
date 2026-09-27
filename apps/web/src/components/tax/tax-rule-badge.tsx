"use client";
import { useLocale } from "@/hooks/use-locale";

import type { TaxRuleRefDto } from "@wealthme/contracts";

export function TaxRuleBadge({ rules }: { rules: readonly TaxRuleRefDto[] }) {
  const { t } = useLocale();
  const flagged = rules.filter((r) => !r.verified || r.outOfRange);
  if (flagged.length === 0) return null;
  return (
    <details className="group inline-block text-[11px]">
      <summary className="badge badge--warning cursor-pointer list-none">
        {t.tax.rules.unverifiedBadge}
      </summary>
      <div className="mt-1.5 space-y-1.5 rounded-[10px] border border-warning/30 bg-card p-2.5 text-muted-foreground shadow-sm">
        <p className="font-medium text-foreground">
          {t.tax.rules.unverifiedIntro}
        </p>
        <ul className="space-y-1">
          {flagged.map((r) => (
            <li key={`${r.key}|${r.effectiveFrom}`}>
              {r.source ? (
                <a
                  href={r.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {r.legalBasis}
                </a>
              ) : (
                <span className="font-medium text-foreground">
                  {r.legalBasis}
                </span>
              )}
              {r.outOfRange && <span>. {t.tax.rules.outOfRange}</span>}
              {r.note && <span className="block">{r.note}</span>}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
