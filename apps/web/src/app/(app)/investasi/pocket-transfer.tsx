"use client";
import { useState } from "react";
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
import { useFxSnapshot } from "@/components/money";
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
import {
  AmountInput,
  amount,
  today,
  nowTime,
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
import type { PortfolioMember } from "./portfolio-filters";
import { PlatformForm } from "./platform-form";
import type { PlatformFormResult } from "./platform-form";
import { pocketTransferCopy } from "./pocket-transfer-copy";
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
  const [raw, setRaw] = useState("");
  const [destRaw, setDestRaw] = useState("");
  const [feeRaw, setFeeRaw] = useState("0");
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
      setError(investmentErrorMessage(err, f.failed, locale));
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
                      {platformName(platform)} · {f[pocket.pocketKind]} ·{" "}
                      {pocket.currency} · {copy.available}{" "}
                      {pocket.heldIncomplete
                        ? "—"
                        : fmt(pocket.availableBalance)}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
            <section className="iv-transfer-preview">
              <h2>{f.summary} · IDR</h2>
              <p>
                {withdraw ? f.pocket : f.source}: {fmt(sourceBefore)} →{" "}
                {validFx ? fmt(sourceAfter) : "—"}
              </p>
              <p>
                {withdraw ? f.destination : f.pocket}: {fmt(destBefore)} →{" "}
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
              disabled={
                busy ||
                unsupported ||
                insufficient ||
                !banks.length ||
                !pockets.length
              }
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
