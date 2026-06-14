"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpDown,
  BarChart3,
  Briefcase,
  Camera,
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
);

const QUICK_CARDS: QuickCard[] = [
  {
    name: "Transaksi",
    desc: "Pemasukan / pengeluaran",
    icon: ArrowUpDown,
    iconBg: "#EEF2FF",
    iconColor: "var(--primary)",
    action: "navigate",
    href: "/transaksi",
  },
  {
    name: "Scan Struk",
    desc: "Input via foto bon",
    icon: Camera,
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    action: "toast",
    message: "📷 Scan struk segera hadir",
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

export default function QuickInputPage() {
  const router = useRouter();
  const [crud, setCrud] = useState<CrudModalState | null>(null);

  const handleClick = (card: QuickCard) => {
    if (card.action === "crud") {
      setCrud({ entity: card.entity, mode: "add" });
    } else if (card.action === "navigate") {
      router.push(card.href);
    } else {
      toast(card.message);
    }
  };

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

      <CrudModal state={crud} onClose={() => setCrud(null)} />
    </div>
  );
}
