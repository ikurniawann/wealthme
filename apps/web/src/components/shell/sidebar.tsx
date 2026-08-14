"use client";

import { ChevronLeft, Plus } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarSections } from "./sidebar-sections";
import { useShell } from "./shell-context";

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
  const { setTxnOpen } = useShell();
  const { t } = useLocale();

  return (
    <aside className="sidebar" data-collapsed={String(collapsed)}>
      <SidebarBrand
        action={
          <>
            {/* EPIC-023 Task H3 (D22) — reviewed foundation exception: this file
                is protected per WM_CONVENTIONS.md, but its `data-tour` markers
                (here and on the nav Link below) were only ever DOM anchors for
                the old button-spotlight tour, which components/onboarding
                replaces with a guided setup that writes through real endpoints
                instead of clicking into real pages — nothing queries these
                selectors anymore, so they're dead attributes, not live markup. */}
            {!collapsed && (
              <button
                type="button"
                onClick={() => setTxnOpen(true)}
                title={t.shell.addTransactionTooltip}
                aria-label={t.shell.addTransaction}
                className="btn btn--primary btn--sm btn--icon"
              >
                <Plus className="size-[15px]" aria-hidden="true" />
              </button>
            )}
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
