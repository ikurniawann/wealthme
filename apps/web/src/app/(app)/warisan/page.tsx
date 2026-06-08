"use client";

import { useState } from "react";
import { Plus, Save, Scroll, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HeroCard, StatusBadge } from "@/components/wm";
import { formatAmountInput } from "@/lib/format";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

type Category = { icon: string; iconBg: string; label: string; amount: string; pct: string };

const CATEGORIES: Category[] = [
  { icon: "🏠", iconBg: "#FEF9C3", label: "Aset / Properti", amount: "Rp 1.250.000.000", pct: "58% dari total" },
  { icon: "💵", iconBg: "#DCFCE7", label: "Cash / Tunai", amount: "Rp 385.300.000", pct: "18% dari total" },
  { icon: "📜", iconBg: "#DBEAFE", label: "Surat Berharga", amount: "Rp 310.000.000", pct: "14% dari total" },
  { icon: "📈", iconBg: "#EDE9FE", label: "Saham", amount: "Rp 200.000.000", pct: "9% dari total" },
];

type Heir = { initials: string; name: string; gradient: string; badge?: string };

const HEIRS: Heir[] = [
  { initials: "IA", name: "Irfan Arsandi", gradient: "linear-gradient(135deg,var(--primary),var(--purple))", badge: "Pewaris" },
  { initials: "SA", name: "Siti Arsandi", gradient: "linear-gradient(135deg,#F97316,#FBBF24)" },
  { initials: "BA", name: "Budi Arsandi", gradient: "linear-gradient(135deg,#10B981,#06B6D4)" },
  { initials: "RA", name: "Rina Arsandi", gradient: "linear-gradient(135deg,#8B5CF6,#EC4899)" },
];

type Asset = { icon: string; iconBg: string; name: string; detail: string; amount: string };

type AssetGroup = { title: string; assets: Asset[] };

const ASSET_GROUPS: AssetGroup[] = [
  {
    title: "🏠 Aset / Properti",
    assets: [
      { icon: "🏡", iconBg: "#FEF9C3", name: "Rumah Utama — Bandung", detail: "SHM No. 1234 · Luas 350m²", amount: "Rp 850.000.000" },
      { icon: "🏢", iconBg: "#FEF9C3", name: "Apartemen Kelapa Gading", detail: "SHM Sarusun · 2BR", amount: "Rp 250.000.000" },
      { icon: "🚗", iconBg: "#DBEAFE", name: "Kendaraan — Toyota Fortuner", detail: "BPKB · Tahun 2023", amount: "Rp 150.000.000" },
    ],
  },
  {
    title: "💵 Cash / Tunai",
    assets: [
      { icon: "🏦", iconBg: "#DCFCE7", name: "Deposito BCA", detail: "Jatuh tempo Des 2025 · Bunga 5%", amount: "Rp 250.000.000" },
      { icon: "💰", iconBg: "#DCFCE7", name: "Tabungan Warisan", detail: "Rekening khusus · Mandiri", amount: "Rp 135.300.000" },
    ],
  },
  {
    title: "📜 Surat Berharga",
    assets: [
      { icon: "🏛️", iconBg: "#DBEAFE", name: "Obligasi Negara ORI024", detail: "Jatuh tempo 2027 · Kupon 6,1%", amount: "Rp 200.000.000" },
      { icon: "🥇", iconBg: "#FEF3C7", name: "Emas Batangan Antam", detail: "100 gram · Sertifikat resmi", amount: "Rp 110.000.000" },
    ],
  },
  {
    title: "📈 Saham",
    assets: [
      { icon: "📊", iconBg: "#EDE9FE", name: "Portofolio Saham Blue Chip", detail: "BBCA, TLKM, ASII · Sekuritas Mandiri", amount: "Rp 140.000.000" },
      { icon: "📈", iconBg: "#EDE9FE", name: "Reksa Dana Saham", detail: "Bibit · Jangka panjang", amount: "Rp 60.000.000" },
    ],
  },
];

function CardTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3.5 text-[13.5px] font-bold text-muted-foreground">{children}</div>;
}

function AssetRow({ asset, last }: { asset: Asset; last: boolean }) {
  return (
    <div className={"flex items-center gap-2.5 py-3 " + (last ? "" : "border-b")}>
      <div
        className="flex size-[36px] shrink-0 items-center justify-center rounded-[10px] text-[15px]"
        style={{ background: asset.iconBg }}
      >
        {asset.icon}
      </div>
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">{asset.name}</div>
        <div className="text-[11.5px] text-muted-foreground">{asset.detail}</div>
      </div>
      <div className="text-right text-[13.5px] font-bold">{asset.amount}</div>
    </div>
  );
}

