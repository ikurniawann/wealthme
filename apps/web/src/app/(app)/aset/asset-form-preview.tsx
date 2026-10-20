"use client";

import { Calculator, Eye } from "lucide-react";
import type { AssetValuationModel } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fillCopy, fmtDate, fmtPct } from "./aset-model";

/**
 * Pratinjau for the add/edit drawer. Every figure is read from what the form
 * submits: `digits` is the same `moneyDigits(valueField)` the POST/PATCH
 * body sends as `currentValue`, `qty` the same opening quantity. The only
 * arithmetic is presentational (value ÷ quantity for the per-unit line and
 * after − before on edit), mirroring how the API derives the opening price.
 */
export function AssetFormPreview({
  digits,
  isFx,
  model,
  qty,
  unit,
  initialValue,
  acquisitionDate,
  projected,
}: {
  digits: string;
  isFx: boolean;
  model: AssetValuationModel;
  /** Valid opening quantity (create, per-unit), else null. */
  qty: string | null;
  unit: string;
  /** Edit: the stored value in IDR digits; null on create. */
  initialValue: string | null;
  acquisitionDate: string;
  projected: number | null;
}) {
  const { t, locale } = useLocale();
  const f = t.aset.v3.form;
  const p = f.preview;
  const money = useMoney();
  const value = digits ? BigInt(digits) : null;
  const approx = isFx ? `${p.approx} ` : "";
  const unitLabel = unit.trim() || "unit";
  const qtyText = qty
    ? `${new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID", {
        maximumFractionDigits: 8,
      }).format(Number(qty))} ${unitLabel}`
    : null;
  const price =
    value !== null && qty && Number(qty) > 0
      ? BigInt(Math.round(Number(value) / Number(qty)))
      : null;
  const editing = initialValue !== null;
  const before = editing ? BigInt(initialValue) : null;
  const delta = before !== null && value !== null ? value - before : null;
  const deltaPct =
    delta !== null && before !== null && before > BigInt(0)
      ? (Number(delta) / Number(before)) * 100
      : null;
  const tone =
    delta === null || delta === BigInt(0) ? "flat" : delta > 0 ? "up" : "down";
  const sign = tone === "up" ? "+" : tone === "down" ? "−" : "";
  const abs = delta !== null && delta < 0 ? -delta : delta;
  const effective =
    !editing && model === "per_unit" && acquisitionDate
      ? fmtDate(acquisitionDate, locale)
      : p.today;

  return (
    <section
      className="as4f-preview"
      aria-live="polite"
      aria-labelledby="as4f-prev"
    >
      <h3 id="as4f-prev" className="as4f-preview-title">
        <Eye aria-hidden="true" />
        {p.title}
      </h3>
      {value === null ? (
        <p className="as4f-preview-idle">{p.idle}</p>
      ) : (
        <>
          <dl className="as4f-preview-list">
            {qtyText && price !== null && (
              <div>
                <dt>{fillCopy(p.perUnit, { unit: unitLabel })}</dt>
                <dd>
                  {approx}
                  {money.formatExact(price)}
                </dd>
              </div>
            )}
            <div className="as4f-preview-key">
              <dt>
                {p.recorded}
                {qtyText && price !== null && (
                  <small>
                    {qtyText} × {money.formatExact(price)}
                  </small>
                )}
              </dt>
              <dd>
                {approx}
                {money.formatExact(value)}
              </dd>
            </div>
          </dl>
          <dl className="as4f-preview-list as4f-preview-sub">
            {editing ? (
              <>
                <div>
                  <dt>{p.before}</dt>
                  <dd>{money.formatExact(before)}</dd>
                </div>
                <div>
                  <dt>{p.change}</dt>
                  <dd data-tone={tone}>
                    {sign}
                    {money.formatExact(abs)}
                    {deltaPct !== null && tone !== "flat" && (
                      <span className="as4f-pill" data-tone={tone}>
                        {sign}
                        {fmtPct(Math.abs(deltaPct), locale)}
                      </span>
                    )}
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>{p.cost}</dt>
                  <dd>
                    {model === "per_unit" && qty ? (
                      <>
                        {approx}
                        {money.formatExact(value)}
                        <small>{p.costSame}</small>
                      </>
                    ) : (
                      <span className="as4f-muted">{p.costNone}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{p.gain}</dt>
                  <dd>
                    {model === "per_unit" && qty ? (
                      <>
                        {money.formatExact(BigInt(0))}
                        <span className="as4f-pill" data-tone="flat">
                          {fmtPct(0, locale)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </>
            )}
            <div>
              <dt>{p.effective}</dt>
              <dd>{effective}</dd>
            </div>
            <div>
              <dt>{p.source}</dt>
              <dd>{p.manual}</dd>
            </div>
          </dl>
          {editing && delta === BigInt(0) && (
            <p className="as4f-preview-note">{p.unchanged}</p>
          )}
          {isFx && <p className="as4f-preview-note">{p.fx}</p>}
        </>
      )}
      {projected !== null && (
        <p className="as4f-projection">
          <Calculator aria-hidden="true" />
          <span>
            {t.aset.projectionLabel} 5 th:{" "}
            <strong className="mono">{money.format(projected)}</strong>
          </span>
        </p>
      )}
    </section>
  );
}
