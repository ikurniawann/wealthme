"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type { CSSProperties } from "react";
import { useEffect } from "react";

import styles from "./progress-bar.module.css";

export function ProgressBar({
  value,
  color = "var(--primary)",
  className,
  height = 7,
  ariaLabel,
  ariaLabelledBy,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}) {
  const reduced = useReducedMotion();
  const safeValue = Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
  const progress = useMotionValue(safeValue);
  const x = useTransform(
    progress,
    (latest) => `${Math.min(100, Math.max(0, latest)) - 100}%`,
  );
  useEffect(() => {
    if (reduced) {
      progress.jump(safeValue);
      return;
    }
    const controls = animate(progress, safeValue, {
      type: "spring",
      stiffness: 180,
      damping: 28,
    });
    return () => controls.stop();
  }, [progress, reduced, safeValue]);

  const classes = [styles.progress, className].filter(Boolean).join(" ");
  const style = {
    "--progress-height": `${height}px`,
    "--progress-color": color,
  } as CSSProperties;

  return (
    <div
      className={classes}
      style={style}
      data-uiarc="progress"
      role="progressbar"
      aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? "Progress")}
      aria-labelledby={ariaLabelledBy}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      aria-valuetext={`${Math.round(safeValue)}%`}
    >
      <div className={styles.track}>
        <motion.span
          className={styles.fill}
          data-uiarc="progress-fill"
          style={{ x }}
        />
      </div>
    </div>
  );
}
