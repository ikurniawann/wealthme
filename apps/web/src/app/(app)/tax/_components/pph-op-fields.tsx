"use client";

import { useLocale } from "@/hooks/use-locale";
import { formatNumber, formatRupiah, parseRupiah } from "@/lib/format";
import { TaxRuleBadge } from "@/components/tax/tax-rule-badge";

import { MAX_TAX_INPUT } from "./digits";

import type { PphOpResultDto, TaxMaritalStatus } from "@wealthme/contracts";

const DEPENDENTS_OPTIONS = [0, 1, 2, 3];
const MARITAL_OPTIONS: TaxMaritalStatus[] = ["TK", "K", "KI"];

// Task 9 (sub-plan L) — the detailed PPh OP calculator's inputs: marital
// status + dependents (server derives PTKP from these, never a client-side
// lookup), pension, withheld PPh 21, freelance turnover + NPPN %, and other
// net income. Shares `.tax-calculator-grid` (design-system.css, protected)
// with the legacy 2-col grid so control heights/label spacing stay
// consistent with the rest of the app's calculators.
export function PphOpFields({
  maritalStatus,
  onMaritalStatusChange,
  dependents,
  onDependentsChange,
  pension,
  onPensionChange,
  withheld,
  onWithheldChange,
  freelance,
  onFreelanceChange,
  nppnPct,
  onNppnPctChange,
  otherNet,
  onOtherNetChange,
  ptkp,
  nppnRule,
}: {
  maritalStatus: TaxMaritalStatus;
  onMaritalStatusChange: (v: TaxMaritalStatus) => void;
  dependents: number;
  onDependentsChange: (v: number) => void;
  pension: string;
  onPensionChange: (v: string) => void;
  withheld: string;
  onWithheldChange: (v: string) => void;
  freelance: string;
  onFreelanceChange: (v: string) => void;
  nppnPct: string;
  onNppnPctChange: (v: string) => void;
  otherNet: string;
  onOtherNetChange: (v: string) => void;
  ptkp: PphOpResultDto["ptkp"] | undefined;
  nppnRule: PphOpResultDto["rules"];
}) {
  const { t } = useLocale();

  function moneyField(
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    className = "field",
  ) {
    return (
      <div className={className}>
        <label htmlFor={id} className="label">
          {label}
        </label>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value === ""
                ? ""
                : formatNumber(
                    Math.min(parseRupiah(e.target.value), MAX_TAX_INPUT),
                  ),
            )
          }
          className="input"
        />
      </div>
    );
  }

  return (
    <div className="tax-calculator-grid grid grid-cols-1 gap-3.5 md:grid-cols-2">
      <div className="field">
        <label htmlFor="tax-marital-select" className="label">
          {t.tax.op.statusLabel}
        </label>
        <select
          id="tax-marital-select"
          value={maritalStatus}
          onChange={(e) =>
            onMaritalStatusChange(e.target.value as TaxMaritalStatus)
          }
          className="select"
        >
          {MARITAL_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {t.tax.op.maritalLabels[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="tax-dependents-select" className="label">
          {t.tax.op.dependentsLabel}
        </label>
        <select
          id="tax-dependents-select"
          value={dependents}
          onChange={(e) => onDependentsChange(Number(e.target.value))}
          className="select"
        >
          {DEPENDENTS_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {ptkp !== undefined && (
          <div className="hint">
            {t.tax.op.ptkpDerivedPrefix}
            <span className="mono">{formatRupiah(Number(ptkp))}</span>
          </div>
        )}
      </div>
      {moneyField(
        "tax-pension-input",
        t.tax.op.pensionLabel,
        pension,
        onPensionChange,
      )}
      {moneyField(
        "tax-withheld-input",
        t.tax.op.withheldLabel,
        withheld,
        onWithheldChange,
      )}
      {moneyField(
        "tax-freelance-input",
        t.tax.op.freelanceLabel,
        freelance,
        onFreelanceChange,
      )}
      <div className="field">
        {/* Task 10 carry — the badge used to sit inside the <label>,
            widening the label's click/read target with disclosure content;
            it now sits beside the label as its own element. */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="tax-nppn-input" className="label">
            {t.tax.op.nppnLabel}
          </label>
          <TaxRuleBadge rules={nppnRule} />
        </div>
        <input
          id="tax-nppn-input"
          type="text"
          inputMode="decimal"
          value={nppnPct}
          onChange={(e) =>
            onNppnPctChange(e.target.value.replace(/[^0-9,.]/g, ""))
          }
          className="input"
        />
        <div className="hint">{t.tax.op.nppnHint}</div>
      </div>
      {moneyField(
        "tax-other-net-input",
        t.tax.op.otherNetLabel,
        otherNet,
        onOtherNetChange,
        "field md:col-span-2",
      )}
    </div>
  );
}
