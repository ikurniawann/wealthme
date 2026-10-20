"use client";

import { BarChart3, Plus, X } from "lucide-react";
import type { ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/hooks/use-locale";

import {
  fillCopy,
  formatDay,
  formatNative,
  jakartaToday,
} from "./asuransi-model";
import { DateInput, Field } from "./form-fields";
import {
  NAV_DECIMALS,
  UNIT_DECIMALS,
  VALUE_DECIMALS,
  canonical,
  emptyFund,
  mulDecimal,
  typingDecimals,
  type CashValueRow,
  type FundRow,
  type PolicyFormState,
} from "./policy-form-model";
import { POLICY_CURRENCIES } from "./policy-form-model";

type Props = {
  state: PolicyFormState;
  set: (patch: Partial<PolicyFormState>) => void;
  errors: Record<string, string>;
  aiAction: ReactNode;
};

/**
 * Investasi — unit link: sub-funds (units × NAV previewed exactly, stored and
 * recomputed by the API with Decimal; "Perlu konfirmasi" until ticked).
 * Traditional: cash value / surrender / maturity instead (no unit fields).
 */
export function InvestmentSection({ state, set, errors, aiAction }: Props) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3.form;
  const setFunds = (rows: FundRow[]) => set({ funds: rows });
  const patchFund = (rowId: string, patch: Partial<FundRow>) =>
    setFunds(
      state.funds.map((f) => (f.rowId === rowId ? { ...f, ...patch } : f)),
    );
  const today = jakartaToday();

  return (
    <section
      id="ins3f-invest"
      className="ins3f-section ins3f-section--wide"
      aria-labelledby="ins3f-invest-title"
    >
      <header className="ins3f-section-head ins3f-section-head--action">
        <span className="ins3f-section-icon" aria-hidden="true">
          <BarChart3 />
        </span>
        <div>
          <h3 id="ins3f-invest-title">{c.investTitle}</h3>
          <p>
            {state.policyType === "traditional" ? c.investSubTrad : c.investSub}
          </p>
        </div>
        {aiAction}
      </header>

      {state.policyType === "" && (
        <p className="ins3-callout" data-tone="info" role="note">
          {c.investNoType}
        </p>
      )}

      {state.policyType === "unit_link" && (
        <>
          {state.funds.length === 0 && <p className="hint">{c.fundsEmpty}</p>}
          {state.funds.map((f, i) => (
            <FundEditor
              key={f.rowId}
              fund={f}
              index={i}
              today={today}
              locale={locale}
              error={errors[`fund-${f.rowId}`]}
              onChange={(patch) => patchFund(f.rowId, patch)}
              onRemove={
                f.fundId
                  ? null
                  : () =>
                      setFunds(state.funds.filter((x) => x.rowId !== f.rowId))
              }
            />
          ))}
          <button
            type="button"
            className="ins3-link"
            onClick={() =>
              setFunds([...state.funds, emptyFund(state.currency)])
            }
          >
            <Plus aria-hidden="true" /> {c.addFund}
          </button>
          <p className="hint">{c.fundsNote}</p>
        </>
      )}

      {state.policyType === "traditional" && (
        <CashEditor
          cash={state.cash}
          today={today}
          error={errors.cash}
          currency={state.currency}
          onChange={(patch) => set({ cash: { ...state.cash, ...patch } })}
        />
      )}

      {state.policyType !== "" && (
        <label className="ins3f-switch-row">
          <Switch
            checked={state.includeInNetWorth}
            onCheckedChange={(v) => set({ includeInNetWorth: v })}
          />
          <span>
            {c.includeNetWorth}
            <small className="ins3f-block">{c.includeNetWorthHint}</small>
          </span>
        </label>
      )}
    </section>
  );
}

