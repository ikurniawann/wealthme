import * as React from "react";

import styles from "./badge.module.css";

/** WealthMe variants translated to Arc Badge's semantic tone vocabulary. */
const BADGE_TONE = {
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
  purple: "purple",
  gray: "neutral",
} as const;

export type StatusBadgeVariant = keyof typeof BADGE_TONE;

export function StatusBadge({
  variant = "gray",
  className,
  children,
}: {
  variant?: StatusBadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  const tone = BADGE_TONE[variant];

  return (
    <span
      className={[styles.badge, styles[tone], className]
        .filter(Boolean)
        .join(" ")}
      data-uiarc="badge"
      data-tone={tone}
    >
      {children}
    </span>
  );
}
