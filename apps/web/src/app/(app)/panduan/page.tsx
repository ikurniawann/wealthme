"use client";

import { useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");

  // Prototype structural port (EPIC-025 N3-B2) — the prototype's search +
  // area-filter bar runs for real against static topic copy; ported the
  // same way, filtering the existing `t.panduan.journeys`/`features`
  // dictionary (no new content invented). The prototype's own FAQ +
  // "Hubungi Kami" contact section is not ported: J1 explicitly cuts the
  // support-ticket dialog, and the FAQ/contact-links content has no
  // existing i18n entries to port faithfully without inventing new copy.
  const q = query.trim().toLowerCase();
  const visibleJourneys = useMemo(() => {
    if (!q) return JOURNEYS;
    return JOURNEYS.map((journey) => {
      const journeyText = t.panduan.journeys[journey.id];
      const items = journey.items.filter((f) => {
        const featureText = t.panduan.features[f.id];
        const haystack =
          `${journeyText.title} ${featureText.title} ${featureText.desc}`.toLowerCase();
        return haystack.includes(q);
      });
      return { ...journey, items };
    }).filter((journey) => journey.items.length > 0);
  }, [q, t]);

  return (
    <div className="space-y-4">
      <section aria-labelledby="panduan-heading" className="mb-1">
        <h1
          id="panduan-heading"
          className="text-[17px] font-extrabold tracking-tight"
        >
          {t.panduan.pageTitle}
        </h1>
        <div className="mt-1 text-[12.5px] text-muted-foreground">
          {t.panduan.pageSubtitle}
        </div>
      </section>

      <SectionCard>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold">
            {t.panduan.searchLabel}
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.panduan.searchPlaceholder}
            aria-label={t.panduan.searchLabel}
            className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
          />
        </label>
      </SectionCard>

      {visibleJourneys.length === 0 && (
        <SectionCard>
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t.panduan.noResults}
          </p>
        </SectionCard>
      )}

      {visibleJourneys.map((journey, ji) => {
        const journeyText = t.panduan.journeys[journey.id];
        return (
          <Rise key={journey.id} index={ji}>
            <SectionCard title={journeyText.title}>
              <div className="-mt-2 mb-3 text-[12px] text-muted-foreground">
                {journeyText.subtitle}
              </div>
              <div className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-3">
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
