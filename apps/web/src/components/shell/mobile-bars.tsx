"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { mobileNavForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";
import { useShell } from "./shell-context";

/**
 * EPIC-026 shell migration — prototype `.mobile-fab` + `.mobile-nav`. Both are
 * `display:none` until the 768px breakpoint in `design-system.css`, so no
 * responsive utility is needed here. The mobile header moved into the single
 * `.topbar` (see topbar.tsx).
 */
export function MobileNav() {
  const pathname = usePathname();
  const { setTxnOpen } = useShell();
  const { t } = useLocale();
  const { myRole } = useMyRole();

  return (
    <>
      <button
        type="button"
        onClick={() => setTxnOpen(true)}
        aria-label={t.shell.addTransaction}
        className="mobile-fab"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
      <nav className="mobile-nav" aria-label={t.shell.mobileNavTitle}>
        {mobileNavForRole(myRole).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
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
