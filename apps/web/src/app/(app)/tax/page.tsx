"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, FileText, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useDebounce } from "@/hooks/use-debounce";
import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BentoCard,
  BentoGrid,
  BentoHero,
  HeroKpi,
  SectionCard,
  StatusBadge,
} from "@/components/wm";
import "./tax.css";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah, parseRupiah, formatNumber } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { formatBps } from "@/components/tax/format-bps";
import { TaxRuleBadge } from "@/components/tax/tax-rule-badge";
import { usePphOpPreview } from "@/components/tax/use-tax-api";

import { extractApiErrorMessage } from "./_components/api-error";
import { MAX_TAX_INPUT, toClampedDigitString } from "./_components/digits";
import { AnnualSummary } from "./_components/annual-summary";
import {
  downloadTaxSummary,
  openTaxDocument,
  uploadTaxDocument,
} from "./_components/tax-documents";
import { FinalIncomePanel } from "./_components/final-income-panel";
import { PphOpFields } from "./_components/pph-op-fields";
import {
  TaxRulesProvider,
  useAllTaxRules,
  useReportTaxRules,
} from "./_components/tax-rules-context";
import { TerPanel } from "./_components/ter-panel";
import { UmkmPanel } from "./_components/umkm-panel";

import type {
  CreateTaxRecordDto,
  PphOpPreviewRequestDto,
  Role,
  TaxDocumentDto,
  TaxMaritalStatus,
  TaxRecordDto,
  SptStatus,
  UpdateTaxRecordDto,
} from "@wealthme/contracts";

// `page.tsx` re-exports these so existing imports/tests keep working; the
// implementation moved to `_components/digits.ts` (Task 9, sub-plan L) so
// `pph-op-fields.tsx`/`ter-panel.tsx` can import them without importing the
// whole page module.
export { MAX_TAX_INPUT, toClampedDigitString } from "./_components/digits";

const SPT_STATUS_CLASS: Record<SptStatus, string> = {
  belum_lapor: "text-warning",
  sudah_lapor: "text-success",
  terlambat: "text-destructive",
};

// Prototype's Riwayat rows use pill status badges rather than plain coloured
// text (matches StatusBadge's own variant set in components/wm).
const SPT_STATUS_BADGE_VARIANT: Record<
  SptStatus,
  "success" | "warning" | "danger"
> = {
  belum_lapor: "warning",
  sudah_lapor: "success",
  terlambat: "danger",
};

const CURRENT_YEAR = new Date().getFullYear();
const TAX_YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

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

export default function TaxPage() {
  return (
    <TaxRulesProvider>
      <TaxPageContent />
    </TaxRulesProvider>
  );
}

