"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, HandHeart } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  HeroCard,
  SectionCard,
  StatusBadge,
  InfoTip,
  SummaryCard,
  DateField,
} from "@/components/wm";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formatManualDate } from "@/components/consolidated-total-card";
import { useApiError } from "@/hooks/use-api-error";
import { useDebounce } from "@/hooks/use-debounce";
import {
  FAMILY_RELIGION_OPTIONS,
  TITHE_RELIGIONS,
} from "@/hooks/family-religion-options";
import {
  useFamilyReligion,
  type FamilyReligion,
} from "@/hooks/use-family-religion";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useLocale } from "@/hooks/use-locale";
import { mergeReferenceOptions } from "@/hooks/reference-options";
import { useReferenceItems } from "@/hooks/use-reference-items";
import { AddToMasterDataLink } from "@/components/crud";
import {
  MoneyInput,
  useMoneyField,
  moneyIdr,
  withFxInputs,
} from "@/components/money";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah, parseRupiah, formatAmountInput } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  AccountDto,
  CreateDonationDto,
  DonationDto,
  DonationType,
  ZakatResultDto,
} from "@wealthme/contracts";

const DONATION_TYPE_ICON: Record<string, string> = {
  zakat_maal: "🕌",
  zakat_fitrah: "🍚",
  infaq: "💝",
  sedekah: "💝",
  wakaf: "🏫",
  // EPIC-023 F2 (D20, US-DON-6/7) — the obligatory Christian contribution.
  persepuluhan: "✝️",
  lainnya: "🎗️",
};

const DONATION_TYPE_BG: Record<string, string> = {
  zakat_maal: "#DCFCE7",
  zakat_fitrah: "#DCFCE7",
  infaq: "#DBEAFE",
  sedekah: "#DBEAFE",
  wakaf: "#EDE9FE",
  persepuluhan: "#FEE2E2",
  lainnya: "#FEF9C3",
};

const JENIS_OPTIONS: {
  value: DonationType;
  group: "islam" | "kristen" | "umum";
}[] = [
  { value: "zakat_maal", group: "islam" },
  { value: "zakat_fitrah", group: "islam" },
  { value: "infaq", group: "islam" },
  { value: "wakaf", group: "islam" },
  { value: "persepuluhan", group: "kristen" },
  { value: "sedekah", group: "umum" },
  { value: "lainnya", group: "umum" },
];

// EPIC-022 E5 / EPIC-023 F2 (D20, US-DON-6/7) — PP 60/2010's tax-deductible
// "sumbangan keagamaan yang sifatnya wajib" covers zakat (Muslim) AND
// persepuluhan (Christian, paid to a recognised church) — never a
// voluntary offering. Mirrors the server-side check in
// `donations.service.ts`, which is the actual enforcement — this only
// keeps the checkbox from inviting a state the API would reject.
const TAX_DEDUCTIBLE_DONATION_TYPES: ReadonlySet<DonationType> = new Set([
  "zakat_maal",
  "zakat_fitrah",
  "persepuluhan",
]);

// NOTE: these are the actual `recipient` values persisted on a donation
// record (free-text institution name), not a translated enum — kept in
// Indonesian in both locales so switching language never changes what gets
// stored, matching the value-locked crud-config select option convention.
// Revisi H final-review fix — entries that overlap the Master Data seed
// (`REFERENCE_ITEM_DEFAULTS.lembaga` in packages/contracts) must use its
// exact spelling, or the merge in `mergeReferenceOptions` shows both as
// near-duplicate options ("Pura / Parisada" + "Vihara" next to the seed's
// "Pura / Vihara"). "Lainnya" and the static-only entries below (no seed
// counterpart) are unaffected.
const LEMBAGA_OPTIONS = [
  "BAZNAS",
  "Dompet Dhuafa",
  "Rumah Zakat",
  "LAZ Lokal / Masjid",
  "Gereja / Paroki",
  "Yayasan Keagamaan",
  "Pura / Vihara",
  "Yayasan Sosial",
  "Lainnya",
];

