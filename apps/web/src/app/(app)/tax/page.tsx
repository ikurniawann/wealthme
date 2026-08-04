"use client";

import { useEffect, useState } from "react";
import { Send, FileText } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HeroCard, SectionCard, CardLink } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah, parseRupiah, formatNumber } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  CreateTaxRecordDto,
  Pph21ResultDto,
  TaxRecordDto,
  SptStatus,
  UpdateTaxRecordDto,
} from "@wealthme/contracts";

type TaxPtkpId = "tk0" | "k0" | "k1" | "k2" | "k3";
type TaxBracketId = "b0" | "b1" | "b2" | "b4";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

const PTKP_OPTIONS: { value: number; id: TaxPtkpId }[] = [
  { value: 54000000, id: "tk0" },
  { value: 58500000, id: "k0" },
  { value: 63000000, id: "k1" },
  { value: 67500000, id: "k2" },
  { value: 72000000, id: "k3" },
];

// Display rows for the progressive breakdown table. `idx` indexes into the
// BE's taxBreakdown array (UU HPP progressive brackets, in order) — the
// actual rates/thresholds live server-side in calculators.service.ts.
const BRACKET_ROWS: { id: TaxBracketId; rate: string; idx: number }[] = [
  { id: "b0", rate: "5%", idx: 0 },
  { id: "b1", rate: "15%", idx: 1 },
  { id: "b2", rate: "25%", idx: 2 },
  { id: "b4", rate: "35%", idx: 4 },
];

// Debounce a fast-changing input value so the PPh 21 calculator only queries
// the /calculators/pph21 endpoint after the user pauses typing.
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const SPT_STATUS_CLASS: Record<SptStatus, string> = {
  belum_lapor: "text-warning",
  sudah_lapor: "text-success",
  terlambat: "text-destructive",
};

const CURRENT_YEAR = new Date().getFullYear();

