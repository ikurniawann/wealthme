import {
  ACCESS_PAGES,
  LEGACY_ACCESS_PRESETS,
  type AccessDataScope,
  type AccessLevel,
  type AccessPage,
  type AccessPermissions,
  type AccessRoleResponse,
} from "@wealthme/contracts";

import { NAV_SECTIONS, type NavSectionHeaderKey } from "@/lib/nav";

/** Catalog pages grouped exactly like the sidebar, so the matrix reads like the menu. */
export type PageGroup = {
  headerKey: NavSectionHeaderKey | null;
  pages: AccessPage[];
};

const CATALOG = new Set<string>(ACCESS_PAGES);

export const PAGE_GROUPS: PageGroup[] = NAV_SECTIONS.map((section) => ({
  headerKey: section.headerKey ?? null,
  pages: section.items
    .map((item) => item.id)
    .filter((id): id is AccessPage => CATALOG.has(id)),
})).filter((g) => g.pages.length > 0);

export const LEVEL_OPTIONS: { level: AccessLevel; label: string }[] = [
  { level: "none", label: "Tidak" },
  { level: "view", label: "Lihat" },
  { level: "manage", label: "Kelola" },
];

export const LEVEL_HINT: Record<AccessLevel, string> = {
  none: "Tidak muncul di menu",
  view: "Bisa membuka, tidak bisa mengubah",
  manage: "Bisa membuka, menambah, mengubah, menghapus",
};

export const SCOPE_COPY: Record<
  AccessDataScope,
  { title: string; detail: string; short: string }
> = {
  all: {
    title: "Semua data keluarga",
    detail:
      "Melihat rekening & transaksi seluruh keluarga di halaman yang dibuka.",
    short: "Semua data keluarga",
  },
  own: {
    title: "Hanya data miliknya",
    detail:
      "Hanya rekening miliknya dan transaksi yang dia catat. Laporan keluarga tertutup.",
    short: "Hanya data miliknya",
  },
};

/** Pastel avatar colors (iam.html's `.ak-av`/avatar chips) cycled by row
 * index — akun's member list uses the same palette (see akun.css). */
export const MEMBER_PASTELS: { bg: string; fg: string }[] = [
  { bg: "var(--wm-ghost)", fg: "var(--wm-ink)" },
  { bg: "#FDE2C8", fg: "#7A3A1F" },
  { bg: "#DDEBFD", fg: "#1F3A7A" },
  { bg: "#F5E1FD", fg: "#5A1F7A" },
  { bg: "#FDE2E2", fg: "#7A1F1F" },
  { bg: "#DFF7EC", fg: "#1F6B4A" },
];

/** "5 halaman · 2 kelola" — one-line summary of a permission map. */
export function summarizePermissions(perms: AccessPermissions): string {
  const levels = Object.values(perms);
  const open = levels.filter((l) => l !== "none").length;
  const manage = levels.filter((l) => l === "manage").length;
  if (open === 0) return "Belum ada halaman";
  return manage > 0
    ? `${open} halaman · ${manage} bisa dikelola`
    : `${open} halaman · lihat saja`;
}

/** Full map with every catalog page present (absent → none). */
export function fillPermissions(
  perms: AccessPermissions,
): Record<AccessPage, AccessLevel> {
  return Object.fromEntries(
    ACCESS_PAGES.map((p) => [p, perms[p] ?? "none"]),
  ) as Record<AccessPage, AccessLevel>;
}

/** Sparse map with only granted pages — what the API stores. */
export function compactPermissions(
  perms: Record<AccessPage, AccessLevel>,
): AccessPermissions {
  return Object.fromEntries(
    Object.entries(perms).filter(([, l]) => l !== "none"),
  ) as AccessPermissions;
}

/**
 * How many catalog pages a member can fully manage — the hero chart's
 * "N halaman" bar, mirroring docs/design/proto/iam.html's `permsOf`/`chart`.
 * Master always manages every page; everyone else resolves role → preset →
 * per-member overrides, same precedence as `scopeOf` in members-tab.tsx.
 */
export function managedPageCount(
  member: {
    role: string;
    accessRoleId?: string | null;
    accessOverrides?: AccessPermissions;
  },
  roles: AccessRoleResponse[],
): number {
  if (member.role === "owner") return ACCESS_PAGES.length;
  const customRole = roles.find((r) => r.id === member.accessRoleId);
  const preset =
    LEGACY_ACCESS_PRESETS[member.role as keyof typeof LEGACY_ACCESS_PRESETS];
  const base = customRole?.permissions ?? preset?.permissions ?? {};
  const effective = { ...base, ...(member.accessOverrides ?? {}) };
  return Object.values(effective).filter((level) => level === "manage").length;
}
