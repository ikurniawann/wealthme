"use client";

import { useLocale } from "@/hooks/use-locale";
import { SectionCard } from "@/components/wm";
import { formatRupiah } from "@/lib/format";
import { TaxRuleBadge } from "@/components/tax/tax-rule-badge";
import { useTaxSummary } from "@/components/tax/use-tax-api";

import type { Locale } from "@/i18n";
import type { SptStatus } from "@wealthme/contracts";

// Government-copy dates (SPT deadline/grace/filed) — the `+07:00` anchors
// the date-only "YYYY-MM-DD" string to a fixed wall-clock time so it never
// rolls to the previous/next day depending on the viewer's own timezone.
function formatSptDate(dateStr: string, locale: Locale): string {
  return new Date(`${dateStr}T00:00:00+07:00`).toLocaleDateString(
    locale === "en" ? "en-US" : "id-ID",
    { day: "numeric", month: "long", year: "numeric" },
  );
}

// Task 10 (sub-plan L) — the page's single "answer" block: one strong total
// plus three supporting figures and the SPT timeline (Step 0, taste-skill:
// deliberately not another equal-weight card grid like the SPT-status trio
// above it on /tax). Every number comes from `TaxAnnualSummaryDto`.
export function AnnualSummary({ taxYear }: { taxYear: number }) {
  const { t, locale } = useLocale();
  const { data: summary, isPending, isError } = useTaxSummary(taxYear);

  if (isPending || isError || !summary) {
    return (
      <SectionCard title={t.tax.summary.title}>
        <div className="text-[13px] text-muted-foreground">
          {isError ? t.tax.calcErrorLabel : t.tax.calculatingLabel}
        </div>
      </SectionCard>
    );
  }

  const { pphOp, finalTax, umkm, totalEstimatedTax, spt, rules } = summary;
  const balance = pphOp ? Number(pphOp.balance) : 0;

  return (
    <SectionCard title={t.tax.summary.title}>
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        {t.tax.summary.totalLabel.replace("{year}", String(taxYear))}
        <TaxRuleBadge rules={rules} />
      </div>
      <div className="mt-1 text-[30px] font-black tracking-[-1px] text-primary">
        {formatRupiah(Number(totalEstimatedTax))}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2.5 text-[12.5px]">
        <div>
          <div className="text-muted-foreground">
            {t.tax.summary.pphOpLabel}
          </div>
          {pphOp ? (
            <>
              <div className="mono font-semibold">
                {formatRupiah(Number(pphOp.tax))}
              </div>
              <div
                className={
                  balance < 0 ? "text-success" : "text-muted-foreground"
                }
              >
                {balance < 0
                  ? `${t.tax.summary.balanceOver} (${formatRupiah(Math.abs(balance))})`
                  : `${t.tax.summary.balanceDue} (${formatRupiah(balance)})`}
              </div>
            </>
          ) : (
            <div className="max-w-[220px] text-muted-foreground">
              {t.tax.summary.noRecord}
            </div>
          )}
        </div>
        <div>
          <div className="text-muted-foreground">
            {t.tax.summary.finalLabel}
          </div>
          <div className="mono font-semibold">
            {formatRupiah(Number(finalTax.totalTax))}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">{t.tax.summary.umkmLabel}</div>
          <div className="mono font-semibold">
            {formatRupiah(Number(umkm?.totalTax ?? 0))}
          </div>
        </div>
      </div>

      <div className="mt-3.5 space-y-1.5 rounded-[12px] border border-border p-3.5 text-[12.5px]">
        {spt.status && (
          <div className="font-semibold">
            {t.tax.sptStatusLabels[spt.status as SptStatus]}
          </div>
        )}
        <div className="text-muted-foreground">
          {t.tax.summary.deadlineLabel}: {formatSptDate(spt.deadline, locale)}
        </div>
        <div
          className={
            spt.pastDeadline ? "text-destructive" : "text-muted-foreground"
          }
        >
          {spt.pastDeadline
            ? t.tax.summary.daysLate.replace(
                "{n}",
                String(Math.abs(spt.daysToDeadline)),
              )
            : t.tax.summary.daysLeft.replace("{n}", String(spt.daysToDeadline))}
        </div>
        {spt.graceUntil && (
          <div className="notice notice--info">
            {t.tax.summary.graceNote
              .replace("{date}", formatSptDate(spt.graceUntil, locale))
              .replace("{deadline}", formatSptDate(spt.deadline, locale))}
          </div>
        )}
        {spt.filedAt && (
          <div className="text-muted-foreground">
            {t.tax.summary.filedAtPrefix} {formatSptDate(spt.filedAt, locale)}
          </div>
        )}
        <div className="text-[11px] text-muted-foreground">
          {t.tax.summary.coretaxNote}
        </div>
      </div>
    </SectionCard>
  );
}
