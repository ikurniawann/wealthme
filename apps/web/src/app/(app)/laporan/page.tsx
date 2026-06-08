"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, CardLink, MoneyStat, ProgressBar, StatusBadge } from "@/components/wm";
import { BarChart } from "@/components/charts/bar-chart";
import { Donut, DonutLegend } from "@/components/charts/donut";
import type { DonutSegment } from "@/components/charts/donut";
import { CASHFLOW } from "@/lib/data";

/* ───────────────────────── Tab definitions ───────────────────────── */

const TABS: { id: string; label: string }[] = [
  { id: "rsum", label: "Ringkasan" },
  { id: "rharian", label: "Harian" },
  { id: "rbulanan", label: "Bulanan" },
  { id: "rtahunan", label: "Tahunan" },
  { id: "rfamily", label: "Group Family" },
  { id: "rbank", label: "Bank" },
  { id: "rdetail", label: "Detail" },
  { id: "raliran", label: "Aliran Dana" },
  { id: "rpnl", label: "PNL" },
  { id: "rbalance", label: "Balance Sheet" },
  { id: "rcashflow", label: "Cashflow" },
  { id: "rkas", label: "Arus Kas" },
  { id: "rinv", label: "Investasi" },
  { id: "rasl", label: "Aset & Liabilitas" },
  { id: "rperf", label: "Performa" },
  { id: "rpajak", label: "Pajak" },
];

/* ───────────────────────── Small helpers ───────────────────────── */

/** Compact 4-up stat block (the demo's `.laporan-stats`). */
function StatTile({
  label,
  value,
  valueClass,
  hint,
}: {
  label: string;
  value: string;
  valueClass?: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border bg-card p-4">
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      <div className={"text-[18px] font-extrabold " + (valueClass ?? "")}>
        {value}
        {hint}
      </div>
    </div>
  );
}

/** Activity row (the demo's `.act-item`). */
function ActItem({
  icon,
  iconBg,
  iconColor,
  iconSize = "16px",
  name,
  cat,
  right,
  last,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor?: string;
  iconSize?: string;
  name: string;
  cat?: string;
  right: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-3 py-2.5 " + (last ? "" : "border-b border-border")
      }
    >
      <div
        className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] font-bold"
        style={{ background: iconBg, color: iconColor, fontSize: iconSize }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">{name}</div>
        {cat && <div className="text-[11px] text-muted-foreground">{cat}</div>}
      </div>
      <div className="text-right">{right}</div>
    </div>
  );
}

/** Labelled progress row (the demo's progress-bar blocks). */
function BarRow({
  label,
  right,
  value,
  color,
}: {
  label: React.ReactNode;
  right: React.ReactNode;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-[5px] flex justify-between text-[12.5px]">
        <span className="font-semibold">{label}</span>
        <span className="flex items-center gap-2">{right}</span>
      </div>
      <ProgressBar value={value} color={color} height={8} />
    </div>
  );
}

/* ───────────────────────── Section: Ringkasan ───────────────────────── */

const EXPENSE_ALLOC: DonutSegment[] = [
  { label: "Kebutuhan", value: 44, color: "#4F46E5" },
  { label: "Gaya Hidup", value: 25, color: "#10B981" },
  { label: "Transportasi", value: 12, color: "#F59E0B" },
  { label: "Kesehatan", value: 8, color: "#8B5CF6" },
  { label: "Lainnya", value: 11, color: "#E2E8F0" },
];

const WEALTH_ALLOC: DonutSegment[] = [
  { label: "Investasi", value: 45, color: "#4F46E5" },
  { label: "Properti", value: 25, color: "#10B981" },
  { label: "Cash", value: 20, color: "#F59E0B" },
  { label: "Bisnis", value: 8, color: "#8B5CF6" },
  { label: "Lainnya", value: 2, color: "#E2E8F0" },
];

