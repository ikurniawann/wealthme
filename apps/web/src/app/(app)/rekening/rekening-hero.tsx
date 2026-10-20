"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { BentoCard, GhostButton } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fill } from "@/i18n/rekening-v3";

import { formatDay } from "./format-day";
import {
  composition,
  type AttentionItem,
  type CompositionAxis,
  type Exposure,
  type Liquidity,
  type RekeningRow,
} from "./rekening-model";

/** Categorical slice colours on the always-dark hero (--viz-* of .wm-dark). */
const SLICE_VARS = [
  "var(--viz-2)",
  "var(--viz-5)",
  "var(--viz-3)",
  "var(--viz-4)",
  "var(--viz-1)",
  "var(--viz-6)",
];

interface HeroProps {
  rows: readonly RekeningRow[];
  liquidity: Liquidity;
  insuredShare: number;
  uninsured: number;
  interest: number;
  bankCount: number;
  usdTotal: number | null;
  loading: boolean;
  error: boolean;
  canManage: boolean;
  onAdd: () => void;
  /** A search, filter or focus narrows the rows: say so, offer to clear. */
  filtered?: boolean;
  onClearFilters?: () => void;
}

/**
 * Rekening v3 — the dark summary card. The old per-account bar chart is
 * gone: its x-axis labels collided once a family had more than a handful of
 * accounts, and the Apex canvas re-measured itself on layout shifts (the
 * "sometimes small, sometimes big" bug). A plain CSS composition bar has a
 * fixed height, and its legend wraps instead of overlapping; past five
 * slices the tail folds into "Lainnya".
 */
