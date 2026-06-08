"use client";

import { useMemo, useState } from "react";
import { Plus, Share2, X, Link2, Bell } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, ProgressBar, StatusBadge } from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatAmountInput, parseRupiah, formatRupiah } from "@/lib/format";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

type ActiveSplit = {
  icon: string;
  iconBg: string;
  title: string;
  meta: string;
  total: string;
  perPerson: string;
  pct: number;
  barColor: string;
  statusColor: string;
  paidLabel: string;
  collected: string;
};

const ACTIVE_SPLITS: ActiveSplit[] = [
  {
    icon: "🍽️",
    iconBg: "#FEF3C7",
    title: "Makan di Sushi Tei",
    meta: "18 Mei 2025 · 5 orang · Kamu yang bayar",
    total: "Rp 1.250.000",
    perPerson: "Rp 250.000/org",
    pct: 60,
    barColor: "var(--success)",
    statusColor: "var(--success)",
    paidLabel: "3 dari 5",
    collected: "Rp 750.000 terkumpul",
  },
  {
    icon: "🎬",
    iconBg: "#DBEAFE",
    title: "Nonton + Cafe Bareng",
    meta: "15 Mei 2025 · 4 orang · Kamu yang bayar",
    total: "Rp 1.200.000",
    perPerson: "Rp 300.000/org",
    pct: 75,
    barColor: "var(--success)",
    statusColor: "var(--success)",
    paidLabel: "3 dari 4",
    collected: "Rp 900.000 terkumpul",
  },
  {
    icon: "🏖️",
    iconBg: "#EDE9FE",
    title: "Trip ke Bandung",
    meta: "10 Mei 2025 · 6 orang · Kamu yang bayar",
    total: "Rp 1.000.000",
    perPerson: "Rp 166.667/org",
    pct: 25,
    barColor: "var(--warning)",
    statusColor: "var(--warning)",
    paidLabel: "1 dari 6",
    collected: "Rp 166.667 terkumpul",
  },
];

type Participant = { id: number; name: string };

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#10B981,#06B6D4)",
  "linear-gradient(135deg,#F59E0B,#FBBF24)",
];

let participantSeq = 0;
function makeParticipant(name: string): Participant {
  return { id: ++participantSeq, name };
}