function RingkasanSection({ go }: { go: (id: string) => void }) {
  return (
    <div className="space-y-3.5">
      <SectionCard title="Ringkasan Keuangan — April 2025">
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat label="Total Pemasukan" value="Rp 25.850.000" valueClass="text-success" />
          <MoneyStat label="Total Pengeluaran" value="Rp 18.340.000" valueClass="text-destructive" />
          <MoneyStat label="Surplus" value="Rp 7.510.000" valueClass="text-success" />
          <div>
            <div className="mb-[3px] text-[11px] text-muted-foreground">Savings Rate</div>
            <div className="text-[17px] font-extrabold text-primary">
              29% <span className="text-[11px] text-success">▲ 6%</span>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <BarChart
            months={CASHFLOW.months}
            income={CASHFLOW.income}
            expense={CASHFLOW.expense}
            max={CASHFLOW.max}
            height={100}
          />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <SectionCard title="Alokasi Pengeluaran">
          <div className="flex flex-wrap items-center gap-3.5">
            <Donut
              segments={EXPENSE_ALLOC}
              size={110}
              thickness={16}
              centerValue="18,34 jt"
              centerLabel="Total"
            />
            <div className="min-w-[120px] flex-1">
              <DonutLegend segments={EXPENSE_ALLOC} />
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Wealth Allocation">
          <div className="flex flex-wrap items-center gap-3.5">
            <Donut
              segments={WEALTH_ALLOC}
              size={110}
              thickness={16}
              centerValue="1,256 M"
              centerLabel="Total"
            />
            <div className="min-w-[120px] flex-1">
              <DonutLegend segments={WEALTH_ALLOC} />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Performa Investasi"
        action={<CardLink onClick={() => go("rinv")}>Lihat detail</CardLink>}
      >
        <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] text-muted-foreground">Total Nilai</div>
            <div className="text-[20px] font-black">Rp 565.551.000</div>
            <div className="mt-1 text-[12px] text-success">+Rp 75.551.000 ▲ 15,4%</div>
            <div className="text-[11px] text-success">Return hari ini: +Rp 1.250.000 (+0,22%)</div>
          </div>
          <div>
            <svg viewBox="0 0 260 80" width="100%" height={70} preserveAspectRatio="none">
              <defs>
                <linearGradient id="ig-laporan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(79,70,229,.15)" />
                  <stop offset="100%" stopColor="rgba(79,70,229,.01)" />
                </linearGradient>
              </defs>
              <path
                d="M0,70 C30,65 60,58 90,50 C120,42 150,38 180,30 C210,22 230,18 260,10"
                fill="none"
                stroke="#4F46E5"
                strokeWidth={2}
              />
              <path
                d="M0,70 C30,65 60,58 90,50 C120,42 150,38 180,30 C210,22 230,18 260,10 L260,80 L0,80 Z"
                fill="url(#ig-laporan)"
              />
              <path
                d="M0,74 C30,72 60,68 90,64 C120,60 150,56 180,53 C210,50 230,47 260,44"
                fill="none"
                stroke="#10B981"
                strokeWidth={1.5}
                strokeDasharray="5,3"
              />
            </svg>
            <div className="mt-0.5 flex gap-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-[2px]" style={{ background: "#4F46E5" }} /> Nilai
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-[2px]" style={{ background: "#10B981" }} /> Modal
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
        <div className="text-[24px]">🤖</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">Insight AI</div>
          <div className="text-[12px] text-muted-foreground">
            Pengeluaran gaya hidupmu naik 18% dibanding bulan lalu. Coba atur budget agar savings
            rate tetap sehat.
          </div>
        </div>
        <a
          href="/ai"
          className="self-center whitespace-nowrap text-[12px] font-bold text-primary hover:underline"
        >
          Lihat Rekomendasi →
        </a>
      </div>
    </div>
  );
}

/* ───────────────────────── Section: Harian ───────────────────────── */

