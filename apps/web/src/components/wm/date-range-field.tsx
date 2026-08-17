"use client";

/**
 * Shared date-range picker field — the React port of the prototype's
 * `WM.mountDateRange` (docs/prototype/assets/shell.js), rendering the exact
 * same class contract the CSS in `design-system.css` already expects:
 * `.date-range` › `.date-range__trigger` (+ `.date-range__label`) ›
 * `.date-range__pop` › `.dr-head` / `.dr-grid` / `.dr-day` / `.dr-foot`.
 *
 * It lived inline in `app/(app)/transaksi/page.tsx` and was the only consumer.
 * /laporan's "Filter Laporan" needs the identical control (the prototype mounts
 * the same helper on both screens), so it moved here rather than being copied —
 * two hand-maintained calendars would inevitably drift.
 *
 * NOTE on `data-open`: this component sets `data-open="true"` itself, so the
 * `.date-range__pop[data-open="true"]` selector works. That selector is only
 * unreliable for Base UI popups, which emit a valueless `data-open=""`.
 */

import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import type { Locale } from "@/i18n";

/** Absolute "D Month YYYY" — parsed from parts, never `new Date(iso)`, so the
 *  displayed calendar day cannot shift with the viewer's timezone. */
function formatFullDate(dateStr: string, locale: Locale): string {
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMonthYear(dateStr: string, locale: Locale): string {
  const [year, month] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    month: "long",
    year: "numeric",
  });
}

export function formatDateRangeLabel(
  from: string,
  to: string,
  locale: Locale,
): string {
  if (!from && !to) return locale === "en" ? "All dates" : "Semua tanggal";

  if (!from) {
    return `${locale === "en" ? "Until" : "Sampai"} ${formatFullDate(to, locale)}`;
  }

  if (!to) {
    return `${locale === "en" ? "From" : "Mulai"} ${formatFullDate(from, locale)}`;
  }

  const [fromYear, fromMonth, fromDay] = from.split("-");
  const [toYear, toMonth, toDay] = to.split("-");
  const sameMonth = fromYear === toYear && fromMonth === toMonth;

  if (sameMonth) {
    const monthYear = formatMonthYear(from, locale);
    return `${Number(fromDay)} – ${Number(toDay)} ${monthYear}`;
  }

  return `${formatFullDate(from, locale)} – ${formatFullDate(to, locale)}`;
}

function parseDateParts(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month: month - 1, day };
}

function toDateIso(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, "0"),
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthTitle(year: number, month: number, locale: Locale): string {
  return new Date(year, month, 1).toLocaleDateString(
    locale === "en" ? "en-US" : "id-ID",
    { month: "long", year: "numeric" },
  );
}

function getDayLabels(locale: Locale): string[] {
  return locale === "en"
    ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    : ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
}