export function RekeningHero({
  rows,
  liquidity,
  insuredShare,
  uninsured,
  interest,
  bankCount,
  usdTotal,
  loading,
  error,
  canManage,
  onAdd,
  filtered = false,
  onClearFilters,
}: HeroProps) {
  const { t } = useLocale();
  const c = t.rekening.v3;
  const money = useMoney();
  const [axis, setAxis] = useState<CompositionAxis>("bank");
  const slices = composition(
    rows,
    axis,
    (r) =>
      axis === "bank"
        ? r.bankName
        : axis === "kind"
          ? (r.country === "ID" ? c.kinds : c.kindsForeign)[r.kind]
          : r.holderLabel,
    c.page.other,
  );
  const value = error ? "—" : loading ? "…" : money.format(liquidity.total);
  const hidden = rows.length > 0 && rows.every((r) => r.balance === null);

  return (
    <section className="wm-card wm-dark rk3-hero" aria-labelledby="rk3-total">
      <div className="rk3-hero-head">
        <div className="min-w-0">
          <p className="rk3-eyebrow" id="rk3-total">
            {c.page.totalLabel}
          </p>
          <p className="wm-big rk3-total">
            {hidden ? money.formatBalance(null) : value}
          </p>
          {filtered && (
            <p className="rk3-filtered">
              <span className="rk3-filtered-chip">{c.page.filteredHint}</span>
              {onClearFilters && (
                <button type="button" onClick={onClearFilters}>
                  {c.page.clearFilters}
                </button>
              )}
            </p>
          )}
          <p className="rk3-sub">
            {fill(c.page.summary, { accounts: rows.length, banks: bankCount })}
            {usdTotal !== null &&
              ` · ≈ US$ ${usdTotal.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`}
          </p>
        </div>
        <div className="rk3-hero-actions">
          <div className="wm-seg" role="tablist" aria-label={c.page.axis.bank}>
            {(["bank", "kind", "holder"] as const).map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={axis === a}
                onClick={() => setAxis(a)}
              >
                {c.page.axis[a]}
              </button>
            ))}
          </div>
          {canManage && (
            <GhostButton lit onClick={onAdd}>
              <Plus aria-hidden="true" /> {c.page.addAccount}
            </GhostButton>
          )}
        </div>
      </div>

      {slices.length > 0 && (
        <div className="rk3-comp">
          <div className="rk3-stack" aria-hidden="true">
            {slices.map((s, i) => (
              <span
                key={s.key}
                style={{
                  flexGrow: s.amount,
                  background: SLICE_VARS[i % SLICE_VARS.length],
                }}
              />
            ))}
          </div>
          <ul className="rk3-legend">
            {slices.map((s, i) => (
              <li key={s.key}>
                <i
                  style={{ background: SLICE_VARS[i % SLICE_VARS.length] }}
                  aria-hidden="true"
                />
                <span className="rk3-legend-name">{s.label}</span>
                <span className="wm-num">{money.formatCompact(s.amount)}</span>
                <b>{s.percent}%</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rk3-kpis">
        <Kpi
          label={c.page.liquid}
          value={money.formatBalance(hidden ? null : liquidity.liquid, true)}
          hint={c.page.liquidHint}
        />
        <Kpi
          label={c.page.locked}
          value={money.formatBalance(hidden ? null : liquidity.locked, true)}
          hint={
            liquidity.locked > 0
              ? fill(c.page.lockedHint, { n: liquidity.maturingSoon })
              : c.page.lockedNone
          }
        />
        <Kpi
          label={c.page.insured}
          value={hidden ? "—" : `${Math.floor(insuredShare * 100)}%`}
          hint={
            uninsured > 0
              ? fill(c.page.insuredGap, {
                  amount: money.formatCompact(uninsured),
                })
              : c.page.insuredAll
          }
          warn={uninsured > 0}
        />
        <Kpi
          label={c.page.interest}
          value={
            interest > 0
              ? money.formatBalance(hidden ? null : interest, true)
              : "—"
          }
          hint={interest > 0 ? c.page.interestHint : c.page.interestNone}
        />
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div className="rk3-kpi" data-warn={warn || undefined}>
      <span>{label}</span>
      <b className="wm-num">{value}</b>
      <small>{hint}</small>
    </div>
  );
}

interface AttentionProps {
  items: readonly AttentionItem[];
  onFocusAccount: (id: string) => void;
  onFocusSet: (ids: string[]) => void;
}

export function AttentionCard({
  items,
  onFocusAccount,
  onFocusSet,
}: AttentionProps) {
  const { t, locale } = useLocale();
  const c = t.rekening.v3;
  const money = useMoney();
  return (
    <BentoCard
      className={items.length === 0 ? "rk3-attn rk3-attn--empty" : "rk3-attn"}
      title={c.page.attentionTitle}
    >
      {items.length === 0 ? (
        <p className="rk3-attn-empty">{c.page.attentionEmpty}</p>
      ) : (
        <ul className="rk3-attn-list">
          {items.slice(0, 5).map((item, i) => (
            <li key={i}>
              <AttentionRow
                item={item}
                c={c}
                format={money.format}
                locale={locale}
                onFocusAccount={onFocusAccount}
                onFocusSet={onFocusSet}
              />
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}

function AttentionRow({
  item,
  c,
  format,
  locale,
  onFocusAccount,
  onFocusSet,
}: {
  item: AttentionItem;
  c: ReturnType<typeof useLocale>["t"]["rekening"]["v3"];
  format: (n: number) => string;
  locale: "id" | "en";
  onFocusAccount: (id: string) => void;
  onFocusSet: (ids: string[]) => void;
}) {
  let tone: string;
  let icon: string;
  let title: string;
  let body: string;
  let action: () => void;
  let actionLabel = c.page.see;
  switch (item.kind) {
    case "maturity": {
      const a = item.row.account;
      tone = "violet";
      icon = "⏱";
      title =
        item.days === 0
          ? fill(c.page.attnMaturityToday, { name: a.name })
          : fill(c.page.attnMaturity, { name: a.name, days: item.days });
      body = fill(c.page.attnMaturityBody, {
        amount: item.row.balance === null ? "—" : format(item.row.balance),
        instruction: a.maturityInstruction
          ? c.instructions[a.maturityInstruction]
          : "",
        date: item.row.maturity ? formatDay(item.row.maturity, locale) : "",
      });
      action = () => onFocusAccount(a.id);
      break;
    }
    case "insurance": {
      const e: Exposure = item.exposure;
      tone = item.over ? "warn" : "amber";
      icon = "!";
      title = fill(
        item.over ? c.page.attnInsuranceOver : c.page.attnInsuranceNear,
        {
          bank: e.bankName,
          holder: e.holderLabel,
          insurer: e.insurer,
        },
      );
      body = fill(c.page.attnInsuranceBody, {
        total: format(e.total),
        cap: format(e.capIdr),
      });
      action = () => onFocusSet(e.ids);
      actionLabel = c.page.review;
      break;
    }
    case "idle":
      tone = "grey";
      icon = "z";
      title = fill(c.page.attnIdle, { n: item.rows.length });
      body = c.page.attnIdleBody;
      action = () => onFocusSet(item.rows.map((r) => r.account.id));
      actionLabel = c.page.review;
      break;
    case "taxReport":
      tone = "blue";
      icon = "§";
      title = fill(c.page.attnTax, { n: item.rows.length });
      body = c.page.attnTaxBody;
      action = () => onFocusSet(item.rows.map((r) => r.account.id));
      actionLabel = c.page.review;
      break;
  }
  return (
    <button
      type="button"
      className="rk3-attn-item"
      data-tone={tone}
      onClick={action}
    >
      <span className="rk3-attn-ico" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <b>{title}</b>
        <small>{body}</small>
      </span>
      <em>{actionLabel} ›</em>
    </button>
  );
}
