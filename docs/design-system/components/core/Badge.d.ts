import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** @default "default" */
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "success"
    | "warning"
    | "purple"
    | "outline";
}

/**
 * Small rounded pill label — counts, "New" tags, inline status.
 */
export function Badge(props: BadgeProps): React.ReactElement;