function FundEditor({
  fund: f,
  index,
  today,
  locale,
  error,
  onChange,
  onRemove,
}: {
  fund: FundRow;
  index: number;
  today: string;
  locale: string;
  error?: string;
  onChange: (patch: Partial<FundRow>) => void;
  onRemove: (() => void) | null;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3.form;
  const id = `ins3f-fund-${f.rowId}`;
  const units = canonical(f.units);
  const nav = canonical(f.nav);
  const value = units && nav ? mulDecimal(units, nav) : null;
  const datesDiffer = Boolean(
    f.unitsDate && f.navDate && f.unitsDate !== f.navDate,
  );
  const latest = f.latest;
  return (
    <div
      className="ins3f-fund"
      role="group"
      aria-label={`${c.fund} ${index + 1}${f.name ? ` — ${f.name}` : ""}`}
    >
      <div className="ins3f-fund-grid">
        <Field id={`${id}-name`} label={c.fundName} error={error}>
          <input
            id={`${id}-name`}
            className="input ins3f-input"
            value={f.name}
            placeholder={c.fundNamePh}
            autoComplete="off"
            aria-invalid={Boolean(error) || undefined}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field id={`${id}-code`} label={c.fundCode}>
          <input
            id={`${id}-code`}
            className="input ins3f-input mono"
            value={f.code}
            autoComplete="off"
            onChange={(e) => onChange({ code: e.target.value })}
          />
        </Field>
        <Field id={`${id}-cur`} label={c.currency}>
          <select
            id={`${id}-cur`}
            className="select ins3f-input"
            value={f.currency}
            disabled={Boolean(f.fundId)}
            onChange={(e) => onChange({ currency: e.target.value })}
          >
            {POLICY_CURRENCIES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-units`} label={c.units}>
          <input
            id={`${id}-units`}
            className="input ins3f-input mono"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            value={f.units}
            placeholder="0"
            onChange={(e) =>
              onChange({ units: typingDecimals(e.target.value, UNIT_DECIMALS) })
            }
          />
        </Field>
        <Field id={`${id}-nav`} label={c.nav}>
          <input
            id={`${id}-nav`}
            className="input ins3f-input mono"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            value={f.nav}
            placeholder="0"
            onChange={(e) =>
              onChange({ nav: typingDecimals(e.target.value, NAV_DECIMALS) })
            }
          />
        </Field>
        <Field id={`${id}-navdate`} label={c.navDate}>
          <DateInput
            id={`${id}-navdate`}
            value={f.navDate}
            max={today}
            onChange={(v) => onChange({ navDate: v })}
          />
        </Field>
        <Field id={`${id}-udate`} label={c.unitsDate} hint={c.unitsDateHint}>
          <DateInput
            id={`${id}-udate`}
            value={f.unitsDate}
            max={today}
            onChange={(v) => onChange({ unitsDate: v })}
          />
        </Field>
      </div>
      <div className="ins3f-fund-foot">
        <div className="ins3f-value" aria-live="polite">
          <span className="label">{c.fundValue}</span>
          <strong className="ins3-amount">
            {value ? formatNative(value, f.currency, locale) : "—"}
          </strong>
          {value && (
            <small>
              {f.units} × {formatNative(nav, f.currency, locale)}
              {datesDiffer ? ` · ${c.datesDiffer}` : ""}
            </small>
          )}
          {!value && latest && (
            <small>
              {fillCopy(c.fundLatest, {
                value: formatNative(
                  latest.computedValue ?? latest.reportedValue,
                  latest.currency,
                  locale,
                ),
                date: formatDay(latest.effectiveDate, locale),
                status: t.asuransi.v3.aiStatus[latest.status],
              })}
            </small>
          )}
        </div>
        {value && (
          <label
            className="ins3f-confirm"
            data-state={f.confirmed ? "confirmed" : "pending"}
          >
            <input
              type="checkbox"
              checked={f.confirmed}
              onChange={(e) => onChange({ confirmed: e.target.checked })}
            />
            <span>
              <span
                className="ins3-chip"
                data-tone={f.confirmed ? "good" : "warn"}
              >
                {f.confirmed
                  ? t.asuransi.v3.aiStatus.confirmed
                  : t.asuransi.v3.aiStatus.needs_confirmation}
              </span>
              <small className="ins3f-block">{c.confirmTick}</small>
            </span>
          </label>
        )}
        {onRemove && (
          <button
            type="button"
            className="ins3f-icon-btn"
            aria-label={`${c.remove} ${f.name || `${c.fund} ${index + 1}`}`}
            onClick={onRemove}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      {f.snippet && (
        <p className="hint">
          {fillCopy(c.fromReport, { page: f.page ?? "—" })} · “{f.snippet}”
        </p>
      )}
    </div>
  );
}

function CashEditor({
  cash,
  today,
  error,
  currency,
  onChange,
}: {
  cash: CashValueRow;
  today: string;
  error?: string;
  currency: string;
  onChange: (patch: Partial<CashValueRow>) => void;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3.form;
  const money = (
    key: "cashValue" | "surrenderEstimate" | "maturityBenefit",
    label: string,
  ) => (
    <Field id={`ins3f-${key}`} label={`${label} (${currency})`}>
      <input
        id={`ins3f-${key}`}
        className="input ins3f-input mono ins3f-money"
        inputMode="decimal"
        autoComplete="off"
        value={cash[key]}
        placeholder="0"
        onChange={(e) =>
          onChange({ [key]: typingDecimals(e.target.value, VALUE_DECIMALS) })
        }
      />
    </Field>
  );
  return (
    <div className="ins3f-fund">
      <div className="ins3f-pair">
        {money("cashValue", c.cashValue)}
        {money("surrenderEstimate", c.surrender)}
        {money("maturityBenefit", c.maturity)}
        <Field id="ins3f-cash-date" label={c.effectiveDate} error={error}>
          <DateInput
            id="ins3f-cash-date"
            value={cash.effectiveDate}
            max={today}
            invalid={Boolean(error)}
            onChange={(v) => onChange({ effectiveDate: v })}
          />
        </Field>
      </div>
      <label className="ins3f-switch-row">
        <Switch
          checked={cash.guaranteed}
          onCheckedChange={(v) => onChange({ guaranteed: v })}
        />
        <span>{c.guaranteed}</span>
      </label>
      <label
        className="ins3f-confirm"
        data-state={cash.confirmed ? "confirmed" : "pending"}
      >
        <input
          type="checkbox"
          checked={cash.confirmed}
          onChange={(e) => onChange({ confirmed: e.target.checked })}
        />
        <span>
          <span
            className="ins3-chip"
            data-tone={cash.confirmed ? "good" : "warn"}
          >
            {cash.confirmed
              ? t.asuransi.v3.aiStatus.confirmed
              : t.asuransi.v3.aiStatus.needs_confirmation}
          </span>
          <small className="ins3f-block">{c.confirmTick}</small>
        </span>
      </label>
      <p className="hint">{c.cashNote}</p>
    </div>
  );
}
