import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Inner padding in px. @default 16 */
  padding?: number;
}

/**
 * Base surface panel — soft 1px ring, 14px radius, no heavy shadow.
 * Compose SectionCard / SummaryCard on top of it.
 *
 * @startingPoint section="Surfaces" subtitle="Cards — base, section, summary, hero" viewport="700x320"
 */
export function Card(props: CardProps): React.ReactElement;
