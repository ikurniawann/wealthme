import {
  ArrowUpDown,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Calculator,
  ClipboardList,
  Database,
  FileText,
  GitCompare,
  HeartHandshake,
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

export type ReportTab = { id: string; label: string };

export const REPORT_TABS: ReportTab[] = [
  { id: "rsum", label: "Ringkasan" },
  { id: "rharian", label: "Laporan Harian" },
  { id: "rbulanan", label: "Laporan Bulanan" },
  { id: "rtahunan", label: "Laporan Tahunan" },
  { id: "rfamily", label: "Laporan Group Family" },
  { id: "rbank", label: "Laporan Bank" },
  { id: "rdetail", label: "Laporan Detail" },
  { id: "raliran", label: "Laporan Aliran Dana" },
  { id: "rpnl", label: "Laporan PNL" },
  { id: "rbalance", label: "Laporan Balance Sheet" },
  { id: "rcashflow", label: "Cashflow" },
];

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: BadgeVariant;
  children?: ReportTab[];
};

export type NavSection = { label?: string; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: "beranda", label: "Beranda", href: "/beranda", icon: Home },
      {
        id: "ringkasan",
        label: "Ringkasan",
        href: "/ringkasan",
        icon: PieChart,
      },
      {
        id: "transaksi",
        label: "Transaksi",
        href: "/transaksi",
        icon: ArrowUpDown,
      },
      {
        id: "anggaran",
        label: "Anggaran",
        href: "/anggaran",
        icon: ClipboardList,
      },
      {
        id: "laporan",
        label: "Laporan",
        href: "/laporan",
        icon: LineChart,
        children: REPORT_TABS,
      },
      { id: "tujuan", label: "Tujuan Keuangan", href: "/tujuan", icon: Target },
      {
        id: "notifikasi",
        label: "Notifikasi",
        href: "/notifikasi",
        icon: Bell,
      },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { id: "dana", label: "Dana", href: "/dana", icon: Wallet },
      { id: "rekening", label: "Rekening", href: "/rekening", icon: Landmark },
      {
        id: "investasi",
        label: "Investasi",
        href: "/investasi",
        icon: BarChart3,
      },
      { id: "aset", label: "Aset", href: "/aset", icon: Briefcase },
      {
        id: "liabilitas",
        label: "Liabilitas",
        href: "/liabilitas",
        icon: ReceiptText,
      },
      {
        id: "asuransi",
        label: "Asuransi",
        href: "/asuransi",
        icon: ShieldCheck,
      },
      {
        id: "warisan",
        label: "Warisan",
        href: "/warisan",
        icon: Scroll,
        badge: "New",
        badgeVariant: "new-purple",
      },
      {
        id: "donation",
        label: "Donasi & Zakat",
        href: "/donation",
        icon: HeartHandshake,
        badge: "New",
        badgeVariant: "new-success",
      },
      {
        id: "tax",
        label: "Tax Center",
        href: "/tax",
        icon: FileText,
        badge: "New",
        badgeVariant: "new-success",
      },
    ],
  },
  {
    label: "Alat",
    items: [
      {
        id: "splitbill",
        label: "Split Bill",
        href: "/splitbill",
        icon: Receipt,
        badge: "New",
        badgeVariant: "new-success",
      },
      {
        id: "rekonsiliasi",
        label: "Rekonsiliasi Bank",
        href: "/rekonsiliasi",
        icon: GitCompare,
      },
      { id: "ai", label: "AI Advisor", href: "/ai", icon: Bot },
      {
        id: "kalkulator",
        label: "Kalkulator",
        href: "/kalkulator",
        icon: Calculator,
      },
      {
        id: "quickinput",
        label: "Quick Input",
        href: "/quickinput",
        icon: Zap,
        badge: "New",
        badgeVariant: "new-success",
      },
      {
        id: "masterdata",
        label: "Setup Master Data",
        href: "/masterdata",
        icon: Database,
      },
    ],
  },
];

export const PAGE_TITLES: Record<string, string> = {
  beranda: "Beranda",
  ringkasan: "Ringkasan",
  transaksi: "Transaksi",
  anggaran: "Anggaran",
  laporan: "Laporan",
  tujuan: "Tujuan Keuangan",
  notifikasi: "Notifikasi",
  dana: "Dana",
  rekening: "Rekening",
  investasi: "Investasi",
  aset: "Aset Saya",
  liabilitas: "Liabilitas",
  asuransi: "Asuransi",
  ai: "AI Advisor",
  kalkulator: "Kalkulator",
  akun: "Akun",
  splitbill: "Split Bill",
  rekonsiliasi: "Rekonsiliasi Bank",
  warisan: "Warisan",
  donation: "Donasi & Zakat",
  tax: "Tax Center",
  quickinput: "Quick Input",
  masterdata: "Setup Master Data",
};

export type MobileNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export const MOBILE_NAV: MobileNavItem[] = [
  { id: "beranda", label: "Beranda", href: "/beranda", icon: Home },
  {
    id: "transaksi",
    label: "Transaksi",
    href: "/transaksi",
    icon: ArrowUpDown,
  },
  { id: "laporan", label: "Laporan", href: "/laporan", icon: LineChart },
  { id: "akun", label: "Akun", href: "/akun", icon: User },
];
