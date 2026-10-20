"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DateField, PillButton } from "@/components/wm";
import { AdvancedDisclosure } from "@/components/crud/advanced-disclosure";
import { useLocale } from "@/hooks/use-locale";
import {
  MoneyInput,
  anyMoneyPending,
  moneyDigits,
  useMoneyField,
  withFxInputs,
} from "@/components/money";

import { usePolicySave, type PolicySaveDto } from "./use-policy-save";
import {
  BeneficiaryEditor,
  toBeneficiaryDtos,
  type BeneficiaryFormRow,
  type FamilyMember,
} from "./beneficiary-editor";

import type {
  InsuranceDto,
  InsuranceStatus,
  InsuranceType,
  PremiumPeriod,
} from "@wealthme/contracts";

/**
 * The existing add/edit policy drawer, moved out of page.tsx unchanged in
 * behaviour (Task 24). Task 25 replaces it with the sectioned drawer.
 */

const TYPE_OPTIONS: InsuranceType[] = [
  "jiwa",
  "kesehatan",
  "kendaraan",
  "properti",
  "pendidikan",
  "lainnya",
];

const STATUS_OPTIONS: InsuranceStatus[] = [
  "aktif",
  "tidak_aktif",
  "kadaluarsa",
];

const PERIOD_OPTIONS: PremiumPeriod[] = ["monthly", "quarterly", "yearly"];

export interface InsuranceModalProps {
  familyGroupId: string;
  token: string | undefined;
  editing: InsuranceDto | null;
  familyMembers: FamilyMember[];
  membersUnavailable?: boolean;
  onClose: () => void;
}

/**
 * Add + edit policy modal (EPIC-021 Group D #14 unified the previously
 * separate generic edit-modal path into this richer form so beneficiaries —
 * and every other field — are editable in one place, "the policy modal").
 */
