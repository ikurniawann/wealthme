"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown,
  BookOpen,
  Calculator,
  CircleCheck,
  ClipboardList,
  Landmark,
  Home,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  NAV_SECTIONS,
  isNavItemVisibleForAccess,
  type NavItem,
  type NavItemId,
} from "@/lib/nav";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import type { I18nDictionary } from "@/i18n/types";
import type { AllowanceRequestDto } from "@wealthme/contracts";

/**
 * Batch 5 item 1 — first-segment matching so `/aset/123` still highlights
 * Aset (a strict `===` never fires on a dynamic sub-route).
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ───────────── hub model (bento v2, docs/design/proto/wm.js `WM.NAV`) ───────────── */

type HubLabelKey = "accounts" | "cashflow" | "wealth" | "taxZakat" | "settings";

type HubDef = {
  /** Nav item whose route the hub opens (also its access gate). */
  id: NavItemId;
  icon: LucideIcon;
  /** Override for the hub label; defaults to the item's own nav label. */
  labelKey?: HubLabelKey;
  children: NavItemId[];
};

export const PRIMARY_HUBS: readonly HubDef[] = [
  {
    id: "rekening",
    icon: Landmark,
    labelKey: "accounts",
    children: ["rekening", "dana"],
  },
  {
    id: "transaksi",
    icon: ArrowUpDown,
    children: ["transaksi", "rekonsiliasi", "quickinput", "splitbill"],
  },
  {
    id: "ringkasan",
    icon: Wallet,
    labelKey: "cashflow",
    children: ["ringkasan", "laporan"],
  },
  { id: "anggaran", icon: ClipboardList, children: ["anggaran", "tujuan"] },
  {
    id: "investasi",
    icon: TrendingUp,
    labelKey: "wealth",
    children: ["investasi", "aset", "liabilitas", "asuransi"],
  },
  {
    id: "tax",
    icon: Shield,
    labelKey: "taxZakat",
    children: ["tax", "donation", "warisan"],
  },
  { id: "persetujuan", icon: CircleCheck, children: [] },
];

export const SECONDARY_HUBS: readonly HubDef[] = [
  { id: "ai", icon: Sparkles, children: [] },
  { id: "kalkulator", icon: Calculator, children: [] },
  {
    id: "masterdata",
    icon: Settings,
    labelKey: "settings",
    children: ["masterdata", "mastercoa", "iam"],
  },
  { id: "panduan", icon: BookOpen, children: [] },
];

const NAV_ITEMS = new Map<NavItemId, NavItem>(
  NAV_SECTIONS.flatMap((section) => section.items).map((item) => [
    item.id,
    item,
  ]),
);

export type Hub = {
  id: NavItemId;
  icon: LucideIcon;
  labelKey?: HubLabelKey;
  href: string;
  /** Visible sub-pages; empty for single-page hubs. */
  children: NavItem[];
};

type Access = Parameters<typeof isNavItemVisibleForAccess>[1];

/**
 * Resolve hubs against the member's effective access: a hub shows when its own
 * page or any sub-page is visible, and opens the first visible page. Pure so
 * the role gating is unit-testable without rendering the shell.
 */
export function buildHubs(defs: readonly HubDef[], access: Access): Hub[] {
  return defs.flatMap((def) => {
    const item = NAV_ITEMS.get(def.id);
    if (!item) return [];
    const children = def.children
      .map((id) => NAV_ITEMS.get(id))
      .filter((child): child is NavItem =>
        Boolean(child && isNavItemVisibleForAccess(child, access)),
      );
    const selfVisible = isNavItemVisibleForAccess(item, access);
    if (!selfVisible && children.length === 0) return [];
    return [
      {
        id: def.id,
        icon: def.icon,
        labelKey: def.labelKey,
        href: selfVisible ? item.href : children[0].href,
        children,
      },
    ];
  });
}

export function hubLabel(
  hub: Pick<Hub, "id" | "labelKey">,
  t: I18nDictionary,
): string {
  return hub.labelKey
    ? t.shell.hubs[hub.labelKey]
    : t.shell.navSections[hub.id];
}

