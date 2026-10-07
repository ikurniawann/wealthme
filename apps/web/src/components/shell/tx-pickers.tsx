"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Baby,
  BookOpen,
  Briefcase,
  Car,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  MoreHorizontal,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { formatAmountInput } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import { MoneyCurrencyPicker } from "@/components/money/currency-picker";
import { currencySymbol } from "@/components/money/money-format";
import { MoneyHint } from "@/components/money/money-input";
import type { MoneyField } from "@/components/money/use-money-field";

/**
 * Bento v2 add-transaction pieces (docs/design/proto `.tx` dialog): the big
 * underlined amount, and tile pickers for account and category. Tiles are a
 * `radiogroup`; arrow keys move and select, like native radios.
 */

export type Choice = {
  value: string;
  label: ReactNode;
  sub?: ReactNode;
  caption?: ReactNode;
  icon?: ReactNode;
  name: string;
};

export function ChoiceTiles({
  id,
  label,
  value,
  onChange,
  choices,
  variant,
  empty,
  limit,
  moreLabel,
  invalid,
  errorId,
  countLabel,
}: {
  /** Id of the radiogroup, so a failed submit can move focus into it (`focusChoiceTiles`). */
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: Choice[];
  variant: "account" | "category";
  empty?: ReactNode;
  /** Show only this many tiles until "more" is tapped (the selection always stays visible). */
  limit?: number;
  moreLabel?: string;
  /** Marks the group invalid and points at the inline error for assistive tech. */
  invalid?: boolean;
  errorId?: string;
  /** "3 dari 6": the cue that tiles are hidden when accounts scroll instead of wrap. */
  countLabel?: (shown: number, total: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, shown: 0 });
  // Account tiles are always one swipeable row of small chips, never a
  // wrapped grid — request 2026-10-07: the grid (shown above 720px or at
  // <=6 accounts) felt dense at every width it appeared at, not just a
  // narrow one, so the row is now the only account layout.
  const scrolls = variant === "account";
  const sync = () => {
    const el = ref.current;
    if (!el || !scrolls) return;
    const start = el.scrollLeft <= 2;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    // A tile only counts as seen when it is wholly inside the scroller.
    const box = el.getBoundingClientRect();
    let shown = 0;
    for (const tile of el.querySelectorAll<HTMLElement>(".tx-tile")) {
      const rect = tile.getBoundingClientRect();
      if (rect.left >= box.left - 2 && rect.right <= box.right + 2) shown += 1;
    }
    // Only update on a real change: this runs after every render.
    setEdges((prev) =>
      prev.start === start && prev.end === end && prev.shown === shown
        ? prev
        : { start, end, shown },
    );
  };
  useEffect(sync);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step || choices.length === 0) return;
    event.preventDefault();
    const index = Math.max(
      0,
      choices.findIndex((choice) => choice.value === value),
    );
    const next = choices[(index + step + choices.length) % choices.length];
    onChange(next.value);
    ref.current
      ?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)
      ?.focus();
  }

  if (choices.length === 0) return <p className="wm-cap">{empty}</p>;
  const selectedIndex = choices.findIndex((choice) => choice.value === value);
  const collapsed = Boolean(
    limit && !expanded && choices.length > limit + 1 && selectedIndex < limit,
  );
  const shown = collapsed ? choices.slice(0, limit) : choices;

  return (
    <div className="tx-tiles-wrap" data-variant={variant}>
      <div
        ref={ref}
        id={id}
        role="radiogroup"
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        data-value={value}
        className="tx-tiles"
        data-variant={variant}
        data-count={variant === "account" ? choices.length : undefined}
        data-layout={
          variant === "account" ? (scrolls ? "scroll" : "grid") : undefined
        }
        data-fade-start={scrolls && !edges.start ? "true" : undefined}
        data-fade-end={scrolls && !edges.end ? "true" : undefined}
        onKeyDown={onKeyDown}
        onScroll={sync}
      >
        {shown.map((choice, index) => {
          const checked = choice.value === value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={choice.name}
              tabIndex={
                checked || (selectedIndex === -1 && index === 0) ? 0 : -1
              }
              data-value={choice.value}
              className="tx-tile"
              onClick={() => onChange(choice.value)}
            >
              {choice.icon && (
                <span className="tx-tile-ic" aria-hidden="true">
                  {choice.icon}
                </span>
              )}
              <b>{choice.label}</b>
              {choice.caption && <small>{choice.caption}</small>}
              {choice.sub && <span className="tx-tile-sub">{choice.sub}</span>}
            </button>
          );
        })}
        {collapsed && (
          <button
            type="button"
            className="tx-tile"
            onClick={() => setExpanded(true)}
          >
            <span className="tx-tile-ic" aria-hidden="true">
              <MoreHorizontal />
            </span>
            <b>{moreLabel}</b>
          </button>
        )}
      </div>
      {scrolls && !edges.start && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="wm-rail-btn"
          data-side="prev"
          onClick={() =>
            ref.current?.scrollBy({ left: -180, behavior: "smooth" })
          }
        >
          <ChevronLeft />
        </button>
      )}
      {scrolls && !edges.end && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="wm-rail-btn"
          data-side="next"
          onClick={() =>
            ref.current?.scrollBy({ left: 180, behavior: "smooth" })
          }
        >
          <ChevronRight />
        </button>
      )}
      {scrolls &&
        countLabel &&
        edges.shown > 0 &&
        edges.shown < choices.length && (
          <p className="tx-tiles-count" aria-hidden="true">
            {countLabel(edges.shown, choices.length)}
          </p>
        )}
    </div>
  );
}

