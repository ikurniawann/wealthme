"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Info, ShoppingCart, Tag, X } from "lucide-react";
import { MARKETS } from "@wealthme/contracts";
import type { InvestmentDto, PlatformAccountDto } from "@wealthme/contracts";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMoney } from "@/hooks/use-money";
import { money, quantity } from "./portfolio-model";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";
import { investmentWrite } from "./investment-api";
import { InvestmentConflict } from "./investment-conflict";
import { tradeState, settlementDate, conflictMessage } from "./trade-state";
import { positionNumbers, positionBody } from "./position-state";
import type { PositionState } from "./position-state";
import { PositionExecutionFields } from "./position-execution-fields";
import { TradePreview } from "./trade-preview";
import { positive, decimal } from "./decimal";
import { Field, today } from "./investment-fields";
import { TradePocketField, pocketChoices } from "./trade-pocket-field";
import { tradeCopy } from "./trade-copy";
import "./trade-position.css";

export function TradeForm({
  initialId,
  kind,
  holdings,
  platforms,
  fg,
  token,
  onClose,
  onSaved,
}: {
  initialId: string;
  kind: "buy" | "sell";
  holdings: InvestmentDto[];
  platforms: PlatformAccountDto[];
  fg: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useLocale();
  const { hideBalance } = useMoney();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const copy = tradeCopy(locale);
  const [id, setId] = useState(initialId);
  const [fallbackHolding] = useState(
    () => holdings.find((h) => h.id === initialId) ?? holdings[0]!,
  );
  const holding = holdings.find((h) => h.id === id) ?? fallbackHolding;
  const [value, setValue] = useState(() => tradeState(holding, kind));
  const [key] = useState(() => crypto.randomUUID());
  const [settlement, setSettlement] = useState(() =>
    settlementDate(today(), value.market),
  );
  const [customSettlement, setCustomSettlement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pocketError, setPocketError] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const restrictTo = holding.platformAccountId ?? "";
  const pocket = pocketChoices(platforms, holding.currency, restrictTo).find(
    (p) => p.pocket.id === value.pocketId,
  )?.pocket;
  const sell = value.mode === "sell";
  const pick = (pocketId: string) => {
    setPocketError("");
    setValue((s) => ({ ...s, pocketId }));
  };
  function update(next: PositionState) {
    if (next.date !== value.date && !customSettlement)
      setSettlement(settlementDate(next.date, next.market));
    setPocketError("");
    setValue(next);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setPocketError("");
    setFailure(null);
    try {
      if (!holdings.some((h) => h.id === id)) {
        setError(c.error);
        return;
      }
      if (!holding.market) {
        setError(c.completeMarket);
        return;
      }
      const n = positionNumbers(value);
      const q = decimal(n.quantity);
      if (
        !positive(n.quantity) ||
        (!(
          holding.allowFraction ?? MARKETS[value.market].allowFractionDefault
        ) &&
          q % decimal("1") !== BigInt(0)) ||
        (value.market === "IDX" && q % decimal("100") !== BigInt(0))
      ) {
        setError(f.invalidQuantity);
        return;
      }
      if (!pocket) {
        setPocketError(f.required);
        return;
      }
      if (
        !value.price.trim() ||
        (!sell && !positive(n.price)) ||
        decimal(n.debit) < BigInt(0) ||
        (sell && (!settlement || settlement < value.date))
      ) {
        setError(f.required);
        return;
      }
      if (sell && q > decimal(holding.quantity)) {
        setError(f.invalidQuantity);
        return;
      }
      if (
        !sell &&
        value.date === today() &&
        pocket.availableBalance != null &&
        n.debitIdr !== null &&
        decimal(n.debitIdr) > decimal(pocket.availableBalance)
      ) {
        setPocketError(f.insufficient);
        return;
      }
      setBusy(true);
      const entry = positionBody(value, key).entry;
      await investmentWrite(
        `/family-groups/${fg}/investments/${holding.id}/ledger`,
        {
          token,
          method: "POST",
          body: JSON.stringify({
            ...entry,
            ...(sell ? { settlementDate: settlement } : {}),
          }),
        },
      );
    } catch (err) {
      const conflict = conflictMessage(
        err,
        copy,
        (v) => money(v, "IDR", locale, hideBalance),
        !value.time,
      );
      if (conflict?.field === "funds") setPocketError(conflict.text);
      else if (conflict) setError(conflict.text);
      else setError(apiErrorMessage(err, f.failed));
      setFailure(conflict?.history ? err : null);
      setBusy(false);
      return;
    }
    toast.success(f.savedTrade);
    onSaved();
    onClose();
  }
  const HeadIcon = sell ? Tag : ShoppingCart;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="ivx ivx-trade">
        <header className="ivx-head wm-dark">
          <span className="ivx-head-ic" aria-hidden="true">
            <HeadIcon />
          </span>
          <div className="ivx-head-text">
            <DialogTitle className="ivx-title">
              {sell ? copy.sellTitle : copy.buyTitle}
            </DialogTitle>
            <DialogDescription className="ivx-sub">
              {sell ? copy.sellSub : copy.buySub}
            </DialogDescription>
          </div>
          <DialogClose className="ivx-x" aria-label={copy.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form className="ivx-form" onSubmit={save}>
          <div className="ivx-body">
            <div className="ivx-seg" role="radiogroup" aria-label={f.kind}>
              {(["buy", "sell"] as const).map((mode) => {
                const Icon = mode === "sell" ? Tag : ShoppingCart;
                return (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="trade-kind"
                      checked={value.mode === mode}
                      onChange={() => update({ ...value, mode })}
                    />
                    <Icon aria-hidden="true" />
                    {c[mode]}
                  </label>
                );
              })}
            </div>
            {!holding.market && (
              <p className="ivx-strip" data-tone="warn" role="status">
                <Info aria-hidden="true" />
                {c.completeMarket}
              </p>
            )}
            <div className="ivx-rows">
              <Field label={c.instrument}>
                {(fieldId) =>
                  holdings.length > 1 ? (
                    <select
                      id={fieldId}
                      className="select"
                      value={id}
                      onChange={(e) => {
                        const h = holdings.find(
                          (h) => h.id === e.target.value,
                        )!;
                        const next = tradeState(h, sell ? "sell" : "buy");
                        setId(h.id);
                        setValue(next);
                        setSettlement(settlementDate(next.date, next.market));
                        setCustomSettlement(false);
                        setPocketError("");
                      }}
                    >
                      {holdings.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} · {h.market ?? c.completeMarket}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="ivx-static" id={fieldId}>
                      <strong>{holding.ticker || holding.name}</strong>
                      <span>
                        {[
                          holding.ticker ? holding.name : null,
                          holding.market ?? c.completeMarket,
                          holding.currency,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </p>
                  )
                }
              </Field>
              <Field
                label={copy.account}
                required
                hint={
                  pocketError ? (
                    <span className="ivx-field-error" role="alert">
                      {pocketError}
                    </span>
                  ) : undefined
                }
              >
                {(fieldId) => (
                  <TradePocketField
                    id={fieldId}
                    platforms={platforms}
                    currency={holding.currency}
                    platformId={restrictTo}
                    value={value.pocketId}
                    onPick={pick}
                    fg={fg}
                    token={token}
                    invalid={!!pocketError}
                  />
                )}
              </Field>
              {sell && (
                <p className="ivx-strip ivx-holding">
                  <span>{copy.holdingNow}</span>
                  <strong>
                    {hideBalance ? "••••" : quantity(holding, c, locale)}
                  </strong>
                </p>
              )}
              <PositionExecutionFields
                value={value}
                onChange={update}
                quantityLabel={sell ? copy.quantitySell : copy.quantityBuy}
              />
              {sell && (
                <Field label={f.settlementDate} required hint={f.brokerDate}>
                  {(fieldId) => (
                    <input
                      id={fieldId}
                      className="input"
                      type="date"
                      required
                      min={value.date}
                      value={settlement}
                      onChange={(e) => {
                        setSettlement(e.target.value);
                        setCustomSettlement(true);
                      }}
                    />
                  )}
                </Field>
              )}
              <Field label={f.note}>
                {(fieldId) => (
                  <input
                    id={fieldId}
                    className="input"
                    maxLength={1000}
                    value={value.note}
                    onChange={(e) =>
                      setValue({ ...value, note: e.target.value })
                    }
                  />
                )}
              </Field>
            </div>
            <TradePreview
              value={value}
              holding={holding}
              pocket={pocket}
              settlement={settlement}
            />
            <InvestmentConflict error={failure} />
            {error && (
              <p className="error-text ivx-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="ivx-foot">
            <button
              type="button"
              className="btn btn--outline ivx-cancel"
              disabled={busy}
              onClick={onClose}
            >
              {f.cancel}
            </button>
            <button className="btn btn--primary ivx-save" disabled={busy}>
              {busy ? f.saving : sell ? copy.saveSell : copy.saveBuy}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
