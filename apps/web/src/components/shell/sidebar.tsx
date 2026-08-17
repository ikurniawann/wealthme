"use client";

import { ChevronLeft } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarSections } from "./sidebar-sections";

/**
 * EPIC-026 shell migration — the fixed desktop `.sidebar`. `design-system.css`
 * hides it below 768px and supplies every `[data-collapsed="true"]` rail rule;
 * this component only owns the attribute and the markup.
 */
export function SidebarNav({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { t } = useLocale();

  return (
    <aside className="sidebar" data-collapsed={String(collapsed)}>
      <SidebarBrand
        action={
          <>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="sidebar__collapse-btn"
                aria-pressed={collapsed}
                aria-label={
                  collapsed ? t.shell.expandSidebar : t.shell.collapseSidebar
                }
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
            )}
          </>
        }
      />
      <SidebarSections />
      <SidebarFooter />
    </aside>
  );
}
