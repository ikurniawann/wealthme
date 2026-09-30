"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useShell } from "@/components/shell/shell-context";
import { useLocale } from "@/hooks/use-locale";
import { useApiError } from "@/hooks/use-api-error";
import { useMyAccess } from "@/hooks/use-my-access";
import { apiFetch } from "@/lib/api-client";
import { parseRupiah } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { buildGoalBody } from "@/lib/goals-utils";
import {
  BentoCard,
  BentoGrid,
  BentoHero,
  BentoTile,
  BentoTiles,
  GhostButton,
  HeroKpi,
  MiniList,
  MiniRow,
  SeeAll,
  TipsCard,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { categoryIcon } from "@/components/shell/tx-pickers";
import "./quickinput.css";
import { queryKeys } from "@/lib/query-keys";
import {
  isMasterOrCoMaster,
  type TransactionListResponse,
} from "@wealthme/contracts";
import {
  ArrowUpDown,
  BarChart3,
  Briefcase,
  ClipboardList,
  HeartHandshake,
  Landmark,
  Receipt,
  ReceiptText,
  Scroll,
  ShieldCheck,
  Target,
  Plus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  CrudModal,
  withCrudFx,
  type CrudEntity,
  type CrudModalState,
} from "@/components/crud";

/** Structural id into `t.quickinput.cards` — independent of the `CrudEntity`
 * values below, which must stay untranslated to match the shared CrudModal's
 * hardcoded (Indonesian) field config in `components/crud/crud-config.ts`. */
type QuickCardId =
  | "transaksi"
  | "investasi"
  | "rekening"
  | "ewallet"
  | "aset"
  | "liabilitas"
  | "asuransi"
  | "tujuan"
  | "anggaran"
  | "warisan"
  | "donasi"
  | "splitbill";

type QuickCard = {
  id: QuickCardId;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
} & (
  | { action: "crud"; entity: CrudEntity }
  | { action: "navigate"; href: string }
  | { action: "toast"; message: string }
  | { action: "txn" }
);

const QUICK_CARDS: QuickCard[] = [
  {
    id: "transaksi",
    icon: ArrowUpDown,
    iconBg: "#EEF2FF",
    iconColor: "var(--primary)",
    action: "txn",
  },
  // EPIC-024 C4 (Evidence #5) — the generic CrudModal's "investasi" field set
  // (nama/ticker/jenis/modal/nilai, no quantity) cannot express the real
  // create-investment contract: it used to hardcode `quantity: "1"` and fold
  // "Nilai Sekarang" into `costBasisPerUnit`, silently recording a
  // whole-portfolio number as a per-unit price. Rather than hand-roll a
  // second type-aware investment form here, route straight to the real one
  // (`/investasi`'s AddInvestmentModal — lot/lembar, koin, deposito, tanggal
  // beli all live there and only there).
  {
    id: "investasi",
    icon: BarChart3,
    iconBg: "#DCFCE7",
    iconColor: "var(--success)",
    action: "navigate",
    href: "/investasi",
  },
  {
    id: "rekening",
    icon: Landmark,
    iconBg: "#DBEAFE",
    iconColor: "#1D4ED8",
    action: "crud",
    entity: "rekening",
  },
  {
    id: "ewallet",
    icon: Wallet,
    iconBg: "#DCFCE7",
    iconColor: "var(--success)",
    action: "crud",
    entity: "ewallet",
  },
  {
    id: "aset",
    icon: Briefcase,
    iconBg: "#FEF9C3",
    iconColor: "#A16207",
    action: "crud",
    entity: "aset",
  },
  {
    id: "liabilitas",
    icon: ReceiptText,
    iconBg: "#FEE2E2",
    iconColor: "var(--destructive)",
    action: "crud",
    entity: "liabilitas",
  },
  {
    id: "asuransi",
    icon: ShieldCheck,
    iconBg: "#EDE9FE",
    iconColor: "var(--brand-purple)",
    action: "crud",
    entity: "asuransi",
  },
  {
    id: "tujuan",
    icon: Target,
    iconBg: "#CFFAFE",
    iconColor: "#0E7490",
    action: "crud",
    entity: "tujuan",
  },
  {
    id: "anggaran",
    icon: ClipboardList,
    iconBg: "#EEF2FF",
    iconColor: "var(--primary)",
    action: "navigate",
    href: "/anggaran",
  },
  {
    id: "warisan",
    icon: Scroll,
    iconBg: "#EDE9FE",
    iconColor: "var(--brand-purple)",
    action: "navigate",
    href: "/warisan",
  },
  {
    id: "donasi",
    icon: HeartHandshake,
    iconBg: "#DCFCE7",
    iconColor: "var(--success)",
    action: "navigate",
    href: "/donation",
  },
  {
    id: "splitbill",
    icon: Receipt,
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    action: "navigate",
    href: "/splitbill",
  },
];

// CrudModal form values → real API request per entity. Amount values arrive
// dot-formatted ("1.500.000") — parseRupiah normalizes them.
const ASSET_TYPE: Record<string, string> = {
  Properti: "properti",
  Kendaraan: "kendaraan",
  Elektronik: "elektronik",
  Perhiasan: "perhiasan",
  Emas: "emas",
  Lainnya: "lainnya",
};
const LIABILITY_TYPE: Record<string, string> = {
  "Kartu Kredit": "kartu_kredit",
  KTA: "pinjaman_pribadi",
  KPR: "kpr",
  "Cicilan Kendaraan": "kendaraan",
  "Pinjaman Lain": "lainnya",
};
const INSURANCE_TYPE: Record<string, string> = {
  Jiwa: "jiwa",
  Kesehatan: "kesehatan",
  Kendaraan: "kendaraan",
  Properti: "properti",
  // EPIC-021 Group D (#13) — "Pendidikan" used to be coerced into "lainnya"
  // (data-corruption twist called out in the epic audit); now persists as its
  // own InsuranceType value.
  Pendidikan: "pendidikan",
};

function buildRequest(
  entity: CrudEntity,
  v: Record<string, string>,
): { path: string; body: unknown; queryKey: string } | null {
  switch (entity) {
    case "rekening":
      return {
        path: "accounts",
        queryKey: "accounts",
        body: withCrudFx(
          {
            type: "bank",
            name: v.nama || `${v.bank ?? "Bank"} ${v.jenis ?? ""}`.trim(),
            institution: v.bank,
            maskedNumber: v.norek || undefined,
            balance: parseRupiah(v.saldo ?? "0"),
          },
          v,
          { saldo: "balance" },
        ),
      };
    case "ewallet":
      return {
        path: "accounts",
        queryKey: "accounts",
        body: withCrudFx(
          {
            type: "ewallet",
            name: v.nama,
            institution: v.nama,
            maskedNumber: v.phone || undefined,
            balance: parseRupiah(v.saldo ?? "0"),
          },
          v,
          { saldo: "balance" },
        ),
      };
    // "investasi" intentionally has no case here — EPIC-024 C4 routes that
    // quick-input card straight to `/investasi`'s real, type-aware form
    // instead of building a request from the generic CRUD engine's fields
    // (see the QUICK_CARDS entry above).
    case "aset":
      return {
        path: "assets",
        queryKey: "assets",
        body: withCrudFx(
          {
            name: v.nama,
            type: ASSET_TYPE[v.kategori ?? ""] ?? "lainnya",
            currentValue: String(parseRupiah(v.nilai ?? "0")),
            notes: v.dokumen || undefined,
          },
          v,
          { nilai: "currentValue" },
        ),
      };
    case "liabilitas": {
      const total = String(parseRupiah(v.total ?? "0"));
      return {
        path: "liabilities",
        queryKey: "liabilities",
        body: withCrudFx(
          {
            name: v.nama,
            type: LIABILITY_TYPE[v.jenis ?? ""] ?? "lainnya",
            totalDebt: total,
            remainingBalance: total,
            minimumPayment: v.cicilan
              ? String(parseRupiah(v.cicilan))
              : undefined,
          },
          v,
          {
            total: ["totalDebt", "remainingBalance"],
            cicilan: "minimumPayment",
          },
        ),
      };
    }
    case "asuransi":
      return {
        path: "insurances",
        queryKey: "insurances",
        body: withCrudFx(
          {
            name: v.nama,
            type: INSURANCE_TYPE[v.jenis ?? ""] ?? "lainnya",
            premiumAmount: String(parseRupiah(v.premi ?? "0")),
            coverageAmount: v.pertanggungan
              ? String(parseRupiah(v.pertanggungan))
              : undefined,
            renewalDate: v.jatuhtempo || undefined,
          },
          v,
          { premi: "premiumAmount", pertanggungan: "coverageAmount" },
        ),
      };
    case "tujuan":
      // Fix pre-existing double encoding — `buildGoalBody` already returns
      // a JSON string, and the single `handleSubmit` JSON.stringify below
      // re-encodes it; parse back to an object so every branch here returns
      // one, and wrap it so a foreign amount also gets `fxInputs`.
      return {
        path: "goals",
        queryKey: "goals",
        body: withCrudFx(
          JSON.parse(buildGoalBody(v)) as Record<string, unknown>,
          v,
          {
            target: "targetAmount",
            terkumpul: "currentAmount",
            autodebit: "autoDebitAmount",
          },
        ),
      };
    default:
      return null;
  }
}

export default function QuickInputPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTxnOpen } = useShell();
  const { t, locale } = useLocale();
  const money = useMoney();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const { handleError } = useApiError();
  const [crud, setCrud] = useState<CrudModalState | null>(null);
  // "menu quick input harus di master dan co-master account saja" — the page
  // itself is gated (not just the nav item): a non-Master/Co-Master must see
  // the app's existing no-access notice, not the form, and must trigger no
  // data fetch. Mirrors `/persetujuan`'s `isOwner`/`roleLoading` pattern.
  const { access, isLoading: accessLoading } = useMyAccess();
  const isAllowed = !!access && isMasterOrCoMaster(access.role);

  // Prototype structural port (EPIC-025 N3-B4) — the prototype's "Entri
  // Terakhir" card is real, read-only data already exposed by the
  // transactions endpoint the /transaksi page uses (limit param), not a
  // new backend call — a lightweight recent-activity readout.
  // `/transactions` returns the paginated ENVELOPE `{ data, meta, summary }`
  // (TransactionListResponse), not a bare array. This query used to declare
  // `TransactionDto[]`, so `recentTransactions` was the envelope object at
  // runtime while TypeScript believed it was an array — `.map()` on it threw
  // and took the whole page down to the error boundary ("This page couldn't
  // load"). Typed correctly and read through `.data` below.
  const { data: recentResponse } = useQuery<TransactionListResponse>({
    queryKey: [...queryKeys.transactions.all(familyGroupId ?? ""), "recent"],
    queryFn: () =>
      apiFetch<TransactionListResponse>(
        `/family-groups/${familyGroupId}/transactions?limit=5`,
        { token },
      ),
    enabled: Boolean(familyGroupId) && Boolean(token) && isAllowed,
  });
  const recentTransactions = recentResponse?.data;
  // Hero chart: the last 7 days of entries (a real per-day count).
  const [weekFrom] = useState(() =>
    new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10),
  );
  const { data: weekResponse } = useQuery<TransactionListResponse>({
    queryKey: [
      ...queryKeys.transactions.all(familyGroupId ?? ""),
      "quickinput-week",
      weekFrom,
    ],
    queryFn: () =>
      apiFetch<TransactionListResponse>(
        `/family-groups/${familyGroupId}/transactions?from=${weekFrom}&limit=100`,
        { token },
      ),
    enabled: Boolean(familyGroupId) && Boolean(token) && isAllowed,
  });

  const handleClick = (card: QuickCard) => {
    if (card.action === "crud") {
      setCrud({ entity: card.entity, mode: "add" });
    } else if (card.action === "navigate") {
      router.push(card.href);
    } else if (card.action === "txn") {
      setTxnOpen(true);
    } else {
      toast(card.message);
    }
  };

  async function handleSubmit(
    entity: CrudEntity,
    _mode: "add" | "edit",
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token) return;
    const req = buildRequest(entity, values);
    if (!req) return;
    try {
      await apiFetch(`/family-groups/${familyGroupId}/${req.path}`, {
        token,
        method: "POST",
        body: JSON.stringify(req.body),
      });
      await queryClient.invalidateQueries({
        queryKey: [req.queryKey, familyGroupId],
      });
      toast.success(t.quickinput.toastSaved);
    } catch (err) {
      // F1/F2 — surface the server's real message and rethrow so
      // CrudModal's `await onSubmit(...)` rejects and skips `onClose()`;
      // a failed save must not discard what the user entered.
      handleError(err);
      throw err;
    }
  }

  if (accessLoading) {
    return (
      <div className="py-10 text-center text-[12.5px] text-muted-foreground">
        …
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-[13px] text-muted-foreground">
        {t.quickinput.notAllowedNotice}
      </div>
    );
  }

  const v2 = t.quickinput.v2;
  const recent = recentTransactions ?? [];
  const week = weekResponse?.data ?? [];
  const now = new Date();
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = Array.from(
    { length: 7 },
    (_, index) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index),
  );
  const counts = days.map(
    (d) =>
      week.filter((tx) => dayKey(new Date(tx.occurredAt)) === dayKey(d)).length,
  );
  const lastAt = recent[0]?.createdAt;
  const lastLabel = lastAt
    ? new Date(lastAt).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
        day: "numeric",
        month: "short",
      })
    : v2.never;

  return (
    <BentoGrid className="qi-grid">
      <h1 className="sr-only">{t.quickinput.pageTitle}</h1>
      <BentoHero
        className="qi-hero"
        currency={null}
        value={String(QUICK_CARDS.length)}
        caption={v2.shortcuts}
        controls={
          <GhostButton lit onClick={() => setTxnOpen(true)}>
            <Plus aria-hidden="true" /> {v2.addTx}
          </GhostButton>
        }
        chart={
          <HatchedBarChart
            labels={days.map((d) =>
              d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
                weekday: "short",
              }),
            )}
            series={[
              { name: v2.countUnit, data: counts, color: "var(--wm-lime)" },
            ]}
            highlight={6}
            format={(n) => `${n} ${v2.countUnit}`}
            axis={(n) => String(Math.round(n))}
            wide
            ariaLabel={v2.chartAria}
          />
        }
        kpis={
          <>
            <HeroKpi label={v2.today} value={String(counts[6])} />
            <HeroKpi
              label={v2.week}
              value={String(weekResponse?.meta.total ?? week.length)}
            />
            <HeroKpi label={v2.last} value={lastLabel} />
          </>
        }
      />

      <BentoCard
        className="qi-recent"
        title={t.quickinput.recentEntriesTitle}
        caption={v2.recentCap}
      >
        {recent.length === 0 ? (
          <p className="wm-cap mt-4">{t.quickinput.emptyRecent}</p>
        ) : (
          <MiniList label={t.quickinput.recentEntriesTitle}>
            {recent.map((tx) => {
              const Icon = categoryIcon(tx.categoryName ?? "");
              const inflow = tx.type === "income";
              return (
                <MiniRow
                  key={tx.id}
                  icon={<Icon aria-hidden="true" />}
                  title={tx.description ?? tx.categoryName ?? "—"}
                  meta={tx.accountName ?? "—"}
                  amount={
                    <span className={inflow ? "wm-pos" : undefined}>
                      {tx.type === "transfer" ? "" : inflow ? "+" : "−"}
                      {money
                        .formatCompact(parseFloat(tx.amount))
                        .replace("Rp ", "")}
                    </span>
                  }
                  onClick={() => router.push("/transaksi")}
                />
              );
            })}
          </MiniList>
        )}
        <SeeAll href="/transaksi">{t.quickinput.viewAllLink}</SeeAll>
      </BentoCard>

      <BentoCard
        className="qi-shortcuts"
        title={v2.recordTitle}
        caption={v2.recordCap}
      >
        <BentoTiles className="qi-tiles">
          {QUICK_CARDS.map((card) => (
            <BentoTile
              key={card.id}
              onClick={() => handleClick(card)}
              icon={<card.icon aria-hidden="true" />}
              title={t.quickinput.cards[card.id].name}
              foot={t.quickinput.cards[card.id].desc}
            />
          ))}
        </BentoTiles>
      </BentoCard>

      <TipsCard
        className="qi-tip"
        title={v2.tipTitle}
        mosaic={[
          "",
          "b",
          "a",
          "",
          "b",
          "a",
          "b",
          "a",
          "a",
          "",
          "c",
          "a",
          "",
          "b",
          "a",
          "a",
          "b",
          "a",
        ]}
      >
        {v2.tipBody}
      </TipsCard>

      <CrudModal
        state={crud}
        onClose={() => setCrud(null)}
        onSubmit={handleSubmit}
      />
    </BentoGrid>
  );
}
