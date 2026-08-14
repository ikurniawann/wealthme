import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EPIC-026 design-system migration — prototype `.card` / `.card__header` /
 * `.card__title` / `.card__action` / `.card__body`. Replaces the previous
 * shadcn `Card` + Tailwind reimplementation; padding, radius, shadow and hover
 * now come from `design-system.css`.
 */
export function SectionCard({
  title,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("card", className)}>
      {(title || action) && (
        <div className="card__header">
          {title && <div className="card__title">{title}</div>}
          {action && <div className="card__action">{action}</div>}
        </div>
      )}
      <div className={cn("card__body", bodyClassName)}>{children}</div>
    </div>
  );
}

export function CardLink({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button type="button" className={cn("card-link", className)} {...props}>
      {children}
    </button>
  );
}
