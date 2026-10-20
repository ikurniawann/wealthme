"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AccountDto, PlatformAccountDto } from "@wealthme/contracts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatMoneyTyping, useFxSnapshot } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { useMyAccess } from "@/hooks/use-my-access";
import { useMyRole } from "@/hooks/use-my-role";
import { useCanManage } from "@/hooks/use-role-permissions";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { investmentWrite } from "./investment-api";
import {
  InvestmentConflict,
  investmentErrorMessage,
} from "./investment-conflict";
import { today, nowTime, effectiveInstant } from "./investment-fields";
import { money } from "./portfolio-model";
import { positive } from "./decimal";
import type { PortfolioMember } from "./portfolio-filters";
import { PlatformForm } from "./platform-form";
import type { PlatformFormResult } from "./platform-form";
import { pocketTransferCopy } from "./pocket-transfer-copy";
import { LIVE_ERRORS, fieldOrder, planTransfer } from "./pocket-transfer-model";
import type { FieldError, FieldKey } from "./pocket-transfer-model";
import "./pocket-transfer.css";

/** Accounts that can fund / receive a platform transfer (spec §4): active
 *  bank (not a time deposit), cash or e-wallet with a visible balance, never
 *  a platform pocket, and — for an "own data" role — only accounts the
 *  member owns, matching
 *  TransactionsService.assertAccountOwnedByActingMember. */
