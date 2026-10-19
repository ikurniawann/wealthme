"use client";
import { useState } from "react";
import { toast } from "sonner";
import type {
  InvestmentDto,
  InvestmentTxKind,
  PlatformAccountDto,
} from "@wealthme/contracts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";
import { investmentWrite } from "../investment-api";
import { AmountInput, amount, today } from "../investment-fields";
import { InvestmentConflict } from "../investment-conflict";
export function DetailEventForm({
  holding: h,
  platforms,
  corporate,
  fg,
  token,
  onClose,
  onSaved,
}: {
  holding: InvestmentDto;
  platforms: PlatformAccountDto[];
  corporate: boolean;
  fg: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const f = t.investasi.forms;
  const d = t.investasi.detail;
  const c = t.investasi.v3;
  const [kind, setKind] = useState<InvestmentTxKind>(
    corporate
      ? "corporate_action"
      : h.type === "obligasi"
        ? "coupon"
        : h.type === "deposito"
          ? "interest"
          : "dividend",
  );
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [gross, setGross] = useState("");
  const [fee, setFee] = useState("");
  const [tax, setTax] = useState("");
  const [fx, setFx] = useState("");
  const [change, setChange] = useState("");
  const [note, setNote] = useState("");
  const [pocketId, setPocketId] = useState(h.cashAccountId ?? "");
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const pockets = platforms
    .filter((p) => !h.platformAccountId || p.id === h.platformAccountId)
    .flatMap((p) =>
      (p.pockets ?? []).filter(
        (p) =>
          p.currency === h.currency &&
          p.status !== "closed" &&
          !p.balancesHidden,
      ),
    );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFailure(null);
    try {
      await investmentWrite(`/family-groups/${fg}/investments/${h.id}/ledger`, {
        token,
        method: "POST",
        body: JSON.stringify({
          kind,
          idempotencyKey: key,
          effectiveDate: date,
          effectiveTime: time || null,
          timeZone: time ? "Asia/Jakarta" : null,
          note: note.trim() || null,
          ...(corporate
            ? { quantity: change, currency: "IDR", cashAccountId: null }
            : {
                currency: h.currency,
                grossAmount: amount(gross),
                fee: amount(fee),
                tax: amount(tax),
                cashAccountId: pocketId || null,
                ...(h.currency !== "IDR" ? { fxRate: amount(fx) } : {}),
              }),
        }),
      });
      toast.success(f.saved);
      onSaved();
      onClose();
    } catch (err) {
      setFailure(err);
      setError(apiErrorMessage(err, f.failed));
      setBusy(false);
    }
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
            <DialogTitle>{corporate ? d.corporate : d.addIncome}</DialogTitle>
            <DialogDescription>
              {corporate ? d.corporateNote : h.name}
            </DialogDescription>
          </header>
          <fieldset className="iv-form-body iv-event-fields" disabled={busy}>
            {corporate ? (
              <label className="field">
                <span className="label">{d.quantityChange} *</span>
                <input
                  className="input"
                  required
                  inputMode="decimal"
                  pattern="-?[0-9]+([.][0-9]{1,8})?"
                  value={change}
                  onChange={(e) => setChange(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="field">
                  <span className="label">{f.kind}</span>
                  <select
                    className="select"
                    value={kind}
                    onChange={(e) =>
                      setKind(e.target.value as InvestmentTxKind)
                    }
                  >
                    {(["dividend", "coupon", "interest"] as const).map((k) => (
                      <option key={k} value={k}>
                        {c[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">{f.pocket} *</span>
                  <select
                    className="select"
                    required
                    value={pocketId}
                    onChange={(e) => setPocketId(e.target.value)}
                  >
                    <option value="">{f.choose}</option>
                    {pockets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.currency}
                      </option>
                    ))}
                  </select>
                </label>
                <AmountInput
                  label={d.amount}
                  currency={h.currency}
                  value={gross}
                  onChange={setGross}
                  decimals={8}
                  required
                />
                <div className="iv-field-row">
                  <AmountInput
                    label={f.fee}
                    currency={h.currency}
                    value={fee}
                    onChange={setFee}
                  />
                  <AmountInput
                    label={f.tax}
                    currency={h.currency}
                    value={tax}
                    onChange={setTax}
                  />
                </div>
                {h.currency !== "IDR" && (
                  <AmountInput
                    label={f.actualRate}
                    currency="IDR"
                    value={fx}
                    onChange={setFx}
                    decimals={6}
                    required
                  />
                )}
              </>
            )}
            <div className="iv-field-row">
              <label className="field">
                <span className="label">{f.date} *</span>
                <input
                  className="input"
                  required
                  type="date"
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
                <small>Asia/Jakarta (WIB)</small>
              </label>
            </div>
            <label className="field">
              <span className="label">
                {d.note}
                {corporate ? " *" : ""}
              </span>
              <textarea
                className="textarea"
                required={corporate}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p className="iv-notice">{f.dateOnly}</p>
            <InvestmentConflict error={failure} />
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
          </fieldset>
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
              {busy ? f.saving : f.save}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
