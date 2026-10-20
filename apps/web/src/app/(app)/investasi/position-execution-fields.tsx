"use client";
import { canonicalToTyping, formatMoneyTyping } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import { Field, MoneyInput, TIME_ZONES, today } from "./investment-fields";
import { positionNumbers } from "./position-state";
import { divide } from "./decimal";
import type { PositionState } from "./position-state";
import { tradeCopy } from "./trade-copy";

/** Unit word for a position's base quantity ("lembar", "shares", "gram"…). */
export function baseUnitLabel(
  s: PositionState,
  c: { lembar: string; shares: string; units: string; gram: string },
) {
  if (s.market === "IDX") return c.lembar;
  if (s.type === "saham") return c.shares;
  if (s.type === "emas") return s.details.unit || c.gram;
  if (s.type === "lainnya") return s.details.unit || c.units;
  return c.units;
}

/** Base quantity in canonical form, or null while the input is partial. */
export function baseQuantity(s: PositionState): string | null {
  try {
    return positionNumbers(s).quantity;
  } catch {
    return null;
  }
}

/**
 * Quantity, price, costs, FX, date and time of one execution. Layout-neutral
 * `Field`s: the drawer lays them out as a two-column grid, the buy/sell
 * dialog as label-left rows.
 */
export function PositionExecutionFields({
  value: s,
  onChange: set,
  quantityLabel,
  quantityHint,
}: {
  value: PositionState;
  onChange: (value: PositionState) => void;
  quantityLabel?: string;
  quantityHint?: string;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const copy = tradeCopy(locale);
  const unknown = s.mode === "opening" && !s.knownCost;
  const percent =
    s.type === "obligasi" && s.details.priceConvention === "percent_of_par";
  const base = baseQuantity(s);
  const unitWord = baseUnitLabel(s, c);
  const numberFmt = new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    maximumFractionDigits: 8,
  });
  const priceSuffix = percent
    ? undefined
    : s.type === "deposito"
      ? undefined
      : s.market === "IDX"
        ? copy.perLembar
        : s.type === "saham"
          ? copy.perShare
          : s.type === "emas"
            ? `/${s.details.unit || c.gram}`
            : copy.perUnit;
  const equalsHint =
    s.market === "IDX" && s.unit === "lot" && base && s.quantity
      ? `${copy.equals(numberFmt.format(Number(base)), c.lembar)} · ${copy.lotRule}`
      : s.market === "IDX"
        ? copy.lotRule
        : undefined;
  const hint = [equalsHint, quantityHint].filter(Boolean).join(" · ");
  return (
    <>
      {s.mode === "opening" && (
        <label className="ivx-check" data-wide>
          <input
            type="checkbox"
            checked={!s.knownCost}
            onChange={(e) =>
              set({
                ...s,
                knownCost: !e.target.checked,
                price: "",
                fee: "0",
                tax: "0",
                fx: "",
              })
            }
          />
          <span>{f.unknownCost}</span>
        </label>
      )}
      {s.type !== "deposito" && (
        <Field
          label={
            percent
              ? f.principal
              : (quantityLabel ?? `${f.quantity} · ${unitWord}`)
          }
          required
          hint={hint || undefined}
        >
          {(id) => (
            <div className="ivx-qty">
              <input
                id={id}
                className="input mono"
                enterKeyHint="next"
                required
                inputMode="decimal"
                autoComplete="off"
                value={s.quantity}
                onChange={(e) =>
                  set({
                    ...s,
                    quantity: formatMoneyTyping(e.target.value, 8, false),
                  })
                }
              />
              {s.market === "IDX" ? (
                <select
                  className="select"
                  aria-label={f.unit}
                  value={s.unit}
                  onChange={(e) => {
                    const unit = e.target.value as "lot" | "base";
                    const q = baseQuantity(s);
                    set({
                      ...s,
                      unit,
                      quantity:
                        s.quantity && q
                          ? canonicalToTyping(
                              unit === "lot" ? divide(q, "100") : q,
                              8,
                            )
                          : "",
                    });
                  }}
                >
                  <option value="lot">{c.lot}</option>
                  <option value="base">{c.lembar}</option>
                </select>
              ) : (
                !percent && (
                  <span className="ivx-unit" aria-hidden="true">
                    {unitWord}
                  </span>
                )
              )}
            </div>
          )}
        </Field>
      )}
      {!unknown && (
        <Field
          label={s.type === "deposito" ? f.principal : f.executionPrice}
          required
        >
          {(id) => (
            <MoneyInput
              id={id}
              currency={percent ? "%" : s.currency}
              decimals={8}
              required
              value={s.price}
              suffix={priceSuffix}
              onChange={(price) => set({ ...s, price })}
            />
          )}
        </Field>
      )}
      <Field label={f.date} required>
        {(id) => (
          <input
            id={id}
            className="input"
            enterKeyHint="next"
            type="date"
            required
            max={today()}
            value={s.date}
            onChange={(e) => set({ ...s, date: e.target.value })}
          />
        )}
      </Field>
      <Field label={f.time} hint={s.time ? undefined : f.dateOnly}>
        {(id) => (
          <div className="ivx-time">
            <input
              id={id}
              className="input"
              enterKeyHint="next"
              type="time"
              value={s.time}
              onChange={(e) => set({ ...s, time: e.target.value })}
            />
            {s.time && (
              <select
                className="select"
                aria-label={f.zone}
                value={s.timeZone}
                onChange={(e) => set({ ...s, timeZone: e.target.value })}
              >
                {(TIME_ZONES as readonly string[]).includes(
                  s.timeZone,
                ) ? null : (
                  <option value={s.timeZone}>{s.timeZone}</option>
                )}
                {TIME_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </Field>
      {!unknown && (
        <>
          <Field label={f.fee}>
            {(id) => (
              <MoneyInput
                id={id}
                currency={s.currency}
                value={s.fee}
                onChange={(fee) => set({ ...s, fee })}
              />
            )}
          </Field>
          <Field label={f.tax}>
            {(id) => (
              <MoneyInput
                id={id}
                currency={s.currency}
                value={s.tax}
                onChange={(tax) => set({ ...s, tax })}
              />
            )}
          </Field>
        </>
      )}
      {s.currency !== "IDR" && !unknown && (
        <Field label={f.actualRate} required>
          {(id) => (
            <MoneyInput
              id={id}
              currency="IDR"
              required
              decimals={6}
              value={s.fx}
              suffix={`/ 1 ${s.currency}`}
              onChange={(fx) => set({ ...s, fx })}
            />
          )}
        </Field>
      )}
    </>
  );
}
