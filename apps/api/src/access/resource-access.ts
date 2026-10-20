import {
  levelAtLeast,
  type AccessLevel,
  type AccessPage,
  type EffectiveAccess,
} from "@wealthme/contracts";

/**
 * EPIC-030 — which IAM pages open which API resource. ONE table drives both
 * PageAccessGuard (route level) and the page-derived CASL ability, so a page
 * the Master grants in /iam opens exactly the endpoints that page calls.
 *
 * `read`  — GET/HEAD needs `view` on ANY of these pages. Wider than the owning
 *           page on purpose: pickers and summaries (e.g. the account list on
 *           Transaksi, budgets on Beranda) read other resources.
 * `write` — anything else needs `manage` on ANY of these pages.
 * `"any"` — every member of the family (personal or lookup data; row-scoping
 *           and CASL still apply).
 * `level` — force a level regardless of HTTP method (e.g. chatting with the
 *           AI advisor is a POST but only "using" the page).
 */
export type PageRule = readonly AccessPage[] | "any";

export type ResourceAccess = {
  read: PageRule;
  write: PageRule;
  level?: AccessLevel;
};

export const RESOURCE_ACCESS = {
  accounts: {
    read: [
      "dana",
      "rekening",
      "transaksi",
      "beranda",
      "anggaran",
      "aset",
      "asuransi",
      "donation",
      "liabilitas",
      "persetujuan",
      "rekonsiliasi",
      "splitbill",
    ],
    write: ["dana", "rekening"],
  },
  // `quickinput` is a Master/Co-Master-only page, not a grantable AccessPage
  // (see contracts `ACCESS_PAGES`) — it posts through these same endpoints,
  // so `transaksi` access alone still covers everyone else who needs
  // /transaksi to work.
  transactions: {
    read: ["transaksi", "dana", "rekening", "beranda"],
    write: ["transaksi"],
  },
  attachments: {
    read: ["transaksi", "dana", "rekening"],
    write: ["transaksi"],
  },
  categories: { read: "any", write: ["masterdata", "mastercoa"] },
  "reference-items": { read: "any", write: ["masterdata"] },
  "coa-accounts": {
    read: ["anggaran", "laporan", "mastercoa", "masterdata"],
    write: ["mastercoa"],
  },
  budgets: { read: ["anggaran", "beranda"], write: ["anggaran"] },
  goals: { read: ["tujuan", "beranda"], write: ["tujuan"] },
  liabilities: {
    read: ["liabilitas", "beranda", "ringkasan", "anggaran", "transaksi"],
    write: ["liabilitas"],
  },
  insurances: { read: ["asuransi", "anggaran"], write: ["asuransi"] },
  investments: {
    read: ["investasi", "aset", "laporan"],
    write: ["investasi"],
  },
  assets: { read: ["aset", "warisan"], write: ["aset"] },
  // Aset Task 17 review — the overview carries every account balance,
  // holding, liability and net worth: only the Aset page opens it (assets
  // read alone also opens for Warisan).
  "assets.overview": { read: ["aset"], write: ["aset"] },
  inheritance: { read: ["warisan"], write: ["warisan"] },
  donations: { read: ["donation"], write: ["donation"] },
  tax: { read: ["tax"], write: ["tax"] },
  "split-bills": { read: ["splitbill"], write: ["splitbill"] },
  reconciliation: { read: ["rekonsiliasi"], write: ["rekonsiliasi"] },
  dashboard: {
    read: ["beranda", "ringkasan", "ai", "aset", "laporan", "liabilitas"],
    write: ["beranda"],
  },
  reports: { read: ["laporan", "ringkasan"], write: ["laporan"] },
  exports: { read: ["laporan"], write: ["laporan"], level: "view" },
  "ai-advisor": { read: ["ai"], write: ["ai"], level: "view" },
  "ai-key": { read: ["ai"], write: ["ai"] },
  // Anyone may ask for money and see their own requests; deciding is Persetujuan.
  "allowance-requests": { read: "any", write: "any" },
  "allowance-requests.decide": {
    read: ["persetujuan"],
    write: ["persetujuan"],
  },
  // Personal / lookup / owner-checked-elsewhere surfaces.
  "member-category-allowances": { read: "any", write: "any" },
  notifications: { read: "any", write: "any" },
  search: { read: "any", write: "any" },
  "family-groups": { read: "any", write: "any" },
  // The IAM screen itself: nobody but the Master, ever (empty = no page opens it).
  iam: { read: [], write: [] },
  // A member reading their own effective access.
  "my-access": { read: "any", write: [] },
} as const satisfies Record<string, ResourceAccess>;

export type ResourceKey = keyof typeof RESOURCE_ACCESS;

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function ruleAllows(
  access: EffectiveAccess,
  rule: PageRule,
  need: AccessLevel,
): boolean {
  if (rule === "any") return true;
  return rule.some((page) => levelAtLeast(access.permissions[page], need));
}

/** Route-level decision for PageAccessGuard. */
export function resourceAllows(
  access: EffectiveAccess,
  resource: ResourceKey,
  httpMethod: string,
): boolean {
  if (access.isMaster) return true;
  const entry: ResourceAccess = RESOURCE_ACCESS[resource];
  const isRead = READ_METHODS.has(httpMethod.toUpperCase());
  const rule = isRead ? entry.read : entry.write;
  const need: AccessLevel = entry.level ?? (isRead ? "view" : "manage");
  return ruleAllows(access, rule, need);
}

/** CASL helpers: may read / may manage the resource at all. */
export function canReadResource(
  access: EffectiveAccess,
  resource: ResourceKey,
): boolean {
  if (access.isMaster) return true;
  const entry: ResourceAccess = RESOURCE_ACCESS[resource];
  return ruleAllows(access, entry.read, "view");
}

export function canWriteResource(
  access: EffectiveAccess,
  resource: ResourceKey,
): boolean {
  if (access.isMaster) return true;
  const entry: ResourceAccess = RESOURCE_ACCESS[resource];
  return ruleAllows(access, entry.write, entry.level ?? "manage");
}
