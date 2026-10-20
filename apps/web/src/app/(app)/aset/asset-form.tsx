"use client";

import { useState } from "react";
import { CalendarDays, Coins, Tag, X } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
  type AssetDto,
  type AssetTypeId,
  type AssetValuationModel,
  type AssetValueChangeMode,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/wm";
import {
  anyMoneyPending,
  moneyDigits,
  useMoneyField,
  withFxInputs,
} from "@/components/money";
import { ModelField } from "./asset-form-fields";
import {
  CategoryChip,
  CategoryGrid,
  composeDetails,
  type DetailValues,
} from "./asset-form-category";
import {
  AcquisitionSection,
  FormSection,
  IdentityFields,
  QtyUnitPair,
} from "./asset-form-sections";
import { AssetValueField } from "./asset-form-value";
import { AssetFormPreview } from "./asset-form-preview";
import { projectFiveYears, useAssetSave } from "./use-asset-save";
import "./asset-form.css";
import "./asset-form-parts.css";

/** Quantity: positive decimal, at most 8 places (mirrors the API). */
const QTY_RE = /^\d+(\.\d{1,8})?$/;
const NOTES_MAX = 500;

/**
 * Add / edit a physical asset (POST / PATCH /assets). Category first (step
 * 1 tile grid), then grouped sections and a live Pratinjau. Edit sends
 * `currentValue` only when it changed: an unchanged value must not write a
 * new valuation row. Category specifications have no field in the asset
 * contract, so on create they are prepended to `notes`.
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
  const { t } = useLocale();
  const c = t.aset.v3;
  const f = c.form;
  const [step, setStep] = useState<"category" | "form">(
    editing ? "form" : "category",
  );
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
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
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
  const [details, setDetails] = useState<DetailValues>({});
  const [goldPrefill, setGoldPrefill] = useState(false);

  const mutation = useAssetSave({
    familyGroupId,
    editing,
    docFile,
    onClose,
    onQtyError: setQtyError,
  });
  const projected = projectFiveYears(
    moneyDigits(valueField),
    mode,
    rate,
    moneyDigits(changeField),
  );

  /** Step 1 → 2. Emas is weighed in grams: prefill the per-unit model once. */
  function pickType(next: AssetTypeId) {
    setType(next);
    if (!rate.trim())
      setRate(String(DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT[next]));
    if (!editing) {
      if (next === "emas" && !unit.trim()) {
        setUnit("gram");
        setModel("per_unit");
        setGoldPrefill(true);
      } else if (next !== "emas" && goldPrefill) {
        setUnit("");
        setModel("total");
        setGoldPrefill(false);
      }
      setDetails({});
    }
    setStep("form");
  }

  const qtyClean = quantity.trim().replace(",", ".");
  const qtyValid =
    needsQty && QTY_RE.test(qtyClean) && Number(qtyClean) > 0 ? qtyClean : null;
  const specText = editing ? "" : composeDetails(type, details, f.detail);
  const finalNotes = [specText, notes.trim()].filter(Boolean).join("\n\n");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== "form") return;
    if (anyMoneyPending(valueField, changeField)) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const digits = moneyDigits(valueField);
    if (!name.trim() || !digits) return;
    if (needsQty) {
      const err = !qtyClean
        ? c.formQtyRequired
        : !qtyValid
          ? c.formQtyInvalid
          : null;
      setQtyError(err);
      if (err) return;
    }
    if (finalNotes.length > NOTES_MAX) {
      setNotesError(f.notesTooLong);
      setNotesOpen(true);
      return;
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
          notes: finalNotes || undefined,
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
          ...(needsQty ? { quantity: qtyClean } : {}),
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

  const perUnit = model === "per_unit";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <PanelContent variant="side" className="wm-form-panel as4f-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {editing ? t.aset.modalTitleEdit : t.aset.modalTitle}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {editing ? f.subtitleEdit : f.subtitleAdd}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          onSubmit={handleSubmit}
          id="asset-form"
          className="flex min-h-0 flex-1 flex-col"
          data-step={step}
        >
          <div className="wm-panel-body wm-form as4f-body">
            {step === "category" ? (
              <CategoryGrid value={editing ? type : null} onPick={pickType} />
            ) : (
              <>
                <CategoryChip
                  type={type}
                  onChange={() => setStep("category")}
                />
                <div className="as4f-cols">
                  <div className="as4f-col">
                    <FormSection
                      icon={Tag}
                      title={f.secIdentity}
                      hint={f.secIdentityHint}
                    >
                      <IdentityFields
                        type={type}
                        name={name}
                        onName={setName}
                        custodian={custodian}
                        onCustodian={setCustodian}
                      />
                    </FormSection>
                    <FormSection
                      icon={Coins}
                      title={f.secValue}
                      hint={f.secValueHint}
                    >
                      <ModelField value={model} onChange={setModel} />
                      {perUnit && (
                        <QtyUnitPair
                          showQty={needsQty}
                          qtyLabel={type === "emas" ? f.weight : c.formQty}
                          quantity={quantity}
                          unit={unit}
                          qtyError={qtyError}
                          onQuantity={(v) => {
                            setQuantity(v);
                            if (qtyError) setQtyError(null);
                          }}
                          onUnit={setUnit}
                        />
                      )}
                      <AssetValueField
                        field={valueField}
                        isEdit={!!editing}
                        perUnit={perUnit}
                        qty={qtyValid}
                        unit={unit}
                      />
                    </FormSection>
                  </div>
                  <div className="as4f-col">
                    <AssetFormPreview
                      digits={moneyDigits(valueField)}
                      isFx={valueField.currency !== "IDR"}
                      model={model}
                      qty={qtyValid}
                      unit={unit}
                      initialValue={editing ? initialValue : null}
                      acquisitionDate={acquisitionDate}
                      projected={projected}
                    />
                    <FormSection
                      icon={CalendarDays}
                      title={f.secAcquisition}
                      hint={f.secAcquisitionHint}
                    >
                      <AcquisitionSection
                        type={type}
                        isEdit={!!editing}
                        perUnit={perUnit}
                        acquisitionDate={acquisitionDate}
                        onAcquisitionDate={setAcquisitionDate}
                        details={details}
                        onDetail={(k, v) =>
                          setDetails((d) => ({ ...d, [k]: v }))
                        }
                        code={code}
                        onCode={setCode}
                        unit={unit}
                        onUnit={setUnit}
                        mode={mode}
                        onMode={setMode}
                        rate={rate}
                        onRate={setRate}
                        changeField={changeField}
                        notes={notes}
                        onNotes={(v) => {
                          setNotes(v);
                          if (notesError) setNotesError(null);
                        }}
                        notesMax={
                          NOTES_MAX - (specText ? specText.length + 2 : 0)
                        }
                        notesError={notesError}
                        notesOpen={notesOpen}
                        onNotesOpen={setNotesOpen}
                        onDocFile={setDocFile}
                      />
                    </FormSection>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="wm-panel-foot as4f-foot">
            <PillButton type="button" onClick={onClose}>
              {t.common.cancel}
            </PillButton>
            {step === "form" && (
              <PillButton
                type="submit"
                variant="primary"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? t.aset.saving : t.aset.saveButton}
              </PillButton>
            )}
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}
