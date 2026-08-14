"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLocale } from "@/hooks/use-locale";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarSections } from "./sidebar-sections";

/**
 * EPIC-026 shell migration — the mobile nav drawer plus its `.topbar__menu-btn`
 * trigger. Its contents are the prototype's sheet markup verbatim
 * (`.sidebar__brand` / `.sidebar__nav` / `.sidebar__footer`).
 *
 * The drawer *container* deliberately stays on the Base-UI-backed shadcn Sheet
 * rather than the prototype's `.sheet` / `.sheet-backdrop` classes: those rules
 * key off a literal `data-open="true"` attribute, and Base UI emits a valueless
 * `data-open=""` (verified in @base-ui/react's `popupStateMapping`), so
 * `.sheet` would leave the panel stuck at `translateX(-100%)`. Hand-rolling the
 * drawer instead would drop the focus trap, Escape handling and scroll lock we
 * have today, which the migration is not allowed to regress. The four
 * utilities below reproduce `.sheet`'s geometry exactly.
 */
const SHEET_GEOMETRY = "data-[side=left]:w-[min(280px,84vw)] gap-0 bg-card p-0";

export function NavSheet() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.shell.openMenu}
        aria-expanded={open}
        className="topbar__menu-btn"
      >
        <Menu className="size-[19px]" aria-hidden="true" />
      </button>
      <SheetContent
        side="left"
        className={SHEET_GEOMETRY}
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">{t.shell.navMenuTitle}</SheetTitle>
        <SidebarBrand
          action={
            <SheetClose
              aria-label={t.shell.closeMenu}
              className="sidebar__collapse-btn"
            >
              <X className="size-[17px]" aria-hidden="true" />
            </SheetClose>
          }
        />
        <SidebarSections onNavigate={() => setOpen(false)} />
        <SidebarFooter onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
