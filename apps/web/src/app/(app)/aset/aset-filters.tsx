"use client";

import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { DateRangeFilterField } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import {
  activeFilterKeys,
  digitsOnly,
  fillCopy,
  fmtDate,
  subtypeGroups,
  type AsetFilters,
} from "./aset-model";

export interface OwnerOption {
  userId: string;
  name: string;
}

type Patch = Partial<AsetFilters>;

/**
 * A text input that keeps a local draft and commits it to the URL on blur,
 * Enter, or (with `debounceMs`) after typing pauses — one API call per
 * intent, not per keystroke. Remount with `key` to adopt an outside value.
 */
function DraftInput({
  initial,
  onCommit,
  debounceMs,
  format,
  ...rest
}: {
  initial: string;
  onCommit: (v: string) => void;
  debounceMs?: number;
  format?: (raw: string) => string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "defaultValue"
>) {
  const [draft, setDraft] = useState(format ? format(initial) : initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (v !== initial) onCommit(v);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const raw = (v: string) => (format ? digitsOnly(v) : v.trim());
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => {
        const next = format
          ? format(digitsOnly(e.target.value))
          : e.target.value;
        setDraft(next);
        if (debounceMs) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(raw(next)), debounceMs);
        }
      }}
      onBlur={() => commit(raw(draft))}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(raw(draft));
      }}
    />
  );
}

const groupDigits = (d: string) =>
  d ? new Intl.NumberFormat("id-ID").format(BigInt(d)) : "";

