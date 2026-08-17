import {
  ArrowUpDown,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Calculator,
  CheckCheck,
  ClipboardList,
  Database,
  FileText,
  GitCompare,
  HeartHandshake,
  HelpCircle,
  Home,
  Landmark,
  LineChart,
  PieChart,
  Receipt,
  ReceiptText,
  Scroll,
  ShieldCheck,
  Target,
  User,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type BadgeVariant = "danger" | "new-purple" | "new-success";

// Structural data only — labels/titles resolve from the i18n `shell`
// dictionary section at render time (see apps/web/src/i18n/types.ts). These
// `as const` id lists are the single source of truth for the literal-union
// key types the dictionary's `shell.navSections` / `shell.reportTabs` /
// `shell.pageTitles` / `shell.mobileNav` Records are keyed by, so a missing
// translation is a compile error rather than a silent fallback.

export const REPORT_TAB_IDS = [
  "rsum",
  "rharian",
  "rbulanan",
  "rtahunan",
  "rfamily",
  "rbank",
  "rdetail",
  "raliran",
  "rpnl",
  "rbalance",
  "rcashflow",
  "rkas",
  "rinv",
  "rasl",
  "rperf",
  "rpajak",
  // EPIC-024 Task M (M2, D16, US-RPT-14) — Laporan COA yearly matrix
  // (tanggal x bulan). Protected-file addition explicitly authorized by
  // the epic's Task M scope — kept minimal (one new tab id).
  "rcoa",
] as const;

export type ReportTabId = (typeof REPORT_TAB_IDS)[number];

export type ReportTab = { id: ReportTabId };

export const REPORT_TABS: ReportTab[] = REPORT_TAB_IDS.map((id) => ({ id }));

export const NAV_ITEM_IDS = [
  "beranda",
  "ringkasan",
  "transaksi",
  "anggaran",
  "laporan",
  "tujuan",
  "notifikasi",
  "dana",
  "rekening",
  "investasi",
  "aset",
  "liabilitas",
  "asuransi",
  "warisan",
  "donation",
  "tax",
  // EPIC-024 A5 (D6, US-FAM-19) — owner/co-master only, see `ownerOnly`.
  "persetujuan",
  "splitbill",
  "rekonsiliasi",
  "ai",
  "kalkulator",
  "quickinput",
  "mastercoa",
  "masterdata",
  "iam",
  "panduan",
] as const;

export type NavItemId = (typeof NAV_ITEM_IDS)[number];

export const NAV_SECTION_HEADER_KEYS = ["keuangan", "alat"] as const;

export type NavSectionHeaderKey = (typeof NAV_SECTION_HEADER_KEYS)[number];

export type NavItem = {
  id: NavItemId;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: BadgeVariant;
  children?: ReportTab[];
  // EPIC-024 A5 (D6) — hidden from the sidebar for any role except
  // `owner` (the co-master istri holds `role: owner` too per A1, so this
  // single check covers "owner/co-master only" with no separate case).
  ownerOnly?: boolean;
};

/**
 * Nav items a ROW-SCOPED role (`dependant` = "Anak", `operational` =
 * "Staff Operasional") may see. Everything not listed here is hidden.
 *
 * This is an allowlist, not a denylist, and it is derived from what the API
 * actually grants those two roles — not from a guess about what looks
 * child-appropriate:
 *
 *   - `casl-ability.factory.ts` grants BOTH roles only: read Account,
 *     create/read AllowanceRequest, read FamilyGroup, create/read
 *     Transaction — plus read Inheritance for `dependant` alone. No Asset,
 *     Liability, Investment, Budget, Goal, Insurance, Donation, TaxRecord,
 *     CoaAccount, Member, Reconciliation or AiKey grant exists for either.
 *   - `assertHouseholdWideReadAllowed` (privacy.util.ts) hard-denies both
 *     roles with 403 on /reports (ringkasan + laporan), /exports,
 *     /ai-advisor, and the dashboard's net-worth-trend route.
 *   - `/dashboard/summary` (beranda) is NOT 403 — verified live, it answers
 *     200 — but every figure comes back zero, because it is row-scoped and
 *     these roles own nothing household-wide. That is arguably worse than a
 *     refusal: a wall of "Rp 0" reads as "this family has no money" rather
 *     than "you cannot see this", so beranda is hidden too.
 *
 * So before this filter existed, a child signed in and saw ~31 of 34 menu
 * entries, nearly all of which answer 403 the moment they are opened. The
 * prototype's own permission matrix (docs/prototype/pages/iam.html) says the
 * same thing in product terms: Anak and Staff get "Tidak ada" on family
 * wealth, approvals, and IAM/master data.
 *
 * `akses-saya` is the prototype's designated landing page for these roles
 * ("Preview Anak / Staff" in iam.html) — it is the one surface built to
 * explain what they can and cannot reach.
 */
const ROW_SCOPED_NAV_ALLOWLIST: Record<
  "dependant" | "operational",
  readonly NavItemId[]
> = {
  // read Inheritance is granted to `dependant` only, hence `warisan` here
  // and not in `operational` below.
  dependant: [
    "transaksi",
    "dana",
    "rekening",
    "warisan",
    "notifikasi",
    "quickinput",
    "panduan",
  ],
  operational: [
    "transaksi",
    "dana",
    "rekening",
    "notifikasi",
    "quickinput",
    "panduan",
  ],
};

/** `dependant`/`operational` — the two roles CASL scopes to their own rows. */
export function isRowScopedRole(
  role: string | null | undefined,
): role is "dependant" | "operational" {
  return role === "dependant" || role === "operational";
}

/** Whether `role` sees `id` in the sidebar. Unknown/trusted roles keep today's behaviour. */
export function isNavItemVisibleForRole(
  item: Pick<NavItem, "id" | "ownerOnly">,
  role: string | null | undefined,
): boolean {
  if (isRowScopedRole(role)) {
    return ROW_SCOPED_NAV_ALLOWLIST[role].includes(item.id);
  }
  return !item.ownerOnly || role === "owner";
}

/**
 * Routes a row-scoped role may open directly, beyond its sidebar allowlist:
 * `akses-saya` (their landing page) and `akun` (own profile) are reachable
 * from the shell chrome rather than the nav list, so neither appears in
 * `ROW_SCOPED_NAV_ALLOWLIST` yet both must stay open — otherwise the guard
 * would bounce them off their own home in a loop.
 */
const ROW_SCOPED_EXTRA_ROUTES: readonly string[] = ["akses-saya", "akun"];

/** Whether a row-scoped role may open `pathname`. Trusted roles: always true. */
export function isRouteAllowedForRole(
  pathname: string,
  role: string | null | undefined,
): boolean {
  if (!isRowScopedRole(role)) return true;
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return false; // "/" → send them to their own landing page
  if (ROW_SCOPED_EXTRA_ROUTES.includes(seg)) return true;
  return (ROW_SCOPED_NAV_ALLOWLIST[role] as readonly string[]).includes(seg);
}

export type NavSection = { headerKey?: NavSectionHeaderKey; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: "beranda", href: "/beranda", icon: Home },
      { id: "ringkasan", href: "/ringkasan", icon: PieChart },
      { id: "transaksi", href: "/transaksi", icon: ArrowUpDown },
      { id: "anggaran", href: "/anggaran", icon: ClipboardList },
      {
        id: "laporan",
        href: "/laporan",
        icon: LineChart,
        children: REPORT_TABS,
      },
      { id: "tujuan", href: "/tujuan", icon: Target },
      { id: "notifikasi", href: "/notifikasi", icon: Bell },
    ],
  },
  {
    headerKey: "keuangan",
    items: [
      { id: "dana", href: "/dana", icon: Wallet },
      { id: "rekening", href: "/rekening", icon: Landmark },
      { id: "investasi", href: "/investasi", icon: BarChart3 },
      { id: "aset", href: "/aset", icon: Briefcase },
      { id: "liabilitas", href: "/liabilitas", icon: ReceiptText },
      { id: "asuransi", href: "/asuransi", icon: ShieldCheck },
      { id: "warisan", href: "/warisan", icon: Scroll },
      { id: "donation", href: "/donation", icon: HeartHandshake },
      { id: "tax", href: "/tax", icon: FileText },
      {
        id: "persetujuan",
        href: "/persetujuan",
        icon: CheckCheck,
        ownerOnly: true,
      },
    ],
  },
  {
    headerKey: "alat",
    items: [
      { id: "splitbill", href: "/splitbill", icon: Receipt },
      { id: "rekonsiliasi", href: "/rekonsiliasi", icon: GitCompare },
      { id: "ai", href: "/ai", icon: Bot },
      { id: "kalkulator", href: "/kalkulator", icon: Calculator },
      { id: "quickinput", href: "/quickinput", icon: Zap },
      { id: "mastercoa", href: "/mastercoa", icon: BookOpen },
      { id: "masterdata", href: "/masterdata", icon: Database },
      { id: "iam", href: "/iam", icon: ShieldCheck, ownerOnly: true },
      { id: "panduan", href: "/panduan", icon: HelpCircle },
    ],
  },
];

