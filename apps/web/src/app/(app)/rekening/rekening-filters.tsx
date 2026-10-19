"use client";

import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { BankProductKind } from "@wealthme/contracts";

import {
  Dialog,
  DialogClose,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import { useMoney } from "@/hooks/use-money";
import { fill } from "@/i18n/rekening-v3";

import { bankShortLabel } from "./bank-directory";
import { ScrollRail } from "./scroll-rail";
import {
  EMPTY_FILTERS,
  type AccessFilter,
  type RekeningFilters,
  type RekeningRow,
  type StatusFilter,
} from "./rekening-model";

export type RekeningView = "cards" | "table";
export type RekeningSort = "balance" | "name" | "newest";

interface Option {
  key: string;
  label: string;
  count: number;
  amount: number;
  color?: string;
  short?: string;
}

/** Options with counts and totals, computed over every visible account. */
export function filterOptions(rows: readonly RekeningRow[]) {
  const banks = new Map<string, Option>();
  const holders = new Map<string, Option>();
  const kinds = new Map<BankProductKind, number>();
  for (const r of rows) {
    const b = banks.get(r.bankKey) ?? {
      key: r.bankKey,
      label: r.country === "ID" ? r.bankName : `${r.bankName} · ${r.country}`,
      count: 0,
      amount: 0,
      color: r.bank?.color,
      short: bankShortLabel(r.account.institution, r.account.name),
    };
    b.count += 1;
    b.amount += r.balance ?? 0;
    banks.set(r.bankKey, b);
    const h = holders.get(r.holderKey) ?? {
      key: r.holderKey,
      label: r.holderLabel,
      count: 0,
      amount: 0,
    };
    h.count += 1;
    holders.set(r.holderKey, h);
    kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
  }
  return {
    banks: [...banks.values()].sort((a, b) => b.amount - a.amount),
    holders: [...holders.values()].sort((a, b) => b.count - a.count),
    kinds: [...kinds.entries()],
  };
}

interface FiltersProps {
  rows: readonly RekeningRow[];
  filters: RekeningFilters;
  onChange: (next: RekeningFilters) => void;
  resultCount: number;
  resultTotal: number;
  view: RekeningView;
  onView: (v: RekeningView) => void;
  sort: RekeningSort;
  onSort: (s: RekeningSort) => void;
  focusLabel: string | null;
  onClearFocus: () => void;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Rekening v3 — filter v2: bank pills carrying count and total, product
 * kinds as a counted tab strip, holders as avatars, access/status in a
 * menu, and every active filter echoed as a removable chip. On phones the
 * avatars and menu move into a bottom sheet behind one "Filter" button.
 */
export function RekeningFilterPanel(props: FiltersProps) {
  const { rows, filters: f, onChange, view, onView, sort, onSort } = props;
  const { t } = useLocale();
  const c = t.rekening.v3;
  const money = useMoney();
  const opts = filterOptions(rows);
  const [sheet, setSheet] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // "/" jumps to the search box, like most list views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = (patch: Partial<RekeningFilters>) => onChange({ ...f, ...patch });
  const kindLabel = (k: BankProductKind) => c.kinds[k];
  const advancedCount =
    f.holders.length +
    (f.access !== "all" ? 1 : 0) +
    (f.status !== "open" ? 1 : 0) +
    (f.hideEmpty ? 0 : 1);

  const chips: Array<{ key: string; label: string; clear: () => void }> = [
    ...f.banks.map((k) => ({
      key: `b:${k}`,
      label: opts.banks.find((b) => b.key === k)?.label ?? k,
      clear: () => set({ banks: f.banks.filter((x) => x !== k) }),
    })),
    ...f.kinds.map((k) => ({
      key: `k:${k}`,
      label: kindLabel(k),
      clear: () => set({ kinds: f.kinds.filter((x) => x !== k) }),
    })),
    ...f.holders.map((k) => ({
      key: `h:${k}`,
      label: opts.holders.find((h) => h.key === k)?.label ?? k,
      clear: () => set({ holders: f.holders.filter((x) => x !== k) }),
    })),
    ...(f.access !== "all"
      ? [
          {
            key: "a",
            label: c.page.access[f.access],
            clear: () => set({ access: "all" }),
          },
        ]
      : []),
    ...(f.status !== "open"
      ? [
          {
            key: "s",
            label: c.page.status[f.status],
            clear: () => set({ status: "open" }),
          },
        ]
      : []),
    ...(props.focusLabel
      ? [{ key: "focus", label: props.focusLabel, clear: props.onClearFocus }]
      : []),
  ];
  const dirty = chips.length > 0 || f.query !== "" || !f.hideEmpty;

  const bankPills = (
    <ScrollRail
      className="rk3-banks"
      label={c.page.filterBank}
      prevLabel={c.page.scrollPrev}
      nextLabel={c.page.scrollNext}
    >
      <button
        type="button"
        className="rk3-bp rk3-bp--all"
        aria-pressed={f.banks.length === 0}
        onClick={() => set({ banks: [] })}
      >
        <span className="rk3-bp-logo" aria-hidden="true">
          ∑
        </span>
        <span>
          <b>{c.page.all}</b>
          <small className="wm-num">
            {rows.length} ·{" "}
            {money.formatCompact(opts.banks.reduce((s, b) => s + b.amount, 0))}
          </small>
        </span>
      </button>
      {opts.banks.map((b) => (
        <button
          key={b.key}
          type="button"
          className="rk3-bp"
          aria-pressed={f.banks.includes(b.key)}
          onClick={() => set({ banks: toggle(f.banks, b.key) })}
        >
          <span
            className="rk3-bp-logo"
            style={{ background: b.color ?? "var(--wm-forest, #0f3d2e)" }}
            aria-hidden="true"
          >
            {b.short}
          </span>
          <span>
            <b>{b.label}</b>
            <small className="wm-num">
              {b.count} · {money.formatCompact(b.amount)}
            </small>
          </span>
        </button>
      ))}
    </ScrollRail>
  );

  const kindTabs = (
    <div
      className="segmented rk3-kinds"
      role="group"
      aria-label={c.page.filterKind}
    >
      <button
        type="button"
        className="segmented__item"
        aria-checked={f.kinds.length === 0}
        role="checkbox"
        onClick={() => set({ kinds: [] })}
      >
        {c.page.all}
        <em>{rows.length}</em>
      </button>
      {opts.kinds.map(([k, n]) => (
        <button
          key={k}
          type="button"
          role="checkbox"
          className="segmented__item"
          aria-checked={f.kinds.includes(k)}
          onClick={() => set({ kinds: toggle(f.kinds, k) })}
        >
          {kindLabel(k)}
          <em>{n}</em>
        </button>
      ))}
    </div>
  );

  const holderAvatars = (
    <div className="rk3-who" role="group" aria-label={c.page.filterHolder}>
      <span className="rk3-who-label">{c.page.filterHolder}</span>
      {opts.holders.map((h) => (
        <button
          key={h.key}
          type="button"
          className="rk3-av"
          aria-pressed={f.holders.includes(h.key)}
          title={`${h.label} · ${h.count}`}
          aria-label={`${h.label} (${h.count})`}
          data-dim={
            f.holders.length > 0 && !f.holders.includes(h.key) ? "" : undefined
          }
          onClick={() => set({ holders: toggle(f.holders, h.key) })}
        >
          {initials(h.label)}
        </button>
      ))}
    </div>
  );

  const accessMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className="rk3-more-btn" />}
      >
        <SlidersHorizontal aria-hidden="true" />
        {c.page.filterAccess} & {c.page.filterStatus.toLowerCase()}
        {(f.access !== "all" || f.status !== "open" || !f.hideEmpty) && (
          <i className="rk3-badge">
            {(f.access !== "all" ? 1 : 0) +
              (f.status !== "open" ? 1 : 0) +
              (f.hideEmpty ? 0 : 1)}
          </i>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rk3-pop">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{c.page.filterAccess}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={f.access}
            onValueChange={(v) => set({ access: v as AccessFilter })}
          >
            {(["all", "mine", "sharedWithMe", "family"] as const).map((a) => (
              <DropdownMenuRadioItem key={a} value={a}>
                {c.page.access[a]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{c.page.filterStatus}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={f.status}
            onValueChange={(v) => set({ status: v as StatusFilter })}
          >
            {(["open", "all", "closed"] as const).map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                {c.page.status[s]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={f.hideEmpty}
          onCheckedChange={(v) => set({ hideEmpty: Boolean(v) })}
        >
          {c.page.hideEmpty}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <section className="wm-card rk3-filters" aria-label={c.page.filterBank}>
      <div className="rk3-f-row">
        <label className="rk3-search">
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            placeholder={c.page.searchPlaceholder}
            aria-label={c.page.searchPlaceholder}
            value={f.query}
            onChange={(e) => set({ query: e.target.value })}
          />
          <kbd className="rk3-kbd" aria-hidden="true">
            /
          </kbd>
        </label>
        <button
          type="button"
          className="rk3-sheet-btn"
          onClick={() => setSheet(true)}
          aria-label={c.page.moreFilters}
        >
          <SlidersHorizontal aria-hidden="true" />
          {advancedCount > 0 && <i className="rk3-badge">{advancedCount}</i>}
        </button>
        <div
          className="segmented rk3-view"
          role="radiogroup"
          aria-label={c.page.viewLabel}
        >
          {(["cards", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              className="segmented__item"
              onClick={() => onView(v)}
            >
              {v === "cards" ? c.page.viewCards : c.page.viewTable}
            </button>
          ))}
        </div>
        <select
          className="select rk3-sort"
          aria-label={c.page.sortLabel}
          value={sort}
          onChange={(e) => onSort(e.target.value as RekeningSort)}
        >
          {(["balance", "name", "newest"] as const).map((k) => (
            <option key={k} value={k}>
              {c.page.sortLabel}: {c.page.sort[k]}
            </option>
          ))}
        </select>
      </div>

      {bankPills}

      <div className="rk3-f-row rk3-f-row--wrap">
        {kindTabs}
        <span className="rk3-f-sep rk3-desk" aria-hidden="true" />
        <div className="rk3-desk">{holderAvatars}</div>
        <div className="rk3-desk rk3-push">{accessMenu}</div>
      </div>

      <div className="rk3-active">
        <span className="rk3-result">
          <b>{fill(c.page.accountsCount, { n: props.resultCount })}</b> ·{" "}
          <span className="wm-num">
            {money.formatCompact(props.resultTotal)}
          </span>
        </span>
        {chips.map((ch) => (
          <button
            key={ch.key}
            type="button"
            className="rk3-chip"
            onClick={ch.clear}
          >
            {ch.label}
            <X aria-hidden="true" />
          </button>
        ))}
        {dirty && (
          <button
            type="button"
            className="rk3-reset"
            onClick={() => {
              onChange(EMPTY_FILTERS);
              props.onClearFocus();
            }}
          >
            {c.page.clearFilters}
          </button>
        )}
      </div>

      <Dialog open={sheet} onOpenChange={setSheet}>
        <PanelContent variant="sheet" className="rk3-sheet">
          <header className="wm-panel-head">
            <DialogTitle className="wm-panel-title">
              {c.page.moreFilters}
            </DialogTitle>
            <DialogClose className="wm-panel-x" aria-label="Tutup">
              <X aria-hidden="true" />
            </DialogClose>
          </header>
          <div className="wm-panel-body rk3-sheet-body">
            {holderAvatars}
            <fieldset>
              <legend>{c.page.filterAccess}</legend>
              <div className="rk3-chips">
                {(["all", "mine", "sharedWithMe", "family"] as const).map(
                  (a) => (
                    <button
                      key={a}
                      type="button"
                      className="rk3-chip rk3-chip--opt"
                      aria-pressed={f.access === a}
                      onClick={() => set({ access: a })}
                    >
                      {c.page.access[a]}
                    </button>
                  ),
                )}
              </div>
            </fieldset>
            <fieldset>
              <legend>{c.page.filterStatus}</legend>
              <div className="rk3-chips">
                {(["open", "all", "closed"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rk3-chip rk3-chip--opt"
                    aria-pressed={f.status === s}
                    onClick={() => set({ status: s })}
                  >
                    {c.page.status[s]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="rk3-check">
              <input
                type="checkbox"
                checked={f.hideEmpty}
                onChange={(e) => set({ hideEmpty: e.target.checked })}
              />
              {c.page.hideEmpty}
            </label>
          </div>
          <div className="wm-panel-foot">
            <PillButton type="button" onClick={() => onChange(EMPTY_FILTERS)}>
              {c.page.clearFilters}
            </PillButton>
            <PillButton
              type="button"
              variant="primary"
              onClick={() => setSheet(false)}
            >
              {fill(c.page.accountsCount, { n: props.resultCount })}
            </PillButton>
          </div>
        </PanelContent>
      </Dialog>
    </section>
  );
}
