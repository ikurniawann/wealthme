"use client";

import { useState } from "react";
import { Plus, HandHeart } from "lucide-react";
import { toast } from "sonner";
import { HeroCard, SectionCard, StatusBadge } from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRupiah, parseRupiah, formatAmountInput } from "@/lib/format";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

const NISAB = 102_000_000; // ≈85gr emas

const CATEGORIES = [
  { icon: "🕌", iconBg: "#DCFCE7", label: "Zakat", amount: "Rp 28.500.000", pct: "67% dari total" },
  { icon: "💝", iconBg: "#DBEAFE", label: "Sedekah / Infak", amount: "Rp 8.350.000", pct: "19% dari total" },
  { icon: "🎗️", iconBg: "#FEF9C3", label: "Donasi Sosial", amount: "Rp 4.500.000", pct: "11% dari total" },
  { icon: "🏫", iconBg: "#EDE9FE", label: "Wakaf", amount: "Rp 1.500.000", pct: "3% dari total" },
];

type HistoryItem = {
  icon: string;
  iconBg: string;
  name: string;
  meta: string;
  amount: string;
  lunas?: boolean;
};

const HISTORY: HistoryItem[] = [
  { icon: "🕌", iconBg: "#DCFCE7", name: "Zakat Maal — BAZNAS", meta: "15 Mei 2025 · Zakat", amount: "-Rp 23.787.000", lunas: true },
  { icon: "💝", iconBg: "#DBEAFE", name: "Infak Masjid Al-Ikhlas", meta: "10 Mei 2025 · Sedekah", amount: "-Rp 2.000.000" },
  { icon: "🎗️", iconBg: "#FEF9C3", name: "Donasi Korban Bencana — Dompet Dhuafa", meta: "5 Mei 2025 · Donasi Sosial", amount: "-Rp 1.500.000" },
  { icon: "🍚", iconBg: "#DCFCE7", name: "Zakat Fitrah Keluarga (4 orang)", meta: "28 Mar 2025 · Zakat", amount: "-Rp 200.000", lunas: true },
  { icon: "🏫", iconBg: "#EDE9FE", name: "Wakaf Pendidikan — Rumah Tahfidz", meta: "20 Feb 2025 · Wakaf", amount: "-Rp 1.500.000" },
];

const JENIS_OPTIONS = ["🕌 Zakat Maal", "🍚 Zakat Fitrah", "💝 Sedekah / Infak", "🎗️ Donasi Sosial", "🏫 Wakaf"];
const LEMBAGA_OPTIONS = ["BAZNAS", "Dompet Dhuafa", "Rumah Zakat", "LAZ Lokal / Masjid", "Yayasan Sosial", "Lainnya"];
const SUMBER_OPTIONS = ["🏦 BCA Tahapan ···9010", "🏦 Mandiri ···5586", "💚 GoPay"];

function ZkInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatAmountInput(e.target.value))}
        className={FIELD_CLASS}
      />
    </div>
  );
}

