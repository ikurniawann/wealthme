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
  Mail,
  MessageCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { BentoCard, BentoGrid, Rise, Segmented } from "@/components/wm";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useLocale } from "@/hooks/use-locale";

import "./panduan.css";

// EPIC-025 N3 prototype structural port (docs/prototype/pages/panduan.html)
// — structural data only (icon, href, stable id); every
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
  href?: string;
};

const FEATURES: Record<FeatureId, FeatureMeta> = {
  beranda: { icon: Home, href: "/beranda" },
  ringkasan: {
    icon: PieChart,
    href: "/ringkasan",
  },
  rekening: {
    icon: Landmark,
    href: "/rekening",
  },
  dana: { icon: Wallet, href: "/dana" },
  masterdata: {
    icon: Database,
    href: "/masterdata",
  },
  addTransactionButton: {
    icon: Plus,
  },
  transaksi: {
    icon: ArrowUpDown,
    href: "/transaksi",
  },
  quickinput: {
    icon: Zap,
    href: "/quickinput",
  },
  search: { icon: Search },
  rekonsiliasi: {
    icon: GitCompare,
    href: "/rekonsiliasi",
  },
  splitbill: {
    icon: Receipt,
    href: "/splitbill",
  },
  anggaran: {
    icon: ClipboardList,
    href: "/anggaran",
  },
  tujuan: {
    icon: Target,
    href: "/tujuan",
  },
  kalkulator: {
    icon: Calculator,
    href: "/kalkulator",
  },
  laporan: {
    icon: LineChart,
    href: "/laporan",
  },
  tax: {
    icon: FileText,
    href: "/tax",
  },
  mastercoa: {
    icon: BookOpen,
    href: "/mastercoa",
  },
  ai: { icon: Bot, href: "/ai" },
  akun: { icon: Users, href: "/akun" },
  persetujuan: {
    icon: CheckCheck,
    href: "/persetujuan",
  },
  donation: {
    icon: HeartHandshake,
    href: "/donation",
  },
  warisan: {
    icon: Scroll,
    href: "/warisan",
  },
  passwordLogin: {
    icon: KeyRound,
    href: "/akun",
  },
  privateCategories: {
    icon: EyeOff,
    href: "/masterdata",
  },
  apiKeyAi: {
    icon: ShieldCheck,
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
  featured,
  onNavigate,
}: {
  feature: FeatureMeta;
  title: string;
  desc: string;
  featured?: boolean;
  onNavigate: (href: string) => void;
}) {
  const Icon = feature.icon;
  const content = (
    <>
      <span className="pd-ic" aria-hidden="true">
        <Icon size={featured ? 22 : 18} />
      </span>
      <span>
        <b>{title}</b>
        <p>{desc}</p>
      </span>
    </>
  );

  if (feature.href) {
    return (
      <button
        type="button"
        onClick={() => onNavigate(feature.href as string)}
        className={`pd-item pd-link${featured ? " pd-feat" : ""}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`pd-item${featured ? " pd-feat" : ""}`}>{content}</div>
  );
}

function ContactTile({
  href,
  external,
  icon: Icon,
  title,
  value,
  desc,
}: {
  href: string;
  external?: boolean;
  icon: LucideIcon;
  title: string;
  value: string;
  desc: string;
}) {
  return (
    <a
      className="pd-tile"
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className="pd-tile-tt">
        <span className="pd-ic" aria-hidden="true">
          <Icon size={16} />
        </span>
        {title}
      </span>
      <span className="pd-tile-v">{value}</span>
      <small>{desc}</small>
    </a>
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
  const v2 = t.panduan.v2;

  return (
    <div className="space-y-4" data-page="panduan">
      <BentoGrid className="pd-grid">
        <h1 className="sr-only">{t.panduan.pageTitle}</h1>
        <section className="wm-card wm-dark pd-hero">
          <div className="pd-top">
            <div>
              <p className="wm-big pd-title">{v2.heroTitle}</p>
              <p className="wm-cap">
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
              </p>
            </div>
            <label className="pd-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.panduan.searchPlaceholder}
                aria-label={t.panduan.searchLabel}
              />
            </label>
          </div>
          <Segmented
            className="pd-tabs"
            label={v2.tabsLabel}
            value={area}
            onChange={setArea}
            options={[
              { value: "all" as const, label: t.panduan.areaLabels.all },
              ...AREA_IDS.map((id) => ({
                value: id,
                label: t.panduan.areaLabels[id],
              })),
            ]}
          />
        </section>

        <BentoCard className="pd-list">
          <div className="pd-groups">
            {visibleGroups.map((group, gi) => {
              const groupText = t.panduan.groups[group.id];
              return (
                <Rise key={group.id} index={gi}>
                  <div className="pd-group">
                    <div className="pd-gh">
                      <h2>{groupText.title}</h2>
                      <p className="pd-tag">{groupText.tagline}</p>
                    </div>
                    <div className="pd-items">
                      {group.items.map((id, ii) => {
                        const text = t.panduan.features[id];
                        return (
                          <TopicCard
                            key={id}
                            feature={FEATURES[id]}
                            title={text.title}
                            desc={text.desc}
                            featured={ii === 0}
                            onNavigate={(href) => router.push(href)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </Rise>
              );
            })}
            {visibleGroups.length === 0 && (
              <p className="pd-empty">
                <b>{v2.emptyTitle}</b>
                {t.panduan.searchNoResultsFiltered}
              </p>
            )}
          </div>
        </BentoCard>

        <BentoCard className="pd-faq" title={t.panduan.faqSectionTitle}>
          <Accordion>
            {FAQ_ORDER.map((key) => {
              const item = t.panduan.faq[key];
              const href =
                key in FAQ_LINK_HREFS
                  ? FAQ_LINK_HREFS[key as keyof typeof FAQ_LINK_HREFS]
                  : undefined;
              return (
                <AccordionItem key={key} value={key}>
                  <AccordionTrigger className="text-[14px] font-semibold text-foreground">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pd-answer">
                    {item.before}
                    {"strong" in item && item.strong && (
                      <strong>{item.strong}</strong>
                    )}
                    {"linkLabel" in item && item.linkLabel && href && (
                      <button
                        type="button"
                        onClick={() => router.push(href)}
                        className="pd-link-inline"
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
        </BentoCard>

        <BentoCard
          className="pd-contact"
          title={<span id="panduan-bantuan">{t.panduan.contact.title}</span>}
          caption={v2.contactCaption}
        >
          <div className="pd-tiles">
            <ContactTile
              href="mailto:support@wealthme.id?subject=Bantuan%20WealthMe"
              icon={Mail}
              title={t.panduan.contact.emailTitle}
              value={t.panduan.contact.emailValue}
              desc={t.panduan.contact.emailDesc}
            />
            <ContactTile
              href="https://wa.me/6281123456789"
              external
              icon={MessageCircle}
              title={t.panduan.contact.whatsappTitle}
              value={t.panduan.contact.whatsappValue}
              desc={t.panduan.contact.whatsappDesc}
            />
            <ContactTile
              href="tel:080012345678"
              icon={Phone}
              title={t.panduan.contact.phoneTitle}
              value={t.panduan.contact.phoneValue}
              desc={t.panduan.contact.phoneDesc}
            />
          </div>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