export default function TaxPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const fgId = session?.familyGroupId ?? undefined;
  const token = session?.accessToken;

  // PPh 21 calculator inputs are local; the tax math itself is computed by
  // the shared BE calculator (/calculators/pph21) so this stays in sync
  // with the kalkulator page instead of duplicating the PTKP/bracket
  // formulas + rounding rules client-side.
  const [gross, setGross] = useState("");
  const [ptkp, setPtkp] = useState(54000000);
  const [zakat, setZakat] = useState("");

  const grossN = parseRupiah(gross);

  const debouncedGross = useDebounce(gross, 300);
  const debouncedZakat = useDebounce(zakat, 300);

  const pph21Input = {
    grossIncome: parseRupiah(debouncedGross),
    zakatPaid: parseRupiah(debouncedZakat),
    ptkp,
  };

  const { data: pph21Result } = useQuery<Pph21ResultDto>({
    queryKey: ["calculators", "pph21", pph21Input],
    queryFn: () =>
      apiFetch<Pph21ResultDto>("/calculators/pph21", {
        method: "POST",
        token,
        body: JSON.stringify(pph21Input),
      }),
    enabled: !!token,
    placeholderData: keepPreviousData,
  });

  const jabatan = pph21Result?.biayaJabatan ?? 0;
  const pkp = pph21Result?.pkp ?? 0;
  // Rounded to whole rupiah before it can be persisted via handleSaveTaxRecord
  // (String(tax)) — formatRupiah() already rounds for display, but the save
  // payload needs the same guarantee.
  const tax = Math.round(pph21Result?.totalTax ?? 0);
  const taxBreakdown = pph21Result?.taxBreakdown ?? [];
  const effRate = pph21Result
    ? (pph21Result.effectiveRate * 100).toFixed(1).replace(".", ",") + "%"
    : "0%";

  // Fetch tax records
  const { data: taxRecords = [] } = useQuery<TaxRecordDto[]>({
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
      toast.success(t.tax.toastSaved);
    },
    onError: () => {
      toast.error(t.tax.toastSaveFailed);
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
      toast.success(t.tax.toastStatusUpdated);
    },
    onError: () => {
      toast.error(t.tax.toastStatusUpdateFailed);
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

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard className="gradient-wealth">
        <div className="mb-1.5 flex items-center gap-2 text-xs opacity-85">
          <FileText className="size-3.5" /> {t.tax.heroLabelPrefix}
          {CURRENT_YEAR}
        </div>
        <div className="text-[30px] font-black tracking-[-1px]">
          {currentRecord
            ? formatRupiah(Number(currentRecord.netTax))
            : formatRupiah(tax)}
        </div>
        <div className="mt-1.5 text-xs opacity-85">{t.tax.heroSubtitle}</div>
        <div className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-[0.12]">
          🧾
        </div>
      </HeroCard>

      {/* Status SPT */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">
            {t.tax.prevYearStatusLabelPrefix}
            {CURRENT_YEAR - 1}
          </div>
          {prevRecord ? (
            <>
              <div
                className={`text-[16px] font-extrabold ${SPT_STATUS_CLASS[prevRecord.sptStatus as SptStatus]}`}
              >
                {t.tax.sptStatusLabels[prevRecord.sptStatus as SptStatus]}
              </div>
              <button
                onClick={() =>
                  handleUpdateSptStatus(prevRecord.id, "sudah_lapor")
                }
                className="mt-1 cursor-pointer text-[10.5px] text-primary hover:underline"
              >
                {t.tax.markReportedButton}
              </button>
            </>
          ) : (
            <div className="text-[16px] font-extrabold text-muted-foreground">
              {t.tax.noDataLabel}
            </div>
          )}
        </Card>
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">
            {t.tax.sptYearLabelPrefix}
            {CURRENT_YEAR}
          </div>
          {currentRecord ? (
            <>
              <div
                className={`text-[16px] font-extrabold ${SPT_STATUS_CLASS[currentRecord.sptStatus as SptStatus]}`}
              >
                {t.tax.sptStatusLabels[currentRecord.sptStatus as SptStatus]}
              </div>
              <div className="text-[10.5px] text-muted-foreground">
                {t.tax.deadlinePrefix}
                {CURRENT_YEAR + 1}
              </div>
            </>
          ) : (
            <div className="text-[16px] font-extrabold text-warning">
              {t.tax.sptStatusLabels.belum_lapor}
            </div>
          )}
        </Card>
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">
            {t.tax.zakatDeductionTitle}
          </div>
          <div className="text-[16px] font-extrabold text-primary">
            {currentRecord
              ? formatRupiah(Number(currentRecord.zakatDeduction))
              : t.tax.zakatDeductionDash}
          </div>
          <div className="text-[10.5px] text-muted-foreground">
            {t.tax.zakatDeductionDesc}
          </div>
        </Card>
      </div>

      {/* Kalkulator PPh 21 */}
      <SectionCard title={t.tax.calculatorTitle}>
        <div className="mb-3.5 text-xs text-muted-foreground">
          {t.tax.calculatorSubtitle}
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
              {t.tax.fieldGrossLabel}
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
              {t.tax.fieldStatusLabel}
            </label>
            <select
              value={ptkp}
              onChange={(e) => setPtkp(Number(e.target.value))}
              className={FIELD_CLASS}
            >
              {PTKP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t.tax.ptkpLabels[o.id]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
              {t.tax.fieldJabatanLabel}
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
              {t.tax.fieldZakatLabel}
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
            {t.tax.estimateLabel}
          </div>
          <div className="mt-1 text-[24px] font-black text-primary">
            {formatRupiah(tax)}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            {t.tax.pkpPrefix}
            <strong className="text-primary">{formatRupiah(pkp)}</strong>
            {t.tax.effectiveRatePrefix}
            <strong>{effRate}</strong>
          </div>
        </div>
        <Button
          onClick={handleSaveTaxRecord}
          disabled={upsertMutation.isPending}
          className="mt-3.5 h-auto px-4 py-2.5"
          variant="outline"
        >
          {upsertMutation.isPending
            ? t.tax.savingLabel
            : t.tax.saveToTaxRecordButton}
        </Button>
      </SectionCard>

      {/* Breakdown Tarif Progresif */}
      <SectionCard title={t.tax.progressiveBreakdownTitle}>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-semibold text-muted-foreground">
                  {t.tax.colBracket}
                </th>
                <th className="py-2 text-center font-semibold text-muted-foreground">
                  {t.tax.colRate}
                </th>
                <th className="py-2 text-right font-semibold text-muted-foreground">
                  {t.tax.colTax}
                </th>
              </tr>
            </thead>
            <tbody>
              {BRACKET_ROWS.map((row) => {
                const layerAmt = taxBreakdown[row.idx]?.tax ?? 0;
                const muted = layerAmt <= 0;
                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td
                      className={
                        "py-2 " + (muted ? "text-muted-foreground" : "")
                      }
                    >
                      {t.tax.bracketLabels[row.id]}
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
                      {formatRupiah(Math.round(layerAmt))}
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
        <SectionCard title={t.tax.historyTitle} bodyClassName="-mt-1">
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
                  {t.tax.taxYearPrefix}
                  {r.taxYear}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {t.tax.grossPrefix}
                  {formatRupiah(Number(r.grossIncome))}
                  {t.tax.zakatPrefix}
                  {formatRupiah(Number(r.zakatDeduction))}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-[12px] font-bold ${SPT_STATUS_CLASS[r.sptStatus as SptStatus]}`}
                >
                  {t.tax.sptStatusLabels[r.sptStatus as SptStatus]}
                </div>
                {r.sptStatus === "belum_lapor" && (
                  <button
                    onClick={() => handleUpdateSptStatus(r.id, "sudah_lapor")}
                    className="mt-0.5 cursor-pointer text-[10px] text-primary hover:underline"
                  >
                    {t.tax.markReportedShortButton}
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
        title={t.tax.documentsTitle}
        action={
          <CardLink onClick={() => toast(t.tax.toastUploadUnavailable)}>
            {t.tax.uploadButton}
          </CardLink>
        }
        bodyClassName="-mt-1"
      >
        <div className="py-6 text-center text-[12.5px] text-muted-foreground">
          {t.tax.emptyDocuments}
        </div>
      </SectionCard>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2.5">
        <Button
          render={
            <a
              href="https://djponline.pajak.go.id"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className="h-auto min-w-[160px] flex-1 py-2.5"
        >
          <Send className="size-4" /> {t.tax.reportSptButton}
        </Button>
        <Button
          variant="outline"
          onClick={() => toast(t.tax.toastDownloadUnavailable)}
          className="h-auto min-w-[160px] flex-1 py-2.5"
        >
          <FileText className="size-4" /> {t.tax.downloadSummaryButton}
        </Button>
      </div>
    </div>
  );
}
