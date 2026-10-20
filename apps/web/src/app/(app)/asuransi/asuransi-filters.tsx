"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PillButton } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";

import {
  DUE_WINDOWS,
  activeFilterCount,
  fillCopy,
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

type FilterKey = Exclude<keyof AsuransiFilters, "q">;
type FilterDef = { key: FilterKey; label: string; options: FilterOption[] };

const SEARCH_DEBOUNCE_MS = 250;
/** Shown as chips next to the title; the rest sit behind "Filter lainnya". */
const CHIP_KEYS: FilterKey[] = [
  "holder",
  "insured",
  "type",
  "policyType",
  "status",
];
const OTHER_KEYS: FilterKey[] = ["provider", "due", "currency"];

/** One compact chip dropdown (desktop + tablet). */
function FilterChip({
  def,
  value,
  onPick,
}: {
  def: FilterDef;
  value: string;
  onPick: (value: string) => void;
}) {
  const { t } = useLocale();
  const all = t.asuransi.v3.all;
  const picked = def.options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ins3-fchip"
        data-active={value ? "true" : undefined}
        aria-label={`${def.label}: ${picked?.label ?? all}`}
      >
        <span>{picked?.label ?? def.label}</span>
        <ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="ins3-fmenu">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{def.label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={onPick}>
            <DropdownMenuRadioItem value="" closeOnClick>
              {all}
            </DropdownMenuRadioItem>
            {def.options.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value} closeOnClick>
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Native select used inside the tablet/phone sheet. */
function SheetSelect({
  def,
  value,
  onPick,
}: {
  def: FilterDef;
  value: string;
  onPick: (value: string) => void;
}) {
  const { t } = useLocale();
  const id = `ins3-f-${def.key}`;
  return (
    <label
      className="ins3-field"
      htmlFor={id}
      data-active={value ? "true" : undefined}
    >
      <span>{def.label}</span>
      <select
        id={id}
        className="select"
        value={value}
        onChange={(e) => onPick(e.target.value)}
      >
        <option value="">{t.asuransi.v3.all}</option>
        {def.options.map((o) => (
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
  resultCount,
  onChange,
  onReset,
}: {
  filters: AsuransiFilters;
  options: FilterOptions;
  resultCount: number;
  onChange: (patch: Partial<AsuransiFilters>) => void;
  onReset: () => void;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  const [query, setQuery] = useState(filters.q);
  const [sheet, setSheet] = useState(false);
  const count = activeFilterCount(filters);
  const otherCount = OTHER_KEYS.filter((k) => filters[k]).length;

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

  const defs: Record<FilterKey, FilterDef> = {
    holder: { key: "holder", label: c.filterHolder, options: options.holders },
    insured: {
      key: "insured",
      label: c.filterInsured,
      options: options.insured,
    },
    type: { key: "type", label: c.filterType, options: options.types },
    policyType: {
      key: "policyType",
      label: c.filterPolicyType,
      options: (["traditional", "unit_link", "unset"] as const).map((v) => ({
        value: v,
        label: c.policyTypes[v],
      })),
    },
    status: { key: "status", label: c.filterStatus, options: options.statuses },
    provider: {
      key: "provider",
      label: c.filterProvider,
      options: options.providers,
    },
    due: {
      key: "due",
      label: c.filterDue,
      options: DUE_WINDOWS.map((v) => ({ value: v, label: c.dueOptions[v] })),
    },
    currency: {
      key: "currency",
      label: c.filterCurrency,
      options: options.currencies,
    },
  };
  const pick = (key: FilterKey) => (value: string) =>
    onChange({ [key]: value } as Partial<AsuransiFilters>);

  return (
    <div className="ins3-filters">
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
      <div className="ins3-chiprow">
        {CHIP_KEYS.map((k) => (
          <FilterChip
            key={k}
            def={defs[k]}
            value={filters[k]}
            onPick={pick(k)}
          />
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="ins3-fchip ins3-fchip--more ins3-desk"
            data-active={otherCount ? "true" : undefined}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span>{c.otherFilters}</span>
            {otherCount > 0 && <i className="ins3-count">{otherCount}</i>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="ins3-fmenu">
            {OTHER_KEYS.map((k, i) => (
              <DropdownMenuGroup key={k}>
                {i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{defs[k].label}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters[k]}
                  onValueChange={pick(k)}
                >
                  <DropdownMenuRadioItem value="">
                    {c.all}
                  </DropdownMenuRadioItem>
                  {defs[k].options.map((o) => (
                    <DropdownMenuRadioItem key={o.value} value={o.value}>
                      {o.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {(count > 0 || filters.q) && (
          <button type="button" className="ins3-reset" onClick={onReset}>
            <X aria-hidden="true" /> {c.resetFilters}
          </button>
        )}
      </div>
      <button
        type="button"
        className="ins3-fchip ins3-fchip--more ins3-sheet-btn"
        data-active={count ? "true" : undefined}
        onClick={() => setSheet(true)}
      >
        <SlidersHorizontal aria-hidden="true" />
        <span className="ins3-tab-only">{c.otherFilters}</span>
        <span className="ins3-phone-only">{c.moreFilters}</span>
        {otherCount > 0 && (
          <i className="ins3-count ins3-tab-only">{otherCount}</i>
        )}
        {count > 0 && <i className="ins3-count ins3-phone-only">{count}</i>}
      </button>

      <Dialog open={sheet} onOpenChange={setSheet}>
        <PanelContent variant="sheet" className="ins3-fsheet">
          <header className="wm-panel-head">
            <DialogTitle className="wm-panel-title">
              <span className="ins3-tab-only">{c.otherFilters}</span>
              <span className="ins3-phone-only">{c.moreFilters}</span>
            </DialogTitle>
            <DialogClose className="wm-panel-x" aria-label={t.common.close}>
              <X aria-hidden="true" />
            </DialogClose>
          </header>
          <div className="wm-panel-body ins3-fsheet-body">
            <div className="ins3-phone-only ins3-fsheet-group">
              {CHIP_KEYS.map((k) => (
                <SheetSelect
                  key={k}
                  def={defs[k]}
                  value={filters[k]}
                  onPick={pick(k)}
                />
              ))}
            </div>
            <div className="ins3-fsheet-group">
              {OTHER_KEYS.map((k) => (
                <SheetSelect
                  key={k}
                  def={defs[k]}
                  value={filters[k]}
                  onPick={pick(k)}
                />
              ))}
            </div>
          </div>
          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onReset}>
              {c.resetFilters}
            </PillButton>
            <PillButton
              type="button"
              variant="primary"
              onClick={() => setSheet(false)}
            >
              {fillCopy(c.showResults, { n: resultCount })}
            </PillButton>
          </div>
        </PanelContent>
      </Dialog>
    </div>
  );
}
