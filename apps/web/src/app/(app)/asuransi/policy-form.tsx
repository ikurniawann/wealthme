"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen, Users, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/wm";
import {
  anyMoneyPending,
  moneyDigits,
  useControlledMoneyField,
  withFxInputs,
} from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";

import "./asuransi-form.css";
import "./asuransi-form-ref.css";
import { AiReadButton, type AiApplyPayload } from "./ai-review";
import { applyAiToForm } from "./ai-apply";
import { jakartaToday, needsDueConfirmation } from "./asuransi-model";
import {
  BeneficiaryEditor,
  toBeneficiaryDtos,
  type BeneficiaryFormRow,
  type FamilyMember,
} from "./beneficiary-editor";
import { InfoSection } from "./form-section-info";
import { InvestmentSection } from "./form-section-investment";
import { PremiumSection } from "./form-section-premium";
import { PolicyDocuments } from "./policy-documents";
import {
  initialFormState,
  toBenefitDtos,
  toInsuredDtos,
  validateForm,
  type PolicyFormState,
} from "./policy-form-model";
import { usePolicySave, type PolicySaveDto } from "./use-policy-save";

import type {
  AccountDto,
  FxCurrencyCode,
  InsuranceDto,
  InsuranceValuationDto,
} from "@wealthme/contracts";

export type FormAnchor = "info" | "premium" | "invest";
const ANCHORS: FormAnchor[] = ["info", "premium", "invest"];
const SECTION_ID: Record<FormAnchor, string> = {
  info: "ins3f-info",
  premium: "ins3f-premium",
  invest: "ins3f-invest",
};

export interface InsuranceModalProps {
  familyGroupId: string;
  token: string | undefined;
  editing: InsuranceDto | null;
  familyMembers: FamilyMember[];
  membersUnavailable?: boolean;
  accounts: AccountDto[];
  /** Section to scroll to on open (detail "Perbarui nilai" → invest). */
  initialAnchor?: FormAnchor;
  /**
   * Open on the dates: the legacy due needs confirmation, so the user moves
   * it to coverage end and fills the real next premium due.
   */
  focusDates?: boolean;
  onClose: () => void;
  onSaved?: (policy: InsuranceDto) => void;
}

/**
 * Task 25 — the add/edit policy drawer per asuransi-form.png: wide side panel
 * on desktop, full-screen sheet on phones, one long form with section
 * anchors (Informasi polis / Premi & manfaat / Investasi — only the section in
 * view is highlighted; these are anchors, not tabs), collapsible
 * beneficiaries + documents and notes, sticky footer.
 */
export function InsuranceModal(props: InsuranceModalProps) {
  const { editing, familyGroupId, token } = props;
  const { t } = useLocale();
  const valuations = useQuery<InsuranceValuationDto[]>({
    queryKey: ["insurances", familyGroupId, "valuations", editing?.id ?? "new"],
    enabled: Boolean(editing && token),
    queryFn: () =>
      apiFetch<InsuranceValuationDto[]>(
        `/family-groups/${familyGroupId}/insurances/${editing!.id}/valuations`,
        { token },
      ),
  });
  const ready = !editing || valuations.isSuccess || valuations.isError;
  return (
    <Dialog open onOpenChange={(v) => !v && props.onClose()}>
      <PanelContent variant="side" className="ins3f-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {editing
                ? t.asuransi.v3.form.editTitle
                : t.asuransi.v3.form.addTitle}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {t.asuransi.v3.form.desc}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        {ready ? (
          <PolicyFormBody {...props} valuations={valuations.data ?? []} />
        ) : (
          <p className="ins3-state wm-panel-body" role="status">
            {t.asuransi.v3.loading}
          </p>
        )}
      </PanelContent>
    </Dialog>
  );
}