// PAGE_TITLE_IDS covers every NAV_ITEM_ID plus "akun" (the account page,
// which is linked from the sidebar footer / mobile nav rather than
// NAV_SECTIONS).
export const PAGE_TITLE_IDS = [
  "beranda",
  "ringkasan",
  "transaksi",
  "anggaran",
  "laporan",
  "tujuan",
  "notifikasi",
  "dana",
  "rekening",
  "investasi",
  "aset",
  "liabilitas",
  "asuransi",
  "ai",
  "kalkulator",
  "akun",
  "splitbill",
  "rekonsiliasi",
  "warisan",
  "donation",
  "tax",
  "persetujuan",
  "quickinput",
  "mastercoa",
  "masterdata",
  "iam",
  "akses-saya",
  "panduan",
] as const;

export type PageTitleId = (typeof PAGE_TITLE_IDS)[number];

const PAGE_TITLE_ID_SET: ReadonlySet<string> = new Set(PAGE_TITLE_IDS);

/** Type guard for indexing `t.shell.pageTitles` with a raw pathname segment. */
export function isPageTitleId(id: string): id is PageTitleId {
  return PAGE_TITLE_ID_SET.has(id);
}

export const MOBILE_NAV_IDS = [
  "beranda",
  "transaksi",
  "laporan",
  "akun",
  "notifikasi",
  // Row-scoped roles get this in place of beranda/laporan — see
  // `mobileNavForRole`. Both of those call household-wide endpoints that
  // `assertHouseholdWideReadAllowed` denies outright for dependant/operational.
  "akses-saya",
] as const;

