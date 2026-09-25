# Revisi C: One Date Picker Everywhere (portal fix + DateField) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Laporan date-range popover from being painted over by the next card, and replace every native `<input type="date">` in the web app with the app's own calendar picker: `DateRangeFilterField` for ranges, a new single-date `DateField` for everything else.

**Architecture:** `apps/web/src/components/wm/date-range-field.tsx` gets a shared `useAnchoredPopover` hook. The hook portals `.date-range__pop` out of the page, into `document.body`, or into the enclosing Base UI dialog/sheet popup when there is one, and positions it from the trigger's `getBoundingClientRect()`. It also shares a `CalendarMonth` grid that both the existing range picker and the new `DateField` render. One CSS rule in `design-system.css` gives the portaled popover `z-index: 90`. Twelve call sites then swap their native inputs for these components.

**Tech Stack:** Next.js 16 App Router + React 19 (`createPortal`) + TypeScript 5 + Jest + Testing Library (`@testing-library/react` 16, `user-event` 14) + Base UI dialogs; pnpm workspace.

**Spec:** `docs/superpowers/plans/2026-09-25-revisi-besar-catalog.md`, item 3 ("Laporan — date picker z-index broken; make it the ONE date picker everywhere").

## Global Constraints

- Work only inside the worktree `/home/stealth/Projects/wealthme-web-revisi-ab` on branch `feat/revisi-ab-calculators-quickfixes`.
- Protected files stay untouched **except** these reviewed exceptions for this sub-plan: `apps/web/src/components/wm/date-range-field.tsx` (portal + `DateField`), `apps/web/src/components/wm/index.tsx` (one export line), `apps/web/src/components/shell/transaction-dialog.tsx` (date field swap), `apps/web/src/app/design-system.css` (exactly one new rule). Never edit `apps/web/src/lib/*`, `apps/web/src/components/ui/*`, `apps/web/src/components/charts/*`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `packages/config/*`.
- Do **not** remove or change the `page-in` animation (`design-system.css` ~:4534-4556).
- Every new user-visible string goes into **all three** of `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts` (dictionaries use `satisfies I18nDictionary`).
- Dates are ISO `YYYY-MM-DD` strings end to end. Never build a display date with `new Date(iso)` (timezone shift). Use the parse-from-parts helpers already in `date-range-field.tsx` (`parseDateParts`, `toDateIso`, `formatFullDate`).
- Run tests locally only as the focused jest commands each task names (from `apps/web`). No `next build`, no full `turbo` runs. The only non-jest command allowed is the single `pnpm exec tsc --noEmit` type gate in Task 6.
- Lint every file you touch: `pnpm exec eslint <files>` from `apps/web` must exit 0.
- Commit messages: Conventional Commits, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code comments: none unless the WHY is non-obvious; one line max.
- The husky post-commit hook prints "post-commit script failed (code 1)" (graphify), but the commit still lands. Never use `--no-verify`.
- Jest runs with `TZ=Asia/Jakarta` (`apps/web/jest.config.ts`). Tests that depend on "the month the calendar opens on" must compute it from **local** date parts (`new Date().getFullYear()/getMonth()`), except where a task says otherwise.

## Review Focus

1. **Picker inside a modal dialog.** Clicking a day, or pressing Escape, inside a `DateField` that lives in a Base UI `Dialog` (crud-modal, transaction-dialog, most page forms) must close only the picker. The dialog around it must stay open with the user's input intact. Pinned by Task 3's tests.
2. **Trigger near the viewport's bottom-right corner.** The popover must flip above the trigger and be clamped 8px inside the right edge instead of rendering off-screen. Pinned by Task 1's positioning test.
3. **Dates far from today (birth dates, 1990).** Users must be able to reach them without hundreds of "next month" clicks. The `DateField` year select does this. Pinned by Task 2's year-jump test.
4. **Optional dates that must be emptied** (liabilitas due date, asuransi renewal, deposito maturity). Users need a way to clear them back to `""`. Required dates must not offer that. Pinned by Task 2's clear / no-clear tests.
5. **Early-morning WIB (00:00-06:59).** Picking a day must yield exactly that ISO day, and the label must show that same day. No UTC shift. The calendar's "today" month must come from local date parts. Pinned by Task 2's day-click test (`2026-09-15` in, `"15 September 2026"` shown) under the suite's `Asia/Jakarta` TZ.

---

## File Structure

| File                                                         | Responsibility                                                                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/wm/date-range-field.tsx`            | Date helpers, `useAnchoredPopover` (portal host + positioning + dismissal), `CalendarMonth` grid, `DateRangeFilterField` (range) and `DateField` (single). |
| `apps/web/src/components/wm/date-range-field.test.tsx` (new) | Portal, positioning, dismissal and `DateField` behaviour.                                                                                                  |
| `apps/web/src/components/wm/index.tsx`                       | Barrel: exports `DateField`, `DateRangeFilterField`.                                                                                                       |
| `apps/web/src/app/design-system.css`                         | One rule: `.date-range__pop.date-range__pop--portal { z-index: 90 }`.                                                                                      |
| `apps/web/src/i18n/{types,id,en}.ts`                         | `common.datePickerPlaceholder/YearLabel/Clear`, `laporan.harian.dateLabel`.                                                                                |
| 12 call-site files                                           | Swap native date inputs.                                                                                                                                   |

---

### Task 1: Portal the date-range popover out of the page (fixes the Laporan overlap)

**Files:**

- Modify: `apps/web/src/components/wm/date-range-field.tsx` (whole file, 353 lines, replaced)
- Modify: `apps/web/src/app/design-system.css` (insert after the second `.date-range__pop[data-open="true"] { display: block; }` rule, ~:3287-3289)
- Create: `apps/web/src/components/wm/date-range-field.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces (module-private, used by Task 2 in the same file):
  - `todayIso(): string`: today from **local** date parts, `YYYY-MM-DD`.
  - `type MonthView = { year: number; month: number }` (month 0-based); `shiftMonth(view: MonthView, offset: number): MonthView`.
  - `useAnchoredPopover(open: boolean, close: () => void, layoutKey: string): { rootRef: RefObject<HTMLDivElement | null>; triggerRef: RefObject<HTMLButtonElement | null>; popRef: RefObject<HTMLDivElement | null>; captureHost: () => void; renderPop: (pop: ReactNode) => ReactNode }`. Call `captureHost()` in the trigger's click handler before opening. Wrap the popover element in `renderPop(...)`, give it `ref={popRef}`, and give it the classes `date-range__pop date-range__pop--portal` plus `data-open="true"`.
  - `CalendarMonth({ view, locale, title, onNavigate, renderDay })`, where `renderDay: (iso: string, day: number) => ReactNode`.
