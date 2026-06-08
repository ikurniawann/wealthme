"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

type AssetRow = {
  icon: string;
  iconBg: string;
  name: string;
  sub?: string;
  val: string;
  valDanger?: boolean;
  growth?: string;
  growthUp?: boolean;
  growthMuted?: boolean;
};

type AssetGroup = {
  id: "dana" | "investasi" | "fisik" | "liabilitas";
  emoji: string;
  name: string;
  total: string;
  totalDanger?: boolean;
  rows: AssetRow[];
};

const GROUPS: AssetGroup[] = [
  {
    id: "dana",
    emoji: "💳",
    name: "Dana & Rekening",
    total: "Rp 339.450.000",
    rows: [
      {
        icon: "🏦",
        iconBg: "#DBEAFE",
        name: "BCA Tahapan",
        sub: "•••• 9010",
        val: "Rp 128.450.000",
        growth: "Rekening Tabungan",
        growthMuted: true,
      },
      {
        icon: "🏦",
        iconBg: "#FFF7ED",
        name: "Mandiri",
        sub: "•••• 5586",
        val: "Rp 85.000.000",
      },
      {
        icon: "🏦",
        iconBg: "#ECFDF5",
        name: "BNI Taplus",
        sub: "•••• 5544",
        val: "Rp 62.000.000",
      },
      {
        icon: "💚",
        iconBg: "#DCFCE7",
        name: "GoPay",
        sub: "e-Wallet",
        val: "Rp 45.000.000",
      },
      {
        icon: "🔴",
        iconBg: "#FEF3C7",
        name: "LinkAja",
        sub: "e-Wallet",
        val: "Rp 19.000.000",
      },
    ],
  },
  {
    id: "investasi",
    emoji: "📈",
    name: "Investasi",
    total: "Rp 577.200.000",
    rows: [
      {
        icon: "📊",
        iconBg: "#EDE9FE",
        name: "Reksa Dana",
        val: "Rp 356.100.000",
        growth: "▲ 18,6%",
        growthUp: true,
      },
      {
        icon: "📉",
        iconBg: "#DBEAFE",
        name: "Saham",
        val: "Rp 90.800.000",
        growth: "▲ 5,9%",
        growthUp: true,
      },
      {
        icon: "🥇",
        iconBg: "#FEF9C3",
        name: "Obligasi",
        val: "Rp 80.300.000",
        growth: "▲ 0,4%",
        growthUp: true,
      },
      {
        icon: "✨",
        iconBg: "#FFF7ED",
        name: "Emas Digital",
        val: "Rp 50.000.000",
        growth: "▲ 11,1%",
        growthUp: true,
      },
    ],
  },
  {
    id: "fisik",
    emoji: "🏠",
    name: "Aset Fisik",
    total: "Rp 251.300.000",
    rows: [
      {
        icon: "🏠",
        iconBg: "#FEF9C3",
        name: "Properti",
        sub: "Apartemen Kelapa Gading",
        val: "Rp 200.000.000",
        growth: "▲ 6,4%",
        growthUp: true,
      },
      {
        icon: "🚗",
        iconBg: "#DBEAFE",
        name: "Toyota Avanza 2022",
        val: "Rp 45.000.000",
      },
      {
        icon: "💻",
        iconBg: "#F3F4F6",
        name: "Elektronik",
        val: "Rp 6.300.000",
      },
    ],
  },
  {
    id: "liabilitas",
    emoji: "⚠️",
    name: "Liabilitas",
    total: "-Rp 40.170.000",
    totalDanger: true,
    rows: [
      {
        icon: "💳",
        iconBg: "#FEE2E2",
        name: "Kartu Kredit",
        val: "-Rp 15.170.000",
        valDanger: true,
      },
      {
        icon: "📋",
        iconBg: "#FEE2E2",
        name: "Pinjaman",
        val: "-Rp 25.000.000",
        valDanger: true,
      },
    ],
  },
];

const TABS = [
  { label: "Semua", groups: ["dana", "investasi", "fisik", "liabilitas"] },
  { label: "Dana", groups: ["dana"] },
  { label: "Rekening", groups: ["dana"] },
  { label: "Investasi", groups: ["investasi"] },
  { label: "Aset Fisik", groups: ["fisik"] },
] as const;

function AssetGroupCard({ group }: { group: AssetGroup }) {
  return (
    <div className="rounded-[14px] border bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[17px]">{group.emoji}</span>
          <span className="text-[13.5px] font-bold">{group.name}</span>
        </div>
        <div
          className={`text-[14px] font-extrabold ${
            group.totalDanger ? "text-destructive" : ""
          }`}
        >
          {group.total}
        </div>
      </div>
      <div>
        {group.rows.map((row, i) => (
          <div
            key={row.name}
            className={`flex items-center gap-3 py-3 ${
              i < group.rows.length - 1 ? "border-b" : ""
            }`}
          >
            <div
              className="flex size-9 items-center justify-center rounded-[10px] text-[16px]"
              style={{ background: row.iconBg }}
            >
              {row.icon}
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold">{row.name}</div>
              {row.sub && (
                <div className="text-[11.5px] text-muted-foreground">
                  {row.sub}
                </div>
              )}
            </div>
            <div className="text-right">
              <div
                className={`text-[14px] font-extrabold ${
                  row.valDanger ? "text-destructive" : ""
                }`}
              >
                {row.val}
              </div>
              {row.growth && (
                <div
                  className={`text-[11px] font-semibold ${
                    row.growthMuted
                      ? "text-muted-foreground"
                      : row.growthUp
                        ? "text-success"
                        : "text-destructive"
                  }`}
                >
                  {row.growth}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AsetPage() {
  const [active, setActive] = useState(0);
  const visibleGroups = GROUPS.filter((g) =>
    (TABS[active].groups as readonly string[]).includes(g.id),
  );

  return (
    <div className="space-y-4">
      <div className="hide-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
              active === i
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-2.5 rounded-[14px] border-[1.5px] p-4 px-[18px]"
        style={{ background: "var(--accent)", borderColor: "#C7D2FE" }}
      >
        <div>
          <div className="mb-[3px] text-[11px] text-muted-foreground">
            Total Aset
          </div>
          <div className="text-[24px] font-black text-primary-strong">
            Rp 1.168.950.000
          </div>
          <div className="mt-[3px] text-[12px] text-success">
            ▲ 8,45% (Rp 91.000.000) bulan ini
          </div>
        </div>
        <button className="flex size-9 cursor-pointer items-center justify-center rounded-md border bg-background transition-colors hover:bg-accent">
          <Lock className="size-3.5" />
        </button>
      </div>

      {visibleGroups.map((group) => (
        <AssetGroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}
