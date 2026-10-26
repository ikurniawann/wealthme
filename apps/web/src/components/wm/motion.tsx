"use client";

// apps/web/src/components/wm/motion.tsx
// Lapisan enhancement WealthMe: count-up, progress fill-on-mount, stagger.
// Menghormati prefers-reduced-motion (count-up langsung ke nilai akhir).

import * as React from "react";
import { useMotionValueEvent, useSpring } from "motion/react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ProgressBar } from "@/components/wm";
import { formatRupiah } from "@/lib/format";

/** Physics springs preserve the current position and velocity when data changes. */
export function useCountUp(target: number, durationMs = 1200): number {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [value, setValue] = React.useState(0);
  const spring = useSpring(0, {
    stiffness: 170,
    damping: 26,
    mass: Math.max(0.1, durationMs / 1200),
  });
  useMotionValueEvent(spring, "change", setValue);
  React.useEffect(() => {
    if (reduced || durationMs <= 0) spring.jump(target);
    else spring.set(target);
  }, [target, durationMs, reduced, spring]);
  return reduced || durationMs <= 0 ? target : value;
}

/** Angka Rupiah ber-count-up. Drop-in pengganti {formatRupiah(value)}. */
export function CountUpRupiah({
  value,
  durationMs = 1200,
  className,
  format = formatRupiah,
}: {
  value: number;
  durationMs?: number;
  className?: string;
  /** Formatter for the counted value — C5. Defaults to plain IDR so every
   * existing caller keeps its current behaviour; pages that display a
   * converted currency pass `useMoney().format`. */
  format?: (idr: number) => string;
}) {
  const v = useCountUp(value, durationMs);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(Math.round(v))}
    </span>
  );
}

/** Membungkus ProgressBar agar mengisi dari 0 saat mount. */
export function AnimatedProgress({
  value,
  color = "var(--primary)",
  height = 7,
  ariaLabel,
}: {
  value: number;
  color?: string;
  height?: number;
  ariaLabel?: string;
}) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- jump to final value once the media query resolves post-mount.
      setV(value);
      return;
    }
    const id = window.setTimeout(() => setV(value), 120);
    return () => window.clearTimeout(id);
  }, [value, reduced]);
  return (
    <ProgressBar
      value={v}
      color={color}
      height={height}
      ariaLabel={ariaLabel}
    />
  );
}

/** Wrapper stagger entrance — beri index agar kartu muncul berurutan. */
export function Rise({
  index = 0,
  className,
  children,
}: {
  index?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={className ? `animate-rise ${className}` : "animate-rise"}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {children}
    </div>
  );
}
