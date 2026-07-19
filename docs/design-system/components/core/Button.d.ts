import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default "default" */
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "destructive"
    | "link";
  /** Control height & padding. @default "default" */
  size?: "sm" | "default" | "lg" | "icon";
  /** Icon node rendered before the label (e.g. a Lucide <Plus/>). */
  iconStart?: React.ReactNode;
  /** Icon node rendered after the label. */
  iconEnd?: React.ReactNode;
  disabled?: boolean;
}

/**
 * WealthMe primary button. Indigo solid by default; ghost/outline for low
 * emphasis; soft-fill destructive for delete actions.
 *
 * @startingPoint section="Core" subtitle="Buttons — all variants & sizes" viewport="700x150"
 */
export function Button(props: ButtonProps): React.ReactElement;
