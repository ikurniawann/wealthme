"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  PieChart,
  ArrowUpDown,
  ClipboardList,
  Target,
  Wallet,
  Landmark,
  Receipt,
  Bot,
  Calculator,
  Zap,
  BookOpen,
  Database,
  Plus,
  Search,
  GitCompare,
  LineChart,
  FileText,
  Users,
  CheckCheck,
  HeartHandshake,
  Scroll,
  KeyRound,
  EyeOff,
  ShieldCheck,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { SectionCard, IconChip, Rise } from "@/components/wm";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useLocale } from "@/hooks/use-locale";

// EPIC-025 N3 prototype structural port (docs/prototype/pages/panduan.html)
// — structural data only (icon, chip color class, href, stable id); every
// title/subtitle/desc string resolves from `t.panduan.features` /
// `t.panduan.groups` at render time, mirroring the split `lib/nav.ts`
// established (Task A1). Replaces the old 9-journey layout with the
// prototype's 6-group layout: `t.panduan.journeys`/`t.panduan.features`'
// original 24 entries stay in the dictionary (never removed/renamed), just
// no longer referenced by this page for grouping — the page now reads
// `t.panduan.groups` and the 5 new `features` entries the prototype's
// "Keluarga & Peran"/"Keamanan" groups needed (akun, persetujuan,
// passwordLogin, privateCategories, apiKeyAi).
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
  | "rekonsiliasi"
  | "splitbill"
  | "anggaran"
  | "tujuan"
  | "kalkulator"
  | "laporan"
  | "tax"
  | "mastercoa"
  | "ai"
  | "akun"
  | "persetujuan"
  | "donation"
  | "warisan"
  | "passwordLogin"
  | "privateCategories"
  | "apiKeyAi";

type GroupId =
  | "memulai"
  | "transaksi"
  | "anggaran"
  | "laporan"
  | "keluarga"
  | "keamanan";

type FeatureMeta = {
  icon: LucideIcon;
  chip: string;
  href?: string;
};

const FEATURES: Record<FeatureId, FeatureMeta> = {
  beranda: { icon: Home, chip: "bg-blue-100 text-blue-600", href: "/beranda" },
  ringkasan: {
    icon: PieChart,
    chip: "bg-violet-100 text-violet-600",
    href: "/ringkasan",
  },
  rekening: {
    icon: Landmark,
    chip: "bg-blue-100 text-blue-600",
    href: "/rekening",
  },
  dana: { icon: Wallet, chip: "bg-green-100 text-green-600", href: "/dana" },
  masterdata: {
    icon: Database,
    chip: "bg-gray-100 text-gray-600",
    href: "/masterdata",
  },
  addTransactionButton: {
    icon: Plus,
    chip: "bg-indigo-100 text-indigo-600",
  },
  transaksi: {
    icon: ArrowUpDown,
    chip: "bg-indigo-100 text-indigo-600",
    href: "/transaksi",
  },
  quickinput: {
    icon: Zap,
    chip: "bg-amber-100 text-amber-600",
    href: "/quickinput",
  },
  search: { icon: Search, chip: "bg-slate-100 text-slate-600" },
  rekonsiliasi: {
    icon: GitCompare,
    chip: "bg-sky-100 text-sky-600",
    href: "/rekonsiliasi",
  },
  splitbill: {
    icon: Receipt,
    chip: "bg-amber-100 text-amber-600",
    href: "/splitbill",
  },
  anggaran: {
    icon: ClipboardList,
    chip: "bg-indigo-100 text-indigo-600",
    href: "/anggaran",
  },
  tujuan: {
    icon: Target,
    chip: "bg-cyan-100 text-cyan-600",
    href: "/tujuan",
  },
  kalkulator: {
    icon: Calculator,
    chip: "bg-emerald-100 text-emerald-600",
    href: "/kalkulator",
  },
  laporan: {
    icon: LineChart,
    chip: "bg-indigo-100 text-indigo-600",
    href: "/laporan",
  },
  tax: {
    icon: FileText,
    chip: "bg-emerald-100 text-emerald-600",
    href: "/tax",
  },
  mastercoa: {
    icon: BookOpen,
    chip: "bg-blue-100 text-blue-600",
    href: "/mastercoa",
  },
  ai: { icon: Bot, chip: "bg-slate-100 text-slate-600", href: "/ai" },
  akun: { icon: Users, chip: "bg-blue-100 text-blue-600", href: "/akun" },
  persetujuan: {
    icon: CheckCheck,
    chip: "bg-amber-100 text-amber-600",
    href: "/persetujuan",
  },
  donation: {
    icon: HeartHandshake,
    chip: "bg-green-100 text-green-600",
    href: "/donation",
  },
  warisan: {
    icon: Scroll,
    chip: "bg-violet-100 text-violet-600",
    href: "/warisan",
  },
  passwordLogin: {
    icon: KeyRound,
    chip: "bg-blue-100 text-blue-600",
    href: "/akun",
  },
  privateCategories: {
    icon: EyeOff,
    chip: "bg-violet-100 text-violet-600",
    href: "/masterdata",
  },
  apiKeyAi: {
    icon: ShieldCheck,
    chip: "bg-slate-100 text-slate-600",
    href: "/ai",
  },
};

