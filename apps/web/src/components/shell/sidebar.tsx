"use client";

import { PanelLeftClose } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarSections } from "./sidebar-sections";
import { SidebarSetup } from "./sidebar-setup";
import { MeMenu } from "./topbar";

/**
 * Bento v2 hub sidebar (`.wm-side`), flush to the left edge. Collapses to an
 * icon rail on demand (and by default at 901-1439px, see useSidebarRail);
 * hidden at <= 900px where the pill dock and launcher take over. The logo is
 * the only way home: there is no Beranda menu item.
 */
export function SidebarNav({
  rail,
  onToggle,
}: {
  rail: boolean;
  onToggle: () => void;
}) {
  const { t } = useLocale();
  const label = rail ? t.shell.expandSidebar : t.shell.collapseSidebar;
  return (
    <aside className="wm-side" aria-label="WealthMe">
      <SidebarBrand />
      <SidebarSections />
      <div className="wm-side-foot">
        <SidebarSetup />
        <button
          type="button"
          className="wm-collapse"
          aria-pressed={rail}
          aria-label={label}
          title={label}
          onClick={onToggle}
        >
          <PanelLeftClose aria-hidden="true" />
          <span className="wm-nav-lbl">{label}</span>
        </button>
        <MeMenu placement="side" />
      </div>
    </aside>
  );
}
