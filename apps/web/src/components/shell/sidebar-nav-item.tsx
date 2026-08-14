"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/lib/nav";

/**
 * EPIC-026 shell migration — prototype `.nav-item` / `.nav-item--active`.
 * The collapsed rail rules in `design-system.css` hide `.nav-item__label` and
 * `.nav-item .badge`, so both must carry those exact class names.
 */

const NAV_BADGE_CLASS: Record<BadgeVariant, string> = {
  danger: "badge--danger",
  "new-purple": "badge--purple",
  "new-success": "badge--success",
};

export function NavBadge({
  text,
  variant,
}: {
  text: string;
  variant: BadgeVariant;
}) {
  return <span className={cn("badge", NAV_BADGE_CLASS[variant])}>{text}</span>;
}

export function SidebarNavItem({
  href,
  icon: Icon,
  label,
  active,
  badge,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn("nav-item", active && "nav-item--active")}
    >
      <Icon className="nav-item__icon" aria-hidden="true" />
      <span className="nav-item__label">{label}</span>
      {badge}
    </Link>
  );
}
