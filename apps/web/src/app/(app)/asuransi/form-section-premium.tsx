"use client";

import { Plus, ShieldCheck, X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import {
  MoneyInput,
  useControlledMoneyField,
  type MoneyField,
} from "@/components/money";
import { useLocale } from "@/hooks/use-locale";

import { DateInput, Field } from "./form-fields";
import {
  FORM_PERIODS,
  emptyBenefit,
  type BenefitRow,
  type PolicyFormState,
} from "./policy-form-model";

import type {
  AccountDto,
  FxCurrencyCode,
  InsuranceBenefitKind,
  InsuranceBenefitPeriod,
  PremiumPeriod,
} from "@wealthme/contracts";

const KINDS: InsuranceBenefitKind[] = [
  "life_sum_assured",
  "health_annual_limit",
  "per_event",
  "daily",
  "critical_illness",
  "accident",
  "other",
];
const PERIODS: InsuranceBenefitPeriod[] = [
  "per_year",
  "per_event",
  "per_day",
  "per_policy_term",
  "lifetime",
];

type Props = {
  state: PolicyFormState;
  set: (patch: Partial<PolicyFormState>) => void;
  premiumField: MoneyField;
  accounts: AccountDto[];
  errors: Record<string, string>;
};

/** Premi & manfaat — premium + schedule dates, payment account, benefits by kind. */
export function PremiumSection({
  state,
  set,
  premiumField,
  accounts,
  errors,
}: Props) {
  const { t } = useLocale();
  const c = t.asuransi.v3.form;
  const setBenefits = (rows: BenefitRow[]) => set({ benefits: rows });
  const usable = accounts.filter((a) => a.status !== "closed");

  return (
    <section
      id="ins3f-premium"
      className="ins3f-section"
      aria-labelledby="ins3f-premium-title"
    >
      <header className="ins3f-section-head">
        <span className="ins3f-section-icon" aria-hidden="true">
          <ShieldCheck />
        </span>
        <div>
          <h3 id="ins3f-premium-title">{c.premiumTitle}</h3>
          <p>{c.premiumSub}</p>
        </div>
      </header>

      <div className="ins3f-money-row">
        <Field
          id="ins3f-premium-amt"
          label={c.premium}
          error={errors.premium}
          className="ins3f-grow"
        >
          <MoneyInput
            field={premiumField}
            id="ins3f-premium-amt"
            placeholder="0"
            inputClassName="ins3f-money"
          />
        </Field>
        <Field id="ins3f-period" label={c.period}>
          <select
            id="ins3f-period"
            className="select ins3f-input"
            value={state.premiumPeriod}
            onChange={(e) =>
              set({ premiumPeriod: e.target.value as PremiumPeriod })
            }
          >
            {FORM_PERIODS.map((o) => (
              <option key={o} value={o}>
                {t.asuransi.periodOptionLabels[o]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{c.premiumHint}</p>

      <div className="ins3f-pair">
        <Field id="ins3f-next-due" label={c.nextDue} hint={c.nextDueHint}>
          <DateInput
            id="ins3f-next-due"
            value={state.nextPremiumDueDate}
            onChange={(v) => set({ nextPremiumDueDate: v })}
          />
        </Field>
        <Field
          id="ins3f-pay-end"
          label={c.premiumEnd}
          error={errors.premiumPaymentEndDate}
        >
          <DateInput
            id="ins3f-pay-end"
            value={state.premiumPaymentEndDate}
            invalid={Boolean(errors.premiumPaymentEndDate)}
            onChange={(v) => set({ premiumPaymentEndDate: v })}
          />
        </Field>
      </div>
      {state.nextPremiumDueDate && (
        <label className="ins3f-switch-row">
          <Switch
            checked={state.autoRenewDate}
            onCheckedChange={(v) => set({ autoRenewDate: v })}
          />
          <span>{t.asuransi.autoRenewLabel}</span>
        </label>
      )}
      <Field id="ins3f-account" label={c.payAccount} hint={c.payAccountHint}>
        <select
          id="ins3f-account"
          className="select ins3f-input"
          value={state.paymentAccountId}
          onChange={(e) => set({ paymentAccountId: e.target.value })}
        >
          <option value="">{c.payAccountNone}</option>
          {usable.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.institution ? ` · ${a.institution}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="ins3f-fieldset">
        <legend className="label">{c.benefits}</legend>
        <p className="hint">{c.benefitsHint}</p>
        {state.benefits.map((b, i) => (
          <BenefitEditor
            key={b.rowId}
            row={b}
            index={i}
            error={errors[`benefit-${b.rowId}`]}
            onChange={(patch) =>
              setBenefits(
                state.benefits.map((x) =>
                  x.rowId === b.rowId ? { ...x, ...patch } : x,
                ),
              )
            }
            onRemove={() =>
              setBenefits(state.benefits.filter((x) => x.rowId !== b.rowId))
            }
          />
        ))}
        <button
          type="button"
          className="ins3-link"
          onClick={() =>
            setBenefits([
              ...state.benefits,
              emptyBenefit("other", state.currency),
            ])
          }
        >
          <Plus aria-hidden="true" /> {c.addBenefit}
        </button>
      </fieldset>
      <div className="ins3-callout" role="note">
        <div>
          <p className="ins3-callout-title">{c.sumAssuredNoteTitle}</p>
          <p>{c.sumAssuredNoteBody}</p>
        </div>
      </div>
    </section>
  );
}

function BenefitEditor({
  row,
  index,
  error,
  onChange,
  onRemove,
}: {
  row: BenefitRow;
  index: number;
  error?: string;
  onChange: (patch: Partial<BenefitRow>) => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3.form;
  const field = useControlledMoneyField({
    raw: row.raw,
    currency: row.currency as FxCurrencyCode,
    idrScale: 0,
    onChange: (next) => onChange({ raw: next.raw, currency: next.currency }),
  });
  const id = `ins3f-benefit-${row.rowId}`;
  return (
    <div className="ins3f-benefit">
      <div className="ins3f-benefit-top">
        <select
          className="select ins3f-input"
          aria-label={`${c.benefitKind} ${index + 1}`}
          value={row.kind}
          onChange={(e) =>
            onChange({ kind: e.target.value as InsuranceBenefitKind })
          }
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t.asuransi.v3.benefitKinds[k]}
            </option>
          ))}
        </select>
        <select
          className="select ins3f-input"
          aria-label={`${c.benefitPeriod} ${index + 1}`}
          value={row.period}
          onChange={(e) =>
            onChange({ period: e.target.value as InsuranceBenefitPeriod | "" })
          }
        >
          <option value="">{c.benefitPeriodNone}</option>
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {c.benefitPeriods[p]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ins3f-icon-btn"
          aria-label={`${c.remove} ${t.asuransi.v3.benefitKinds[row.kind]}`}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <Field
        id={id}
        label={index === 0 ? c.sumAssured : c.benefitAmount}
        error={error}
      >
        <MoneyInput
          field={field}
          id={id}
          placeholder="0"
          inputClassName="ins3f-money"
        />
      </Field>
      <input
        className="input ins3f-input"
        aria-label={`${c.benefitNote} ${index + 1}`}
        placeholder={c.benefitNotePh}
        value={row.note}
        onChange={(e) => onChange({ note: e.target.value })}
      />
    </div>
  );
}
