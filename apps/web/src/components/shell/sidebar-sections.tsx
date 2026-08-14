"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";
import { NAV_SECTIONS } from "@/lib/nav";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";
import { NavBadge, SidebarNavItem } from "./sidebar-nav-item";

/**
 * EPIC-026 shell migration — prototype `.sidebar__nav` / `.sidebar__section-header`.
 * Shared by the fixed desktop sidebar and the mobile nav sheet, which render
 * the same nav content (the sidebar itself is `display:none` below 768px).
 */
export function SidebarSections({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  // EPIC-024 A5 (D6) — gates the "Persetujuan" nav item to owner/co-master.
  const { isOwner } = useMyRole();

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
      {NAV_SECTIONS.map((section, si) => (
        <div key={si}>
          {section.headerKey && (
            <div className="sidebar__section-header">
              {t.shell.navSectionHeaders[section.headerKey]}
            </div>
          )}
          {section.items
            .filter((item) => !item.ownerOnly || isOwner)
            .map((item) => {
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
                  active={pathname === item.href}
                  badge={badge}
                  onNavigate={onNavigate}
                />
              );
            })}
        </div>
      ))}
    </nav>
  );
}
