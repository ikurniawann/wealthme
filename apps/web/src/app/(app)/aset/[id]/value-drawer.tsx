"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, FileText, Info, X } from "lucide-react";
import type {
  AssetDto,
  AssetHoldingStateDto,
  AssetValuationInput,
  AssetValuationPreviewDto,
  AssetValuationResultDto,
} from "@wealthme/contracts";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocale } from "@/hooks/use-locale";
import { uploadAssetDocument } from "@/lib/asset-attachments";
import { investmentWrite } from "../../investasi/investment-api";
import { investmentErrorMessage } from "../../investasi/investment-conflict";
import { nowTime, today } from "../../investasi/investment-fields";
import { fillCopy } from "../aset-model";
import { isPositive, typedToDecimal } from "./detail-model";
import {
  AmountInput,
  CurrencyFields,
  Field,
  IconControl,
  useCurrency,
  useWhen,
  WhenFields,
} from "./drawer-fields";
import { ValuePreview } from "./value-preview";
import "../../investasi/trade-position.css";
import "./drawer.css";

const SOURCES = [
  "manual",
  "appraisal",
  "dealer",
  "market",
  "receipt",
  "other",
] as const;
const PROOF_LIMIT = 5 * 1024 * 1024;

/**
 * Update nilai (spec §11): a valuation by the asset's model — price per
 * unit, or one total value — with effective date (time + zone optional),
 * source, reference, optional proof and note. The live preview comes from
 * POST …/valuations/preview, so the numbers shown are the server's own
 * (Decimal) math, backdate and "not current" warnings included. Never moves
 * cash or cost basis.
 */
