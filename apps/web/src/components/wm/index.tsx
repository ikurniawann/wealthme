import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/* ─────────────────────────── SectionCard ─────────────────────────── */

export function SectionCard({
  title,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden p-5", className)}>
      {(title || action) && (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          {title && <div className="text-[13.5px] font-bold text-muted-foreground">{title}</div>}
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
}

export function CardLink({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "cursor-pointer text-xs font-semibold whitespace-nowrap text-primary hover:underline",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── Status pill ─────────────────────────── */

const PILL_STYLES: Record<string, string> = {
  success: "bg-success-soft text-emerald-700 dark:text-emerald-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  warning: "bg-warning-soft text-amber-700 dark:text-amber-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  purple: "bg-brand-purple-soft text-violet-700 dark:text-violet-300",
  gray: "bg-secondary text-secondary-foreground",
};

export function StatusBadge({
  variant = "gray",
  className,
  children,
}: {
  variant?: keyof typeof PILL_STYLES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-semibold",
        PILL_STYLES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────── Summary card ─────────────────────────── */

export function SummaryCard({
  icon,
  iconBg,
  iconColor,
  label,
  amount,
  delta,
  deltaUp,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor?: string;
  label: React.ReactNode;
  amount: React.ReactNode;
  delta?: React.ReactNode;
  deltaUp?: boolean;
}) {
  return (
    <Card className="gap-0 p-4">
      <div
        className="mb-2 flex size-[34px] items-center justify-center rounded-md text-[15px]"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="mb-0.5 text-[10.5px] font-medium text-muted-foreground">{label}</div>
      <div className="mb-[3px] text-[15px] font-extrabold">{amount}</div>
      {delta && (
        <div
          className={cn(
            "flex items-center gap-[3px] text-[10.5px] font-bold",
            deltaUp ? "text-success" : "text-destructive",
          )}
        >
          {delta}
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────── Money stat ─────────────────────────── */

export function MoneyStat({
  label,
  value,
  valueClass,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-[3px] text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-[17px] font-extrabold", valueClass)}>{value}</div>
    </div>
  );
}

/* ─────────────────────────── Progress bar ─────────────────────────── */

export function ProgressBar({
  value,
  color = "var(--primary)",
  className,
  height = 7,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-full bg-muted", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

/* ─────────────────────────── Hero card ─────────────────────────── */

export function HeroCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-[14px] p-[22px] text-white", className)}>
      <div className="pointer-events-none absolute -top-12 -right-12 size-[220px] rounded-full bg-white/5" />
      <div className="relative">{children}</div>
    </div>
  );
}
