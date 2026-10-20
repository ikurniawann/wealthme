"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, Info, PencilLine, TriangleAlert } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { investmentWrite } from "./investment-api";
import { InvestmentConflict } from "./investment-conflict";
import { decimal } from "./decimal";
import { apiErrorMessage } from "@/lib/api-error";
import type { InvestmentTransactionDto } from "@wealthme/contracts";
import { Field, MoneyInput, amount, today } from "./investment-fields";
import { DialogSection, InvestDialogShell } from "./dialog-shell";
import { dialogCopy } from "./dialog-copy";
import { canonicalToTyping } from "@/components/money";

/** "Koreksi" / "Batalkan catatan" for one ledger entry (history + detail). */
export function LedgerCorrection({
  row,
  voiding,
  fg,
  token,
  onClose,
  onSaved,
  percentPrice = false,
  holdingCurrency,
}: {
  row: InvestmentTransactionDto;
  voiding: boolean;
  fg: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
  percentPrice?: boolean;
  holdingCurrency?: string;
}) {
  const { t, locale } = useLocale();
  const f = t.investasi.forms;
  const copy = dialogCopy(locale);
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
  const [confirmBasis, setConfirmBasis] = useState(false);
  const [fx, setFx] = useState(canonicalToTyping(row.fxRate ?? "", 6));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const kind = row.kind ?? row.type;
  const opening = row.costBasisKnown === false && kind === "opening";
  const currency = opening
    ? (holdingCurrency ?? row.currency ?? "IDR")
    : (row.currency ?? "IDR");
  const income = kind && ["dividend", "interest", "coupon"].includes(kind);
  const zone = row.timeZone ?? "Asia/Jakarta";
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!voiding && opening && !confirmBasis) {
      setError(t.investasi.detail.confirmBasis);
      return;
    }
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
                ...(opening
                  ? { completeCostBasis: true, pricePerUnit: amount(price) }
                  : {}),
                ...(currency !== "IDR"
                  ? { currency, fxRate: amount(fx), feeCurrency: currency }
                  : {}),
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
  const reasonField = (
    <DialogSection title={copy.why}>
      <div className="ivx-grid">
        <Field label={f.reason} required hint={copy.reasonHint} wide>
          {(id) => (
            <textarea
              id={id}
              className="textarea"
              required
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
      </div>
    </DialogSection>
  );
  return (
    <InvestDialogShell
      title={voiding ? f.voidAction : f.edit}
      subtitle={voiding ? copy.voidSub : copy.correctSub}
      icon={voiding ? <Ban /> : <PencilLine />}
      tone={voiding ? "danger" : undefined}
      size={voiding ? "sm" : undefined}
      destructive={voiding}
      busy={busy}
      submitLabel={voiding ? f.voidAction : copy.saveCorrection}
      onClose={onClose}
      onSubmit={save}
    >
      {voiding ? (
        <p className="ivx-strip" data-tone="warn" data-multi="">
          <TriangleAlert aria-hidden="true" />
          {f.confirmVoid}
        </p>
      ) : (
        <>
          <DialogSection title={copy.whenWhat}>
            <div className="ivx-grid">
              <Field label={f.date} required>
                {(id) => (
                  <input
                    id={id}
                    className="input"
                    type="date"
                    required
                    max={today()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                )}
              </Field>
              <Field label={f.time} hint={copy.zoneOf(zone)}>
                {(id) => (
                  <input
                    id={id}
                    className="input"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                )}
              </Field>
              {income ? (
                <Field label={f.transactionValue} wide>
                  {(id) => (
                    <MoneyInput
                      id={id}
                      currency={currency}
                      value={gross}
                      onChange={setGross}
                    />
                  )}
                </Field>
              ) : (
                <>
                  <Field label={f.quantity} required>
                    {(id) => (
                      <input
                        id={id}
                        className="input mono"
                        inputMode="decimal"
                        autoComplete="off"
                        enterKeyHint="next"
                        required
                        pattern="-?[0-9]+([.][0-9]{1,8})?"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label={f.executionPrice}>
                    {(id) => (
                      <MoneyInput
                        id={id}
                        currency={percentPrice ? "%" : currency}
                        value={price}
                        decimals={8}
                        onChange={setPrice}
                      />
                    )}
                  </Field>
                </>
              )}
              {currency !== "IDR" && (
                <Field label={f.actualRate} required wide>
                  {(id) => (
                    <MoneyInput
                      id={id}
                      currency="IDR"
                      value={fx}
                      decimals={6}
                      onChange={setFx}
                      required
                    />
                  )}
                </Field>
              )}
            </div>
            {opening && (
              <label className="ivx-check">
                <input
                  type="checkbox"
                  checked={confirmBasis}
                  required
                  onChange={(e) => setConfirmBasis(e.target.checked)}
                />
                {t.investasi.detail.confirmBasis}
              </label>
            )}
          </DialogSection>
          <DialogSection title={copy.costs}>
            <div className="ivx-grid">
              <Field label={f.fee}>
                {(id) => (
                  <MoneyInput
                    id={id}
                    currency={currency}
                    value={fee}
                    onChange={setFee}
                  />
                )}
              </Field>
              <Field label={f.tax}>
                {(id) => (
                  <MoneyInput
                    id={id}
                    currency={currency}
                    value={tax}
                    onChange={setTax}
                  />
                )}
              </Field>
            </div>
          </DialogSection>
          <p className="ivx-strip">
            <Info aria-hidden="true" />
            {f.dateOnly}
          </p>
        </>
      )}
      {reasonField}
      <InvestmentConflict error={failure} />
      {error && (
        <p className="error-text ivx-error" role="alert">
          {error}
        </p>
      )}
    </InvestDialogShell>
  );
}