export function isHubActive(hub: Hub, pathname: string): boolean {
  return (
    isNavItemActive(pathname, hub.href) ||
    hub.children.some((child) => isNavItemActive(pathname, child.href))
  );
}

/** Both hub lists resolved for the signed-in member. */
export function useHubs() {
  const { access } = useMyAccess();
  return {
    primary: buildHubs(PRIMARY_HUBS, access),
    secondary: buildHubs(SECONDARY_HUBS, access),
  };
}

/** Pending approvals for the Persetujuan badge, fetched only when that hub is visible. */
function usePendingApprovals(enabled: boolean) {
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const { data } = useQuery<AllowanceRequestDto[]>({
    queryKey: queryKeys.allowanceRequests.all(familyGroupId ?? ""),
    queryFn: ({ signal }) =>
      apiFetch<AllowanceRequestDto[]>(
        `/family-groups/${familyGroupId}/allowance-requests`,
        { token, signal },
      ),
    enabled: enabled && Boolean(familyGroupId && token),
    staleTime: 60_000,
  });
  return (data ?? []).filter((request) => request.status === "pending").length;
}

function HubList({
  hubs,
  home = null,
  pathname,
  pending,
  t,
}: {
  hubs: Hub[];
  /** Beranda entry shown above the hubs (primary list only). */
  home?: NavItem | null;
  pathname: string;
  pending: number;
  t: I18nDictionary;
}) {
  return (
    <nav className="wm-nav" aria-label={t.shell.navMenuTitle}>
      {home && (
        <Link
          href={home.href}
          title={t.shell.navSections.beranda}
          aria-label={t.shell.navSections.beranda}
          className="wm-nav-link"
          aria-current={
            isNavItemActive(pathname, home.href) ? "page" : undefined
          }
        >
          <Home aria-hidden="true" />
          <span className="wm-nav-lbl">{t.shell.navSections.beranda}</span>
        </Link>
      )}
      {hubs.map((hub) => {
        const active = isHubActive(hub, pathname);
        const label = hubLabel(hub, t);
        const Icon = hub.icon;
        const leaf = hub.children.length === 0;
        return (
          <div key={hub.id}>
            <Link
              href={hub.href}
              title={label}
              aria-label={
                hub.id === "persetujuan" && pending > 0
                  ? `${label} (${pending})`
                  : label
              }
              className="wm-nav-link"
              aria-current={active && leaf ? "page" : undefined}
              data-open={active && !leaf ? "true" : undefined}
            >
              <Icon aria-hidden="true" />
              <span className="wm-nav-lbl">{label}</span>
              {hub.id === "persetujuan" && pending > 0 && (
                <span className="wm-badge">{pending}</span>
              )}
            </Link>
            {active && !leaf && (
              <div className="wm-sub">
                {hub.children.map((child) => (
                  <Link
                    key={child.id}
                    href={child.href}
                    className="wm-nav-link"
                    aria-current={
                      isNavItemActive(pathname, child.href) ? "page" : undefined
                    }
                  >
                    {t.shell.navSections[child.id]}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Hub sidebar body: primary hubs | separator | tools. The active hub unfolds its sub-pages. */
export function SidebarSections() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { primary, secondary } = useHubs();
  const pending = usePendingApprovals(
    primary.some((hub) => hub.id === "persetujuan"),
  );
  const { access } = useMyAccess();
  const berandaItem = NAV_ITEMS.get("beranda");
  const home =
    berandaItem && isNavItemVisibleForAccess(berandaItem, access)
      ? berandaItem
      : null;
  return (
    <>
      <HubList
        hubs={primary}
        home={home}
        pathname={pathname}
        pending={pending}
        t={t}
      />
      {secondary.length > 0 && (
        <>
          <div className="wm-sep" role="separator" />
          <HubList hubs={secondary} pathname={pathname} pending={0} t={t} />
        </>
      )}
    </>
  );
}
