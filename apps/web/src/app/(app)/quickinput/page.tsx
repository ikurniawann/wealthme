"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useShell } from "@/components/shell/shell-context";
import { apiFetch } from "@/lib/api-client";
import { parseRupiah } from "@/lib/format";
import { buildGoalBody } from "@/lib/goals-utils";
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

type QuickCard = {
  name: string;
  desc: string;
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
    name: "Transaksi",
    desc: "Pemasukan / pengeluaran",
    icon: ArrowUpDown,
    iconBg: "#EEF2FF",
    iconColor: "var(--primary)",
    action: "txn",
  },
  {
    name: "Investasi",
    desc: "Saham, reksa dana, emas",
    icon: BarChart3,
    iconBg: "#DCFCE7",
    iconColor: "var(--success)",
    action: "crud",
    entity: "investasi",
  },
  {
    name: "Rekening",
    desc: "Tambah rekening bank",
    icon: Landmark,
    iconBg: "#DBEAFE",
    iconColor: "#1D4ED8",
    action: "crud",
    entity: "rekening",
  },
  {
    name: "E-Wallet",
    desc: "GoPay, OVO, DANA",
    icon: Wallet,
    iconBg: "#DCFCE7",
    iconColor: "var(--success)",
    action: "crud",
    entity: "ewallet",
  },
  {
    name: "Aset",
    desc: "Properti, kendaraan",
    icon: Briefcase,
    iconBg: "#FEF9C3",
    iconColor: "#A16207",
    action: "crud",
    entity: "aset",
  },
  {
    name: "Liabilitas",
    desc: "Utang & cicilan",
    icon: ReceiptText,
    iconBg: "#FEE2E2",
    iconColor: "var(--destructive)",
    action: "crud",
    entity: "liabilitas",
  },
  {
    name: "Asuransi",
    desc: "Tambah polis",
    icon: ShieldCheck,
    iconBg: "#EDE9FE",
    iconColor: "var(--brand-purple)",
    action: "crud",
    entity: "asuransi",
  },
  {
    name: "Tujuan",
    desc: "Goal keuangan baru",
    icon: Target,
    iconBg: "#CFFAFE",
    iconColor: "#0E7490",
    action: "crud",
    entity: "tujuan",
  },
  {
    name: "Anggaran",
    desc: "Kategori budget",
    icon: ClipboardList,
    iconBg: "#EEF2FF",
    iconColor: "var(--primary)",
    action: "navigate",
    href: "/anggaran",
  },
  {
    name: "Aset Warisan",
    desc: "Catat warisan",
    icon: Scroll,
    iconBg: "#EDE9FE",
    iconColor: "var(--brand-purple)",
    action: "navigate",
    href: "/warisan",
  },
  {
    name: "Donasi",
    desc: "Zakat & sumbangan",
    icon: HeartHandshake,
    iconBg: "#DCFCE7",
    iconColor: "var(--success)",
    action: "navigate",
    href: "/donation",
  },
  {
    name: "Split Bill",
    desc: "Patungan grup",
    icon: Receipt,
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    action: "navigate",
    href: "/splitbill",
  },
];

// CrudModal form values → real API request per entity. Amount values arrive
// dot-formatted ("1.500.000") — parseRupiah normalizes them.
const INVESTMENT_TYPE: Record<string, string> = {
  Saham: "saham",
  "Reksa Dana": "reksa_dana",
  Obligasi: "obligasi",
  Emas: "emas",
  Crypto: "kripto",
};
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
  Pendidikan: "lainnya",
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
    case "investasi":
      return {
        path: "investments",
        queryKey: "investments",
        body: {
          ticker: (v.ticker || v.nama || "INV")
            .toUpperCase()
            .replace(/[^A-Z0-9._-]/g, ""),
          name: v.nama,
          type: INVESTMENT_TYPE[v.jenis ?? ""] ?? "lainnya",
          quantity: "1",
          costBasisPerUnit: String(parseRupiah(v.modal ?? v.nilai ?? "0")),
        },
      };
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
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const [crud, setCrud] = useState<CrudModalState | null>(null);

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
      toast.success("Berhasil disimpan!");
    } catch {
      toast.error("Gagal menyimpan. Coba lagi.");
    }
  }

  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[15px] font-bold">⚡ Quick Input</div>
        <div className="text-[12px] text-muted-foreground">
          Pilih jenis data yang ingin kamu input — langsung isi via popup
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {QUICK_CARDS.map((card) => (
          <button
            key={card.name}
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
            <div className="text-[13.5px] font-bold">{card.name}</div>
            <div className="mt-[3px] text-[11px] leading-[1.4] text-muted-foreground">
              {card.desc}
            </div>
          </button>
        ))}
      </div>

      <CrudModal
        state={crud}
        onClose={() => setCrud(null)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
