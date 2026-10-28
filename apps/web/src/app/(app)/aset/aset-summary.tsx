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
import { InfoTip } from "@/components/wm";
import "./aset-summary.css";
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

/** Gold held across physical assets and holdings, in grams (kg × 1000). */
export function totalGoldGrams(
  rows: readonly {
    subtype: string;
    quantity: string | null;
    unit: string | null;
  }[],
): number {
  return rows.reduce((sum, r) => {
    if (r.subtype !== "emas" || !r.quantity) return sum;
    const n = Number(r.quantity);
    if (!Number.isFinite(n)) return sum;
    const unit = (r.unit ?? "gram").trim().toLowerCase();
    if (unit === "kg") return sum + n * 1000;
    if (unit === "gram" || unit === "g" || unit === "gr") return sum + n;
    return sum;
  }, 0);
}

export function AsetSummary({
  summary,
  isLoading,
  goldGrams = 0,
}: {
  summary: AssetsOverviewSummaryDto | undefined;
  isLoading: boolean;
  goldGrams?: number;
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
          {goldGrams > 0 && (
            <span className="as3-scope">
              {t.aset.goldTotalLabel}:{" "}
              {new Intl.NumberFormat(locale, {
                maximumFractionDigits: 3,
              }).format(goldGrams)}{" "}
              gr
            </span>
          )}
          {summary.incomplete && (
            <span className="as3-flag">
              <CircleAlert aria-hidden="true" />
              {c.incompleteShort}
              <InfoTip label={c.incompleteMore} align="start">
                {c.incomplete}
                {unpricedCost > BigInt(0) &&
                  ` ${fillCopy(c.costIncluded, { amount: money.formatExact(unpricedCost) })}`}
              </InfoTip>
            </span>
          )}
        </div>
        <p className="as3-summary-meta">
          <span className="as3-nw">
            <Scale aria-hidden="true" />
            {c.netWorth}{" "}
            {summary.netWorthIdr == null ? (
              <em>{c.netWorthUnavailable}</em>
            ) : (
              <>
                <strong className="as3-amount">
                  {money.formatExact(roundIdr(summary.netWorthIdr))}
                </strong>
                <InfoTip label={c.netWorth}>
                  {fillCopy(c.netWorthNote, {
                    amount: money.formatExact(
                      roundIdr(summary.liabilitiesIdr ?? "0"),
                    ),
                  })}
                </InfoTip>
              </>
            )}
          </span>
          <span>
            {fillCopy(c.asOf, {
              date: fmtDate(summary.valuationDate, locale),
            })}
          </span>
          <span>{fillCopy(c.currency, { currency: money.currency })}</span>
        </p>
      </div>
    </section>
  );
}
