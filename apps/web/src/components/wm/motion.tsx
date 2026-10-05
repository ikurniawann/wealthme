"use client";

// apps/web/src/components/wm/motion.tsx
// Lapisan enhancement WealthMe: count-up, progress fill-on-mount, stagger.
// Menghormati prefers-reduced-motion (count-up langsung ke nilai akhir).

import * as React from "react";
import { ProgressBar } from "@/components/wm";
import { formatRupiah } from "@/lib/format";

// Polish batch 8 item 3 — this used to read `window.matchMedia` directly
// during render (`prefersReducedMotion()` called inline, and inlined again
// as a `useState` initializer below). `typeof window !== "undefined"` is
// false during SSR but true on the very first CLIENT render too (hydration
// still runs before any effect), so whenever the visitor's OS/browser has
// "reduce motion" on, the server always computed `reduced = false` while
// that first client render computed `true` — a real content/text mismatch
// (0 vs. the final value) on every count-up/progress-fill mount, i.e.
// exactly the class of bug the "1 Issue" hydration badge was reporting.
// Fixed by always rendering the SSR-safe default first and only reading
// the media query after mount, inside an effect.
function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads window on mount, not derivable from render.
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return reduced;
}

/** Easing sebuah angka dari 0 → target saat mount / saat target berubah. */
export function useCountUp(target: number, durationMs = 1200): number {
  const reduced = useReducedMotionPreference();
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (reduced) return; // reduced-motion: hook returns target directly below
    let raf = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      setValue(target * (1 - Math.pow(1 - p, 3))); // easeOutCubic
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduced]);

  return reduced ? target : value;
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
  const reduced = useReducedMotionPreference();
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