/** Moves focus to the roving tile of a `ChoiceTiles` radiogroup (first invalid field after a failed submit). */
export function focusChoiceTiles(id: string) {
  document
    .getElementById(id)
    ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
    ?.focus();
}

/** What the dialog remembers per family group between openings. */
export type TxnMemory = {
  accountId: string | null;
  /** Last-used category per category kind: an income category is no default for an expense. */
  categoryId: { income: string | null; expense: string | null };
  /** How often each category was used (most-used categories lead the picker). */
  counts: Record<string, number>;
};

const MAX_REMEMBERED_CATEGORIES = 200;

export function emptyTxnMemory(): TxnMemory {
  return {
    accountId: null,
    categoryId: { income: null, expense: null },
    counts: {},
  };
}

export function txnMemoryKey(familyGroupId: string): string {
  return `wm.txn-memory.${familyGroupId}`;
}

function asId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Reads the entry defensively: missing storage, bad JSON or wrong shapes all fall back to empty. */
export function readTxnMemory(familyGroupId: string): TxnMemory {
  const memory = emptyTxnMemory();
  if (!familyGroupId || typeof window === "undefined") return memory;
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(txnMemoryKey(familyGroupId)) ?? "null",
    );
    if (!parsed || typeof parsed !== "object") return memory;
    const entry = parsed as Record<string, unknown>;
    memory.accountId = asId(entry.accountId);
    const categories = entry.categoryId;
    if (categories && typeof categories === "object") {
      const byKind = categories as Record<string, unknown>;
      memory.categoryId = {
        income: asId(byKind.income),
        expense: asId(byKind.expense),
      };
    }
    const counts = entry.counts;
    if (counts && typeof counts === "object") {
      for (const [categoryId, count] of Object.entries(counts)) {
        if (typeof count === "number" && Number.isFinite(count) && count > 0)
          memory.counts[categoryId] = Math.floor(count);
      }
    }
  } catch {
    return emptyTxnMemory();
  }
  return memory;
}

/** Stores the account/category a saved transaction used and bumps the category's use count. */
export function recordTxnUsage(
  familyGroupId: string,
  usage: {
    accountId?: string | null;
    categoryId?: string | null;
    kind: "income" | "expense";
  },
): void {
  if (!familyGroupId || typeof window === "undefined") return;
  const memory = readTxnMemory(familyGroupId);
  if (usage.accountId) memory.accountId = usage.accountId;
  if (usage.categoryId) {
    memory.categoryId[usage.kind] = usage.categoryId;
    memory.counts[usage.categoryId] =
      (memory.counts[usage.categoryId] ?? 0) + 1;
  }
  const ranked = Object.entries(memory.counts).sort((a, b) => b[1] - a[1]);
  memory.counts = Object.fromEntries(
    ranked.slice(0, MAX_REMEMBERED_CATEGORIES),
  );
  try {
    window.localStorage.setItem(
      txnMemoryKey(familyGroupId),
      JSON.stringify(memory),
    );
  } catch {
    // Private mode or a full quota: remembering is a convenience, never a failure.
  }
}

/** Most-used first, then alphabetical. Never mutates the input. */
export function sortByUsage<T extends { id: string; name: string }>(
  items: readonly T[],
  counts: Record<string, number>,
): T[] {
  return [...items].sort(
    (a, b) =>
      (counts[b.id] ?? 0) - (counts[a.id] ?? 0) ||
      a.name.localeCompare(b.name, "id"),
  );
}

