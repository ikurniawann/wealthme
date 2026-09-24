"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useShell } from "@/components/shell/shell-context";
import { useLocale } from "@/hooks/use-locale";
import { useApiError } from "@/hooks/use-api-error";
import { apiFetch } from "@/lib/api-client";
import { parseRupiah, formatRupiah } from "@/lib/format";
import { buildGoalBody } from "@/lib/goals-utils";
import { SectionCard, CardLink } from "@/components/wm";
import { queryKeys } from "@/lib/query-keys";
import type { TransactionListResponse } from "@wealthme/contracts";
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
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  CrudModal,
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
        body: {
          type: "bank",
          name: v.nama || `${v.bank ?? "Bank"} ${v.jenis ?? ""}`.trim(),
          institution: v.bank,
          maskedNumber: v.norek || undefined,
          balance: parseRupiah(v.saldo ?? "0"),
        },
      };
    case "ewallet":
      return {
        path: "accounts",
        queryKey: "accounts",
        body: {
          type: "ewallet",
          name: v.nama,
          institution: v.nama,
          maskedNumber: v.phone || undefined,
          balance: parseRupiah(v.saldo ?? "0"),
        },
      };
    // "investasi" intentionally has no case here — EPIC-024 C4 routes that
    // quick-input card straight to `/investasi`'s real, type-aware form
    // instead of building a request from the generic CRUD engine's fields
    // (see the QUICK_CARDS entry above).
    case "aset":
      return {
        path: "assets",
        queryKey: "assets",
        body: {
          name: v.nama,
          type: ASSET_TYPE[v.kategori ?? ""] ?? "lainnya",
          currentValue: String(parseRupiah(v.nilai ?? "0")),
          notes: v.dokumen || undefined,
        },
      };
    case "liabilitas": {
      const total = String(parseRupiah(v.total ?? "0"));
      return {
        path: "liabilities",
        queryKey: "liabilities",
        body: {
          name: v.nama,
          type: LIABILITY_TYPE[v.jenis ?? ""] ?? "lainnya",
          totalDebt: total,
          remainingBalance: total,
          minimumPayment: v.cicilan
            ? String(parseRupiah(v.cicilan))
            : undefined,
        },
      };
    }
    case "asuransi":
      return {
        path: "insurances",
        queryKey: "insurances",
        body: {
          name: v.nama,
          type: INSURANCE_TYPE[v.jenis ?? ""] ?? "lainnya",
          premiumAmount: String(parseRupiah(v.premi ?? "0")),
          coverageAmount: v.pertanggungan
            ? String(parseRupiah(v.pertanggungan))
            : undefined,
          renewalDate: v.jatuhtempo || undefined,
        },
      };
    case "tujuan":
      return { path: "goals", queryKey: "goals", body: buildGoalBody(v) };
    default:
      return null;
  }
}

export default function QuickInputPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTxnOpen } = useShell();
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const { handleError } = useApiError();
  const [crud, setCrud] = useState<CrudModalState | null>(null);

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
    enabled: Boolean(familyGroupId) && Boolean(token),
  });
  const recentTransactions = recentResponse?.data;

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

  return (
    <div className="space-y-4">
      <section aria-labelledby="quickinput-heading" className="mb-1">
        <h1
          id="quickinput-heading"
          className="text-[17px] font-extrabold tracking-tight"
        >
          {t.quickinput.pageTitle}
        </h1>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {QUICK_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => handleClick(card)}
            className="cursor-pointer rounded-[14px] border bg-card p-[18px] text-center transition-all duration-150 hover:-translate-y-[3px] hover:border-primary hover:shadow-[0_8px_24px_rgba(79,70,229,.14)]"
          >
            <div
              className="mx-auto mb-3 flex size-12 items-center justify-center rounded-[14px]"
              style={{ background: card.iconBg, color: card.iconColor }}
            >
              <card.icon className="size-[21px]" />
            </div>
            <div className="text-[13.5px] font-bold">
              {t.quickinput.cards[card.id].name}
            </div>
            <div className="mt-[3px] text-[11px] leading-[1.4] text-muted-foreground">
              {t.quickinput.cards[card.id].desc}
            </div>
          </button>
        ))}
      </div>

      {recentTransactions && (
        <SectionCard
          title={t.quickinput.recentEntriesTitle}
          action={
            <CardLink
              onClick={() => router.push("/transaksi")}
              className="no-underline hover:no-underline"
            >
              {t.quickinput.viewAllLink}
            </CardLink>
          }
          bodyClassName="-my-3"
        >
          {recentTransactions.length === 0 && (
            <p className="py-3 text-[13.5px] text-muted-foreground">
              {t.quickinput.emptyRecent}
            </p>
          )}
          {recentTransactions.map((tx, i) => (
            <div
              key={tx.id}
              className={`flex items-center gap-3 py-3 ${i < recentTransactions.length - 1 ? "border-b" : ""}`}
            >
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">
                  {tx.description ?? tx.categoryName ?? "—"}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {tx.accountName ?? "—"}
                </div>
              </div>
              <div
                className={`text-[13.5px] font-bold ${tx.type === "expense" ? "text-destructive" : "text-success"}`}
              >
                {tx.type === "expense" ? "−" : "+"}
                {formatRupiah(parseFloat(tx.amount))}
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      <CrudModal
        state={crud}
        onClose={() => setCrud(null)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
