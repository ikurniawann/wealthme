import * as React from "react";

export interface MoneyStatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Value color — green income, red expense, etc. @default var(--foreground) */
  valueColor?: string;
  /** Value font size in px. @default 17 */
  size?: number;
  align?: "left" | "right" | "center";
}

/**
 * Label-over-value money read-out for cashflow rows, KPIs, account headers.
 */
export function MoneyStat(props: MoneyStatProps): React.ReactElement;
