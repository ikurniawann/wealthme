"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet, X } from "lucide-react";
import type {
  AccountDto,
  AssetDto,
  AssetHoldingStateDto,
  AssetTransactionResultDto,
  CreateAssetTransactionInput,
} from "@wealthme/contracts";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { investmentWrite } from "../../investasi/investment-api";
import { investmentErrorMessage } from "../../investasi/investment-conflict";
import { nowTime, today } from "../../investasi/investment-fields";
import { fillCopy } from "../aset-model";
import {
  fixed,
  idr,
  isPositive,
  mul,
  plain,
  signedIdr,
  sub,
  typedToDecimal,
  withUnit,
} from "./detail-model";
import {
  AmountInput,
  CurrencyFields,
  Field,
  IconControl,
  useCurrency,
  useWhen,
  WhenFields,
} from "./drawer-fields";
import "../../investasi/trade-position.css";
import "./drawer.css";

/** Accounts a physical asset can be paid from / sold into. */
export function cashAccounts(accounts: AccountDto[]): AccountDto[] {
  return accounts.filter(
    (a) =>
      (a.type === "bank" || a.type === "cash" || a.type === "ewallet") &&
      a.status !== "closed",
  );
}

type Errors = { qty?: string; price?: string; account?: string; date?: string };

/** Route a server rejection to the field it is about (409 / 400 copy). */
function fieldOf(err: unknown, message: string): keyof Errors | null {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  if (
    code === "INSUFFICIENT_HOLDINGS" ||
    /unit dimiliki|kepemilikan/i.test(message)
  )
    return "qty";
  if (/saldo|rekening|kantong|account/i.test(message)) return "account";
  if (/masa depan|future/i.test(message)) return "date";
  return null;
}

/**
 * Catat beli / Catat jual for a physical asset (spec §10): quantity, price
 * per unit, fee, the cash account and the effective date. The cash leg is a
 * one-sided transfer written by the server in the same transaction; this
 * drawer shows the arithmetic as an estimate and the server's answer wins.
 */
