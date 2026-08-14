"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HeroCard, SectionCard, CardLink, StatusBadge } from "@/components/wm";
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

// EPIC-024 Group E (E1) — TaxRecord persists grossIncome/ptkp/netTax as
// Postgres BigInt (schema.prisma), and the API's Pph21RequestDto /
// CreateTaxRecordDto both cap accepted amounts at 999_999_999_999_999 (see
// pph21.dto.ts MAX_TAX_AMOUNT). Clamping client-side at the same ceiling
// keeps a mis-paste of a huge number from ever reaching the API only to
// bounce off a 400 the user can't make sense of. Field-agnostic name — the
// same ceiling clamps grossIncome AND zakatPaid (the API's Pph21RequestDto
// enforces the identical @Max on both).
export const MAX_TAX_INPUT = 999_999_999_999_999;

// Extract the digit string a Rupiah-formatted input actually represents,
// without ever round-tripping through a JS `number`. `String(aFloat)` uses
// exponential notation once the value hits 1e21 (e.g. "1e+21"), which fails
// the API's `/^\d+$/`-style numeric-string validation outright — building
// the payload from the raw digits sidesteps that class of bug entirely,
// on top of the MAX_TAX_INPUT clamp above.
export function toClampedDigitString(value: string, max: number): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digits === "") return "0";
  if (digits.length > String(max).length) return String(max);
  const asNumber = Number(digits);
  return asNumber > max ? String(max) : digits;
}

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
  // Prototype structural port follow-up — the calculator math itself is
  // year-independent (the BE brackets don't vary per year), but which
  // TaxRecord year a Save writes to genuinely is real, wired functionality
  // (TaxRecordDto.taxYear accepts any year), unlike a hero-level year
  // switcher which would have no distinct historical estimate to show.
  const [taxYear, setTaxYear] = useState(CURRENT_YEAR);
  // EPIC-026 Wave 2 — prototype structural port: the prototype gates Save
  // behind a review dialog ("Simpan ke Catatan Pajak") showing the exact
  // numbers about to be persisted; Save used to write through immediately
  // with no review step.
  const [showSaveDialog, setShowSaveDialog] = useState(false);

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
    //
    // EPIC-024 Group E (E1) — grossIncome used to be built with
    // `String(pph21Result.grossIncome)`. That's `String(aFloat)`, which for
    // a value at/above 1e21 serializes as scientific notation ("1e+21") and
    // fails the API's numeric-string regex with an opaque 400. `debouncedGross`
    // is the exact input `pph21Input.grossIncome` (and therefore this
    // `pph21Result`) was computed from — canSaveTaxRecord/isPph21Fetching
    // already guarantee the two are in sync — so extracting its digits
    // directly with `toClampedDigitString` never round-trips through a
    // `number` at all, and clamps to the same MAX_TAX_INPUT ceiling the
    // API now enforces. `ptkp` (one of the 5 fixed PTKP_OPTIONS values) and
    // `netTax` (bounded below the already-clamped gross income) stay well
    // under the range where `String()` on a number risks exponential
    // notation, so a plain `String()` is safe for those two.
    if (!pph21Result || !canSaveTaxRecord) return;
    upsertMutation.mutate(
      {
        taxYear,
        grossIncome: toClampedDigitString(debouncedGross, MAX_TAX_INPUT),
        ptkp: String(pph21Result.ptkp),
        netTax: String(Math.round(pph21Result.totalTax)),
      },
      { onSettled: () => setShowSaveDialog(false) },
    );
  }

  function handleResetCalculator(): void {
    setGross("");
    setZakat("");
    setPtkp(54000000);
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
              {prevRecord.sptStatus === "belum_lapor" &&
                renderMarkReportedButton(prevRecord.id)}
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
              {currentRecord.sptStatus === "belum_lapor" &&
                renderMarkReportedButton(currentRecord.id)}
            </>
          ) : (
            <>
              <div className="text-[16px] font-extrabold text-warning">
                {t.tax.sptStatusLabels.belum_lapor}
              </div>
              <div className="text-[10.5px] text-muted-foreground">
                {t.tax.deadlinePrefix}
                {CURRENT_YEAR + 1}
              </div>
            </>
          )}
        </Card>
        <Card className="gap-0 p-4">
          <div className="mb-1 text-[10.5px] text-muted-foreground">
            {t.tax.perpuluhanDeductionTitle}
          </div>
          <div className="text-[16px] font-extrabold text-primary">
            {currentRecord
              ? formatRupiah(Number(currentRecord.zakatDeduction))
              : t.tax.zakatDeductionDash}
          </div>
          <div className="text-[10.5px] text-muted-foreground">
            {t.tax.perpuluhanDeductionDesc}
          </div>
        </Card>
      </div>

      {/* Kalkulator PPh 21 */}
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
              className={FIELD_CLASS}
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
              className={FIELD_CLASS}
            />
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              {t.tax.grossInputHint}
            </div>
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
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              {t.tax.ptkpSelectedPrefix}
              <span className="mono">{formatRupiah(ptkp)}</span>
            </div>
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
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              {t.tax.jabatanHint}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
              {t.tax.fieldPerpuluhanLabel}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={zakat}
              onChange={(e) =>
                setZakat(
                  e.target.value === ""
                    ? ""
                    : formatNumber(
                        Math.min(parseRupiah(e.target.value), MAX_TAX_INPUT),
                      ),
                )
              }
              className={FIELD_CLASS}
            />
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              {t.tax.perpuluhanHint}
              <Link href="/donation" className="text-primary hover:underline">
                {t.tax.perpuluhanHintLinkLabel}
              </Link>
              .
            </div>
          </div>
        </div>
        <div className="notice notice--info mt-3.5 rounded-[10px] border border-primary/15 bg-accent/60 p-3 text-[11px] text-muted-foreground">
          {t.tax.payloadCalloutPrefix}
          <span className="mono">
            {`{ grossIncome: "${toClampedDigitString(debouncedGross, MAX_TAX_INPUT)}", ptkp: "${ptkp}", perpuluhanPaid: "${toClampedDigitString(debouncedZakat, MAX_TAX_INPUT)}" }`}
          </span>
          {t.tax.payloadCalloutSuffix}
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
              {BRACKET_ROWS.map((row) => {
                const layerAmt = taxBreakdown[row.idx]?.tax ?? 0;
                const taxableBase = taxBreakdown[row.idx]?.taxableAmount ?? 0;
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
                      {formatRupiah(Math.round(taxableBase))}
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
        <div className="mt-2.5 text-[11px] text-muted-foreground">
          {t.tax.bracketFootnote}
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
                <StatusBadge
                  variant={SPT_STATUS_BADGE_VARIANT[r.sptStatus as SptStatus]}
                >
                  {t.tax.sptStatusLabels[r.sptStatus as SptStatus]}
                </StatusBadge>
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

      {/* EPIC-026 Wave 2 — prototype structural port: review the exact
          numbers before Save actually persists (prototype's "Simpan ke
          Catatan Pajak" dialog). Every value here is the same
          server-echoed `pph21Result` `handleSaveTaxRecord` itself sends —
          never the raw, still-debouncing input state. */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-[min(420px,calc(100%-2rem))] p-6">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold">
              {t.tax.saveDialogTitle}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-muted-foreground">
            {t.tax.saveDialogDescPrefix}
            {taxYear}
          </p>
          {pph21Result && (
            <table className="w-full text-[12.5px]">
              <tbody>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground">
                    {t.tax.saveDialogGrossRow}
                  </td>
                  <td className="mono py-1.5 text-right font-semibold">
                    {formatRupiah(
                      Number(
                        toClampedDigitString(debouncedGross, MAX_TAX_INPUT),
                      ),
                    )}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground">
                    {t.tax.saveDialogPtkpRow}
                  </td>
                  <td className="mono py-1.5 text-right font-semibold">
                    {formatRupiah(pph21Result.ptkp)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground">
                    {t.tax.saveDialogPerpuluhanRow}
                  </td>
                  <td className="mono py-1.5 text-right font-semibold">
                    {formatRupiah(
                      Number(
                        toClampedDigitString(debouncedZakat, MAX_TAX_INPUT),
                      ),
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-bold">{t.tax.saveDialogTaxRow}</td>
                  <td className="mono py-1.5 text-right font-bold text-primary">
                    {formatRupiah(Math.round(pph21Result.totalTax))}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t.tax.saveDialogNote}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border py-2 text-[13px] font-semibold text-foreground"
              onClick={() => setShowSaveDialog(false)}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-primary py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
              disabled={!canSaveTaxRecord || upsertMutation.isPending}
              onClick={handleSaveTaxRecord}
            >
              {upsertMutation.isPending
                ? t.tax.savingLabel
                : t.tax.saveDialogConfirmButton}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
