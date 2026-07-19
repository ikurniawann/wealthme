import * as React from "react";

export interface BarChartProps {
  /** Month labels (x-axis). */
  months: string[];
  /** Income values, aligned to months. */
  income: number[];
  /** Expense values, aligned to months. */
  expense: number[];
  /** Y-axis peak; auto-computed when omitted. */
  max?: number;
  /** Plot height in px. @default 90 */
  height?: number;
  /** Show the income/expense legend. @default true */
  showLegend?: boolean;
}

/**
 * Grouped income/expense bar chart — monthly cashflow. Green income, red expense.
 */
export function BarChart(props: BarChartProps): React.ReactElement;