function HarianSection() {
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">Laporan Harian — 18 Mei 2025</div>
        <input
          type="date"
          defaultValue="2025-05-18"
          className="rounded-md border bg-background px-3 py-[7px] text-[13.5px] outline-none focus:border-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile label="Pemasukan Hari Ini" value="Rp 5.000.000" valueClass="text-success" />
        <StatTile label="Pengeluaran Hari Ini" value="Rp 1.508.000" valueClass="text-destructive" />
        <StatTile label="Net Harian" value="+Rp 3.492.000" valueClass="text-success" />
        <StatTile label="Jumlah Transaksi" value="6" valueClass="text-primary" />
      </div>
      <SectionCard title="Transaksi Hari Ini">
        <ActItem
          icon="📥"
          iconBg="#DCFCE7"
          name="Transfer masuk dari BCA"
          cat="09:21 · Pemasukan"
          right={<div className="text-[13px] font-bold text-success">+Rp 5.000.000</div>}
        />
        <ActItem
          icon="🛒"
          iconBg="#FEF3C7"
          name="Alfamart Pahlawan"
          cat="14:32 · Belanja"
          right={<div className="text-[13px] font-bold text-destructive">-Rp 58.000</div>}
        />
        <ActItem
          icon="☕"
          iconBg="#DBEAFE"
          name="Kopi Kenangan"
          cat="15:10 · Makan & Minum"
          right={<div className="text-[13px] font-bold text-destructive">-Rp 50.000</div>}
        />
        <ActItem
          icon="⛽"
          iconBg="#FEE2E2"
          name="Pertamina"
          cat="16:45 · Transportasi"
          right={<div className="text-[13px] font-bold text-destructive">-Rp 300.000</div>}
        />
        <ActItem
          icon="🍽️"
          iconBg="#EDE9FE"
          name="Makan Malam"
          cat="19:30 · Makan & Minum"
          right={<div className="text-[13px] font-bold text-destructive">-Rp 1.100.000</div>}
          last
        />
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Bulanan ───────────────────────── */

const BULANAN_ROWS = [
  { bulan: "April", masuk: "25,85 jt", keluar: "18,34 jt", net: "+7,51 jt" },
  { bulan: "Maret", masuk: "24,20 jt", keluar: "19,80 jt", net: "+4,40 jt" },
  { bulan: "Februari", masuk: "23,00 jt", keluar: "17,50 jt", net: "+5,50 jt" },
  { bulan: "Januari", masuk: "22,00 jt", keluar: "21,00 jt", net: "+1,00 jt" },
];

function BulananSection() {
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">Laporan Bulanan 2025</div>
        <select className="rounded-md border bg-background px-3 py-[7px] text-[13.5px] outline-none focus:border-primary">
          <option>April 2025</option>
          <option>Maret 2025</option>
        </select>
      </div>
      <SectionCard title="Tren 6 Bulan Terakhir">
        <BarChart
          months={CASHFLOW.months}
          income={CASHFLOW.income}
          expense={CASHFLOW.expense}
          max={CASHFLOW.max}
          height={110}
        />
      </SectionCard>
      <SectionCard title="Rekap per Bulan">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-semibold">Bulan</th>
                <th className="py-2 font-semibold">Masuk</th>
                <th className="py-2 font-semibold">Keluar</th>
                <th className="py-2 font-semibold">Net</th>
              </tr>
            </thead>
            <tbody>
              {BULANAN_ROWS.map((r) => (
                <tr key={r.bulan} className="border-b last:border-0">
                  <td className="py-2.5 font-semibold">{r.bulan}</td>
                  <td className="mono py-2.5 text-success">{r.masuk}</td>
                  <td className="mono py-2.5 text-destructive">{r.keluar}</td>
                  <td className="mono py-2.5 text-success">{r.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Tahunan ───────────────────────── */

const TAHUNAN_GROWTH = [
  { year: "2025 (YTD)", value: "Rp 1.256.780.000", pct: 100, color: "var(--primary)" },
  { year: "2024", value: "Rp 1.085.000.000", pct: 86, color: "var(--brand-cyan)" },
  { year: "2023", value: "Rp 920.000.000", pct: 73, color: "var(--success)" },
];

function TahunanSection() {
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">Laporan Tahunan</div>
        <select className="rounded-md border bg-background px-3 py-[7px] text-[13.5px] outline-none focus:border-primary">
          <option>2025 (YTD)</option>
          <option>2024</option>
          <option>2023</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile label="Total Pemasukan 2025" value="Rp 95.050.000" valueClass="text-success" />
        <StatTile label="Total Pengeluaran" value="Rp 76.640.000" valueClass="text-destructive" />
        <StatTile label="Net Tahunan" value="+Rp 18.410.000" valueClass="text-success" />
        <StatTile label="Avg Savings Rate" value="19,4%" valueClass="text-primary" />
      </div>
      <SectionCard title="Pertumbuhan Net Worth per Tahun">
        <div className="flex flex-col gap-2.5">
          {TAHUNAN_GROWTH.map((g) => (
            <BarRow
              key={g.year}
              label={g.year}
              right={<span style={{ color: g.color }} className="font-bold">{g.value}</span>}
              value={g.pct}
              color={g.color}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Group Family ───────────────────────── */

const FAMILY_MEMBERS = [
  { initials: "IA", grad: "linear-gradient(135deg,var(--primary),var(--brand-purple))", name: "Irfan Arsandi", role: "Owner", amount: "Rp 12.500.000" },
  { initials: "SA", grad: "linear-gradient(135deg,#F97316,#FBBF24)", name: "Siti Arsandi", role: "Istri", amount: "Rp 9.800.000" },
  { initials: "BA", grad: "linear-gradient(135deg,#10B981,#06B6D4)", name: "Budi Arsandi", role: "Ayah", amount: "Rp 5.400.000" },
  { initials: "RA", grad: "linear-gradient(135deg,#8B5CF6,#EC4899)", name: "Rina Arsandi", role: "Adik", amount: "Rp 3.500.000" },
];

function FamilySection() {
  return (
    <div className="space-y-3.5">
      <div className="text-[15px] font-bold">Laporan Group Family — Arsandi Family</div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile label="Saldo Bersama" value="Rp 625.750.000" valueClass="text-primary" />
        <StatTile label="Pemasukan Family" value="Rp 42.000.000" valueClass="text-success" />
        <StatTile label="Pengeluaran Family" value="Rp 31.200.000" valueClass="text-destructive" />
        <StatTile label="Anggota Aktif" value="4 + 2 admin" valueClass="text-brand-purple" />
      </div>
      <SectionCard title="Pengeluaran per Anggota">
        {FAMILY_MEMBERS.map((m, i) => (
          <ActItem
            key={m.initials}
            icon={
              <span className="flex size-[38px] items-center justify-center rounded-full text-[12px] text-white" style={{ background: m.grad }}>
                {m.initials}
              </span>
            }
            iconBg="transparent"
            name={m.name}
            cat={m.role}
            right={<div className="text-[13px] font-bold text-destructive">{m.amount}</div>}
            last={i === FAMILY_MEMBERS.length - 1}
          />
        ))}
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Bank ───────────────────────── */

function BankSection() {
  return (
    <div className="space-y-3.5">
      <div className="text-[15px] font-bold">Laporan Bank — Konsolidasi Rekening</div>
      <SectionCard title="Saldo per Rekening">
        <ActItem
          icon="BCA"
          iconBg="#DBEAFE"
          iconColor="#0061AF"
          iconSize="12px"
          name="BCA Tahapan ···9010"
          cat="152 transaksi bulan ini"
          right={<div className="text-[13px] font-bold">Rp 128.450.000</div>}
        />
        <ActItem
          icon="MDR"
          iconBg="#FFF7ED"
          iconColor="#F9A01B"
          iconSize="10px"
          name="Mandiri ···5586"
          cat="98 transaksi bulan ini"
          right={<div className="text-[13px] font-bold">Rp 85.000.000</div>}
        />
        <ActItem
          icon="BNI"
          iconBg="#FFF7ED"
          iconColor="#FF6600"
          iconSize="11px"
          name="BNI Taplus ···5544"
          cat="45 transaksi bulan ini"
          right={<div className="text-[13px] font-bold">Rp 62.000.000</div>}
          last
        />
      </SectionCard>
      <SectionCard title="Mutasi Masuk vs Keluar per Bank">
        <div className="flex flex-col gap-2.5">
          <BarRow
            label="BCA"
            right={
              <>
                <span className="font-bold text-success">+18,2 jt</span>
                <span className="font-bold text-destructive">-12,1 jt</span>
              </>
            }
            value={66}
            color="var(--success)"
          />
          <BarRow
            label="Mandiri"
            right={
              <>
                <span className="font-bold text-success">+5,5 jt</span>
                <span className="font-bold text-destructive">-4,2 jt</span>
              </>
            }
            value={76}
            color="var(--brand-cyan)"
          />
          <BarRow
            label="BNI"
            right={
              <>
                <span className="font-bold text-success">+2,1 jt</span>
                <span className="font-bold text-destructive">-2,0 jt</span>
              </>
            }
            value={51}
            color="var(--warning)"
          />
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Detail ───────────────────────── */

const DETAIL_ROWS: {
  tgl: string;
  ket: string;
  kategori: string;
  variant: "success" | "info" | "danger" | "purple";
  akun: string;
  jumlah: string;
  up: boolean;
}[] = [
  { tgl: "18/05", ket: "Transfer masuk BCA", kategori: "Pemasukan", variant: "success", akun: "BCA", jumlah: "+5.000.000", up: true },
  { tgl: "18/05", ket: "Alfamart Pahlawan", kategori: "Belanja", variant: "info", akun: "GoPay", jumlah: "-58.000", up: false },
  { tgl: "17/05", ket: "Gaji Bulanan", kategori: "Gaji", variant: "success", akun: "BCA", jumlah: "+18.000.000", up: true },
  { tgl: "15/05", ket: "Pembayaran KK Mandiri", kategori: "Kartu Kredit", variant: "danger", akun: "Mandiri", jumlah: "-1.250.000", up: false },
  { tgl: "14/05", ket: "Belanja Shopee", kategori: "Belanja", variant: "info", akun: "BCA", jumlah: "-450.000", up: false },
  { tgl: "13/05", ket: "Top Up GoPay", kategori: "e-Wallet", variant: "purple", akun: "BCA", jumlah: "-200.000", up: false },
  { tgl: "12/05", ket: "Dividen BBCA", kategori: "Dividen", variant: "success", akun: "BCA", jumlah: "+750.000", up: true },
];

function DetailSection() {
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">Laporan Detail Transaksi</div>
        <button
          onClick={() => toast("📥 Export Excel...")}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-2 text-[12px] font-semibold transition-colors hover:bg-accent"
        >
          <FileSpreadsheet className="size-3.5" /> Export
        </button>
      </div>
      <SectionCard>
        <div className="w-full overflow-x-auto">
          <table className="min-w-[580px] w-full text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-semibold">Tanggal</th>
                <th className="py-2 font-semibold">Keterangan</th>
                <th className="py-2 font-semibold">Kategori</th>
                <th className="py-2 font-semibold">Akun</th>
                <th className="py-2 text-right font-semibold">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {DETAIL_ROWS.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="mono py-2.5">{r.tgl}</td>
                  <td className="py-2.5">{r.ket}</td>
                  <td className="py-2.5">
                    <StatusBadge variant={r.variant}>{r.kategori}</StatusBadge>
                  </td>
                  <td className="py-2.5">{r.akun}</td>
                  <td className={"mono py-2.5 text-right " + (r.up ? "text-success" : "text-destructive")}>
                    {r.jumlah}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Aliran Dana ───────────────────────── */

function FlowBar({
  width,
  grad,
  label,
  amount,
}: {
  width: string;
  grad: string;
  label: string;
  amount: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-[28px] items-center rounded-[6px] px-2.5 text-[11px] font-bold text-white"
        style={{ width, background: grad }}
      >
        {label}
      </div>
      <span className="text-[11px] font-bold">{amount}</span>
    </div>
  );
}

function AliranSection() {
  return (
    <div className="space-y-3.5">
      <div className="text-[15px] font-bold">Laporan Aliran Dana</div>
      <SectionCard title="Sankey Aliran Dana — April 2025">
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="mb-2 text-[11px] font-bold text-success">SUMBER DANA MASUK</div>
            <div className="flex flex-col gap-1.5">
              <FlowBar width="70%" grad="linear-gradient(90deg,var(--success),#34D399)" label="Gaji" amount="Rp 18 jt" />
              <FlowBar width="32%" grad="linear-gradient(90deg,#8B5CF6,#A78BFA)" label="Dividen" amount="Rp 5,15 jt" />
              <FlowBar width="20%" grad="linear-gradient(90deg,#06B6D4,#22D3EE)" label="Bunga" amount="Rp 2,7 jt" />
            </div>
          </div>
          <div className="text-center text-[18px] text-muted-foreground">⬇</div>
          <div>
            <div className="mb-2 text-[11px] font-bold text-destructive">ALOKASI DANA KELUAR</div>
            <div className="flex flex-col gap-1.5">
              <FlowBar width="44%" grad="linear-gradient(90deg,#4F46E5,#6366F1)" label="Kebutuhan" amount="Rp 8,07 jt" />
              <FlowBar width="28%" grad="linear-gradient(90deg,#10B981,#34D399)" label="Gaya Hidup" amount="Rp 4,58 jt" />
              <FlowBar width="42%" grad="linear-gradient(90deg,#F59E0B,#FBBF24)" label="Tabungan & Investasi" amount="Rp 7,51 jt" />
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: PNL ───────────────────────── */

function StatementRow({
  label,
  value,
  indent,
  valueColor,
  className,
  labelClass,
  valueClass,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  indent?: boolean;
  valueColor?: string;
  className?: string;
  labelClass?: string;
  valueClass?: string;
}) {
  return (
    <tr className={className}>
      <td className={"py-[7px] " + (indent ? "pl-3.5 " : "") + (labelClass ?? "")}>{label}</td>
      <td
        className={"mono py-[7px] text-right " + (valueClass ?? "")}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </td>
    </tr>
  );
}

function PnlSection() {
  return (
    <div className="space-y-3.5">
      <div className="text-[15px] font-bold">Profit &amp; Loss Statement — April 2025</div>
      <SectionCard>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow label="PENDAPATAN" className="border-b-2 border-border" labelClass="py-2.5 font-bold text-success" />
            <StatementRow label="Gaji" value="Rp 18.000.000" indent />
            <StatementRow label="Pendapatan Investasi" value="Rp 5.150.000" indent />
            <StatementRow label="Pendapatan Lain" value="Rp 2.700.000" indent />
            <StatementRow
              label="Total Pendapatan"
              value="Rp 25.850.000"
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-success"
            />
            <StatementRow label="BEBAN" className="border-b-2 border-border" labelClass="py-2.5 font-bold text-destructive" />
            <StatementRow label="Kebutuhan Pokok" value="Rp 8.069.600" indent />
            <StatementRow label="Gaya Hidup" value="Rp 4.585.000" indent />
            <StatementRow label="Transportasi" value="Rp 2.200.000" indent />
            <StatementRow label="Lainnya" value="Rp 3.485.400" indent />
            <StatementRow
              label="Total Beban"
              value="Rp 18.340.000"
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-destructive"
            />
            <StatementRow
              label="NET PROFIT"
              value="Rp 7.510.000"
              className="border-t-2 border-primary"
              labelClass="py-3 text-[15px] font-extrabold"
              valueClass="text-[16px] font-black text-success"
            />
            <StatementRow
              label="Net Margin"
              value="29,1%"
              labelClass="py-1 text-[11px] text-muted-foreground"
              valueClass="text-[11px] text-muted-foreground"
            />
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Balance Sheet ───────────────────────── */

function BalanceSection() {
  return (
    <div className="space-y-3.5">
      <div className="text-[15px] font-bold">Balance Sheet — Per 30 April 2025</div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <SectionCard title={<span className="text-success">ASET</span>}>
          <table className="w-full border-collapse text-[12.5px]">
            <tbody>
              <StatementRow label="Aset Lancar" labelClass="py-1.5 font-bold text-muted-foreground" />
              <StatementRow label="Kas & Setara Kas" value="339,45 jt" indent />
              <StatementRow label="Investasi Likuid" value="577,20 jt" indent />
              <StatementRow label="Aset Tetap" labelClass="py-1.5 font-bold text-muted-foreground" />
              <StatementRow label="Properti" value="200,00 jt" indent />
              <StatementRow label="Kendaraan & Lain" value="52,30 jt" indent />
              <StatementRow
                label="Total Aset"
                value="1.168,95 jt"
                className="border-t-2 border-success"
                labelClass="py-2 font-extrabold"
                valueClass="font-extrabold text-success"
              />
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title={<span className="text-destructive">LIABILITAS &amp; EKUITAS</span>}>
          <table className="w-full border-collapse text-[12.5px]">
            <tbody>
              <StatementRow label="Liabilitas" labelClass="py-1.5 font-bold text-muted-foreground" />
              <StatementRow label="Kartu Kredit" value="15,17 jt" indent />
              <StatementRow label="Pinjaman" value="25,00 jt" indent />
              <StatementRow
                label="Total Liabilitas"
                value="40,17 jt"
                className="border-b border-border"
                labelClass="py-1.5 font-bold"
                valueClass="font-bold text-destructive"
              />
              <StatementRow label="Ekuitas" labelClass="py-1.5 font-bold text-muted-foreground" />
              <StatementRow label="Net Worth" value="1.128,78 jt" indent />
              <StatementRow
                label="Total L + E"
                value="1.168,95 jt"
                className="border-t-2 border-primary"
                labelClass="py-2 font-extrabold"
                valueClass="font-extrabold text-primary"
              />
            </tbody>
          </table>
        </SectionCard>
      </div>
      <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
        <div className="text-[22px]">✅</div>
        <div>
          <div className="text-[13px] font-bold text-primary-strong">Balance Sheet Seimbang</div>
          <div className="text-[12px] text-muted-foreground">
            Total Aset = Total Liabilitas + Ekuitas. Debt-to-Asset ratio 3,2% (sangat sehat).
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Section: Cashflow ───────────────────────── */

function CashflowSection() {
  return (
    <div className="space-y-3.5">
      <div className="text-[15px] font-bold">Cashflow Statement — April 2025</div>
      <SectionCard>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow label="ARUS KAS OPERASI" className="border-b-2 border-border" labelClass="py-2.5 font-bold text-primary" />
            <StatementRow label="Penerimaan Gaji" value="+18.000.000" indent valueColor="var(--success)" />
            <StatementRow label="Pengeluaran Operasional" value="-15.340.000" indent valueColor="var(--destructive)" />
            <StatementRow
              label="Net Operasi"
              value="+2.660.000"
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-success"
            />
            <StatementRow label="ARUS KAS INVESTASI" className="border-b-2 border-border" labelClass="py-2.5 font-bold text-brand-purple" />
            <StatementRow label="Dividen & Bunga" value="+7.850.000" indent valueColor="var(--success)" />
            <StatementRow label="Pembelian Investasi" value="-3.000.000" indent valueColor="var(--destructive)" />
            <StatementRow
              label="Net Investasi"
              value="+4.850.000"
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-success"
            />
            <StatementRow label="ARUS KAS PENDANAAN" className="border-b-2 border-border" labelClass="py-2.5 font-bold text-warning" />
            <StatementRow label="Pembayaran Cicilan" value="-3.000.000" indent valueColor="var(--destructive)" />
            <StatementRow
              label="NET CASHFLOW"
              value="+4.510.000"
              className="border-t-2 border-primary"
              labelClass="py-3 text-[15px] font-extrabold"
              valueClass="text-[16px] font-black text-success"
            />
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Arus Kas ───────────────────────── */

function KasSection() {
  return (
    <div className="space-y-3.5">
      <SectionCard title="Arus Kas — April 2025">
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat label="Pemasukan" value="Rp 25.850.000" valueClass="text-success" />
          <MoneyStat label="Pengeluaran" value="Rp 18.340.000" valueClass="text-destructive" />
          <MoneyStat label="Surplus" value="Rp 7.510.000" valueClass="text-success" />
          <MoneyStat label="Savings Rate" value="29%" valueClass="text-primary" />
        </div>
        <div className="mt-4">
          <BarChart
            months={CASHFLOW.months}
            income={CASHFLOW.income}
            expense={CASHFLOW.expense}
            max={CASHFLOW.max}
            height={110}
          />
        </div>
      </SectionCard>
      <SectionCard title="Sumber Pemasukan">
        <ActItem
          icon="💼"
          iconBg="#DCFCE7"
          name="Gaji"
          right={
            <>
              <div className="text-[13px] font-bold text-success">Rp 18.000.000</div>
              <StatusBadge variant="success">69,6%</StatusBadge>
            </>
          }
        />
        <ActItem
          icon="📊"
          iconBg="#EDE9FE"
          name="Dividen & Return"
          right={
            <>
              <div className="text-[13px] font-bold text-success">Rp 5.150.000</div>
              <StatusBadge variant="purple">19,9%</StatusBadge>
            </>
          }
        />
        <ActItem
          icon="🏦"
          iconBg="#DBEAFE"
          name="Bunga Tabungan"
          right={
            <>
              <div className="text-[13px] font-bold text-success">Rp 1.500.000</div>
              <StatusBadge variant="info">5,8%</StatusBadge>
            </>
          }
        />
        <ActItem
          icon="🎁"
          iconBg="#FEF9C3"
          name="Lainnya"
          right={
            <>
              <div className="text-[13px] font-bold text-success">Rp 1.200.000</div>
              <StatusBadge variant="warning">4,6%</StatusBadge>
            </>
          }
          last
        />
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Investasi ───────────────────────── */

const INV_TYPES = [
  { label: "📊 Reksa Dana", value: "Rp 245.600.000 · 43%", pct: 43, color: "var(--primary)" },
  { label: "📉 Saham", value: "Rp 201.300.000 · 35%", pct: 35, color: "var(--brand-cyan)" },
  { label: "🏛️ Obligasi", value: "Rp 80.300.000 · 14%", pct: 14, color: "var(--success)" },
  { label: "🥇 Emas", value: "Rp 50.000.000 · 9%", pct: 9, color: "var(--warning)" },
];

function InvSection() {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Total Portofolio</div>
          <div className="text-[22px] font-black text-primary">Rp 577.200.000</div>
          <div className="mt-1 text-[12px] text-success">▲ 12,40% · +Rp 75.551.000</div>
        </div>
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Return YTD</div>
          <div className="text-[22px] font-black text-success">+15,4%</div>
          <div className="mt-1 text-[12px] text-muted-foreground">Benchmark IHSG: +8,2%</div>
        </div>
      </div>
      <SectionCard title="Portofolio per Jenis">
        <div className="flex flex-col gap-2.5">
          {INV_TYPES.map((t) => (
            <BarRow
              key={t.label}
              label={t.label}
              right={<span className="font-bold" style={{ color: t.color }}>{t.value}</span>}
              value={t.pct}
              color={t.color}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Aset & Liabilitas ───────────────────────── */

const RASIO = [
  { label: "Debt-to-Asset Ratio", value: "3,2%", valueColor: "var(--success)", hint: "Sangat Aman (<30%)", hintColor: "var(--success)" },
  { label: "Liquid Asset Ratio", value: "27%", valueColor: "var(--primary)", hint: "Baik (>20%)", hintColor: "var(--primary)" },
  { label: "Emergency Fund Ratio", value: "3,7x", valueColor: "var(--warning)", hint: "Target: 6x (perlu boost)", hintColor: "var(--warning)" },
  { label: "Net Worth Growth", value: "8,45%", valueColor: "var(--success)", hint: "▲ vs bulan lalu", hintColor: "var(--success)" },
];

function AslSection() {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Total Aset</div>
          <div className="text-[22px] font-black text-success">Rp 1.168.950.000</div>
          <div className="mt-1 text-[12px] text-success">▲ 8,45% bulan ini</div>
        </div>
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Total Liabilitas</div>
          <div className="text-[22px] font-black text-destructive">-Rp 40.170.000</div>
          <div className="mt-1 text-[12px] text-success">▼ Turun 1,08% (berkurang)</div>
        </div>
      </div>
      <SectionCard title="Rasio Keuangan">
        <div className="grid grid-cols-2 gap-3">
          {RASIO.map((r) => (
            <div key={r.label} className="rounded-md bg-muted p-3">
              <div className="text-[10.5px] text-muted-foreground">{r.label}</div>
              <div className="text-[20px] font-extrabold" style={{ color: r.valueColor }}>{r.value}</div>
              <div className="text-[10.5px]" style={{ color: r.hintColor }}>{r.hint}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Performa ───────────────────────── */

const PERFORMA: {
  label: string;
  badge: string;
  badgeVariant: "success" | "warning" | "info" | "danger";
  pct: number;
  color: string;
}[] = [
  { label: "Savings Rate Target 30%", badge: "29% · Hampir", badgeVariant: "warning", pct: 29, color: "var(--warning)" },
  { label: "Investment Return Target 12%", badge: "15,4% · Terlampaui ✓", badgeVariant: "success", pct: 100, color: "var(--success)" },
  { label: "Net Worth Growth Target 10%", badge: "8,45% · Perlu Boost", badgeVariant: "info", pct: 84, color: "var(--primary)" },
  { label: "Budget Adherence Target 95%", badge: "88% · Perlu Perbaikan", badgeVariant: "danger", pct: 88, color: "var(--destructive)" },
];

function PerfSection() {
  return (
    <div className="space-y-3.5">
      <SectionCard title="Performa vs Target">
        <div className="flex flex-col gap-2.5">
          {PERFORMA.map((p) => (
            <BarRow
              key={p.label}
              label={p.label}
              right={<StatusBadge variant={p.badgeVariant}>{p.badge}</StatusBadge>}
              value={p.pct}
              color={p.color}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Pajak ───────────────────────── */

function PajakSection() {
  return (
    <div className="space-y-3.5">
      <SectionCard title="Estimasi Pajak 2025">
        <div className="mb-3 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">Penghasilan Kena Pajak (est.)</div>
            <div className="text-[20px] font-extrabold">Rp 216.000.000</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">Estimasi PPh 21</div>
            <div className="text-[20px] font-extrabold text-destructive">Rp 21.600.000</div>
          </div>
        </div>
        <ActItem
          icon="💰"
          iconBg="#DBEAFE"
          iconSize="13px"
          name="PPh 21 (Gaji)"
          cat="Tarif 5%-15%"
          right={<div className="text-[13px] font-bold text-destructive">Rp 18.000.000</div>}
        />
        <ActItem
          icon="📊"
          iconBg="#EDE9FE"
          iconSize="13px"
          name="PPh Dividen"
          cat="Tarif final 10%"
          right={<div className="text-[13px] font-bold text-destructive">Rp 2.100.000</div>}
        />
        <ActItem
          icon="🏦"
          iconBg="#DCFCE7"
          iconSize="13px"
          name="PPh Bunga Deposito"
          cat="Tarif final 20%"
          right={<div className="text-[13px] font-bold text-destructive">Rp 1.500.000</div>}
          last
        />
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Page shell ───────────────────────── */

function LaporanInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = sp.get("tab") ?? "rsum";

  const go = (id: string) => router.push("/laporan?tab=" + id, { scroll: false });

  function renderSection() {
    switch (tab) {
      case "rharian":
        return <HarianSection />;
      case "rbulanan":
        return <BulananSection />;
      case "rtahunan":
        return <TahunanSection />;
      case "rfamily":
        return <FamilySection />;
      case "rbank":
        return <BankSection />;
      case "rdetail":
        return <DetailSection />;
      case "raliran":
        return <AliranSection />;
      case "rpnl":
        return <PnlSection />;
      case "rbalance":
        return <BalanceSection />;
      case "rcashflow":
        return <CashflowSection />;
      case "rkas":
        return <KasSection />;
      case "rinv":
        return <InvSection />;
      case "rasl":
        return <AslSection />;
      case "rperf":
        return <PerfSection />;
      case "rpajak":
        return <PajakSection />;
      case "rsum":
      default:
        return <RingkasanSection go={go} />;
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-muted-foreground">Pantau keuangan dan investasi kamu</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast("📅 Pilih rentang tanggal")}
            className="flex size-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-accent"
            aria-label="Kalender"
          >
            <Calendar className="size-[15px]" />
          </button>
          <select className="rounded-md border bg-card px-3 py-[7px] text-xs text-foreground outline-none">
            <option>April 2025</option>
            <option>Maret 2025</option>
            <option>Februari 2025</option>
          </select>
          <button
            onClick={() => toast("📥 Mengunduh laporan...")}
            className="flex size-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-accent"
            aria-label="Unduh"
          >
            <Download className="size-[15px]" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="hide-scrollbar flex gap-0.5 overflow-x-auto rounded-md border bg-background p-1">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className={
                "whitespace-nowrap rounded px-3.5 py-2 text-[13px] font-semibold transition-colors " +
                (active
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Active section */}
      {renderSection()}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LaporanInner />
    </Suspense>
  );
}
