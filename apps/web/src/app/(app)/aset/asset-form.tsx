"use client";

import { useState } from "react";
import { Calculator, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
  type AssetDto,
  type AssetTypeId,
  type AssetValuationModel,
  type AssetValueChangeMode,
  type FxInput,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { uploadAssetDocument } from "@/lib/asset-attachments";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import {
  Dialog,
  DialogClose,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { DateField, PillButton } from "@/components/wm";
import {
  ChangeFields,
  ModelField,
  QuantityField,
  TextField,
} from "./asset-form-fields";
import {
  MoneyInput,
  anyMoneyPending,
  moneyDigits,
  useMoneyField,
  withFxInputs,
} from "@/components/money";

const ASSET_TYPES = [
  "properti",
  "kendaraan",
  "elektronik",
  "perhiasan",
  "emas",
  "lainnya",
] as const satisfies readonly AssetTypeId[];

/** Today (yyyy-mm-dd) in WIB (UTC+7, no DST) — a browser-UTC date would block "today" for 7h. */
function wibToday(): string {
  return new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
}

/** Quantity: positive decimal, at most 8 places (mirrors the API). */
const QTY_RE = /^\d+(\.\d{1,8})?$/;

interface AssetBody {
  name: string;
  type: string;
  currentValue?: string;
  notes?: string;
  valueChangeRatePct?: string;
  valueChangeMode?: AssetValueChangeMode;
  valueChangeAmount?: string;
  categoryId?: string;
  acquisitionDate?: string;
  unit?: string | null;
  valuationModel?: AssetValuationModel;
  quantity?: string;
  internalCode?: string | null;
  custodian?: string | null;
  fxInputs?: FxInput[];
}

/**
 * Add / edit a physical asset (POST / PATCH /assets). Moved from the old
 * page unchanged in behaviour, plus the Task 16–18 identity fields (unit,
 * valuation model, internal code, custodian). Edit sends `currentValue` only
 * when it changed: an unchanged value must not write a new valuation row.
 */
export function AssetFormDialog({
  familyGroupId,
  editing,
  onClose,
}: {
  familyGroupId: string;
  editing: AssetDto | null;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.aset.v3;
  const money = useMoney();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<AssetTypeId>(
    (editing?.type as AssetTypeId) ?? "properti",
  );
  const initialValue = editing ? BigInt(editing.currentValue).toString() : "";
  const valueField = useMoneyField({
    initialRaw: initialValue,
    isEdit: !!editing,
  });
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [rate, setRate] = useState(editing?.valueChangeRatePct ?? "");
  const [mode, setMode] = useState<AssetValueChangeMode>(
    editing?.valueChangeMode ?? "percent",
  );
  const changeField = useMoneyField({
    initialRaw: editing?.valueChangeAmount
      ? BigInt(editing.valueChangeAmount).toString()
      : "",
    isEdit: !!editing,
    allowNegative: true,
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [acquisitionDate, setAcquisitionDate] = useState(
    editing?.acquisitionDate ? editing.acquisitionDate.slice(0, 10) : "",
  );
  const [unit, setUnit] = useState(editing?.unit ?? "");
  const [model, setModel] = useState<AssetValuationModel>(
    editing?.valuationModel ?? "total",
  );
  const [quantity, setQuantity] = useState("");
  const [qtyError, setQtyError] = useState<string | null>(null);
  const needsQty = !editing && model === "per_unit";
  const [code, setCode] = useState(editing?.internalCode ?? "");
  const [custodian, setCustodian] = useState(editing?.custodian ?? "");

  const mutation = useMutation({
    mutationFn: (body: AssetBody) => {
      if (!token) return Promise.reject(new Error("Not authenticated"));
      const base = `/family-groups/${familyGroupId}/assets`;
      return apiFetch<AssetDto>(editing ? `${base}/${editing.id}` : base, {
        method: editing ? "PATCH" : "POST",
        token,
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (saved) => {
      if (docFile) {
        try {
          await uploadAssetDocument(familyGroupId, saved.id, docFile, token);
        } catch {
          toast.error(t.aset.toastDocumentFailed);
        }
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assets.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      });
      toast.success(editing ? t.aset.toastUpdated : t.aset.toastAdded);
      onClose();
    },
    onError: (err) => {
      if ((err as { code?: unknown }).code === "ASSET_QUANTITY_INVALID") {
        setQtyError(apiErrorMessage(err, c.formQtyInvalid));
        return;
      }
      const fallback = editing
        ? t.aset.toastUpdateFailed
        : t.aset.toastAddFailed;
      toast.error(apiErrorMessage(err, fallback));
    },
  });

  // Same linear approximation as the API's compute-on-read estimate.
  const projected = (() => {
    const digits = moneyDigits(valueField);
    if (!digits) return null;
    const base = parseInt(digits, 10);
    if (mode === "percent") {
      const r = parseFloat(rate);
      if (!Number.isFinite(r) || r === 0) return null;
      return Math.max(Math.round(base * (1 + (r / 100) * 5)), 0);
    }
    const amount = parseInt(moneyDigits(changeField) || "0", 10);
    if (!Number.isFinite(amount) || amount === 0) return null;
    return Math.max(Math.round(base + amount * 5), 0);
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (anyMoneyPending(valueField, changeField)) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const digits = moneyDigits(valueField);
    if (!name.trim() || !digits) return;
    const qty = quantity.trim().replace(",", ".");
    if (needsQty) {
      const err = !qty
        ? c.formQtyRequired
        : !QTY_RE.test(qty) || Number(qty) <= 0
          ? c.formQtyInvalid
          : null;
      setQtyError(err);
      if (err) return;
    }
    const amountDigits = moneyDigits(changeField);
    const valueChanged = !editing || digits !== initialValue;
    const opt = (v: string) =>
      v.trim() ? v.trim() : editing ? null : undefined;
    mutation.mutate(
      withFxInputs(
        {
          name: name.trim(),
          type,
          ...(valueChanged ? { currentValue: digits } : {}),
          notes: notes.trim() || undefined,
          valueChangeMode: mode,
          valueChangeRatePct:
            mode === "percent" ? rate.trim() || undefined : undefined,
          valueChangeAmount:
            mode === "fixed" && amountDigits && amountDigits !== "-"
              ? amountDigits
              : undefined,
          categoryId: editing?.categoryId || undefined,
          acquisitionDate: acquisitionDate || undefined,
          unit: opt(unit),
          valuationModel: model,
          ...(needsQty ? { quantity: qty } : {}),
          internalCode: opt(code),
          custodian: opt(custodian),
        },
        [
          ...(valueChanged ? ([["currentValue", valueField]] as const) : []),
          ...(mode === "fixed"
            ? ([["valueChangeAmount", changeField]] as const)
            : []),
        ],
      ),
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {editing ? t.aset.modalTitleEdit : t.aset.modalTitle}
            </DialogTitle>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          onSubmit={handleSubmit}
          id="asset-form"
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="wm-panel-body wm-form">
            <div className="wm-form__grid">
              <div className="field mt-0">
                <label className="label" htmlFor="asset-name">
                  {t.aset.fieldNameLabel}
                </label>
                <input
                  id="asset-name"
                  className="input"
                  placeholder={t.aset.fieldNamePlaceholder}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  enterKeyHint="next"
                  required
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="asset-type">
                  {t.aset.fieldCategoryLabel}
                </label>
                <select
                  id="asset-type"
                  className="select"
                  value={type}
                  onChange={(e) => {
                    const next = e.target.value as AssetTypeId;
                    setType(next);
                    if (!rate.trim())
                      setRate(
                        String(DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT[next]),
                      );
                  }}
                >
                  {ASSET_TYPES.map((id) => (
                    <option key={id} value={id}>
                      {t.aset.assetTypeLabels[id]}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                id="asset-code"
                label={c.formCode}
                placeholder={c.formCodePh}
                maxLength={64}
                value={code}
                onChange={setCode}
              />
              <TextField
                id="asset-custodian"
                label={c.formCustodian}
                placeholder={c.formCustodianPh}
                maxLength={200}
                value={custodian}
                onChange={setCustodian}
              />
              <div className="field">
                <label className="label" htmlFor="asset-value">
                  {t.aset.fieldValueLabel}
                </label>
                <MoneyInput
                  field={valueField}
                  id="asset-value"
                  placeholder={t.aset.fieldValuePlaceholder}
                />
              </div>
              <ModelField value={model} onChange={setModel} />
              {needsQty && (
                <QuantityField
                  value={quantity}
                  unit={unit}
                  error={qtyError}
                  onChange={(v) => {
                    setQuantity(v);
                    if (qtyError) setQtyError(null);
                  }}
                />
              )}
              <TextField
                id="asset-unit"
                label={c.formUnit}
                placeholder={c.formUnitPh}
                maxLength={64}
                value={unit}
                onChange={setUnit}
              />
              <ChangeFields
                type={type}
                mode={mode}
                onMode={setMode}
                rate={rate}
                onRate={setRate}
                changeField={changeField}
              />
              <div className="field">
                <label className="label" htmlFor="asset-acquisition-date">
                  {t.aset.fieldAcquisitionDateLabel}
                </label>
                <DateField
                  id="asset-acquisition-date"
                  value={acquisitionDate}
                  locale={locale}
                  label={t.aset.fieldAcquisitionDateLabel}
                  max={wibToday()}
                  onChange={setAcquisitionDate}
                />
                <span className="hint">
                  {t.aset.fieldAcquisitionDateHelper}
                </span>
              </div>
              <TextField
                id="asset-notes"
                label={t.aset.fieldNotesLabel}
                placeholder={t.aset.fieldNotesPlaceholder}
                maxLength={500}
                value={notes}
                onChange={setNotes}
              />
              {projected !== null && (
                <div className="mt-3.5 flex items-center gap-2.5 rounded-[11px] border border-primary/25 bg-accent p-3 text-[12.5px] text-accent-foreground">
                  <Calculator className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t.aset.projectionLabel} 5 th:{" "}
                    <strong className="wm-money mono">
                      {money.format(projected)}
                    </strong>
                  </span>
                </div>
              )}
              <div className="field">
                <label className="label" htmlFor="asset-document">
                  {t.aset.fieldDocumentLabel}
                </label>
                <input
                  id="asset-document"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  className="input file:mr-3 file:h-full file:border-0 file:border-r file:bg-transparent file:px-3 file:text-[12.5px] file:font-semibold file:text-foreground"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </div>
          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onClose}>
              {t.common.cancel}
            </PillButton>
            <PillButton
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? t.aset.saving : t.aset.saveButton}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}
