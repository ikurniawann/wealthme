import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EPIC-026 design-system migration — prototype `.badge` + `.badge--*`
 * modifiers. Variant names are unchanged, so every existing call site keeps
 * working; only the styling source moved to `design-system.css`.
 */
const BADGE_VARIANT_CLASS = {
  success: "badge--success",
  danger: "badge--danger",
  warning: "badge--warning",
  info: "badge--info",
  purple: "badge--purple",
  gray: "badge--gray",
} as const;

export type StatusBadgeVariant = keyof typeof BADGE_VARIANT_CLASS;

export function StatusBadge({
  variant = "gray",
  className,
  children,
}: {
  variant?: StatusBadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("badge", BADGE_VARIANT_CLASS[variant], className)}>
      {children}
    </span>
  );
}
