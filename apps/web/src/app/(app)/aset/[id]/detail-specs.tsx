"use client";

import type { AssetDto, AssetTypeId } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { DETAIL_SPECS } from "../asset-form-category";
import { fmtDay } from "./detail-model";

/**
 * Aset fields (2026-10-20) — "Spesifikasi": the asset's structured specs
 * (`details`) in the category's field order. Nothing recorded → no card;
 * older assets keep their specs in Catatan (no data rewrite).
 */
export function SpecsCard({ asset }: { asset: AssetDto }) {
  const { t, locale } = useLocale();
  const f = t.aset.v3.form;
  const details = asset.details;
  if (!details) return null;
  const specs = DETAIL_SPECS[asset.type as AssetTypeId] ?? [];
  const certificates = f.detail.certificates as Record<string, string>;
  const rows = [
    ...specs.map((s) => s.key),
    ...(details.address ? (["address"] as const) : []),
  ]
    .filter((key) => !!details[key])
    .map((key) => {
      const raw = details[key]!;
      const value =
        key === "certificateType"
          ? (certificates[raw] ?? raw)
          : key === "warrantyUntil"
            ? fmtDay(raw, locale)
            : key === "landAreaM2" || key === "buildingAreaM2"
              ? `${new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID", {
                  maximumFractionDigits: 2,
                }).format(Number(raw))} m²`
              : raw;
      return { key, label: f.detail[key], value };
    });
  if (!rows.length) return null;
  return (
    <section className="ad-card ad-specs" aria-labelledby="ad-specs-title">
      <h2 id="ad-specs-title">{f.specsTitle}</h2>
      <dl className="ad-specs-list">
        {rows.map((r) => (
          <div key={r.key}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