const CATEGORY_ICONS: [RegExp, LucideIcon][] = [
  [/makan|minum|food|resto|kuliner|jajan/i, Utensils],
  [/transport|bensin|ojek|parkir|tol|kendaraan|mobil|motor/i, Car],
  [/rumah|kpr|sewa|kontrakan|house|rent/i, House],
  [/belanja|shopping|groceries|pasar/i, ShoppingBag],
  [/sehat|dokter|obat|rumah sakit|health|medic/i, HeartPulse],
  [/pendidikan|sekolah|kuliah|kursus|education|school/i, GraduationCap],
  [/zakat|donasi|sedekah|infaq|amal|persepuluhan|charity/i, HandHeart],
  [/listrik|air|internet|utilitas|tagihan|pulsa|bill|utility/i, Zap],
  [/cicilan|kredit|pinjam|loan|debt/i, Receipt],
  [/tabung|saving/i, PiggyBank],
  [/investasi|saham|reksa|invest|dividen/i, TrendingUp],
  [/gaji|salary|upah|payroll/i, Briefcase],
  [/bonus|thr|hadiah|gift|kado/i, Gift],
  [/anak|bayi|child|baby/i, Baby],
  [/liburan|travel|wisata|holiday/i, Plane],
  [/gadget|elektronik|hp|phone/i, Smartphone],
  [/buku|book/i, BookOpen],
  [/bunga|interest|pajak|tax|bank/i, Landmark],
  [/uang saku|jajan|allowance|dompet/i, Wallet],
];

/** Line icon for a category by its name (the stored emoji is not used in the bento UI). */
export function categoryIcon(name: string): LucideIcon {
  for (const [pattern, Icon] of CATEGORY_ICONS)
    if (pattern.test(name)) return Icon;
  return Coins;
}

/** Render the category's line icon (component form of `categoryIcon`, safe to use in render). */
export function CategoryIcon({ name }: { name: string }) {
  const Icon = categoryIcon(name);
  // eslint-disable-next-line react-hooks/static-components -- picks one of a fixed set of module-level icons
  return <Icon />;
}

/** The prototype's big amount: "Rp" + 40px number on a lime underline; foreign currency folds away. */
export function AmountHero({
  field,
  id,
  label,
  placeholder,
  required,
  error,
}: {
  field: MoneyField;
  id: string;
  label: ReactNode;
  placeholder: string;
  /** audit P2-4/AC-7 — shows a `*` marker next to the label. */
  required?: boolean;
  /** audit P2-4/AC-7 — inline, field-level validation message. */
  error?: string;
}) {
  const { locale } = useLocale();
  const code = field.currency;
  return (
    <div className="tx-amount-field">
      <label htmlFor={id} className="label">
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        )}
      </label>
      <div className="tx-amount">
        <span aria-hidden="true">{currencySymbol(code, locale)}</span>
        <input
          id={id}
          inputMode={field.decimals > 0 ? "decimal" : "numeric"}
          placeholder={placeholder}
          value={field.raw}
          onChange={(event) => field.setRaw(event.target.value)}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {/* uiarc.dev money-input reference — currency sits inline, to the
            right of the amount, not behind a collapsed disclosure. */}
        <MoneyCurrencyPicker
          value={code}
          onChange={(nextCode) => field.setCurrency(nextCode)}
        />
      </div>
      {code === "IDR" && <QuickAddChips field={field} />}
      <MoneyHint field={field} />
      {error && (
        <p id={`${id}-error`} role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}

/** uiarc.dev money-input reference — quick-add chips. IDR-only: round
 * increments (+10rb/+50rb/+100rb) aren't meaningful to guess for an
 * arbitrary foreign currency the way they are for everyday Rupiah amounts. */
function QuickAddChips({ field }: { field: MoneyField }) {
  const { t } = useLocale();
  const add = (amount: number) => {
    const current = field.resolved.canonical
      ? Number(field.resolved.canonical)
      : 0;
    field.setRaw(String(current + amount));
  };
  return (
    <div
      className="tx-quick mt-2 flex gap-1.5 min-[721px]:mt-1.5"
      role="group"
      aria-label={t.shell.transactionDialog.quickAddAriaLabel}
    >
      {QUICK_ADD_IDR.map((amount) => (
        <button
          key={amount}
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => add(amount)}
        >
          +{formatAmountInput(String(amount))}
        </button>
      ))}
    </div>
  );
}

const QUICK_ADD_IDR = [10_000, 50_000, 100_000];
