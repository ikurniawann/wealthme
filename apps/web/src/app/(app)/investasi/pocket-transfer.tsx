"use client";
import { useState } from "react";
import { toast } from "sonner";
import type { AccountDto, PlatformAccountDto } from "@wealthme/contracts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useFxSnapshot } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { investmentWrite } from "./investment-api";
import { InvestmentConflict } from "./investment-conflict";
import { apiErrorMessage } from "@/lib/api-error";
import {
  AmountInput,
  amount,
  today,
  effectiveInstant,
} from "./investment-fields";
import {
  subtract,
  multiply,
  positive,
  decimal,
  add,
  roundWhole,
} from "./decimal";
import { money } from "./portfolio-model";

export function PocketTransfer({
  platforms,
  accounts,
  fg,
  token,
  initialPocketId,
  withdraw = false,
  onClose,
  onSaved,
}: {
  platforms: PlatformAccountDto[];
  accounts: AccountDto[];
  fg: string;
  token: string;
  initialPocketId?: string;
  withdraw?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useLocale();
  const f = t.investasi.forms;
  const { hideBalance } = useMoney();
  const pockets = platforms.flatMap((p) =>
    (p.pockets ?? [])
      .filter((p) => p.status !== "closed" && !p.balancesHidden)
      .map((pocket) => ({ platform: p, pocket })),
  );
  const banks = accounts.filter(
    (a) =>
      ["bank", "cash", "ewallet"].includes(a.type) &&
      a.status !== "closed" &&
      a.balance !== null,
  );
  const [pocketId, setPocketId] = useState(
    initialPocketId ?? pockets[0]?.pocket.id ?? "",
  );
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [raw, setRaw] = useState("");
  const [destRaw, setDestRaw] = useState("");
  const [feeRaw, setFeeRaw] = useState("0");
  const [rateRaw, setRateRaw] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const chosen = pockets.find((p) => p.pocket.id === pocketId);
  const bank = banks.find((a) => a.id === bankId);
  const pocket = chosen?.pocket;
  const sourceCur = (withdraw ? pocket?.currency : bank?.currency) ?? "IDR";
  const destCur = (withdraw ? bank?.currency : pocket?.currency) ?? "IDR";
  const cross = sourceCur !== destCur;
  const unsupported = cross && sourceCur !== "IDR" && destCur !== "IDR";
  const rates = useFxSnapshot(sourceCur !== "IDR" && !cross);
  const source = amount(raw),
    fee = amount(feeRaw),
    dest = cross ? amount(destRaw) : subtract(source, fee),
    rate = amount(rateRaw);
  const fx = cross
    ? rate
    : (rates.data?.idrPerUnit as Record<string, string> | undefined)?.[
        sourceCur
      ];
  const validFx = sourceCur === "IDR" || positive(fx ?? "0");
  // Match API's admin-fee posting: fee charged at destination, total source includes it.
  const feeIdr =
    sourceCur === "IDR" ? fee : roundWhole(multiply(fee, fx ?? "0"));
  const movedIdr =
    sourceCur === "IDR"
      ? source
      : cross
        ? add(dest, feeIdr)
        : roundWhole(multiply(source, fx ?? "0"));
  const sourceBefore = withdraw ? pocket?.availableBalance : bank?.balance;
  const destBefore = withdraw ? bank?.balance : pocket?.recordedBalance;
  const sourceAfter =
    sourceBefore == null ? null : subtract(sourceBefore, movedIdr);
  const destAfter =
    destBefore == null ? null : add(destBefore, subtract(movedIdr, feeIdr));
  const insufficient =
    date === today() &&
    sourceAfter !== null &&
    decimal(sourceAfter) < BigInt(0);
  const resetAmounts = () => {
    setRaw("");
    setDestRaw("");
    setFeeRaw("0");
    setRateRaw("");
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (
      !chosen ||
      !bank ||
      !positive(source) ||
      !positive(dest) ||
      unsupported ||
      (cross && !positive(rate)) ||
      !validFx ||
      insufficient
    ) {
      setError(
        insufficient
          ? f.insufficient
          : unsupported
            ? f.fxUnsupported
            : f.required,
      );
      return;
    }
    setBusy(true);
    setError("");
    setFailure(null);
    try {
      await investmentWrite(
        `${`/family-groups/${fg}/platform-accounts`}/${chosen.platform.id}/pockets/${pocketId}/${withdraw ? "withdraw" : "top-up"}`,
        {
          token,
          method: "POST",
          body: JSON.stringify({
            counterAccountId: bankId,
            sourceAmount: source,
            sourceCurrency: sourceCur,
            destAmount: dest,
            destCurrency: destCur,
            ...(cross ? { fxRate: rate } : {}),
            fee,
            feeCurrency: sourceCur,
            occurredAt: effectiveInstant(date, time),
            description: note.trim() || undefined,
            idempotencyKey,
          }),
        },
      );
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
  const fmt = (value: string | null | undefined) =>
    money(value, "IDR", locale, hideBalance);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="iv-dialog iv-transfer">
        <form onSubmit={save}>
          <header className="iv-dialog-head">
            <DialogTitle>{withdraw ? f.withdraw : f.transferTitle}</DialogTitle>
            <DialogDescription>{f.transferSub}</DialogDescription>
          </header>
          <div className="iv-form-body">
            <label className="field">
              <span className="label">
                {withdraw ? f.destination : f.source} *
              </span>
              <select
                className="select"
                required
                value={bankId}
                onChange={(e) => {
                  setBankId(e.target.value);
                  resetAmounts();
                }}
              >
                <option value="">{f.choose}</option>
                {banks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
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
                onChange={(e) => {
                  setPocketId(e.target.value);
                  resetAmounts();
                }}
              >
                <option value="">{f.choose}</option>
                {pockets.map(({ platform, pocket }) => (
                  <option key={pocket.id} value={pocket.id}>
                    {platform.label ?? platform.platformName} · {pocket.name} ·{" "}
                    {pocket.currency}
                  </option>
                ))}
              </select>
            </label>
            <AmountInput
              label={f.sourceAmount}
              currency={sourceCur}
              required
              value={raw}
              decimals={sourceCur === "IDR" ? 0 : 2}
              onChange={setRaw}
            />
            {cross && (
              <>
                <AmountInput
                  label={f.destAmount}
                  currency={destCur}
                  required
                  value={destRaw}
                  decimals={destCur === "IDR" ? 0 : 2}
                  onChange={setDestRaw}
                />
                <AmountInput
                  label={f.actualRate}
                  currency="IDR"
                  required
                  value={rateRaw}
                  decimals={6}
                  onChange={setRateRaw}
                />
              </>
            )}
            <AmountInput
              label={f.fee}
              currency={sourceCur}
              value={feeRaw}
              decimals={sourceCur === "IDR" ? 0 : 2}
              onChange={setFeeRaw}
            />
            <div className="iv-field-row">
              <label className="field">
                <span className="label">{f.date} *</span>
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
            </div>
            <small>
              {f.zone}: Asia/Jakarta · {f.dateOnly}
            </small>
            <label className="field">
              <span className="label">{f.note}</span>
              <input
                className="input"
                maxLength={255}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <section className="iv-transfer-preview">
              <h2>{f.summary} · IDR</h2>
              <p>
                {f.source}: {fmt(sourceBefore)} →{" "}
                {validFx ? fmt(sourceAfter) : "—"}
              </p>
              <p>
                {f.destination}: {fmt(destBefore)} →{" "}
                {validFx ? fmt(destAfter) : "—"}
              </p>
              <small>{f.currentBalance}</small>
            </section>
            <p className="iv-notice">{f.transferNote}</p>
            {unsupported && <p className="error-text">{f.fxUnsupported}</p>}
            {insufficient && <p className="error-text">{f.insufficient}</p>}
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
            <button
              className="btn btn--primary"
              disabled={busy || unsupported || insufficient}
            >
              {busy ? f.saving : f.save}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