- Public API unchanged: `DateRangeFilterField(props)`, `formatDateRangeLabel`, `formatMonthYear`. Behaviour change: the popover is only in the DOM while open.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/wm/date-range-field.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateRangeFilterField } from "./date-range-field";

function localMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function renderRangeInCard(onApply = jest.fn()) {
  render(
    <div
      className="card"
      data-testid="card"
      style={{ transform: "translateY(0px)" }}
    >
      <DateRangeFilterField
        from=""
        to=""
        locale="id"
        label="Rentang Tanggal"
        cancelLabel="Batal"
        applyLabel="Terapkan"
        onApply={onApply}
      />
    </div>,
  );
  return onApply;
}

describe("DateRangeFilterField — portaled popover", () => {
  it("keeps no popover in the DOM until opened", () => {
    renderRangeInCard();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("portals the open popover to document.body, outside the transformed card", async () => {
    const user = userEvent.setup();
    renderRangeInCard();

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));

    const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
    expect(pop.parentElement).toBe(document.body);
    expect(screen.getByTestId("card")).not.toContainElement(pop);
    expect(pop).toHaveClass("date-range__pop", "date-range__pop--portal");
    expect(pop).toHaveAttribute("data-open", "true");
    expect(pop.style.top).toMatch(/px$/);
    expect(pop.style.left).toMatch(/px$/);
  });

  it("portals into the enclosing dialog popup instead of body", async () => {
    const user = userEvent.setup();
    render(
      <div data-slot="dialog-content" data-testid="host">
        <DateRangeFilterField
          from=""
          to=""
          locale="id"
          label="Rentang Tanggal"
          cancelLabel="Batal"
          applyLabel="Terapkan"
          onApply={jest.fn()}
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));

    expect(
      screen.getByRole("dialog", { name: "Rentang Tanggal" }).parentElement,
    ).toBe(screen.getByTestId("host"));
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderRangeInCard();
    const trigger = screen.getByRole("button", { name: /semua tanggal/i });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("stays open for clicks inside the popover and closes on a pointerdown outside", async () => {
    const user = userEvent.setup();
    renderRangeInCard();

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));
    const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
    await user.click(
      within(pop).getByRole("button", { name: "Bulan berikutnya" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Rentang Tanggal" }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still applies a picked range from the portaled grid", async () => {
    const user = userEvent.setup();
    const onApply = renderRangeInCard();

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));
    const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
    await user.click(within(pop).getByRole("button", { name: "3" }));
    await user.click(within(pop).getByRole("button", { name: "10" }));
    await user.click(within(pop).getByRole("button", { name: "Terapkan" }));

    const month = localMonthPrefix();
    expect(onApply).toHaveBeenCalledWith(`${month}-03`, `${month}-10`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("flips above the trigger and clamps to the right edge when there is no room below", async () => {
    const heightSpy = jest
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(300);
    const widthSpy = jest
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(296);
    try {
      const user = userEvent.setup();
      renderRangeInCard();
      const trigger = screen.getByRole("button", { name: /semua tanggal/i });
      trigger.getBoundingClientRect = () =>
        ({
          top: 700,
          bottom: 740,
          left: 1000,
          right: 1100,
          width: 100,
          height: 40,
          x: 1000,
          y: 700,
          toJSON: () => ({}),
        }) as DOMRect;

      await user.click(trigger);

      const pop = screen.getByRole("dialog", { name: "Rentang Tanggal" });
      // jsdom viewport is 1024×768: 740 + 6 + 300 overflows, 700 − 6 − 300 = 394 fits.
      expect(pop.style.top).toBe("394px");
      expect(pop.style.left).toBe(`${1024 - 8 - 296}px`);
    } finally {
      heightSpy.mockRestore();
      widthSpy.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/components/wm/date-range-field.test.tsx`
Expected: FAIL. "keeps no popover in the DOM until opened" finds a `dialog` (the popover is always rendered). The portal tests report `parentElement` is the `.date-range` div, not `document.body`/host. The positioning test reports `pop.style.top` `""`. The Escape, apply and outside-click tests may already pass.

- [ ] **Step 3: Replace `date-range-field.tsx`**

Replace the whole of `apps/web/src/components/wm/date-range-field.tsx` with:

```tsx
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
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
      triggerRef.current?.focus();
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
```

- [ ] **Step 4: Add the one CSS rule**

In `apps/web/src/app/design-system.css`, directly after the **second** occurrence of

```css
.date-range__pop[data-open="true"] {
  display: block;
}
```

(the one in the "Date-range picker" section, ~:3287-3289, **not** the one at ~:2391), insert:

```css
/* Portaled by date-range-field.tsx; above dialogs (60) and toasts (80). */
.date-range__pop.date-range__pop--portal {
  z-index: 90;
}
```

Leave every other line of `design-system.css` untouched. That includes `@keyframes page-in` and `.page > * > *`.

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/components/wm/date-range-field.test.tsx "src/app/\(app\)/laporan" "src/app/\(app\)/transaksi"`
Expected: PASS. The 7 new tests are green, and every existing laporan/transaksi test is still green.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/wm/date-range-field.tsx src/components/wm/date-range-field.test.tsx`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/wm/date-range-field.tsx apps/web/src/components/wm/date-range-field.test.tsx apps/web/src/app/design-system.css
git commit -m "$(cat <<'EOF'
fix(date-range): portal the calendar popover so cards can no longer paint over it

The page-in animation leaves an identity transform on every card (fill-mode
both), making each one a stacking context the in-flow popover could not escape.
The popover now portals to body (or the enclosing dialog popup), is positioned
from the trigger rect, flips/clamps at the viewport edge, and sits at z-index 90.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `DateField`, the single-date sibling (shared grid, one click applies)

**Files:**

- Modify: `apps/web/src/components/wm/date-range-field.tsx` (import block; append `getMonthName` helper and `DateField` component at end of file)
- Modify: `apps/web/src/components/wm/index.tsx` (append one export line)
- Modify: `apps/web/src/i18n/types.ts:347`, `apps/web/src/i18n/id.ts:15`, `apps/web/src/i18n/en.ts:15` (`common` block)
- Test: `apps/web/src/components/wm/date-range-field.test.tsx`

**Interfaces:**

- Consumes (Task 1, same file): `todayIso`, `parseDateParts`, `formatFullDate`, `MonthView`, `shiftMonth`, `useAnchoredPopover`, `CalendarMonth`.
- Produces:

```ts
export function DateField(props: {
  value: string; // "YYYY-MM-DD" or ""
  locale: Locale;
  label: string; // popover aria-label; trigger aria-label prefix when no `id`
  onChange: (iso: string) => void; // "YYYY-MM-DD", or "" when cleared
  min?: string;
  max?: string;
  required?: boolean; // hides "Hapus tanggal"; native input gets `required`
  id?: string; // goes on the trigger <button> so an external <label htmlFor> names it
  name?: string; // goes on the sr-only native <input type="date">
}): JSX.Element;
```

- DOM contract that later tests rely on: root `div.date-range.date-field`. The trigger `button.date-range__trigger` carries `data-value={value}` and shows `formatFullDate(value)` or the placeholder. There is one sr-only `<input type="date">` inside the root whose `onChange` calls `onChange(e.target.value)`. The popover `role="dialog"` with `aria-label={label}` exists only while open.
- Barrel: `import { DateField, DateRangeFilterField } from "@/components/wm";`.
- i18n: `t.common.datePickerPlaceholder`, `t.common.datePickerYearLabel`, `t.common.datePickerClear`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/components/wm/date-range-field.test.tsx`, change the imports at the top to:

```tsx
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateField, DateRangeFilterField } from "./date-range-field";
```

and append at the end of the file:

```tsx
function ControlledDateField({
  initial = "",
  onChange,
  min,
  max,
  required,
}: {
  initial?: string;
  onChange?: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="df">Tanggal</label>
      <DateField
        id="df"
        value={value}
        locale="id"
        label="Tanggal"
        min={min}
        max={max}
        required={required}
        onChange={(iso) => {
          setValue(iso);
          onChange?.(iso);
        }}
      />
    </>
  );
}

describe("DateField", () => {
  it("is named by its external <label> and shows the placeholder when empty", () => {
    render(<ControlledDateField />);
    const trigger = screen.getByLabelText("Tanggal");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveTextContent("Pilih tanggal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("one click on a day emits the ISO date, closes, and shows 'D Month YYYY'", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<ControlledDateField initial="2026-09-10" onChange={onChange} />);
    const trigger = screen.getByLabelText("Tanggal");
    expect(trigger).toHaveTextContent("10 September 2026");

    await user.click(trigger);
    const pop = screen.getByRole("dialog", { name: "Tanggal" });
    expect(pop.parentElement).toBe(document.body);
    await user.click(within(pop).getByRole("button", { name: "15" }));

    expect(onChange).toHaveBeenCalledWith("2026-09-15");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("15 September 2026");
    expect(trigger).toHaveAttribute("data-value", "2026-09-15");
    expect(trigger).toHaveFocus();
  });

  it("jumps decades with the year select (birth dates)", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<ControlledDateField initial="2026-09-10" onChange={onChange} />);

    await user.click(screen.getByLabelText("Tanggal"));
    const pop = screen.getByRole("dialog", { name: "Tanggal" });
    await user.selectOptions(
      within(pop).getByRole("combobox", { name: "Tahun" }),
      "1990",
    );
    await user.click(within(pop).getByRole("button", { name: "1" }));

    expect(onChange).toHaveBeenCalledWith("1990-09-01");
  });

  it("disables days outside min/max", async () => {
    const user = userEvent.setup();
    render(
      <ControlledDateField
        initial="2026-09-10"
        min="2026-09-05"
        max="2026-09-20"
      />,
    );

    await user.click(screen.getByLabelText("Tanggal"));
    const pop = screen.getByRole("dialog", { name: "Tanggal" });

    expect(within(pop).getByRole("button", { name: "4" })).toBeDisabled();
    expect(within(pop).getByRole("button", { name: "21" })).toBeDisabled();
    expect(within(pop).getByRole("button", { name: "5" })).toBeEnabled();
    expect(within(pop).getByRole("button", { name: "20" })).toBeEnabled();
  });

  it("lets an optional date be cleared back to an empty string", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<ControlledDateField initial="2026-09-10" onChange={onChange} />);

    await user.click(screen.getByLabelText("Tanggal"));
    await user.click(
      within(screen.getByRole("dialog", { name: "Tanggal" })).getByRole(
        "button",
        { name: "Hapus tanggal" },
      ),
    );

    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.getByLabelText("Tanggal")).toHaveTextContent("Pilih tanggal");
  });

  it("offers no clear action on a required date", async () => {
    const user = userEvent.setup();
    render(<ControlledDateField initial="2026-09-10" required />);

    await user.click(screen.getByLabelText("Tanggal"));

    expect(
      within(screen.getByRole("dialog", { name: "Tanggal" })).queryByRole(
        "button",
        { name: "Hapus tanggal" },
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps a native date input in sync for forms and native validation", () => {
    const { container } = render(
      <ControlledDateField initial="2026-09-10" required />,
    );
    const native = container.querySelector<HTMLInputElement>(
      '.date-field input[type="date"]',
    );
    if (!native) throw new Error("native date input missing");

    expect(native).toHaveValue("2026-09-10");
    expect(native).toBeRequired();

    fireEvent.change(native, { target: { value: "2026-01-02" } });
    expect(screen.getByLabelText("Tanggal")).toHaveAttribute(
      "data-value",
      "2026-01-02",
    );
  });

  it("names itself from `label` + value when no external label is wired", () => {
    render(
      <DateField
        value="2026-09-10"
        locale="id"
        label="Tanggal laporan"
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Tanggal laporan: 10 September 2026",
      }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/components/wm/date-range-field.test.tsx`
Expected: FAIL. TypeScript/SWC reports `DateField` is not exported (`Element type is invalid` / `DateField is not a function`). All 8 `DateField` tests fail. The 7 Task 1 tests stay green.

- [ ] **Step 3: Add the i18n keys (all three files)**

`apps/web/src/i18n/types.ts`: in the `common` block, directly after `emojiGroupAriaLabel: string;` (line 347):

```ts
/** Single-date picker (components/wm/date-range-field.tsx `DateField`). */
datePickerPlaceholder: string;
datePickerYearLabel: string;
datePickerClear: string;
```

`apps/web/src/i18n/id.ts`: in `common`, directly after `emojiGroupAriaLabel: "Ikon yang sering dipakai",` (line 15):

```ts
    datePickerPlaceholder: "Pilih tanggal",
    datePickerYearLabel: "Tahun",
    datePickerClear: "Hapus tanggal",
```

`apps/web/src/i18n/en.ts`: same position (after line 15):

```ts
    datePickerPlaceholder: "Choose date",
    datePickerYearLabel: "Year",
    datePickerClear: "Clear date",
```

- [ ] **Step 4: Implement `DateField`**

In `apps/web/src/components/wm/date-range-field.tsx`:

1. Replace the two import lines

```tsx
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import type { Locale } from "@/i18n";
```

with

```tsx
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { en as enDict, id as idDict, type Locale } from "@/i18n";
```

2. Directly below `getMonthTitle(...)`, add:

```tsx
function getMonthName(month: number, locale: Locale): string {
  return new Date(2000, month, 1).toLocaleDateString(
    locale === "en" ? "en-US" : "id-ID",
    { month: "long" },
  );
}
```

3. Append at the end of the file:

```tsx
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
```

4. In `apps/web/src/components/wm/index.tsx`, append at the end:

```ts
// Revisi C — the one app-wide date picker (range + single date), portaled.
export { DateField, DateRangeFilterField } from "./date-range-field";
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/components/wm/date-range-field.test.tsx src/i18n`
Expected: PASS, 15 tests in `date-range-field.test.tsx`. `src/i18n/dictionary.test.ts` stays green (key parity).

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/wm/date-range-field.tsx src/components/wm/date-range-field.test.tsx src/components/wm/index.tsx src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/wm/date-range-field.tsx apps/web/src/components/wm/date-range-field.test.tsx apps/web/src/components/wm/index.tsx apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(date-field): add single-date DateField sharing the range picker's calendar

One click applies and closes; year select for distant dates; clear action for
optional dates; an sr-only native date input keeps name/required semantics.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `CrudModal` date fields → `DateField` (generic, shared by Tujuan + Asuransi CRUD)

**Files:**

- Modify: `apps/web/src/components/crud/crud-modal.tsx`: import block (:17), `useLocale` destructure (:140), remove the `f.type === "date"` branch in `renderControl` (:231-240), add a `date` branch in `renderField` directly before the `iconpick` branch (:288)
- Create: `apps/web/src/components/crud/crud-modal.test.tsx`

**Interfaces:**

- Consumes: Task 2 `DateField` from `@/components/wm`. `CRUD_CONFIG.tujuan` has `{ key: "deadline", label: "Target Tanggal", type: "date" }` (`crud-config.ts:316`). The modal's `values` state is keyed by field key; `onSubmit(entity, mode, values)` receives it (it never reads the DOM).
- Produces: every `type: "date"` CRUD field renders `<label htmlFor="crud-<entity>-<key>">` + `DateField id="crud-<entity>-<key>"`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/crud/crud-modal.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { setLocale } from "../../hooks/use-locale";
import { CrudModal } from "./crud-modal";

function localMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

describe("CrudModal — date fields use the shared DateField", () => {
  beforeEach(() => setLocale("id"));

  it("picks the tujuan deadline from the calendar inside the dialog and submits it as ISO", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <CrudModal
        state={{ entity: "tujuan", mode: "add" }}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: /tambah tujuan keuangan/i,
    });
    const trigger = within(dialog).getByLabelText("Target Tanggal");
    expect(trigger.tagName).toBe("BUTTON");

    await user.click(trigger);
    const pop = screen.getByRole("dialog", { name: "Target Tanggal" });
    expect(dialog).toContainElement(pop);

    await user.click(within(pop).getByRole("button", { name: "20" }));
    expect(
      screen.getByRole("dialog", { name: /tambah tujuan keuangan/i }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(onSubmit).toHaveBeenCalledWith(
      "tujuan",
      "add",
      expect.objectContaining({ deadline: `${localMonthPrefix()}-20` }),
    );
  });

  it("Escape closes only the picker, never the CRUD dialog around it", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(
      <CrudModal
        state={{ entity: "tujuan", mode: "add" }}
        onClose={onClose}
        onSubmit={jest.fn()}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: /tambah tujuan keuangan/i,
    });
    await user.click(within(dialog).getByLabelText("Target Tanggal"));
    expect(
      screen.getByRole("dialog", { name: "Target Tanggal" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Target Tanggal" }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: /tambah tujuan keuangan/i }),
    ).toBeInTheDocument();
  });

  it("pre-fills an edit with the stored date", async () => {
    render(
      <CrudModal
        state={{
          entity: "tujuan",
          mode: "edit",
          initialValues: { deadline: "2026-12-01" },
        }}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: /edit tujuan keuangan/i,
    });
    expect(within(dialog).getByLabelText("Target Tanggal")).toHaveTextContent(
      "1 Desember 2026",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/components/crud/crud-modal.test.tsx`
Expected: FAIL. `getByLabelText("Target Tanggal")` returns the native `<input>` (so `tagName` is `INPUT`), or it finds no element because the wrapping `<label>` text also contains other text.

- [ ] **Step 3: Implement**

In `apps/web/src/components/crud/crud-modal.tsx`:

1. Line 17: `import { EmojiPicker } from "@/components/wm";` → `import { DateField, EmojiPicker } from "@/components/wm";`
2. Line 140: `const { t } = useLocale();` → `const { t, locale } = useLocale();`
3. Delete the whole `if (f.type === "date") { … }` block inside `renderControl` (:231-240).
4. In `renderField`, directly **before** the comment block that starts `// The icon picker is a button group, which cannot live inside a` (:280), add:

```tsx
// A DateField is a button + portaled calendar, so it gets an explicit
// htmlFor pairing instead of the wrapping <label> other controls use.
if (f.type === "date") {
  const fieldId = `crud-${state.entity}-${f.key}`;
  return (
    <div key={f.key} className={fieldClass}>
      <label className="label" htmlFor={fieldId}>
        {f.label}
      </label>
      <DateField
        id={fieldId}
        value={values[f.key] ?? ""}
        locale={locale}
        label={f.label}
        onChange={(iso) => setField(f.key, iso)}
      />
      {hint && <span className="hint block">{hint}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/components/crud "src/app/\(app\)/tujuan"`
Expected: PASS. The 3 new tests are green, and `tujuan.test.tsx` is still green: its `findByRole("dialog")` sees only the Base UI dialog because the picker's popover is not mounted while closed.

If the Escape test fails because the CRUD dialog's `onClose` fires, Base UI is handling Escape before our listener. Confirm the handler is registered with `window.addEventListener("keydown", handleKeyDown, true)` and calls `event.stopPropagation()` (Task 1). Do not add a second listener.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/crud/crud-modal.tsx src/components/crud/crud-modal.test.tsx`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/crud/crud-modal.tsx apps/web/src/components/crud/crud-modal.test.tsx
git commit -m "$(cat <<'EOF'
feat(crud): render CRUD date fields with the shared DateField

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Transaction dialog "Tanggal" → `DateField`

**Files:**

- Modify: `apps/web/src/components/shell/transaction-dialog.tsx`: add import after `:28` (`useLocale` import), `useLocale` destructure (:184), the date `<input>` inside the Tanggal `Field` (:1065-1071)
- Modify: `apps/web/src/hooks/receipt-scan.ts:120` (doc comment only)
- Test: `apps/web/src/components/shell/transaction-dialog.test.tsx` (assertions near :822-825 and :1422-1424; new test in the first `describe`, after the "HIGH 2: an ordinary expense…" test ending :316)

**Interfaces:**

- Consumes: Task 2 `DateField` (`data-value` attribute on the trigger; popover `role="dialog"` named by `label`). `isoToDateInputValue` (`hooks/receipt-scan.ts:132`) is a pure string function that feeds `setDate` state. It never touches the DOM, so it needs no code change.
- Produces: nothing consumed later.

- [ ] **Step 1: Write / update the failing tests**

In `apps/web/src/components/shell/transaction-dialog.test.tsx`:

1. Add `within` to the `@testing-library/react` import (lines 15-22).

2. Replace (near :822-825)

```tsx
const expectedDate = isoToDateInputValue(SCAN_RESULT.occurredAt, "");
expect(
  screen.getByLabelText(mockDictionary.shell.transactionDialog.dateLabel),
).toHaveValue(expectedDate);
```

with

```tsx
const expectedDate = isoToDateInputValue(SCAN_RESULT.occurredAt, "");
expect(
  screen.getByLabelText(mockDictionary.shell.transactionDialog.dateLabel),
).toHaveAttribute("data-value", expectedDate);
```

3. Replace (near :1422-1424)

```tsx
expect(screen.getByLabelText(dict.dateLabel)).toHaveValue(
  isoToDateInputValue(SCAN_RESULT.occurredAt, ""),
);
```

with

```tsx
expect(screen.getByLabelText(dict.dateLabel)).toHaveAttribute(
  "data-value",
  isoToDateInputValue(SCAN_RESULT.occurredAt, ""),
);
```

4. Add to the first `describe` (after the test that ends at :316):

```tsx
it("Tanggal is the shared calendar: picking a day posts that day and keeps the dialog open", async () => {
  const user = userEvent.setup();
  render(<TransactionDialog />);
  const dateLabel = mockDictionary.shell.transactionDialog.dateLabel;

  await user.click(await screen.findByRole("tab", { name: /Pengeluaran/ }));
  await user.type(screen.getByPlaceholderText("250.000"), "50000");
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Akun" }),
    "acc-1",
  );

  const trigger = screen.getByLabelText(dateLabel);
  expect(trigger.tagName).toBe("BUTTON");
  await user.click(trigger);
  await user.click(
    within(screen.getByRole("dialog", { name: dateLabel })).getByRole(
      "button",
      { name: "20" },
    ),
  );
  expect(
    screen.queryByRole("dialog", { name: dateLabel }),
  ).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("250.000")).toHaveValue("50.000");

  await user.click(screen.getByRole("button", { name: "Simpan" }));

  // The dialog defaults to the UTC calendar day, so the calendar opens on that month.
  const viewMonth = new Date().toISOString().slice(0, 7);
  await waitFor(() => {
    const post = mockApiFetch.mock.calls.find(
      ([url, opts]) =>
        opts?.method === "POST" && String(url).endsWith("/transactions"),
    );
    expect(post).toBeDefined();
    expect(JSON.parse(String(post?.[1]?.body)).occurredAt).toBe(
      `${viewMonth}-20T00:00:00.000Z`,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/components/shell/transaction-dialog.test.tsx`
Expected: FAIL. The two scan tests fail because the native input has no `data-value` attribute. The new test fails because `trigger.tagName` is `INPUT`.

- [ ] **Step 3: Implement**

In `apps/web/src/components/shell/transaction-dialog.tsx`:

1. After `import { useLocale } from "@/hooks/use-locale";` (:28) add:

```tsx
import { DateField } from "@/components/wm";
```

2. `:184` `const { t } = useLocale();` → `const { t, locale } = useLocale();`

3. Replace the `<input id={dateFieldId} type="date" … />` inside the Tanggal `Field` (:1065-1071) with:

```tsx
<DateField
  id={dateFieldId}
  value={date}
  locale={locale}
  label={t.shell.transactionDialog.dateLabel}
  required
  onChange={setDate}
/>
```

`required` is deliberate: `new Date("").toISOString()` throws on submit, so the field must never be cleared to `""`.

In `apps/web/src/hooks/receipt-scan.ts:120`, change the doc line
`* The scan returns an ISO instant; the form's`<input type="date">` needs a`
to
` * The scan returns an ISO instant; the form's date field needs a`
(the next line, `*`yyyy-mm-dd`. …`, stays).

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/components/shell src/hooks/receipt-scan.test.ts`
Expected: PASS. Every `transaction-dialog.test.tsx` test is green (including the new one), and `receipt-scan.test.ts` is green.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/shell/transaction-dialog.tsx src/components/shell/transaction-dialog.test.tsx src/hooks/receipt-scan.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shell/transaction-dialog.tsx apps/web/src/components/shell/transaction-dialog.test.tsx apps/web/src/hooks/receipt-scan.ts
git commit -m "$(cat <<'EOF'
feat(shell): use the shared DateField for the transaction dialog's Tanggal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Batch-migrate the simple page date inputs

Each site below is a mechanical `value`/`onChange` swap. Keep the existing `<label htmlFor>` and move its `id` onto `DateField`. Each `label` prop is the same `t.…` key the visible label already uses.

**Files:**

- Modify: `apps/web/src/app/(app)/akun/page.tsx`: wm import (:67), `Field` labelable check (:178-191), `ProfilBody` `useLocale` (:356), birth date input (:466-472)
- Modify: `apps/web/src/app/(app)/aset/page.tsx`: wm import (:34), `AddAssetModal` `useLocale` (:192), acquisition date input (~:515-522)
- Modify: `apps/web/src/app/(app)/aset/[id]/page.tsx`: wm import (:25), `AddHistoryDialog` `useLocale` (:374), history date input (~:483-490)
- Modify: `apps/web/src/app/(app)/asuransi/page.tsx`: wm import (:20), `InsuranceModal` `useLocale` (:565), renewal input (~:860-866)
- Modify: `apps/web/src/app/(app)/donation/page.tsx`: wm import (the multi-line import ending :22), tanggal input (~:906-912). `locale` is already in scope (:170).
- Modify: `apps/web/src/app/(app)/investasi/page.tsx`: wm import (ending :25), `toDateInputValue` doc (:172), `AddInvestmentModal` `useLocale` (:453), inputs `purchasedAt` (:739-746), `maturityDate` (:953-960), `manualPriceDate` (:1034-1041); `BuySellModal` `useLocale` (:1102), `tx-date` (:1261-1268)
- Modify: `apps/web/src/app/(app)/liabilitas/page.tsx`: wm import (ending :50), `LiabilityModal` `useLocale` (:395), due date input (~:640-646)
- Modify: `apps/web/src/app/(app)/laporan/_components/sections/harian-section.tsx`: wm import (:1), input (:44-49)
- Modify: `apps/web/src/i18n/types.ts:3491`, `apps/web/src/i18n/id.ts:3707`, `apps/web/src/i18n/en.ts:3641` (`laporan.harian`)
- Test: `apps/web/src/app/(app)/aset/aset.test.tsx` (near :290-292), `apps/web/src/app/(app)/akun/profil-body.test.tsx` (near :64-84)
- Create: `apps/web/src/app/(app)/laporan/_components/sections/harian-section.test.tsx`

**Interfaces:**

- Consumes: Task 2 `DateField` from `@/components/wm`. The DOM contract: `.date-field` root, `data-value` on the trigger, an sr-only native `input[type="date"]` whose change calls `onChange`.
- Produces: `t.laporan.harian.dateLabel: string`.

Wherever a step says to change `const { t } = useLocale();` to `const { t, locale } = useLocale();`, check first. If that component already has a `locale` binding in scope, reuse it and skip the change.

- [ ] **Step 1: Write / update the failing tests**

(a) `apps/web/src/app/(app)/aset/aset.test.tsx`: replace (near :290-292)

```tsx
fireEvent.change(screen.getByLabelText(/Tanggal Perolehan/), {
  target: { value: "2024-01-15" },
});
```

with

```tsx
const acquisitionTrigger = screen.getByLabelText(/Tanggal Perolehan/);
expect(acquisitionTrigger.tagName).toBe("BUTTON");
const acquisitionNative = acquisitionTrigger
  .closest(".date-field")
  ?.querySelector<HTMLInputElement>('input[type="date"]');
if (!acquisitionNative) throw new Error("DateField native input missing");
fireEvent.change(acquisitionNative, { target: { value: "2024-01-15" } });
expect(acquisitionTrigger).toHaveTextContent("15 Januari 2024");
```

(b) `apps/web/src/app/(app)/akun/profil-body.test.tsx`:

- import line 8 → `import { fireEvent, render, screen, waitFor } from "@testing-library/react";`
- Replace the comment block + `birthDateInput` query (the `// Act — modify all fields …` comment through `container.querySelector('input[type="date"]')!;`) with:

```tsx
// Act — modify all fields and click save. "Tanggal Lahir" is a DateField
// (a button named by its label); "Jenis Kelamin" is still reached by role.
const nameInput = screen.getByDisplayValue("Test User");
const phoneInput = screen.getByPlaceholderText("+62 8xx xxxx xxxx");
const birthDateTrigger = screen.getByLabelText("Tanggal Lahir");
const birthDateInput = container.querySelector<HTMLInputElement>(
  '.date-field input[type="date"]',
);
if (!birthDateInput) throw new Error("DateField native input missing");
```

- Replace `await user.type(birthDateInput, "1990-01-01");` with:

```tsx
fireEvent.change(birthDateInput, { target: { value: "1990-01-01" } });
expect(birthDateTrigger).toHaveTextContent("1 Januari 1990");
```

The replaced span already contains the original `nameInput`/`phoneInput` declarations, so each is declared exactly once. If `t.akun.profil.birthDateLabel` in `id.ts` is not exactly `"Tanggal Lahir"`, use its exact text.

(c) Create `apps/web/src/app/(app)/laporan/_components/sections/harian-section.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { setLocale } from "../../../../../hooks/use-locale";
import { HarianSection } from "./harian-section";

describe("HarianSection — report day picker", () => {
  beforeEach(() => setLocale("id"));

  it("uses the shared calendar instead of a native date input", async () => {
    const onDateChange = jest.fn();
    const user = userEvent.setup();
    const { container } = render(
      <HarianSection date="2026-09-10" onDateChange={onDateChange} />,
    );

    expect(
      container.querySelector('input[type="date"]:not(.sr-only)'),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", {
        name: "Tanggal laporan: 10 September 2026",
      }),
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "Tanggal laporan" })).getByRole(
        "button",
        { name: "12" },
      ),
    );

    expect(onDateChange).toHaveBeenCalledWith("2026-09-12");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/aset" "src/app/\(app\)/akun/profil-body" "src/app/\(app\)/laporan/_components/sections"`
Expected: FAIL. aset: `tagName` is `INPUT`. profil: `getByLabelText("Tanggal Lahir")` finds nothing (the `Field` does not pair a non-native child), or `.date-field` is missing. harian: no button named "Tanggal laporan: …".

- [ ] **Step 3: Add the i18n key (all three files)**

`types.ts`: in `laporan.harian`, directly after `titlePrefix: string;` (:3491):

```ts
dateLabel: string;
```

`id.ts`: directly after `titlePrefix: "Laporan Harian ·",` (:3707):

```ts
      dateLabel: "Tanggal laporan",
```

`en.ts`: directly after `titlePrefix: "Daily Report ·",` (:3641):

```ts
      dateLabel: "Report date",
```

- [ ] **Step 4: Migrate the eight files**

**akun/page.tsx**

- `:67` → `import { SectionCard, StatusBadge, InfoTip, DateField } from "@/components/wm";`
- Replace `:178-191` (the `LABELABLE_TAGS` const through the `isLabelableElement` expression) so `Field` also pairs its label with a `DateField`:

```tsx
const LABELABLE_TAGS = new Set(["input", "select", "textarea"]);
const LABELABLE_COMPONENTS = new Set<unknown>([DateField]);

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const generatedId = useId();
  const isLabelableElement =
    isValidElement(children) &&
    ((typeof children.type === "string" &&
      LABELABLE_TAGS.has(children.type)) ||
      LABELABLE_COMPONENTS.has(children.type));
```

(The rest of `Field`, from `const childId = …` on, is unchanged.)

- `ProfilBody` `:356` → `const { t, locale } = useLocale();`
- Replace the birth date `<input type="date" … />` (:466-472) with:

```tsx
<DateField
  value={form.birthDate}
  locale={locale}
  label={t.akun.profil.birthDateLabel}
  max={new Date().toISOString().slice(0, 10)}
  onChange={(iso) => update("birthDate", iso)}
/>
```

**aset/page.tsx**

- `:34` → `import { IconChip, CountUpRupiah, Rise, DateField } from "@/components/wm";`
- `AddAssetModal` `:192` → `const { t, locale } = useLocale();`
- Replace the `<input id="asset-acquisition-date" type="date" … />` with:

```tsx
<DateField
  id="asset-acquisition-date"
  value={acquisitionDate}
  locale={locale}
  label={t.aset.fieldAcquisitionDateLabel}
  max={wibTodayDateString()}
  onChange={setAcquisitionDate}
/>
```

**aset/[id]/page.tsx**

- `:25` → `import { SectionCard, DateField } from "@/components/wm";`
- `AddHistoryDialog` `:374` → `const { t, locale } = useLocale();`
- Replace the `<input id={`${fieldId}-date`} type="date" … />` with:

```tsx
<DateField
  id={`${fieldId}-date`}
  value={recordedAt}
  locale={locale}
  label={t.aset.historyDateLabel}
  max={new Date().toISOString().slice(0, 10)}
  onChange={setRecordedAt}
/>
```

**asuransi/page.tsx**

- `:20` → `import { StatusBadge, SectionCard, DateField } from "@/components/wm";`
- `InsuranceModal` `:565` → `const { t, locale } = useLocale();`
- Replace `<input id="ins-renewal" type="date" … />` with:

```tsx
<DateField
  id="ins-renewal"
  value={renewalDate}
  locale={locale}
  label={t.asuransi.fieldRenewalDateLabel}
  onChange={setRenewalDate}
/>
```

**donation/page.tsx**

- Add `DateField,` to the existing multi-line `from "@/components/wm"` import (ends :22).
- Replace `<input id="dn-tanggal" type="date" … />` with:

```tsx
<DateField
  id="dn-tanggal"
  value={tanggal}
  locale={locale}
  label={t.donation.fieldTanggalLabel}
  onChange={setTanggal}
/>
```

**investasi/page.tsx**

- Add `DateField,` to the existing multi-line `from "@/components/wm"` import (ends :25).
- `:172` doc → `/** yyyy-mm-dd for a DateField value, or "" when absent. */`
- `AddInvestmentModal` `:453` → `const { t, locale } = useLocale();`
- Replace the `purchasedAt` input (:739-746) with:

```tsx
<DateField
  id="purchasedAt"
  name="purchasedAt"
  value={form.purchasedAt}
  locale={locale}
  label={t.investasi.fieldPurchaseDateLabel}
  onChange={(iso) => setForm((prev) => ({ ...prev, purchasedAt: iso }))}
/>
```

- Replace the `maturityDate` input (:953-960) with:

```tsx
<DateField
  id="maturityDate"
  name="maturityDate"
  value={form.maturityDate}
  locale={locale}
  label={t.investasi.fieldMaturityDateLabel}
  onChange={(iso) => setForm((prev) => ({ ...prev, maturityDate: iso }))}
/>
```

- Replace the `manualPriceDate` input (:1034-1041) with:

```tsx
<DateField
  id="manualPriceDate"
  name="manualPriceDate"
  value={form.manualPriceDate}
  locale={locale}
  label={t.investasi.fieldManualPriceDateLabel}
  onChange={(iso) => setForm((prev) => ({ ...prev, manualPriceDate: iso }))}
/>
```

- `BuySellModal` `:1102` → `const { t, locale } = useLocale();`
- Replace the `tx-date` input (:1261-1268) with:

```tsx
<DateField
  id="tx-date"
  value={occurredAt}
  locale={locale}
  label={t.investasi.buySellFieldDateLabel}
  required
  onChange={setOccurredAt}
/>
```

**liabilitas/page.tsx**

- Add `DateField,` to the existing multi-line `from "@/components/wm"` import (ends :50).
- `LiabilityModal` `:395` → `const { t, locale } = useLocale();`
- Replace `<input id="liability-due-date" type="date" … />` with:

```tsx
<DateField
  id="liability-due-date"
  value={dueDate}
  locale={locale}
  label={t.liabilitas.fieldDueDateLabel}
  onChange={setDueDate}
/>
```

**laporan/\_components/sections/harian-section.tsx**

- `:1` → `import { DateField, SectionCard } from "@/components/wm";`
- Replace the `<input type="date" … />` (:44-49) with:

```tsx
<DateField
  value={date}
  locale={locale}
  label={t.laporan.harian.dateLabel}
  required
  onChange={onDateChange}
/>
```

The setters passed directly (`setAcquisitionDate`, `setRecordedAt`, `setRenewalDate`, `setTanggal`, `setOccurredAt`, `setDueDate`) are `useState<string>` setters, so passing them as `(iso: string) => void` type-checks. If any of them is typed differently, wrap it: `onChange={(iso) => setX(iso)}`.

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(akun|aset|asuransi|donation|investasi|liabilitas|laporan)" src/i18n`
Expected: PASS. The harian test, updated aset test and updated profil test are green, and every pre-existing test in those folders is still green.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/akun/page.tsx" "src/app/(app)/akun/profil-body.test.tsx" "src/app/(app)/aset/page.tsx" "src/app/(app)/aset/aset.test.tsx" "src/app/(app)/aset/[id]/page.tsx" "src/app/(app)/asuransi/page.tsx" "src/app/(app)/donation/page.tsx" "src/app/(app)/investasi/page.tsx" "src/app/(app)/liabilitas/page.tsx" "src/app/(app)/laporan/_components/sections/harian-section.tsx" "src/app/(app)/laporan/_components/sections/harian-section.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/akun" "apps/web/src/app/(app)/aset" "apps/web/src/app/(app)/asuransi/page.tsx" "apps/web/src/app/(app)/donation/page.tsx" "apps/web/src/app/(app)/investasi/page.tsx" "apps/web/src/app/(app)/liabilitas/page.tsx" "apps/web/src/app/(app)/laporan/_components/sections" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(web): replace native date inputs on akun, aset, asuransi, donasi, investasi, liabilitas, harian with DateField

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Transaksi edit date → `DateField`; Ringkasan custom trend range → `DateRangeFilterField`; final sweep

**Files:**

- Modify: `apps/web/src/app/(app)/transaksi/page.tsx`: wm import (:45), `EditTransactionDialog` becomes `export function` (:969), its `useLocale` (:982), the Tanggal `<label className="field">` block (:1059-1067)
- Modify: `apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx`: imports (:11-14), `useLocale` (:43), the custom-range block (:106-137)
- Create: `apps/web/src/app/(app)/transaksi/edit-transaction-dialog.test.tsx`
- Create: `apps/web/src/app/(app)/ringkasan/_components/page-lead.test.tsx`

**Interfaces:**

- Consumes: Task 2 `DateField`; Task 1 `DateRangeFilterField` (`from`, `to`, `locale`, `label`, `cancelLabel`, `applyLabel`, `onApply(from, to)`). `TrendCustomRange = { from: string; to: string }` (`ringkasan/_components/use-ringkasan-data.ts:53`). Existing keys: `t.transaksi.fieldDateLabel` ("Tanggal"), `t.transaksi.saveButton` ("Simpan"), `t.ringkasan.trendRangeLabelCustom` ("Kustom"), `t.common.cancel`, `t.common.save`.
- Produces: `export function EditTransactionDialog(...)` from `transaksi/page.tsx` (same props as today, now exported for the test, like `TxRow`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/app/(app)/transaksi/edit-transaction-dialog.test.tsx`:

```tsx
import type { ReactElement } from "react";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TransactionDto } from "@wealthme/contracts";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { setLocale } from "../../../hooks/use-locale";
import { EditTransactionDialog } from "./page";

const TX = {
  id: "tx-1",
  amount: "50000",
  description: "Makan siang",
  occurredAt: "2026-09-10T05:00:00.000Z",
} as unknown as TransactionDto;

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return rtlRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setLocale("id");
  mockApiFetch.mockResolvedValue({});
});

it("edits the date through the shared calendar and PATCHes that day", async () => {
  const user = userEvent.setup();
  render(
    <EditTransactionDialog
      tx={TX}
      token="t"
      familyGroupId="fg-1"
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />,
  );

  const trigger = await screen.findByLabelText("Tanggal");
  expect(trigger.tagName).toBe("BUTTON");
  expect(trigger).toHaveTextContent("10 September 2026");

  await user.click(trigger);
  await user.click(
    within(screen.getByRole("dialog", { name: "Tanggal" })).getByRole(
      "button",
      { name: "12" },
    ),
  );
  await user.click(screen.getByRole("button", { name: "Simpan" }));

  await waitFor(() => {
    const patch = mockApiFetch.mock.calls.find(
      ([, opts]) =>
        (opts as { method?: string } | undefined)?.method === "PATCH",
    );
    expect(patch?.[0]).toBe("/family-groups/fg-1/transactions/tx-1");
    expect(JSON.parse(String(patch?.[1]?.body)).occurredAt).toBe(
      "2026-09-12T00:00:00.000Z",
    );
  });
});
```

Create `apps/web/src/app/(app)/ringkasan/_components/page-lead.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { setLocale } from "../../../../hooks/use-locale";
import { RingkasanPageLead } from "./page-lead";
import type { TrendCustomRange, TrendRangeKey } from "./use-ringkasan-data";

function localMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function renderLead(
  trendRange: TrendRangeKey,
  customRange: TrendCustomRange = { from: "", to: "" },
) {
  const onCustomRangeChange = jest.fn();
  const result = render(
    <RingkasanPageLead
      familyName="Keluarga Demo"
      todayLabel="25 September 2026"
      trendRange={trendRange}
      onTrendRangeChange={jest.fn()}
      customRange={customRange}
      onCustomRangeChange={onCustomRangeChange}
      displayCurrency="IDR"
      onDisplayCurrencyChange={jest.fn()}
      privacyOn={false}
      onTogglePrivacy={jest.fn()}
    />,
  );
  return { ...result, onCustomRangeChange };
}

describe("RingkasanPageLead — custom trend range", () => {
  beforeEach(() => setLocale("id"));

  it("renders no range picker unless the custom range is selected", () => {
    renderLead("6m");
    expect(
      screen.queryByRole("button", { name: /semua tanggal/i }),
    ).not.toBeInTheDocument();
  });

  it("uses the shared range picker, not two native date inputs", async () => {
    const user = userEvent.setup();
    const { container, onCustomRangeChange } = renderLead("custom");

    expect(container.querySelector('input[type="date"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: /semua tanggal/i }));
    const pop = screen.getByRole("dialog", { name: "Kustom" });
    await user.click(within(pop).getByRole("button", { name: "3" }));
    await user.click(within(pop).getByRole("button", { name: "10" }));
    await user.click(within(pop).getByRole("button", { name: "Simpan" }));

    const month = localMonthPrefix();
    expect(onCustomRangeChange).toHaveBeenCalledWith({
      from: `${month}-03`,
      to: `${month}-10`,
    });
  });

  it("shows the chosen custom range on the trigger", () => {
    renderLead("custom", { from: "2026-08-01", to: "2026-08-15" });
    expect(
      screen.getByRole("button", { name: "1 – 15 Agustus 2026" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/transaksi/edit-transaction-dialog" "src/app/\(app\)/ringkasan"`
Expected: FAIL. `EditTransactionDialog` is not exported (`Element type is invalid`). page-lead finds `input[type="date"]` and no "Semua tanggal" button.

- [ ] **Step 3: Implement transaksi**

In `apps/web/src/app/(app)/transaksi/page.tsx`:

- `:45` → `import { SectionCard, CardLink, StatusBadge, IconChip, DateField } from "@/components/wm";`
- `:969` `function EditTransactionDialog({` → `export function EditTransactionDialog({`
- `:982` `const { t } = useLocale();` → `const { t, locale } = useLocale();`
- Replace the Tanggal block (:1059-1067):

```tsx
<label className="field">
  <span className="label">{t.transaksi.fieldDateLabel}</span>
  <input
    type="date"
    className="input"
    value={date}
    onChange={(e) => setDate(e.target.value)}
  />
</label>
```

with

```tsx
<div className="field">
  <label className="label" htmlFor="tx-edit-date">
    {t.transaksi.fieldDateLabel}
  </label>
  <DateField
    id="tx-edit-date"
    value={date}
    locale={locale}
    label={t.transaksi.fieldDateLabel}
    required
    onChange={setDate}
  />
</div>
```

- [ ] **Step 4: Implement ringkasan page-lead**

In `apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx`:

- After `import { Eye, EyeOff } from "lucide-react";` (:11) add a blank line and:

```tsx
import { DateRangeFilterField } from "@/components/wm";
```

- `:43` `const { t } = useLocale();` → `const { t, locale } = useLocale();`
- Replace the whole `{trendRange === "custom" && ( <div className="row gap-2"> … </div> )}` block (:106-137) with:

```tsx
{
  trendRange === "custom" && (
    <div className="min-w-[240px]">
      <DateRangeFilterField
        from={customRange.from}
        to={customRange.to}
        locale={locale}
        label={t.ringkasan.trendRangeLabelCustom}
        cancelLabel={t.common.cancel}
        applyLabel={t.common.save}
        onApply={(from, to) => onCustomRangeChange({ from, to })}
      />
    </div>
  );
}
```

`t.ringkasan.trendCustomFromLabel` / `trendCustomToLabel` become unused. Leave the dictionary keys in place: removing them is out of scope.

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/transaksi" "src/app/\(app\)/ringkasan"`
Expected: PASS. The 4 new tests are green, and every pre-existing transaksi/ringkasan test is still green.

- [ ] **Step 6: Final sweep (no native date inputs left + type gate)**

Run (from `apps/web`): `grep -rn 'type="date"' src | grep -v '\.test\.'`
Expected: exactly one hit, `src/components/wm/date-range-field.tsx` (the sr-only native input inside `DateField`).

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0.

Run (from `apps/web`): `pnpm exec jest src/components/wm src/components/crud src/components/shell "src/app/\(app\)/(akun|aset|asuransi|donation|investasi|liabilitas|laporan|transaksi|ringkasan|tujuan)"`
Expected: PASS.

- [ ] **Step 7: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/transaksi/page.tsx" "src/app/(app)/transaksi/edit-transaction-dialog.test.tsx" "src/app/(app)/ringkasan/_components/page-lead.tsx" "src/app/(app)/ringkasan/_components/page-lead.test.tsx"`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(app)/transaksi/page.tsx" "apps/web/src/app/(app)/transaksi/edit-transaction-dialog.test.tsx" "apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx" "apps/web/src/app/(app)/ringkasan/_components/page-lead.test.tsx"
git commit -m "$(cat <<'EOF'
feat(web): DateField for Transaksi edit, shared range picker for Ringkasan custom trend

Completes the one-date-picker migration: no native date inputs remain.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```