export function DateRangeFilterField({
  from,
  to,
  locale,
  label,
  cancelLabel,
  applyLabel,
  onApply,
}: {
  from: string;
  to: string;
  locale: Locale;
  label: string;
  cancelLabel: string;
  applyLabel: string;
  onApply: (from: string, to: string) => void;
}) {
  const today = new Date();
  const initialView = parseDateParts(
    to || from || today.toISOString().slice(0, 10),
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [view, setView] = useState({
    year: initialView.year,
    month: initialView.month,
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const openPicker = () => {
    const nextView = parseDateParts(
      to || from || today.toISOString().slice(0, 10),
    );
    setDraft({ from, to });
    setAwaitingEnd(false);
    setView({ year: nextView.year, month: nextView.month });
    setOpen((current) => !current);
  };

  const goToMonth = (offset: number) => {
    setView((current) => {
      const next = new Date(current.year, current.month + offset, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const selectDay = (iso: string) => {
    if (!awaitingEnd) {
      setDraft({ from: iso, to: iso });
      setAwaitingEnd(true);
      return;
    }

    setDraft((current) =>
      iso < current.from
        ? { from: iso, to: current.from }
        : { from: current.from, to: iso },
    );
    setAwaitingEnd(false);
  };

  const applyDraft = () => {
    if (awaitingEnd || !draft.from || !draft.to) return;
    onApply(draft.from, draft.to);
    setOpen(false);
  };

  const cancelDraft = () => {
    setDraft({ from, to });
    setAwaitingEnd(false);
    setOpen(false);
  };

  const cells: Array<{
    key: string;
    day: number;
    iso?: string;
    muted?: boolean;
    trail?: boolean;
  }> = [];
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysThisMonth = getDaysInMonth(view.year, view.month);
  const daysPrevMonth = getDaysInMonth(view.year, view.month - 1);

  for (let index = firstWeekday - 1; index >= 0; index -= 1) {
    const day = daysPrevMonth - index;
    cells.push({ key: `prev-${day}`, day, muted: true });
  }

  for (let day = 1; day <= daysThisMonth; day += 1) {
    cells.push({
      key: `day-${day}`,
      day,
      iso: toDateIso(view.year, view.month, day),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      key: `trail-${cells.length}`,
      day: 0,
      muted: true,
      trail: true,
    });
  }

  const rangeFrom =
    draft.from && draft.to && draft.from > draft.to ? draft.to : draft.from;
  const rangeTo =
    draft.from && draft.to && draft.from > draft.to ? draft.from : draft.to;
  const footerLabel =
    awaitingEnd && draft.from
      ? `${formatFullDate(draft.from, locale)} — ${locale === "en" ? "choose end date" : "pilih tanggal akhir"}`
      : draft.from && draft.to
        ? formatDateRangeLabel(rangeFrom, rangeTo, locale)
        : locale === "en"
          ? "Choose start date"
          : "Pilih tanggal mulai";

  return (
    <div ref={rootRef} className="field date-range">
      <span className="label">{label}</span>
      <button
        type="button"
        className="date-range__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
      >
        <CalendarRange className="size-[15px] shrink-0" />
        <span className="date-range__label">
          {formatDateRangeLabel(from, to, locale)}
        </span>
      </button>
      <div
        className="date-range__pop"
        data-open={open ? "true" : undefined}
        role="dialog"
        aria-label={label}
      >
        <div className="dr-head">
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--sm"
            aria-label={locale === "en" ? "Previous month" : "Bulan sebelumnya"}
            onClick={() => goToMonth(-1)}
          >
            {/* Prototype uses the lucide chevrons here, not "‹"/"›" glyphs
                (docs/prototype/assets/shell.js `renderPop`). */}
            <ChevronLeft className="size-[15px]" />
          </button>
          <span className="t-sm t-bold">
            {getMonthTitle(view.year, view.month, locale)}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--sm"
            aria-label={locale === "en" ? "Next month" : "Bulan berikutnya"}
            onClick={() => goToMonth(1)}
          >
            <ChevronRight className="size-[15px]" />
          </button>
        </div>
        <div className="dr-grid dr-grid--head">
          {getDayLabels(locale).map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="dr-grid">
          {cells.map((cell) => {
            if (cell.muted || !cell.iso) {
              return (
                <span key={cell.key} className="dr-day dr-day--muted">
                  {cell.trail ? "" : cell.day}
                </span>
              );
            }

            const isEdge = cell.iso === rangeFrom || cell.iso === rangeTo;
            const isInRange =
              !!rangeFrom &&
              !!rangeTo &&
              cell.iso > rangeFrom &&
              cell.iso < rangeTo;

            return (
              <button
                key={cell.key}
                type="button"
                className={[
                  "dr-day",
                  isEdge ? "dr-day--edge" : "",
                  isInRange ? "dr-day--in-range" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => selectDay(cell.iso!)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
        <div className="dr-foot">
          <span className="t-xs t-muted mono">{footerLabel}</span>
          <div className="row">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={cancelDraft}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={awaitingEnd || !draft.from || !draft.to}
              onClick={applyDraft}
            >
              {applyLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