export function ValueDrawer({
  asset,
  state,
  fg,
  token,
  onClose,
  onSaved,
}: {
  asset: AssetDto;
  state: AssetHoldingStateDto;
  fg: string;
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const perUnit = state.valuationModel === "per_unit";
  const unit = state.unit ?? asset.unit ?? null;
  const [key] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState("");
  const [errors, setErrors] = useState<{
    amount?: string;
    source?: string;
    date?: string;
  }>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const when = useWhen();
  const cur = useCurrency(asset.currency || "IDR");
  const base = `/family-groups/${fg}/assets/${asset.id}`;

  const value = typedToDecimal(amount);
  const future =
    when.date === today() && when.time !== "" && when.time > nowTime();
  const ready =
    isPositive(value) &&
    !!when.date &&
    !future &&
    (cur.currency === "IDR" || isPositive(cur.fxRate()));
  const input: AssetValuationInput = {
    ...(perUnit ? { pricePerUnit: value } : { value }),
    currency: cur.currency,
    fxRate: cur.fxRate(),
    ...when.body(),
    source: source || "manual",
    reference: reference.trim() || null,
    note: note.trim() || null,
  };
  const previewBody = useDebounce(ready ? JSON.stringify(input) : "", 350);
  const preview = useQuery({
    queryKey: ["assets", fg, asset.id, "valuation-preview", previewBody],
    queryFn: () =>
      investmentWrite<AssetValuationPreviewDto>(`${base}/valuations/preview`, {
        token,
        method: "POST",
        body: previewBody,
      }),
    enabled: previewBody !== "",
    retry: false,
    staleTime: 30_000,
  });
  const p = previewBody !== "" ? preview.data : undefined;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isPositive(value)) next.amount = d.priceRequired;
    if (!source) next.source = d.sourceRequired;
    if (future) next.date = d.futureDate;
    setErrors(next);
    if (Object.keys(next).length || !ready || busy) return;
    setBusy(true);
    setFailure("");
    try {
      await investmentWrite<AssetValuationResultDto>(`${base}/valuations`, {
        token,
        method: "POST",
        body: JSON.stringify({ ...input, source, idempotencyKey: key }),
      });
      let proofFailed = false;
      if (proof) {
        try {
          await uploadAssetDocument(fg, asset.id, proof, token);
        } catch {
          proofFailed = true;
        }
      }
      if (proofFailed) toast.warning(d.vProofFailed);
      else toast.success(d.vSaved);
      await onSaved();
      onClose();
    } catch (err) {
      setFailure(investmentErrorMessage(err, d.vFailed, locale));
      setBusy(false);
    }
  }

  const priceLabel = fillCopy(d.vPriceLabel, { unit: unit ?? "unit" });
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
            <DialogTitle className="ivx-title">{d.vTitle}</DialogTitle>
            <DialogDescription className="ivx-sub">
              {asset.name}
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
            <p className="ivx-strip ad-info">
              <Info aria-hidden="true" />
              <span>{d.vInfo}</span>
            </p>
            <div className="ivx-grid">
              <Field
                id="adv-amount"
                label={perUnit ? priceLabel : d.vTotalLabel}
                required
                error={errors.amount}
                wide
              >
                <AmountInput
                  id="adv-amount"
                  mark={cur.currency === "IDR" ? "Rp" : cur.currency}
                  suffix={perUnit && unit ? `/ ${unit}` : undefined}
                  value={amount}
                  onChange={(v) => {
                    setAmount(v);
                    setErrors((x) => ({ ...x, amount: undefined }));
                  }}
                  invalid={!!errors.amount}
                  required
                  describedBy={errors.amount ? "adv-amount-err" : undefined}
                />
              </Field>
              <WhenFields
                idBase="adv"
                when={when}
                dateLabel={d.vDate}
                timeLabel={d.vTime}
                zoneLabel={d.vZone}
                timeHint={d.vTimeHint}
                error={errors.date ?? (future ? d.futureDate : undefined)}
              />
              <Field
                id="adv-source"
                label={d.vSource}
                required
                error={errors.source}
                wide
              >
                <IconControl icon={FileText}>
                  <select
                    id="adv-source"
                    className="select"
                    required
                    aria-invalid={errors.source ? true : undefined}
                    value={source}
                    onChange={(e) => {
                      setSource(e.target.value);
                      setErrors((x) => ({ ...x, source: undefined }));
                    }}
                  >
                    <option value="">{d.vSourcePick}</option>
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {d.sources[s]}
                      </option>
                    ))}
                  </select>
                </IconControl>
              </Field>
            </div>

            <ValuePreview
              p={p}
              isError={preview.isError}
              error={preview.error}
              isFetching={preview.isFetching}
              unit={unit}
            />

            <details
              className="ad-more"
              open={cur.currency !== "IDR" || undefined}
            >
              <summary>
                <span>
                  <strong>{d.vMore}</strong>
                  <small>{d.vMoreHint}</small>
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="ivx-grid">
                <CurrencyFields
                  idBase="adv"
                  state={cur}
                  currencyLabel={d.vCurrency}
                  rateLabel={d.vFxRate}
                  rateHint={d.vFxHint}
                />
                <Field id="adv-ref" label={d.vReference}>
                  <input
                    id="adv-ref"
                    className="input"
                    maxLength={500}
                    autoComplete="off"
                    enterKeyHint="next"
                    placeholder={d.vReferencePh}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </Field>
                <Field
                  id="adv-proof"
                  label={d.vProof}
                  hint={d.vProofHint}
                  error={proofError}
                  wide
                >
                  <input
                    id="adv-proof"
                    className="input ad-file"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    aria-describedby="adv-proof-hint"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file && file.size > PROOF_LIMIT) {
                        setProofError(d.vProofTooBig);
                        setProof(null);
                        e.target.value = "";
                        return;
                      }
                      setProofError("");
                      setProof(file);
                    }}
                  />
                </Field>
                <Field id="adv-note" label={d.vNote} wide>
                  <textarea
                    id="adv-note"
                    className="textarea"
                    rows={2}
                    maxLength={1000}
                    placeholder={d.vNotePh}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </div>
            </details>
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
            <button className="btn btn--primary ivx-save" disabled={busy}>
              {busy ? d.vSaving : d.vSave}
            </button>
          </footer>
        </form>
      </PanelContent>
    </Dialog>
  );
}
