"use client";

import { useMemo, useRef, useState } from "react";
import type { NetWorthHistoryPointDto } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";

const WIDTH = 640;
const HEIGHT = 144;
const LEFT = 12;
const RIGHT = WIDTH - LEFT;
const TOP = 12;
const BOTTOM = HEIGHT - 18;

function toBigInt(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function NetWorthTrend({
  points,
  isLoading,
}: {
  points: NetWorthHistoryPointDto[];
  isLoading: boolean;
}) {
  const { locale, t } = useLocale();
  const money = useMoney();
  const svgRef = useRef<SVGSVGElement>(null);
  const validPoints = useMemo(
    () =>
      points.flatMap((point) => {
        const value = toBigInt(point.netWorth);
        return value === null ? [] : [{ ...point, value }];
      }),
    [points],
  );
  const [manualIndex, setManualIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (validPoints.length < 2) return null;
    const values = validPoints.map((point) => point.value);
    const min = values.reduce((a, b) => (a < b ? a : b));
    const max = values.reduce((a, b) => (a > b ? a : b));
    const range = max - min || BigInt(1);
    const coordinates = values.map((value, index) => {
      const progress =
        Number(((value - min) * BigInt(1_000_000)) / range) / 1_000_000;
      return {
        x: LEFT + (index / (values.length - 1)) * (RIGHT - LEFT),
        y: BOTTOM - progress * (BOTTOM - TOP),
      };
    });
    return {
      coordinates,
      path: coordinates
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
        )
        .join(" "),
    };
  }, [validPoints]);

  if (isLoading) {
    return (
      <div className="t-xs mt-3 opacity-75" aria-live="polite">
        {t.common.loading}
      </div>
    );
  }

  if (!chart) {
    return <p className="t-xs mt-3 opacity-75">{t.beranda.historyEmpty}</p>;
  }

  const index = Math.min(
    manualIndex ?? validPoints.length - 1,
    validPoints.length - 1,
  );
  const selected = validPoints[index]!;
  const coordinate = chart.coordinates[index]!;
  const date = new Date(selected.capturedAt).toLocaleDateString(
    t.beranda.dateLocale,
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );

  function selectFromPointer(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setManualIndex(Math.round(ratio * (validPoints.length - 1)));
  }

  return (
    <div
      className="mt-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      role="group"
      tabIndex={0}
      aria-label={t.beranda.historyChartAriaLabel}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          setManualIndex((current) =>
            Math.max(
              0,
              Math.min(
                validPoints.length - 1,
                (current ?? validPoints.length - 1) +
                  (event.key === "ArrowLeft" ? -1 : 1),
              ),
            ),
          );
        } else if (event.key === "Home") {
          event.preventDefault();
          setManualIndex(0);
        } else if (event.key === "End") {
          event.preventDefault();
          setManualIndex(validPoints.length - 1);
        }
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono text-sm font-semibold" aria-live="polite">
          {money.formatExact(selected.netWorth)}
        </span>
        <time
          className="t-xs shrink-0 opacity-75"
          dateTime={selected.capturedAt}
        >
          {date}
        </time>
      </div>
      <svg
        ref={svgRef}
        className="mt-1 h-24 w-full cursor-crosshair overflow-visible"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(event) => selectFromPointer(event.clientX)}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" || event.buttons > 0) {
            selectFromPointer(event.clientX);
          }
        }}
      >
        <line
          x1={coordinate.x}
          x2={coordinate.x}
          y1={TOP}
          y2={BOTTOM}
          stroke="rgba(255,255,255,.38)"
          strokeDasharray="3 5"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={chart.path}
          fill="none"
          stroke="rgba(255,255,255,.92)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={coordinate.x}
          cy={coordinate.y}
          r="4.5"
          fill="white"
          stroke="rgba(10,58,82,.75)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        className="mt-1 flex justify-between px-0.5 text-[10px] opacity-65"
        aria-hidden="true"
      >
        <span>
          {new Date(validPoints[0]!.capturedAt).toLocaleDateString(locale, {
            month: "short",
            year: "2-digit",
            timeZone: "UTC",
          })}
        </span>
        <span>
          {new Date(validPoints.at(-1)!.capturedAt).toLocaleDateString(locale, {
            month: "short",
            year: "2-digit",
            timeZone: "UTC",
          })}
        </span>
      </div>
    </div>
  );
}
