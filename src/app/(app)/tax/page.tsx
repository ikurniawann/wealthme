"use client";

import { useState } from "react";
import { Send, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { HeroCard, SectionCard, CardLink } from "@/components/wm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRupiah, parseRupiah, formatNumber } from "@/lib/format";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

const PTKP_OPTIONS = [
  { value: 54000000, label: "TK/0 (Lajang)" },
  { value: 58500000, label: "K/0 (Kawin)" },
  { value: 63000000, label: "K/1 (Kawin, 1 anak)" },
  { value: 67500000, label: "K/2 (Kawin, 2 anak)" },
  { value: 72000000, label: "K/3 (Kawin, 3 anak)" },
];

// [limit, rate] progressive brackets (UU HPP)
const BRACKETS: [number, number][] = [
  [60_000_000, 0.05],
  [190_000_000, 0.15],
  [250_000_000, 0.25],
  [4_500_000_000, 0.3],
  [Infinity, 0.35],
];

// Display rows for the progressive breakdown table (cumulative-range labels)
const BRACKET_ROWS = [
  { label: "0 – 60 jt", rate: "5%", idx: 0 },
  { label: "60 – 250 jt", rate: "15%", idx: 1 },
  { label: "250 – 500 jt", rate: "25%", idx: 2 },
  { label: "> 5 M", rate: "35%", idx: 4 },
];

type Doc = { icon: string; iconBg: string; name: string; meta: string };

const DOCS: Doc[] = [
  { icon: "📄", iconBg: "#DBEAFE", name: "Bukti Potong 1721-A1 (2024)", meta: "dari pemberi kerja" },
  { icon: "✅", iconBg: "#DCFCE7", name: "Bukti Lapor SPT 2024 (BPE)", meta: "NTTE: 123456789" },
  { icon: "🧾", iconBg: "#FEF9C3", name: "Bukti Setor Zakat (BAZNAS)", meta: "Pengurang penghasilan bruto" },
];

export default function TaxPage() {
  const [gross, setGross] = useState("300.000.000");
  const [ptkp, setPtkp] = useState(54000000);
  const [zakat, setZakat] = useState("23.787.000");

  const grossN = parseRupiah(gross);
  const zakatN = parseRupiah(zakat);

  const jabatan = Math.min(grossN * 0.05, 6_000_000);
  let pkp = Math.max(0, grossN - jabatan - ptkp - zakatN);
  pkp = Math.floor(pkp / 1000) * 1000;

  // Per-layer tax, tracked by bracket index for the breakdown table
  const layerTax: number[] = new Array(BRACKETS.length).fill(0);
  let tax = 0;
  let sisa = pkp;
  for (let i = 0; i < BRACKETS.length; i++) {
    if (sisa <= 0) break;
    const [lim, rate] = BRACKETS[i];
    const ken = Math.min(sisa, lim);
    const t = ken * rate;
    layerTax[i] = t;
    tax += t;
    sisa -= ken;
  }
  tax = Math.round(tax);
  const effRate = grossN > 0 ? (tax / grossN * 100).toFixed(1).replace(".", ",") + "%" : "0%";

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard className="gradient-wealth">
        <div className="mb-1.5 flex items-center gap-2 text-xs opacity-85">
          <FileText className="size-3.5" /> Estimasi Pajak Terutang 2025
        </div>
        <div className="text-[30px] font-black tracking-[-1px]">Rp 18.240.000</div>
        <div className="mt-1.5 text-xs opacity-85">
          PPh 21 · Status: WP Orang Pribadi · NPWP terdaftar
        </div>
        <div className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-[0.12]">🧾</div>
      </HeroCard>

      {/* Status SPT */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">Status SPT Tahunan 2024</div>
          <div className="text-[16px] font-extrabold text-success">✅ Sudah Lapor</div>
          <div className="text-[10.5px] text-muted-foreground">31 Mar 2025</div>
        </Card>
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">SPT 2025</div>
          <div className="text-[16px] font-extrabold text-warning">⏳ Belum Lapor</div>
          <div className="text-[10.5px] text-muted-foreground">Deadline 31 Mar 2026</div>
        </Card>
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">PPh Sudah Dipotong</div>
          <div className="text-[16px] font-extrabold text-primary">Rp 15.000.000</div>
          <div className="text-[10.5px] text-muted-foreground">via pemberi kerja</div>
        </Card>
      </div>

      {/* Kalkulator PPh 21 */}
      <SectionCard title="🧮 Kalkulator PPh 21 (Pribadi)">
        <div className="mb-3.5 text-xs text-muted-foreground">
          Hitung estimasi pajak penghasilan berdasarkan tarif progresif UU HPP
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
              Penghasilan Bruto/Tahun (Rp)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={gross}
              onChange={(e) => setGross(e.target.value === "" ? "" : formatNumber(parseRupiah(e.target.value)))}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">Status</label>
            <select
              value={ptkp}
              onChange={(e) => setPtkp(Number(e.target.value))}
              className={FIELD_CLASS}
            >
              {PTKP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
              Biaya Jabatan (otomatis)
            </label>
            <input type="text" value={formatNumber(jabatan)} disabled className={FIELD_CLASS + " opacity-70"} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
              Zakat/Donasi (pengurang)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={zakat}
              onChange={(e) => setZakat(e.target.value === "" ? "" : formatNumber(parseRupiah(e.target.value)))}
              className={FIELD_CLASS}
            />
          </div>
        </div>
        <div className="mt-4 rounded-[12px] border border-primary/15 bg-accent p-4 text-center">
          <div className="text-[11.5px] text-muted-foreground">Estimasi PPh 21 Terutang/Tahun</div>
          <div className="mt-1 text-[24px] font-black text-primary">{formatRupiah(tax)}</div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            PKP: <strong className="text-primary">{formatRupiah(pkp)}</strong> · Efektif{" "}
            <strong>{effRate}</strong>
          </div>
        </div>
      </SectionCard>

      {/* Breakdown Tarif Progresif */}
      <SectionCard title="Rincian Tarif Progresif (UU HPP)">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-semibold text-muted-foreground">Lapisan PKP</th>
                <th className="py-2 text-center font-semibold text-muted-foreground">Tarif</th>
                <th className="py-2 text-right font-semibold text-muted-foreground">Pajak</th>
              </tr>
            </thead>
            <tbody>
              {BRACKET_ROWS.map((row) => {
                const t = layerTax[row.idx];
                const muted = t <= 0;
                return (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <td className={"py-2 " + (muted ? "text-muted-foreground" : "")}>{row.label}</td>
                    <td className={"py-2 text-center " + (muted ? "text-muted-foreground" : "")}>
                      {row.rate}
                    </td>
                    <td
                      className={"mono py-2 text-right " + (muted ? "text-muted-foreground" : "")}
                    >
                      {formatRupiah(Math.round(t))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Dokumen Pajak */}
      <SectionCard
        title="Dokumen Pajak"
        action={<CardLink onClick={() => toast("📤 Upload dokumen")}>+ Upload</CardLink>}
        bodyClassName="-mt-1"
      >
        {DOCS.map((d) => (
          <div key={d.name} className="flex items-center gap-3 border-b py-3 last:border-b-0">
            <div
              className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] text-[15px]"
              style={{ background: d.iconBg }}
            >
              {d.icon}
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold">{d.name}</div>
              <div className="text-[11.5px] text-muted-foreground">{d.meta}</div>
            </div>
            <button
              onClick={() => toast("Mengunduh...")}
              className="shrink-0 cursor-pointer text-primary"
              aria-label={`Unduh ${d.name}`}
            >
              <Download className="size-4" />
            </button>
          </div>
        ))}
      </SectionCard>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2.5">
        <Button
          onClick={() => toast("🌐 Membuka e-Filing DJP Online...")}
          className="h-auto min-w-[160px] flex-1 py-2.5"
        >
          <Send className="size-4" /> Lapor SPT Tahunan
        </Button>
        <Button
          variant="outline"
          onClick={() => toast("📊 Membuat laporan pajak...")}
          className="h-auto min-w-[160px] flex-1 py-2.5"
        >
          <FileText className="size-4" /> Unduh Ringkasan
        </Button>
      </div>
    </div>
  );
}
