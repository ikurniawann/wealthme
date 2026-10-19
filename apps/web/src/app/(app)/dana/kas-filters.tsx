"use client";

import { Eye, EyeOff, Search } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";

import type { KasFilters, KasRow } from "./kas-model";
import { walletCountry } from "./wallet-directory";

const ALL = "";
const FAMILY = "__family";

function uniq(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function KasFilterBar({
  rows,
  filters,
  onChange,
  hidden,
  onToggleHidden,
}: {
  rows: readonly KasRow[];
  filters: KasFilters;
  onChange: (next: KasFilters) => void;
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.dana.v3.page;
  const set = (patch: Partial<KasFilters>) =>
    onChange({ ...filters, ...patch });

  const countries = uniq(rows.map((r) => r.country));
  const currencies = uniq(rows.map((r) => r.currency));
  const owners = new Map<string, string>();
  for (const r of rows)
    owners.set(r.ownerKey, r.ownerKey ? r.ownerLabel : c.family);

  const kinds = [
    { key: "all", label: c.all },
    { key: "cash", label: c.cash },
    { key: "ewallet", label: c.ewallet },
  ] as const;

  const ownerValue = filters.owner === null ? ALL : filters.owner || FAMILY;

  return (
    <section className="kw-filters" aria-label={c.listTitle}>
      <label className="kw-search">
        <Search aria-hidden="true" />
        <input
          type="search"
          placeholder={c.search}
          aria-label={c.search}
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
        />
      </label>
      <div className="kw-seg" role="radiogroup" aria-label={c.listTitle}>
        {kinds.map((k) => (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={filters.kind === k.key}
            onClick={() => set({ kind: k.key })}
          >
            {k.label}
          </button>
        ))}
      </div>
      <select
        className="kw-select"
        aria-label={c.country}
        value={filters.country}
        onChange={(e) => set({ country: e.target.value })}
      >
        <option value={ALL}>{c.allCountries}</option>
        {countries.map((code) => (
          <option key={code} value={code}>
            {walletCountry(code).name[locale]}
          </option>
        ))}
      </select>
      <select
        className="kw-select"
        aria-label={c.currency}
        value={filters.currency}
        onChange={(e) => set({ currency: e.target.value })}
      >
        <option value={ALL}>{c.allCurrencies}</option>
        {currencies.map((cur) => (
          <option key={cur} value={cur}>
            {cur}
          </option>
        ))}
      </select>
      <select
        className="kw-select"
        aria-label={c.owner}
        value={ownerValue}
        onChange={(e) => {
          const v = e.target.value;
          set({ owner: v === ALL ? null : v === FAMILY ? "" : v });
        }}
      >
        <option value={ALL}>{c.allOwners}</option>
        {[...owners.entries()].map(([key, label]) => (
          <option key={key || FAMILY} value={key || FAMILY}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="kw-toggle"
        aria-pressed={!hidden}
        onClick={onToggleHidden}
      >
        {hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {c.showBalance}
      </button>
    </section>
  );
}
