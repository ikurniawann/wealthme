"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AccountAction = { label: string; toast: string };

type Account = {
  logo: string;
  logoBg: string;
  logoColor?: string;
  name: string;
  number: string;
  badge: { variant: "success" | "gray"; label: string };
  balanceLabel: string;
  balance: string;
  type: string;
  detailToast: string;
  actions: AccountAction[];
};

const ACCOUNTS: Account[] = [
  {
    logo: "BCA",
    logoBg: "#0061AF",
    name: "BCA Tahapan",
    number: "•••• •••• 9010",
    badge: { variant: "success", label: "Utama" },
    balanceLabel: "Saldo Tersedia",
    balance: "Rp 128.450.000",
    type: "Tabungan · BCA Prioritas",
    detailToast: "Detail BCA Tahapan",
    actions: [
      { label: "↗ Transfer", toast: "Transfer" },
      { label: "📥 Top Up", toast: "Topup" },
      { label: "📋 Mutasi", toast: "Mutasi" },
    ],
  },
  {
    logo: "MDR",
    logoBg: "#F9A01B",
    logoColor: "#000",
    name: "Bank Mandiri",
    number: "•••• •••• 5586",
    badge: { variant: "gray", label: "Aktif" },
    balanceLabel: "Saldo",
    balance: "Rp 85.000.000",
    type: "Tabungan Rupiah",
    detailToast: "Detail Mandiri",
    actions: [
      { label: "↗ Transfer", toast: "Transfer" },
      { label: "📋 Mutasi", toast: "Mutasi" },
    ],
  },
  {
    logo: "BNI",
    logoBg: "#FF6600",
    name: "BNI Taplus",
    number: "•••• •••• 5544",
    badge: { variant: "gray", label: "Aktif" },
    balanceLabel: "Saldo",
    balance: "Rp 62.000.000",
    type: "Tabungan Taplus",
    detailToast: "Detail BNI",
    actions: [
      { label: "↗ Transfer", toast: "Transfer" },
      { label: "📋 Mutasi", toast: "Mutasi" },
    ],
  },
];

function AccountCard({ account }: { account: Account }) {
  return (
    <Card
      className="cursor-pointer gap-0 space-y-3.5 p-5 transition-shadow hover:shadow-md"
      onClick={() => toast(account.detailToast)}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-12 items-center justify-center rounded-md text-[12px] font-extrabold text-white"
          style={{ background: account.logoBg, color: account.logoColor }}
        >
          {account.logo}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold">{account.name}</div>
          <div className="mono text-[12px] text-muted-foreground">
            {account.number}
          </div>
        </div>
        <StatusBadge variant={account.badge.variant}>
          {account.badge.label}
        </StatusBadge>
      </div>

      <div>
        <div className="text-[11px] text-muted-foreground">
          {account.balanceLabel}
        </div>
        <div className="text-[22px] font-black">{account.balance}</div>
        <div className="text-[11.5px] text-muted-foreground">{account.type}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {account.actions.map((action) => (
          <button
            key={action.label}
            className="cursor-pointer rounded-md border bg-background px-3 py-2 text-[12px] font-semibold transition-colors hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              toast(action.toast);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

export default function RekeningPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[13px] font-bold">5 Rekening Terhubung</div>
          <div className="text-[11px] text-muted-foreground">
            Total: Rp 339.450.000
          </div>
        </div>
        <Button onClick={() => toast("➕ Tambah rekening")}>
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {ACCOUNTS.map((account) => (
        <AccountCard key={account.name} account={account} />
      ))}
    </div>
  );
}
