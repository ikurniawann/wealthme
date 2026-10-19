"use client";
import { formatMoneyTyping } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import { AmountInput, today } from "./investment-fields";
import type { PositionState } from "./position-state";
export function PositionExecutionFields({
  value: s,
  onChange: set,
}: {
  value: PositionState;
  onChange: (value: PositionState) => void;
}) {
  const { t } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const unknown = s.mode === "opening" && !s.knownCost;
  return (
    <>
      {s.mode === "opening" && (
        <label className="field">
          <span>
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
            {f.unknownCost}
          </span>
        </label>
      )}
      <div className="iv-field-row">
        {s.type !== "deposito" && (
          <label className="field">
            <span className="label">
              {s.type === "obligasi" &&
              s.details.priceConvention === "percent_of_par"
                ? f.principal
                : `${f.quantity} · ${s.market === "IDX" ? (s.unit === "lot" ? c.lot : c.lembar) : s.type === "saham" ? c.shares : s.type === "emas" ? (s.details.unit ?? c.gram) : c.units}`}{" "}
              *
            </span>
            <input
              className="input"
              required
              inputMode="decimal"
              value={s.quantity}
              onChange={(e) =>
                set({
                  ...s,
                  quantity: formatMoneyTyping(e.target.value, 8, false),
                })
              }
            />
          </label>
        )}
        {s.market === "IDX" && (
          <label className="field">
            <span className="label">{f.unit}</span>
            <select
              className="select"
              value={s.unit}
              onChange={(e) =>
                set({
                  ...s,
                  unit: e.target.value as "lot" | "base",
                  quantity: "",
                })
              }
            >
              <option value="lot">{c.lot}</option>
              <option value="base">{c.lembar}</option>
            </select>
          </label>
        )}
        {!unknown && (
          <AmountInput
            label={s.type === "deposito" ? f.principal : f.executionPrice}
            currency={
              s.type === "obligasi" &&
              s.details.priceConvention === "percent_of_par"
                ? "%"
                : s.currency
            }
            decimals={8}
            required
            value={s.price}
            onChange={(price) => set({ ...s, price })}
          />
        )}
        {!unknown && (
          <>
            <AmountInput
              label={f.fee}
              currency={s.currency}
              value={s.fee}
              onChange={(fee) => set({ ...s, fee })}
            />
            <AmountInput
              label={f.tax}
              currency={s.currency}
              value={s.tax}
              onChange={(tax) => set({ ...s, tax })}
            />
          </>
        )}
        {s.currency !== "IDR" && !unknown && (
          <AmountInput
            label={f.actualRate}
            currency="IDR"
            required
            decimals={6}
            value={s.fx}
            onChange={(fx) => set({ ...s, fx })}
          />
        )}
        <label className="field">
          <span className="label">{f.date} *</span>
          <input
            className="input"
            type="date"
            required
            max={today()}
            value={s.date}
            onChange={(e) => set({ ...s, date: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="label">{f.time}</span>
          <input
            className="input"
            type="time"
            value={s.time}
            onChange={(e) => set({ ...s, time: e.target.value })}
          />
        </label>
        {s.time && (
          <label className="field">
            <span className="label">{f.zone}</span>
            <input
              className="input"
              required
              value={s.timeZone}
              onChange={(e) => set({ ...s, timeZone: e.target.value })}
            />
          </label>
        )}
      </div>
      <small>
        {f.dateOnly} · {f.fractionRule}
      </small>
      <label className="field">
        <span className="label">{f.note}</span>
        <textarea
          className="textarea"
          maxLength={1000}
          value={s.note}
          onChange={(e) => set({ ...s, note: e.target.value })}
        />
      </label>
    </>
  );
}
