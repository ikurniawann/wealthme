"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, MoneyStat } from "@/components/wm";

type TxnType = "income" | "expense" | "transfer" | "credit";

type Txn = {
  icon: string;
  iconBg: string;
  name: string;
  meta: string;
  amount: string;
  positive: boolean;
  time: string;
  type: TxnType;
};

type TxnGroup = { label: string; rows: Txn[] };

const GROUPS: TxnGroup[] = [
  {
    label: "Hari ini",
    rows: [
      {
        icon: "📥",
        iconBg: "#DCFCE7",
        name: "Transfer masuk dari BCA",
        meta: "Pemasukan · BCA Tahapan",
        amount: "+Rp 5.000.000",
        positive: true,
        time: "09:21",
        type: "income",
      },
      {
        icon: "💳",
        iconBg: "#FEE2E2",
        name: "Pembayaran Kartu Kredit",
        meta: "Pengeluaran · BCA",
        amount: "-Rp 1.250.000",
        positive: false,
        time: "08:45",
        type: "credit",
      },
      {
        icon: "👜",
        iconBg: "#FEE2E2",
        name: "Top up GoPay",
        meta: "Pengeluaran · GoPay",
        amount: "-Rp 200.000",
        positive: false,
        time: "08:12",
        type: "expense",
      },
    ],
  },
  {
    label: "Kemarin",
    rows: [
      {
        icon: "🛒",
        iconBg: "#FEE2E2",
        name: "Belanja di Shopee",
        meta: "Pengeluaran · e-Wallet",
        amount: "-Rp 150.000",
        positive: false,
        time: "20:15",
        type: "expense",
      },
      {
        icon: "↗️",
        iconBg: "#FEE2E2",
        name: "Transfer ke Mandiri",
        meta: "Transfer · BCA → Mandiri",
        amount: "-Rp 2.000.000",
        positive: false,
        time: "17:30",
        type: "transfer",
      },
      {
        icon: "🏦",
        iconBg: "#DCFCE7",
        name: "Bunga Tabungan BNI",
        meta: "Pemasukan · BNI Taplus",
        amount: "+Rp 45.000",
        positive: true,
        time: "06:21",
        type: "income",
      },
    ],
  },
  {
    label: "28 April 2025",
    rows: [
      {
        icon: "☕",
        iconBg: "#FEE2E2",
        name: "Makan di Starbucks",
        meta: "Makanan & Minuman",
        amount: "-Rp 85.000",
        positive: false,
        time: "19:45",
        type: "expense",
      },
      {
        icon: "✈️",
        iconBg: "#FEE2E2",
        name: "Tiket Pesawat ke Bali",
        meta: "Transportasi · Kartu Kredit",
        amount: "-Rp 1.350.000",
        positive: false,
        time: "14:20",
        type: "credit",
      },
    ],
  },
  {
    label: "27 April 2025",
    rows: [
      {
        icon: "💰",
        iconBg: "#DCFCE7",
        name: "Gaji Bulanan",
        meta: "Pemasukan · BCA Tahapan",
        amount: "+Rp 18.000.000",
        positive: true,
        time: "07:00",
        type: "income",
      },
      {
        icon: "🏥",
        iconBg: "#FEE2E2",
        name: "Apotek & Suplemen",
        meta: "Kesehatan",
        amount: "-Rp 320.000",
        positive: false,
        time: "12:30",
        type: "expense",
      },
    ],
  },
];

const FILTERS: { label: string; value: TxnType | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Masuk", value: "income" },
  { label: "Keluar", value: "expense" },
  { label: "Transfer", value: "transfer" },
  { label: "Kartu Kredit", value: "credit" },
];

export default function TransaksiPage() {
  const [filter, setFilter] = useState<TxnType | "all">("all");

  const groups = GROUPS.map((g) => ({
    ...g,
    rows: filter === "all" ? g.rows : g.rows.filter((r) => r.type === filter),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="rounded-[14px] border bg-card p-4">
        <div className="grid grid-cols-3 gap-3">
          <MoneyStat label="Total Pemasukan" value="Rp 25.850.000" valueClass="text-success" />
          <MoneyStat
            label="Total Pengeluaran"
            value="Rp 18.340.000"
            valueClass="text-destructive"
          />
          <MoneyStat label="Selisih" value="Rp 7.510.000" valueClass="text-success" />
        </div>
      </div>

      {/* Filter tabs + sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors " +
                (filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <select className="rounded-md border bg-background px-3 py-[7px] text-xs text-muted-foreground outline-none">
          <option>Urutkan: Terbaru</option>
          <option>Terlama</option>
          <option>Terbesar</option>
        </select>
      </div>

      {/* Transaction list */}
      <div className="space-y-1">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mt-3 mb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {group.label}
            </div>
            <div className="space-y-1.5">
              {group.rows.map((row) => (
                <button
                  key={row.name + row.time}
                  onClick={() => toast("📋 Detail transaksi")}
                  className="flex w-full items-center gap-3 rounded-[12px] border bg-card p-3 text-left transition-colors hover:bg-accent/40"
                >
                  <div
                    className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-[15px]"
                    style={{ background: row.iconBg }}
                  >
                    {row.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{row.name}</div>
                    <div className="truncate text-[11.5px] text-muted-foreground">{row.meta}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={
                        "text-[13.5px] font-bold " +
                        (row.positive ? "text-success" : "text-destructive")
                      }
                    >
                      {row.amount}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{row.time}</div>
                  </div>
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <SectionCard>
            <div className="py-6 text-center text-[13px] text-muted-foreground">
              Tidak ada transaksi pada filter ini.
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
