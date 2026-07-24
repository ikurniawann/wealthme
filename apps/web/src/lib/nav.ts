import {
  ArrowUpDown,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Calculator,
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
  "splitbill",
  "rekonsiliasi",
  "ai",
  "kalkulator",
  "quickinput",
  "mastercoa",
  "masterdata",
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
};

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
      {
        id: "warisan",
        href: "/warisan",
        icon: Scroll,
        badge: "New",
        badgeVariant: "new-purple",
      },
      {
        id: "donation",
        href: "/donation",
        icon: HeartHandshake,
        badge: "New",
        badgeVariant: "new-success",
      },
      {
        id: "tax",
        href: "/tax",
        icon: FileText,
        badge: "New",
        badgeVariant: "new-success",
      },
    ],
  },
  {
    headerKey: "alat",
    items: [
      {
        id: "splitbill",
        href: "/splitbill",
        icon: Receipt,
        badge: "New",
        badgeVariant: "new-success",
      },
      { id: "rekonsiliasi", href: "/rekonsiliasi", icon: GitCompare },
      { id: "ai", href: "/ai", icon: Bot },
      { id: "kalkulator", href: "/kalkulator", icon: Calculator },
      {
        id: "quickinput",
        href: "/quickinput",
        icon: Zap,
        badge: "New",
        badgeVariant: "new-success",
      },
      {
        id: "mastercoa",
        href: "/mastercoa",
        icon: BookOpen,
        badge: "New",
        badgeVariant: "new-purple",
      },
      { id: "masterdata", href: "/masterdata", icon: Database },
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
  "quickinput",
  "mastercoa",
  "masterdata",
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
