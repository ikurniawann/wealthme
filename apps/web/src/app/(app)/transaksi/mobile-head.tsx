"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Download,
  Filter,
  Search,
  X,
} from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { useMediaQuery } from "@/hooks/use-media-query";
import { localIsoDate } from "@/lib/local-date";
import "./mobile.css";

const COPY = {
  id: {
    month: "Bulan",
    allTime: "Semua waktu",
    custom: "Rentang khusus",
    outThisMonth: "Keluar bulan ini",
    outIn: "Keluar {month}",
    outTotal: "Total keluar",
    inThisMonth: "Masuk bulan ini",
    inIn: "Masuk {month}",
    inTotal: "Total masuk",
    cashflow: "Lihat arus kas",
    filters: "Filter transaksi",
    search: "Cari transaksi",
    closeSearch: "Tutup pencarian",
    tabs: "Jenis transaksi",
  },
  en: {
    month: "Month",
    allTime: "All time",
    custom: "Custom range",
    outThisMonth: "Out this month",
    outIn: "Out in {month}",
    outTotal: "Total out",
    inThisMonth: "In this month",
    inIn: "In {month}",
    inTotal: "Total in",
    cashflow: "See cash flow",
    filters: "Filter transactions",
    search: "Search transactions",
    closeSearch: "Close search",
    tabs: "Transaction type",
  },
} as const;

const MONTHS_BACK = 12;

/** "2026-10" → { from: "2026-10-01", to: "2026-10-31" }. */
export function monthBounds(key: string): { from: string; to: string } {
  const [year, month] = key.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${last}` };
}

/** The month key a from/to pair spans exactly, "" for no range, null otherwise. */
export function monthKeyOf(from: string, to: string): string | null {
  if (!from && !to) return "";
  if (!from || !to) return null;
  const key = from.slice(0, 7);
  const bounds = monthBounds(key);
  return bounds.from === from && bounds.to === to ? key : null;
}

/**
 * Phone-only head of /transaksi (<= 720px), per docs/design/refs/2026-10-20:
 * month pill + filter icon, "Keluar bulan ini" in red with a cash-flow link,
 * then a search icon and the Semua / Pengeluaran tabs. It drives the page's
 * existing date-range, type and search state, so the list below and the full
 * filter card (opened by the filter icon) stay the one source of truth.
 */
export function TxMobileHead({
  filter,
  onFilter,
  query,
  onQuery,
  dateFrom,
  dateTo,
  onRange,
  hasDeepLink,
  expense,
  income,
  onExport,
  exportLabel,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
}: {
  filter: string;
  onFilter: (value: "all" | "expense") => void;
  query: string;
  onQuery: (value: string) => void;
  dateFrom: string;
  dateTo: string;
  onRange: (from: string, to: string) => void;
  /** A from/to/account/tx deep link is present: keep its range as is. */
  hasDeepLink: boolean;
  /** Pre-formatted total expense for the active range ("…" while loading). */
  expense: string;
  /** Pre-formatted total income for the same range ("…" while loading). */
  income: string;
  /** The page's CSV export (the hero's button, hidden on phones). */
  onExport: () => void;
  exportLabel: string;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
}) {
  const { t, locale } = useLocale();
  const c = locale === "en" ? COPY.en : COPY.id;
  const isPhone = useMediaQuery("(max-width: 720px)");
  const [searchOpen, setSearchOpen] = useState(query !== "");
  const searchRef = useRef<HTMLInputElement>(null);
  const defaulted = useRef(false);
  const currentKey = localIsoDate().slice(0, 7);

  // Phones open on the current month (the reference's default); desktop keeps
  // its all-time default. Applied once, and never over a deep-linked range.
  useEffect(() => {
    if (!isPhone || defaulted.current) return;
    defaulted.current = true;
    if (hasDeepLink || dateFrom || dateTo) return;
    const { from, to } = monthBounds(currentKey);
    onRange(from, to);
  }, [isPhone, hasDeepLink, dateFrom, dateTo, currentKey, onRange]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const dateLocale = locale === "en" ? "en-US" : "id-ID";
  const monthLabel = (key: string) => {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(dateLocale, {
      month: "long",
      year: "numeric",
    });
  };
  const options = Array.from({ length: MONTHS_BACK }, (_, back) => {
    const [year, month] = currentKey.split("-").map(Number);
    const date = new Date(year, month - 1 - back, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const key = monthKeyOf(dateFrom, dateTo);
  const selected = key === null ? "custom" : key === "" ? "all" : key;
  const outLabel =
    key === currentKey
      ? c.outThisMonth
      : key
        ? c.outIn.replace("{month}", monthLabel(key))
        : c.outTotal;
  const inLabel =
    key === currentKey
      ? c.inThisMonth
      : key
        ? c.inIn.replace("{month}", monthLabel(key))
        : c.inTotal;
  const tabs: { value: "all" | "expense"; label: string }[] = [
    { value: "all", label: t.transaksi.filterLabels.all },
    { value: "expense", label: t.transaksi.typeLabels.expense },
  ];

  return (
    <div className="txm">
      <div className="txm-top">
        <label className="txm-pill">
          <span className="sr-only">{c.month}</span>
          <select
            value={selected}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "all") onRange("", "");
              else if (value !== "custom") {
                const { from, to } = monthBounds(value);
                onRange(from, to);
              }
            }}
          >
            {selected === "custom" && (
              <option value="custom">{c.custom}</option>
            )}
            {options.map((value) => (
              <option key={value} value={value}>
                {monthLabel(value)}
              </option>
            ))}
            {selected !== "all" &&
              key !== null &&
              key !== "" &&
              !options.includes(key) && (
                <option value={key}>{monthLabel(key)}</option>
              )}
            <option value="all">{c.allTime}</option>
          </select>
          <ChevronDown aria-hidden="true" />
        </label>
        <div className="txm-actions">
          <button
            type="button"
            className="txm-icon"
            aria-label={exportLabel}
            title={exportLabel}
            onClick={onExport}
          >
            <Download aria-hidden="true" />
          </button>
          <button
            type="button"
            className="txm-icon"
            aria-label={c.filters}
            aria-controls="transaction-filters"
            aria-expanded={filtersOpen}
            onClick={onToggleFilters}
          >
            <Filter aria-hidden="true" />
            {activeFilterCount > 0 && (
              <span className="txm-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="txm-sum">
        <p className="txm-out">
          <span>{outLabel}</span>
          <b className="wm-num">{expense}</b>
          <small className="txm-in">
            {inLabel} <b className="wm-num">{income}</b>
          </small>
        </p>
        <Link href="/laporan?tab=rcashflow" className="txm-link">
          {c.cashflow}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>

      <div className="txm-bar">
        <div className="txm-tabs" role="group" aria-label={c.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={filter === tab.value}
              onClick={() => onFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="txm-icon"
          aria-label={searchOpen ? c.closeSearch : c.search}
          aria-expanded={searchOpen}
          onClick={() => {
            if (searchOpen) onQuery("");
            setSearchOpen((open) => !open);
          }}
        >
          {searchOpen ? (
            <X aria-hidden="true" />
          ) : (
            <Search aria-hidden="true" />
          )}
        </button>
      </div>
      {searchOpen && (
        <label className="txm-search">
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={t.transaksi.v2.searchPlaceholder}
            aria-label={c.search}
            enterKeyHint="search"
          />
        </label>
      )}
    </div>
  );
}
