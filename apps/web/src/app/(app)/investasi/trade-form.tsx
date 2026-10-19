"use client";
import { useState } from "react";
import { toast } from "sonner";
import { MARKETS } from "@wealthme/contracts";
import type { InvestmentDto, PlatformAccountDto } from "@wealthme/contracts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMoney } from "@/hooks/use-money";
import { money } from "./portfolio-model";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";
import { investmentWrite } from "./investment-api";
import { InvestmentConflict } from "./investment-conflict";
import { tradeState, settlementDate } from "./trade-state";
import { positionNumbers, positionBody } from "./position-state";
import { PositionExecutionFields } from "./position-execution-fields";
import { TradePreview } from "./trade-preview";
import { positive, decimal } from "./decimal";
import { today } from "./investment-fields";

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
  const [failure, setFailure] = useState<unknown>(null);
  const pockets = platforms
    .filter(
      (p) => !holding.platformAccountId || p.id === holding.platformAccountId,
    )
    .flatMap((p) =>
      (p.pockets ?? []).filter(
        (p) =>
          p.currency === holding.currency &&
          p.status !== "closed" &&
          !p.balancesHidden,
      ),
    );
  const pocket = pockets.find((p) => p.id === value.pocketId);
  function update(next: typeof value) {
    if (next.date !== value.date && !customSettlement)
      setSettlement(settlementDate(next.date, next.market));
    setValue(next);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setFailure(null);
    try {
      if (!holdings.some((h) => h.id === id)) {
        setError(c.error);
        return;
      }
      const n = positionNumbers(value);
      const q = decimal(n.quantity);
      if (!holding.market) {
        setError(c.completeMarket);
        return;
      }
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
      if (
        !pocket ||
        !value.price.trim() ||
        (value.mode === "buy" && !positive(n.price)) ||
        decimal(n.debit) < BigInt(0) ||
        (value.mode === "sell" && (!settlement || settlement < value.date))
      ) {
        setError(f.required);
        return;
      }
      if (value.mode === "sell" && q > decimal(holding.quantity)) {
        setError(f.invalidQuantity);
        return;
      }
      if (
        value.mode === "buy" &&
        value.date === today() &&
        pocket.availableBalance != null &&
        n.debitIdr !== null &&
        decimal(n.debitIdr) > decimal(pocket.availableBalance)
      ) {
        setError(f.insufficient);
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
            ...(value.mode === "sell" ? { settlementDate: settlement } : {}),
          }),
        },
      );
    } catch (err) {
      setFailure(err);
      setError(apiErrorMessage(err, f.failed));
      setBusy(false);
      return;
    }
    toast.success(f.savedTrade);
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
            <DialogTitle>{value.mode === "sell" ? c.sell : c.buy}</DialogTitle>
            <DialogDescription>{f.noOrder}</DialogDescription>
          </header>
          <div className="iv-form-body">
            <fieldset>
              <legend className="sr-only">{f.kind}</legend>
              <div className="iv-field-row">
                {(["buy", "sell"] as const).map((mode) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="trade-kind"
                      checked={value.mode === mode}
                      onChange={() => update({ ...value, mode })}
                    />
                    {c[mode]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field">
              <span className="label">{c.instrument}</span>
              <select
                className="select"
                value={id}
                onChange={(e) => {
                  const h = holdings.find((h) => h.id === e.target.value)!;
                  const next = tradeState(
                    h,
                    value.mode === "sell" ? "sell" : "buy",
                  );
                  setId(h.id);
                  setValue(next);
                  setSettlement(settlementDate(next.date, next.market));
                  setCustomSettlement(false);
                }}
              >
                {holdings.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} · {h.market ?? c.completeMarket}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">{f.pocket} *</span>
              <select
                className="select"
                required
                value={value.pocketId}
                onChange={(e) => update({ ...value, pocketId: e.target.value })}
              >
                <option value="">{f.choose}</option>
                {pockets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.currency}
                  </option>
                ))}
              </select>
            </label>
            <small>
              {c.available}:{" "}
              {money(pocket?.availableBalance, "IDR", locale, hideBalance)}
            </small>
            <PositionExecutionFields value={value} onChange={update} />
            {value.mode === "sell" && (
              <label className="field">
                <span className="label">{f.settlementDate} *</span>
                <input
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
                <small>{f.brokerDate}</small>
              </label>
            )}
            <TradePreview
              value={value}
              holding={holding}
              pocket={pocket}
              settlement={settlement}
            />
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
              {busy ? f.saving : f.save}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