export default function WarisanPage() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("🏠 Aset / Properti");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [document, setDocument] = useState("");
  const [visible, setVisible] = useState(true);

  function resetForm() {
    setCategory("🏠 Aset / Properti");
    setName("");
    setValue("");
    setDocument("");
    setVisible(true);
  }

  function handleSave() {
    setOpen(false);
    resetForm();
    toast.success("✅ Aset warisan ditambahkan!");
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard className="gradient-wealth">
        <div className="mb-1.5 flex items-center gap-2 text-[12px] opacity-85">
          <Scroll className="size-3.5" /> Total Nilai Warisan
        </div>
        <div className="text-[30px] font-black tracking-[-1px]">Rp 2.145.300.000</div>
        <div className="mt-1.5 text-[12px] opacity-85">
          Dialokasikan untuk 4 ahli waris · Terakhir diperbarui 18 Mei 2025
        </div>
        <div className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-10">🏛️</div>
      </HeroCard>

      {/* Header action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-muted-foreground">
          Catatan aset warisan yang dapat dilihat seluruh ahli waris
        </div>
        <Button onClick={() => setOpen(true)} className="h-auto px-4 py-[9px]">
          <Plus className="size-4" /> Tambah Aset Warisan
        </Button>
      </div>

      {/* Breakdown 4 kategori */}
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

      {/* Ahli Waris */}
      <Card className="gap-0 p-5">
        <CardTitle>Ahli Waris yang Dapat Mengakses</CardTitle>
        <div className="flex flex-wrap gap-2.5">
          {HEIRS.map((h) => (
            <div
              key={h.initials}
              className="flex items-center gap-2 rounded-[20px] bg-background px-3 py-2"
            >
              <div
                className="flex size-[28px] items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: h.gradient }}
              >
                {h.initials}
              </div>
              <span className="text-[12px] font-semibold">{h.name}</span>
              {h.badge && (
                <StatusBadge variant="info" className="text-[9px]">
                  {h.badge}
                </StatusBadge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Daftar Aset per kategori */}
      {ASSET_GROUPS.map((group) => (
        <Card key={group.title} className="gap-0 p-5">
          <CardTitle>{group.title}</CardTitle>
          {group.assets.map((asset, i) => (
            <AssetRow key={asset.name} asset={asset} last={i === group.assets.length - 1} />
          ))}
        </Card>
      ))}

      {/* Insight banner */}
      <div className="flex items-center gap-3 rounded-[14px] border border-primary/20 bg-accent p-4">
        <div className="text-[24px]">🛡️</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            Catatan Warisan Aman & Transparan
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            Seluruh ahli waris dapat melihat daftar ini kapan saja. Tambahkan dokumen pendukung
            (sertifikat, BPKB, polis) agar lebih lengkap.
          </div>
        </div>
        <button
          onClick={() => toast("📎 Upload dokumen warisan")}
          className="shrink-0 cursor-pointer text-[12.5px] font-bold text-primary hover:underline"
        >
          Upload Dokumen →
        </button>
      </div>

      {/* Tambah Aset Warisan modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">Tambah Aset Warisan</DialogTitle>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={FIELD_CLASS}
              >
                <option>🏠 Aset / Properti</option>
                <option>💵 Cash / Tunai</option>
                <option>📜 Surat Berharga</option>
                <option>📈 Saham</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Nama Aset</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: Rumah Utama, Deposito BCA..."
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Nilai Estimasi</label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
                <span className="text-[13.5px] text-muted-foreground">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => setValue(formatAmountInput(e.target.value))}
                  placeholder="0"
                  className="w-full bg-transparent text-[13.5px] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                No. Dokumen / Keterangan
              </label>
              <input
                type="text"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="cth: SHM No. 1234, BPKB, Sertifikat..."
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Dokumen Pendukung</label>
              <button
                type="button"
                onClick={() => toast("📎 Pilih file dokumen")}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-dashed p-[18px] text-center transition-colors hover:bg-accent/50"
              >
                <CloudUpload className="mx-auto mb-1.5 size-[22px] text-primary" />
                <div className="text-[12px] text-muted-foreground">
                  Upload sertifikat, BPKB, atau polis (PDF/JPG)
                </div>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Akses Ahli Waris</label>
              <div className="rounded-md border bg-card px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold">
                      Terlihat oleh semua ahli waris
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      Siti, Budi, Rina dapat melihat
                    </div>
                  </div>
                  <Switch checked={visible} onCheckedChange={setVisible} />
                </div>
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">
              <Save className="size-4" /> Simpan Aset Warisan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
