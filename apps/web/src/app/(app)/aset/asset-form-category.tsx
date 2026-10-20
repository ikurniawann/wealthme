"use client";

import { createElement } from "react";
import type { AssetTypeId } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import type { AsetFormCopy } from "@/i18n/aset-form";
import { rowIcon } from "./aset-model";

export const ASSET_TYPES = [
  "properti",
  "kendaraan",
  "emas",
  "perhiasan",
  "elektronik",
  "lainnya",
] as const satisfies readonly AssetTypeId[];

export const typeIcon = (type: string) =>
  rowIcon({ sourceModule: "assets", subtype: type, class: "aset_fisik" });

/**
 * Step 1 of "Tambah aset": one tile per category the API accepts
 * (Prisma `AssetType`). Picking a tile moves the form to its fields.
 */
export function CategoryGrid({
  value,
  onPick,
}: {
  value: AssetTypeId | null;
  onPick: (type: AssetTypeId) => void;
}) {
  const { t } = useLocale();
  const f = t.aset.v3.form;
  return (
    <section className="as4f-step" aria-labelledby="as4f-step-title">
      <div className="as4f-step-head">
        <h2 id="as4f-step-title">{f.stepTitle}</h2>
        <p>{f.stepHint}</p>
      </div>
      <div
        className="as4f-tiles"
        role="radiogroup"
        aria-labelledby="as4f-step-title"
      >
        {ASSET_TYPES.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className="as4f-tile"
            data-type={id}
            onClick={() => onPick(id)}
          >
            <span className="as4f-tile-ic" aria-hidden="true">
              {createElement(typeIcon(id))}
            </span>
            <span className="as4f-tile-text">
              <strong>{t.aset.assetTypeLabels[id]}</strong>
              <small>{f.typeHints[id]}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The chosen category, with a way back to the tile grid. */
export function CategoryChip({
  type,
  onChange,
}: {
  type: AssetTypeId;
  onChange: () => void;
}) {
  const { t } = useLocale();
  const f = t.aset.v3.form;
  return (
    <div className="as4f-cat">
      <span className="as4f-tile-ic" data-type={type} aria-hidden="true">
        {createElement(typeIcon(type))}
      </span>
      <span className="as4f-cat-text">
        <small>{f.category}</small>
        <strong>{t.aset.assetTypeLabels[type]}</strong>
      </span>
      <button type="button" className="as4f-link" onClick={onChange}>
        {f.change}
        <span className="sr-only"> {f.category.toLowerCase()}</span>
      </button>
    </div>
  );
}

type DetailKey = keyof Omit<
  AsetFormCopy["detail"],
  "choose" | "certificateOther"
>;
interface DetailSpec {
  key: DetailKey;
  input?: "text" | "decimal" | "year" | "date";
  options?: readonly string[];
  placeholder?: string;
}

const CERTIFICATES = ["SHM", "HGB", "SHMSRS", "Girik / AJB"] as const;
const PURITIES = ["24K (999,9)", "23K", "22K", "18K"] as const;

/**
 * Category specifications. The asset contract has no structured home for
 * them (see the fidelity report's "proposed fields"), so on create they are
 * written as the first lines of `notes` — the one free-text field it has.
 */
export const DETAIL_SPECS: Record<AssetTypeId, readonly DetailSpec[]> = {
  properti: [
    { key: "landArea", input: "decimal", placeholder: "500" },
    { key: "buildingArea", input: "decimal", placeholder: "350" },
    { key: "certificate", options: CERTIFICATES },
  ],
  kendaraan: [
    { key: "brandModel", placeholder: "Mercedes-Benz S 450 L" },
    { key: "year", input: "year", placeholder: "2024" },
    { key: "plate", placeholder: "B 1 WM" },
  ],
  emas: [
    { key: "purity", options: PURITIES },
    { key: "issuer", placeholder: "Antam, UBS" },
    { key: "serial" },
  ],
  perhiasan: [
    { key: "material", placeholder: "Emas putih 18K" },
    { key: "stones" },
    { key: "serial" },
  ],
  elektronik: [
    { key: "brandModel", placeholder: "Apple MacBook Pro M3" },
    { key: "serial" },
    { key: "warranty", input: "date" },
  ],
  lainnya: [],
};

export type DetailValues = Partial<Record<DetailKey, string>>;

/** "Label: value" lines for the filled specs, in display order. */
export function composeDetails(
  type: AssetTypeId,
  values: DetailValues,
  labels: AsetFormCopy["detail"],
): string {
  return DETAIL_SPECS[type]
    .map((s) => [labels[s.key], values[s.key]?.trim()] as const)
    .filter(([, v]) => !!v)
    .map(([l, v]) => `${l}: ${v}`)
    .join("\n");
}

export function DetailFields({
  type,
  values,
  onChange,
}: {
  type: AssetTypeId;
  values: DetailValues;
  onChange: (key: DetailKey, value: string) => void;
}) {
  const { t } = useLocale();
  const f = t.aset.v3.form;
  const specs = DETAIL_SPECS[type];
  if (!specs.length) return null;
  return (
    <div className="as4f-pair as4f-pair--3">
      {specs.map((s) => {
        const id = `asset-d-${s.key}`;
        const label = f.detail[s.key];
        const value = values[s.key] ?? "";
        return (
          <div className="field" key={s.key}>
            <label className="label" htmlFor={id}>
              {label}
            </label>
            {s.options ? (
              <select
                id={id}
                className="select"
                value={value}
                onChange={(e) => onChange(s.key, e.target.value)}
              >
                <option value="">{f.detail.choose}</option>
                {s.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                {s.key === "certificate" && (
                  <option value={f.detail.certificateOther}>
                    {f.detail.certificateOther}
                  </option>
                )}
              </select>
            ) : (
              <input
                id={id}
                className="input"
                type={s.input === "date" ? "date" : "text"}
                inputMode={
                  s.input === "decimal"
                    ? "decimal"
                    : s.input === "year"
                      ? "numeric"
                      : undefined
                }
                maxLength={s.input === "year" ? 4 : 80}
                placeholder={s.placeholder}
                autoComplete="off"
                enterKeyHint="next"
                value={value}
                onChange={(e) => onChange(s.key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
