import * as React from "react";

export interface SummaryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon node or emoji shown in the tinted chip. */
  icon?: React.ReactNode;
  /** Chip background (often a soft pastel). @default var(--secondary) */
  iconBg?: string;
  iconColor?: string;
  label: React.ReactNode;
  /** Extrabold value, e.g. "Rp 25,85 jt". */
  amount: React.ReactNode;
  /** Optional delta text shown with an arrow. */
  delta?: React.ReactNode;
  /** Delta direction → green up / red down. @default true */
  deltaUp?: boolean;
}

/**
 * Compact KPI tile — tinted icon, label, extrabold amount, up/down delta.
 */
export function SummaryCard(props: SummaryCardProps): React.ReactElement;
