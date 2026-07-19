import * as React from "react";

export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Muted bold section title. */
  title?: React.ReactNode;
  /** Right-aligned action — a link button or small select. */
  action?: React.ReactNode;
  /** Inner padding in px. @default 20 */
  padding?: number;
  /** Style for the body wrapper. */
  bodyStyle?: React.CSSProperties;
}

/**
 * Titled dashboard panel — muted title left, action right, body below.
 */
export function SectionCard(props: SectionCardProps): React.ReactElement;
