"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronRight,
  LayoutGrid,
  Search,
  User,
  UserCheck,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { NAV_SECTIONS, isNavItemVisibleForAccess } from "@/lib/nav";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import type { I18nDictionary } from "@/i18n/types";
import { useShell } from "./shell-context";
import {
  hubLabel,
  isNavItemActive,
  useHubs,
  type Hub,
} from "./sidebar-sections";

type App = { id: string; href: string; label: string; icon: LucideIcon };
type Section = { title: string; icon: LucideIcon; apps: App[] };

const ITEM = new Map<string, (typeof NAV_SECTIONS)[number]["items"][number]>(
  NAV_SECTIONS.flatMap((section) => section.items).map((item) => [
    item.id,
    item,
  ]),
);

/**
 * Launcher sections (docs/design/proto/wm.js `launcher`): "Utama" holds home,
 * notifications, account and every single-page hub; each multi-page hub gets
 * its own grid. Built from the already access-filtered hubs.
 */
export function buildLauncherSections(
  hubs: Hub[],
  t: I18nDictionary,
  visible: (id: "beranda" | "notifikasi" | "akses-saya") => boolean,
): Section[] {
  const main: App[] = [];
  if (visible("beranda"))
    main.push({
      id: "beranda",
      href: "/beranda",
      label: t.shell.navSections.beranda,
      icon: LayoutGrid,
    });
  if (visible("akses-saya"))
    main.push({
      id: "akses-saya",
      href: "/akses-saya",
      label: t.shell.pageTitles["akses-saya"],
      icon: UserCheck,
    });
  if (visible("notifikasi"))
    main.push({
      id: "notifikasi",
      href: "/notifikasi",
      label: t.shell.navSections.notifikasi,
      icon: Bell,
    });
  main.push({
    id: "akun",
    href: "/akun",
    label: t.shell.v2.account,
    icon: User,
  });
  const sections: Section[] = [
    { title: t.shell.v2.launcherMain, icon: LayoutGrid, apps: main },
  ];
  for (const hub of hubs) {
    if (hub.id === "beranda") continue;
    if (hub.children.length === 0) {
      main.push({
        id: hub.id,
        href: hub.href,
        label: hubLabel(hub, t),
        icon: hub.icon,
      });
    } else {
      sections.push({
        title: hubLabel(hub, t),
        icon: hub.icon,
        apps: hub.children.map((child) => ({
          id: child.id,
          href: child.href,
          label: t.shell.navSections[child.id],
          icon: child.icon,
        })),
      });
    }
  }
  return sections;
}

/** Phone "Semua menu" sheet, opened from the dock's Menu button. Replaces the old hamburger drawer. */
export function NavSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const pathname = usePathname();
  const { setSearchOpen } = useShell();
  const { access } = useMyAccess();
  const { primary, secondary } = useHubs();
  const sections = buildLauncherSections(
    [...primary, ...secondary],
    t,
    (id) => {
      const item = ITEM.get(id);
      if (item) return isNavItemVisibleForAccess(item, access);
      return Boolean(access && !access.isMaster);
    },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PanelContent variant="sheet">
        <header className="wm-panel-head">
          <DialogTitle className="wm-panel-title">
            {t.shell.v2.allMenu}
          </DialogTitle>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <XIcon aria-hidden="true" />
          </DialogClose>
        </header>
        <div className="wm-panel-body">
          <button
            type="button"
            className="wm-launch-search"
            onClick={() => {
              onOpenChange(false);
              setSearchOpen(true);
            }}
          >
            <Search className="size-4" aria-hidden="true" />
            <span>{t.shell.v2.searchShort}</span>
          </button>
          {sections.map((section) => (
            <section
              key={section.title}
              className="wm-lgroup"
              aria-label={section.title}
            >
              <h3>{section.title}</h3>
              <ul>
                {section.apps.map((app) => {
                  const Icon = app.icon;
                  const current = isNavItemActive(pathname, app.href);
                  return (
                    <li key={app.id}>
                      <Link
                        href={app.href}
                        className="wm-lrow"
                        aria-current={current ? "page" : undefined}
                        onClick={() => onOpenChange(false)}
                      >
                        <span className="wm-lrow-ic">
                          <Icon aria-hidden="true" />
                        </span>
                        <span className="wm-lrow-lbl">{app.label}</span>
                        <ChevronRight
                          className="wm-lrow-chev"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </PanelContent>
    </Dialog>
  );
}
