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
 * The popover is PORTALED (`useAnchoredPopover`): `.page > * > *` keeps an
 * identity transform from the `page-in` animation (fill-mode `both`), which
 * makes every card its own stacking context — an in-flow popover could never
 * paint above the next card, whatever its z-index.
 *
 * NOTE on `data-open`: this component sets `data-open="true"` itself, so the
 * `.date-range__pop[data-open="true"]` selector works. That selector is only
 * unreliable for Base UI popups, which emit a valueless `data-open=""`.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { en as enDict, id as idDict, type Locale } from "@/i18n";

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

function todayIso(): string {
  const now = new Date();
  return toDateIso(now.getFullYear(), now.getMonth(), now.getDate());
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

function getMonthName(month: number, locale: Locale): string {
  return new Date(2000, month, 1).toLocaleDateString(
    locale === "en" ? "en-US" : "id-ID",
    { month: "long" },
  );
}

function getDayLabels(locale: Locale): string[] {
  return locale === "en"
    ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    : ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
}

type MonthView = { year: number; month: number };

function shiftMonth(view: MonthView, offset: number): MonthView {
  const next = new Date(view.year, view.month + offset, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

type DayCell = { key: string; day: number; iso?: string; trail?: boolean };

function buildMonthCells(view: MonthView): DayCell[] {
  const cells: DayCell[] = [];
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysThisMonth = getDaysInMonth(view.year, view.month);
  const daysPrevMonth = getDaysInMonth(view.year, view.month - 1);

  for (let index = firstWeekday - 1; index >= 0; index -= 1) {
    const day = daysPrevMonth - index;
    cells.push({ key: `prev-${day}`, day });
  }

  for (let day = 1; day <= daysThisMonth; day += 1) {
    cells.push({
      key: `day-${day}`,
      day,
      iso: toDateIso(view.year, view.month, day),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `trail-${cells.length}`, day: 0, trail: true });
  }

  return cells;
}

const POP_GAP = 6;
const EDGE_MARGIN = 8;
// Base UI dialogs/sheets trap focus and dismiss on outside presses, so a picker
// inside one is portaled into that popup rather than into <body>.
const MODAL_HOST_SELECTOR =
  '[data-slot="dialog-content"], [data-slot="sheet-content"]';

function resolvePortalHost(trigger: HTMLElement | null): HTMLElement {
  return trigger?.closest<HTMLElement>(MODAL_HOST_SELECTOR) ?? document.body;
}

function placePopover(
  trigger: HTMLElement,
  pop: HTMLElement,
  host: HTMLElement,
): void {
  const anchor = trigger.getBoundingClientRect();
  const hostRect = host === document.body ? null : host.getBoundingClientRect();
  const boundTop = Math.max(0, hostRect?.top ?? 0);
  const boundBottom = Math.min(
    window.innerHeight,
    hostRect?.bottom ?? window.innerHeight,
  );
  const boundLeft = Math.max(0, hostRect?.left ?? 0);
  const boundRight = Math.min(
    window.innerWidth,
    hostRect?.right ?? window.innerWidth,
  );
  const popHeight = pop.offsetHeight;
  const popWidth = pop.offsetWidth;

  const fitsBelow =
    anchor.bottom + POP_GAP + popHeight <= boundBottom - EDGE_MARGIN;
  const fitsAbove = anchor.top - POP_GAP - popHeight >= boundTop + EDGE_MARGIN;
  const viewTop =
    !fitsBelow && fitsAbove
      ? anchor.top - POP_GAP - popHeight
      : anchor.bottom + POP_GAP;
  const viewLeft = Math.max(
    boundLeft + EDGE_MARGIN,
    Math.min(anchor.left, boundRight - EDGE_MARGIN - popWidth),
  );

  if (!hostRect) {
    pop.style.top = `${viewTop + window.scrollY}px`;
    pop.style.left = `${viewLeft + window.scrollX}px`;
    return;
  }
  pop.style.top = `${viewTop - hostRect.top - host.clientTop + host.scrollTop}px`;
  pop.style.left = `${viewLeft - hostRect.left - host.clientLeft + host.scrollLeft}px`;
}

/** Every focusable day/nav/foot control inside the popover, in DOM order —
 *  used both to pick the initial focus target and to trap Tab inside the
 *  popover while it is open. */
function getFocusable(pop: HTMLElement): HTMLElement[] {
  return Array.from(
    pop.querySelectorAll<HTMLElement>(
      'button:not(:disabled), select:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/** On open, focus the selected day if present, else today's day, else the
 *  first enabled day/control — so Tab after Enter/click lands inside the
 *  calendar instead of skipping past it. */
function focusInitialDay(pop: HTMLElement): void {
  const selected = pop.querySelector<HTMLButtonElement>(
    ".dr-day--edge:not(:disabled)",
  );
  if (selected) {
    selected.focus();
    return;
  }
  const today = pop.querySelector<HTMLButtonElement>(
    `.dr-day[data-iso="${todayIso()}"]:not(:disabled)`,
  );
  if (today) {
    today.focus();
    return;
  }
  const focusable = getFocusable(pop);
  if (focusable.length > 0) focusable[0].focus();
}

function useAnchoredPopover(
  open: boolean,
  close: () => void,
  layoutKey: string,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  const captureHost = () => setHost(resolvePortalHost(triggerRef.current));

  useLayoutEffect(() => {
    if (!open || !host || !triggerRef.current || !popRef.current) return;
    placePopover(triggerRef.current, popRef.current, host);
  }, [open, host, layoutKey]);

  // Runs once per open (not per `layoutKey`/month navigation), so moving
  // between months while the popover is open never yanks focus back.
  useLayoutEffect(() => {
    if (!open || !popRef.current) return;
    focusInitialDay(popRef.current);
  }, [open]);

  useEffect(() => {
    if (!open || !host) return undefined;

    const reposition = () => {
      if (triggerRef.current && popRef.current) {
        placePopover(triggerRef.current, popRef.current, host);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      close();
    };
    // Window capture runs before any document listener, so Escape closes the
    // picker without also closing a Base UI dialog around it.
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        triggerRef.current?.focus();
        return;
      }
      // Trap Tab within the popover: it is portaled to the end of its host,
      // so without this, Tab from the last control escapes to whatever the
      // host happens to render next instead of cycling inside the calendar.
      if (event.key === "Tab" && popRef.current) {
        const focusable = getFocusable(popRef.current);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!popRef.current.contains(active)) return;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, host, close]);

  const renderPop = (pop: ReactNode) =>
    open && host ? createPortal(pop, host) : null;

  return { rootRef, triggerRef, popRef, captureHost, renderPop };
}

function CalendarMonth({
  view,
  locale,
  title,
  onNavigate,
  renderDay,
}: {
  view: MonthView;
  locale: Locale;
  title: ReactNode;
  onNavigate: (offset: number) => void;
  renderDay: (iso: string, day: number) => ReactNode;
}) {
  return (
    <>
      <div className="dr-head">
        <button
          type="button"
          className="btn btn--ghost btn--icon btn--sm"
          aria-label={locale === "en" ? "Previous month" : "Bulan sebelumnya"}
          onClick={() => onNavigate(-1)}
        >
          {/* Prototype uses the lucide chevrons here, not "‹"/"›" glyphs
              (docs/prototype/assets/shell.js `renderPop`). */}
          <ChevronLeft className="size-[15px]" />
        </button>
        {title}
        <button
          type="button"
          className="btn btn--ghost btn--icon btn--sm"
          aria-label={locale === "en" ? "Next month" : "Bulan berikutnya"}
          onClick={() => onNavigate(1)}
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
        {buildMonthCells(view).map((cell) =>
          cell.iso ? (
            <Fragment key={cell.key}>{renderDay(cell.iso, cell.day)}</Fragment>
          ) : (
            <span key={cell.key} className="dr-day dr-day--muted">
              {cell.trail ? "" : cell.day}
            </span>
          ),
        )}
      </div>
    </>
  );
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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [view, setView] = useState<MonthView>(() => {
    const initial = parseDateParts(to || from || todayIso());
    return { year: initial.year, month: initial.month };
  });
  const close = useCallback(() => setOpen(false), []);
  const { rootRef, triggerRef, popRef, captureHost, renderPop } =
    useAnchoredPopover(open, close, `${view.year}-${view.month}`);

  const openPicker = () => {
    const nextView = parseDateParts(to || from || todayIso());
    setDraft({ from, to });
    setAwaitingEnd(false);
    setView({ year: nextView.year, month: nextView.month });
    captureHost();
    setOpen((current) => !current);
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
    triggerRef.current?.focus();
  };

  const cancelDraft = () => {
    setDraft({ from, to });
    setAwaitingEnd(false);
    setOpen(false);
    triggerRef.current?.focus();
  };

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
        ref={triggerRef}
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
      {renderPop(
        <div
          ref={popRef}
          className="date-range__pop date-range__pop--portal"
          data-open="true"
          role="dialog"
          aria-label={label}
        >
          <CalendarMonth
            view={view}
            locale={locale}
            onNavigate={(offset) =>
              setView((current) => shiftMonth(current, offset))
            }
            title={
              <span className="t-sm t-bold">
                {getMonthTitle(view.year, view.month, locale)}
              </span>
            }
            renderDay={(iso, day) => {
              const isEdge = iso === rangeFrom || iso === rangeTo;
              const isInRange =
                !!rangeFrom && !!rangeTo && iso > rangeFrom && iso < rangeTo;
              return (
                <button
                  type="button"
                  className={[
                    "dr-day",
                    isEdge ? "dr-day--edge" : "",
                    isInRange ? "dr-day--in-range" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-iso={iso}
                  aria-label={formatFullDate(iso, locale)}
                  onClick={() => selectDay(iso)}
                >
                  {day}
                </button>
              );
            }}
          />
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
        </div>,
      )}
    </div>
  );
}

export function DateField({
  value,
  locale,
  label,
  onChange,
  min,
  max,
  required = false,
  id,
  name,
}: {
  value: string;
  locale: Locale;
  label: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  id?: string;
  name?: string;
}) {
  const dict = locale === "en" ? enDict : idDict;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MonthView>(() => {
    const initial = parseDateParts(value || todayIso());
    return { year: initial.year, month: initial.month };
  });
  const close = useCallback(() => setOpen(false), []);
  const { rootRef, triggerRef, popRef, captureHost, renderPop } =
    useAnchoredPopover(open, close, `${view.year}-${view.month}`);

  const openPicker = () => {
    const next = parseDateParts(value || todayIso());
    setView({ year: next.year, month: next.month });
    captureHost();
    setOpen((current) => !current);
  };

  const commit = (iso: string) => {
    onChange(iso);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const thisYear = new Date().getFullYear();
  const firstYear = Math.min(
    min ? parseDateParts(min).year : thisYear - 100,
    view.year,
  );
  const lastYear = Math.max(
    max ? parseDateParts(max).year : thisYear + 30,
    view.year,
  );
  const years: number[] = [];
  for (let year = lastYear; year >= firstYear; year -= 1) years.push(year);

  const display = value
    ? formatFullDate(value, locale)
    : dict.common.datePickerPlaceholder;

  return (
    <div ref={rootRef} className="date-range date-field">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="date-range__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={id ? undefined : `${label}: ${display}`}
        data-value={value}
        onClick={openPicker}
      >
        <CalendarDays className="size-[15px] shrink-0" />
        <span
          className={value ? "date-range__label" : "date-range__label t-muted"}
        >
          {display}
        </span>
      </button>
      <input
        type="date"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      />
      {renderPop(
        <div
          ref={popRef}
          className="date-range__pop date-range__pop--portal"
          data-open="true"
          role="dialog"
          aria-label={label}
        >
          <CalendarMonth
            view={view}
            locale={locale}
            onNavigate={(offset) =>
              setView((current) => shiftMonth(current, offset))
            }
            title={
              <span className="row gap-1.5">
                <span className="t-sm t-bold">
                  {getMonthName(view.month, locale)}
                </span>
                <select
                  aria-label={dict.common.datePickerYearLabel}
                  className="select h-8 w-auto py-0 pr-7 pl-2 text-[12.5px]"
                  value={view.year}
                  onChange={(event) =>
                    setView((current) => ({
                      ...current,
                      year: Number(event.target.value),
                    }))
                  }
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </span>
            }
            renderDay={(iso, day) => {
              const outOfBounds = (!!min && iso < min) || (!!max && iso > max);
              return (
                <button
                  type="button"
                  className={[
                    "dr-day",
                    iso === value ? "dr-day--edge" : "",
                    outOfBounds ? "dr-day--muted" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-iso={iso}
                  aria-label={formatFullDate(iso, locale)}
                  aria-pressed={iso === value}
                  disabled={outOfBounds}
                  onClick={() => commit(iso)}
                >
                  {day}
                </button>
              );
            }}
          />
          {!required && value && (
            <div className="dr-foot">
              <div className="row">
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => commit("")}
                >
                  {dict.common.datePickerClear}
                </button>
              </div>
            </div>
          )}
        </div>,
      )}
    </div>
  );
}
