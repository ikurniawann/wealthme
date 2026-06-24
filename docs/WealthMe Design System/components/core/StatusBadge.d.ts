import * as React from "react";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** @default "gray" */
  variant?: "success" | "danger" | "warning" | "info" | "purple" | "gray";
  /** Show a leading status dot. @default false */
  dot?: boolean;
}

/**
 * Soft-fill status pill with optional leading dot — table rows, goal status,
 * account states. Friendlier and larger than Badge.
 */
export function StatusBadge(props: StatusBadgeProps): React.ReactElement;
