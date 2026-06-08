"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, ProgressBar } from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatAmountInput } from "@/lib/format";

type BudgetCategory = {
  icon: string;
  iconBg: string;
  name: string;
  amounts: string;
  pct: number;
  barWidth: number;
  pctLabel: string;
  pctColor: string;
  barColor: string;
};

const INITIAL_CATEGORIES: BudgetCategory[] = [
  {
    icon: "🏠",
    iconBg: "#EEF2FF",
    name: "Kebutuhan Pokok",
    amounts: "Rp 8.069.600 dari Rp 9.000.000",
    pct: 90,
    barWidth: 90,
    pctLabel: "90%",
    pctColor: "var(--warning)",
    barColor: "var(--warning)",
  },
  {
    icon: "😊",
    iconBg: "#DCFCE7",
    name: "Gaya Hidup",
    amounts: "Rp 4.585.000 dari Rp 4.000.000",
    pct: 115,
    barWidth: 100,
    pctLabel: "115% ⚠️",
    pctColor: "var(--destructive)",
    barColor: "var(--destructive)",
  },
  {
    icon: "🚗",
    iconBg: "#FEF9C3",
    name: "Transportasi",
    amounts: "Rp 2.200.000 dari Rp 3.000.000",
    pct: 73,
    barWidth: 73,
    pctLabel: "73%",
    pctColor: "var(--success)",
    barColor: "var(--success)",
  },
  {
    icon: "🏥",
    iconBg: "#FEE2E2",
    name: "Kesehatan",
    amounts: "Rp 1.467.000 dari Rp 2.000.000",
    pct: 73,
    barWidth: 73,
    pctLabel: "73%",
    pctColor: "var(--success)",
    barColor: "var(--success)",
  },
  {
    icon: "✈️",
    iconBg: "#CFFAFE",
    name: "Liburan / Holiday",
    amounts: "Rp 850.000 dari Rp 2.500.000",
    pct: 34,
    barWidth: 34,
    pctLabel: "34%",
    pctColor: "var(--success)",
    barColor: "var(--brand-cyan)",
  },
];

const TRAILING_CATEGORY: BudgetCategory = {
  icon: "📦",
  iconBg: "#F3F4F6",
  name: "Lainnya",
  amounts: "Rp 2.018.400 dari Rp 2.000.000",
  pct: 101,
  barWidth: 100,
  pctLabel: "101% ⚠️",
  pctColor: "var(--warning)",
  barColor: "var(--warning)",
};

const ICON_OPTIONS = ["🎓", "🎨", "🎁", "🐶", "👶", "📚", "💪", "🙏"];

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

function BudgetItem({ cat }: { cat: BudgetCategory }) {
  return (
    <div className="border-b py-3.5 last:border-b-0">
      <div className="mb-2 flex items-center gap-2.5">
        <div
          className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] text-[14px]"
          style={{ background: cat.iconBg }}
        >
          {cat.icon}
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold">{cat.name}</div>
          <div className="text-[11.5px] text-muted-foreground">{cat.amounts}</div>
        </div>
        <div className="text-[13px] font-bold" style={{ color: cat.pctColor }}>
          {cat.pctLabel}
        </div>
      </div>
      <ProgressBar value={cat.barWidth} color={cat.barColor} />
    </div>
  );
}

export default function AnggaranPage() {
  const [categories, setCategories] = useState<BudgetCategory[]>(INITIAL_CATEGORIES);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("Bulanan");

  function resetForm() {
    setName("");
    setIcon(ICON_OPTIONS[0]);
    setAmount("");
    setPeriod("Bulanan");
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning("Nama kategori wajib diisi");
      return;
    }
    const newCat: BudgetCategory = {
      icon,
      iconBg: "var(--brand-purple-soft)",
      name: trimmed,
      amounts: `Rp 0 dari Rp ${amount || "0"}`,
      pct: 0,
      barWidth: 0,
      pctLabel: "0%",
      pctColor: "var(--brand-purple)",
      barColor: "var(--brand-purple)",
    };
    setCategories((prev) => [...prev, newCat]);
    setOpen(false);
    resetForm();
    toast.success(`Kategori "${trimmed}" ditambahkan`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[15px] font-bold">Anggaran April 2025</div>
          <div className="text-xs text-muted-foreground">Total budget: Rp 22.500.000</div>
        </div>
        <Button onClick={() => setOpen(true)} className="h-auto px-[18px] py-2.5">
          <Plus className="size-4" /> Tambah Kategori
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <div className="rounded-[14px] border border-[#86EFAC] bg-[#DCFCE7] p-4">
          <div className="mb-1 text-[11px] text-[#15803D]">Budget Tersisa</div>
          <div className="text-[22px] font-black text-[#15803D]">Rp 1.660.000</div>
          <div className="text-[11px] text-[#15803D]">8,3% dari budget</div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Total Terpakai</div>
          <div className="text-[22px] font-black text-destructive">Rp 18.340.000</div>
          <div className="text-[11px] text-muted-foreground">91,7% dari budget</div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Hari Tersisa</div>
          <div className="text-[22px] font-black text-primary">1 Hari</div>
          <div className="text-[11px] text-muted-foreground">dari 30 hari</div>
        </div>
      </div>

      {/* Category breakdown */}
      <SectionCard title="Rincian Anggaran per Kategori" bodyClassName="-mt-1">
        {categories.map((cat) => (
          <BudgetItem key={cat.name} cat={cat} />
        ))}
        <BudgetItem cat={TRAILING_CATEGORY} />
      </SectionCard>

      {/* Insight banner */}
      <div className="flex items-center gap-3 rounded-[14px] border border-primary/20 bg-accent p-4">
        <div className="text-[24px]">⚠️</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            Gaya Hidup melebihi budget 15%!
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Pengeluaran hiburan & makan di luar naik signifikan bulan ini.
          </div>
        </div>
        <button
          onClick={() => toast("💡 Tips hemat")}
          className="shrink-0 cursor-pointer text-[12.5px] font-bold text-primary hover:underline"
        >
          Tips Hemat →
        </button>
      </div>

      {/* Add category modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">
            Tambah Kategori Anggaran
          </DialogTitle>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Nama Kategori</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: Pendidikan Anak, Hobi, Donasi..."
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Ikon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIcon(opt)}
                    className={
                      "flex size-[42px] items-center justify-center rounded-[10px] border text-[18px] transition-colors " +
                      (icon === opt
                        ? "border-primary bg-accent"
                        : "border-border bg-background hover:bg-accent/50")
                    }
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Budget per Bulan (Rp)
              </label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
                <span className="text-[13.5px] text-muted-foreground">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  placeholder="0"
                  className="w-full bg-transparent text-[13.5px] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Periode</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className={FIELD_CLASS}
              >
                <option>Bulanan</option>
                <option>Mingguan</option>
                <option>Tahunan</option>
              </select>
            </div>

            <Button onClick={handleSave} className="w-full">
              <Save className="size-4" /> Simpan Kategori
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
