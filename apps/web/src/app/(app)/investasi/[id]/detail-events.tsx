"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, Info, Split } from "lucide-react";
import type {
  InvestmentDto,
  InvestmentTxKind,
  PlatformAccountDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";
import { investmentWrite } from "../investment-api";
import { Field, MoneyInput, amount, today } from "../investment-fields";
import { InvestmentConflict } from "../investment-conflict";
import { DialogSection, InvestDialogShell } from "../dialog-shell";
import { dialogCopy } from "../dialog-copy";
import { pocketLabel } from "../trade-pocket-field";

/** "Catat pendapatan" (dividend / coupon / interest) and "Catat aksi korporasi". */
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
  const { t, locale } = useLocale();
  const f = t.investasi.forms;
  const d = t.investasi.detail;
  const c = t.investasi.v3;
  const copy = dialogCopy(locale);
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
    .flatMap((platform) =>
      (platform.pockets ?? [])
        .filter(
          (p) =>
            p.currency === h.currency &&
            p.status !== "closed" &&
            !p.balancesHidden,
        )
        .map((pocket) => ({ platform, pocket })),
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
    <InvestDialogShell
      title={corporate ? d.corporate : d.addIncome}
      subtitle={corporate ? copy.corporateSub(h.name) : copy.incomeSub(h.name)}
      icon={corporate ? <Split /> : <Coins />}
      busy={busy}
      submitLabel={corporate ? copy.saveCorporate : copy.saveIncome}
      onClose={onClose}
      onSubmit={save}
    >
      {corporate ? (
        <DialogSection title={copy.changeSec}>
          <p className="ivx-strip" data-multi="">
            <Info aria-hidden="true" />
            {d.corporateNote}
          </p>
          <div className="ivx-grid">
            <Field label={d.quantityChange} required wide>
              {(id) => (
                <input
                  id={id}
                  className="input mono"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint="next"
                  pattern="-?[0-9]+([.][0-9]{1,8})?"
                  value={change}
                  onChange={(e) => setChange(e.target.value)}
                />
              )}
            </Field>
          </div>
        </DialogSection>
      ) : (
        <>
          <DialogSection title={copy.incomeSec}>
            <div className="ivx-grid">
              <Field label={f.kind}>
                {(id) => (
                  <select
                    id={id}
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
                )}
              </Field>
              <Field label={f.pocket} required hint={copy.pocketIncomeHint}>
                {(id) => (
                  <select
                    id={id}
                    className="select"
                    required
                    value={pocketId}
                    onChange={(e) => setPocketId(e.target.value)}
                  >
                    <option value="">{f.choose}</option>
                    {pockets.map(({ platform, pocket }) => (
                      <option key={pocket.id} value={pocket.id}>
                        {pocketLabel(platform, pocket, f)} · {pocket.currency}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </DialogSection>
          <DialogSection title={copy.amountsSec}>
            <div className="ivx-grid">
              <Field label={d.amount} required wide>
                {(id) => (
                  <MoneyInput
                    id={id}
                    currency={h.currency}
                    value={gross}
                    onChange={setGross}
                    decimals={8}
                    required
                  />
                )}
              </Field>
              <Field label={f.fee}>
                {(id) => (
                  <MoneyInput
                    id={id}
                    currency={h.currency}
                    value={fee}
                    onChange={setFee}
                  />
                )}
              </Field>
              <Field label={f.tax}>
                {(id) => (
                  <MoneyInput
                    id={id}
                    currency={h.currency}
                    value={tax}
                    onChange={setTax}
                  />
                )}
              </Field>
              {h.currency !== "IDR" && (
                <Field label={f.actualRate} required wide>
                  {(id) => (
                    <MoneyInput
                      id={id}
                      currency="IDR"
                      value={fx}
                      onChange={setFx}
                      decimals={6}
                      required
                    />
                  )}
                </Field>
              )}
            </div>
          </DialogSection>
        </>
      )}
      <DialogSection title={copy.whenSec}>
        <div className="ivx-grid">
          <Field label={f.date} required>
            {(id) => (
              <input
                id={id}
                className="input"
                required
                type="date"
                max={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            )}
          </Field>
          <Field label={f.time} hint={copy.timeHint}>
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
          <Field
            label={d.note}
            required={corporate}
            hint={corporate ? copy.noteHint : undefined}
            wide
          >
            {(id) => (
              <textarea
                id={id}
                className="textarea"
                required={corporate}
                maxLength={1000}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
        </div>
        <p className="ivx-strip">
          <Info aria-hidden="true" />
          {f.dateOnly}
        </p>
      </DialogSection>
      <InvestmentConflict error={failure} />
      {error && (
        <p role="alert" className="error-text ivx-error">
          {error}
        </p>
      )}
    </InvestDialogShell>
  );
}
