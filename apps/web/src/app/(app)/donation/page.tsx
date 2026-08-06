"use client";

import { useState } from "react";
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
import { HeroCard, SectionCard, StatusBadge } from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatManualDate } from "@/components/consolidated-total-card";
import { useDebounce } from "@/hooks/use-debounce";
import { useFamilyReligion } from "@/hooks/use-family-religion";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah, parseRupiah, formatAmountInput } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  AccountDto,
  CreateDonationDto,
  DonationDto,
  DonationType,
  PerpuluhanResultDto,
  ZakatResultDto,
} from "@wealthme/contracts";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

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
  const fgId = session?.familyGroupId ?? undefined;
  const token = session?.accessToken;

  // EPIC-023 F2 (D20, US-DON-6/7) — the family religion setting decides
  // which calculator below is shown: zakat (islam), perpuluhan (kristen),
  // or neither (none) — never a generic/fabricated default.
  const { religion } = useFamilyReligion();

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

  // Perpuluhan (tithe) calculator — EPIC-023 F2 (D20, US-DON-6/7): its own
  // arithmetic (10% of income), computed by the shared BE calculator
  // (/calculators/perpuluhan), not zakat relabelled.
  const [income, setIncome] = useState("");
  const debouncedIncome = useDebounce(income, 300);
  const perpuluhanInput = { income: parseRupiah(debouncedIncome) };

  const {
    data: perpuluhanResult,
    isFetching: isPerpuluhanFetching,
    isError: isPerpuluhanError,
  } = useQuery<PerpuluhanResultDto>({
    queryKey: ["calculators", "perpuluhan", perpuluhanInput],
    queryFn: () =>
      apiFetch<PerpuluhanResultDto>("/calculators/perpuluhan", {
        method: "POST",
        token,
        body: JSON.stringify(perpuluhanInput),
      }),
    enabled: !!token && religion === "kristen",
    placeholderData: keepPreviousData,
  });
  const hasPerpuluhanResult = !!perpuluhanResult;
  const tithe = perpuluhanResult?.tithe ?? 0;
  const canPayPerpuluhanNow =
    hasPerpuluhanResult && !isPerpuluhanFetching && !isPerpuluhanError;

  // Donation modal state
  const [open, setOpen] = useState(false);
  const [jenis, setJenis] = useState<DonationType>("zakat_maal");
  const [jumlah, setJumlah] = useState("");
  const [lembaga, setLembaga] = useState(LEMBAGA_OPTIONS[0]);
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
    onError: () => {
      toast.error(t.donation.toastSaveFailed);
    },
  });

  // EPIC-023 F2 (D20) — `prefill` widened from a boolean (zakat-only) to
  // which calculator triggered the modal, so "Tunaikan Persepuluhan
  // Sekarang" prefills its own type/amount/recipient instead of always
  // assuming zakat.
  function openModal(prefill?: "zakat" | "perpuluhan"): void {
    if (prefill === "zakat") {
      setJenis("zakat_maal");
      setJumlah(formatAmountInput(String(zakat)));
      setLembaga("BAZNAS");
      setIsTaxDeductible(true);
    } else if (prefill === "perpuluhan") {
      setJenis("persepuluhan");
      setJumlah(formatAmountInput(String(tithe)));
      setLembaga("Gereja / Paroki");
      setIsTaxDeductible(true);
    } else {
      setJumlah("");
      setIsTaxDeductible(false);
    }
    setAccountId("");
    setOpen(true);
  }

  function handleSave(): void {
    const amountNum = parseRupiah(jumlah);
    if (!amountNum || amountNum <= 0) {
      toast.error(t.donation.toastInvalidAmount);
      return;
    }
    createMutation.mutate({
      type: jenis,
      recipient: lembaga,
      amount: String(amountNum),
      donatedAt: new Date(tanggal).toISOString(),
      // E5 — never send a deductible flag the API would reject for this type.
      isTaxDeductible: isTaxDeductible && isDeductibleEligible,
      accountId: accountId || undefined,
    });
  }

  // Compute category totals from API data
  const totalAmount = donations.reduce((s, d) => s + Number(d.amount), 0);

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
        </div>
        <div className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-[0.12]">
          🤲
        </div>
      </HeroCard>

      {/* Subheader + action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-muted-foreground">
          {t.donation.subheaderDesc}
        </div>
        <Button onClick={() => openModal()} className="h-auto px-4 py-2.5">
          <Plus className="size-4" /> {t.donation.recordDonationButton}
        </Button>
      </div>

      {/* Kalkulator donasi keagamaan — EPIC-023 F2 (D20, US-DON-6/7): the
          calculator shown matches the family's religion setting; `none`
          shows an honest "not configured" note instead of fabricating a
          default faith. */}
      {religion === "islam" && (
        <SectionCard title={t.donation.zakatCalculatorTitle}>
          <div className="mb-3.5 text-xs text-muted-foreground">
            {t.donation.zakatCalculatorSubtitle}
          </div>
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

      {/* Kalkulator Persepuluhan — its own arithmetic (10% of income), not
          zakat relabelled (US-DON-6). */}
      {religion === "kristen" && (
        <SectionCard title={t.donation.perpuluhanCalculatorTitle}>
          <div className="mb-3.5 text-xs text-muted-foreground">
            {t.donation.perpuluhanCalculatorSubtitle}
          </div>
          <ZkInput
            label={t.donation.fieldIncomeLabel}
            value={income}
            onChange={setIncome}
          />
          <div className="mt-4 rounded-[12px] border border-primary/15 bg-accent p-4 text-center">
            <div className="text-[11.5px] text-muted-foreground">
              {t.donation.perpuluhanDueLabel}
            </div>
            {isPerpuluhanError ? (
              <div className="mt-1 text-[13px] font-semibold text-destructive">
                {t.donation.perpuluhanCalcErrorMsg}
              </div>
            ) : !hasPerpuluhanResult ? (
              <div className="mt-1 text-[13px] text-muted-foreground">
                {t.donation.perpuluhanCalculatingMsg}
              </div>
            ) : (
              <div className="mt-1 text-[24px] font-black text-primary">
                {formatRupiah(tithe)}
              </div>
            )}
          </div>
          <Button
            onClick={() => openModal("perpuluhan")}
            disabled={!canPayPerpuluhanNow}
            className="mt-3.5 h-auto px-4 py-2.5"
          >
            <HandHeart className="size-4" /> {t.donation.payPerpuluhanNowButton}
          </Button>
        </SectionCard>
      )}

      {religion === "none" && (
        <div className="flex items-center gap-3 rounded-[14px] border bg-card p-4">
          <div className="text-[24px]">🤲</div>
          <div className="flex-1">
            <div className="text-[13px] font-bold">
              {t.donation.religionCalculatorNoneTitle}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t.donation.religionCalculatorNoneDesc}
            </div>
          </div>
        </div>
      )}

      {/* Riwayat Donasi */}
      <SectionCard title={t.donation.historyTitle} bodyClassName="-mt-1">
        {isLoading ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            {t.donation.loadingLabel}
          </div>
        ) : donations.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            {t.donation.emptyHistory}
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
                  {t.donation.typeLabels[d.type as DonationType] ?? d.type} —{" "}
                  {d.recipient}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {formatLocaleDate(d.donatedAt, locale)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[13.5px] font-bold text-destructive">
                  -{formatRupiah(Number(d.amount))}
                </div>
                {d.isTaxDeductible && (
                  <StatusBadge variant="success" className="mt-0.5 text-[10px]">
                    {t.donation.taxDeductibleBadge}
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
            {t.donation.insightTitle}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {t.donation.insightDesc}
          </div>
        </div>
      </div>

      {/* Donation modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">
            {t.donation.modalTitle}
          </DialogTitle>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.donation.fieldJenisLabel}
              </label>
              <select
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
                className={FIELD_CLASS}
              >
                {JENIS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.group === "islam"
                      ? t.donation.groupIslam
                      : o.group === "kristen"
                        ? t.donation.groupKristen
                        : t.donation.groupUmum}{" "}
                    — {t.donation.jenisOptionLabels[o.value]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.donation.fieldJumlahLabel}
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
                {t.donation.fieldLembagaLabel}
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
                {t.donation.fieldTanggalLabel}
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.donation.fieldAccountLabel}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">{t.donation.accountNoneOption}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.donation.accountHint}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <input
                  id="tax-deductible"
                  type="checkbox"
                  checked={isTaxDeductible && isDeductibleEligible}
                  disabled={!isDeductibleEligible}
                  onChange={(e) => setIsTaxDeductible(e.target.checked)}
                  className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
                <label
                  htmlFor="tax-deductible"
                  className={
                    "text-[12.5px] " +
                    (isDeductibleEligible
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60")
                  }
                >
                  {t.donation.taxDeductibleCheckboxLabel}
                </label>
              </div>
              {!isDeductibleEligible && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.donation.taxDeductibleIneligibleNote}
                </p>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="w-full"
            >
              <HandHeart className="size-4" />{" "}
              {createMutation.isPending
                ? t.donation.savingLabel
                : t.donation.saveRecordButton}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
