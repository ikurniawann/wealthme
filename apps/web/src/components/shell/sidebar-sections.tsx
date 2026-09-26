"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";
import { NAV_SECTIONS, isNavItemVisibleForAccess } from "@/lib/nav";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { NavBadge, SidebarNavItem } from "./sidebar-nav-item";

/**
 * EPIC-026 shell migration — prototype `.sidebar__nav` / `.sidebar__section-header`.
 * Shared by the fixed desktop sidebar and the mobile nav sheet, which render
 * the same nav content (the sidebar itself is `display:none` below 768px).
 */
const GROUPS_STORAGE_KEY = "wm.sidebarGroups";
const GROUPS_EVENT = "wm:sidebar-groups";

/**
 * EPIC-032 Task 2 — which collapsible groups the user has closed, read
 * through `useSyncExternalStore` so the server render (nothing closed) and
 * the client hydrate from one snapshot and later toggles re-render without
 * a setState-in-effect.
 */
function subscribeGroups(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(GROUPS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(GROUPS_EVENT, onChange);
  };
}
function readClosedGroupsRaw(): string {
  try {
    return window.localStorage.getItem(GROUPS_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function writeClosedGroups(next: Set<string>) {
  try {
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    /* storage may be unavailable (private mode); the toggle just won't persist */
  }
  window.dispatchEvent(new Event(GROUPS_EVENT));
}

/**
 * Batch 5 item 1 — a strict `pathname === href` match never fires on a
 * dynamic sub-route (`/aset/123` never equals `/aset`), so the nav item
 * loses its own highlight there. First-segment matching, consistent with
 * `nav.ts`'s `isRouteAllowedForRole`/`isRouteAllowedForAccess`. No `href`
 * in `NAV_SECTIONS` is a bare prefix of another (all distinct single
 * segments), so the trailing-slash guard can't false-positive across items.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarSections({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const closedRaw = useSyncExternalStore(
    subscribeGroups,
    readClosedGroupsRaw,
    () => "[]",
  );
  const closedGroups = useMemo(() => {
    try {
      return new Set(JSON.parse(closedRaw) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [closedRaw]);
  function toggleGroup(key: string) {
    const next = new Set(closedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    writeClosedGroups(next);
  }
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  // EPIC-030 — the menu shows exactly the pages the Master granted this
  // member (custom role + overrides); IAM itself is Master-only.
  const { access } = useMyAccess();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: queryKeys.notifications.unreadCount(familyGroupId ?? ""),
    queryFn: ({ signal }) =>
      apiFetch<{ count: number }>(
        `/family-groups/${familyGroupId}/notifications/unread-count`,
        { token, signal },
      ),
    enabled: Boolean(familyGroupId) && Boolean(token),
    refetchInterval: 30_000,
  });

  const unreadCount = unreadData?.count ?? 0;

  return (
    <nav
      className="sidebar__nav hide-scrollbar"
      aria-label={t.shell.navMenuTitle}
    >
      {NAV_SECTIONS.map((section, si) => {
        const visibleItems = section.items.filter((item) =>
          isNavItemVisibleForAccess(item, access),
        );
        if (visibleItems.length === 0) return null;
        const key = section.headerKey;
        // The group holding the current page never hides it.
        const holdsActive = visibleItems.some((item) =>
          isNavItemActive(pathname, item.href),
        );
        const isOpen = !key || holdsActive || !closedGroups.has(key);
        return (
          <div key={si} className="sidebar__group" data-open={isOpen}>
            {key && (
              <button
                type="button"
                className="sidebar__section-header sidebar__group-toggle"
                aria-expanded={isOpen}
                aria-controls={`sidebar-group-${key}`}
                onClick={() => toggleGroup(key)}
              >
                <span>{t.shell.navSectionHeaders[key]}</span>
                <ChevronDown
                  className="sidebar__group-chevron"
                  aria-hidden="true"
                />
              </button>
            )}
            <div
              id={key ? `sidebar-group-${key}` : undefined}
              className="sidebar__group-items"
              hidden={!isOpen}
            >
              {visibleItems.map((item) => {
                const label = t.shell.navSections[item.id];

                // The prototype's NAV is flat — every entry, Laporan included,
                // is a plain `.nav-item` with no expandable sub-list (verified
                // in docs/prototype/assets/shell.js: zero children/sub keys).
                // `item.children` still describes the report tabs for the
                // in-page tab strip on /laporan; it just no longer renders a
                // sidebar dropdown.
                const badge =
                  item.id === "notifikasi" && unreadCount > 0 ? (
                    <NavBadge text={String(unreadCount)} variant="danger" />
                  ) : item.badge && item.badgeVariant ? (
                    <NavBadge text={item.badge} variant={item.badgeVariant} />
                  ) : undefined;

                return (
                  <SidebarNavItem
                    key={item.id}
                    href={item.href}
                    icon={item.icon}
                    label={label}
                    active={isNavItemActive(pathname, item.href)}
                    badge={badge}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
