"use client";

import {
  CircleAlert,
  House,
  Landmark,
  Layers,
  Plus,
  RefreshCw,
  Scale,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { AssetsOverviewSummaryDto } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fillCopy, fmtDate, roundIdr, sharePct } from "./aset-model";

export function AsetHeader({
  canManage,
  onAdd,
  onUpdateValue,
}: {
  canManage: boolean;
  onAdd: () => void;
  onUpdateValue: () => void;
}) {
  const { t } = useLocale();
  const c = t.aset.v3;
  return (
    <header className="as3-header">
      <div className="as3-heading">
        <p className="as3-title">{c.title}</p>
        <p>{c.subtitle}</p>
      </div>
      {canManage && (
        <div className="as3-header-actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={onUpdateValue}
          >
            <RefreshCw aria-hidden="true" /> {c.updateValue}
          </button>
          <button
            type="button"
            className="btn btn--primary as3-add"
            onClick={onAdd}
          >
            <Plus aria-hidden="true" /> {c.addAsset}
          </button>
        </div>
      )}
    </header>
  );
}

function ClassBlock({
  icon: Icon,
  tone,
  label,
  value,
  total,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  total: string;
}) {
  const { locale } = useLocale();
  const money = useMoney();
  const pct = sharePct(value, total);
  const pctText =
    pct == null
      ? "—"
      : `${new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID", {
          maximumFractionDigits: pct < 1 && pct > 0 ? 1 : 0,
        }).format(pct)}%`;
  return (
    <div className="as3-class" data-tone={tone}>
      <span className="as3-class-icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="as3-class-body">
        <span className="as3-class-label">{label}</span>
        <strong className="as3-amount">
          {money.formatExact(roundIdr(value))}
        </strong>
        <div className="as3-share">
          <span className="as3-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
          </span>
          <small>{pctText}</small>
        </div>
      </div>
    </div>
  );
}

export function AsetSummary({
  summary,
  isLoading,
}: {
  summary: AssetsOverviewSummaryDto | undefined;
  isLoading: boolean;
}) {
  const { t, locale } = useLocale();
  const c = t.aset.v3;
  const money = useMoney();
  if (!summary) {
    return (
      <section className="as3-card as3-summary" aria-busy={isLoading}>
        <div className="as3-skel as3-skel--summary" />
      </section>
    );
  }
  const fisikLainnya = (
    roundIdr(summary.asetFisikIdr) + roundIdr(summary.lainnyaIdr)
  ).toString();
  const unpricedCost = roundIdr(summary.unpricedCostIdr);
  return (
    <section className="as3-card as3-summary" aria-label={c.summaryAria}>
      <div className="as3-summary-grid">
        <div className="as3-total">
          <span className="as3-total-icon" aria-hidden="true">
            <Layers />
          </span>
          <div className="as3-class-body">
            <span className="as3-class-label">{c.totalLabel}</span>
            <strong className="as3-amount as3-amount--hero">
              {money.formatExact(roundIdr(summary.grossTotalIdr))}
            </strong>
            <small>{c.grossNote}</small>
          </div>
        </div>
        <ClassBlock
          icon={Landmark}
          tone="dana"
          label={c.classes.dana_rekening}
          value={summary.danaRekeningIdr}
          total={summary.grossTotalIdr}
        />
        <ClassBlock
          icon={TrendingUp}
          tone="investasi"
          label={c.classes.investasi}
          value={summary.investasiIdr}
          total={summary.grossTotalIdr}
        />
        <ClassBlock
          icon={House}
          tone="fisik"
          label={`${c.classes.aset_fisik} & ${c.classes.lainnya.toLowerCase()}`}
          value={fisikLainnya}
          total={summary.grossTotalIdr}
        />
      </div>
      <div className="as3-summary-foot">
        <div className="as3-summary-notes">
          <span className="as3-scope" data-scope={summary.scope}>
            {summary.scope === "filtered" ? c.scopeFiltered : c.scopeAll}
          </span>
          <span>
            {fillCopy(c.asOf, {
              date: fmtDate(summary.valuationDate, locale),
            })}
          </span>
          <span>{fillCopy(c.currency, { currency: money.currency })}</span>
          {summary.incomplete && (
            <span className="as3-warn">
              <CircleAlert aria-hidden="true" /> {c.incomplete}
              {unpricedCost > BigInt(0) &&
                ` ${fillCopy(c.costIncluded, { amount: money.formatExact(unpricedCost) })}`}
            </span>
          )}
        </div>
        <div className="as3-networth">
          <Scale aria-hidden="true" />
          <div>
            <span>{c.netWorth}</span>
            {summary.netWorthIdr == null ? (
              <small>{c.netWorthUnavailable}</small>
            ) : (
              <>
                <strong className="as3-amount">
                  {money.formatExact(roundIdr(summary.netWorthIdr))}
                </strong>
                <small>
                  {fillCopy(c.netWorthNote, {
                    amount: money.formatExact(
                      roundIdr(summary.liabilitiesIdr ?? "0"),
                    ),
                  })}
                </small>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