export default function DonationPage() {
  // Zakat Maal calculator state
  const [cash, setCash] = useState("339.450.000");
  const [gold, setGold] = useState("50.000.000");
  const [invest, setInvest] = useState("577.200.000");
  const [debt, setDebt] = useState("15.170.000");

  const harta = parseRupiah(cash) + parseRupiah(gold) + parseRupiah(invest) - parseRupiah(debt);
  const reachedNisab = harta >= NISAB;
  const zakat = reachedNisab ? Math.round(harta * 0.025) : 0;
  const nisabMsg = reachedNisab
    ? "✅ Harta sudah mencapai nisab (setara 85gr emas ≈ Rp 102 jt)"
    : "⚠️ Harta belum mencapai nisab (Rp 102 jt) — belum wajib zakat";

  // Donation modal state
  const [open, setOpen] = useState(false);
  const [jenis, setJenis] = useState(JENIS_OPTIONS[0]);
  const [jumlah, setJumlah] = useState("");
  const [lembaga, setLembaga] = useState(LEMBAGA_OPTIONS[0]);
  const [sumber, setSumber] = useState(SUMBER_OPTIONS[0]);
  const [tanggal, setTanggal] = useState("2025-05-18");

  function openModal(prefillZakat?: boolean) {
    if (prefillZakat) {
      setJenis(JENIS_OPTIONS[0]);
      setJumlah("23.787.000");
    } else {
      setJumlah("");
    }
    setOpen(true);
  }

  function handleSave() {
    setOpen(false);
    toast.success("✅ Donasi berhasil dicatat!");
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard className="gradient-emerald">
        <div className="mb-1.5 flex items-center gap-2 text-xs opacity-85">
          <HandHeart className="size-3.5" /> Total Donasi &amp; Zakat 2025
        </div>
        <div className="text-[30px] font-black tracking-[-1px]">Rp 42.850.000</div>
        <div className="mt-1.5 text-xs opacity-85">18 transaksi · 2,1% dari penghasilan tahunan</div>
        <div className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-[0.12]">🤲</div>
      </HeroCard>

      {/* Subheader + action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-muted-foreground">
          Catat donasi &amp; tunaikan kewajiban zakat
        </div>
        <Button onClick={() => openModal()} className="h-auto px-4 py-2.5">
          <Plus className="size-4" /> Catat Donasi
        </Button>
      </div>

      {/* Breakdown kategori */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {CATEGORIES.map((c) => (
          <Card key={c.label} className="gap-0 p-4">
            <div
              className="mb-2 flex size-[34px] items-center justify-center rounded-[9px] text-[16px]"
              style={{ background: c.iconBg }}
            >
              {c.icon}
            </div>
            <div className="text-[10.5px] text-muted-foreground">{c.label}</div>
            <div className="text-[16px] font-extrabold">{c.amount}</div>
            <div className="text-[10.5px] text-muted-foreground">{c.pct}</div>
          </Card>
        ))}
      </div>

      {/* Kalkulator Zakat */}
      <SectionCard title="🕌 Kalkulator Zakat Maal">
        <div className="mb-3.5 text-xs text-muted-foreground">
          Zakat 2,5% dari total harta yang mencapai nisab &amp; haul (1 tahun)
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <ZkInput label="Tabungan & Kas (Rp)" value={cash} onChange={setCash} />
          <ZkInput label="Emas & Perak (Rp)" value={gold} onChange={setGold} />
          <ZkInput label="Investasi & Saham (Rp)" value={invest} onChange={setInvest} />
          <ZkInput label="Utang Jatuh Tempo (Rp)" value={debt} onChange={setDebt} />
        </div>
        <div className="mt-4 rounded-[12px] border border-primary/15 bg-accent p-4 text-center">
          <div className="text-[11.5px] text-muted-foreground">
            Zakat yang Wajib Ditunaikan (2,5%)
          </div>
          <div className="mt-1 text-[24px] font-black text-primary">{formatRupiah(zakat)}</div>
          <div className="mt-1.5 text-xs text-muted-foreground">{nisabMsg}</div>
        </div>
        <Button onClick={() => openModal(true)} className="mt-3.5 h-auto px-4 py-2.5">
          <HandHeart className="size-4" /> Tunaikan Zakat Sekarang
        </Button>
      </SectionCard>

      {/* Riwayat Donasi */}
      <SectionCard title="Riwayat Donasi & Zakat" bodyClassName="-mt-1">
        {HISTORY.map((h) => (
          <div key={h.name} className="flex items-center gap-3 border-b py-3 last:border-b-0">
            <div
              className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] text-[15px]"
              style={{ background: h.iconBg }}
            >
              {h.icon}
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold">{h.name}</div>
              <div className="text-[11.5px] text-muted-foreground">{h.meta}</div>
            </div>
            <div className="text-right">
              <div className="text-[13.5px] font-bold text-destructive">{h.amount}</div>
              {h.lunas && (
                <StatusBadge variant="success" className="mt-0.5 text-[10px]">
                  Lunas
                </StatusBadge>
              )}
            </div>
          </div>
        ))}
      </SectionCard>

      {/* Insight banner */}
      <div className="flex items-center gap-3 rounded-[14px] border border-primary/20 bg-accent p-4">
        <div className="text-[24px]">📋</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            Donasi bisa jadi pengurang pajak
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Zakat yang dibayarkan ke lembaga resmi (BAZNAS/LAZ) bisa mengurangi penghasilan kena
            pajak. Cek di Tax Center.
          </div>
        </div>
        <button
          onClick={() => toast("Buka Tax Center")}
          className="shrink-0 cursor-pointer text-[12.5px] font-bold text-primary hover:underline"
        >
          Buka Tax Center →
        </button>
      </div>

      {/* Donation modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">Catat Donasi &amp; Zakat</DialogTitle>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Jenis</label>
              <select value={jenis} onChange={(e) => setJenis(e.target.value)} className={FIELD_CLASS}>
                {JENIS_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Jumlah</label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
                <span className="text-[13.5px] text-muted-foreground">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={jumlah}
                  onChange={(e) => setJumlah(formatAmountInput(e.target.value))}
                  placeholder="0"
                  className="w-full bg-transparent text-[13.5px] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Lembaga / Penerima</label>
              <select value={lembaga} onChange={(e) => setLembaga(e.target.value)} className={FIELD_CLASS}>
                {LEMBAGA_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Sumber Dana</label>
              <select value={sumber} onChange={(e) => setSumber(e.target.value)} className={FIELD_CLASS}>
                {SUMBER_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Tanggal</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            <div className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5">
              <span className="text-[13px] text-emerald-700 dark:text-emerald-300">ℹ️</span>
              <span className="text-xs text-emerald-700 dark:text-emerald-300">
                Zakat ke lembaga resmi bisa jadi pengurang pajak penghasilan
              </span>
            </div>

            <Button onClick={handleSave} className="w-full">
              <HandHeart className="size-4" /> Simpan Catatan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
