"use client";

import { useMoney } from "@/hooks/use-money";

/**
 * Number-format policy: a compact amount ("Rp 4,2 jt") is only allowed where
 * the full figure cannot fit (tiles, rows, axis-like labels), and it ALWAYS
 * carries the full amount in `title`, so no call site hand-rolls that pair.
 *
 * Defaults to the shared display-currency formatters from `useMoney()`;
 * pages that already hold their own formatter pair (e.g. Beranda's
 * `MoneyFormatters`) pass `compact` / `full` explicitly.
 */
export function MoneyCompact({
  value,
  compact,
  full,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  compact?: (value: number) => string;
  full?: (value: number) => string;
  /** Text before the figure, inside the same span and title (e.g. "-"). */
  prefix?: string;
  /** Text after the figure, inside the same span and title (e.g. "/bln"). */
  suffix?: string;
  className?: string;
}) {
  const money = useMoney();
  const fullText = (full ?? money.format)(value);
  return (
    <span className={className} title={`${prefix}${fullText}${suffix}`}>
      {prefix}
      {(compact ?? money.formatCompact)(value)}
      {suffix}
    </span>
  );
}
