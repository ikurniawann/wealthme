"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { canRecordTransaction, mobileNavForAccess } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { useVisualViewportInset } from "@/hooks/use-visual-viewport-inset";
import { useShell } from "./shell-context";

/**
 * EPIC-026 shell migration — prototype `.mobile-fab` + `.mobile-nav`. Both are
 * `display:none` until the 768px breakpoint in `design-system.css`, so no
 * responsive utility is needed here. The mobile header moved into the single
 * `.topbar` (see topbar.tsx).
 */

/**
 * Batch 5 item 1 — same fix and rationale as `sidebar-sections.tsx`'s
 * `isNavItemActive` (kept as a local duplicate, not a shared import, to keep
 * each protected file's diff self-contained): a strict `pathname === href`
 * match never fires on a dynamic sub-route, so first-segment matching,
 * consistent with `nav.ts`'s route-matching helpers.
 */
export function isMobileNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
export function MobileNav() {
  const pathname = usePathname();
  const { setTxnOpen } = useShell();
  const { t } = useLocale();
  const { access } = useMyAccess();
  // The "Tambah transaksi" FAB only for members who may record one.
  const canAddTxn = canRecordTransaction(access);
  // Keeps both bars pinned to the visual viewport while a mobile browser's URL
  // bar collapses/expands — see the hook for why `position: fixed` alone is
  // not enough on a real phone.
  useVisualViewportInset();

  return (
    <>
      {canAddTxn && (
        <button
          type="button"
          onClick={() => setTxnOpen(true)}
          aria-label={t.shell.addTransaction}
          className="mobile-fab"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      )}
      <nav className="mobile-nav" aria-label={t.shell.mobileNavTitle}>
        {mobileNavForAccess(access).map((item) => {
          const Icon = item.icon;
          const active = isMobileNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mobile-nav__item",
                active && "mobile-nav__item--active",
              )}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              <span>{t.shell.mobileNav[item.id]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
