"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  CloudUpload,
  FileText,
  FileSpreadsheet,
  Lightbulb,
  RotateCw,
  Save,
  Bot,
  X,
  ChevronRight,
} from "lucide-react";
import { SectionCard, StatusBadge, ProgressBar, CardLink } from "@/components/wm";

/* ─────────────────────────── Static data ─────────────────────────── */

const STEPS = [
  { num: 1, label: "Upload", sub: "Upload dokumen" },
  { num: 2, label: "Pindai", sub: "AI membaca data" },
  { num: 3, label: "Cocokkan", sub: "Samakan transaksi" },
  { num: 4, label: "Selesai", sub: "Simpan hasil" },
] as const;

const SCAN_STEPS = [
  { t: 400, pct: 15, msg: "Membaca header dokumen..." },
  { t: 900, pct: 32, msg: "Mendeteksi format rekening koran BCA..." },
  { t: 1500, pct: 55, msg: "Mengekstrak 152 baris transaksi..." },
  { t: 2100, pct: 72, msg: "Mencocokkan dengan data WealthMe..." },
  { t: 2700, pct: 88, msg: "Menganalisa perbedaan..." },
  { t: 3200, pct: 100, msg: "Selesai! 152 transaksi diproses." },
] as const;

const SUPPORTED_BANKS = [
  { code: "BCA", name: "BCA", bg: "#0061AF", color: "#fff" },
  { code: "MDR", name: "Mandiri", bg: "#F9A01B", color: "#000" },
  { code: "BNI", name: "BNI", bg: "#FF6600", color: "#fff" },
  { code: "BRI", name: "BRI", bg: "#E31937", color: "#fff" },
  { code: "CMB", name: "CIMB", bg: "#C8282E", color: "#fff" },
  { code: "PMT", name: "Permata", bg: "#E8002D", color: "#fff" },
] as const;

type MatchStatus = "ok" | "warn" | "err";
type MatchRow = {
  left: { meta: string; amount: string; amountClass: string };
  status: MatchStatus;
  right: {
    meta: string;
    metaClass: string;
    amount: string;
    amountClass: string;
    cellClass?: string;
  };
};

const MATCH_ROWS: MatchRow[] = [
  {
    left: { meta: "18 Mei · Alfamart", amount: "-Rp 58.000", amountClass: "text-destructive" },
    status: "ok",
    right: {
      meta: "18 Mei · Belanja",
      metaClass: "text-muted-foreground",
      amount: "-Rp 58.000",
      amountClass: "text-destructive",
    },
  },
  {
    left: { meta: "17 Mei · Transfer Masuk", amount: "+Rp 5.000.000", amountClass: "text-success" },
    status: "ok",
    right: {
      meta: "17 Mei · Pemasukan",
      metaClass: "text-muted-foreground",
      amount: "+Rp 5.000.000",
      amountClass: "text-success",
    },
  },
  {
    left: { meta: "15 Mei · KK BCA", amount: "-Rp 1.250.000", amountClass: "text-destructive" },
    status: "warn",
    right: {
      meta: "Beda Kategori",
      metaClass: "text-warning",
      amount: "-Rp 1.250.000",
      amountClass: "text-destructive",
      cellClass: "bg-warning-soft border-amber-300",
    },
  },
  {
    left: { meta: "14 Mei · Shopee", amount: "-Rp 450.000", amountClass: "text-destructive" },
    status: "err",
    right: {
      meta: "Tidak Ditemukan",
      metaClass: "text-destructive",
      amount: "—",
      amountClass: "text-muted-foreground",
      cellClass: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
    },
  },
  {
    left: { meta: "13 Mei · GoPay TopUp", amount: "-Rp 200.000", amountClass: "text-destructive" },
    status: "ok",
    right: {
      meta: "13 Mei · Top Up e-Wallet",
      metaClass: "text-muted-foreground",
      amount: "-Rp 200.000",
      amountClass: "text-destructive",
    },
  },
];

