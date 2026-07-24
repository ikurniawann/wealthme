"use client";

import { useState } from "react";
import { Send, FileText } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HeroCard, SectionCard, CardLink } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah, parseRupiah, formatNumber } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  CreateTaxRecordDto,
  TaxRecordDto,
  SptStatus,
  UpdateTaxRecordDto,
} from "@wealthme/contracts";

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

// Display rows for the progressive breakdown table
const BRACKET_ROWS = [
  { label: "0 – 60 jt", rate: "5%", idx: 0 },
  { label: "60 – 250 jt", rate: "15%", idx: 1 },
  { label: "250 – 500 jt", rate: "25%", idx: 2 },
  { label: "> 5 M", rate: "35%", idx: 4 },
];

const SPT_STATUS_LABEL: Record<SptStatus, string> = {
  belum_lapor: "⏳ Belum Lapor",
  sudah_lapor: "✅ Sudah Lapor",
  terlambat: "⚠️ Terlambat",
};

const SPT_STATUS_CLASS: Record<SptStatus, string> = {
  belum_lapor: "text-warning",
  sudah_lapor: "text-success",
  terlambat: "text-destructive",
};

const CURRENT_YEAR = new Date().getFullYear();

export default function TaxPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const fgId = session?.familyGroupId ?? undefined;
  const token = session?.accessToken;

  // Local PPh 21 calculator state (kept local per task spec)
  const [gross, setGross] = useState("");
  const [ptkp, setPtkp] = useState(54000000);
  const [zakat, setZakat] = useState("");

  const grossN = parseRupiah(gross);
  const zakatN = parseRupiah(zakat);

  const jabatan = Math.min(grossN * 0.05, 6_000_000);
  let pkp = Math.max(0, grossN - jabatan - ptkp - zakatN);
  pkp = Math.floor(pkp / 1000) * 1000;

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
  const effRate =
    grossN > 0
      ? ((tax / grossN) * 100).toFixed(1).replace(".", ",") + "%"
      : "0%";

  // Fetch tax records
  const { data: taxRecords = [], isLoading: isTaxRecordsLoading } = useQuery<
    TaxRecordDto[]
  >({
    queryKey: fgId ? queryKeys.tax.list(fgId) : ["tax-disabled"],
    queryFn: () =>
      apiFetch<TaxRecordDto[]>(`/family-groups/${fgId}/tax`, { token }),
    enabled: !!fgId && !!token,
  });

  // Upsert tax record mutation
  const upsertMutation = useMutation({
    mutationFn: (dto: CreateTaxRecordDto) =>
      apiFetch<TaxRecordDto>(`/family-groups/${fgId}/tax`, {
        method: "POST",
        body: JSON.stringify(dto),
        token,
      }),
    onSuccess: () => {
      if (fgId)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tax.list(fgId),
        });
      toast.success("✅ Data pajak berhasil disimpan!");
    },
    onError: () => {
      toast.error("Gagal menyimpan data pajak");
    },
  });

  // Update SPT status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTaxRecordDto }) =>
      apiFetch<TaxRecordDto>(`/family-groups/${fgId}/tax/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
        token,
      }),
    onSuccess: () => {
      if (fgId)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tax.list(fgId),
        });
      toast.success("✅ Status SPT diperbarui!");
    },
    onError: () => {
      toast.error("Gagal memperbarui status SPT");
    },
  });

  function handleSaveTaxRecord(): void {
    upsertMutation.mutate({
      taxYear: CURRENT_YEAR,
      grossIncome: String(grossN),
      ptkp: String(ptkp),
      netTax: String(tax),
    });
  }

  function handleUpdateSptStatus(id: string, sptStatus: SptStatus): void {
    updateStatusMutation.mutate({ id, dto: { sptStatus } });
  }

  // Current year record (if any)
  const currentRecord = taxRecords.find((r) => r.taxYear === CURRENT_YEAR);
  const prevRecord = taxRecords.find((r) => r.taxYear === CURRENT_YEAR - 1);

  // "Unduh Ringkasan" — a real client-side export of the tax data already
  // loaded on this page (calculator estimate + saved TaxRecord history), not
  // a fake "generating report" toast. Same shape as the real GDPR export on
  // /akun: build a Blob from real data and trigger a browser download.
  function handleDownloadSummary(): void {
    // Defense-in-depth: the button is already disabled while
    // `taxRecords` is loading, but guard the handler too so a fast/stray
    // click can never produce a summary that falsely claims "no records"
    // while the real GET /family-groups/:id/tax fetch is still in flight.
    if (isTaxRecordsLoading) return;

    const lines: string[] = [
      "RINGKASAN PAJAK — WealthMe",
      `Diunduh: ${new Date().toLocaleDateString("id-ID")}`,
      "",
      `Estimasi PPh 21 ${CURRENT_YEAR} (kalkulator)`,
      `  Penghasilan Bruto: ${formatRupiah(grossN)}`,
      `  PTKP: ${formatRupiah(ptkp)}`,
      `  Zakat/Donasi: ${formatRupiah(zakatN)}`,
      `  PKP: ${formatRupiah(pkp)}`,
      `  Estimasi Pajak Terutang: ${formatRupiah(tax)}`,
      `  Tarif Efektif: ${effRate}`,
      "",
      "Riwayat Catatan Pajak",
    ];
    if (taxRecords.length > 0) {
      for (const r of taxRecords) {
        lines.push(
          `  ${r.taxYear}: Bruto ${formatRupiah(Number(r.grossIncome))} · Zakat ${formatRupiah(Number(r.zakatDeduction))} · Pajak ${formatRupiah(Number(r.netTax))} · Status ${SPT_STATUS_LABEL[r.sptStatus as SptStatus]}`,
        );
      }
    } else {
      lines.push("  Belum ada catatan pajak tersimpan.");
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ringkasan-pajak-${CURRENT_YEAR}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defensive: revoke on the next tick so the browser has a chance to
    // start using the blob URL before it's invalidated.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success("📊 Ringkasan pajak berhasil diunduh.");
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard className="gradient-wealth">
        <div className="mb-1.5 flex items-center gap-2 text-xs opacity-85">
          <FileText className="size-3.5" /> Estimasi Pajak Terutang{" "}
          {CURRENT_YEAR}
        </div>
        <div className="text-[30px] font-black tracking-[-1px]">
          {currentRecord
            ? formatRupiah(Number(currentRecord.netTax))
            : formatRupiah(tax)}
        </div>
        <div className="mt-1.5 text-xs opacity-85">
          PPh 21 · Status: WP Orang Pribadi
        </div>
        <div className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-[0.12]">
          🧾
        </div>
      </HeroCard>

      {/* Status SPT */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">
            Status SPT Tahunan {CURRENT_YEAR - 1}
          </div>
          {prevRecord ? (
            <>
              <div
                className={`text-[16px] font-extrabold ${SPT_STATUS_CLASS[prevRecord.sptStatus as SptStatus]}`}
              >
                {SPT_STATUS_LABEL[prevRecord.sptStatus as SptStatus]}
              </div>
              <button
                onClick={() =>
                  handleUpdateSptStatus(prevRecord.id, "sudah_lapor")
                }
                className="mt-1 cursor-pointer text-[10.5px] text-primary hover:underline"
              >
                Tandai Sudah Lapor
              </button>
            </>
          ) : (
            <div className="text-[16px] font-extrabold text-muted-foreground">
              Belum ada data
            </div>
          )}
        </Card>
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">
            SPT {CURRENT_YEAR}
          </div>
          {currentRecord ? (
            <>
              <div
                className={`text-[16px] font-extrabold ${SPT_STATUS_CLASS[currentRecord.sptStatus as SptStatus]}`}
              >
                {SPT_STATUS_LABEL[currentRecord.sptStatus as SptStatus]}
              </div>
              <div className="text-[10.5px] text-muted-foreground">
                Deadline 31 Mar {CURRENT_YEAR + 1}
              </div>
            </>
          ) : (
            <div className="text-[16px] font-extrabold text-warning">
              ⏳ Belum Lapor
            </div>
          )}
        </Card>
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">
            Zakat Pengurang Pajak
          </div>
          <div className="text-[16px] font-extrabold text-primary">
            {currentRecord
              ? formatRupiah(Number(currentRecord.zakatDeduction))
              : "—"}
          </div>
          <div className="text-[10.5px] text-muted-foreground">
            dari donasi tercatat
          </div>
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
              onChange={(e) =>
                setGross(
                  e.target.value === ""
                    ? ""
                    : formatNumber(parseRupiah(e.target.value)),
                )
              }
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
              Status
            </label>
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
            <input
              type="text"
              value={formatNumber(jabatan)}
              disabled
              className={FIELD_CLASS + " opacity-70"}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
              Zakat/Donasi (pengurang)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={zakat}
              onChange={(e) =>
                setZakat(
                  e.target.value === ""
                    ? ""
                    : formatNumber(parseRupiah(e.target.value)),
                )
              }
              className={FIELD_CLASS}
            />
          </div>
        </div>
        <div className="mt-4 rounded-[12px] border border-primary/15 bg-accent p-4 text-center">
          <div className="text-[11.5px] text-muted-foreground">
            Estimasi PPh 21 Terutang/Tahun
          </div>
          <div className="mt-1 text-[24px] font-black text-primary">
            {formatRupiah(tax)}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            PKP: <strong className="text-primary">{formatRupiah(pkp)}</strong> ·
            Efektif <strong>{effRate}</strong>
          </div>
        </div>
        <Button
          onClick={handleSaveTaxRecord}
          disabled={upsertMutation.isPending}
          className="mt-3.5 h-auto px-4 py-2.5"
          variant="outline"
        >
          {upsertMutation.isPending
            ? "Menyimpan..."
            : "💾 Simpan ke Catatan Pajak"}
        </Button>
      </SectionCard>

      {/* Breakdown Tarif Progresif */}
      <SectionCard title="Rincian Tarif Progresif (UU HPP)">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-semibold text-muted-foreground">
                  Lapisan PKP
                </th>
                <th className="py-2 text-center font-semibold text-muted-foreground">
                  Tarif
                </th>
                <th className="py-2 text-right font-semibold text-muted-foreground">
                  Pajak
                </th>
              </tr>
            </thead>
            <tbody>
              {BRACKET_ROWS.map((row) => {
                const t = layerTax[row.idx];
                const muted = t <= 0;
                return (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <td
                      className={
                        "py-2 " + (muted ? "text-muted-foreground" : "")
                      }
                    >
                      {row.label}
                    </td>
                    <td
                      className={
                        "py-2 text-center " +
                        (muted ? "text-muted-foreground" : "")
                      }
                    >
                      {row.rate}
                    </td>
                    <td
                      className={
                        "mono py-2 text-right " +
                        (muted ? "text-muted-foreground" : "")
                      }
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

      {/* Riwayat Pajak */}
      {taxRecords.length > 0 && (
        <SectionCard title="Riwayat Catatan Pajak" bodyClassName="-mt-1">
          {taxRecords.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 border-b py-3 last:border-b-0"
            >
              <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-[15px]">
                🧾
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">
                  Pajak {r.taxYear}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  Bruto: {formatRupiah(Number(r.grossIncome))} · Zakat:{" "}
                  {formatRupiah(Number(r.zakatDeduction))}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-[12px] font-bold ${SPT_STATUS_CLASS[r.sptStatus as SptStatus]}`}
                >
                  {SPT_STATUS_LABEL[r.sptStatus as SptStatus]}
                </div>
                {r.sptStatus === "belum_lapor" && (
                  <button
                    onClick={() => handleUpdateSptStatus(r.id, "sudah_lapor")}
                    className="mt-0.5 cursor-pointer text-[10px] text-primary hover:underline"
                  >
                    Tandai Lapor
                  </button>
                )}
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* Dokumen Pajak — upload/list not yet backed by a real API; keep the
          affordance honestly disabled instead of showing example documents. */}
      <SectionCard
        title="Dokumen Pajak"
        action={
          <CardLink
            onClick={() =>
              toast("Upload dokumen belum tersedia — fitur ini segera hadir.")
            }
          >
            + Upload
          </CardLink>
        }
        bodyClassName="-mt-1"
      >
        <div className="py-6 text-center text-[12.5px] text-muted-foreground">
          Belum ada dokumen. Fitur upload &amp; daftar dokumen pajak segera
          hadir.
        </div>
      </SectionCard>

      {/* Action buttons — "Lapor SPT Tahunan" would require a real
          integration with DJP's government e-Filing system, which is out of
          scope for this app; kept as an honest "coming soon" like the
          Dokumen Pajak upload above rather than faking a connection.
          "Unduh Ringkasan" downloads a real summary of the tax data already
          on this page (see handleDownloadSummary). */}
      <div className="flex flex-wrap gap-2.5">
        <Button
          onClick={() =>
            toast("Integrasi e-Filing DJP belum tersedia — segera hadir.")
          }
          className="h-auto min-w-[160px] flex-1 py-2.5"
        >
          <Send className="size-4" /> Lapor SPT Tahunan
        </Button>
        <Button
          variant="outline"
          onClick={handleDownloadSummary}
          disabled={isTaxRecordsLoading}
          className="h-auto min-w-[160px] flex-1 py-2.5"
        >
          <FileText className="size-4" /> Unduh Ringkasan
        </Button>
      </div>
    </div>
  );
}
