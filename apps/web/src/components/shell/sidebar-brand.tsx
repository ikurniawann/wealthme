"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/**
 * EPIC-026 shell migration — prototype `.sidebar__brand` block, shared by the
 * fixed desktop sidebar and the mobile nav sheet. `action` is the trailing
 * control: the collapse toggle on desktop, the close button in the sheet.
 *
 * A8 (revisi-2) — the logo is the Home link now (`display:contents` keeps it
 * a transparent wrapper so `.sidebar__logo`/`.sidebar__brand-text` stay
 * direct flex items of `.sidebar__brand`, matching the protected CSS
 * unchanged); the standalone Beranda sidebar item is dropped in
 * `sidebar-sections.tsx`.
 */
export function SidebarBrand({ action }: { action?: ReactNode }) {
  return (
    <div className="sidebar__brand">
      <Link
        href="/beranda"
        aria-label="WealthMe — beranda"
        style={{ display: "contents" }}
      >
        <div className="sidebar__logo" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand mark, no responsive srcset needed */}
          <img
            src="/brand/wealthme-mark.png"
            alt=""
            className="size-full object-contain"
          />
        </div>
        <div className="sidebar__brand-text">
          <div className="sidebar__name">
            Wealth<span className="t-primary">Me</span>
          </div>
        </div>
      </Link>
      {action}
    </div>
  );
}
