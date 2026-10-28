"use client";

import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { AssetTypeId, AssetValueChangeMode } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { DateField } from "@/components/wm";
import type { useMoneyField } from "@/components/money";
import { ChangeFields, TextField } from "./asset-form-fields";
import { DetailFields, type DetailValues } from "./asset-form-category";

/** Today (yyyy-mm-dd) in WIB (UTC+7, no DST) — a browser-UTC date would block "today" for 7h. */
function wibToday(): string {
  return new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
}

/** Visual "required" mark; the control itself carries `required`. */
export function Req() {
  return (
    <span className="as4f-req" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

export function FormSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="as4f-sec">
      <header className="as4f-sec-head">
        <span className="as4f-sec-ic" aria-hidden="true">
          <Icon />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function IdentityFields({
  type,
  name,
  onName,
  custodian,
  onCustodian,
}: {
  type: AssetTypeId;
  name: string;
  onName: (v: string) => void;
  custodian: string;
  onCustodian: (v: string) => void;
}) {
  const { t } = useLocale();
  const c = t.aset.v3;
  const f = c.form;
  const property = type === "properti";
  return (
    <>
      <div className="field">
        <label className="label" htmlFor="asset-name">
          {t.aset.fieldNameLabel}
          <Req />
        </label>
        <input
          id="asset-name"
          className="input"
          placeholder={f.namePh[type]}
          maxLength={100}
          value={name}
          onChange={(e) => onName(e.target.value)}
          autoComplete="off"
          enterKeyHint="next"
          required
        />
      </div>
      <TextField
        id="asset-custodian"
        label={property ? f.address : c.formCustodian}
        placeholder={property ? f.addressPh : c.formCustodianPh}
        maxLength={200}
        value={custodian}
        onChange={onCustodian}
      />
    </>
  );
}

/** Per-unit: starting quantity (create only, required) beside its unit. */
export function QtyUnitPair({
  showQty,
  qtyLabel,
  quantity,
  unit,
  qtyError,
  onQuantity,
  onUnit,
  unitOptions,
}: {
  /** Fixed choices instead of free text (gold: gram | kg). */
  unitOptions?: readonly string[];
  showQty: boolean;
  qtyLabel: string;
  quantity: string;
  unit: string;
  qtyError: string | null;
  onQuantity: (v: string) => void;
  onUnit: (v: string) => void;
}) {
  const { t } = useLocale();
  const c = t.aset.v3;
  return (
    <div className="as4f-pair">
      {showQty && (
        <div className="field">
          <label className="label" htmlFor="asset-quantity">
            {qtyLabel}
            {unit.trim() ? ` (${unit.trim()})` : ""}
            <Req />
          </label>
          <input
            id="asset-quantity"
            className="input"
            inputMode="decimal"
            placeholder={c.formQtyPh}
            maxLength={40}
            value={quantity}
            onChange={(e) => onQuantity(e.target.value)}
            autoComplete="off"
            enterKeyHint="next"
            aria-required="true"
            aria-invalid={qtyError ? true : undefined}
            aria-describedby={qtyError ? "asset-quantity-error" : undefined}
          />
          {qtyError && (
            <p id="asset-quantity-error" className="error-text" role="alert">
              {qtyError}
            </p>
          )}
        </div>
      )}
      {unitOptions ? (
        <div className="field">
          <label className="label" htmlFor="asset-unit">
            {c.formUnit}
          </label>
          <select
            id="asset-unit"
            className="select"
            value={unitOptions.includes(unit) ? unit : unitOptions[0]}
            onChange={(e) => onUnit(e.target.value)}
          >
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <TextField
          id="asset-unit"
          label={c.formUnit}
          placeholder={c.formUnitPh}
          maxLength={64}
          value={unit}
          onChange={onUnit}
        />
      )}
    </div>
  );
}

function Fold({
  title,
  hint,
  open,
  onOpen,
  children,
}: {
  title: string;
  hint: string;
  open?: boolean;
  onOpen?: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="as4f-fold"
      open={open}
      onToggle={(e) => onOpen?.(e.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{hint}</small>
        </span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="as4f-fold-body">{children}</div>
    </details>
  );
}

export function AcquisitionSection(props: {
  type: AssetTypeId;
  isEdit: boolean;
  perUnit: boolean;
  acquisitionDate: string;
  onAcquisitionDate: (v: string) => void;
  details: DetailValues;
  onDetail: (k: keyof DetailValues, v: string) => void;
  code: string;
  onCode: (v: string) => void;
  unit: string;
  onUnit: (v: string) => void;
  mode: AssetValueChangeMode;
  onMode: (m: AssetValueChangeMode) => void;
  rate: string;
  onRate: (v: string) => void;
  changeField: ReturnType<typeof useMoneyField>;
  notes: string;
  onNotes: (v: string) => void;
  notesMax: number;
  notesError: string | null;
  notesOpen: boolean;
  onNotesOpen: (v: boolean) => void;
  onDocFile: (f: File | null) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.aset.v3;
  const f = c.form;
  return (
    <>
      <div className="field">
        <label className="label" htmlFor="asset-acquisition-date">
          {t.aset.fieldAcquisitionDateLabel}
        </label>
        <DateField
          id="asset-acquisition-date"
          value={props.acquisitionDate}
          locale={locale}
          label={t.aset.fieldAcquisitionDateLabel}
          max={wibToday()}
          onChange={props.onAcquisitionDate}
        />
        <span className="hint">{t.aset.fieldAcquisitionDateHelper}</span>
      </div>
      <Fold title={f.moreDetails} hint={f.moreDetailsHint}>
        <DetailFields
          type={props.type}
          values={props.details}
          onChange={props.onDetail}
        />
        <div className="as4f-pair">
          <TextField
            id="asset-code"
            label={c.formCode}
            placeholder={c.formCodePh}
            maxLength={64}
            value={props.code}
            onChange={props.onCode}
          />
          {!props.perUnit && (
            <TextField
              id="asset-unit"
              label={c.formUnit}
              placeholder={c.formUnitPh}
              maxLength={64}
              value={props.unit}
              onChange={props.onUnit}
            />
          )}
        </div>
        <p className="as4f-sub">{f.projection}</p>
        <ChangeFields
          type={props.type}
          mode={props.mode}
          onMode={props.onMode}
          rate={props.rate}
          onRate={props.onRate}
          changeField={props.changeField}
        />
      </Fold>
      <Fold
        title={f.notesDocs}
        hint={f.notesDocsHint}
        open={props.notesOpen}
        onOpen={props.onNotesOpen}
      >
        <div className="field">
          <label className="label" htmlFor="asset-notes">
            {t.aset.fieldNotesLabel}
          </label>
          <textarea
            id="asset-notes"
            className="textarea"
            rows={3}
            placeholder={t.aset.fieldNotesPlaceholder}
            maxLength={Math.max(props.notesMax, props.notes.length)}
            value={props.notes}
            onChange={(e) => props.onNotes(e.target.value)}
            aria-invalid={props.notesError ? true : undefined}
            aria-describedby={
              props.notesError ? "asset-notes-error" : undefined
            }
          />
          {props.notesError && (
            <p id="asset-notes-error" className="error-text" role="alert">
              {props.notesError}
            </p>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="asset-document">
            {t.aset.fieldDocumentLabel}
          </label>
          <input
            id="asset-document"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="input as4f-file"
            onChange={(e) => props.onDocFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </Fold>
    </>
  );
}
