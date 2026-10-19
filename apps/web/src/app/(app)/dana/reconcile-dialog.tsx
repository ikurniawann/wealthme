"use client";

import { useId, useState } from "react";
import { Scale, X } from "lucide-react";
import { toast } from "sonner";
import type { FxCurrencyCode } from "@wealthme/contracts";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MoneyInput,
  useControlledMoneyField,
  useFxSnapshot,
} from "@/components/money";
import { idrPreview, toCanonicalAmount } from "@/components/money/money-format";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { fill } from "@/i18n/rekening-v3";

import { formatNative, type KasRow } from "./kas-model";

interface ReconcileResult {
  adjustment: string;
  held: boolean;
}

interface ReconcileDialogProps {
  row: KasRow | null;
  onClose: () => void;
  onDone: () => Promise<void> | void;
  familyGroupId: string | undefined;
  token: string | undefined;
}

/** Kas & E-Wallet — "Cocokkan saldo": compare the recorded balance with reality. */
export function ReconcileDialog(props: ReconcileDialogProps) {
  if (!props.row) return null;
  return (
    <ReconcileBody key={props.row.account.id} {...props} row={props.row} />
  );
}

function ReconcileBody({
  row,
  onClose,
  onDone,
  familyGroupId,
  token,
}: ReconcileDialogProps & { row: KasRow }) {
  const { t, locale } = useLocale();
  const c = t.dana.v3.reconcile;
  const uid = useId();
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);

  const currency = row.currency;
  const foreign = currency !== "IDR";
  const isWallet = row.kind === "ewallet";
  const { data: rates } = useFxSnapshot(foreign);

  const canonical = raw.trim() === "" ? null : toCanonicalAmount(raw);
  let actualIdr: number | null = null;
  if (canonical !== null) {
    if (!foreign) actualIdr = Number(canonical);
    else {
      const preview = idrPreview(
        canonical,
        currency as FxCurrencyCode,
        rates,
        0,
      );
      actualIdr = preview === null ? null : Number(preview);
    }
  }
  const recordedIdr = row.idr;
  const diff =
    actualIdr !== null && recordedIdr !== null ? actualIdr - recordedIdr : null;
  const negativeWallet = isWallet && actualIdr !== null && actualIdr < 0;
  const rateMissing = canonical !== null && foreign && actualIdr === null;
  const canSubmit =
    !saving && diff !== null && !negativeWallet && !!familyGroupId && !!token;

  const field = useControlledMoneyField({
    raw,
    currency: currency as FxCurrencyCode,
    allowNegative: !isWallet,
    onChange: (next) => setRaw(next.raw),
  });

  async function handleConfirm() {
    if (!canSubmit || actualIdr === null || canonical === null) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { actualBalance: actualIdr };
      if (foreign) {
        body.fxInputs = [
          { field: "actualBalance", currency, amount: canonical },
        ];
      }
      const res = await apiFetch<ReconcileResult>(
        `/family-groups/${familyGroupId}/accounts/${row.account.id}/reconcile`,
        { token, method: "POST", body: JSON.stringify(body) },
      );
      if (res.held) toast.success(c.held);
      else toast.success(diff === 0 ? c.done : c.doneAdjusted);
      await onDone();
      onClose();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, c.failed));
    } finally {
      setSaving(false);
    }
  }

  const sign = diff === null || diff === 0 ? "" : diff > 0 ? "+" : "−";
  const diffText =
    diff === null
      ? "—"
      : diff === 0
        ? formatNative(0, "IDR", locale)
        : `${sign} ${formatNative(Math.abs(diff), "IDR", locale)}`;
  const explain =
    diff === null
      ? null
      : diff === 0
        ? c.match
        : diff > 0
          ? c.diffUp
          : c.diffDown;
  const state =
    diff === null ? "none" : diff === 0 ? "match" : diff > 0 ? "up" : "down";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="kwr">
        <header className="kwr-head">
          <span className="kwr-ic" aria-hidden="true">
            <Scale />
          </span>
          <div className="kwr-head-text">
            <DialogTitle className="kwr-title">{c.title}</DialogTitle>
            <DialogDescription className="kwr-sub">
              {fill(c.sub, { name: row.account.name })}
            </DialogDescription>
          </div>
          <DialogClose className="kwr-x" aria-label={c.cancel}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>

        <form
          className="kwr-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleConfirm();
          }}
        >
          <div className="kwr-body">
            <div className="kwr-recorded">
              <span className="kwr-k">{c.recorded}</span>
              <b className="kwr-v">
                {row.native === null
                  ? "—"
                  : formatNative(row.native, currency, locale)}
              </b>
              {foreign && (
                <span className="kwr-idr">
                  {recordedIdr === null
                    ? "—"
                    : `≈ ${formatNative(recordedIdr, "IDR", locale)}`}
                </span>
              )}
            </div>

            <div className="field kwr-field">
              <label className="label" htmlFor={`${uid}-actual`}>
                {c.counted}
              </label>
              <MoneyInput
                field={field}
                id={`${uid}-actual`}
                ariaLabel={c.counted}
              />
              <span className="hint block">
                {fill(c.countedHint, { cur: currency })}
              </span>
              {negativeWallet && (
                <span className="error-text block" role="alert">
                  {t.dana.v3.form.negativeWallet}
                </span>
              )}
              {rateMissing && (
                <span className="error-text block" role="alert">
                  {t.dana.v3.form.rateMissing}
                </span>
              )}
            </div>

            <div className="kwr-diff" data-state={state} aria-live="polite">
              <span className="kwr-k">{c.diff}</span>
              <b className="kwr-diff-v">{diffText}</b>
              {explain && <p className="kwr-explain">{explain}</p>}
            </div>
          </div>

          <footer className="kwr-foot">
            <button
              type="button"
              className="btn btn--outline kwr-cancel"
              onClick={onClose}
            >
              {c.cancel}
            </button>
            <button
              type="submit"
              className="btn btn--primary kwr-save"
              disabled={!canSubmit}
            >
              {diff === 0 ? c.confirmMatch : c.confirmAdjust}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
