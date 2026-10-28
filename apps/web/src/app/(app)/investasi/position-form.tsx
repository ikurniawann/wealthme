"use client";
import { useState } from "react";
import { SharedToggle } from "@/components/forms/shared-toggle";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Paperclip, X } from "lucide-react";
import { findInvestmentPlatform, MARKETS } from "@wealthme/contracts";
import type {
  InvestmentLedgerResultDto,
  PlatformAccountDto,
} from "@wealthme/contracts";
import {
  Dialog,
  DialogClose,
  PanelContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { investmentWrite, uploadInvestmentProof } from "./investment-api";
import {
  InvestmentConflict,
  investmentErrorMessage,
} from "./investment-conflict";
import { TYPES, money } from "./portfolio-model";
import type { PortfolioMember } from "./portfolio-filters";
import {
  initialPosition,
  changeType,
  positionNumbers,
  positionBody,
} from "./position-state";
import type { PositionState } from "./position-state";
import { PositionAccountFields, platformsFor } from "./position-account-fields";
import { PositionTypeFields } from "./position-type-fields";
import { PositionExecutionFields } from "./position-execution-fields";
import { PositionPreview } from "./position-preview";
import { decimal, positive } from "./decimal";
import { Field, amount, today } from "./investment-fields";
import { TYPE_ICONS } from "./type-icons";
import { TradePocketField, pocketLabel } from "./trade-pocket-field";
import { tradeCopy } from "./trade-copy";
import { conflictMessage } from "./trade-state";
import "./trade-position.css";

const PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

/** US shares are fractional only where the platform says so (spec §6). */
function allowsFraction(value: PositionState, platform?: PlatformAccountDto) {
  const catalog = platform
    ? findInvestmentPlatform(platform.platformKey)
    : null;
  return value.market === "NASDAQ" || value.market === "NYSE"
    ? catalog?.fractionalUsShares === true
    : MARKETS[value.market].allowFractionDefault;
}

/** Whole-unit / lot rules for the chosen market and platform. */
function quantityError(value: PositionState, platform?: PlatformAccountDto) {
  const n = positionNumbers(value);
  const quantity = decimal(n.quantity);
  return (
    !positive(n.quantity) ||
    (!allowsFraction(value, platform) &&
      quantity % decimal("1") !== BigInt(0)) ||
    (value.market === "IDX" &&
      value.mode === "buy" &&
      quantity % decimal("100") !== BigInt(0))
  );
}

export function PositionForm({
  fg,
  token,
  myUserId,
  isMaster,
  members,
  platforms,
  onClose,
  onSaved,
}: {
  fg: string;
  token: string;
  myUserId: string;
  isMaster: boolean;
  members: PortfolioMember[];
  platforms: PlatformAccountDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const copy = tradeCopy(locale);
  const { hideBalance } = useMoney();
  const [value, setValue] = useState(() => initialPosition(myUserId));
  const [key] = useState(() => crypto.randomUUID());
  const router = useRouter();
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pocketError, setPocketError] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  // A pocket created from the picker arrives without its platform id.
  const platform =
    platforms.find((p) => p.id === value.platformId) ??
    (value.pocketId
      ? platforms.find((p) => p.pockets?.some((k) => k.id === value.pocketId))
      : undefined);
  const pocket = platform?.pockets?.find((p) => p.id === value.pocketId);
  const usable = platformsFor(platforms, value);
  const pick = (pocketId: string, p?: PlatformAccountDto) => {
    setPocketError("");
    setValue((s) => ({
      ...s,
      platformId: p?.id ?? s.platformId,
      pocketId,
      owner: isMaster && p ? (p.ownerUserId ?? "") : s.owner,
    }));
  };
  const update = (next: PositionState) => {
    setPocketError("");
    setValue(next);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setPocketError("");
    setFailure(null);
    let saved: InvestmentLedgerResultDto | null = null;
    try {
      if (
        value.mode === "buy" &&
        proof &&
        (proof.size > 5 * 1024 * 1024 || !PROOF_TYPES.includes(proof.type))
      ) {
        setError(f.proofLimit);
        return;
      }
      if (quantityError(value, platform)) {
        setError(f.invalidQuantity);
        return;
      }
      const n = positionNumbers(value);
      const unknown = value.mode === "opening" && !value.knownCost;
      if (value.mode === "buy" && !pocket) {
        setPocketError(f.required);
        return;
      }
      if (
        !value.name.trim() ||
        (!value.manual &&
          ["saham", "kripto"].includes(value.type) &&
          !value.ticker.trim()) ||
        (!unknown && value.currency !== "IDR" && !positive(amount(value.fx))) ||
        (value.mode === "buy" && !positive(n.price)) ||
        value.date > today()
      ) {
        setError(f.required);
        return;
      }
      if (
        value.mode === "buy" &&
        value.date === today() &&
        pocket?.availableBalance != null &&
        n.debitIdr !== null &&
        decimal(n.debitIdr) > decimal(pocket.availableBalance)
      ) {
        setPocketError(f.insufficient);
        return;
      }
      setBusy(true);
      saved = await investmentWrite<InvestmentLedgerResultDto>(
        `/family-groups/${fg}/investments/positions`,
        {
          token,
          method: "POST",
          body: JSON.stringify(
            positionBody(
              { ...value, platformId: platform?.id ?? value.platformId },
              key,
            ),
          ),
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
      else setError(investmentErrorMessage(err, f.failed, locale));
      setFailure(conflict?.history ? err : null);
      setBusy(false);
      return;
    }
    if (value.mode === "buy" && proof && saved?.transaction.cashTransactionId) {
      try {
        await uploadInvestmentProof(
          fg,
          saved.transaction.cashTransactionId,
          proof,
          token,
        );
        toast.success(f.savedPosition);
      } catch {
        const txId = saved.transaction.cashTransactionId;
        toast.warning(f.savedProofFailed, {
          action: {
            label: f.openTransaction,
            onClick: () => router.push(`/transaksi?tx=${txId}`),
          },
        });
      }
    } else toast.success(f.savedPosition);
    onSaved();
    onClose();
  }

  const pocketText =
    platform && pocket ? pocketLabel(platform, pocket, f) : undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <PanelContent size="lg" className="ivx ivx-pos">
        <header className="ivx-head wm-dark">
          <div className="ivx-head-text">
            <DialogTitle className="ivx-title">{c.add}</DialogTitle>
            <DialogDescription className="ivx-sub">
              {copy.addSub}
            </DialogDescription>
          </div>
          <DialogClose className="ivx-x" aria-label={copy.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form className="ivx-form" onSubmit={save}>
          <div className="ivx-body">
            <section className="ivx-sec">
              <h3 className="ivx-sec-title" id="ivx-type-title">
                {c.type}
              </h3>
              <div
                className="ivx-tiles"
                role="radiogroup"
                aria-labelledby="ivx-type-title"
              >
                {TYPES.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  return (
                    <label key={type} className="ivx-tile" data-type={type}>
                      <input
                        type="radio"
                        name="investment-type"
                        checked={value.type === type}
                        onChange={() => update(changeType(value, type))}
                      />
                      <span className="ivx-tile-ic" aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="ivx-tile-name">{c[type]}</span>
                    </label>
                  );
                })}
              </div>
              <p className="ivx-strip">
                <Info aria-hidden="true" />
                {copy.typeHint}
              </p>
            </section>
            <section className="ivx-sec">
              <h3 className="ivx-sec-title" id="ivx-mode-title">
                {f.recordingMode}
              </h3>
              <div
                className="ivx-modes"
                role="radiogroup"
                aria-labelledby="ivx-mode-title"
              >
                {(["buy", "opening"] as const).map((mode) => (
                  <label key={mode} className="ivx-mode">
                    <input
                      type="radio"
                      name="recording-mode"
                      checked={value.mode === mode}
                      onChange={() =>
                        update({ ...value, mode, knownCost: true })
                      }
                    />
                    <span>
                      <strong>
                        {mode === "buy" ? f.newPurchase : c.opening}
                      </strong>
                      <small>
                        {mode === "buy"
                          ? copy.newPurchaseDesc
                          : copy.openingDesc}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </section>
            <section className="ivx-sec">
              <h3 className="ivx-sec-title">{copy.detail}</h3>
              <div className="ivx-grid">
                <PositionAccountFields
                  value={value}
                  onChange={update}
                  platforms={platforms}
                  members={members}
                  isMaster={isMaster}
                />
                <PositionTypeFields value={value} onChange={update} />
                <PositionExecutionFields
                  value={value}
                  onChange={update}
                  quantityHint={
                    value.market === "NASDAQ" || value.market === "NYSE"
                      ? allowsFraction(value, platform)
                        ? copy.fractionAllowed
                        : copy.wholeOnly
                      : undefined
                  }
                />
                {value.mode === "buy" && (
                  <Field
                    label={f.pocket}
                    required
                    wide
                    hint={
                      pocketError ? (
                        <span className="ivx-field-error" role="alert">
                          {pocketError}
                        </span>
                      ) : undefined
                    }
                  >
                    {(id) => (
                      <TradePocketField
                        id={id}
                        platforms={usable}
                        currency={value.currency}
                        platformId={value.platformId}
                        value={value.pocketId}
                        onPick={pick}
                        fg={fg}
                        token={token}
                        invalid={!!pocketError}
                      />
                    )}
                  </Field>
                )}
              </div>
              <SharedToggle
                checked={value.shared}
                onChange={(shared) => update({ ...value, shared })}
              />
            </section>
            <PositionPreview
              value={value}
              pocket={pocket}
              pocketLabel={pocketText}
            />
            <section className="ivx-sec">
              <h3 className="ivx-sec-title">{copy.costs}</h3>
              <div className="ivx-grid">
                {value.mode === "buy" && (
                  <Field label={f.proof} wide hint={f.proofLimit}>
                    {(id) => (
                      <label className="ivx-file">
                        <Paperclip aria-hidden="true" />
                        <span>{proof?.name ?? f.proof}</span>
                        <input
                          id={id}
                          type="file"
                          accept={PROOF_TYPES.join(",")}
                          onChange={(e) =>
                            setProof(e.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                    )}
                  </Field>
                )}
                <Field label={f.note} wide>
                  {(id) => (
                    <textarea
                      id={id}
                      className="textarea"
                      rows={2}
                      maxLength={1000}
                      value={value.note}
                      onChange={(e) =>
                        setValue({ ...value, note: e.target.value })
                      }
                    />
                  )}
                </Field>
              </div>
            </section>
            <p className="ivx-strip">
              <Info aria-hidden="true" />
              {f.noOrder}
            </p>
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
              {busy ? f.saving : copy.saveInvestment}
            </button>
          </footer>
        </form>
      </PanelContent>
    </Dialog>
  );
}
