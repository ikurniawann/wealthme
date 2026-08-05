"use client";

import { useState } from "react";
import { Send, FileText } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { useDebounce } from "@/hooks/use-debounce";
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
  Role,
  TaxRecordDto,
  SptStatus,
  UpdateTaxRecordDto,
} from "@wealthme/contracts";

type TaxPtkpId = "tk0" | "k0" | "k1" | "k2" | "k3";
type TaxBracketId = "b0" | "b1" | "b2" | "b3" | "b4";

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
// EPIC-022 E4 — this table used to skip idx 3 (30%, 500jt–5M), so the
// displayed rows never summed to the headline tax above Rp 500jt.
const BRACKET_ROWS: { id: TaxBracketId; rate: string; idx: number }[] = [
  { id: "b0", rate: "5%", idx: 0 },
  { id: "b1", rate: "15%", idx: 1 },
  { id: "b2", rate: "25%", idx: 2 },
  { id: "b3", rate: "30%", idx: 3 },
  { id: "b4", rate: "35%", idx: 4 },
];

const SPT_STATUS_CLASS: Record<SptStatus, string> = {
  belum_lapor: "text-warning",
  sudah_lapor: "text-success",
  terlambat: "text-destructive",
};

const CURRENT_YEAR = new Date().getFullYear();

// EPIC-023 Task I (I1) — the roles the API grants `manage TaxRecord` to; see
// `apps/api/src/casl/casl-ability.factory.ts`. `admin_staff` gets `read` only
// and `dependant`/`operational` get nothing, yet the sidebar offers /tax to
// every role (`src/lib/nav.ts` is a protected foundation file with no role
// gating) and Save used to be enabled regardless — so the POST 403'd and the
// user saw only "Gagal menyimpan data pajak". Reproduced against DEV as
// admin_staff: GET 200, POST 403.
//
// This is a HAND-MAINTAINED mirror of that CASL grant, not an enforced one:
// `apps/api/src/tax/tax.controller.spec.ts` asserts the per-role POST outcome
// against the real AbilitiesGuard, but it does not import or reference this
// constant, so a future change to the grant in casl-ability.factory.ts can
// pass every gate and still leave this stale. Typing it `Set<Role>` at least
// makes a typo'd or renamed role a compile error; update this by hand
// whenever the TaxRecord grant changes server-side.
const TAX_MANAGE_ROLES = new Set<Role>(["owner", "member", "spouse"]);

type MeResponse = {
  familyGroupId: string | null;
  memberships?: { id: string; familyGroupId: string; role: Role }[];
};

// The API's ForbiddenException/BadRequestException carries a message worth
// showing; the blind generic toast threw it away and left the next bug report
// with nothing to go on (which is exactly how I1 arrived). NestJS's
// ValidationPipe has no custom exceptionFactory (main.ts), so several failed
// class-validator constraints come back as `message: string[]`, and the API
// client's ApiError can also carry an empty string — only trust a non-empty
// string or a non-empty array, and join the array readably.
function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object" || !("message" in err)) return fallback;
  const { message } = err;
  if (Array.isArray(message)) {
    const joined = message
      .filter((m): m is string => typeof m === "string" && m.trim() !== "")
      .join(", ");
    return joined !== "" ? joined : fallback;
  }
  return typeof message === "string" && message.trim() !== ""
    ? message
    : fallback;
}