export function TradeDrawer({
  kind,
  asset,
  state,
  accounts,
  fg,
  token,
  onClose,
  onSaved,
}: {
  kind: "buy" | "sell";
  asset: AssetDto;
  state: AssetHoldingStateDto;
  accounts: AccountDto[];
  fg: string;
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const money = useMoney();
  const unit = state.unit ?? asset.unit ?? null;
  const usable = cashAccounts(accounts);
  const [key] = useState(() => crypto.randomUUID());
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("");
  const [accountId, setAccountId] = useState(
    usable.length === 1 ? usable[0]!.id : "",
  );
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const when = useWhen();
  const cur = useCurrency(asset.currency || "IDR");
  const buy = kind === "buy";

  const q = typedToDecimal(qty);
  const pr = typedToDecimal(price);
  const f = typedToDecimal(fee) || "0";
  const gross = isPositive(q) && isPositive(pr) ? mul(q, pr) : null;
  const net = gross
    ? buy
      ? plain(fixed(gross) + fixed(f))
      : sub(gross, f)
    : null;
  const held = state.quantity ?? "0";
  const after = isPositive(q)
    ? buy
      ? plain(fixed(held) + fixed(q))
      : sub(held, q)
    : null;
  const realized =
    !buy && gross && state.costBasisPerUnit && state.costBasisKnown
      ? sub(sub(gross, mul(state.costBasisPerUnit, q)), f)
      : null;
  const future =
    when.date === today() && when.time !== "" && when.time > nowTime();
  const fmtCur = (v: string) =>
    cur.currency === "IDR"
      ? money.formatExact(idr(v))
      : `${cur.currency} ${new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 2 }).format(Number(v))}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!isPositive(q)) next.qty = d.qtyRequired;
    else if (!buy && fixed(q) > fixed(held))
      next.qty = fillCopy(d.tAvailable, { qty: withUnit(held, unit, locale) });
    if (!isPositive(pr)) next.price = d.priceRequired;
    if (!accountId) next.account = d.accountRequired;
    if (future) next.date = d.futureDate;
    setErrors(next);
    if (Object.keys(next).length || busy) return;
    if (cur.currency !== "IDR" && !isPositive(cur.fxRate())) return;
    setBusy(true);
    setFailure("");
    const body: CreateAssetTransactionInput = {
      kind,
      idempotencyKey: key,
      quantity: q,
      pricePerUnit: pr,
      fee: f,
      currency: cur.currency,
      fxRate: cur.fxRate(),
      ...when.body(),
      cashAccountId: accountId,
      note: note.trim() || null,
    };
    try {
      await investmentWrite<AssetTransactionResultDto>(
        `/family-groups/${fg}/assets/${asset.id}/transactions`,
        { token, method: "POST", body: JSON.stringify(body) },
      );
      toast.success(d.tSaved);
      await onSaved();
      onClose();
    } catch (err) {
      const message = investmentErrorMessage(err, d.tFailed, locale);
      const field = fieldOf(err, message);
      if (field) setErrors({ [field]: message });
      else setFailure(message);
      setBusy(false);
    }
  }

  const priceLabel = fillCopy(d.tPrice, { unit: unit ?? "unit" });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <PanelContent size="lg" className="ivx ivx-pos ad-drawer">
        <header className="ivx-head">
          <div className="ivx-head-text">
            <DialogTitle className="ivx-title">
              {buy ? d.tBuyTitle : d.tSellTitle} · {asset.name}
            </DialogTitle>
            <DialogDescription className="ivx-sub">
              {buy ? d.tBuySub : d.tSellSub}
            </DialogDescription>
          </div>
          <DialogClose
            className="ivx-x"
            aria-label={t.common.close}
            disabled={busy}
          >
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form className="ivx-form" onSubmit={save} noValidate>
          <div className="ivx-body">
            <div className="ivx-grid">
              <Field
                id="adt-qty"
                label={d.tQty}
                required
                error={errors.qty}
                hint={
                  buy
                    ? undefined
                    : fillCopy(d.tAvailable, {
                        qty: withUnit(held, unit, locale),
                      })
                }
              >
                <AmountInput
                  id="adt-qty"
                  suffix={unit ?? undefined}
                  value={qty}
                  onChange={(v) => {
                    setQty(v);
                    setErrors((x) => ({ ...x, qty: undefined }));
                  }}
                  invalid={!!errors.qty}
                  required
                  describedBy={
                    errors.qty
                      ? "adt-qty-err"
                      : buy
                        ? undefined
                        : "adt-qty-hint"
                  }
                />
              </Field>
              <Field
                id="adt-price"
                label={priceLabel}
                required
                error={errors.price}
              >
                <AmountInput
                  id="adt-price"
                  mark={cur.currency === "IDR" ? "Rp" : cur.currency}
                  suffix={unit ? `/ ${unit}` : undefined}
                  value={price}
                  onChange={(v) => {
                    setPrice(v);
                    setErrors((x) => ({ ...x, price: undefined }));
                  }}
                  invalid={!!errors.price}
                  required
                />
              </Field>
              <Field id="adt-fee" label={d.tFee}>
                <AmountInput
                  id="adt-fee"
                  mark={cur.currency === "IDR" ? "Rp" : cur.currency}
                  value={fee}
                  onChange={setFee}
                />
              </Field>
              <CurrencyFields
                idBase="adt"
                state={cur}
                currencyLabel={d.vCurrency}
                rateLabel={d.vFxRate}
                rateHint={d.vFxHint}
              />
              <Field
                id="adt-account"
                label={buy ? d.tAccountBuy : d.tAccountSell}
                required
                error={errors.account}
                wide
              >
                {usable.length === 0 ? (
                  <p className="ivx-strip" data-tone="warn" id="adt-account">
                    {d.tAccountNone}
                  </p>
                ) : (
                  <IconControl icon={Wallet}>
                    <select
                      id="adt-account"
                      className="select"
                      required
                      aria-invalid={errors.account ? true : undefined}
                      aria-describedby={
                        errors.account ? "adt-account-err" : undefined
                      }
                      value={accountId}
                      onChange={(e) => {
                        setAccountId(e.target.value);
                        setErrors((x) => ({ ...x, account: undefined }));
                      }}
                    >
                      <option value="">{d.tAccountPick}</option>
                      {usable.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.institution ? ` · ${a.institution}` : ""} —{" "}
                          {fillCopy(d.tBalance, {
                            amount: money.formatExact(idr(a.balance ?? "0")),
                          })}
                        </option>
                      ))}
                    </select>
                  </IconControl>
                )}
              </Field>
              <WhenFields
                idBase="adt"
                when={when}
                dateLabel={d.vDate}
                timeLabel={d.vTime}
                zoneLabel={d.vZone}
                timeHint={d.vTimeHint}
                error={errors.date ?? (future ? d.futureDate : undefined)}
              />
              <Field id="adt-note" label={d.vNote} wide>
                <textarea
                  id="adt-note"
                  className="textarea"
                  rows={2}
                  maxLength={1000}
                  placeholder={d.vNotePh}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </div>
            <section
              className="ivx-sum"
              aria-live="polite"
              aria-labelledby="adt-sum"
            >
              <p className="ivx-sum-title" id="adt-sum">
                {d.tSummary}
              </p>
              <dl className="ivx-sum-list">
                <div>
                  <dt>{d.tGross}</dt>
                  <dd>{gross ? fmtCur(gross) : "—"}</dd>
                </div>
                <div>
                  <dt>{d.txFee}</dt>
                  <dd>{fmtCur(f)}</dd>
                </div>
                <div className="ivx-sum-key">
                  <dt>{buy ? d.tNetBuy : d.tNetSell}</dt>
                  <dd>{net ? fmtCur(net) : "—"}</dd>
                </div>
                <div>
                  <dt>{d.tCostAfter}</dt>
                  <dd>{after ? withUnit(after, unit, locale) : "—"}</dd>
                </div>
                {!buy && (
                  <div>
                    <dt>{d.tRealizedEst}</dt>
                    <dd>
                      {realized && cur.currency === "IDR"
                        ? signedIdr(realized, money.formatExact)
                        : "—"}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="ivx-sum-note">{d.tEstimateNote}</p>
            </section>
            {failure && (
              <p className="ivx-field-error ivx-error" role="alert">
                {failure}
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
              {d.vCancel}
            </button>
            <button
              className="btn btn--primary ivx-save"
              disabled={busy || usable.length === 0}
            >
              {busy ? d.vSaving : buy ? d.tSaveBuy : d.tSaveSell}
            </button>
          </footer>
        </form>
      </PanelContent>
    </Dialog>
  );
}
