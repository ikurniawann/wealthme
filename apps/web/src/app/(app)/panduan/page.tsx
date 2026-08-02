"use client";

import { useRouter } from "next/navigation";
import {
  Home,
  PieChart,
  ArrowUpDown,
  ClipboardList,
  LineChart,
  Target,
  Wallet,
  Landmark,
  BarChart3,
  Briefcase,
  ReceiptText,
  ShieldCheck,
  Scroll,
  HeartHandshake,
  FileText,
  Receipt,
  GitCompare,
  Bot,
  Calculator,
  Zap,
  BookOpen,
  Database,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { SectionCard, CardLink, IconChip, Rise } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";

// Structural data only (icon, chip color class, href, stable id) — every
// title/subtitle/desc string resolves from `t.panduan.journeys` /
// `t.panduan.features` at render time, keyed by these ids (EPIC-018 Task A2,
// mirroring the pattern `lib/nav.ts` established in Task A1).
type FeatureId =
  | "beranda"
  | "ringkasan"
  | "rekening"
  | "dana"
  | "masterdata"
  | "addTransactionButton"
  | "transaksi"
  | "quickinput"
  | "search"
  | "anggaran"
  | "tujuan"
  | "investasi"
  | "aset"
  | "liabilitas"
  | "asuransi"
  | "laporan"
  | "kalkulator"
  | "tax"
  | "rekonsiliasi"
  | "donation"
  | "splitbill"
  | "warisan"
  | "mastercoa"
  | "ai";

type JourneyId =
  | "start"
  | "setupMoney"
  | "trackActivity"
  | "plan"
  | "growProtect"
  | "reportsTools"
  | "familySharing"
  | "advancedConfig"
  | "aiAssistant";

type Feature = {
  id: FeatureId;
  icon: LucideIcon;
  chip: string;
  href?: string;
};

type Journey = {
  id: JourneyId;
  items: Feature[];
};

const JOURNEYS: Journey[] = [
  {
    id: "start",
    items: [
      {
        id: "beranda",
        icon: Home,
        chip: "bg-blue-100 text-blue-600",
        href: "/beranda",
      },
      {
        id: "ringkasan",
        icon: PieChart,
        chip: "bg-violet-100 text-violet-600",
        href: "/ringkasan",
      },
    ],
  },
  {
    id: "setupMoney",
    items: [
      {
        id: "rekening",
        icon: Landmark,
        chip: "bg-blue-100 text-blue-600",
        href: "/rekening",
      },
      {
        id: "dana",
        icon: Wallet,
        chip: "bg-green-100 text-green-600",
        href: "/dana",
      },
      {
        id: "masterdata",
        icon: Database,
        chip: "bg-gray-100 text-gray-600",
        href: "/masterdata",
      },
    ],
  },
  {
    id: "trackActivity",
    items: [
      {
        id: "addTransactionButton",
        icon: Plus,
        chip: "bg-indigo-100 text-indigo-600",
      },
      {
        id: "transaksi",
        icon: ArrowUpDown,
        chip: "bg-indigo-100 text-indigo-600",
        href: "/transaksi",
      },
      {
        id: "quickinput",
        icon: Zap,
        chip: "bg-amber-100 text-amber-600",
        href: "/quickinput",
      },
      {
        id: "search",
        icon: Search,
        chip: "bg-slate-100 text-slate-600",
      },
    ],
  },
  {
    id: "plan",
    items: [
      {
        id: "anggaran",
        icon: ClipboardList,
        chip: "bg-indigo-100 text-indigo-600",
        href: "/anggaran",
      },
      {
        id: "tujuan",
        icon: Target,
        chip: "bg-cyan-100 text-cyan-600",
        href: "/tujuan",
      },
    ],
  },
  {
    id: "growProtect",
    items: [
      {
        id: "investasi",
        icon: BarChart3,
        chip: "bg-violet-100 text-violet-600",
        href: "/investasi",
      },
      {
        id: "aset",
        icon: Briefcase,
        chip: "bg-yellow-100 text-yellow-600",
        href: "/aset",
      },
      {
        id: "liabilitas",
        icon: ReceiptText,
        chip: "bg-red-100 text-red-600",
        href: "/liabilitas",
      },
      {
        id: "asuransi",
        icon: ShieldCheck,
        chip: "bg-purple-100 text-purple-600",
        href: "/asuransi",
      },
    ],
  },
  {
    id: "reportsTools",
    items: [
      {
        id: "laporan",
        icon: LineChart,
        chip: "bg-indigo-100 text-indigo-600",
        href: "/laporan",
      },
      {
        id: "kalkulator",
        icon: Calculator,
        chip: "bg-emerald-100 text-emerald-600",
        href: "/kalkulator",
      },
      {
        id: "tax",
        icon: FileText,
        chip: "bg-emerald-100 text-emerald-600",
        href: "/tax",
      },
      {
        id: "rekonsiliasi",
        icon: GitCompare,
        chip: "bg-sky-100 text-sky-600",
        href: "/rekonsiliasi",
      },
    ],
  },
  {
    id: "familySharing",
    items: [
      {
        id: "donation",
        icon: HeartHandshake,
        chip: "bg-green-100 text-green-600",
        href: "/donation",
      },
      {
        id: "splitbill",
        icon: Receipt,
        chip: "bg-amber-100 text-amber-600",
        href: "/splitbill",
      },
      {
        id: "warisan",
        icon: Scroll,
        chip: "bg-purple-100 text-purple-600",
        href: "/warisan",
      },
    ],
  },
  {
    id: "advancedConfig",
    items: [
      {
        id: "mastercoa",
        icon: BookOpen,
        chip: "bg-blue-100 text-blue-600",
        href: "/mastercoa",
      },
    ],
  },
  {
    id: "aiAssistant",
    items: [
      {
        id: "ai",
        icon: Bot,
        chip: "bg-slate-100 text-slate-600",
        href: "/ai",
      },
    ],
  },
];

export default function PanduanPage() {
  const router = useRouter();
  const { t } = useLocale();
  return (
    <div className="space-y-4">
      <div className="mb-1">
        <div className="text-[15px] font-bold">{t.panduan.pageTitle}</div>
        <div className="text-[12px] text-muted-foreground">
          {t.panduan.pageSubtitle}
        </div>
      </div>

      {JOURNEYS.map((journey, ji) => {
        const journeyText = t.panduan.journeys[journey.id];
        return (
          <Rise key={journey.id} index={ji}>
            <SectionCard title={journeyText.title}>
              <div className="-mt-2 mb-3 text-[12px] text-muted-foreground">
                {journeyText.subtitle}
              </div>
              <div className="space-y-1">
                {journey.items.map((f) => {
                  const featureText = t.panduan.features[f.id];
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 rounded-lg py-2.5 transition-colors hover:bg-accent/50"
                    >
                      <IconChip icon={f.icon} className={f.chip} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold">
                          {featureText.title}
                        </div>
                        <div className="text-[12px] leading-relaxed text-muted-foreground">
                          {featureText.desc}
                        </div>
                      </div>
                      {f.href && (
                        <CardLink
                          onClick={() => router.push(f.href as string)}
                          className="shrink-0 rounded-md border bg-card px-3 py-1.5 text-[11.5px] no-underline shadow-sm transition-colors hover:border-primary hover:no-underline"
                        >
                          {t.panduan.openLink}
                        </CardLink>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </Rise>
        );
      })}
    </div>
  );
}
