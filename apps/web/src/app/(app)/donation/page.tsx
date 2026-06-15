"use client";

import { useState } from "react";
import { Plus, HandHeart } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HeroCard, SectionCard, StatusBadge } from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah, parseRupiah, formatAmountInput } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  CreateDonationDto,
  DonationDto,
  DonationType,
} from "@wealthme/contracts";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

const NISAB = 102_000_000; // ≈85gr emas

const DONATION_TYPE_LABEL: Record<string, string> = {
  zakat_maal: "Zakat Maal",
  zakat_fitrah: "Zakat Fitrah",
  infaq: "Sedekah / Infak",
  sedekah: "Sedekah",
  wakaf: "Wakaf",
  lainnya: "Lainnya",
};

const DONATION_TYPE_ICON: Record<string, string> = {
  zakat_maal: "🕌",
  zakat_fitrah: "🍚",
  infaq: "💝",
  sedekah: "💝",
  wakaf: "🏫",
  lainnya: "🎗️",
};

const DONATION_TYPE_BG: Record<string, string> = {
  zakat_maal: "#DCFCE7",
  zakat_fitrah: "#DCFCE7",
  infaq: "#DBEAFE",
  sedekah: "#DBEAFE",
  wakaf: "#EDE9FE",
  lainnya: "#FEF9C3",
};

const JENIS_OPTIONS: { value: DonationType; label: string; group: string }[] = [
  { value: "zakat_maal", label: "Zakat Maal", group: "🕌 Islam" },
  { value: "zakat_fitrah", label: "Zakat Fitrah", group: "🕌 Islam" },
  { value: "infaq", label: "Sedekah / Infak", group: "🕌 Islam" },
  { value: "wakaf", label: "Wakaf", group: "🕌 Islam" },
  { value: "sedekah", label: "Sedekah", group: "❤️ Umum" },
  { value: "lainnya", label: "Lainnya / Donasi Sosial", group: "❤️ Umum" },
];

const LEMBAGA_OPTIONS = [
  "BAZNAS",
  "Dompet Dhuafa",
  "Rumah Zakat",
  "LAZ Lokal / Masjid",
  "Gereja / Paroki",
  "Yayasan Keagamaan",
  "Pura / Parisada",
  "Vihara",
  "Yayasan Sosial",
  "Lainnya",
];

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
      <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
        {label}
      </label>
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

function formatIndonesianDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DonationPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const fgId = session?.familyGroupId ?? undefined;
  const token = session?.accessToken;

  // Zakat Maal calculator state (local — no API)
  const [cash, setCash] = useState("339.450.000");
  const [gold, setGold] = useState("50.000.000");
  const [invest, setInvest] = useState("577.200.000");
  const [debt, setDebt] = useState("15.170.000");

  const harta =
    parseRupiah(cash) +
    parseRupiah(gold) +
    parseRupiah(invest) -
    parseRupiah(debt);
  const reachedNisab = harta >= NISAB;
  const zakat = reachedNisab ? Math.round(harta * 0.025) : 0;
  const nisabMsg = reachedNisab
    ? "✅ Harta sudah mencapai nisab (setara 85gr emas ≈ Rp 102 jt)"
    : "⚠️ Harta belum mencapai nisab (Rp 102 jt) — belum wajib zakat";

  // Donation modal state
  const [open, setOpen] = useState(false);
  const [jenis, setJenis] = useState<DonationType>("zakat_maal");
  const [jumlah, setJumlah] = useState("");
  const [lembaga, setLembaga] = useState(LEMBAGA_OPTIONS[0]);
  const [tanggal, setTanggal] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [isTaxDeductible, setIsTaxDeductible] = useState(false);

  // Fetch donations list
  const { data: donations = [], isLoading } = useQuery<DonationDto[]>({
    queryKey: fgId ? queryKeys.donations.list(fgId) : ["donations-disabled"],
    queryFn: () =>
      apiFetch<DonationDto[]>(`/family-groups/${fgId}/donations`, { token }),
    enabled: !!fgId && !!token,
  });

  // Create donation mutation
  const createMutation = useMutation({
    mutationFn: (dto: CreateDonationDto) =>
      apiFetch<DonationDto>(`/family-groups/${fgId}/donations`, {
        method: "POST",
        body: JSON.stringify(dto),
        token,
      }),
    onSuccess: () => {
      if (fgId)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.donations.list(fgId),
        });
      setOpen(false);
      toast.success("✅ Donasi berhasil dicatat!");
    },
    onError: () => {
      toast.error("Gagal menyimpan donasi");
    },
  });

  function openModal(prefillZakat?: boolean): void {
    if (prefillZakat) {
      setJenis("zakat_maal");
      setJumlah(formatAmountInput(String(zakat)));
      setLembaga("BAZNAS");
      setIsTaxDeductible(true);
    } else {
      setJumlah("");
      setIsTaxDeductible(false);
    }
    setOpen(true);
  }

  function handleSave(): void {
    const amountNum = parseRupiah(jumlah);
    if (!amountNum || amountNum <= 0) {
      toast.error("Jumlah donasi tidak valid");
      return;
    }
    createMutation.mutate({
      type: jenis,
      recipient: lembaga,
      amount: String(amountNum),
      donatedAt: new Date(tanggal).toISOString(),
      isTaxDeductible,
    });
  }

  // Compute category totals from API data
  const totalAmount = donations.reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard className="gradient-emerald">
        <div className="mb-1.5 flex items-center gap-2 text-xs opacity-85">
          <HandHeart className="size-3.5" /> Total Donasi &amp; Zakat
        </div>
        <div className="text-[30px] font-black tracking-[-1px]">
          {formatRupiah(totalAmount)}
        </div>
        <div className="mt-1.5 text-xs opacity-85">
          {donations.length} transaksi
        </div>
        <div className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-[0.12]">
          🤲
        </div>
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

      {/* Kalkulator Zakat */}
      <SectionCard title="🕌 Kalkulator Zakat Maal">
        <div className="mb-3.5 text-xs text-muted-foreground">
          Zakat 2,5% dari total harta yang mencapai nisab &amp; haul (1 tahun)
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <ZkInput
            label="Tabungan & Kas (Rp)"
            value={cash}
            onChange={setCash}
          />
          <ZkInput label="Emas & Perak (Rp)" value={gold} onChange={setGold} />
          <ZkInput
            label="Investasi & Saham (Rp)"
            value={invest}
            onChange={setInvest}
          />
          <ZkInput
            label="Utang Jatuh Tempo (Rp)"
            value={debt}
            onChange={setDebt}
          />
        </div>
        <div className="mt-4 rounded-[12px] border border-primary/15 bg-accent p-4 text-center">
          <div className="text-[11.5px] text-muted-foreground">
            Zakat yang Wajib Ditunaikan (2,5%)
          </div>
          <div className="mt-1 text-[24px] font-black text-primary">
            {formatRupiah(zakat)}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">{nisabMsg}</div>
        </div>
        <Button
          onClick={() => openModal(true)}
          className="mt-3.5 h-auto px-4 py-2.5"
        >
          <HandHeart className="size-4" /> Tunaikan Zakat Sekarang
        </Button>
      </SectionCard>

      {/* Riwayat Donasi */}
      <SectionCard title="Riwayat Donasi & Zakat" bodyClassName="-mt-1">
        {isLoading ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            Memuat...
          </div>
        ) : donations.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            Belum ada catatan donasi
          </div>
        ) : (
          donations.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 border-b py-3 last:border-b-0"
            >
              <div
                className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] text-[15px]"
                style={{ background: DONATION_TYPE_BG[d.type] ?? "#F3F4F6" }}
              >
                {DONATION_TYPE_ICON[d.type] ?? "🤲"}
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">
                  {DONATION_TYPE_LABEL[d.type] ?? d.type} — {d.recipient}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {formatIndonesianDate(d.donatedAt)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[13.5px] font-bold text-destructive">
                  -{formatRupiah(Number(d.amount))}
                </div>
                {d.isTaxDeductible && (
                  <StatusBadge variant="success" className="mt-0.5 text-[10px]">
                    Pengurang Pajak
                  </StatusBadge>
                )}
              </div>
            </div>
          ))
        )}
      </SectionCard>

      {/* Insight banner */}
      <div className="flex items-center gap-3 rounded-[14px] border border-primary/20 bg-accent p-4">
        <div className="text-[24px]">📋</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            Donasi bisa jadi pengurang pajak
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Zakat yang dibayarkan ke lembaga resmi (BAZNAS/LAZ) bisa mengurangi
            penghasilan kena pajak. Cek di Tax Center.
          </div>
        </div>
      </div>

      {/* Donation modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">
            Catat Donasi Keagamaan
          </DialogTitle>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Jenis
              </label>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value as DonationType)}
                className={FIELD_CLASS}
              >
                {JENIS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.group} — {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Jumlah
              </label>
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
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Lembaga / Penerima
              </label>
              <select
                value={lembaga}
                onChange={(e) => setLembaga(e.target.value)}
                className={FIELD_CLASS}
              >
                {LEMBAGA_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Tanggal
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="tax-deductible"
                type="checkbox"
                checked={isTaxDeductible}
                onChange={(e) => setIsTaxDeductible(e.target.checked)}
                className="size-4 accent-primary"
              />
              <label
                htmlFor="tax-deductible"
                className="text-[12.5px] text-muted-foreground"
              >
                Pengurang pajak penghasilan (zakat ke lembaga resmi)
              </label>
            </div>

            <Button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="w-full"
            >
              <HandHeart className="size-4" />{" "}
              {createMutation.isPending ? "Menyimpan..." : "Simpan Catatan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
