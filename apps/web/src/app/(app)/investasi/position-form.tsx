"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { findInvestmentPlatform, MARKETS } from "@wealthme/contracts";
import type {
  InvestmentLedgerResultDto,
  PlatformAccountDto,
} from "@wealthme/contracts";
import {
  Dialog,
  PanelContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";
import { investmentWrite, uploadInvestmentProof } from "./investment-api";
import { InvestmentConflict } from "./investment-conflict";
import { TYPES } from "./portfolio-model";
import type { PortfolioMember } from "./portfolio-filters";
import {
  initialPosition,
  changeType,
  positionNumbers,
  positionBody,
} from "./position-state";
import { PositionAccountFields } from "./position-account-fields";
import { PositionTypeFields } from "./position-type-fields";
import { PositionExecutionFields } from "./position-execution-fields";
import { PositionPreview } from "./position-preview";
import { decimal, positive } from "./decimal";
import { amount, today } from "./investment-fields";

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
  const { t } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const [value, setValue] = useState(() => initialPosition(myUserId));
  const [key] = useState(() => crypto.randomUUID());
  const router = useRouter();
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const platform = platforms.find((p) => p.id === value.platformId);
  const pocket = platform?.pockets?.find((p) => p.id === value.pocketId);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setFailure(null);
    let saved: InvestmentLedgerResultDto | null = null;
    try {
      if (
        value.mode === "buy" &&
        proof &&
        (proof.size > 5 * 1024 * 1024 ||
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
          ].includes(proof.type))
      ) {
        setError(f.proofLimit);
        return;
      }
      const n = positionNumbers(value);
      const quantity = decimal(n.quantity);
      const catalog = platform
        ? findInvestmentPlatform(platform.platformKey)
        : null;
      const fractional =
        value.market === "NASDAQ" || value.market === "NYSE"
          ? catalog?.fractionalUsShares === true
          : MARKETS[value.market].allowFractionDefault;
      if (
        !positive(n.quantity) ||
        (!fractional && quantity % decimal("1") !== BigInt(0)) ||
        (value.market === "IDX" &&
          value.mode === "buy" &&
          quantity % decimal("100") !== BigInt(0))
      ) {
        setError(f.invalidQuantity);
        return;
      }
      const unknown = value.mode === "opening" && !value.knownCost;
      if (
        !value.name.trim() ||
        (!value.manual &&
          ["saham", "kripto"].includes(value.type) &&
          !value.ticker.trim()) ||
        (!unknown && value.currency !== "IDR" && !positive(amount(value.fx))) ||
        (value.mode === "buy" && (!pocket || !positive(n.price))) ||
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
        setError(f.insufficient);
        return;
      }
      setBusy(true);
      saved = await investmentWrite<InvestmentLedgerResultDto>(
        `/family-groups/${fg}/investments/positions`,
        {
          token,
          method: "POST",
          body: JSON.stringify(positionBody(value, key)),
        },
      );
    } catch (err) {
      setFailure(err);
      setError(apiErrorMessage(err, f.failed));
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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <PanelContent size="lg" className="iv-position-panel">
        <form onSubmit={save}>
          <header className="iv-dialog-head">
            <DialogTitle>{c.add}</DialogTitle>
            <DialogDescription>{c.manual}</DialogDescription>
          </header>
          <div className="iv-form-body">
            <fieldset>
              <legend>{c.type}</legend>
              <div className="iv-types">
                {TYPES.map((type) => (
                  <label key={type} className="iv-type-option">
                    <input
                      type="radio"
                      name="investment-type"
                      checked={value.type === type}
                      onChange={() => setValue(changeType(value, type))}
                    />
                    {c[type]}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>{f.recordingMode}</legend>
              <div className="iv-field-row">
                {(["buy", "opening"] as const).map((mode) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="recording-mode"
                      checked={value.mode === mode}
                      onChange={() =>
                        setValue({ ...value, mode, knownCost: true })
                      }
                    />
                    {mode === "buy" ? f.newPurchase : c.opening}
                  </label>
                ))}
              </div>
            </fieldset>
            <PositionAccountFields
              value={value}
              onChange={setValue}
              platforms={platforms}
              members={members}
              isMaster={isMaster}
            />
            <PositionTypeFields value={value} onChange={setValue} />
            <PositionExecutionFields value={value} onChange={setValue} />
            {value.mode === "buy" && (
              <label className="field">
                <span className="label">{f.proof}</span>
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                />
                <small>{f.proofLimit}</small>
              </label>
            )}
            <PositionPreview value={value} pocket={pocket} />
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
      </PanelContent>
    </Dialog>
  );
}
