"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bento v2 kit (docs/design/proto: `.bento`, `.card.hero.dark`, `.kpis`,
 * `.btile`, `.mini-list`, `.arow`, `.cstack`, `.tips`). Styling lives in
 * `src/app/bento.css`; these components only own markup and a11y.
 */

/* ───────────── layout ───────────── */

/** 12-column bento grid. Children place themselves with `area` / className. */
export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("wm-bento", className)}>{children}</div>;
}

type Area = "main" | "side" | "full";
const AREA_CLASS: Record<Area, string> = {
  main: "wm-col-main",
  side: "wm-col-side",
  full: "wm-col-full",
};

/** A white bento card: optional head (h2 + one-line caption + one action). */
export function BentoCard({
  title,
  caption,
  action,
  area,
  className,
  style,
  children,
}: {
  title?: ReactNode;
  caption?: ReactNode;
  action?: ReactNode;
  area?: Area;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn("wm-card", area && AREA_CLASS[area], className)}
      style={style}
    >
      {(title || action) && (
        <div className="wm-card-head">
          <div className="min-w-0">
            {title && <h2>{title}</h2>}
            {caption && <p className="wm-cap">{caption}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ───────────── controls ───────────── */

export function GhostButton({
  lit = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { lit?: boolean }) {
  return (
    <button
      type="button"
      data-lit={lit || undefined}
      className={cn("wm-ghost-btn", className)}
      {...props}
    />
  );
}

/** Pill button for dialog/panel footers and inline actions. Primary is dark with a lime arrow. */
export function PillButton({
  variant = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      data-variant={variant === "default" ? undefined : variant}
      className={cn("wm-pill", className)}
      {...props}
    />
  );
}

/** Segmented filter (replaces tabs where a filter is enough). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("wm-seg", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── hero ───────────── */

/**
 * The dark hero every page opens with: one big number, a one-line caption, at
 * most two controls, a real-data chart and a KPI column.
 */
export function BentoHero({
  value,
  currency = "Rp",
  caption,
  controls,
  chart,
  kpis,
  area = "main",
  className,
  style,
  valueAs: ValueTag = "p",
}: {
  value: ReactNode;
  /** Render the big number as the page's `h1` when the hero is the page head. */
  valueAs?: "p" | "h1";
  /** Small prefix before the number; pass `null` for non-money heroes. */
  currency?: ReactNode;
  caption: ReactNode;
  controls?: ReactNode;
  chart?: ReactNode;
  kpis?: ReactNode;
  area?: Area;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className={cn("wm-card wm-dark wm-hero", AREA_CLASS[area], className)}
      style={style}
    >
      <div className="wm-hero-main">
        <div className="wm-hero-head">
          <div>
            <ValueTag className="wm-big">
              {currency && <span className="wm-cur">{currency}</span>}
              {value}
            </ValueTag>
            <p className="wm-cap">{caption}</p>
          </div>
          {controls && <div className="wm-hero-ctrl">{controls}</div>}
        </div>
        {chart && <div className="wm-chart-wrap">{chart}</div>}
      </div>
      {kpis && <div className="wm-kpis">{kpis}</div>}
    </section>
  );
}

/** One KPI in the hero column. `short` replaces the value on phones (e.g. "Rp 39 jt"). */
export function HeroKpi({
  label,
  value,
  short,
  delta,
}: {
  label: ReactNode;
  value: ReactNode;
  short?: string;
  delta?: ReactNode;
}) {
  return (
    <div className="wm-kpi">
      <small>{label}</small>
      <div className="wm-kpi-v" data-short={short}>
        {value}
      </div>
      {delta}
    </div>
  );
}

/**
 * Up/down change line under a number: "↑ 5,1% dari bulan lalu". The arrow
 * follows `dir`; the colour follows `good` (a rise in spending is an up arrow
 * in red), defaulting to up = good.
 */
export function Delta({
  dir,
  value,
  suffix,
  good = dir === "up",
}: {
  dir: "up" | "down";
  value: ReactNode;
  suffix?: ReactNode;
  good?: boolean;
}) {
  return (
    <span className="wm-delta" data-tone={good ? "good" : "bad"}>
      <span aria-hidden="true">{dir === "up" ? "↑" : "↓"}</span>
      {value}
      {suffix && <em>{suffix}</em>}
    </span>
  );
}

/* ───────────── progress ───────────── */

type Fill = "lime" | "orange" | "bad";

/** Hatched progress bar with an optional legend row underneath. */
export function HatchedBar({
  value,
  fill = "lime",
  label,
  start,
  end,
}: {
  /** 0..100 */
  value: number;
  fill?: Fill;
  label: string;
  start?: ReactNode;
  end?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <>
      <div
        className="wm-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <i className={`wm-fill-${fill}`} style={{ width: `${pct}%` }} />
      </div>
      {(start || end) && (
        <div className="wm-bar-legend">
          <span>{start}</span>
          <span>{end}</span>
        </div>
      )}
    </>
  );
}

/** Thin share track used inside rows and tiles. */
export function Track({
  value,
  fill = "lime",
  className,
}: {
  value: number;
  fill?: Fill;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className={cn("wm-track", className)} aria-hidden="true">
      <i className={`wm-fill-${fill}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

/* ───────────── lists ───────────── */

export function MiniList({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <ul className="wm-mini-list" aria-label={label}>
      {children}
    </ul>
  );
}

/** A compact side-column row: icon, title + meta, amount. Clickable when `onClick` is set. */
export function MiniRow({
  icon,
  title,
  meta,
  amount,
  onClick,
}: {
  icon: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  amount?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="wm-ic">{icon}</span>
      <span className="min-w-0">
        <b>{title}</b>
        {meta && <small>{meta}</small>}
      </span>
      {amount !== undefined && <span className="wm-amt">{amount}</span>}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" className="wm-mini-row" onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className="wm-mini-row">{body}</div>
      )}
    </li>
  );
}

/** The "see all" footer button of a side card. Renders a link when `href` is set. */
export function SeeAll({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const content = (
    <>
      {children}
      <ChevronRight className="size-4" aria-hidden="true" />
    </>
  );
  return href ? (
    <Link href={href} className="wm-see-all">
      {content}
    </Link>
  ) : (
    <button type="button" className="wm-see-all" onClick={onClick}>
      {content}
    </button>
  );
}

/**
 * Account-style row (`.arow`), the replacement for data tables: badge, name +
 * meta, share track, amount. Tapping it opens the item (detail panel / edit).
 */
export function ARow({
  badge,
  badgeStyle,
  title,
  meta,
  share,
  amount,
  amountSub,
  onClick,
}: {
  badge: ReactNode;
  badgeStyle?: CSSProperties;
  title: ReactNode;
  meta?: ReactNode;
  /** 0..100; omit to drop the track column. */
  share?: number;
  amount: ReactNode;
  amountSub?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="wm-arow-badge" style={badgeStyle}>
        {badge}
      </span>
      <span className="min-w-0">
        <b>{title}</b>
        {meta && <small>{meta}</small>}
      </span>
      {share !== undefined && <Track value={share} />}
      <span className="wm-amt">
        {amount}
        {amountSub && <small>{amountSub}</small>}
      </span>
    </>
  );
  const noTrack = share === undefined ? true : undefined;
  return onClick ? (
    <button
      type="button"
      className="wm-arow"
      data-no-track={noTrack}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <div className="wm-arow" data-no-track={noTrack}>
      {body}
    </div>
  );
}

/* ───────────── tiles ───────────── */

export function BentoTiles({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("wm-btiles", className)}>{children}</div>;
}

export function BentoTile({
  icon,
  title,
  value,
  foot,
  children,
  onClick,
  className,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  value?: ReactNode;
  foot?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      {(icon || title) && (
        <span className="wm-btile-tt">
          {icon && <span className="wm-ci">{icon}</span>}
          {title}
        </span>
      )}
      {value !== undefined && <span className="wm-pv">{value}</span>}
      {children}
      {foot && <small>{foot}</small>}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={cn("wm-btile", className)}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <div className={cn("wm-btile", className)}>{body}</div>
  );
}

/** Dashed "add" tile that closes a tile grid. */
export function AddTile({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="wm-btile"
      data-add="true"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ───────────── composition stack (replaces donut charts) ───────────── */

export type CompositionItem = { label: string; value: number; color: string };

/**
 * Headline value, one hatched segmented bar, then a ranked share list.
 * `format` renders each row's value (pass the page's money formatter).
 */
export function CompositionStack({
  items,
  center,
  sub,
  label,
  format,
}: {
  items: CompositionItem[];
  center?: ReactNode;
  sub?: ReactNode;
  label: string;
  format: (value: number) => string;
}) {
  const ranked = items
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = ranked.reduce((sum, item) => sum + item.value, 0) || 1;
  return (
    <div className="wm-cstack">
      {center !== undefined && (
        <div className="wm-cs-head">
          <b>{center}</b>
          {sub && <small>{sub}</small>}
        </div>
      )}
      <div
        className="wm-cs-bar"
        role="img"
        aria-label={`${label}: ${ranked.map((item) => `${item.label} ${format(item.value)}`).join(", ")}`}
      >
        {ranked.map((item, index) => (
          <i
            key={item.label}
            title={`${item.label} ${Math.round((item.value / total) * 100)}%`}
            style={
              {
                flex: item.value,
                "--c": item.color,
                animationDelay: `${index * 60}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div>
        {ranked.map((item) => {
          const pct = (item.value / total) * 100;
          return (
            <div key={item.label} className="wm-cs-row" aria-hidden="true">
              <span className="wm-cs-dot" style={{ background: item.color }} />
              {/* Drawn by CSS: the bar's label carries the text for assistive tech, and the page's own list owns the names. */}
              <span className="wm-cs-l" data-label={item.label} />
              <span className="wm-cs-v">{format(item.value)}</span>
              <span className="wm-cs-p">
                {pct < 1 ? "<1" : Math.round(pct)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── tips card ───────────── */

/** The page's one alert/insight card, with the decorative status mosaic on the right. */
export function TipsCard({
  title,
  children,
  action,
  mosaic,
  area,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** 18 cells, "a" lime · "b" lime-soft · "c" yellow · "o" orange · "" empty. */
  mosaic?: readonly ("a" | "b" | "c" | "o" | "")[];
  area?: Area;
  className?: string;
}) {
  return (
    <section
      className={cn("wm-card wm-tips", area && AREA_CLASS[area], className)}
    >
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
        {action}
      </div>
      {mosaic && (
        <div className="wm-mosaic" aria-hidden="true">
          {mosaic.map((cell, index) => (
            <i key={index} data-v={cell || undefined} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ───────────── inputs ───────────── */

/** Money field with the Rp pill prefix. Controlled by the caller; format with `@/lib/format`. */
export function MoneyInput({
  "aria-label": ariaLabel,
  prefix = "Rp",
  invalid,
  className,
  ...props
}: ComponentProps<"input"> & {
  "aria-label": string;
  prefix?: string;
  invalid?: boolean;
}) {
  return (
    <span
      className={cn("wm-affix", className)}
      aria-invalid={invalid || undefined}
    >
      <span className="wm-affix-pre" aria-hidden="true">
        {prefix}
      </span>
      <input
        {...props}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        inputMode={props.inputMode ?? "numeric"}
      />
    </span>
  );
}

/**
 * Tap-to-edit in place (`.inl`): a money input, optional range, Enter saves,
 * Esc cancels. The caller owns parsing/validation and the mutation.
 */
export function InlineEditor({
  initial,
  onSave,
  onCancel,
  label,
  range,
  saveLabel,
  cancelLabel,
  format = (raw) => raw,
}: {
  initial: string;
  onSave: (raw: string) => void;
  onCancel: () => void;
  label: string;
  range?: {
    min: number;
    max: number;
    step?: number;
    toRaw: (value: number) => string;
    fromRaw: (raw: string) => number;
  };
  saveLabel: string;
  cancelLabel: string;
  format?: (raw: string) => string;
}) {
  const [raw, setRaw] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSave(raw);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }
  return (
    <div className="wm-inl">
      <MoneyInput
        ref={inputRef}
        aria-label={label}
        value={raw}
        onChange={(event) => setRaw(format(event.target.value))}
        onKeyDown={onKeyDown}
      />
      {range && (
        <input
          type="range"
          aria-label={label}
          min={range.min}
          max={range.max}
          step={range.step ?? 1}
          value={range.fromRaw(raw)}
          onChange={(event) => setRaw(range.toRaw(Number(event.target.value)))}
        />
      )}
      <div className="wm-inl-actions">
        <PillButton onClick={onCancel}>{cancelLabel}</PillButton>
        <PillButton variant="primary" onClick={() => onSave(raw)}>
          {saveLabel}
        </PillButton>
      </div>
    </div>
  );
}

/** Chip picker for two-step inline actions (Bayar → pick account → Bayar Rp x). */
export function ChipPicker<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="wm-chips">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="wm-chip"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── account cards ───────────── */

export type CardTone = "lime" | "dark" | "yellow" | "soft";

/** Card colour by account type, so the type reads at a glance: bank lime, e-wallet dark green, cash yellow. */
export function accountTone(type: string): CardTone {
  if (type === "bank") return "lime";
  if (type === "ewallet") return "dark";
  if (type === "cash") return "yellow";
  return "soft";
}
