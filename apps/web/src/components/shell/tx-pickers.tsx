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
  Check,
  ChevronDown,
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
import { CURRENCIES, type CurrencyCode } from "@/hooks/currencies";
import { formatAmountInput } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import { MoneyHint } from "@/components/money/money-input";
import type { MoneyField } from "@/components/money/use-money-field";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

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
  label,
  value,
  onChange,
  choices,
  variant,
  empty,
  limit,
  moreLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: Choice[];
  variant: "account" | "category";
  empty?: ReactNode;
  /** Show only this many tiles until "more" is tapped (the selection always stays visible). */
  limit?: number;
  moreLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const sync = () => {
    const el = ref.current;
    if (!el || variant !== "account") return;
    const start = el.scrollLeft <= 2;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    // Only update on a real change: this runs after every render.
    setEdges((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
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
        role="radiogroup"
        aria-label={label}
        data-value={value}
        className="tx-tiles"
        data-variant={variant}
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
              {choice.caption && <small>{choice.caption}</small>}
              <b>{choice.label}</b>
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
      {variant === "account" && !edges.start && (
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
      {variant === "account" && !edges.end && (
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
    </div>
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
        {code === "IDR" && <span aria-hidden="true">Rp</span>}
        <input
          id={id}
          inputMode={field.decimals > 0 ? "decimal" : "numeric"}
          placeholder={placeholder}
          value={field.raw}
          onChange={(event) => field.setRaw(event.target.value)}
          autoComplete="off"
        />
        {/* uiarc.dev money-input reference — currency sits inline, to the
            right of the amount, not behind a collapsed disclosure. */}
        <CurrencyPicker
          value={code}
          onChange={(nextCode) => field.setCurrency(nextCode)}
        />
      </div>
      {code === "IDR" && <QuickAddChips field={field} />}
      <MoneyHint field={field} />
      {error && (
        <p role="alert" className="error-text">
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
      className="mt-2 flex gap-1.5"
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

/** uiarc.dev money-input reference (user-supplied screenshot) — a trigger
 * pill showing the current currency, opening a list of rows (flag, code
 * bold, full name muted, a checkmark on the selected row). Built on the
 * existing Base UI `DropdownMenu` primitive rather than adopting uiarc's
 * component wholesale: WealthMe's `CURRENCIES`/`MoneyField` data shape and
 * IDR-only default already cover this picker's needs. */
function CurrencyPicker({
  value,
  onChange,
}: {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
}) {
  const { t } = useLocale();
  const current = CURRENCIES.find((c) => c.code === value) ?? CURRENCIES[0]!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-auto flex shrink-0 w-auto items-center gap-1.5 self-center rounded-full border px-3 py-1.5 text-[13px] font-bold"
        aria-label={t.money.currencyLabel}
      >
        <span aria-hidden="true">{current.flag}</span>
        {current.code}
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {CURRENCIES.map((currency) => {
          const name = t.akun.pengaturan.currencies[currency.code].name;
          const selected = currency.code === value;
          return (
            <DropdownMenuItem
              key={currency.code}
              onClick={() => onChange(currency.code)}
              className="gap-2.5 py-2"
            >
              <span aria-hidden="true" className="text-base">
                {currency.flag}
              </span>
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <span className="font-bold">{currency.code}</span>
                <span className="truncate text-muted-foreground">{name}</span>
              </span>
              {selected && (
                <Check aria-hidden="true" className="size-4 shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
