import * as React from "react";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Completion 0–100. */
  value: number;
  /** Fill color — pass a status color to reflect goal state. @default var(--primary) */
  color?: string;
  /** Track height in px. @default 7 */
  height?: number;
}

/**
 * Thin rounded progress track — savings goals, budgets, allocation.
 */
export function ProgressBar(props: ProgressBarProps): React.ReactElement;