/* ─────────────────────────── Stepper ─────────────────────────── */

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-5 flex items-center">
      {STEPS.map((s, i) => {
        const done = step > s.num;
        const active = step === s.num;
        return (
          <React.Fragment key={s.num}>
            <div className="flex flex-1 flex-col items-center text-center">
              <div
                className={[
                  "flex size-9 items-center justify-center rounded-full text-[14px] font-bold transition-colors",
                  done
                    ? "bg-success text-white"
                    : active
                      ? "bg-primary text-white ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {done ? <Check className="size-[18px]" /> : s.num}
              </div>
              <div
                className={[
                  "mt-1.5 text-[12px] font-bold",
                  active || done ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {s.label}
                <span className="block text-[10px] font-normal text-muted-foreground">
                  {s.sub}
                </span>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "mx-1 mb-7 h-[2px] flex-1 transition-colors",
                  step > s.num ? "bg-success" : "bg-border",
                ].join(" ")}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Status icon ─────────────────────────── */

function MatchIcon({ status }: { status: MatchStatus }) {
  const cls =
    status === "ok"
      ? "bg-success"
      : status === "warn"
        ? "bg-warning"
        : "bg-destructive";
  return (
    <div className="flex w-9 flex-shrink-0 items-center justify-center">
      <div className={`flex size-6 items-center justify-center rounded-full ${cls}`}>
        {status === "ok" && <Check className="size-[13px] text-white" />}
        {status === "warn" && (
          <span className="text-[12px] font-bold leading-none text-white">!</span>
        )}
        {status === "err" && <X className="size-[13px] text-white" />}
      </div>
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function RekonsiliasiPage() {
  const [step, setStep] = React.useState(1);
  const [progress, setProgress] = React.useState(0);
  const [label, setLabel] = React.useState("Memulai pemindaian...");
  const [scanLog, setScanLog] = React.useState<string[]>([]);
  const [showTips, setShowTips] = React.useState(true);

  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  React.useEffect(() => clearTimers, [clearTimers]);

  const goto = React.useCallback(
    (next: number) => {
      clearTimers();
      setStep(next);
    },
    [clearTimers],
  );

  // Step 1: simulate file upload then advance.
  function simulateUpload() {
    toast("📂 File BCA Rekening Koran Mei 2025.pdf dipilih");
    const t = setTimeout(() => setStep(2), 800);
    timersRef.current.push(t);
  }

  // Step 2: run the scan whenever we enter it.
  React.useEffect(() => {
    if (step !== 2) return;
    // Reset the scan UI each time we (re)enter step 2 before the timed simulation runs.
    /* eslint-disable react-hooks/set-state-in-effect */
    setProgress(0);
    setLabel("Memulai pemindaian...");
    setScanLog([]);
    /* eslint-enable react-hooks/set-state-in-effect */

    for (const s of SCAN_STEPS) {
      const t = setTimeout(() => {
        setProgress(s.pct);
        setLabel(s.msg);
        setScanLog((prev) => [...prev, s.msg]);
        if (s.pct === 100) {
          const adv = setTimeout(() => setStep(3), 600);
          timersRef.current.push(adv);
        }
      }, s.t);
      timersRef.current.push(t);
    }

    return clearTimers;
  }, [step, clearTimers]);

  return (
    <div>
      <Stepper step={step} />

      {/* ─── Step 1: Upload ─── */}
      {step === 1 && (
        <div className="space-y-4">
          <SectionCard>
            <div className="mb-1 text-[15px] font-extrabold">
              Upload Rekening Koran / Rekon Bank
            </div>
            <div className="mb-[18px] text-[12.5px] text-muted-foreground">
              Upload file PDF, Excel, atau CSV dari bank Anda.
            </div>

            <button
              type="button"
              onClick={simulateUpload}
              className="w-full cursor-pointer rounded-[14px] border-2 border-dashed border-primary/40 bg-accent/40 px-5 py-8 text-center transition-colors hover:border-primary hover:bg-accent"
            >
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent">
                <CloudUpload className="size-7 text-primary" />
              </div>
              <div className="mb-1.5 text-[15px] font-bold text-primary-strong">
                Seret &amp; lepas file di sini
              </div>
              <div className="mb-4 text-[12.5px] text-muted-foreground">atau</div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-[11px] text-[13.5px] font-bold text-white">
                <ArrowUpFromLine className="size-4" /> Pilih File
              </div>
              <div className="mt-3.5 text-[11.5px] text-muted-foreground">
                Format yang didukung: PDF, Excel (.xlsx, .xls), CSV
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                Maksimal ukuran file: 20MB
              </div>
            </button>
          </SectionCard>

          {/* Supported banks */}
          <SectionCard
            title="Bank yang Didukung"
            action={<CardLink>Lihat semua</CardLink>}
          >
            <div className="flex flex-wrap gap-2.5">
              {SUPPORTED_BANKS.map((b) => (
                <div
                  key={b.code}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold"
                >
                  <div
                    className="flex h-6 min-w-9 items-center justify-center rounded px-1 text-[10px] font-extrabold"
                    style={{ background: b.bg, color: b.color }}
                  >
                    {b.code}
                  </div>
                  {b.name}
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold text-muted-foreground">
                ••• Lainnya
              </div>
            </div>
          </SectionCard>

          {/* Recent documents */}
          <SectionCard
            title="Dokumen Terbaru"
            action={<CardLink>Lihat Riwayat</CardLink>}
          >
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50"
              >
                <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#E53E3E" }}>
                  <FileText className="size-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">
                    BCA Rekening Koran Mei 2025.pdf
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    BCA · 123-456-7890 · Diupload 18 Mei 2025, 14:32
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <StatusBadge variant="success" className="mb-[3px] text-[10px]">
                    Berhasil dipindai
                  </StatusBadge>
                  <div className="text-[11px] text-muted-foreground">152 transaksi</div>
                </div>
                <ChevronRight className="size-3 flex-shrink-0 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50"
              >
                <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#217346" }}>
                  <FileSpreadsheet className="size-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">
                    Mandiri Rekon April 2025.xlsx
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    Mandiri · 987-654-3210 · Diupload 12 Mei 2025, 09:15
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <StatusBadge variant="info" className="mb-[3px] text-[10px]">
                    Siap dicocokkan
                  </StatusBadge>
                  <div className="text-[11px] text-muted-foreground">98 transaksi</div>
                </div>
                <ChevronRight className="size-3 flex-shrink-0 text-muted-foreground" />
              </button>
            </div>
          </SectionCard>

          {/* Tips */}
          {showTips && (
            <div className="relative rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3.5 dark:border-amber-900 dark:bg-amber-950/30">
              <button
                type="button"
                onClick={() => setShowTips(false)}
                aria-label="Tutup"
                className="absolute right-3 top-2.5 cursor-pointer text-[16px] text-muted-foreground"
              >
                ×
              </button>
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 size-4 flex-shrink-0 text-warning" />
                <div>
                  <div className="mb-1.5 text-[12.5px] font-bold">Tips Rekonsiliasi</div>
                  <div className="flex flex-col gap-1 text-[12px] text-foreground/80">
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-success" />
                      Pastikan periode tanggal pada dokumen sesuai
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-success" />
                      Hapus halaman yang tidak berisi transaksi
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-success" />
                      Gunakan file asli tanpa edit agar hasil lebih akurat
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Lanjutkan ke Pencocokan <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {/* ─── Step 2: Scanning ─── */}
      {step === 2 && (
        <SectionCard className="text-center" bodyClassName="px-2 py-3">
          <div
            className="mx-auto mb-4 flex size-[72px] items-center justify-center rounded-full border-[3px] border-primary"
            style={{ background: "var(--accent)" }}
          >
            <Bot className="size-7 text-primary" />
          </div>
          <div className="mb-1.5 text-[16px] font-extrabold">
            AI Sedang Membaca Dokumen
          </div>
          <div className="mb-6 text-[12.5px] text-muted-foreground">
            WealthMe AI mengekstrak data transaksi dari rekening koran...
          </div>

          <ProgressBar
            value={progress}
            height={10}
            color="linear-gradient(90deg,var(--primary),var(--brand-purple))"
            className="mb-2.5"
          />
          <div className="mb-5 text-[12px] text-muted-foreground">{label}</div>

          <div className="flex flex-col gap-2 text-left">
            {scanLog.map((msg, i) => (
              <div key={i} className="flex items-center gap-2 text-[12.5px]">
                <Check className="size-4 flex-shrink-0 text-success" />
                <span>{msg}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ─── Step 3: Matching ─── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="flex flex-col items-center gap-0.5 rounded-lg bg-success-soft py-3 text-emerald-700 dark:text-emerald-300">
              <div className="text-[22px] font-black">143</div>
              <div className="text-[11px] font-semibold">✅ Cocok</div>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg bg-warning-soft py-3 text-amber-700 dark:text-amber-300">
              <div className="text-[22px] font-black">7</div>
              <div className="text-[11px] font-semibold">⚠️ Perlu Review</div>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg bg-red-100 py-3 text-red-700 dark:bg-red-950 dark:text-red-300">
              <div className="text-[22px] font-black">2</div>
              <div className="text-[11px] font-semibold">❌ Tidak Cocok</div>
            </div>
          </div>

          <SectionCard
            title="Hasil Pencocokan — BCA Mei 2025"
            action={<StatusBadge variant="success">152 Transaksi</StatusBadge>}
          >
            {/* Header */}
            <div className="mb-2 flex text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
              <div className="flex-1 px-3">Rekening Koran</div>
              <div className="w-9" />
              <div className="flex-1 px-3">Sistem WealthMe</div>
            </div>

            <div className="space-y-2">
              {MATCH_ROWS.map((row, i) => (
                <div key={i} className="flex items-stretch">
                  <div className="flex-1 rounded-lg border bg-card px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">{row.left.meta}</div>
                    <div className={`text-[13px] font-bold ${row.left.amountClass}`}>
                      {row.left.amount}
                    </div>
                  </div>
                  <MatchIcon status={row.status} />
                  <div
                    className={`flex-1 rounded-lg border bg-card px-3 py-2 ${row.right.cellClass ?? ""}`}
                  >
                    <div className={`text-[11px] ${row.right.metaClass}`}>{row.right.meta}</div>
                    <div className={`text-[13px] font-bold ${row.right.amountClass}`}>
                      {row.right.amount}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* AI suggestion */}
          <div
            className="flex items-center gap-3 rounded-[14px] border border-indigo-200 px-4 py-3.5 dark:border-indigo-900"
            style={{ background: "var(--accent)" }}
          >
            <Bot className="size-5 flex-shrink-0 text-primary" />
            <div className="flex-1">
              <div className="text-[13px] font-bold text-primary-strong">
                AI menemukan 1 transaksi tidak tercatat
              </div>
              <div className="text-[12px] text-foreground/80">
                Belanja Shopee Rp 450.000 (14 Mei) belum ada di WealthMe. Tambahkan
                otomatis?
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                toast.success("✅ Transaksi ditambahkan otomatis!");
                setStep(4);
              }}
              className="flex-shrink-0 cursor-pointer whitespace-nowrap rounded-lg bg-primary px-3.5 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
            >
              Tambah
            </button>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => goto(1)}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] bg-background px-4 py-2.5 text-[13.5px] font-bold transition-colors hover:bg-accent"
            >
              <ArrowLeft className="size-4" /> Kembali
            </button>
            <button
              type="button"
              onClick={() => goto(4)}
              className="flex flex-[2] cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <Save className="size-4" /> Simpan Hasil Rekonsiliasi
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Done ─── */}
      {step === 4 && (
        <SectionCard className="text-center" bodyClassName="px-2 py-6">
          <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-success-soft">
            <CheckCircle2 className="size-9 text-success" />
          </div>
          <div className="mb-1.5 text-[18px] font-black text-success">
            Rekonsiliasi Selesai!
          </div>
          <div className="mb-6 text-[13px] text-muted-foreground">
            BCA Rekening Koran Mei 2025 berhasil dicocokkan
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3.5 text-left">
              <div className="text-[11px] text-muted-foreground">Total Transaksi</div>
              <div className="text-[20px] font-black">152</div>
            </div>
            <div className="rounded-lg bg-success-soft p-3.5 text-left text-emerald-700 dark:text-emerald-300">
              <div className="text-[11px]">Cocok</div>
              <div className="text-[20px] font-black">143</div>
            </div>
            <div className="rounded-lg bg-warning-soft p-3.5 text-left text-amber-700 dark:text-amber-300">
              <div className="text-[11px]">Perlu Review</div>
              <div className="text-[20px] font-black">7</div>
            </div>
            <div className="rounded-lg bg-red-100 p-3.5 text-left text-red-700 dark:bg-red-950 dark:text-red-300">
              <div className="text-[11px]">Tidak Cocok</div>
              <div className="text-[20px] font-black">2</div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => toast("📥 Mengunduh laporan PDF...")}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] bg-background px-4 py-2.5 text-[13.5px] font-bold transition-colors hover:bg-accent"
            >
              <FileText className="size-4" /> Unduh PDF
            </button>
            <button
              type="button"
              onClick={() => toast("📊 Mengunduh Excel...")}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] bg-background px-4 py-2.5 text-[13.5px] font-bold transition-colors hover:bg-accent"
            >
              <FileSpreadsheet className="size-4" /> Unduh Excel
            </button>
            <button
              type="button"
              onClick={() => goto(1)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <RotateCw className="size-4" /> Rekon Baru
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
