import * as React from "react";

export interface SparklineProps {
  /** Series values — drawn edge-to-edge, smoothed. */
  points: number[];
  /** Canvas height in px. @default 60 */
  height?: number;
  /** Line color. @default white-75% (for the indigo hero). */
  stroke?: string;
  /** Area top color (fades to transparent). @default white-22% */
  fill?: string;
  style?: React.CSSProperties;
}

/**
 * Smoothed canvas area sparkline — the net-worth trend on the hero card.
 * On light surfaces pass stroke="var(--primary)" and a translucent fill.
 */
export function Sparkline(props: SparklineProps): React.ReactElement;
