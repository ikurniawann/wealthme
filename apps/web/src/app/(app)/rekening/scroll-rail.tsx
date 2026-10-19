"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A horizontal row that says it scrolls: edges fade where content is
 * hidden, a thin scrollbar shows the position, and ‹ › buttons page it on
 * pointer devices. The buttons only appear on the side that has more.
 */
export function ScrollRail({
  className,
  label,
  prevLabel,
  nextLabel,
  children,
}: {
  className: string;
  label: string;
  prevLabel: string;
  nextLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft < max - 4 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [children]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({
      left: dir * el.clientWidth * 0.8,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <div
      className="rk3-rail"
      data-start={edges.start || undefined}
      data-end={edges.end || undefined}
    >
      <div ref={ref} className={className} role="group" aria-label={label}>
        {children}
      </div>
      {edges.start && (
        <button
          type="button"
          className="rk3-rail-btn rk3-rail-btn--prev"
          aria-label={prevLabel}
          onClick={() => page(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      )}
      {edges.end && (
        <button
          type="button"
          className="rk3-rail-btn rk3-rail-btn--next"
          aria-label={nextLabel}
          onClick={() => page(1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
