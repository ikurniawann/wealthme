"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";

import {
  DUE_WINDOWS,
  activeFilterCount,
  type AsuransiFilters,
} from "./asuransi-model";

export type FilterOption = { value: string; label: string };

export type FilterOptions = {
  holders: FilterOption[];
  insured: FilterOption[];
  providers: FilterOption[];
  types: FilterOption[];
  statuses: FilterOption[];
  currencies: FilterOption[];
};

const SEARCH_DEBOUNCE_MS = 250;

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <label
      className="ins3-field"
      htmlFor={id}
      data-active={value ? "true" : undefined}
    >
      <span>{label}</span>
      <select
        id={id}
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t.asuransi.v3.all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AsuransiFilterBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: AsuransiFilters;
  options: FilterOptions;
  onChange: (patch: Partial<AsuransiFilters>) => void;
  onReset: () => void;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  const [query, setQuery] = useState(filters.q);
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);

  // URL → input when the URL changes from outside (reset, back button).
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setQuery(filters.q);
  }
  useEffect(() => {
    if (query === filters.q) return;
    const id = setTimeout(() => onChange({ q: query }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, filters.q, onChange]);

  const policyTypes: FilterOption[] = (
    ["traditional", "unit_link", "unset"] as const
  ).map((v) => ({ value: v, label: c.policyTypes[v] }));
  const dues: FilterOption[] = DUE_WINDOWS.map((v) => ({
    value: v,
    label: c.dueOptions[v],
  }));

  return (
    <div className="ins3-filters" data-open={open ? "true" : undefined}>
      <div className="ins3-filter-top">
        <label className="ins3-search" htmlFor="ins3-search">
          <Search aria-hidden="true" />
          <span className="sr-only">{c.searchLabel}</span>
          <input
            id="ins3-search"
            className="input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={c.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn--outline ins3-filter-toggle"
          aria-expanded={open}
          aria-controls="ins3-filter-grid"
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden="true" /> {c.moreFilters}
          {count > 0 && <span className="ins3-count">{count}</span>}
        </button>
      </div>
      <div className="ins3-filter-grid" id="ins3-filter-grid">
        <FilterSelect
          id="ins3-f-holder"
          label={c.filterHolder}
          value={filters.holder}
          options={options.holders}
          onChange={(holder) => onChange({ holder })}
        />
        <FilterSelect
          id="ins3-f-insured"
          label={c.filterInsured}
          value={filters.insured}
          options={options.insured}
          onChange={(insured) => onChange({ insured })}
        />
        <FilterSelect
          id="ins3-f-provider"
          label={c.filterProvider}
          value={filters.provider}
          options={options.providers}
          onChange={(provider) => onChange({ provider })}
        />
        <FilterSelect
          id="ins3-f-type"
          label={c.filterType}
          value={filters.type}
          options={options.types}
          onChange={(type) => onChange({ type })}
        />
        <FilterSelect
          id="ins3-f-ptype"
          label={c.filterPolicyType}
          value={filters.policyType}
          options={policyTypes}
          onChange={(policyType) => onChange({ policyType })}
        />
        <FilterSelect
          id="ins3-f-status"
          label={c.filterStatus}
          value={filters.status}
          options={options.statuses}
          onChange={(status) => onChange({ status })}
        />
        <FilterSelect
          id="ins3-f-due"
          label={c.filterDue}
          value={filters.due}
          options={dues}
          onChange={(due) => onChange({ due: due as AsuransiFilters["due"] })}
        />
        <FilterSelect
          id="ins3-f-currency"
          label={c.filterCurrency}
          value={filters.currency}
          options={options.currencies}
          onChange={(currency) => onChange({ currency })}
        />
        {(count > 0 || filters.q) && (
          <button
            type="button"
            className="btn btn--ghost ins3-reset"
            onClick={onReset}
          >
            <X aria-hidden="true" /> {c.resetFilters}
          </button>
        )}
      </div>
    </div>
  );
}