const GROUPS: { id: GroupId; items: FeatureId[] }[] = [
  {
    id: "memulai",
    items: ["beranda", "ringkasan", "rekening", "dana", "masterdata"],
  },
  {
    id: "transaksi",
    items: [
      "addTransactionButton",
      "transaksi",
      "quickinput",
      "search",
      "rekonsiliasi",
      "splitbill",
    ],
  },
  { id: "anggaran", items: ["anggaran", "tujuan", "kalkulator"] },
  { id: "laporan", items: ["laporan", "tax", "mastercoa", "ai"] },
  { id: "keluarga", items: ["akun", "persetujuan", "donation", "warisan"] },
  {
    id: "keamanan",
    items: ["passwordLogin", "privateCategories", "apiKeyAi"],
  },
];

const AREA_IDS: GroupId[] = GROUPS.map((g) => g.id);
const TOTAL_TOPICS = GROUPS.reduce((sum, g) => sum + g.items.length, 0);

// FAQ entries with a link resolve their href here (structural, not
// translation copy) — mirrors the FEATURES href split above.
const FAQ_LINK_HREFS = {
  pdfRejected: "/rekonsiliasi",
  addOwnReferences: "/masterdata",
  mortgageNotFullExpense: "/mastercoa",
  aiNotAnswering: "/ai",
  changeMemberRole: "/akun",
  dataExportOnLeave: "/laporan",
} as const;

const FAQ_ORDER = [
  "pdfRejected",
  "addOwnReferences",
  "mortgageNotFullExpense",
  "aiNotAnswering",
  "whoCanSeeTransactions",
  "changeMemberRole",
  "dataExportOnLeave",
] as const;

