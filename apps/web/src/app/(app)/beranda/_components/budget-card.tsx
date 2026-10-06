"use client";

import { useRouter } from "next/navigation";
import type { BudgetDto } from "@wealthme/contracts";
import { CardLink, SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";

/**
 * EPIC-026 Wave 8 — prototype's `.card.budget-overview` inside `.bento-side`
 * ("Anggaran Agustus"). Rows come from the same `/budgets` endpoint
 * `/anggaran` already fetches.
 *
 * The bar colour is a modifier class, not an inline style: `design-system.css`
 * sets `.budget-overview .progress__bar { background: … !important }`, which
 * beats an inline background, so `--watch` / `--over` are the only way to get
 * the prototype's amber/red bars here. That is also why this card renders the
 * raw `.progress` markup instead of the `ProgressBar` primitive.
 */

/** Mirrors `/anggaran`'s own `budgetBarColor` derivation from the real DTO. */
function budgetBarModifier(dto: BudgetDto): string {
  if (dto.isOverBudget) return " progress__bar--over";
  if (dto.isNearLimit) return " progress__bar--watch";
  return "";
}

/** "6,2 / 8 jt" style compact spent/limit pair (prototype's `.mono` figure).
 * Strips whatever currency symbol/prefix `formatCompact` renders (Rp, $, ≈ $,
 * …) so this works for any display currency, not just IDR. */
function formatBudgetRow(
  spent: number,
  limit: number,
  formatCompact: (idr: number) => string,
): string {
  const strip = (s: string) => s.replace(/^[^\d-]+/, "");
  return `${strip(formatCompact(spent))} / ${strip(formatCompact(limit))}`;
}

export function BudgetCard({
  isLoading,
  budgets,
}: {
  isLoading: boolean;
  budgets: BudgetDto[];
}) {
  const router = useRouter();
  const { t } = useLocale();
  const money = useMoney();
  const monthLabel = t.laporan.months[new Date().getMonth()];
  const rows = budgets.slice(0, 4);

  return (
    <SectionCard
      className="budget-overview"
      title={`${t.beranda.budgetCardTitlePrefix}${monthLabel}`}
      bodyClassName="stack gap-3.5"
      action={
        <CardLink onClick={() => router.push("/anggaran")}>
          {t.beranda.budgetManageLink}
        </CardLink>
      }
    >
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[38px] animate-pulse rounded-md bg-muted"
            aria-hidden="true"
          />
        ))
      ) : rows.length === 0 ? (
        <div className="t-md t-muted py-4 text-center">
          {t.beranda.budgetEmptyNote}
        </div>
      ) : (
        rows.map((b) => (
          <div key={b.id}>
            <div className="row row--between">
              <span className="t-sm t-bold">{b.categoryName}</span>
              <span
                className="t-xs t-muted mono"
                title={`${money.format(b.spentAmount)} / ${money.format(b.limitAmount)}`}
              >
                {formatBudgetRow(
                  b.spentAmount,
                  b.limitAmount,
                  money.formatCompact,
                )}
              </span>
            </div>
            <div className="progress mt-1.5">
              <div
                className={`progress__bar${budgetBarModifier(b)}`}
                style={{
                  transform: `scaleX(${Math.min(100, Math.max(0, b.usagePercent)) / 100})`,
                }}
              />
            </div>
            {b.isOverBudget && (
              <div className="t-xs t-danger mt-1.5">
                {t.beranda.budgetOverBudgetPrefix}
                {money.format(b.spentAmount - b.limitAmount)}
              </div>
            )}
          </div>
        ))
      )}
    </SectionCard>
  );
}