export function AsetFilterBar({
  filters,
  owners,
  onChange,
  onReset,
}: {
  filters: AsetFilters;
  owners: OwnerOption[];
  onChange: (patch: Patch) => void;
  onReset: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.aset.v3;
  const money = useMoney();
  const groups = subtypeGroups(t.aset);
  const hasExtra = Boolean(
    filters.unit ||
    filters.minQuantity ||
    filters.maxQuantity ||
    filters.status ||
    filters.completeness,
  );
  const [showMore, setShowMore] = useState(hasExtra);
  const active = activeFilterKeys(filters);

  const subtypeName =
    groups.flatMap((g) => g.options).find((o) => o.value === filters.subtype)
      ?.label ?? filters.subtype;
  const chipLabel = (k: keyof AsetFilters): string => {
    const v = String(filters[k]);
    switch (k) {
      case "q":
        return `“${v}”`;
      case "subtype":
        return `${c.type}: ${subtypeName}`;
      case "ownerUserId":
        return `${c.owner}: ${owners.find((o) => o.userId === v)?.name ?? "—"}`;
      case "minValue":
        return `${c.min} ${money.formatExact(BigInt(v))}`;
      case "maxValue":
        return `${c.max} ${money.formatExact(BigInt(v))}`;
      case "unit":
        return `${c.unit}: ${v}`;
      case "minQuantity":
        return `${c.min} ${v} ${filters.unit}`;
      case "maxQuantity":
        return `${c.max} ${v} ${filters.unit}`;
      case "acquiredFrom":
        return `${c.from} ${fmtDate(v, locale)}`;
      case "acquiredTo":
        return `${c.to} ${fmtDate(v, locale)}`;
      case "status":
        return `${c.status}: ${c.statuses[filters.status as "active"]}`;
      case "completeness":
        return filters.completeness === "complete"
          ? c.complete
          : c.incompleteOption;
      default:
        return v;
    }
  };
  const clearPatch = (k: keyof AsetFilters): Patch =>
    k === "unit"
      ? { unit: "", minQuantity: "", maxQuantity: "" }
      : ({ [k]: "" } as Patch);

  return (
    <section
      className="as3-card as3-filters"
      aria-label={c.filtersAria}
      data-more={showMore}
    >
      <div className="as3-filter-row">
        <label className="as3-search">
          <span className="sr-only">{c.search}</span>
          <Search aria-hidden="true" />
          <DraftInput
            key={`q-${filters.q}`}
            className="input"
            type="search"
            placeholder={c.search}
            initial={filters.q}
            debounceMs={400}
            enterKeyHint="search"
            autoComplete="off"
            onCommit={(q) => onChange({ q })}
          />
        </label>
        <label className="as3-field as3-opt">
          <span>{c.type}</span>
          <select
            className="select"
            value={filters.subtype}
            onChange={(e) => onChange({ subtype: e.target.value })}
          >
            <option value="">{c.all}</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={`${g.label}-${o.value}`} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="as3-field as3-opt">
          <span>{c.owner}</span>
          <select
            className="select"
            value={filters.ownerUserId}
            onChange={(e) => onChange({ ownerUserId: e.target.value })}
          >
            <option value="">{c.all}</option>
            {owners.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="as3-field as3-opt as3-range">
          <legend>{c.valueRange}</legend>
          <div>
            <DraftInput
              key={`min-${filters.minValue}`}
              className="input"
              inputMode="numeric"
              enterKeyHint="done"
              autoComplete="off"
              aria-label={`${c.valueRange} ${c.min}`}
              placeholder={c.min}
              initial={filters.minValue}
              format={groupDigits}
              onCommit={(minValue) => onChange({ minValue })}
            />
            <span aria-hidden="true">–</span>
            <DraftInput
              key={`max-${filters.maxValue}`}
              className="input"
              inputMode="numeric"
              enterKeyHint="done"
              autoComplete="off"
              aria-label={`${c.valueRange} ${c.max}`}
              placeholder={c.max}
              initial={filters.maxValue}
              format={groupDigits}
              onCommit={(maxValue) => onChange({ maxValue })}
            />
          </div>
        </fieldset>
        <div className="as3-field as3-opt as3-dates">
          <DateRangeFilterField
            from={filters.acquiredFrom}
            to={filters.acquiredTo}
            locale={locale}
            label={c.acquired}
            cancelLabel={t.common.cancel}
            applyLabel={t.common.apply}
            onApply={(acquiredFrom, acquiredTo) =>
              onChange({ acquiredFrom, acquiredTo })
            }
          />
        </div>
        <label className="as3-field">
          <span>{c.sort}</span>
          <select
            className="select"
            value={filters.sort}
            onChange={(e) =>
              onChange({ sort: e.target.value as AsetFilters["sort"] })
            }
          >
            {(Object.keys(c.sorts) as (keyof typeof c.sorts)[]).map((k) => (
              <option key={k} value={k}>
                {c.sorts[k]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn--ghost as3-more"
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
        >
          <SlidersHorizontal aria-hidden="true" />
          {showMore ? c.fewerFilters : c.moreFilters}
        </button>
      </div>

      {showMore && (
        <div className="as3-filter-row as3-filter-row--more">
          <fieldset className="as3-field as3-range as3-qty">
            <legend>{c.qtyRange}</legend>
            <div>
              <DraftInput
                key={`unit-${filters.unit}`}
                className="input as3-unit"
                aria-label={c.unit}
                placeholder={c.unit}
                autoComplete="off"
                enterKeyHint="done"
                list="as3-units"
                initial={filters.unit}
                onCommit={(unit) =>
                  onChange(
                    unit
                      ? { unit }
                      : { unit: "", minQuantity: "", maxQuantity: "" },
                  )
                }
              />
              <datalist id="as3-units">
                {["gram", "lembar", "unit", "share", "lot", "m²"].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <DraftInput
                key={`minq-${filters.minQuantity}`}
                className="input"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                disabled={!filters.unit}
                title={filters.unit ? undefined : c.unitFirst}
                aria-label={`${c.qtyRange} ${c.min}`}
                placeholder={filters.unit ? c.min : c.unitFirst}
                initial={filters.minQuantity}
                onCommit={(minQuantity) => onChange({ minQuantity })}
              />
              <span aria-hidden="true">–</span>
              <DraftInput
                key={`maxq-${filters.maxQuantity}`}
                className="input"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                disabled={!filters.unit}
                aria-label={`${c.qtyRange} ${c.max}`}
                placeholder={c.max}
                initial={filters.maxQuantity}
                onCommit={(maxQuantity) => onChange({ maxQuantity })}
              />
            </div>
          </fieldset>
          <label className="as3-field">
            <span>{c.status}</span>
            <select
              className="select"
              value={filters.status}
              onChange={(e) =>
                onChange({ status: e.target.value as AsetFilters["status"] })
              }
            >
              <option value="">{c.statuses.active}</option>
              <option value="sold">{c.statuses.sold}</option>
              <option value="archived">{c.statuses.archived}</option>
            </select>
          </label>
          <label className="as3-field">
            <span>{c.completeness}</span>
            <select
              className="select"
              value={filters.completeness}
              onChange={(e) =>
                onChange({
                  completeness: e.target.value as AsetFilters["completeness"],
                })
              }
            >
              <option value="">{c.all}</option>
              <option value="complete">{c.complete}</option>
              <option value="incomplete">{c.incompleteOption}</option>
            </select>
          </label>
        </div>
      )}

      {active.length > 0 && (
        <div className="as3-chips">
          <span className="as3-chips-label">{c.activeFilters}</span>
          <ul>
            {active.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  className="as3-chip"
                  aria-label={fillCopy(c.removeFilter, { label: chipLabel(k) })}
                  onClick={() => onChange(clearPatch(k))}
                >
                  {chipLabel(k)} <X aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="as3-reset" onClick={onReset}>
            {c.reset}
          </button>
        </div>
      )}
    </section>
  );
}