function TopicCard({
  feature,
  title,
  desc,
  onNavigate,
}: {
  feature: FeatureMeta;
  title: string;
  desc: string;
  onNavigate: (href: string) => void;
}) {
  const Icon = feature.icon;
  const content = (
    <>
      <IconChip icon={Icon} className={feature.chip} rounded="rounded-[10px]" />
      <div className="mt-2.5 text-[13px] font-bold">{title}</div>
      <div className="mt-[3px] text-[12px] leading-relaxed text-muted-foreground">
        {desc}
      </div>
    </>
  );

  if (feature.href) {
    return (
      <button
        type="button"
        onClick={() => onNavigate(feature.href as string)}
        className="block cursor-pointer rounded-xl border bg-background p-3.5 text-left transition-colors hover:border-primary hover:bg-card"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="block rounded-xl border bg-background p-3.5 text-left">
      {content}
    </div>
  );
}

export default function PanduanPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<"all" | GroupId>("all");

  const q = query.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return GROUPS.filter((g) => area === "all" || g.id === area)
      .map((g) => {
        const items = g.items.filter((id) => {
          if (!q) return true;
          const text = t.panduan.features[id];
          return `${text.title} ${text.desc}`.toLowerCase().includes(q);
        });
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0);
  }, [q, area, t]);

  const shownCount = visibleGroups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="space-y-4">
      <section aria-labelledby="panduan-heading" className="mb-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1
              id="panduan-heading"
              className="text-[17px] font-extrabold tracking-tight"
            >
              {t.panduan.pageTitle}
            </h1>
          </div>
          <a
            href="#panduan-bantuan"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <LifeBuoy className="size-3.5" /> {t.panduan.contactHeaderButton}
          </a>
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

        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={area === "all"}
            onClick={() => setArea("all")}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              area === "all"
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {t.panduan.areaLabels.all}
          </button>
          {AREA_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={area === id}
              onClick={() => setArea(id)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                area === id
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {t.panduan.areaLabels[id]}
            </button>
          ))}
        </div>

        <div className="mt-2.5 text-[12px] text-muted-foreground">
          {shownCount > 0 ? (
            <>
              {t.panduan.searchResultPrefix}
              {shownCount}
              {t.panduan.searchResultMid}
              {TOTAL_TOPICS}
              {t.panduan.searchResultSuffix}
            </>
          ) : (
            t.panduan.searchNoResultsFiltered
          )}
        </div>
      </SectionCard>

      {visibleGroups.map((group, gi) => {
        const groupText = t.panduan.groups[group.id];
        return (
          <Rise key={group.id} index={gi}>
            <SectionCard
              title={groupText.title}
              action={
                <span className="text-[12px] text-muted-foreground">
                  {groupText.tagline}
                </span>
              }
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.items.map((id) => {
                  const text = t.panduan.features[id];
                  return (
                    <TopicCard
                      key={id}
                      feature={FEATURES[id]}
                      title={text.title}
                      desc={text.desc}
                      onNavigate={(href) => router.push(href)}
                    />
                  );
                })}
              </div>
            </SectionCard>
          </Rise>
        );
      })}

      {/* FAQ — EPIC-025 N3 prototype structural port. Static documentation
          copy ported verbatim from docs/prototype/pages/panduan.html. */}
      <SectionCard title={t.panduan.faqSectionTitle}>
        <Accordion>
          {FAQ_ORDER.map((key) => {
            const item = t.panduan.faq[key];
            const href =
              key in FAQ_LINK_HREFS
                ? FAQ_LINK_HREFS[key as keyof typeof FAQ_LINK_HREFS]
                : undefined;
            return (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="text-[13px] font-semibold text-foreground">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-[12.5px] leading-relaxed text-muted-foreground">
                  {item.before}
                  {"strong" in item && item.strong && (
                    <strong>{item.strong}</strong>
                  )}
                  {"linkLabel" in item && item.linkLabel && href && (
                    <button
                      type="button"
                      onClick={() => router.push(href)}
                      className="font-semibold text-primary hover:underline"
                    >
                      {item.linkLabel}
                    </button>
                  )}
                  {item.after}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </SectionCard>

      {/* Contact support — EPIC-025 N3. Reuses the real support channels
          already shipped on `/akun` (t.akun.hubungi / SUPPORT_EMAIL etc. in
          app/(app)/akun/page.tsx), not the prototype's placeholder contact
          details, since publishing a different "real-looking" support
          channel here would be dishonest. */}
      <SectionCard
        title={
          <h2 id="panduan-bantuan" className="scroll-mt-20">
            {t.panduan.contact.title}
          </h2>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <a
            href="mailto:support@wealthme.id?subject=Bantuan%20WealthMe"
            className="block rounded-xl border bg-background p-3.5 text-left transition-colors hover:border-primary hover:bg-card"
          >
            <IconChip
              icon={Mail}
              className="bg-blue-100 text-blue-600"
              rounded="rounded-[10px]"
            />
            <div className="mt-2.5 text-[13px] font-bold">
              {t.panduan.contact.emailTitle}
            </div>
            <div className="mt-[3px] font-mono text-[12px] text-muted-foreground">
              {t.panduan.contact.emailValue}
            </div>
            <div className="text-[12px] leading-relaxed text-muted-foreground">
              {t.panduan.contact.emailDesc}
            </div>
          </a>
          <a
            href="https://wa.me/6281123456789"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border bg-background p-3.5 text-left transition-colors hover:border-primary hover:bg-card"
          >
            <IconChip
              icon={MessageCircle}
              className="bg-green-100 text-green-600"
              rounded="rounded-[10px]"
            />
            <div className="mt-2.5 text-[13px] font-bold">
              {t.panduan.contact.whatsappTitle}
            </div>
            <div className="mt-[3px] font-mono text-[12px] text-muted-foreground">
              {t.panduan.contact.whatsappValue}
            </div>
            <div className="text-[12px] leading-relaxed text-muted-foreground">
              {t.panduan.contact.whatsappDesc}
            </div>
          </a>
          <a
            href="tel:080012345678"
            className="block rounded-xl border bg-background p-3.5 text-left transition-colors hover:border-primary hover:bg-card"
          >
            <IconChip
              icon={Phone}
              className="bg-amber-100 text-amber-600"
              rounded="rounded-[10px]"
            />
            <div className="mt-2.5 text-[13px] font-bold">
              {t.panduan.contact.phoneTitle}
            </div>
            <div className="mt-[3px] font-mono text-[12px] text-muted-foreground">
              {t.panduan.contact.phoneValue}
            </div>
            <div className="text-[12px] leading-relaxed text-muted-foreground">
              {t.panduan.contact.phoneDesc}
            </div>
          </a>
        </div>
      </SectionCard>
    </div>
  );
}