function TaxPageContent() {
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

  // The detailed PPh OP calculator's inputs are local; the tax math itself
  // (PTKP derivation, brackets, NPPN, rounding) is computed by the shared
  // BE engine (POST .../tax/pph-op/preview) — the web never recomputes a
  // tax number (Task 9, sub-plan L).
  const [gross, setGross] = useState("");
  const [maritalStatus, setMaritalStatus] = useState<TaxMaritalStatus>("TK");
  const [dependents, setDependents] = useState(0);
  const [pension, setPension] = useState("");
  const [withheld, setWithheld] = useState("");
  const [freelance, setFreelance] = useState("");
  const [nppnPct, setNppnPct] = useState("");
  const [otherNet, setOtherNet] = useState("");
  const [zakat, setZakat] = useState("");
  const [zakatTouched, setZakatTouched] = useState(false);
  // Prototype structural port follow-up — the calculator math itself is
  // year-independent (the BE brackets don't vary per year), but which
  // TaxRecord year a Save writes to genuinely is real, wired functionality
  // (TaxRecordDto.taxYear accepts any year), unlike a hero-level year
  // switcher which would have no distinct historical estimate to show.
  const [taxYear, setTaxYear] = useState(CURRENT_YEAR);

  // Hardening batch G2 — real tax document uploads, mirroring
  // aset/[id]/page.tsx's attachments wiring exactly.
  const { data: taxDocuments } = useQuery<TaxDocumentDto[]>({
    queryKey: ["tax", "documents", fgId ?? "", taxYear],
    queryFn: () =>
      apiFetch<TaxDocumentDto[]>(
        `/family-groups/${fgId}/tax/documents/${taxYear}`,
        { token },
      ),
    enabled: !!token && !!fgId,
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  async function invalidateTaxDocuments() {
    await queryClient.invalidateQueries({
      queryKey: ["tax", "documents", fgId ?? "", taxYear],
    });
  }
  async function handleUploadTaxDocument(file: File | null) {
    if (!file || !fgId) return;
    setUploadingDoc(true);
    try {
      await uploadTaxDocument(fgId, taxYear, file, token);
      toast.success(t.tax.toastDocumentUploaded);
      await invalidateTaxDocuments();
    } catch {
      toast.error(t.tax.toastDocumentFailed);
    } finally {
      setUploadingDoc(false);
    }
  }
  async function handleDeleteTaxDocument(id: string) {
    if (!fgId) return;
    try {
      await apiFetch(`/family-groups/${fgId}/tax/documents/${taxYear}/${id}`, {
        method: "DELETE",
        token,
      });
      toast.success(t.tax.toastDocumentDeleted);
      await invalidateTaxDocuments();
    } catch {
      toast.error(t.tax.toastDocumentFailed);
    }
  }
  async function handleDownloadSummary(format: "csv" | "pdf") {
    if (!fgId) return;
    try {
      await downloadTaxSummary(fgId, taxYear, format, token);
    } catch {
      toast.error(t.tax.toastDownloadFailed);
    }
  }

  // EPIC-026 Wave 2 — prototype structural port: the prototype gates Save
  // behind a review dialog ("Simpan ke Catatan Pajak") showing the exact
  // numbers about to be persisted; Save used to write through immediately
  // with no review step.
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const debouncedGross = useDebounce(gross, 300);
  const debouncedZakat = useDebounce(zakat, 300);
  const debouncedPension = useDebounce(pension, 300);
  const debouncedWithheld = useDebounce(withheld, 300);
  const debouncedFreelance = useDebounce(freelance, 300);
  const debouncedNppnPct = useDebounce(nppnPct, 300);
  const debouncedOtherNet = useDebounce(otherNet, 300);

  const pphOpRequest: PphOpPreviewRequestDto = {
    taxYear,
    maritalStatus,
    dependents,
    employmentGross: toClampedDigitString(debouncedGross, MAX_TAX_INPUT),
    pensionContribution: toClampedDigitString(debouncedPension, MAX_TAX_INPUT),
    zakat: toClampedDigitString(debouncedZakat, MAX_TAX_INPUT),
    withheldPph21: toClampedDigitString(debouncedWithheld, MAX_TAX_INPUT),
    otherNetIncome: toClampedDigitString(debouncedOtherNet, MAX_TAX_INPUT),
    // A `nppnRateBps: 0` makes the server answer 400, so the panel shows
    // `t.tax.calcErrorLabel` until the user types a valid NPPN % — the
    // honest state, rather than silently sending freelance income with no
    // deemed-profit rate.
    ...(toClampedDigitString(debouncedFreelance, MAX_TAX_INPUT) !== "0"
      ? {
          freelanceGross: toClampedDigitString(
            debouncedFreelance,
            MAX_TAX_INPUT,
          ),
          nppnRateBps:
            Math.round(Number(debouncedNppnPct.replace(",", ".")) * 100) || 0,
        }
      : {}),
  };
  const {
    data: pphOp,
    isFetching: isPph21Fetching,
    isError: isPph21Error,
  } = usePphOpPreview(fgId ? pphOpRequest : null);
  useReportTaxRules("pph-op", pphOp?.rules ?? []);
  // Polish batch 7b (item 1) — the one aggregate "Perkiraan" badge for the
  // whole page (was repeated per section: pph-op field, TER table, UMKM
  // table). Every live calculator reports its flagged rules into this
  // context; this reads the union, deduped by `key|effectiveFrom`.
  const allTaxRules = useAllTaxRules();

  // Whether the visible calculator numbers are a trustworthy, fully-computed
  // answer (vs. still loading / errored) — gates both what we render and
  // whether Save is allowed, so we never persist a value the server hasn't
  // actually echoed back to us.
  const hasPph21Result = !!pphOp;
  const jabatan = Number(pphOp?.biayaJabatan ?? 0);
  const pkp = Number(pphOp?.pkp ?? 0);
  const tax = Number(pphOp?.tax ?? 0);
  const employmentGrossNum = Number(pphOpRequest.employmentGross);
  const freelanceGrossNum = Number(pphOpRequest.freelanceGross ?? "0");
  const effRate =
    pphOp && employmentGrossNum + freelanceGrossNum > 0
      ? ((tax / (employmentGrossNum + freelanceGrossNum)) * 100)
          .toFixed(1)
          .replace(".", ",") + "%"
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

  // EPIC (revisi-ab) — pre-fill the Perpuluhan/Zakat deduction field from
  // Task 2's donations/deductible-total endpoint (the sum of this year's
  // zakat/tithe donations flagged tax-deductible), instead of leaving the
  // user to retype a number that's already recorded elsewhere. `zakatTouched`
  // below stops this from ever overwriting a value the user typed themselves.
  const { data: deductible } = useQuery<{ year: number; total: string }>({
    queryKey: ["donations", fgId ?? "", "deductible-total", taxYear],
    queryFn: () =>
      apiFetch<{ year: number; total: string }>(
        `/family-groups/${fgId}/donations/deductible-total?year=${taxYear}`,
        { token },
      ),
    enabled: !!token && !!fgId,
  });

  useEffect(() => {
    if (zakatTouched || !deductible) return;
    const total = Number(deductible.total);
    // Syncing local zakat input state from a server-fetched query result (an
    // external system), not deriving it from other React state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZakat(total > 0 ? formatNumber(Math.min(total, MAX_TAX_INPUT)) : "");
  }, [deductible, zakatTouched]);

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
    // Build the payload entirely from the server-echoed pphOp result and the
    // exact request it was computed from (never a fresher, still-debouncing
    // input value), so a save that lands mid-debounce/mid-refetch can never
    // pair a NEW input with an OLD tax — canSaveTaxRecord already keeps the
    // button disabled while the two could disagree. `netTax` is the
    // server-echoed `pphOp.tax`, never recomputed client-side.
    if (!pphOp || !canSaveTaxRecord) return;
    upsertMutation.mutate(
      {
        taxYear,
        grossIncome: pphOpRequest.employmentGross,
        maritalStatus,
        dependents,
        pensionContribution: pphOpRequest.pensionContribution,
        withheldPph21: pphOpRequest.withheldPph21,
        otherNetIncome: pphOpRequest.otherNetIncome,
        ...(pphOpRequest.freelanceGross
          ? {
              freelanceGross: pphOpRequest.freelanceGross,
              nppnRateBps: pphOpRequest.nppnRateBps,
            }
          : {}),
        netTax: pphOp.tax,
      },
      { onSettled: () => setShowSaveDialog(false) },
    );
  }

  function handleResetCalculator(): void {
    setGross("");
    setZakat("");
    setZakatTouched(false);
    setMaritalStatus("TK");
    setDependents(0);
    setPension("");
    setWithheld("");
    setFreelance("");
    setNppnPct("");
    setOtherNet("");
    setTaxYear(CURRENT_YEAR);
    toast(t.tax.toastReset);
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

  // Prototype puts the "Tandai Sudah Lapor" action on the still-open filing
  // year (a bordered button, not a bare text link) — never on a year that's
  // already reported. Shared so it renders identically wherever a record's
  // sptStatus is actually "belum_lapor".
  function renderMarkReportedButton(recordId: string) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleUpdateSptStatus(recordId, "sudah_lapor")}
        disabled={!canManageTaxRecords}
        aria-describedby={!canManageTaxRecords ? "tax-access-note" : undefined}
        title={!canManageTaxRecords ? (accessNote ?? undefined) : undefined}
        className="mt-2 h-auto px-2.5 py-1 text-[11px]"
      >
        {t.tax.markReportedButton}
      </Button>
    );
  }

  return (
    <div className="space-y-4" data-page="tax">
      <BentoGrid className="tx-grid">
        <h1 className="sr-only">{t.shell.pageTitles.tax}</h1>
        <BentoHero
          className="tx-hero"
          currency={null}
          value={
            currentRecord ? (
              <span className="wm-money">
                {formatRupiah(Number(currentRecord.netTax))}
              </span>
            ) : isPph21Error ? (
              t.tax.calcErrorLabel
            ) : hasPph21Result ? (
              <span className="wm-money">{formatRupiah(tax)}</span>
            ) : (
              t.tax.calculatingLabel
            )
          }
          caption={`${t.tax.heroLabelPrefix}${CURRENT_YEAR} · ${t.tax.heroSubtitle}`}
          controls={
            allTaxRules.length > 0 ? <TaxRuleBadge rules={allTaxRules} /> : null
          }
          kpis={
            <>
              <HeroKpi
                label={`${t.tax.sptYearLabelPrefix}${CURRENT_YEAR}`}
                value={
                  currentRecord
                    ? t.tax.sptStatusLabels[
                        currentRecord.sptStatus as SptStatus
                      ]
                    : t.tax.sptStatusLabels.belum_lapor
                }
              />
              <HeroKpi
                label={t.tax.perpuluhanDeductionTitle}
                value={
                  <span className="wm-money">
                    {currentRecord
                      ? formatRupiah(Number(currentRecord.zakatDeduction))
                      : t.tax.zakatDeductionDash}
                  </span>
                }
              />
              <HeroKpi
                label={`${t.tax.prevYearStatusLabelPrefix}${CURRENT_YEAR - 1}`}
                value={
                  prevRecord
                    ? t.tax.sptStatusLabels[prevRecord.sptStatus as SptStatus]
                    : t.tax.noDataLabel
                }
              />
            </>
          }
        />
        <BentoCard
          className="tx-cur"
          title={`${t.tax.sptYearLabelPrefix}${CURRENT_YEAR}`}
          caption={`${t.tax.deadlinePrefix}${CURRENT_YEAR + 1}`}
        >
          {currentRecord ? (
            <>
              <b
                className={`tx-stat ${SPT_STATUS_CLASS[currentRecord.sptStatus as SptStatus]}`}
              >
                {t.tax.sptStatusLabels[currentRecord.sptStatus as SptStatus]}
              </b>
              {currentRecord.sptStatus === "belum_lapor" &&
                renderMarkReportedButton(currentRecord.id)}
            </>
          ) : (
            <b className="tx-stat text-warning">
              {t.tax.sptStatusLabels.belum_lapor}
            </b>
          )}
        </BentoCard>
        <BentoCard
          className="tx-prev"
          title={`${t.tax.prevYearStatusLabelPrefix}${CURRENT_YEAR - 1}`}
        >
          {prevRecord ? (
            <>
              <b
                className={`tx-stat ${SPT_STATUS_CLASS[prevRecord.sptStatus as SptStatus]}`}
              >
                {t.tax.sptStatusLabels[prevRecord.sptStatus as SptStatus]}
              </b>
              {prevRecord.sptStatus === "belum_lapor" &&
                renderMarkReportedButton(prevRecord.id)}
            </>
          ) : (
            <b className="tx-stat text-muted-foreground">{t.tax.noDataLabel}</b>
          )}
        </BentoCard>
      </BentoGrid>

      {/* Ringkasan pajak tahunan — the page's one "answer" block (Task 10,
          sub-plan L), directly after the SPT-status trio. */}
      <AnnualSummary taxYear={taxYear} />

      <div className="flex justify-end">
        <a
          href="#pph21-calculator"
          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
        >
          {t.tax.jumpToCalculator}
        </a>
      </div>

      {/* Kalkulator PPh 21 */}
      <div id="pph21-calculator" className="scroll-mt-4">
        <SectionCard
          title={t.tax.calculatorTitle}
          action={
            <Link
              href="/kalkulator"
              className="text-xs font-semibold whitespace-nowrap text-primary hover:underline"
            >
              {t.tax.calculatorOtherLink}
            </Link>
          }
        >
          <div className="mb-3.5 text-xs text-muted-foreground">
            {t.tax.calculatorSubtitle}
          </div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <div>
              <label
                htmlFor="tax-year-select"
                className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground"
              >
                {t.tax.fieldTaxYearLabel}
              </label>
              <select
                id="tax-year-select"
                value={taxYear}
                onChange={(e) => setTaxYear(Number(e.target.value))}
                className="select"
              >
                {TAX_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
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
                      : formatNumber(
                          Math.min(parseRupiah(e.target.value), MAX_TAX_INPUT),
                        ),
                  )
                }
                className="input"
              />
            </div>
          </div>

          <div className="mt-3.5">
            <PphOpFields
              maritalStatus={maritalStatus}
              onMaritalStatusChange={setMaritalStatus}
              dependents={dependents}
              onDependentsChange={setDependents}
              pension={pension}
              onPensionChange={setPension}
              withheld={withheld}
              onWithheldChange={setWithheld}
              freelance={freelance}
              onFreelanceChange={setFreelance}
              nppnPct={nppnPct}
              onNppnPctChange={setNppnPct}
              otherNet={otherNet}
              onOtherNetChange={setOtherNet}
              ptkp={pphOp?.ptkp}
            />
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {/* Task 10 carry (Task 9 review) — this read-only computed row
              used to sit alone in a half-width cell, leaving an empty
              column beside it at 1440. Every 2-col row here is either a
              genuine pair or spans the full width; a single field never
              gets a lone half row. */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
                {t.tax.fieldJabatanLabel}
              </label>
              <input
                type="text"
                value={formatNumber(jabatan)}
                disabled
                className="input opacity-70"
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="tax-perpuluhan"
                className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground"
              >
                {t.tax.fieldPerpuluhanLabel}
              </label>
              <input
                id="tax-perpuluhan"
                type="text"
                inputMode="numeric"
                value={zakat}
                onChange={(e) => {
                  setZakatTouched(true);
                  setZakat(
                    e.target.value === ""
                      ? ""
                      : formatNumber(
                          Math.min(parseRupiah(e.target.value), MAX_TAX_INPUT),
                        ),
                  );
                }}
                className="input"
              />
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                {t.tax.perpuluhanAutoFilledHint.replace(
                  "{year}",
                  String(taxYear),
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-[12px] border border-primary/15 bg-accent p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground">
              {t.tax.estimateLabel}
            </div>
            {!fgId ? (
              <div className="mt-1 text-[13px] text-muted-foreground">
                {t.tax.op.previewNeedsFamily}
              </div>
            ) : isPph21Error ? (
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
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {t.tax.op.netoLabel}
                  {": "}
                  <strong>{formatRupiah(Number(pphOp.neto))}</strong>
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {t.tax.op.balanceLabel}
                  {": "}
                  {Number(pphOp.balance) < 0 ? (
                    <strong className="text-success">
                      {t.tax.op.overpaidLabel} (
                      {formatRupiah(Math.abs(Number(pphOp.balance)))})
                    </strong>
                  ) : (
                    <strong>{formatRupiah(Number(pphOp.balance))}</strong>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            {/* EPIC-026 Wave 2 — prototype (tax.html) renders Simpan as
              btn--primary; Reset stays outline. */}
            <Button
              onClick={() => setShowSaveDialog(true)}
              disabled={!canSaveTaxRecord || upsertMutation.isPending}
              aria-describedby={
                !canManageTaxRecords ? "tax-access-note" : undefined
              }
              className="h-auto px-4 py-2.5"
            >
              {upsertMutation.isPending
                ? t.tax.savingLabel
                : t.tax.saveToTaxRecordButton}
            </Button>
            <Button
              onClick={handleResetCalculator}
              className="h-auto px-4 py-2.5"
              variant="outline"
            >
              {t.tax.resetButton}
            </Button>
          </div>
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
      </div>

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
                  {t.tax.colTaxableBase}
                </th>
                <th className="py-2 text-right font-semibold text-muted-foreground">
                  {t.tax.colTax}
                </th>
              </tr>
            </thead>
            <tbody>
              {(pphOp?.brackets.length ?? 0) === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-2 text-center text-muted-foreground"
                  >
                    {t.tax.op.noTaxRow}
                  </td>
                </tr>
              ) : (
                pphOp!.brackets.map((b, idx) => (
                  <tr
                    key={`${b.from}-${idx}`}
                    className="border-b last:border-b-0"
                  >
                    <td className="py-2">{b.label}</td>
                    <td className="py-2 text-center">{formatBps(b.rateBps)}</td>
                    <td className="mono py-2 text-right">
                      {formatRupiah(Number(b.taxable))}
                    </td>
                    <td className="mono py-2 text-right">
                      {formatRupiah(Number(b.tax))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* TER bulanan & koreksi Desember + DTP */}
      <SectionCard title={t.tax.ter.title}>
        <div className="mb-3.5 text-xs text-muted-foreground">
          {t.tax.ter.subtitle}
        </div>
        <TerPanel
          taxYear={taxYear}
          maritalStatus={maritalStatus}
          dependents={dependents}
          defaultMonthlyGross={(
            BigInt(toClampedDigitString(debouncedGross, MAX_TAX_INPUT)) /
            BigInt(12)
          ).toString()}
        />
      </SectionCard>

      {/* Pajak final investasi & penghasilan lain */}
      <section id="pajak-final">
        <SectionCard title={t.tax.final.title}>
          <FinalIncomePanel taxYear={taxYear} canManage={canManageTaxRecords} />
        </SectionCard>
      </section>

      {/* PPh final UMKM 0,5% */}
      <SectionCard title={t.tax.umkm.title}>
        <UmkmPanel taxYear={taxYear} canManage={canManageTaxRecords} />
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
                <StatusBadge
                  variant={SPT_STATUS_BADGE_VARIANT[r.sptStatus as SptStatus]}
                >
                  {t.tax.sptStatusLabels[r.sptStatus as SptStatus]}
                </StatusBadge>
                {r.sptStatus === "belum_lapor" && (
                  // Hardening batch G3 (P1) — this used to be a 10px text
                  // link with no padding, well under the 44px touch target.
                  // A real `.btn--sm` (44px on coarse pointers per the
                  // foundation fix above) with 12px+ text.
                  <button
                    type="button"
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
                    className="btn btn--outline btn--sm mt-1.5 h-auto py-1 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t.tax.markReportedShortButton}
                  </button>
                )}
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* Dokumen Pajak — hardening batch G2: real upload/list/delete via
          TaxDocumentsController, mirroring aset/[id]/page.tsx's attachments
          UI exactly. */}
      <SectionCard
        title={t.tax.documentsTitle}
        action={
          canManageTaxRecords ? (
            <label className="btn btn--outline btn--sm cursor-pointer">
              <Upload className="size-3.5" />
              {t.tax.uploadButton}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="sr-only"
                disabled={uploadingDoc}
                onChange={(e) => {
                  void handleUploadTaxDocument(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          ) : undefined
        }
        bodyClassName="-mt-1"
      >
        {(taxDocuments ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <div className="mb-1 text-[28px]" aria-hidden>
              📄
            </div>
            <div className="text-[13px] font-bold">
              {t.tax.emptyDocumentsTitle}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {t.tax.emptyDocumentsSub}
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {(taxDocuments ?? []).map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 py-2.5 text-[12.5px]"
              >
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-2 text-left hover:underline"
                  aria-label={t.tax.openDocumentAria}
                  onClick={() =>
                    fgId && void openTaxDocument(fgId, taxYear, d.id, token)
                  }
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {d.mimeType
                      .replace("image/", "")
                      .replace("application/", "")
                      .toUpperCase()}
                    {" · "}
                    {Math.max(1, Math.ceil(d.size / 1024)).toLocaleString(
                      "id-ID",
                    )}{" "}
                    KB
                    {" · "}
                    {new Date(d.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </button>
                {canManageTaxRecords && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon text-destructive"
                    aria-label={t.tax.deleteDocumentAria}
                    onClick={() => void handleDeleteTaxDocument(d.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2.5">
        <Button
          nativeButton={false}
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
          onClick={() => void handleDownloadSummary("csv")}
          className="h-auto min-w-[160px] flex-1 py-2.5"
        >
          <FileText className="size-4" /> {t.tax.downloadSummaryButton} (CSV)
        </Button>
        <Button
          variant="outline"
          onClick={() => void handleDownloadSummary("pdf")}
          className="h-auto min-w-[160px] flex-1 py-2.5"
        >
          <FileText className="size-4" /> {t.tax.downloadSummaryButton} (PDF)
        </Button>
      </div>

      {/* EPIC-026 Wave 2 — prototype structural port: review the exact
          numbers before Save actually persists (prototype's "Simpan ke
          Catatan Pajak" dialog). Every value here is the same
          server-echoed `pphOp` `handleSaveTaxRecord` itself sends —
          never the raw, still-debouncing input state. */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        {/* EPIC-026 Wave 8 — composition ported 1:1 from the prototype's
            `dlg-simpan-pajak` (docs/prototype/pages/tax.html): default
            480px `.dialog`, `.dialog__title` + `.dialog__desc`, a
            `.table-wrap` > `.table.table--num` summary, the `notice--info`
            about the numeric-string payload, and an outline/primary
            `.dialog__footer`. */}
        <DialogContent>
          <DialogTitle>{t.tax.saveDialogTitle}</DialogTitle>
          <DialogDescription>
            {t.tax.saveDialogDescPrefix}
            {taxYear}
          </DialogDescription>
          <DialogBody>
            {pphOp && (
              <div className="table-wrap">
                <table className="table table--num min-w-0">
                  <tbody>
                    <tr>
                      <td>{t.tax.saveDialogGrossRow}</td>
                      <td className="mono">
                        {formatRupiah(Number(pphOpRequest.employmentGross))}
                      </td>
                    </tr>
                    <tr>
                      <td>{t.tax.saveDialogPtkpRow}</td>
                      <td className="mono">
                        {formatRupiah(Number(pphOp.ptkp))}
                      </td>
                    </tr>
                    <tr>
                      <td>{t.tax.saveDialogPerpuluhanRow}</td>
                      <td className="mono">
                        {formatRupiah(
                          Number(
                            toClampedDigitString(debouncedZakat, MAX_TAX_INPUT),
                          ),
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>{t.tax.saveDialogTaxRow}</strong>
                      </td>
                      <td className="mono t-bold text-primary">
                        {formatRupiah(Number(pphOp.tax))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="notice notice--info mt-3">
              <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
              <span>{t.tax.saveDialogNote}</span>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              disabled={!canSaveTaxRecord || upsertMutation.isPending}
              onClick={handleSaveTaxRecord}
            >
              {upsertMutation.isPending
                ? t.tax.savingLabel
                : t.tax.saveDialogConfirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
