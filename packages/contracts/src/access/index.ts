import { z } from "zod";

/**
 * EPIC-030 — IAM page access. One catalog shared by web (menu, route guard,
 * IAM matrix) and API (PageAccessGuard, CASL), so both sides always agree on
 * what a member may open.
 *
 * Only pages a Master may grant are listed. Always open to every member (not
 * configurable): akun, akses-saya, notifikasi (personal), panduan (help).
 * `iam` is Master-only and deliberately NOT in this catalog — granting it
 * would let a member raise their own access.
 */
export const ACCESS_PAGES = [
  "beranda",
  "ringkasan",
  "transaksi",
  "anggaran",
  "laporan",
  "tujuan",
  "dana",
  "rekening",
  "investasi",
  "aset",
  "liabilitas",
  "asuransi",
  "warisan",
  "donation",
  "tax",
  "persetujuan",
  "splitbill",
  "rekonsiliasi",
  "ai",
  "kalkulator",
  "quickinput",
  "mastercoa",
  "masterdata",
] as const;

export const AccessPageSchema = z.enum(ACCESS_PAGES);
export type AccessPage = z.infer<typeof AccessPageSchema>;

/** Routes every signed-in member may open regardless of access. */
export const ALWAYS_OPEN_PAGES = [
  "akun",
  "akses-saya",
  "notifikasi",
  "panduan",
] as const;

export const ACCESS_LEVELS = ["none", "view", "manage"] as const;
export const AccessLevelSchema = z.enum(ACCESS_LEVELS);
export type AccessLevel = z.infer<typeof AccessLevelSchema>;

/** `all` = the whole family's data; `own` = only rows the member owns/created. */
export const AccessDataScopeSchema = z.enum(["all", "own"]);
export type AccessDataScope = z.infer<typeof AccessDataScopeSchema>;

/** Sparse page → level map. A page that is absent means `none`. */
export const AccessPermissionsSchema = z
  .record(z.string(), AccessLevelSchema)
  .transform((raw) => {
    // Drop unknown keys (e.g. a page removed from the catalog) instead of
    // failing a whole role over one stale entry.
    const clean: Partial<Record<AccessPage, AccessLevel>> = {};
    for (const [page, level] of Object.entries(raw)) {
      if (AccessPageSchema.safeParse(page).success) {
        clean[page as AccessPage] = level;
      }
    }
    return clean;
  });
export type AccessPermissions = Partial<Record<AccessPage, AccessLevel>>;

export type MemberRoleKey =
  | "owner"
  | "spouse"
  | "member"
  | "admin_staff"
  | "dependant"
  | "operational";

const all = (level: AccessLevel): AccessPermissions =>
  Object.fromEntries(ACCESS_PAGES.map((p) => [p, level])) as AccessPermissions;

/**
 * What each built-in role could reach before EPIC-030 (nav.ts allowlists +
 * casl-ability.factory.ts). A member with no custom role and no overrides
 * resolves to exactly this, so nobody's access changes until the Master
 * assigns something.
 */
export const LEGACY_ACCESS_PRESETS: Record<
  Exclude<MemberRoleKey, "owner">,
  { permissions: AccessPermissions; dataScope: AccessDataScope }
> = {
  // Everything except Persetujuan (ownerOnly in the nav) and IAM.
  spouse: {
    permissions: { ...all("manage"), persetujuan: "none" },
    dataScope: "all",
  },
  member: {
    permissions: {
      ...all("manage"),
      beranda: "view",
      ringkasan: "view",
      laporan: "view",
      dana: "view",
      rekening: "view",
      persetujuan: "none",
      ai: "view",
      kalkulator: "view",
      mastercoa: "view",
      masterdata: "view",
    },
    dataScope: "all",
  },
  // Bookkeeper: reads everything, works reconciliation and records transactions.
  admin_staff: {
    permissions: {
      ...all("view"),
      persetujuan: "none",
      rekonsiliasi: "manage",
      transaksi: "manage",
      quickinput: "manage",
    },
    dataScope: "all",
  },
  dependant: {
    permissions: {
      transaksi: "manage",
      quickinput: "manage",
      dana: "view",
      rekening: "view",
      warisan: "view",
    },
    dataScope: "own",
  },
  operational: {
    permissions: {
      transaksi: "manage",
      quickinput: "manage",
      dana: "view",
      rekening: "view",
    },
    dataScope: "own",
  },
};

export type EffectiveAccess = {
  /** Master: bypasses every page check. */
  isMaster: boolean;
  permissions: Record<AccessPage, AccessLevel>;
  dataScope: AccessDataScope;
  /** Where the base came from — shown on /iam. */
  source: "master" | "custom-role" | "legacy";
  /** Member has at least one per-member override on top of the base. */
  hasOverrides: boolean;
};

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, view: 1, manage: 2 };

export function levelAtLeast(have: AccessLevel, need: AccessLevel): boolean {
  return LEVEL_RANK[have] >= LEVEL_RANK[need];
}

/**
 * Master → full. Otherwise: custom role's map (or the legacy preset of the
 * built-in role when none is assigned), then per-member overrides on top.
 * Pure — the API and web both call this, so they cannot disagree.
 */
export function resolveEffectiveAccess(input: {
  role: MemberRoleKey;
  accessRole?: {
    permissions: AccessPermissions;
    dataScope: AccessDataScope;
  } | null;
  overrides?: AccessPermissions | null;
}): EffectiveAccess {
  if (input.role === "owner") {
    return {
      isMaster: true,
      permissions: all("manage") as Record<AccessPage, AccessLevel>,
      dataScope: "all",
      source: "master",
      hasOverrides: false,
    };
  }
  const base = input.accessRole ?? LEGACY_ACCESS_PRESETS[input.role];
  const permissions = Object.fromEntries(
    ACCESS_PAGES.map((page) => [
      page,
      input.overrides?.[page] ?? base.permissions[page] ?? "none",
    ]),
  ) as Record<AccessPage, AccessLevel>;
  return {
    isMaster: false,
    permissions,
    dataScope: base.dataScope,
    source: input.accessRole ? "custom-role" : "legacy",
    hasOverrides: Object.keys(input.overrides ?? {}).length > 0,
  };
}

export function canAccessPage(
  access: EffectiveAccess,
  page: AccessPage,
  need: AccessLevel = "view",
): boolean {
  return access.isMaster || levelAtLeast(access.permissions[page], need);
}

// ── API DTO shapes ────────────────────────────────────────────────────────

export const AccessRoleInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).nullable().optional(),
  dataScope: AccessDataScopeSchema,
  permissions: AccessPermissionsSchema,
});
export type AccessRoleInput = z.infer<typeof AccessRoleInputSchema>;

export type AccessRoleResponse = {
  id: string;
  name: string;
  description: string | null;
  dataScope: AccessDataScope;
  permissions: AccessPermissions;
  memberCount: number;
  createdAt: string;
};

export const MemberAccessInputSchema = z.object({
  /** null = no custom role (use the built-in role's preset). */
  accessRoleId: z.string().min(1).nullable(),
  /** Sparse overrides on top of the role; {} clears them. */
  overrides: AccessPermissionsSchema,
});
export type MemberAccessInput = z.infer<typeof MemberAccessInputSchema>;

export type MyAccessResponse = EffectiveAccess;