// EPIC-025 N3 audit fix (mirrors dana/rekening) — `Account.maskedNumber`
// can carry an undecrypted ciphertext blob for legacy rows; never render
// that verbatim as the account subtitle.
const UNDECRYPTED_BLOB_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;
function safeMaskedNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  return UNDECRYPTED_BLOB_RE.test(value) ? null : value;
}

// Batch 8 item 6 — some accounts' `maskedNumber` is a full, un-masked raw
// number (a legacy row predating server-side masking, per the audit-fix
// note above), not the "···9010" shape the API normally returns. Blindly
// prefixing "···" onto that raw value doubled up the mask glyph AND still
// leaked every digit. Mask it ourselves whenever it looks like a bare
// digit run; leave an already-masked value untouched.
function maskAccountNumber(value: string): string {
  return /^\d{5,}$/.test(value) ? `···${value.slice(-4)}` : value;
}

function formatAccountLabel(account: AccountDto | undefined): string | null {
  if (!account) return null;
  const masked = safeMaskedNumber(account.maskedNumber);
  return masked ? `${account.name} ${maskAccountNumber(masked)}` : account.name;
}

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
        className="input"
      />
    </div>
  );
}

function formatLocaleDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DonationPage() {
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const fgId = session?.familyGroupId ?? undefined;
  const token = session?.accessToken;

  // EPIC-023 F2 (D20, US-DON-6/7) — the family religion setting decides
  // which calculator below is shown: zakat (islam), perpuluhan (kristen),
  // or neither (none) — never a generic/fabricated default.
  // EPIC-023 Group F fix round (HIGH 4) — `religion` is `null` while still
  // loading AND on a permanent fetch failure; `isReligionLoading`/
  // `isReligionError` below are what tell those two apart from an honest
  // "family hasn't chosen yet" — falling through to any one calculator
  // (zakat included) on error/loading was the bug this fixes.
  const {
    religion,
    isLoading: isReligionLoading,
    isError: isReligionError,
    isOwner: isReligionOwner,
    updateReligion,
    isUpdating: isReligionUpdating,
  } = useFamilyReligion();

  // EPIC-024 Group I (I1, D12, US-DON-8) — inline "choose family religion"
  // prompt lives on this page now instead of only in Akun settings, so a
  // family that has never chosen sees the calculator appear immediately
  // after saving instead of having to navigate to Akun and back.
  const [pendingReligion, setPendingReligion] = useState<FamilyReligion | "">(
    "",
  );

  // Zakat Maal calculator — inputs are local, but the actual zakat/nisab
  // math is computed by the shared BE calculator (/calculators/zakat) so
  // this stays in sync with the kalkulator page and PPh21 deduction logic
  // instead of duplicating the formula + a stale nisab constant client-side.
  const [cash, setCash] = useState("");
  const [gold, setGold] = useState("");
  const [invest, setInvest] = useState("");
  const [debt, setDebt] = useState("");
  const [haulConfirmed, setHaulConfirmed] = useState(false);

  const debouncedCash = useDebounce(cash, 300);
  const debouncedGold = useDebounce(gold, 300);
  const debouncedInvest = useDebounce(invest, 300);
  const debouncedDebt = useDebounce(debt, 300);

  // E2 — nisab derives from the family's own gold price when the owner has
  // set one; the BE falls back to an indicative constant when omitted.
  const {
    pricePerGram: familyGoldPrice,
    updatedAt: familyGoldPriceUpdatedAt,
    hasPrice: hasFamilyGoldPrice,
  } = useGoldPrice();

  const zakatInput = {
    cash: parseRupiah(debouncedCash),
    investments: parseRupiah(debouncedInvest),
    gold: parseRupiah(debouncedGold),
    liabilities: parseRupiah(debouncedDebt),
    haulConfirmed,
    goldPricePerGram: hasFamilyGoldPrice
      ? (familyGoldPrice ?? undefined)
      : undefined,
  };

  const {
    data: zakatResult,
    isFetching: isZakatFetching,
    isError: isZakatError,
  } = useQuery<ZakatResultDto>({
    queryKey: ["calculators", "zakat", zakatInput],
    queryFn: () =>
      apiFetch<ZakatResultDto>("/calculators/zakat", {
        method: "POST",
        token,
        body: JSON.stringify(zakatInput),
      }),
    enabled: !!token,
    placeholderData: keepPreviousData,
  });

  // Whether the visible zakat figure is a trustworthy, fully-computed answer
  // (vs. still loading / errored) — gates both what we render and whether
  // "Pay Zakat Now" is allowed, so we never prefill/persist a donation with
  // a stale or default-zero amount the server hasn't actually confirmed.
  const hasZakatResult = !!zakatResult;
  const meetsNisab = zakatResult?.meetsNisab ?? false;
  // E1 — a balance-sheet snapshot alone can never confirm haul: the CTA and
  // message below only assert "wajib" once the server also confirms
  // `isObligated` (nisab met AND haul confirmed by the checkbox above).
  const isObligated = zakatResult?.isObligated ?? false;
  const nisab = zakatResult?.nisab ?? 0;
  const zakat = zakatResult?.zakat ?? 0;
  const nisabMessage = !meetsNisab
    ? `${t.donation.nisabNotReachedPrefix}${formatRupiah(nisab)}${t.donation.nisabNotReachedSuffix}`
    : isObligated
      ? `${t.donation.nisabReachedObligatedPrefix}${formatRupiah(nisab)}${t.donation.nisabReachedObligatedSuffix}`
      : `${t.donation.nisabReachedEstimatePrefix}${formatRupiah(nisab)}${t.donation.nisabReachedEstimateSuffix}`;
  const nisabSourceNote =
    zakatResult?.nisabSource === "family"
      ? `${t.donation.nisabFamilyPricePrefix}${formatRupiah(familyGoldPrice ?? 0)}${t.donation.nisabFamilyPriceSuffix}${
          familyGoldPriceUpdatedAt
            ? ` ${t.consolidatedTotal.manualLabelPrefix}${formatManualDate(familyGoldPriceUpdatedAt, locale)}`
            : ""
        }`
      : t.donation.nisabIndicativeNote;
  const canPayZakatNow = hasZakatResult && !isZakatFetching && !isZakatError;

  // Perpuluhan (tithe) calculator — EPIC-023 F2 (D20, US-DON-6/7) / N3-C1
  // (prototype donation.html "Kalkulator Perpuluhan"): pure client-side
  // arithmetic — (income + other income) × an adjustable rate% — matching
  // the prototype's own three inputs. No backend call needed; its own
  // arithmetic, not zakat relabelled.
  const [titheIncome, setTitheIncome] = useState("");
  const [titheOther, setTitheOther] = useState("");
  const [titheRate, setTitheRate] = useState("10");
  const titheRateNum = Math.min(100, Math.max(0, Number(titheRate) || 0));
  const titheBase = parseRupiah(titheIncome) + parseRupiah(titheOther);
  const tithe = titheBase * (titheRateNum / 100);
  const canPayPerpuluhanNow = tithe > 0;
  const showPerpuluhanPrototypeCalculator =
    !isReligionLoading &&
    !isReligionError &&
    religion !== null &&
    TITHE_RELIGIONS.has(religion);

  // Donation modal state
  const [open, setOpen] = useState(false);
  const [jenis, setJenis] = useState<DonationType>("zakat_maal");
  const jumlahField = useMoneyField();
  const [lembaga, setLembaga] = useState(LEMBAGA_OPTIONS[0]);
  const { items: lembagaItems } = useReferenceItems("lembaga");
  const lembagaOptions = mergeReferenceOptions(
    lembagaItems.map((i) => i.label),
    LEMBAGA_OPTIONS,
    lembaga,
  );
  const [tanggal, setTanggal] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [isTaxDeductible, setIsTaxDeductible] = useState(false);
  const [accountId, setAccountId] = useState("");
  // E5 — only zakat (to an approved amil) may be marked tax deductible.
  const isDeductibleEligible = TAX_DEDUCTIBLE_DONATION_TYPES.has(jenis);

  // Fetch donations list
  const { data: donations = [], isLoading } = useQuery<DonationDto[]>({
    queryKey: fgId ? queryKeys.donations.list(fgId) : ["donations-disabled"],
    queryFn: () =>
      apiFetch<DonationDto[]>(`/family-groups/${fgId}/donations`, { token }),
    enabled: !!fgId && !!token,
  });

  // Accounts — lets the user pick a source account so the donation actually
  // deducts from net worth via a linked expense transaction (optional).
  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: fgId ? queryKeys.accounts.all(fgId) : ["accounts-disabled"],
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${fgId}/accounts`, { token }),
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
      if (fgId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.donations.list(fgId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.accounts.all(fgId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.summary(fgId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.netWorth.summary(fgId),
        });
      }
      setOpen(false);
      toast.success(t.donation.toastSaved);
    },
    onError: (err) => {
      // F1 — surface the server's real message instead of a generic constant.
      handleError(err);
    },
  });

  // EPIC-023 F2 (D20) — `prefill` widened from a boolean (zakat-only) to
  // which calculator triggered the modal, so "Tunaikan Persepuluhan
  // Sekarang" prefills its own type/amount/recipient instead of always
  // assuming zakat.
  // EPIC-033 R1 — the type list follows the family religion: Islam sees
  // zakat/infaq/wakaf, Kristen/Katolik see persepuluhan, Hindu/Buddha only
  // the general types. No religion set = every type.
  const allowedJenisOptions = JENIS_OPTIONS.filter((o) => {
    if (o.group === "umum" || religion === null || religion === "none") {
      return true;
    }
    if (o.group === "islam") return religion === "islam";
    return TITHE_RELIGIONS.has(religion);
  });

  function openModal(prefill?: "zakat" | "perpuluhan"): void {
    if (
      !allowedJenisOptions.some((o) => o.value === jenis) &&
      allowedJenisOptions.length > 0
    ) {
      setJenis(allowedJenisOptions[0].value);
    }
    if (prefill === "zakat") {
      setJenis("zakat_maal");
      jumlahField.reset(String(zakat));
      setLembaga("BAZNAS");
      setIsTaxDeductible(true);
    } else if (prefill === "perpuluhan") {
      setJenis("persepuluhan");
      jumlahField.reset(String(tithe));
      setLembaga("Gereja / Paroki");
      setIsTaxDeductible(true);
    } else {
      jumlahField.reset();
      setIsTaxDeductible(false);
    }
    setAccountId("");
    setOpen(true);
  }

  function handleSave(): void {
    const amountNum = moneyIdr(jumlahField, parseRupiah);
    if (!amountNum || amountNum <= 0) {
      toast.error(t.donation.toastInvalidAmount);
      return;
    }
    if (jumlahField.resolved.isPending) return;
    createMutation.mutate(
      withFxInputs(
        {
          type: jenis,
          recipient: lembaga,
          amount: String(amountNum),
          donatedAt: new Date(tanggal).toISOString(),
          // E5 — never send a deductible flag the API would reject for this type.
          isTaxDeductible: isTaxDeductible && isDeductibleEligible,
          accountId: accountId || undefined,
        },
        [["amount", jumlahField]],
      ),
    );
  }

  // Compute category totals from API data
  const totalAmount = donations.reduce((s, d) => s + Number(d.amount), 0);

  // N3-D4 (prototype donation.html "auto-grid--metrics") — every figure
  // below derives from the already-fetched donations list, no new endpoint.
  const currentYear = new Date().getFullYear();
  const donationsThisYear = donations.filter(
    (d) => new Date(d.donatedAt).getFullYear() === currentYear,
  );
  const deductibleThisYear = donationsThisYear.filter((d) => d.isTaxDeductible);
  const deductibleAmount = deductibleThisYear.reduce(
    (s, d) => s + Number(d.amount),
    0,
  );
  const voluntaryAmount = donationsThisYear
    .filter((d) => !d.isTaxDeductible)
    .reduce((s, d) => s + Number(d.amount), 0);
  const receiptsSavedCount = donations.filter((d) => d.receiptUrl).length;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard className="gradient-emerald">
        <div className="mb-1.5 flex items-center gap-2 text-xs opacity-85">
          <HandHeart className="size-3.5" /> {t.donation.heroTitle}
        </div>
        <div className="text-[30px] font-black tracking-[-1px]">
          {formatRupiah(totalAmount)}
        </div>
        <div className="mt-1.5 text-xs opacity-85">
          {donations.length}
          {t.donation.transactionsSuffix}
          {t.donation.yearRunningPrefix}
          {currentYear}
        </div>
        {/* Task 10 carry (sub-plan L, /tax review) — `.hero > *`
            (design-system.css, protected) forces `position: relative` on
            every direct child, winning the specificity tie against
            Tailwind's `.absolute` by source order and putting this glyph
            back in normal flow, clipped by `.hero`'s `overflow: hidden`
            instead of intentionally peeking past the corner. The inline
            style wins over both classes without touching the protected
            sheet. */}
        <div
          className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-[0.12]"
          style={{ position: "absolute" }}
        >
          🤲
        </div>
      </HeroCard>

      {/* Subheader + action */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={() => openModal()} className="h-auto px-4 py-2.5">
          <Plus className="size-4" /> {t.donation.recordDonationButton}
        </Button>
      </div>

      {/* Kalkulator donasi keagamaan — EPIC-023 F2 (D20, US-DON-6/7): the
          calculator shown matches the family's religion setting; `none`
          shows an honest "not configured" note instead of fabricating a
          default faith. EPIC-023 Group F fix round (HIGH 4 / MEDIUM 9) —
          loading and error states render their OWN honest note instead of
          falling through to any calculator (zakat included), and a family
          that has never chosen (`religion === null`) gets an explicit
          prompt to choose rather than silently showing nothing. */}
      {isReligionLoading && (
        <div className="flex items-center gap-3 rounded-[14px] border bg-card p-4">
          <div className="text-[13px] text-muted-foreground">
            {t.donation.religionLoadingMsg}
          </div>
        </div>
      )}

      {!isReligionLoading && isReligionError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          {t.donation.religionErrorMsg}
        </div>
      )}

      {!isReligionLoading && !isReligionError && religion === null && (
        <div className="rounded-[14px] border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13.5px] font-bold">
              {t.donation.religionCalculatorUnconfirmedTitle}
            </div>
            <InfoTip>{t.donation.religionCalculatorUnconfirmedDesc}</InfoTip>
          </div>
          {isReligionOwner ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                aria-label={t.akun.pengaturan.religionLabel}
                className="select sm:max-w-[240px]"
                value={pendingReligion}
                disabled={isReligionUpdating}
                onChange={(e) =>
                  setPendingReligion(e.target.value as FamilyReligion)
                }
              >
                <option value="" disabled>
                  {t.akun.pengaturan.religionUnconfirmedPlaceholder}
                </option>
                {FAMILY_RELIGION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {t.akun.pengaturan.religionOptions[r]}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => {
                  if (!pendingReligion) return;
                  updateReligion(pendingReligion, {
                    onSuccess: () =>
                      toast.success(t.akun.pengaturan.toastReligionUpdated),
                    onError: () =>
                      toast.error(t.akun.pengaturan.toastReligionFailed),
                  });
                }}
                disabled={!pendingReligion || isReligionUpdating}
                className="h-auto shrink-0 px-4 py-2.5"
              >
                {t.akun.pengaturan.religionSaveButton}
              </Button>
            </div>
          ) : (
            <div className="mt-3 text-xs text-muted-foreground">
              {t.akun.pengaturan.religionOwnerOnlyNote}
            </div>
          )}
        </div>
      )}

      {!isReligionLoading && !isReligionError && religion === "islam" && (
        <SectionCard
          title={t.donation.zakatCalculatorTitle}
          action={<InfoTip>{t.donation.zakatCalculatorSubtitle}</InfoTip>}
        >
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <ZkInput
              label={t.donation.fieldCashLabel}
              value={cash}
              onChange={setCash}
            />
            <ZkInput
              label={t.donation.fieldGoldLabel}
              value={gold}
              onChange={setGold}
            />
            <ZkInput
              label={t.donation.fieldInvestLabel}
              value={invest}
              onChange={setInvest}
            />
            <ZkInput
              label={t.donation.fieldDebtLabel}
              value={debt}
              onChange={setDebt}
            />
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <input
              id="donation-zakat-haul"
              type="checkbox"
              checked={haulConfirmed}
              onChange={(e) => setHaulConfirmed(e.target.checked)}
              className="size-4 accent-primary"
            />
            <label
              htmlFor="donation-zakat-haul"
              className="text-[12.5px] text-muted-foreground"
            >
              {t.donation.haulCheckboxLabel}
            </label>
          </div>
          <div className="mt-4 rounded-[12px] border border-primary/15 bg-accent p-4 text-center">
            <div className="text-[11.5px] text-muted-foreground">
              {t.donation.zakatDueLabel}
            </div>
            {isZakatError ? (
              <div className="mt-1 text-[13px] font-semibold text-destructive">
                {t.donation.zakatCalcErrorMsg}
              </div>
            ) : !hasZakatResult ? (
              <div className="mt-1 text-[13px] text-muted-foreground">
                {t.donation.zakatCalculatingMsg}
              </div>
            ) : (
              <>
                <div className="mt-1 text-[24px] font-black text-primary">
                  {formatRupiah(zakat)}
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {nisabMessage}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground/80">
                  {nisabSourceNote}
                </div>
              </>
            )}
          </div>
          <Button
            onClick={() => openModal("zakat")}
            disabled={!canPayZakatNow}
            className="mt-3.5 h-auto px-4 py-2.5"
          >
            <HandHeart className="size-4" />{" "}
            {isObligated
              ? t.donation.payZakatNowButton
              : t.donation.recordZakatEstimateButton}
          </Button>
        </SectionCard>
      )}

      {/* Kalkulator Persepuluhan — N3-C1 (prototype donation.html "Kalkulator
          Perpuluhan"): its own arithmetic (income + other income) × an
          adjustable rate, not zakat relabelled (US-DON-6). Pure client-side
          math — no backend round-trip needed for a percentage calculation. */}
      {showPerpuluhanPrototypeCalculator && (
        <SectionCard
          title={t.donation.perpuluhanCalculatorTitle}
          action={
            <InfoTip>
              {t.donation.perpuluhanCalculatorSubtitle}{" "}
              {t.donation.fieldRateHint}
            </InfoTip>
          }
        >
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <ZkInput
              label={t.donation.fieldIncomeLabel}
              value={titheIncome}
              onChange={setTitheIncome}
            />
            <ZkInput
              label={t.donation.fieldOtherIncomeLabel}
              value={titheOther}
              onChange={setTitheOther}
            />
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
                {t.donation.fieldRateLabel}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={titheRate}
                onChange={(e) => setTitheRate(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div className="mt-4 rounded-[12px] border border-primary/15 bg-accent p-4 text-center">
            <div className="text-[11.5px] text-muted-foreground">
              {t.donation.perpuluhanResultLabel}
            </div>
            <div className="mt-1 text-[24px] font-black text-primary">
              {formatRupiah(tithe)}
            </div>
          </div>
          <Button
            onClick={() => openModal("perpuluhan")}
            disabled={!canPayPerpuluhanNow}
            className="mt-3.5 h-auto px-4 py-2.5"
          >
            <HandHeart className="size-4" /> {t.donation.recordPerpuluhanButton}
          </Button>
        </SectionCard>
      )}

      {!isReligionLoading &&
        !isReligionError &&
        (religion === "none" ||
          religion === "hindu" ||
          religion === "buddha") && (
          <div className="flex items-center justify-between gap-3 rounded-[14px] border bg-card p-4">
            <div className="text-[13.5px] font-bold">
              {religion === "none"
                ? t.donation.religionCalculatorNoneTitle
                : t.donation.religionGeneralOnlyTitle}
            </div>
            <InfoTip>
              {religion === "none"
                ? t.donation.religionCalculatorNoneDesc
                : t.donation.religionGeneralOnlyDesc}
            </InfoTip>
          </div>
        )}

      {/* Riwayat Donasi */}
      <SectionCard
        title={t.donation.historyTitle}
        bodyClassName="-mt-1"
        action={
          <div className="flex items-center gap-1">
            <InfoTip>
              <strong>{t.donation.insightTitle}</strong>{" "}
              {t.donation.insightDesc}
            </InfoTip>
            <Link
              href="/laporan"
              className="text-xs font-semibold whitespace-nowrap text-primary hover:underline"
            >
              {t.donation.historyLaporanLink}
            </Link>
          </div>
        }
      >
        {isLoading ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            {t.donation.loadingLabel}
          </div>
        ) : donations.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            {t.donation.emptyHistory}
          </div>
        ) : (
          donations.map((d) => {
            const accountLabel = formatAccountLabel(
              accounts.find((a) => a.id === d.accountId),
            );
            return (
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
                {/* UI/UX audit fix (docs/uiux-beda) — flex-1 without min-w-0
                    lets this column's content dictate its width, so a long
                    date · account · receipt line pushes the row wider than
                    the card on narrow viewports instead of wrapping. */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">
                    {t.donation.typeLabels[d.type as DonationType] ?? d.type}:{" "}
                    {d.recipient}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    <span className="break-words">
                      {formatLocaleDate(d.donatedAt, locale)}
                      {accountLabel && `, ${accountLabel}`}
                    </span>
                    {d.receiptUrl && (
                      <>
                        {", "}
                        <a
                          href={d.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {t.donation.receiptLabel}
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-[13.5px] font-bold">
                    {formatRupiah(Number(d.amount))}
                  </span>
                  <StatusBadge
                    variant={d.isTaxDeductible ? "success" : "gray"}
                    className="text-[10px]"
                  >
                    {d.isTaxDeductible
                      ? t.donation.taxDeductibleBadge
                      : t.donation.taxNonDeductibleBadge}
                  </StatusBadge>
                </div>
              </div>
            );
          })
        )}
      </SectionCard>

      {/* N3-D4 (prototype donation.html "auto-grid--metrics") — all three
          derive from the already-fetched donations list above; "Kuitansi
          Tersimpan" honestly reflects `receiptUrl` (0/N until a receipt
          upload flow exists — no fabricated completeness). */}
      {!isLoading && donations.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <SummaryCard
            icon="🧾"
            iconBg="var(--success-soft)"
            iconColor="var(--success)"
            label={`${t.donation.statDeductibleLabelPrefix}${currentYear}`}
            amount={formatRupiah(deductibleAmount)}
            delta={`${deductibleThisYear.length}${t.donation.statDeductibleDeltaMid}${donationsThisYear.length}${t.donation.statDeductibleDeltaSuffix}`}
          />
          <SummaryCard
            icon="💝"
            iconBg="var(--accent)"
            iconColor="var(--accent-foreground)"
            label={t.donation.statVoluntaryLabel}
            amount={formatRupiah(voluntaryAmount)}
            delta={t.donation.statVoluntaryDelta}
          />
          <SummaryCard
            icon="📄"
            iconBg="var(--brand-purple-soft)"
            iconColor="var(--brand-purple)"
            label={t.donation.statReceiptsLabel}
            amount={`${receiptsSavedCount} / ${donations.length}`}
            delta={
              receiptsSavedCount === donations.length
                ? t.donation.statReceiptsComplete
                : t.donation.statReceiptsIncomplete
            }
            deltaUp={receiptsSavedCount === donations.length}
          />
        </div>
      )}

      {/* Donation modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* EPIC-026 — composition ported 1:1 from the prototype's
            `dlg-donasi` (docs/prototype/pages/donation.html:170): title +
            `.dialog__desc`, then the prototype's field ORDER — jenis →
            lembaga → jumlah → tanggal → rekening (+`.hint`) — followed by
            the tax-deduction `.switch` row with its own `.hint`, and a
            Batal / Simpan Catatan `.dialog__footer`. */}
        <DialogContent>
          <DialogTitle>{t.donation.modalTitle}</DialogTitle>

          <DialogBody>
            <div className="field">
              <label className="label" htmlFor="dn-jenis">
                {t.donation.fieldJenisLabel}
              </label>
              <select
                id="dn-jenis"
                value={jenis}
                onChange={(e) => {
                  const next = e.target.value as DonationType;
                  setJenis(next);
                  // E5 — deductibility is restricted to zakat; switching away
                  // from a qualifying type must not leave a stale checked box.
                  if (!TAX_DEDUCTIBLE_DONATION_TYPES.has(next)) {
                    setIsTaxDeductible(false);
                  }
                }}
                className="select"
              >
                {allowedJenisOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t.donation.jenisOptionLabels[o.value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="dn-lembaga">
                {t.donation.fieldLembagaLabel}
              </label>
              <select
                id="dn-lembaga"
                value={lembaga}
                onChange={(e) => setLembaga(e.target.value)}
                className="select"
              >
                {lembagaOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <AddToMasterDataLink group="lembaga" />
            </div>

            <div className="field">
              <label className="label" htmlFor="dn-jumlah">
                {t.donation.fieldJumlahLabel}
              </label>
              <MoneyInput field={jumlahField} id="dn-jumlah" />
            </div>

            <div className="field">
              <label className="label" htmlFor="dn-tanggal">
                {t.donation.fieldTanggalLabel}
              </label>
              <DateField
                id="dn-tanggal"
                value={tanggal}
                locale={locale}
                label={t.donation.fieldTanggalLabel}
                onChange={setTanggal}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="dn-rekening">
                {t.donation.fieldAccountLabel}
              </label>
              <select
                id="dn-rekening"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="select"
              >
                <option value="">{t.donation.accountNoneOption}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* polish-j batch 7a item 5 — the account hint, the switch
                description, and the ineligibility note used to be 3
                separate lines saying overlapping things; one line now
                covers both what qualifies and why the toggle is disabled. */}
            <div className="row row--between mt-3.5 items-start gap-3">
              <div className="pr-3">
                <div className="t-sm t-bold" id="dn-deductible-label">
                  {t.donation.taxDeductibleSwitchTitle}
                </div>
                <div className="t-xs t-muted">
                  {t.donation.taxDeductibleSwitchDesc}
                </div>
              </div>
              <Switch
                id="dn-deductible"
                aria-labelledby="dn-deductible-label"
                checked={isTaxDeductible && isDeductibleEligible}
                disabled={!isDeductibleEligible}
                onCheckedChange={(checked) => setIsTaxDeductible(checked)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                createMutation.isPending || jumlahField.resolved.isPending
              }
            >
              <HandHeart className="size-4" />{" "}
              {createMutation.isPending
                ? t.donation.savingLabel
                : t.donation.saveRecordButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
