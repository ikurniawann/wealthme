import {
  ACCESS_PAGES,
  type AccessDataScope,
  type AccessLevel,
  type AccessPage,
  type AccessPermissions,
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
