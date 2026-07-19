import * as React from "react";

export interface DonutSegment {
  label: string;
  value: number;
  /** CSS var or hex — typically a chart-N token. */
  color: string;
  /** Optional sub-label (e.g. formatted amount). */
  sub?: string;
}

export interface DonutProps {
  segments: DonutSegment[];
  /** Outer diameter in px. @default 120 */
  size?: number;
  /** Ring thickness in px. @default 17 */
  thickness?: number;
  centerValue?: React.ReactNode;
  centerLabel?: React.ReactNode;
}

/**
 * SVG donut chart with centered label — wealth allocation breakdown.
 *
 * @startingPoint section="Charts" subtitle="Donut, sparkline & bar charts" viewport="700x260"
 */
export function Donut(props: DonutProps): React.ReactElement;

export interface DonutLegendProps {
  segments: DonutSegment[];
  total?: number;
}
/** Legend rows for a Donut. */
export function DonutLegend(props: DonutLegendProps): React.ReactElement;