export function eligibleTransferAccounts(
  accounts: AccountDto[],
  ownOnlyUserId: string | null,
): AccountDto[] {
  return accounts.filter(
    (a) =>
      ["bank", "cash", "ewallet"].includes(a.type) &&
      a.status !== "closed" &&
      a.balance !== null &&
      !a.platformAccountId &&
      // A time deposit is locked until maturity; it pays out to a savings
      // account rather than funding a platform directly.
      a.productKind !== "time_deposit" &&
      (ownOnlyUserId === null || a.ownerUserId === ownOnlyUserId),
  );
}

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
  const copy = pocketTransferCopy(locale);
  const { hideBalance } = useMoney();
  const { data: session } = useSession();
  const myUserId = session?.userId ?? "";
  const { myRole } = useMyRole();
  const { access } = useMyAccess();
  const { canManage } = useCanManage("Investment");
  const members = useQuery({
    queryKey: ["investment-members", fg, token],
    queryFn: () =>
      apiFetch<PortfolioMember[]>(`/family-groups/${fg}/members`, { token }),
    enabled: !!canManage,
  });
  const [addPocket, setAddPocket] = useState<{
    platform: PlatformAccountDto | null;
  } | null>(null);
  const pockets = platforms.flatMap((p) =>
    (p.pockets ?? [])
      .filter((p) => p.status !== "closed" && !p.balancesHidden)
      .map((pocket) => ({ platform: p, pocket })),
  );
  const banks = eligibleTransferAccounts(
    accounts,
    access?.dataScope === "own" ? myUserId : null,
  );
  const pocketless = platforms.filter(
    (p) => !(p.pockets ?? []).some((k) => k.status !== "closed"),
  );
  const platformName = (p: PlatformAccountDto) =>
    p.label ?? p.platformName ?? p.customName ?? p.platformKey;
  const onPocketCreated = (created?: PlatformFormResult) => {
    onSaved();
    if (created?.pocketId) {
      setPocketId(created.pocketId);
      resetAmounts();
    }
  };
  const [pocketId, setPocketId] = useState(
    initialPocketId ?? pockets[0]?.pocket.id ?? "",
  );
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [amountRaw, setAmountRaw] = useState("");
  const [sentRaw, setSentRaw] = useState("");
  const [feeRaw, setFeeRaw] = useState("");
  const [rateRaw, setRateRaw] = useState("");
  const [date, setDate] = useState(today());
  // New entries dated today carry the current time (spec ruling): a timed
  // top up then sorts before a same-day buy instead of at 00:00.
  const [time, setTime] = useState(nowTime);
  const [timeAuto, setTimeAuto] = useState(true);
  const [note, setNote] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, true>>>({});
  const [submitted, setSubmitted] = useState(false);
  const uid = useId();
  const chosen = pockets.find((p) => p.pocket.id === pocketId);
  const bank = banks.find((a) => a.id === bankId);
  const pocket = chosen?.pocket;
  const sourceCur = (withdraw ? pocket?.currency : bank?.currency) ?? "IDR";
  const destCur = (withdraw ? bank?.currency : pocket?.currency) ?? "IDR";
  const cross = sourceCur !== destCur;
  const unsupported = cross && sourceCur !== "IDR" && destCur !== "IDR";
  const rates = useFxSnapshot(sourceCur !== "IDR" && !cross);
  const sourceBefore = withdraw ? pocket?.availableBalance : bank?.balance;
  const destBefore = withdraw ? bank?.balance : pocket?.recordedBalance;
  const plan = planTransfer({
    bankId: bank ? bankId : "",
    pocketId: chosen ? pocketId : "",
    sourceCur,
    cross,
    amountRaw,
    sentRaw,
    feeRaw,
    rateRaw,
    snapshotRate: (
      rates.data?.idrPerUnit as Record<string, string> | undefined
    )?.[sourceCur],
    sourceBefore,
    destBefore,
    checkBalance: date === today(),
  });
  const fmt = (value: string | null | undefined) =>
    money(value, "IDR", locale, hideBalance);
  const errorText = (code: FieldError): string =>
    code === "insufficient"
      ? (withdraw
          ? copy.errors.insufficientPocket
          : copy.errors.insufficientAccount)(fmt(sourceBefore))
      : copy.errors[code];
  /** Message shown under a field: required-type errors wait for a blur or
   *  a submit; fee/balance errors show as soon as the numbers conflict. */
  const shown = (key: FieldKey): string | undefined => {
    const code = plan.errors[key];
    if (!code) return undefined;
    return submitted || touched[key] || LIVE_ERRORS.has(code)
      ? errorText(code)
      : undefined;
  };
  const blur = (key: FieldKey) => () =>
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const invalidKeys = fieldOrder(cross).filter((k) => plan.errors[k]);
  const resetAmounts = () => {
    setAmountRaw("");
    setSentRaw("");
    setFeeRaw("");
    setRateRaw("");
    setTouched({});
    setSubmitted(false);
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setError("");
    const firstInvalid = invalidKeys[0];
    if (firstInvalid) {
      const el = document.getElementById(`${uid}-${firstInvalid}`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (unsupported || !plan.validFx || !chosen || !bank) {
      setError(unsupported ? f.fxUnsupported : copy.fxUnavailable);
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
            // The API takes the total that left the source and the net
            // that landed; the dialog asks for "landed" + a separate fee.
            sourceAmount: plan.sourceTotal,
            sourceCurrency: sourceCur,
            destAmount: plan.landed,
            destCurrency: destCur,
            ...(cross ? { fxRate: plan.rate } : {}),
            fee: plan.fee,
            feeCurrency: sourceCur,
            occurredAt: effectiveInstant(date, time),
            description: note.trim() || undefined,
            idempotencyKey,
          }),
        },
      );
    } catch (err) {
      setFailure(err);
      setError(investmentErrorMessage(err, f.failed, locale));
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
      <DialogContent className="iv-dialog iv-transfer">
        {/* noValidate: our field-level messages replace the browser bubble. */}
        <form onSubmit={save} noValidate>
          <header className="iv-dialog-head wm-dark">
            <DialogTitle>{withdraw ? f.withdraw : f.transferTitle}</DialogTitle>
            <DialogDescription>
              {withdraw ? copy.withdrawSub : f.transferSub}
            </DialogDescription>
          </header>
          <div className="iv-form-body">
            {banks.length === 0 ? (
              <div className="iv-pt-empty" role="status">
                <strong>
                  {withdraw ? f.destination : f.source} · {copy.noBankTitle}
                </strong>
                <p>{copy.noBankBody}</p>
                <div className="iv-pt-empty-actions">
                  <Link className="btn btn--outline" href="/rekening">
                    {copy.addBank}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="field">
                <label className="label" htmlFor={`${uid}-bank`}>
                  {withdraw ? f.destination : f.source} *
                </label>
                <select
                  id={`${uid}-bank`}
                  className="select"
                  required
                  aria-invalid={shown("bank") ? true : undefined}
                  aria-describedby={
                    shown("bank") ? `${uid}-bank-err` : undefined
                  }
                  value={bankId}
                  onBlur={blur("bank")}
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
                <FieldMessage id={`${uid}-bank-err`} text={shown("bank")} />
              </div>
            )}
            {pockets.length === 0 ? (
              <div className="iv-pt-empty" role="status">
                <strong>{copy.noPocketTitle}</strong>
                <p>{canManage ? copy.noPocketBody : copy.noPocketReadOnly}</p>
                {canManage && (
                  <div className="iv-pt-empty-actions">
                    {pocketless.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="btn btn--primary"
                        onClick={() => setAddPocket({ platform: p })}
                      >
                        {copy.addPocketTo(platformName(p))}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`btn ${pocketless.length ? "btn--outline" : "btn--primary"}`}
                      onClick={() => setAddPocket({ platform: null })}
                    >
                      {copy.addPlatformPocket}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="field">
                <label className="label" htmlFor={`${uid}-pocket`}>
                  {f.pocket} *
                </label>
                <select
                  id={`${uid}-pocket`}
                  className="select"
                  required
                  aria-invalid={shown("pocket") ? true : undefined}
                  aria-describedby={
                    shown("pocket") ? `${uid}-pocket-err` : undefined
                  }
                  value={pocketId}
                  onBlur={blur("pocket")}
                  onChange={(e) => {
                    setPocketId(e.target.value);
                    resetAmounts();
                  }}
                >
                  <option value="">{f.choose}</option>
                  {pockets.map(({ platform, pocket }) => (
                    <option key={pocket.id} value={pocket.id}>
                      {platformName(platform)} · {f[pocket.pocketKind]} ·{" "}
                      {pocket.currency} · {copy.available}{" "}
                      {pocket.heldIncomplete
                        ? "—"
                        : fmt(pocket.availableBalance)}
                    </option>
                  ))}
                </select>
                <FieldMessage id={`${uid}-pocket-err`} text={shown("pocket")} />
              </div>
            )}
            {cross && (
              <MoneyField
                id={`${uid}-sent`}
                label={withdraw ? copy.sentPocket : copy.sentAccount}
                currency={sourceCur}
                required
                value={sentRaw}
                decimals={sourceCur === "IDR" ? 0 : 2}
                onChange={setSentRaw}
                onBlur={blur("sent")}
                error={shown("sent")}
              />
            )}
            <MoneyField
              id={`${uid}-amount`}
              label={withdraw ? copy.landedAccount : copy.landedPocket}
              currency={destCur}
              required
              value={amountRaw}
              decimals={destCur === "IDR" ? 0 : 2}
              onChange={setAmountRaw}
              onBlur={blur("amount")}
              error={shown("amount")}
            />
            {cross && (
              <MoneyField
                id={`${uid}-rate`}
                label={f.actualRate}
                currency="IDR"
                required
                value={rateRaw}
                decimals={6}
                onChange={setRateRaw}
                onBlur={blur("rate")}
                error={shown("rate")}
              />
            )}
            <MoneyField
              id={`${uid}-fee`}
              label={copy.fee}
              currency={sourceCur}
              value={feeRaw}
              placeholder="0"
              decimals={sourceCur === "IDR" ? 0 : 2}
              onChange={setFeeRaw}
              onBlur={blur("fee")}
              hint={copy.feeHint}
              error={shown("fee")}
            />
            <p className="iv-pt-total" aria-live="polite">
              <span>
                {withdraw ? copy.totalOutPocket : copy.totalOutAccount}
                <small> = {copy.totalFormula}</small>
              </span>
              <strong className="mono">
                {money(plan.sourceTotal, sourceCur, locale, false)}
              </strong>
            </p>
            <div className="iv-field-row">
              <label className="field">
                <span className="label">{f.date} *</span>
                <input
                  className="input"
                  type="date"
                  required
                  max={today()}
                  value={date}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDate(next);
                    if (timeAuto) setTime(next === today() ? nowTime() : "");
                  }}
                />
              </label>
              <label className="field">
                <span className="label">{f.time}</span>
                <input
                  className="input"
                  type="time"
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value);
                    setTimeAuto(false);
                  }}
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
            <section className="iv-transfer-preview iv-pt-summary">
              <h2>{f.summary} · IDR</h2>
              <SummaryRow
                label={withdraw ? f.pocket : f.source}
                before={fmt(sourceBefore)}
                after={plan.validFx ? fmt(plan.sourceAfter) : "—"}
                delta={
                  plan.totalIdr && positive(plan.totalIdr)
                    ? `−${fmt(plan.totalIdr)}`
                    : undefined
                }
                tone="out"
              />
              <SummaryRow
                label={withdraw ? f.destination : f.pocket}
                before={fmt(destBefore)}
                after={plan.validFx ? fmt(plan.destAfter) : "—"}
                delta={
                  plan.creditIdr && positive(plan.creditIdr)
                    ? `+${fmt(plan.creditIdr)}`
                    : undefined
                }
                tone="in"
              />
              <p className="iv-pt-fee-line">
                <span>{copy.summaryFee}</span>
                <span className="mono">
                  {plan.feeIdr && positive(plan.feeIdr)
                    ? fmt(plan.feeIdr)
                    : copy.noFee}
                </span>
              </p>
              <small>{f.currentBalance}</small>
            </section>
            <p className="iv-notice">{f.transferNote}</p>
            {unsupported && <p className="error-text">{f.fxUnsupported}</p>}
            <InvestmentConflict error={failure} />
            {submitted && invalidKeys.length > 0 && (
              <p className="error-text" role="alert">
                {copy.errorSummary(invalidKeys.length)}
              </p>
            )}
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
              disabled={busy || unsupported || !banks.length || !pockets.length}
            >
              {busy ? f.saving : f.save}
            </button>
          </footer>
        </form>
        {addPocket && (
          <PlatformForm
            fg={fg}
            token={token}
            members={members.data ?? []}
            myUserId={myUserId}
            isMaster={myRole === "owner" || myRole === "spouse"}
            platform={addPocket.platform}
            onClose={() => setAddPocket(null)}
            onSaved={onPocketCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldMessage({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="error-text iv-pt-error">
      {text}
    </p>
  );
}

/** Money input of this dialog: persistent label, decimal keypad, the error
 *  right under the field and wired to it via aria-describedby. */
function MoneyField({
  id,
  label,
  currency,
  value,
  onChange,
  onBlur,
  decimals,
  required = false,
  placeholder,
  hint,
  error,
}: {
  id: string;
  label: string;
  currency: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  decimals: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  const described =
    [hint ? `${id}-hint` : "", error ? `${id}-err` : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="field iv-pt-field">
      <label className="label" htmlFor={id}>
        {label}
        {required ? " *" : ""} · {currency}
      </label>
      <input
        id={id}
        className="input mono"
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        value={value}
        onBlur={onBlur}
        onChange={(e) =>
          onChange(formatMoneyTyping(e.target.value, decimals, false))
        }
      />
      {hint && (
        <small id={`${id}-hint`} className="iv-pt-hint">
          {hint}
        </small>
      )}
      <FieldMessage id={`${id}-err`} text={error} />
    </div>
  );
}

function SummaryRow({
  label,
  before,
  after,
  delta,
  tone,
}: {
  label: string;
  before: string;
  after: string;
  delta?: string;
  tone: "in" | "out";
}) {
  return (
    <div className="iv-pt-row">
      <span className="iv-pt-row-label">{label}</span>
      <span className="iv-pt-row-value mono">
        <span className="iv-pt-amt">{before}</span>{" "}
        <span className="iv-pt-amt">→ {after}</span>
      </span>
      {delta && (
        <span className="iv-pt-delta mono" data-tone={tone}>
          {delta}
        </span>
      )}
    </div>
  );
}