function PolicyFormBody({
  familyGroupId,
  token,
  editing,
  familyMembers,
  membersUnavailable,
  accounts,
  initialAnchor,
  focusDates,
  onClose,
  onSaved,
  valuations,
}: InsuranceModalProps & { valuations: InsuranceValuationDto[] }) {
  const { t } = useLocale();
  const c = t.asuransi.v3.form;
  const [state, setState] = useState<PolicyFormState>(() =>
    initialFormState(editing, valuations),
  );
  const [premium, setPremium] = useState<{
    raw: string;
    currency: FxCurrencyCode | null;
  }>(() => ({
    raw: editing ? BigInt(editing.premiumAmount).toLocaleString("id-ID") : "",
    currency: editing ? "IDR" : null,
  }));
  const premiumField = useControlledMoneyField({
    ...premium,
    onChange: setPremium,
  });
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryFormRow[]>(
    () =>
      editing?.beneficiaries.map((b) => ({
        id: b.id,
        name: b.name,
        relationship: b.relationship,
        sharePercent: b.sharePercent,
        memberUserId: b.memberUserId ?? "",
      })) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [seed, setSeed] = useState(0);
  const [active, setActive] = useState<FormAnchor>(initialAnchor ?? "info");
  const bodyRef = useRef<HTMLDivElement>(null);
  const { mutation, savedPolicyId } = usePolicySave(
    familyGroupId,
    token,
    editing,
  );

  const set = useCallback(
    (patch: Partial<PolicyFormState>) => setState((s) => ({ ...s, ...patch })),
    [],
  );

  // Highlight only the section in view (anchors, not tabs).
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const onScroll = () => {
      const top = root.getBoundingClientRect().top + 96;
      let current: FormAnchor = "info";
      for (const a of ANCHORS) {
        const el = document.getElementById(SECTION_ID[a]);
        if (el && el.getBoundingClientRect().top <= top) current = a;
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4)
        current = "invest";
      setActive(current);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  const jump = useCallback((a: FormAnchor) => {
    setActive(a);
    document
      .getElementById(SECTION_ID[a])
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (!focusDates) return;
    const id = window.setTimeout(() => {
      document
        .getElementById("ins3f-due-confirm")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("ins3f-next-due")?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(id);
  }, [focusDates]);

  useEffect(() => {
    if (initialAnchor && initialAnchor !== "info") {
      const id = window.setTimeout(() => jump(initialAnchor), 120);
      return () => window.clearTimeout(id);
    }
  }, [initialAnchor, jump]);

  function applyAi(payload: AiApplyPayload) {
    const { next, premium: p } = applyAiToForm(state, payload);
    setState(next);
    if (p) setPremium({ raw: p.raw, currency: p.currency as FxCurrencyCode });
    setAiFile(payload.file);
    setSeed((n) => n + 1);
    toast.success(c.aiApplied);
  }

  function handleSave() {
    setFormError(null);
    if (anyMoneyPending(premiumField))
      return setFormError(t.money.rateNotReady);
    const digits = moneyDigits(premiumField);
    const issues = validateForm(state, digits, jakartaToday(), c.issues);
    setErrors(Object.fromEntries(issues.map((i) => [i.field, i.message])));
    if (issues.length > 0) {
      setFormError(c.fixErrors);
      const first = issues[0].field;
      const anchor: FormAnchor =
        first.startsWith("fund") || first === "cash"
          ? "invest"
          : first === "name" || first.startsWith("coverage")
            ? "info"
            : "premium";
      jump(anchor);
      return;
    }
    const beneficiaryDtos = toBeneficiaryDtos(beneficiaries, t.asuransi);
    if (!beneficiaryDtos) return;
    const isEdit = Boolean(editing || savedPolicyId());
    const opt = (v: string) =>
      v.trim() ? v.trim() : isEdit ? null : undefined;
    const dto = {
      name: state.name.trim(),
      type: state.type,
      status: state.status,
      premiumAmount: digits,
      premiumPeriod: state.premiumPeriod,
      currency: state.currency,
      ...(state.provider.trim() || isEdit
        ? { provider: state.provider.trim() }
        : {}),
      ...(state.policyNumber.trim() || isEdit
        ? { policyNumber: state.policyNumber.trim() }
        : {}),
      ...(state.notes.trim() || isEdit ? { notes: state.notes.trim() } : {}),
      policyType: state.policyType || (isEdit ? null : undefined),
      nextPremiumDueDate: opt(state.nextPremiumDueDate),
      policyRenewalDate: opt(state.policyRenewalDate),
      premiumPaymentEndDate: opt(state.premiumPaymentEndDate),
      coverageStartDate: opt(state.coverageStartDate),
      coverageEndDate: opt(state.coverageEndDate),
      autoRenewDate: Boolean(state.nextPremiumDueDate) && state.autoRenewDate,
      holderUserId: opt(state.holderUserId),
      holderName: state.holderUserId
        ? isEdit
          ? null
          : undefined
        : opt(state.holderName),
      payerUserId: opt(state.payerUserId),
      payerName: state.payerUserId
        ? isEdit
          ? null
          : undefined
        : opt(state.payerName),
      paymentAccountId: opt(state.paymentAccountId),
      insured: toInsuredDtos(state.insured),
      benefits: toBenefitDtos(state.benefits),
      includeInNetWorth: state.includeInNetWorth,
      beneficiaries: beneficiaryDtos,
    } as PolicySaveDto;
    mutation.mutate(
      {
        dto: withFxInputs(dto, [["premiumAmount", premiumField]]),
        funds: state.policyType === "unit_link" ? state.funds : [],
        cash: state.policyType === "traditional" ? state.cash : null,
        documentFile: aiFile,
      },
      {
        onSuccess: (policy) => {
          toast.success(
            editing ? t.asuransi.toastUpdated : t.asuransi.toastAdded,
          );
          onSaved?.(policy);
          onClose();
        },
        onError: (err) => {
          const msg = apiErrorMessage(err, c.saveFailed);
          setFormError(
            savedPolicyId() && !editing ? `${c.savedPartially} ${msg}` : msg,
          );
          bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        },
      },
    );
  }

  return (
    <form
      noValidate
      className="ins3f-form"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <nav className="ins3f-anchors" aria-label={c.anchorsLabel}>
        {ANCHORS.map((a) => (
          <a
            key={a}
            href={`#${SECTION_ID[a]}`}
            aria-current={active === a ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault();
              jump(a);
            }}
          >
            {c.anchors[a]}
          </a>
        ))}
      </nav>
      <div className="wm-panel-body ins3f-body" ref={bodyRef}>
        {formError && (
          <p className="ins3f-form-error" role="alert">
            {formError}
          </p>
        )}
        {editing && needsDueConfirmation(editing) && (
          <div id="ins3f-due-confirm" className="ins3-callout" role="note">
            <p className="ins3-callout-title">{t.asuransi.v3.dueConfirm}</p>
            <p>{t.asuransi.v3.dueConfirmHelp}</p>
          </div>
        )}
        <div className="ins3f-cols">
          <InfoSection
            state={state}
            set={set}
            members={familyMembers}
            errors={errors}
            seed={seed}
          />
          <PremiumSection
            state={state}
            set={set}
            premiumField={premiumField}
            accounts={accounts}
            errors={errors}
          />
        </div>
        <InvestmentSection
          state={state}
          set={set}
          errors={errors}
          aiAction={
            <AiReadButton insuranceId={editing?.id ?? null} onApply={applyAi} />
          }
        />
        <details
          className="ins3f-more"
          open={beneficiaries.length > 0 || Boolean(aiFile)}
        >
          <summary>
            <Users aria-hidden="true" />
            <span>
              <strong>{c.moreTitle}</strong> <em>{c.optional}</em>
              <small>{c.moreSub}</small>
            </span>
          </summary>
          <div className="ins3f-more-body">
            <BeneficiaryEditor
              rows={beneficiaries}
              onChange={setBeneficiaries}
              familyMembers={familyMembers}
              membersUnavailable={membersUnavailable}
            />
            <p className="label mt-4">{c.docsTitle}</p>
            {aiFile && (
              <p className="hint">{`${c.docsPending} ${aiFile.name}`}</p>
            )}
            {editing ? (
              <PolicyDocuments insuranceId={editing.id} />
            ) : (
              <p className="hint">{c.docsAfterSave}</p>
            )}
          </div>
        </details>
        <details className="ins3f-more" open={Boolean(state.notes)}>
          <summary>
            <NotebookPen aria-hidden="true" />
            <span>
              <strong>{c.notesTitle}</strong> <em>{c.optional}</em>
              <small>{c.notesSub}</small>
            </span>
          </summary>
          <div className="ins3f-more-body">
            <label className="label" htmlFor="ins3f-notes">
              {t.asuransi.fieldNotesLabel}
            </label>
            <textarea
              id="ins3f-notes"
              className="textarea ins3f-input"
              rows={3}
              value={state.notes}
              placeholder={t.asuransi.fieldNotesPlaceholder}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        </details>
      </div>
      <div className="wm-panel-foot ins3f-foot">
        <PillButton type="button" onClick={onClose}>
          {t.common.cancel}
        </PillButton>
        <PillButton
          type="submit"
          variant="primary"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? t.asuransi.saving : c.save}
        </PillButton>
      </div>
    </form>
  );
}
