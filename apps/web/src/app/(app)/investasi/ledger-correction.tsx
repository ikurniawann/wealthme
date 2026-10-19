"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { investmentWrite } from "./investment-api";
import { InvestmentConflict } from "./investment-conflict";
import { decimal } from "./decimal";
import { apiErrorMessage } from "@/lib/api-error";
import type { InvestmentTransactionDto } from "@wealthme/contracts";
import { AmountInput, amount, today } from "./investment-fields";
import { canonicalToTyping } from "@/components/money";

export function LedgerCorrection({
  row,
  voiding,
  fg,
  token,
  onClose,
  onSaved,
}: {
  row: InvestmentTransactionDto;
  voiding: boolean;
  fg: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const f = t.investasi.forms;
  const [date, setDate] = useState(
    row.effectiveDate ?? row.occurredAt.slice(0, 10),
  );
  const [time, setTime] = useState(row.effectiveTime ?? "");
  const [quantity, setQuantity] = useState(row.quantity);
  const [price, setPrice] = useState(canonicalToTyping(row.pricePerUnit, 8));
  const [gross, setGross] = useState(
    canonicalToTyping(row.grossAmount ?? "0", 2),
  );
  const [fee, setFee] = useState(canonicalToTyping(row.fee ?? "0", 2));
  const [tax, setTax] = useState(canonicalToTyping(row.tax ?? "0", 2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const kind = row.kind ?? row.type;
  const income = kind && ["dividend", "interest", "coupon"].includes(kind);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFailure(null);
    const endpoint = `/family-groups/${fg}/investments/${row.investmentId}/ledger/${row.id}${voiding ? "/void" : ""}`;
    try {
      await investmentWrite(endpoint, {
        token,
        method: voiding ? "POST" : "PATCH",
        body: JSON.stringify(
          voiding
            ? { reason }
            : {
                reason,
                effectiveDate: date,
                effectiveTime: time || null,
                timeZone: time ? (row.timeZone ?? "Asia/Jakarta") : null,
                ...(income
                  ? { grossAmount: amount(gross) }
                  : decimal(quantity) === decimal(row.quantity) &&
                      decimal(amount(price)) === decimal(row.pricePerUnit)
                    ? {}
                    : { quantity, pricePerUnit: amount(price) }),
                fee: amount(fee),
                tax: amount(tax),
              },
        ),
      });
    } catch (err) {
      setFailure(err);
      setError(apiErrorMessage(err, f.failed));
      setBusy(false);
      return;
    }
    toast.success(f.saved);
    onSaved();
    onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="iv-dialog">
        <form onSubmit={save}>
          <header className="iv-dialog-head">
            <DialogTitle>{voiding ? f.voidAction : f.edit}</DialogTitle>
          </header>
          <div className="iv-form-body">
            <small>
              {f.zone}: {row.timeZone ?? "Asia/Jakarta"}
            </small>
            {voiding ? (
              <p>{f.confirmVoid}</p>
            ) : (
              <>
                <label className="field">
                  <span className="label">{f.date}</span>
                  <input
                    className="input"
                    type="date"
                    required
                    max={today()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">{f.time}</span>
                  <input
                    className="input"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </label>
                {income ? (
                  <AmountInput
                    label={f.transactionValue}
                    currency={row.currency ?? "IDR"}
                    value={gross}
                    onChange={setGross}
                  />
                ) : (
                  <>
                    <label className="field">
                      <span className="label">{f.quantity}</span>
                      <input
                        className="input"
                        inputMode="decimal"
                        required
                        pattern="-?[0-9]+([.][0-9]{1,8})?"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </label>
                    <AmountInput
                      label={f.executionPrice}
                      currency={row.currency ?? "IDR"}
                      value={price}
                      decimals={8}
                      onChange={setPrice}
                    />
                  </>
                )}
                <AmountInput
                  label={f.fee}
                  currency={row.currency ?? "IDR"}
                  value={fee}
                  onChange={setFee}
                />
                <AmountInput
                  label={f.tax}
                  currency={row.currency ?? "IDR"}
                  value={tax}
                  onChange={setTax}
                />
              </>
            )}
            <label className="field">
              <span className="label">{f.reason} *</span>
              <textarea
                className="textarea"
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <InvestmentConflict error={failure} />
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="iv-form-footer">
            <button
              type="button"
              className="btn btn--outline"
              disabled={busy}
              onClick={onClose}
            >
              {f.cancel}
            </button>
            <button className="btn btn--primary" disabled={busy}>
              {busy ? f.saving : voiding ? f.voidAction : f.save}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
