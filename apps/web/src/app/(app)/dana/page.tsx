"use client";

import { toast } from "sonner";
import { SectionCard, HeroCard, CardLink } from "@/components/wm";

type WalletItem = {
  icon: string;
  iconBg: string;
  name: string;
  sub: string;
  amount: string;
  status?: string;
  border?: boolean;
};

const CASH_ITEMS: WalletItem[] = [
  {
    icon: "👛",
    iconBg: "#DCFCE7",
    name: "Dompet Fisik",
    sub: "Cash on hand",
    amount: "Rp 1.500.000",
    border: true,
  },
  {
    icon: "🏧",
    iconBg: "#EEF2FF",
    name: "Dana Darurat (Terpisah)",
    sub: "Tabungan khusus darurat",
    amount: "Rp 24.000.000",
    border: false,
  },
];

const WALLET_ITEMS: WalletItem[] = [
  {
    icon: "💚",
    iconBg: "#DCFCE7",
    name: "GoPay",
    sub: "082345678901",
    amount: "Rp 45.000.000",
    status: "Active",
    border: true,
  },
  {
    icon: "🔴",
    iconBg: "#FEE2E2",
    name: "LinkAja",
    sub: "081234567890",
    amount: "Rp 19.000.000",
    status: "Active",
    border: false,
  },
];

function WalletRow({ item }: { item: WalletItem }) {
  return (
    <div
      className={`flex items-center gap-3 py-3 ${
        item.border ? "border-b" : ""
      }`}
    >
      <div
        className="flex size-10 items-center justify-center rounded-[10px] text-[18px]"
        style={{ background: item.iconBg }}
      >
        {item.icon}
      </div>
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">{item.name}</div>
        <div className="text-[11.5px] text-muted-foreground">{item.sub}</div>
      </div>
      <div className="text-right">
        <div className="text-[15px] font-extrabold">{item.amount}</div>
        {item.status && (
          <div className="text-[11px] text-muted-foreground">{item.status}</div>
        )}
      </div>
    </div>
  );
}

export default function DanaPage() {
  return (
    <div className="space-y-4">
      <HeroCard className="gradient-emerald">
        <div className="mb-1 text-xs opacity-80">
          💵 Total Dana Tunai &amp; E-Wallet
        </div>
        <div className="text-[28px] font-black">Rp 68.450.000</div>
        <div className="mt-1.5 text-xs text-[#86EFAC]">
          ▲ 5,20% dari bulan lalu
        </div>
      </HeroCard>

      <SectionCard title="Dompet & Cash" bodyClassName="-my-3">
        {CASH_ITEMS.map((item) => (
          <WalletRow key={item.name} item={item} />
        ))}
      </SectionCard>

      <SectionCard
        title="E-Wallet"
        action={
          <CardLink
            className="rounded-md bg-accent px-3 py-[5px] text-[11px]"
            onClick={() => toast("➕ Tambah e-wallet")}
          >
            + Tambah
          </CardLink>
        }
        bodyClassName="-my-3"
      >
        {WALLET_ITEMS.map((item) => (
          <WalletRow key={item.name} item={item} />
        ))}
      </SectionCard>
    </div>
  );
}
