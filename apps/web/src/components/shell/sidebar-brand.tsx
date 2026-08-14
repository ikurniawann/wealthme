"use client";

import type { ReactNode } from "react";

/**
 * EPIC-026 shell migration — prototype `.sidebar__brand` block, shared by the
 * fixed desktop sidebar and the mobile nav sheet. `action` is the trailing
 * control: the collapse toggle on desktop, the close button in the sheet.
 */
export function SidebarBrand({ action }: { action?: ReactNode }) {
  return (
    <div className="sidebar__brand">
      <div className="sidebar__logo gradient-wealth" aria-hidden="true">
        W
      </div>
      <div className="sidebar__brand-text">
        <div className="sidebar__name">
          Wealth<span className="t-primary">Me</span>
        </div>
      </div>
      {action}
    </div>
  );
}