export type MobileNavId = (typeof MOBILE_NAV_IDS)[number];

export type MobileNavItem = {
  id: MobileNavId;
  href: string;
  icon: LucideIcon;
};

export const MOBILE_NAV: MobileNavItem[] = [
  { id: "beranda", href: "/beranda", icon: Home },
  { id: "transaksi", href: "/transaksi", icon: ArrowUpDown },
  { id: "laporan", href: "/laporan", icon: LineChart },
  { id: "akun", href: "/akun", icon: User },
];

/**
 * The bottom bar a row-scoped role gets: `beranda` (dashboard) and `laporan`
 * (reports) are replaced by `akses-saya`, because both of the former call
 * endpoints `assertHouseholdWideReadAllowed` denies for dependant/operational
 * — leaving them in the bar would give a child two of four buttons that only
 * ever lead to a 403. Trusted roles keep `MOBILE_NAV` unchanged.
 */
export function mobileNavForRole(
  role: string | null | undefined,
): MobileNavItem[] {
  if (role !== "dependant" && role !== "operational") return MOBILE_NAV;
  // FOUR items, deliberately — the same count the trusted bar uses. The
  // round "Tambah transaksi" FAB is centred at `left: 50%` over this bar
  // (design-system.css), which lands in the GAP between items 2 and 3 only
  // when the count is even; with three items dead centre is the middle
  // item itself and the FAB covers it. `notifikasi` fills the slot and is
  // already in this role's sidebar allowlist, so it grants nothing new.
  return [
    { id: "akses-saya", href: "/akses-saya", icon: Home },
    { id: "transaksi", href: "/transaksi", icon: ArrowUpDown },
    { id: "notifikasi", href: "/notifikasi", icon: Bell },
    { id: "akun", href: "/akun", icon: User },
  ];
}
