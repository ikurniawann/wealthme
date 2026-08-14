"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportTab, ReportTabId } from "@/lib/nav";

/**
 * EPIC-026 shell migration — the "Laporan" nav item and its expandable tab
 * list. The parent row is a real `.nav-item`; the sub-rows reuse `.nav-item`
 * with two extra utilities (deeper indent, smaller text) because the
 * prototype has no dedicated sub-item class.
 */
export function SidebarReportGroup({
  href,
  icon: Icon,
  label,
  parentActive,
  open,
  onToggle,
  tabs,
  tabLabel,
  activeTab,
  isReportRoute,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  parentActive: boolean;
  open: boolean;
  onToggle: () => void;
  tabs: ReportTab[];
  tabLabel: (id: ReportTabId) => string;
  activeTab: string | null;
  isReportRoute: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        title={label}
        aria-expanded={open}
        className={cn("nav-item w-full", parentActive && "nav-item--active")}
      >
        <Icon className="nav-item__icon" aria-hidden="true" />
        <span className="nav-item__label">{label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-300",
          open ? "max-h-[600px]" : "max-h-0",
        )}
      >
        {tabs.map((tab) => {
          const tabActive = isReportRoute && activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={`${href}?tab=${tab.id}`}
              onClick={onNavigate}
              aria-current={tabActive ? "page" : undefined}
              className={cn(
                "nav-item pl-9 text-[12.5px]",
                tabActive && "nav-item--active",
              )}
            >
              <span className="nav-item__label">{tabLabel(tab.id)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
