"use client";

import { useLocale } from "@/hooks/use-locale";
import { Segmented } from "@/components/wm";
import { formatNumber, formatRupiah, parseRupiah } from "@/lib/format";

import { MAX_TAX_INPUT } from "./digits";

import type { PphOpResultDto, TaxMaritalStatus } from "@wealthme/contracts";

const DEPENDENTS_OPTIONS = [0, 1, 2, 3];
const MARITAL_OPTIONS: TaxMaritalStatus[] = ["TK", "K", "KI"];

// Shared money-input shape used by PphOpFields and PphOpFreelanceFields so
// both match the "affix"-style field proto renders (tax.html .field/.affix).
export function taxMoneyField(
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

// Task 9 (sub-plan L) — the detailed PPh OP calculator's marital
// status + dependents inputs (server derives PTKP from these, never a
// client-side lookup). Proto (tax.html .seg.full) renders this as its own
// two-col row inside the calculator's "s8" card.
export function PphOpFields({
  maritalStatus,
  onMaritalStatusChange,
  dependents,
  onDependentsChange,
  ptkp,
}: {
  maritalStatus: TaxMaritalStatus;
  onMaritalStatusChange: (v: TaxMaritalStatus) => void;
  dependents: number;
  onDependentsChange: (v: number) => void;
  ptkp: PphOpResultDto["ptkp"] | undefined;
}) {
  const { t } = useLocale();

  return (
    <div className="tax-calculator-grid grid grid-cols-1 gap-3.5 md:grid-cols-2">
      <div className="field">
        <span id="tax-marital-seg-label" className="label">
          {t.tax.op.statusLabel}
        </span>
        <Segmented
          label={t.tax.op.statusLabel}
          value={maritalStatus}
          onChange={(v) => onMaritalStatusChange(v)}
          className="wm-seg--full"
          options={MARITAL_OPTIONS.map((m) => ({
            value: m,
            label: t.tax.op.maritalLabels[m],
          }))}
        />
      </div>
      <div className="field">
        <span id="tax-dependents-seg-label" className="label">
          {t.tax.op.dependentsLabel}
        </span>
        <Segmented
          label={t.tax.op.dependentsLabel}
          value={String(dependents)}
          onChange={(v) => onDependentsChange(Number(v))}
          className="wm-seg--full"
          options={DEPENDENTS_OPTIONS.map((d) => ({
            value: String(d),
            label: String(d),
          }))}
        />
        {ptkp !== undefined && (
          <div className="hint">
            {t.tax.op.ptkpDerivedPrefix}
            <span className="mono">{formatRupiah(Number(ptkp))}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Proto (tax.html <details class="more-opts">) tucks the freelance/NPPN
// inputs (and, since proto has no slot for it, the withheld-PPh-21 field)
// behind a collapsed disclosure — they're optional, not first-class, inputs
// in the main 2-col grid.
export function PphOpFreelanceFields({
  withheld,
  onWithheldChange,
  freelance,
  onFreelanceChange,
  nppnPct,
  onNppnPctChange,
}: {
  withheld: string;
  onWithheldChange: (v: string) => void;
  freelance: string;
  onFreelanceChange: (v: string) => void;
  nppnPct: string;
  onNppnPctChange: (v: string) => void;
}) {
  const { t, locale } = useLocale();

  return (
    <details className="more-opts mt-1.5">
      <summary className="cursor-pointer text-[12.5px] font-medium text-muted-foreground">
        {locale === "en"
          ? "Freelance / independent income (optional)"
          : "Penghasilan freelance / bebas (opsional)"}
      </summary>
      <div className="mt-2.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {taxMoneyField(
          "tax-freelance-input",
          t.tax.op.freelanceLabel,
          freelance,
          onFreelanceChange,
        )}
        <div className="field">
          <label htmlFor="tax-nppn-input" className="label">
            {t.tax.op.nppnLabel}
          </label>
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
        {taxMoneyField(
          "tax-withheld-input",
          t.tax.op.withheldLabel,
          withheld,
          onWithheldChange,
          "field md:col-span-2",
        )}
      </div>
    </details>
  );
}
