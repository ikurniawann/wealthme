import {
  BookOpen,
  Calculator,
  ChartColumn,
  ChartPie,
  CircleCheck,
  Database,
  House,
  Landmark,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  NAV_SECTIONS,
  isNavItemVisibleForAccess,
  type NavItem,
  type NavItemId,
} from "@/lib/nav";
import type { I18nDictionary } from "@/i18n/types";

type Access = Parameters<typeof isNavItemVisibleForAccess>[1];

export type MenuRow = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export type MenuSection = {
  id: "family" | "finance" | "shared" | "tools" | "help" | "more";
  /** Visible heading; the family and help rows stand alone without one. */
  title?: string;
  rows: MenuRow[];
};

const NAV_ITEMS = new Map<NavItemId, NavItem>(
  NAV_SECTIONS.flatMap((section) => section.items).map((item) => [
    item.id,
    item,
  ]),
);

/**
 * The 2026-10-20 reference grouping, mapped onto the app's own routes and
 * gated exactly like the sidebar (`isNavItemVisibleForAccess`), so a page a
 * role cannot open never shows here. `/akun` is open to every member, so the
 * two rows that land there (Ruang keluarga = its family-group card on the
 * Profil tab, Pengaturan = its Preferensi tab) are always listed. Every other
 * visible page the sidebar has and the dock does not ends up under "Fitur
 * lainnya", so nothing the sidebar offers becomes unreachable on a phone.
 */
export function buildMenuSections(
  t: I18nDictionary,
  access: Access,
  dockIds: readonly string[],
): MenuSection[] {
  const copy = t.shell.phone.menu;
  const used = new Set<string>(dockIds);
  const nav = (id: NavItemId, icon?: LucideIcon, label?: string) => {
    const item = NAV_ITEMS.get(id);
    used.add(id);
    if (!item || !isNavItemVisibleForAccess(item, access)) return [];
    return [
      {
        id,
        href: item.href,
        label: label ?? t.shell.navSections[id],
        icon: icon ?? item.icon,
      },
    ];
  };

  const sections: MenuSection[] = [
    {
      id: "family",
      rows: [
        {
          id: "family",
          href: "/akun?tab=profil",
          label: copy.familySpace,
          icon: Users,
        },
      ],
    },
    {
      id: "finance",
      title: copy.sections.finance,
      rows: [
        ...nav("rekening", Landmark, copy.items.accounts),
        ...nav("investasi", ChartColumn),
        ...nav("aset", House),
        ...nav("liabilitas", ReceiptText),
        ...nav("asuransi", ShieldCheck),
        ...nav("anggaran", ChartPie),
      ],
    },
    {
      id: "shared",
      title: copy.sections.shared,
      rows: [
        ...nav("iam", Users, copy.items.members),
        ...nav("persetujuan", CircleCheck),
      ],
    },
    {
      id: "tools",
      title: copy.sections.tools,
      rows: [
        ...nav("ai", Sparkles, copy.items.ai),
        ...nav("kalkulator", Calculator),
        ...nav("masterdata", Database, t.shell.hubs.settings),
        {
          id: "settings",
          href: "/akun?tab=preferensi",
          label: copy.items.settings,
          icon: Settings,
        },
      ],
    },
    { id: "help", rows: nav("panduan", BookOpen, copy.items.help) },
  ];

  const more: MenuRow[] = NAV_SECTIONS.flatMap((section) => section.items)
    .filter((item) => !used.has(item.id))
    .flatMap((item) => nav(item.id));
  // Akses Saya is the landing page of a member the Master scoped down; the
  // Master never needs it (same rule as the tablet launcher).
  if (access && !access.isMaster && !used.has("akses-saya")) {
    more.push({
      id: "akses-saya",
      href: "/akses-saya",
      label: t.shell.pageTitles["akses-saya"],
      icon: UserCheck,
    });
  }
  sections.push({ id: "more", title: copy.sections.more, rows: more });

  return sections.filter((section) => section.rows.length > 0);
}

/** Case-insensitive label match; an empty query keeps every row. */
export function filterMenuSections(
  sections: MenuSection[],
  query: string,
): MenuSection[] {
  const q = query.trim().toLocaleLowerCase("id");
  if (!q) return sections;
  return sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) =>
        row.label.toLocaleLowerCase("id").includes(q),
      ),
    }))
    .filter((section) => section.rows.length > 0);
}
