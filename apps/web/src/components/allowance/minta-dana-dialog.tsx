"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { PillButton } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { parseRupiah } from "@/lib/format";
import {
  MoneyInput,
  useMoneyField,
  moneyIdr,
  withFxInputs,
} from "@/components/money";
import type { AccountDto } from "@wealthme/contracts";
import { apiErrorMessage as extractApiErrorMessage } from "@/lib/api-error";

/**
 * EPIC-033 R5 — "Minta Dana": a member asks for money FROM a family-shared
 * account (`source`, the card they pressed) INTO one of their own accounts
 * (`targets`). The Master approves on /persetujuan and the transfer runs
 * there. Shared by the rekening and dana pages.
 */
export function MintaDanaDialog({
  source,
  targets,
  familyGroupId,
  token,
  onClose,
}: {
  source: AccountDto | null;
  targets: AccountDto[];
  familyGroupId: string | null;
  token: string | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!source} onOpenChange={(open) => !open && onClose()}>
      <PanelContent variant="side" className="wm-form-panel">
        {/* Keyed by source id so amount/note reset per card. */}
        {source && (
          <MintaDanaForm
            key={source.id}
            source={source}
            targets={targets}
            familyGroupId={familyGroupId}
            token={token}
            onClose={onClose}
          />
        )}
      </PanelContent>
    </Dialog>
  );
}

function MintaDanaForm({
  source,
  targets,
  familyGroupId,
  token,
  onClose,
}: {
  source: AccountDto;
  targets: AccountDto[];
  familyGroupId: string | null;
  token: string | undefined;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const fieldId = useId();
  const [targetAccountId, setTargetAccountId] = useState(targets[0]?.id ?? "");
  const amountField = useMoneyField();
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const hasTarget = targets.length > 0;

  async function handleSend() {
    if (!familyGroupId || !token || !targetAccountId) return;
    const parsed = moneyIdr(amountField, parseRupiah);
    if (parsed <= 0) {
      toast.error(t.rekening.mintaDanaAmountInvalidToast);
      return;
    }
    setIsSaving(true);
    try {
      await apiFetch(`/family-groups/${familyGroupId}/allowance-requests`, {
        token,
        method: "POST",
        body: JSON.stringify(
          withFxInputs(
            {
              targetAccountId,
              fromAccountId: source.id,
              amount: parsed,
              note: note || undefined,
            },
            [["amount", amountField]],
          ),
        ),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.allowanceRequests.all(familyGroupId),
      });
      toast.success(t.rekening.mintaDanaSuccessToast);
      onClose();
    } catch (err: unknown) {
      toast.error(extractApiErrorMessage(err, t.rekening.mintaDanaFailToast));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <header className="wm-panel-head">
        <div className="min-w-0">
          <DialogTitle className="wm-panel-title">
            {t.rekening.mintaDanaDialogTitle}: {source.name}
          </DialogTitle>
          <DialogDescription className="wm-panel-desc">
            {t.rekening.mintaDanaDialogDesc}
          </DialogDescription>
        </div>
        <DialogClose className="wm-panel-x" aria-label={t.common.close}>
          <X aria-hidden="true" />
        </DialogClose>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="wm-panel-body wm-form">
          <div className="wm-form__grid">
            <div className="field">
              <label className="label" htmlFor={`${fieldId}-target`}>
                {t.rekening.mintaDanaTargetLabel}
              </label>
              <select
                id={`${fieldId}-target`}
                className="select"
                value={targetAccountId}
                disabled={!hasTarget}
                onChange={(e) => setTargetAccountId(e.target.value)}
              >
                {!hasTarget && <option value="">-</option>}
                {targets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {!hasTarget && (
                <p className="hint">{t.rekening.mintaDanaNoOwnAccountHint}</p>
              )}
            </div>
            <div className="field">
              <label className="label" htmlFor={`${fieldId}-amount`}>
                {t.rekening.mintaDanaAmountLabel}
              </label>
              <MoneyInput field={amountField} id={`${fieldId}-amount`} />
            </div>
            <div className="field">
              <label className="label" htmlFor={`${fieldId}-note`}>
                {t.rekening.mintaDanaNoteLabel}
              </label>
              <input
                id={`${fieldId}-note`}
                type="text"
                className="input"
                placeholder={t.rekening.mintaDanaNotePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="wm-panel-foot">
          <PillButton type="button" onClick={onClose}>
            {t.common.cancel}
          </PillButton>
          <PillButton
            type="button"
            variant="primary"
            onClick={handleSend}
            disabled={isSaving || !hasTarget || amountField.resolved.isPending}
          >
            {isSaving
              ? t.rekening.mintaDanaSubmitting
              : t.rekening.mintaDanaSubmitButton}
          </PillButton>
        </div>
      </div>
    </>
  );
}