export function InsuranceModal({
  familyGroupId,
  token,
  editing,
  familyMembers,
  membersUnavailable,
  onClose,
}: InsuranceModalProps) {
  const { t, locale } = useLocale();

  const [name, setName] = useState(editing?.name ?? "");
  const [provider, setProvider] = useState(editing?.provider ?? "");
  const [type, setType] = useState<InsuranceType>(editing?.type ?? "jiwa");
  const [status, setStatus] = useState<InsuranceStatus>(
    editing?.status ?? "aktif",
  );
  const premiumField = useMoneyField({
    initialRaw: editing ? BigInt(editing.premiumAmount).toString() : "",
    isEdit: !!editing,
  });
  const [premiumPeriod, setPremiumPeriod] = useState<PremiumPeriod>(
    editing?.premiumPeriod ?? "monthly",
  );
  const coverageField = useMoneyField({
    initialRaw: editing?.coverageAmount
      ? BigInt(editing.coverageAmount).toString()
      : "",
    isEdit: !!editing,
  });
  const [renewalDate, setRenewalDate] = useState(
    editing?.nextPremiumDueDate ?? editing?.renewalDate?.slice(0, 10) ?? "",
  );
  const [autoRenewDate, setAutoRenewDate] = useState(
    editing?.autoRenewDate ?? false,
  );
  const [policyNumber, setPolicyNumber] = useState(editing?.policyNumber ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryFormRow[]>(
    editing?.beneficiaries.map((b) => ({
      id: b.id,
      name: b.name,
      relationship: b.relationship,
      sharePercent: b.sharePercent,
      memberUserId: b.memberUserId ?? "",
    })) ?? [],
  );

  const mutation = usePolicySave(familyGroupId, token, editing, onClose);

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.warning(t.asuransi.validationNameRequired);
      return;
    }
    if (anyMoneyPending(premiumField, coverageField)) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const parsedPremium = Number(moneyDigits(premiumField) || "0");
    if (parsedPremium <= 0) {
      toast.warning(t.asuransi.validationPremiumPositive);
      return;
    }

    const beneficiaryDtos = toBeneficiaryDtos(beneficiaries, t.asuransi);
    if (!beneficiaryDtos) return;

    const dto: PolicySaveDto = {
      name: trimmedName,
      type,
      status,
      premiumAmount: String(parsedPremium),
      premiumPeriod,
      ...(provider.trim() && { provider: provider.trim() }),
      ...(coverageField.raw && {
        coverageAmount: moneyDigits(coverageField),
      }),
      ...(renewalDate && { nextPremiumDueDate: renewalDate, autoRenewDate }),
      ...(policyNumber.trim() && { policyNumber: policyNumber.trim() }),
      ...(notes.trim() && { notes: notes.trim() }),
      beneficiaries: beneficiaryDtos,
    };

    mutation.mutate(
      withFxInputs(dto, [
        ["premiumAmount", premiumField],
        ["coverageAmount", coverageField.raw ? coverageField : null],
      ]),
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {editing ? t.asuransi.modalEditTitle : t.asuransi.modalTitle}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {t.asuransi.modalDesc}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="wm-panel-body wm-form">
            <div className="wm-form__grid">
              <div className="wm-form__grid">
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-name">
                    {t.asuransi.fieldNameLabel}
                  </label>
                  <input
                    id="ins-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.asuransi.fieldNamePlaceholder}
                    className="input"
                  />
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-provider">
                    {t.asuransi.fieldProviderLabel}
                  </label>
                  <input
                    id="ins-provider"
                    type="text"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder={t.asuransi.fieldProviderPlaceholder}
                    className="input"
                  />
                </div>
              </div>

              <div className="wm-form__grid">
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-type">
                    {t.asuransi.fieldTypeLabel}
                  </label>
                  <select
                    id="ins-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as InsuranceType)}
                    className="select"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {t.asuransi.typeLabels[opt]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-status">
                    {t.asuransi.fieldStatusLabel}
                  </label>
                  <select
                    id="ins-status"
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as InsuranceStatus)
                    }
                    className="select"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {t.asuransi.statusLabels[opt]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="wm-form__grid--two">
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-premium">
                    {t.asuransi.fieldPremiumLabel}
                  </label>
                  <MoneyInput
                    field={premiumField}
                    id="ins-premium"
                    placeholder="0"
                  />
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-period">
                    {t.asuransi.fieldPeriodLabel}
                  </label>
                  <select
                    id="ins-period"
                    value={premiumPeriod}
                    onChange={(e) =>
                      setPremiumPeriod(e.target.value as PremiumPeriod)
                    }
                    className="select"
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {t.asuransi.periodOptionLabels[opt]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="wm-form__grid--two">
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-coverage">
                    {t.asuransi.fieldCoverageLabel}
                  </label>
                  <MoneyInput
                    field={coverageField}
                    id="ins-coverage"
                    placeholder="0"
                  />
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-renewal">
                    {t.asuransi.fieldRenewalDateLabel}
                  </label>
                  <DateField
                    id="ins-renewal"
                    value={renewalDate}
                    locale={locale}
                    label={t.asuransi.fieldRenewalDateLabel}
                    onChange={setRenewalDate}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="ins-policy-number">
                  {t.asuransi.fieldPolicyNumberLabel}
                </label>
                <input
                  id="ins-policy-number"
                  type="text"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder={t.asuransi.fieldPolicyNumberPlaceholder}
                  className="input mono"
                />
              </div>

              {renewalDate && (
                <div className="row mt-3">
                  <Switch
                    checked={autoRenewDate}
                    onCheckedChange={setAutoRenewDate}
                    aria-labelledby="ins-auto-renew-label"
                  />
                  <span className="text-[13px]" id="ins-auto-renew-label">
                    {t.asuransi.autoRenewLabel}
                  </span>
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="ins-notes">
                  {t.asuransi.fieldNotesLabel}
                </label>
                <textarea
                  id="ins-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t.asuransi.fieldNotesPlaceholder}
                  className="textarea resize-none"
                />
              </div>

              <AdvancedDisclosure
                label={t.asuransi.beneficiariesOptionalLabel}
                defaultOpen={beneficiaries.length > 0}
              >
                <BeneficiaryEditor
                  rows={beneficiaries}
                  onChange={setBeneficiaries}
                  familyMembers={familyMembers}
                  membersUnavailable={membersUnavailable}
                  showSectionTitle={false}
                />
              </AdvancedDisclosure>
            </div>
          </div>
          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onClose}>
              {t.common.cancel}
            </PillButton>
            <PillButton
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? t.asuransi.saving : t.asuransi.saveButton}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}
