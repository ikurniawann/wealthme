import * as React from "react";

export interface HeroCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gradient utility class. @default "gradient-wealth" */
  gradient?:
    | "gradient-wealth"
    | "gradient-profile"
    | "gradient-ai"
    | "gradient-emerald";
  /** Inner padding in px. @default 22 */
  padding?: number;
}

/**
 * Gradient hero surface for net-worth / totals — white text, soft glow ring.
 */
export function HeroCard(props: HeroCardProps): React.ReactElement;
