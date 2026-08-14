import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EPIC-026 design-system migration — prototype `.hero`. The decorative circle
 * and gloss overlay that used to be hand-rolled divs are `.hero::after` /
 * `.hero::before` in `design-system.css`, and `.hero > *` already lifts the
 * content above them, so no inner wrapper is needed.
 */
export function HeroCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("hero", className)}>{children}</div>;
}

export function HeroLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("hero__label", className)}>{children}</div>;
}

export function HeroValue({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("hero__value", className)}>{children}</div>;
}
