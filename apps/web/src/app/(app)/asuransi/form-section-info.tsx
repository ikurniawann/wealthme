"use client";

import { FileText, Plus, X } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";

import { DateInput, Field, PersonPicker } from "./form-fields";
import {
  FORM_STATUSES,
  FORM_TYPES,
  POLICY_CURRENCIES,
  emptyPerson,
  type PersonRow,
  type PolicyFormState,
} from "./policy-form-model";

import type { FamilyMember } from "./beneficiary-editor";
import type {
  InsurancePolicyType,
  InsuranceStatus,
  InsuranceType,
} from "@wealthme/contracts";

type Props = {
  state: PolicyFormState;
  set: (patch: Partial<PolicyFormState>) => void;
  members: FamilyMember[];
  errors: Record<string, string>;
  /** Bumped when the AI review fills the form, to re-seed role pickers. */
  seed: number;
};

/** Informasi polis — identity, Jenis + Tipe side by side, roles, coverage dates. */
export function InfoSection({ state, set, members, errors, seed }: Props) {
  const { t } = useLocale();
  const c = t.asuransi.v3.form;
  const setInsured = (rows: PersonRow[]) => set({ insured: rows });
  const patchInsured = (rowId: string, patch: Partial<PersonRow>) =>
    setInsured(
      state.insured.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)),
    );

  return (
    <section
      id="ins3f-info"
      className="ins3f-section"
      aria-labelledby="ins3f-info-title"
    >
      <header className="ins3f-section-head">
        <span className="ins3f-section-icon" aria-hidden="true">
          <FileText />
        </span>
        <div>
          <h3 id="ins3f-info-title">{c.infoTitle}</h3>
          <p>{c.infoSub}</p>
        </div>
      </header>

      <Field id="ins3f-name" label={c.name} error={errors.name}>
        <input
          id="ins3f-name"
          className="input ins3f-input"
          value={state.name}
          placeholder={c.namePh}
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={Boolean(errors.name) || undefined}
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>
      <Field id="ins3f-provider" label={c.provider}>
        <input
          id="ins3f-provider"
          className="input ins3f-input"
          value={state.provider}
          placeholder={c.providerPh}
          autoComplete="organization"
          enterKeyHint="next"
          onChange={(e) => set({ provider: e.target.value })}
        />
      </Field>

      <div className="ins3f-pair ins3f-pair--keep">
        <Field id="ins3f-type" label={c.type}>
          <select
            id="ins3f-type"
            className="select ins3f-input"
            value={state.type}
            onChange={(e) => set({ type: e.target.value as InsuranceType })}
          >
            {FORM_TYPES.map((o) => (
              <option key={o} value={o}>
                {t.asuransi.typeLabels[o]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ins3f-ptype" label={c.policyType} hint={c.policyTypeHint}>
          <select
            id="ins3f-ptype"
            className="select ins3f-input"
            value={state.policyType}
            onChange={(e) =>
              set({ policyType: e.target.value as InsurancePolicyType | "" })
            }
          >
            <option value="">{c.policyTypeUnset}</option>
            <option value="traditional">
              {t.asuransi.v3.policyTypes.traditional}
            </option>
            <option value="unit_link">
              {t.asuransi.v3.policyTypes.unit_link}
            </option>
          </select>
        </Field>
      </div>

      <div className="ins3f-pair" key={`roles-${seed}`}>
        <PersonPicker
          id="ins3f-holder"
          label={c.holder}
          members={members}
          userId={state.holderUserId}
          name={state.holderName}
          otherLabel={c.personOther}
          nonePh={c.personNone}
          namePh={c.personNamePh}
          onChange={(v) => set({ holderUserId: v.userId, holderName: v.name })}
        />
        <PersonPicker
          id="ins3f-payer"
          label={c.payer}
          hint={c.payerHint}
          members={members}
          userId={state.payerUserId}
          name={state.payerName}
          otherLabel={c.personOther}
          nonePh={c.payerSame}
          namePh={c.personNamePh}
          onChange={(v) => set({ payerUserId: v.userId, payerName: v.name })}
        />
      </div>

      <fieldset className="ins3f-fieldset">
        <legend className="label">{c.insured}</legend>
        {state.insured.length === 0 && <p className="hint">{c.insuredEmpty}</p>}
        {state.insured.map((r, i) => (
          <div key={r.rowId} className="ins3f-insured-row">
            <select
              className="select ins3f-input"
              aria-label={`${c.insured} ${i + 1}`}
              value={r.memberUserId}
              onChange={(e) => {
                const m = members.find((x) => x.userId === e.target.value);
                patchInsured(r.rowId, {
                  memberUserId: e.target.value,
                  name: m ? m.name : "",
                  relationship: m?.relationship ?? r.relationship,
                });
              }}
            >
              <option value="">{c.personOther}</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
            {!r.memberUserId && (
              <input
                className="input ins3f-input"
                aria-label={`${c.insured} ${i + 1} — ${c.personNamePh}`}
                placeholder={c.personNamePh}
                value={r.name}
                autoComplete="off"
                onChange={(e) =>
                  patchInsured(r.rowId, { name: e.target.value })
                }
              />
            )}
            <input
              className="input ins3f-input"
              aria-label={`${c.insured} ${i + 1} — ${c.relationship}`}
              placeholder={c.relationship}
              value={r.relationship}
              autoComplete="off"
              onChange={(e) =>
                patchInsured(r.rowId, { relationship: e.target.value })
              }
            />
            <button
              type="button"
              className="ins3f-icon-btn"
              aria-label={`${c.remove} ${r.name || `${c.insured} ${i + 1}`}`}
              onClick={() =>
                setInsured(state.insured.filter((x) => x.rowId !== r.rowId))
              }
            >
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ins3-link"
          onClick={() => setInsured([...state.insured, emptyPerson()])}
        >
          <Plus aria-hidden="true" /> {c.addInsured}
        </button>
      </fieldset>

      <Field id="ins3f-number" label={c.policyNumber} hint={c.policyNumberHint}>
        <input
          id="ins3f-number"
          className="input ins3f-input mono"
          value={state.policyNumber}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          onChange={(e) => set({ policyNumber: e.target.value })}
        />
      </Field>

      <div className="ins3f-pair">
        <Field id="ins3f-status" label={c.status} hint={c.statusHint}>
          <select
            id="ins3f-status"
            className="select ins3f-input"
            value={state.status}
            onChange={(e) => set({ status: e.target.value as InsuranceStatus })}
          >
            {FORM_STATUSES.map((o) => (
              <option key={o} value={o}>
                {t.asuransi.statusLabels[o]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ins3f-currency" label={c.currency} hint={c.currencyHint}>
          <select
            id="ins3f-currency"
            className="select ins3f-input"
            value={state.currency}
            onChange={(e) => set({ currency: e.target.value })}
          >
            {POLICY_CURRENCIES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="ins3f-pair">
        <Field id="ins3f-cov-start" label={c.coverageStart}>
          <DateInput
            id="ins3f-cov-start"
            value={state.coverageStartDate}
            onChange={(v) => set({ coverageStartDate: v })}
          />
        </Field>
        <Field
          id="ins3f-cov-end"
          label={c.coverageEnd}
          hint={c.coverageEndHint}
          error={errors.coverageEndDate}
        >
          <DateInput
            id="ins3f-cov-end"
            value={state.coverageEndDate}
            invalid={Boolean(errors.coverageEndDate)}
            onChange={(v) => set({ coverageEndDate: v })}
          />
        </Field>
      </div>
      <Field
        id="ins3f-renewal"
        label={c.policyRenewal}
        hint={c.policyRenewalHint}
      >
        <DateInput
          id="ins3f-renewal"
          value={state.policyRenewalDate}
          onChange={(v) => set({ policyRenewalDate: v })}
        />
      </Field>
    </section>
  );
}