export default function SplitBillPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Create modal state
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [method, setMethod] = useState<"equal" | "custom">("equal");
  const [participants, setParticipants] = useState<Participant[]>(() => [
    makeParticipant("Andi"),
    makeParticipant("Budi"),
    makeParticipant("Citra"),
  ]);

  const totalNum = parseRupiah(total);
  const perPerson = useMemo(() => {
    if (participants.length === 0) return 0;
    return Math.round(totalNum / participants.length);
  }, [totalNum, participants.length]);

  function addParticipant() {
    setParticipants((prev) => [...prev, makeParticipant(`Peserta ${prev.length + 1}`)]);
  }

  function removeParticipant(id: number) {
    setParticipants((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  function renameParticipant(id: number, name: string) {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  function resetCreateForm() {
    setTitle("");
    setTotal("");
    setMethod("equal");
    setParticipants([makeParticipant("Andi"), makeParticipant("Budi"), makeParticipant("Citra")]);
  }

  function handleCreate() {
    if (!title.trim()) {
      toast.warning("Judul acara wajib diisi");
      return;
    }
    if (totalNum <= 0) {
      toast.warning("Total tagihan wajib diisi");
      return;
    }
    setCreateOpen(false);
    toast.success("✅ Split Bill dibuat!");
    setDetailOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[13px] text-muted-foreground">
          Patungan jadi gampang — kamu nalangin, mereka bayar balik
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-auto px-[18px] py-2.5">
          <Plus className="size-4" /> Buat Split Bill
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Total Ditalangin</div>
          <div className="text-[20px] font-black text-primary">Rp 3.450.000</div>
          <div className="text-[11px] text-muted-foreground">3 split aktif</div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Sudah Dibayar</div>
          <div className="text-[20px] font-black text-success">Rp 1.900.000</div>
          <div className="text-[11px] text-success">55% terkumpul</div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Belum Dibayar</div>
          <div className="text-[20px] font-black text-destructive">Rp 1.550.000</div>
          <div className="text-[11px] text-destructive">5 orang belum bayar</div>
        </div>
      </div>

      {/* Active splits */}
      <SectionCard title="Split Bill Aktif" bodyClassName="space-y-2.5">
        {ACTIVE_SPLITS.map((s) => (
          <div key={s.title} className="rounded-[10px] border p-3.5">
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex size-[42px] shrink-0 items-center justify-center rounded-[10px] text-[20px]"
                style={{ background: s.iconBg }}
              >
                {s.icon}
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-bold">{s.title}</div>
                <div className="text-[11px] text-muted-foreground">{s.meta}</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-extrabold">{s.total}</div>
                <div className="text-[11px] text-muted-foreground">{s.perPerson}</div>
              </div>
            </div>
            <ProgressBar value={s.pct} color={s.barColor} className="mb-2" />
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] text-muted-foreground">
                <span className="font-bold" style={{ color: s.statusColor }}>
                  {s.paidLabel}
                </span>{" "}
                sudah bayar · {s.collected}
              </div>
              <button
                onClick={() => setDetailOpen(true)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-accent/70"
              >
                <Share2 className="size-3.5" /> Bagikan Link
              </button>
            </div>
          </div>
        ))}
      </SectionCard>

      {/* Insight banner */}
      <div className="flex items-center gap-3 rounded-[14px] border border-primary/20 bg-accent p-4">
        <div className="text-[24px]">💡</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">Cara kerja Split Bill</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Bikin tagihan, bagi rata atau custom, lalu kirim link ke teman. Mereka bisa bayar via
            transfer/e-wallet & kamu dapat notifikasi otomatis.
          </div>
        </div>
      </div>

      {/* ──────────── Create modal ──────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">Buat Split Bill</DialogTitle>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Judul Acara</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="cth: Makan di Sushi Tei"
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Total Tagihan</label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
                <span className="text-[13.5px] text-muted-foreground">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={total}
                  onChange={(e) => setTotal(formatAmountInput(e.target.value))}
                  placeholder="0"
                  className="w-full bg-transparent text-[13.5px] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Metode Bagi</label>
              <div className="flex gap-2">
                {(
                  [
                    ["equal", "Bagi Rata"],
                    ["custom", "Custom per Orang"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMethod(key)}
                    className={
                      "flex-1 cursor-pointer rounded-md px-3 py-2 text-[12.5px] font-semibold transition-colors " +
                      (method === key
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/70")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">Peserta</label>
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => renameParticipant(p.id, e.target.value)}
                      className={"flex-1 " + FIELD_CLASS}
                    />
                    <span className="w-[88px] shrink-0 text-right text-[12.5px] font-semibold text-primary">
                      {formatRupiah(perPerson)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.id)}
                      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Hapus ${p.name}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addParticipant}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed border-primary bg-card py-2.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-accent"
              >
                <Plus className="size-4" /> Tambah Peserta
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-[10px] bg-accent px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">
                Per orang:{" "}
                <strong className="text-primary">{formatRupiah(perPerson)}</strong>
              </span>
            </div>

            <Button onClick={handleCreate} className="w-full">
              <Share2 className="size-4" /> Buat & Bagikan Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ──────────── Detail / share modal ──────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">🍽️ Makan di Sushi Tei</DialogTitle>

          <div className="mb-4 rounded-[14px] bg-accent p-[18px] text-center">
            <div className="text-[11px] text-muted-foreground">Total Tagihan</div>
            <div className="text-[26px] font-black text-primary">Rp 1.250.000</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              Rp 250.000 / orang · 5 peserta
            </div>
          </div>

          <div className="mb-2 text-[12px] font-bold text-muted-foreground">Status Pembayaran</div>
          <div className="space-y-0">
            {(
              [
                ["Andi", "A", 0, "Lunas", "success"],
                ["Budi", "B", 0, "Lunas", "success"],
                ["Citra", "C", 0, "Lunas", "success"],
                ["Dani", "D", 1, "Belum Bayar", "warning"],
                ["Eka", "E", 1, "Belum Bayar", "warning"],
              ] as const
            ).map(([name, initial, grad, label, variant]) => (
              <div
                key={name}
                className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
              >
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: AVATAR_GRADIENTS[grad] }}
                >
                  {initial}
                </div>
                <div className="flex-1 text-[13px] font-semibold">{name}</div>
                <StatusBadge variant={variant}>{label}</StatusBadge>
              </div>
            ))}
          </div>

          <div className="my-4 flex items-center gap-2.5 rounded-[10px] border border-dashed bg-background px-3.5 py-3">
            <Link2 className="size-4 shrink-0 text-primary" />
            <span className="mono flex-1 overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-muted-foreground">
              wealthme.id/split/sushitei-x7k2
            </span>
            <button
              onClick={() => toast.success("🔗 Link disalin!")}
              className="shrink-0 cursor-pointer rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
            >
              Salin
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => toast("Membuka WhatsApp...")}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md py-2.5 text-[13px] font-semibold text-white"
              style={{ background: "#25D366" }}
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.516 5.26l-.999 3.648 3.972-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              WhatsApp
            </button>
            <button
              onClick={() => toast.success("🔔 Pengingat dikirim ke yang belum bayar")}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border-[1.5px] bg-card py-2.5 text-[13px] font-semibold"
            >
              <Bell className="size-4" /> Ingatkan
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
