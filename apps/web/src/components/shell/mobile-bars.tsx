"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus, X } from "lucide-react";
import {
  canRecordTransaction,
  mobileNavForAccess,
  type MobileNavItem,
} from "@/lib/nav";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { useVisualViewportInset } from "@/hooks/use-visual-viewport-inset";
import { useShell } from "./shell-context";
import { NavSheet } from "./nav-sheet";
import { usePhone } from "./use-phone";
import "./mobile-chrome.css";

/** Batch 5 item 1 — first-segment matching so a detail sub-route keeps its tab lit. */
export function isMobileNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type DockSlot =
  | { kind: "link"; item: MobileNavItem }
  | { kind: "add" }
  | { kind: "menu" };

/**
 * Bento v2 dock: [page, page, +, page, Menu]. The three pages come from
 * `mobileNavForAccess` (Beranda · Transaksi · Laporan for a Master, access
 * fallbacks for everyone else); Akun lives behind the avatar and the launcher,
 * so it is not a dock slot. The + only appears for members who may record.
 */
export function dockSlots(items: MobileNavItem[], canAdd: boolean): DockSlot[] {
  const pages = items.filter((item) => item.id !== "akun").slice(0, 3);
  const links = pages.map((item): DockSlot => ({ kind: "link", item }));
  const middle: DockSlot[] = canAdd ? [{ kind: "add" }] : [];
  return [...links.slice(0, 2), ...middle, ...links.slice(2), { kind: "menu" }];
}

/**
 * Hide-on-scroll for the dock: down (reading) tucks it away, up brings it
 * back. On phones the scroller is `.wm-main` (the document is locked).
 */
function useDockHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".wm-main");
    if (!scroller) return;
    let last = scroller.scrollTop;
    const onScroll = () => {
      const top = scroller.scrollTop;
      if (Math.abs(top - last) < 8) return;
      setHidden(top > last && top > 120);
      last = top;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

/**
 * Full-width dock: every item is an icon over a small label in its own
 * column; the active one turns lime and its icon pops. The centre + is a
 * ring button that turns into a × while the transaction dialog is open;
 * Menu turns into a × while the launcher is open.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { txnOpen, setTxnOpen } = useShell();
  const { t } = useLocale();
  const { access } = useMyAccess();
  const [menuOpen, setMenuOpen] = useState(false);
  const reduce = useReducedMotion();
  const hiddenOnScroll = useDockHidden();
  const phone = usePhone();
  useVisualViewportInset();

  const slots = dockSlots(
    mobileNavForAccess(access),
    canRecordTransaction(access),
  );
  const inDock = slots.some(
    (slot) =>
      slot.kind === "link" && isMobileNavItemActive(pathname, slot.item.href),
  );
  const hidden = hiddenOnScroll && !menuOpen && !txnOpen;
  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 38, mass: 0.8 };

  return (
    <>
      <nav
        className="wm-dock"
        aria-label={t.shell.mobileNavTitle}
        data-hidden={hidden || undefined}
      >
        {slots.map((slot) => {
          if (slot.kind === "add") {
            return (
              <button
                key="add"
                type="button"
                className="wm-dock-fab"
                aria-label={t.shell.addTransaction}
                aria-expanded={txnOpen}
                onClick={() => setTxnOpen(!txnOpen)}
              >
                <motion.span
                  animate={{ rotate: txnOpen ? 45 : 0 }}
                  transition={spring}
                  className="grid place-items-center"
                >
                  <Plus aria-hidden="true" strokeWidth={2.4} />
                </motion.span>
              </button>
            );
          }
          if (slot.kind === "menu") {
            const active = menuOpen || !inDock;
            // Phones (2026-10-20 refs): Menu is a page (/menu), not a sheet.
            // Tablets keep the "Semua menu" sheet.
            if (phone) {
              return (
                <Link
                  key="menu"
                  href="/menu"
                  className="wm-dock-item"
                  data-active={active || undefined}
                  aria-label={t.shell.hubs.menu}
                  aria-current={!inDock ? "page" : undefined}
                >
                  <span className="wm-dock-ic">
                    <Menu aria-hidden="true" />
                  </span>
                  <span className="wm-dock-label" aria-hidden="true">
                    {t.shell.hubs.menu}
                  </span>
                </Link>
              );
            }
            return (
              <button
                key="menu"
                type="button"
                className="wm-dock-item"
                data-active={active || undefined}
                aria-label={t.shell.v2.allMenu}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-current={!inDock ? "page" : undefined}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span className="wm-dock-ic">
                  {menuOpen ? (
                    <X aria-hidden="true" />
                  ) : (
                    <Menu aria-hidden="true" />
                  )}
                </span>
                <span className="wm-dock-label" aria-hidden="true">
                  {t.shell.hubs.menu}
                </span>
              </button>
            );
          }
          const Icon = slot.item.icon;
          const active =
            !menuOpen && isMobileNavItemActive(pathname, slot.item.href);
          const label = t.shell.mobileNav[slot.item.id];
          return (
            <Link
              key={slot.item.id}
              href={slot.item.href}
              className="wm-dock-item"
              data-active={active || undefined}
              aria-label={label}
              aria-current={
                isMobileNavItemActive(pathname, slot.item.href)
                  ? "page"
                  : undefined
              }
            >
              <motion.span
                key={active ? "on" : "off"}
                className="wm-dock-ic"
                initial={
                  active && !reduce ? { scale: 0.55, rotate: -14 } : false
                }
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 14 }}
              >
                <Icon aria-hidden="true" />
              </motion.span>
              <span className="wm-dock-label" aria-hidden="true">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
      <NavSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
