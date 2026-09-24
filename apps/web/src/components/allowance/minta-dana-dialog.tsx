"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatAmountInput, parseRupiah } from "@/lib/format";
import type { AccountDto } from "@wealthme/contracts";

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
      <DialogContent className="dialog--sm">
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
      </DialogContent>
    </Dialog>
  );
}

function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
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
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const hasTarget = targets.length > 0;

  async function handleSend() {
    if (!familyGroupId || !token || !targetAccountId) return;
    const parsed = parseRupiah(amount);
    if (parsed <= 0) {
      toast.error(t.rekening.mintaDanaAmountInvalidToast);
      return;
    }
    setIsSaving(true);
    try {
      await apiFetch(`/family-groups/${familyGroupId}/allowance-requests`, {
        token,
        method: "POST",
        body: JSON.stringify({
          targetAccountId,
          fromAccountId: source.id,
          amount: parsed,
          note: note || undefined,
        }),
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
      <DialogHeader>
        <DialogTitle>
          {t.rekening.mintaDanaDialogTitle}: {source.name}
        </DialogTitle>
        <DialogDescription>{t.rekening.mintaDanaDialogDesc}</DialogDescription>
      </DialogHeader>
      <DialogBody>
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
          <input
            id={`${fieldId}-amount`}
            inputMode="numeric"
            className="input mono"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
          />
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
      </DialogBody>
      <DialogFooter>
        <button type="button" className="btn btn--outline" onClick={onClose}>
          {t.common.cancel}
        </button>
        <button
          type="button"
          className="btn btn--primary disabled:opacity-60"
          onClick={handleSend}
          disabled={isSaving || !hasTarget}
        >
          {isSaving
            ? t.rekening.mintaDanaSubmitting
            : t.rekening.mintaDanaSubmitButton}
        </button>
      </DialogFooter>
    </>
  );
}