export default function TaxPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const token = session?.accessToken;

  // Resolve the caller's membership for this family group. Shares its query
  // key with `useSession`'s own /auth/me fallback, so this is one request —
  // staleTime matches auth-compat.ts's own /auth/me query on the same key
  // (the shortest staleTime across observers of a key wins; leaving this at
  // the default 0 would make the shared query refetch more aggressively
  // app-wide than auth-compat.ts intends).
  const {
    data: me,
    isPending: isMePending,
    isError: isMeError,
  } = useQuery<MeResponse>({
    queryKey: [...queryKeys.auth.me(), token],
    queryFn: () => apiFetch<MeResponse>("/auth/me", { token }),
    enabled: !!token,
    staleTime: 60_000,
  });

  const fgId = session?.familyGroupId ?? me?.familyGroupId ?? undefined;
  const role = fgId
    ? me?.memberships?.find((m) => m.familyGroupId === fgId)?.role
    : undefined;
  // Unknown role ⇒ treated as "may not write" until /auth/me answers, rather
  // than optimistically enabling a Save the server would refuse.
  const canManageTax = !!role && TAX_MANAGE_ROLES.has(role);
  // Shared gate for every TaxRecord write on this page (Save + the SPT status
  // buttons) — this is UX only; the server (AbilitiesGuard) remains the real
  // enforcement point regardless of what this evaluates to client-side.
  const canManageTaxRecords = !!fgId && canManageTax;
  // The one honest explanation shown next to every gated control, in
  // priority order: still checking, checking failed, no family group, wrong
  // role. Null exactly when canManageTaxRecords is true, which is what makes
  // reusing a single `aria-describedby` target for every control correct.
  const accessNote = isMePending
    ? t.tax.checkingAccessLabel
    : isMeError
      ? t.tax.accessCheckFailedNote
      : !fgId
        ? t.tax.noFamilyGroupNote
        : !canManageTax
          ? t.tax.noWriteAccessNote
          : null;

  // PPh 21 calculator inputs are local; the tax math itself is computed by
  // the shared BE calculator (/calculators/pph21) so this stays in sync
  // with the kalkulator page instead of duplicating the PTKP/bracket
  // formulas + rounding rules client-side.
  const [gross, setGross] = useState("");
  const [ptkp, setPtkp] = useState(54000000);
  const [zakat, setZakat] = useState("");

  const debouncedGross = useDebounce(gross, 300);
  const debouncedZakat = useDebounce(zakat, 300);

  const pph21Input = {
    grossIncome: parseRupiah(debouncedGross),
    zakatPaid: parseRupiah(debouncedZakat),
    ptkp,
  };

  const {
    data: pph21Result,
    isFetching: isPph21Fetching,
    isError: isPph21Error,
  } = useQuery<Pph21ResultDto>({
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

  // Whether the visible calculator numbers are a trustworthy, fully-computed
  // answer (vs. still loading / errored) — gates both what we render and
  // whether Save is allowed, so we never persist a value the server hasn't
  // actually echoed back to us.
  const hasPph21Result = !!pph21Result;
  const jabatan = pph21Result?.biayaJabatan ?? 0;
  const pkp = pph21Result?.pkp ?? 0;
  const tax = Math.round(pph21Result?.totalTax ?? 0);
  const taxBreakdown = pph21Result?.taxBreakdown ?? [];
  const effRate = pph21Result
    ? (pph21Result.effectiveRate * 100).toFixed(1).replace(".", ",") + "%"
    : "0%";
  const canSaveTaxRecord =
    hasPph21Result &&
    !isPph21Fetching &&
    !isPph21Error &&
    // EPIC-023 Task I (I1) — both of these used to be missing: without a
    // family group the page posted to `/family-groups/undefined/tax`, and
    // without the ability check it offered Save to roles the API refuses.
    // Each produced a bare "Gagal menyimpan data pajak".
    canManageTaxRecords;

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
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t.tax.toastSaveFailed));
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
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t.tax.toastStatusUpdateFailed));
    },
  });

  function handleSaveTaxRecord(): void {
    // Build the payload entirely from the server-echoed pph21Result (never
    // from the raw `gross`/`ptkp`/`zakat` input state), so a save that lands
    // mid-debounce/mid-refetch can never pair a NEW gross income with an OLD
    // netTax — canSaveTaxRecord already keeps the button disabled while the
    // two could disagree.
    if (!pph21Result || !canSaveTaxRecord) return;
    upsertMutation.mutate({
      taxYear: CURRENT_YEAR,
      grossIncome: String(pph21Result.grossIncome),
      ptkp: String(pph21Result.ptkp),
      netTax: String(Math.round(pph21Result.totalTax)),
    });
  }

  function handleUpdateSptStatus(id: string, sptStatus: SptStatus): void {
    // EPIC-023 Task I retry (HIGH 1) — this PATCH is guarded server-side by
    // the identical `manage TaxRecord` ability as the POST above; the button
    // is already disabled for a caller who cannot write, but guard the
    // handler too rather than rely on the disabled attribute alone.
    if (!canManageTaxRecords) return;
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
          {currentRecord ? (
            formatRupiah(Number(currentRecord.netTax))
          ) : isPph21Error ? (
            <span className="text-[16px] font-semibold">
              {t.tax.calcErrorLabel}
            </span>
          ) : hasPph21Result ? (
            formatRupiah(tax)
          ) : (
            <span className="text-[16px] font-semibold opacity-85">
              {t.tax.calculatingLabel}
            </span>
          )}
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
                disabled={!canManageTaxRecords}
                aria-describedby={
                  !canManageTaxRecords ? "tax-access-note" : undefined
                }
                title={
                  !canManageTaxRecords ? (accessNote ?? undefined) : undefined
                }
                className={`mt-1 text-[10.5px] text-primary ${
                  canManageTaxRecords
                    ? "cursor-pointer hover:underline"
                    : "cursor-not-allowed opacity-50"
                }`}
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
            <label
              htmlFor="tax-gross-input"
              className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground"
            >
              {t.tax.fieldGrossLabel}
            </label>
            <input
              id="tax-gross-input"
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
          {isPph21Error ? (
            <div className="mt-1 text-[13px] font-semibold text-destructive">
              {t.tax.calcErrorLabel}
            </div>
          ) : !hasPph21Result ? (
            <div className="mt-1 text-[13px] text-muted-foreground">
              {t.tax.calculatingLabel}
            </div>
          ) : (
            <>
              <div className="mt-1 text-[24px] font-black text-primary">
                {formatRupiah(tax)}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                {t.tax.pkpPrefix}
                <strong className="text-primary">{formatRupiah(pkp)}</strong>
                {t.tax.effectiveRatePrefix}
                <strong>{effRate}</strong>
              </div>
            </>
          )}
        </div>
        <Button
          onClick={handleSaveTaxRecord}
          disabled={!canSaveTaxRecord || upsertMutation.isPending}
          aria-describedby={
            !canManageTaxRecords ? "tax-access-note" : undefined
          }
          className="mt-3.5 h-auto px-4 py-2.5"
          variant="outline"
        >
          {upsertMutation.isPending
            ? t.tax.savingLabel
            : t.tax.saveToTaxRecordButton}
        </Button>
        {/* EPIC-023 Task I (I1) — say why Save (and the SPT status buttons
            above, which share this same explanation via aria-describedby)
            are unavailable, instead of letting the user press them and
            receive a bare failure toast. */}
        {accessNote && (
          <div
            id="tax-access-note"
            className="mt-2 text-[11.5px] text-muted-foreground"
          >
            {accessNote}
          </div>
        )}
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
                    disabled={!canManageTaxRecords}
                    aria-describedby={
                      !canManageTaxRecords ? "tax-access-note" : undefined
                    }
                    title={
                      !canManageTaxRecords
                        ? (accessNote ?? undefined)
                        : undefined
                    }
                    className={`mt-0.5 text-[10px] text-primary ${
                      canManageTaxRecords
                        ? "cursor-pointer hover:underline"
                        : "cursor-not-allowed opacity-50"
                    }`}
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
