"use client";

import { useEffect, useState } from "react";
import "./investasi.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  ArrowLeftRight,
  Calculator,
  ChevronDown,
  Info,
  PencilLine,
  Plus,
  RefreshCw,
  X as XIcon,
  Zap,
} from "lucide-react";

import {
  BentoCard,
  BentoGrid,
  BentoHero,
  CompositionStack,
  type CompositionItem,
  Delta,
  GhostButton,
  HeroKpi,
  Segmented,
  StatusBadge,
  DateField,
  PillButton,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { DateRangeFilterField } from "@/components/wm/date-range-field";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogBody,
  DialogClose,
  PanelContent,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RowActions, ConfirmDeleteDialog } from "@/components/crud";
import { formatManualDate } from "@/components/consolidated-total-card";
import { formatPercent } from "@/lib/format";
import { deltaDirection } from "@/lib/delta";
import { InvestmentTaxCard } from "@/components/tax/investment-tax-card";
import { useLocale } from "@/hooks/use-locale";
import { useApiError } from "@/hooks/use-api-error";
import { useCanManage } from "@/hooks/use-role-permissions";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useMoney } from "@/hooks/use-money";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { assetClassColor } from "@/lib/viz-colors";
import {
  canonicalizeSahamQuantity,
  convertQuantityDisplay,
  divideBy100,
  gramsToKg,
  kgToGrams,
  multiplyBy1000,
} from "./quantity-conversion";
import {
  formatQuantity,
  hasAtMostDecimals,
  maxQuantityDecimals,
  quantityStep,
  quantityUnitLabel,
} from "./instrument-units";

import {
  MoneyInput,
  anyMoneyPending,
  canonicalToTyping,
  moneyIdrDecimal,
  toCanonicalAmount,
  useControlledMoneyField,
  useMoneyField,
  withFxInputs,
} from "@/components/money";

import type { Locale } from "@/i18n";
import { investmentTypeToAssetClass } from "@wealthme/contracts";
import type {
  AccountDto,
  FxCurrencyCode,
  InvestmentDto,
  InvestmentPriceDto,
  InvestmentSummaryDto,
  InvestmentTransactionDto,
  InvestmentTxType,
} from "@wealthme/contracts";
import type { QuantityUnit } from "./quantity-conversion";
import type { UnitLabels } from "./instrument-units";
import { filterByOccurredAt } from "./history-filter";
import { hasLiveFeedPrice, hasMarketPrice } from "./holding-price";
import { localIsoDate } from "@/lib/local-date";

// Asset class is a category, not a status: neutral/category pills only
// (success/warning are reserved for settled/due-soon states).
const TYPE_BADGE_VARIANT: Record<string, "info" | "purple" | "gray"> = {
  saham: "info",
  reksa_dana: "purple",
  obligasi: "gray",
  emas: "purple",
  kripto: "info",
  lainnya: "gray",
  // EPIC-024 C2/C3 (D10).
  deposito: "gray",
};

const INVESTMENT_TYPES = [
  "saham",
  "reksa_dana",
  "obligasi",
  "emas",
  "kripto",
  "lainnya",
  // EPIC-024 C2/C3 (D10) — new investment type.
  "deposito",
] as const;

type InvestmentType = (typeof INVESTMENT_TYPES)[number];

// EPIC-021 #19 (Open Design Decision #3 recommendation): filter tabs by type,
// matching the /aset tab pattern.
const FILTER_TAB_IDS = ["semua", ...INVESTMENT_TYPES] as const;
type FilterTabId = (typeof FILTER_TAB_IDS)[number];

// EPIC-021 #20 + EPIC-024 C3 (D10): obligasi AND deposito are the
// interest-bearing types — both get the annual-rate field.
const INTEREST_BEARING_TYPES: readonly InvestmentType[] = [
  "obligasi",
  "deposito",
];

// EPIC-023 G1 (D15) — "automate what can be automated, label the rest".
// Only saham (Yahoo .JK) and kripto (CoinGecko) ever get an automated
// price; every other type is manual-only, matching MARKET_DATA_PORT's
// AUTOMATED_PRICE_TYPES on the API.
const AUTOMATED_PRICE_TYPES: readonly InvestmentType[] = ["saham", "kripto"];
// Revisi D item 11 — valued from FamilyGroup.goldPricePerGram (Pengaturan › Harga Emas).
const FAMILY_PRICED_TYPES: readonly InvestmentType[] = ["emas"];
function isManualPriceType(type: InvestmentType): boolean {
  return (
    !AUTOMATED_PRICE_TYPES.includes(type) && !FAMILY_PRICED_TYPES.includes(type)
  );
}

// EPIC-024 C1 (D8) — "computed-interest" (deposito's live simple-interest
// value) joins the honest-labelling map alongside the automated feeds and
// manual entry.
const PRICE_SOURCE_LABEL_KEYS = {
  "yahoo-finance": "yahooFinance",
  coingecko: "coinGecko",
  manual: "manual",
  mock: "mock",
  "computed-interest": "computedInterest",
  "family-gold-price": "familyGold",
} as const;

interface AddInvestmentForm {
  ticker: string;
  name: string;
  type: InvestmentType;
  // For saham this is the DISPLAY value in `quantityUnit` — converted to
  // canonical lembar only at submit time (EPIC-024 C3, D9). For every
  // other type it is the plain stored quantity (coin count for kripto,
  // ignored/locked "1" for deposito).
  quantity: string;
  // EPIC-024 C3 (D9) — saham Lot/Lembar toggle. Defaults to "lembar" when
  // editing an existing holding (its stored `quantity` IS canonical
  // lembar already — showing it as lembar with NO conversion is what
  // keeps a re-save idempotent by construction: nothing is multiplied
  // unless the user explicitly toggles the unit).
  quantityUnit: QuantityUnit;
  costBasisPerUnit: string;
  interestRatePct: string;
  // EPIC-024 C3 (D7) — "tanggal beli", every type.
  purchasedAt: string;
  // EPIC-024 C3 (D10) — deposito only.
  maturityDate: string;
  // EPIC-023 G1 (D15) — manual price entry, only rendered/used for manual
  // price types. Optional: a holding can be recorded before its first
  // manual price is known (matches the family gold price's "unset" state).
  manualPrice: string;
  manualPriceDate: string;
}

/** yyyy-mm-dd for a DateField value, or "" when absent. */
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toLogoText(ticker: string): string {
  return ticker.slice(0, 4).toUpperCase();
}

// B7 (client revision round 2) — the "Type" badge/allocation-donut label
// now reads from the ONE shared asset-class taxonomy (@wealthme/contracts)
// instead of this page's own `typeLabels` dict, so its wording matches
// /aset and /warisan exactly (e.g. "Obligasi/SBN" everywhere, not
// "Obligasi" here and "Surat Berharga" on /warisan). Every InvestmentType
// maps to its own distinct class — no specificity is lost, only the wording
// is unified.
function investmentClassLabel(t: Dict, type: string): string {
  return t.common.assetClassLabels[investmentTypeToAssetClass(type)];
}

// Batch C2 — returns a decimal-Rupiah formatter bound to the caller's
// display-currency `format` (money.format from useMoney()), so every
// component below defines its own `const formatDecimalRupiah =
// makeFormatDecimalRupiah(money.format)` shadowing this factory's name —
// every existing call site (`formatDecimalRupiah(x)`) then converts without
// having to touch each one individually.
function makeFormatDecimalRupiah(
  format: (value: number) => string,
): (value: string | null) => string {
  return (value) => {
    if (!value) return "—";
    return format(parseFloat(value));
  };
}

function formatReturnPct(pct: number | null): string {
  if (pct === null) return "—";
  return formatPercent(pct, { signed: true });
}

function formatLocaleDateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Dict = ReturnType<typeof useLocale>["t"];

function unitLabels(t: Dict): UnitLabels {
  return {
    lot: t.investasi.unitLot,
    lembar: t.investasi.unitLembar,
    unit: t.investasi.unitFundUnit,
    gram: t.investasi.unitGram,
    kg: t.investasi.unitKg,
    coin: t.investasi.unitCoinSuffix,
  };
}

function quantityDecimalsError(
  t: Dict,
  type: string,
  quantity: string,
  quantityUnit: QuantityUnit,
): string | null {
  const max = maxQuantityDecimals(type, quantityUnit);
  if (hasAtMostDecimals(quantity, max)) return null;
  const unit = quantityUnitLabel(
    type,
    quantityUnit,
    unitLabels(t),
  ).toLowerCase();
  return max === 0
    ? t.investasi.quantityWholeNumberErrorTemplate.replace("{unit}", unit)
    : t.investasi.quantityDecimalsErrorTemplate
        .replace("{unit}", unit)
        .replace("{max}", String(max));
}

// EPIC-025 N3 audit (structural port fidelity) — restores the prototype's
// per-row "instrument" sub-line: ticker + purchase date for most types,
// coupon + purchase date for obligasi, start + maturity for deposito. Every
// value comes from the real `InvestmentDto` fields already fetched — falls
// back to the bare ticker when `purchasedAt` is unset (legacy rows created
// before that column existed).
function formatInstrumentSubline(
  h: InvestmentDto,
  t: Dict,
  locale: Locale,
): string {
  const purchasedDate = h.purchasedAt
    ? formatManualDate(h.purchasedAt, locale)
    : null;
  if (h.type === "deposito" && h.maturityDate && purchasedDate) {
    return t.investasi.rowDepositoTermTemplate
      .replace("{date}", purchasedDate)
      .replace("{maturityDate}", formatManualDate(h.maturityDate, locale));
  }
  if (h.type === "obligasi" && h.interestRatePct && purchasedDate) {
    return t.investasi.rowCouponPurchasedTemplate
      .replace("{rate}", h.interestRatePct)
      .replace("{date}", purchasedDate);
  }
  // E2E round-2 B1 — the ticker column may hold a derived internal code
  // for non-market types (no real ticker exists for a deposito, emas
  // fisik, ...); never display that as if it were a real ticker.
  const isAutomated = AUTOMATED_PRICE_TYPES.includes(h.type as InvestmentType);
  if (isAutomated && purchasedDate) {
    return t.investasi.rowTickerPurchasedTemplate
      .replace("{ticker}", h.ticker)
      .replace("{date}", purchasedDate);
  }
  if (purchasedDate) {
    return t.investasi.rowPurchasedTemplate.replace("{date}", purchasedDate);
  }
  return isAutomated ? h.ticker : "";
}

// EPIC-025 N3 audit — restores the prototype's "Jumlah" column. Every unit
// shown is derived from the real stored `quantity`/`costBasisPerUnit`
// (never invented). Saham shows both lot and lembar via the SAME exact
// decimal math (`divideBy100`) as the add/edit form's Lot/Lembar toggle.
function formatQuantityCell(
  h: InvestmentDto,
  t: Dict,
  format: (value: number) => string,
): ReactNode {
  const labels = unitLabels(t);
  if (h.type === "saham") {
    return (
      <>
        <div>
          {formatQuantity(divideBy100(h.quantity), h.type, "lot")}{" "}
          {labels.lot.toLowerCase()}
        </div>
        <div className="text-muted-foreground">
          {formatQuantity(h.quantity, h.type)} {labels.lembar.toLowerCase()}
        </div>
      </>
    );
  }
  if (h.type === "kripto") {
    return (
      <div>
        {formatQuantity(h.quantity, h.type)} {h.ticker}
      </div>
    );
  }
  // B9 follow-up (client revision round 2) — gold is stored in grams
  // (unchanged) but the user chose "Per kilogram": show kg as the primary
  // line, same stacked pattern as saham's Lot/Lembar above, with the exact
  // (float-free) stored grams as the muted secondary line.
  if (h.type === "emas") {
    return (
      <>
        <div>
          {formatQuantity(gramsToKg(h.quantity), h.type)} {labels.kg}
        </div>
        <div className="text-muted-foreground">
          {formatQuantity(h.quantity, h.type)} {labels.gram}
        </div>
      </>
    );
  }
  if (h.type === "obligasi" || h.type === "deposito") {
    // Prototype shows the total nominal here, which equals this row's own
    // "Modal" column value (quantity × costBasisPerUnit) — not a separate,
    // invented figure.
    const nominal = parseFloat(h.costBasisPerUnit) * parseFloat(h.quantity);
    return (
      <div>
        {t.investasi.nominalPrefix}
        {format(nominal)}
      </div>
    );
  }
  return (
    <div>
      {formatQuantity(h.quantity, h.type)}{" "}
      {quantityUnitLabel(h.type, "lembar", labels)}
    </div>
  );
}

// EPIC-025 N3 audit — restores the prototype's "Harga / Sumber" column and
// its per-row price-source badges ("Live · delayed", "Harga manual ·
// <date>", "Nilai dihitung · bunga berjalan"). Honest-UI note: unlike the
// prototype's static obligasi row (a fabricated "Harga 103,45%" percent of
// par — a concept this data model doesn't store), obligasi renders its real
// `currentPrice` in Rupiah instead of inventing a percentage.
function formatPriceSourceCell(
  h: InvestmentDto,
  t: Dict,
  locale: Locale,
  format: (value: number) => string,
): ReactNode {
  const formatDecimalRupiah = makeFormatDecimalRupiah(format);
  const priceSourceLabelKey =
    PRICE_SOURCE_LABEL_KEYS[
      h.latestPriceSource as keyof typeof PRICE_SOURCE_LABEL_KEYS
    ];
  const providerLabel = priceSourceLabelKey
    ? t.investasi.sourceLabels[priceSourceLabelKey]
    : h.latestPriceSource;

  if (h.type === "deposito") {
    return (
      <>
        <div className="mono">
          {h.interestRatePct
            ? t.investasi.depositoRateTemplate.replace(
                "{rate}",
                h.interestRatePct,
              )
            : t.investasi.detailNoRateSet}
        </div>
        <div className="mt-0.5">
          <StatusBadge variant="gray">
            {t.investasi.priceComputedBadgeLabel}
          </StatusBadge>
        </div>
      </>
    );
  }

  if (h.automatedPriceUnmapped) {
    return (
      <>
        {h.currentPrice !== null && (
          <div className="mono">{formatDecimalRupiah(h.currentPrice)}</div>
        )}
        <div className="mt-0.5">
          <StatusBadge variant="warning">
            {t.investasi.automatedUnmappedBadge}
          </StatusBadge>
        </div>
      </>
    );
  }

  // Batch B6 — a dev/demo simulated ("mock") price must never render like a
  // live quote. No "Live" badge, no fabricated Rupiah figure — just the
  // honest "price not available" label; the current VALUE shown elsewhere
  // on the row already fell back to cost basis (never the fake price).
  if (h.automatedPriceSimulated) {
    return (
      <span className="text-muted-foreground">
        {t.investasi.priceSimulatedLabel}
      </span>
    );
  }

  if (h.currentPrice === null) {
    return (
      <span className="text-muted-foreground">
        {isManualPriceType(h.type as InvestmentType)
          ? t.investasi.detailNoManualPrice
          : t.investasi.detailPriceUnavailable}
      </span>
    );
  }

  if (AUTOMATED_PRICE_TYPES.includes(h.type as InvestmentType)) {
    const unitSuffix =
      h.type === "saham"
        ? `/ ${t.investasi.unitLembar.toLowerCase()}`
        : `/ ${t.investasi.unitCoinSuffix}`;
    return (
      <>
        <div className="mono">
          {formatDecimalRupiah(h.currentPrice)} {unitSuffix}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge variant="success">
            {h.latestPriceDelayed
              ? t.investasi.priceLiveDelayedBadge
              : t.investasi.priceLiveBadge}
          </StatusBadge>
          <span className="text-[10.5px] text-muted-foreground">
            {providerLabel}
          </span>
        </div>
      </>
    );
  }

  if (h.latestPriceSource === "family-gold-price") {
    const goldAsOf = h.latestPriceAsOf ?? h.latestPriceRecordedAt;
    return (
      <>
        <div className="mono">
          {formatDecimalRupiah(h.currentPrice)} / {t.investasi.unitGram}
        </div>
        <div className="mt-0.5">
          <StatusBadge variant="warning">
            {goldAsOf
              ? t.investasi.priceFamilyGoldBadgeTemplate.replace(
                  "{date}",
                  formatManualDate(goldAsOf, locale),
                )
              : t.investasi.sourceLabels.familyGold}
          </StatusBadge>
        </div>
      </>
    );
  }

  // Manual-priced types: reksa_dana, obligasi, lainnya (+ emas with no family gold price).
  const unitSuffix =
    h.type === "reksa_dana"
      ? ` / ${t.investasi.unitFundUnit}`
      : h.type === "emas"
        ? ` / ${t.investasi.unitGram}`
        : "";
  const pricePrefix = h.type === "reksa_dana" ? t.investasi.navPricePrefix : "";
  const asOf = h.latestPriceAsOf ?? h.latestPriceRecordedAt;
  return (
    <>
      <div className="mono">
        {pricePrefix}
        {formatDecimalRupiah(h.currentPrice)}
        {unitSuffix}
      </div>
      <div className="mt-0.5">
        <StatusBadge variant="gray">
          {asOf
            ? t.investasi.priceManualBadgeTemplate.replace(
                "{date}",
                formatManualDate(asOf, locale),
              )
            : t.investasi.detailNoManualPrice}
        </StatusBadge>
      </div>
    </>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

function HoldingRowSkeleton() {
  return (
    <li className="iv-row" aria-hidden="true">
      <SkeletonBlock className="size-9 rounded-full" />
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="h-4 w-28" />
    </li>
  );
}

function AddInvestmentModal({
  open,
  onClose,
  familyGroupId,
  token,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  familyGroupId: string;
  token: string;
  editing?: InvestmentDto | null;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const goldPrice = useGoldPrice();
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AddInvestmentForm>(() =>
    editing
      ? {
          ticker: editing.ticker,
          name: editing.name,
          type: editing.type as InvestmentType,
          // Stored quantity is ALWAYS canonical lembar — display it as
          // lembar with zero conversion (idempotency by construction).
          // B9 follow-up — emas is the one exception: stored in grams, but
          // this field is disabled in edit mode anyway (isEditingLots), so
          // showing it converted to kg here is display-only and never
          // re-submitted (see handleSubmit's `!isEditingLots` guard below).
          quantity:
            editing.type === "emas"
              ? gramsToKg(editing.quantity)
              : editing.quantity,
          quantityUnit: "lembar",
          costBasisPerUnit: canonicalToTyping(editing.costBasisPerUnit, 2),
          interestRatePct: editing.interestRatePct ?? "",
          purchasedAt: toDateInputValue(editing.purchasedAt),
          maturityDate: toDateInputValue(editing.maturityDate),
          manualPrice: "",
          manualPriceDate: "",
        }
      : {
          ticker: "",
          name: "",
          type: "saham",
          quantity: "",
          // New saham entries default to "lot" — the unit a broker
          // statement typically shows first (US-INV-12).
          quantityUnit: "lot",
          costBasisPerUnit: "",
          interestRatePct: "",
          purchasedAt: "",
          maturityDate: "",
          manualPrice: "",
          manualPriceDate: "",
        },
  );
  // EPIC-024 C1 (D8) — an automated-type holding whose ticker has no live
  // route (UnmappedTickerError) accepts a manual price on edit even though
  // its instrument type is normally automated-only.
  const isAutomatedUnmapped = editing?.automatedPriceUnmapped ?? false;
  // E2E round-2 B1 — ticker is only required for the types the price
  // feed actually looks up; see AUTOMATED_PRICE_TYPES.
  const requiresTicker = AUTOMATED_PRICE_TYPES.includes(form.type);
  const isDeposito = form.type === "deposito";
  const isFamilyGoldPriced = FAMILY_PRICED_TYPES.includes(form.type);
  const isManual =
    (isManualPriceType(form.type) && !isDeposito) || isAutomatedUnmapped;
  // EPIC-022 D2 — closing the "edit silently overwrites quantity/cost with
  // no trace" defect: once a holding exists, quantity/cost basis can only
  // change through a recorded Beli/Jual transaction (weighted-average cost,
  // realized P/L), never through this generic edit form. Deposito is
  // exempt — it has no lot/buy-sell concept, and its "costBasisPerUnit" is
  // really just the nominal, correctable like any other typo.
  const isEditingLots = Boolean(editing) && !isDeposito;

  // null = follow the display currency until touched (add); edit opens on IDR (Decision 9/12).
  const [costCurrency, setCostCurrency] = useState<FxCurrencyCode | null>(
    editing ? "IDR" : null,
  );
  const [priceCurrency, setPriceCurrency] = useState<FxCurrencyCode | null>(
    null,
  );
  const costField = useControlledMoneyField({
    raw: form.costBasisPerUnit,
    currency: costCurrency,
    // costBasisPerUnit is a Decimal(18,2) column on the API (sen precision)
    // for every instrument type, not just kripto — the foreign-currency
    // preview must convert at scale 2, matching moneyIdrDecimal's contract.
    idrScale: 2,
    onChange: ({ raw, currency }) => {
      setForm((f) => ({ ...f, costBasisPerUnit: raw }));
      setCostCurrency(currency);
    },
  });
  const manualPriceField = useControlledMoneyField({
    raw: form.manualPrice,
    currency: priceCurrency,
    idrScale: 2,
    onChange: ({ raw, currency }) => {
      setForm((f) => ({ ...f, manualPrice: raw }));
      setPriceCurrency(currency);
    },
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleQuantityUnitChange(nextUnit: QuantityUnit) {
    setForm((prev) => ({
      ...prev,
      quantityUnit: nextUnit,
      quantity: convertQuantityDisplay(
        prev.quantity,
        prev.quantityUnit,
        nextUnit,
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (anyMoneyPending(costField, manualPriceField)) {
      toast.error(t.money.rateNotReady);
      return;
    }
    if (!isDeposito && !isEditingLots) {
      const decimalsError = quantityDecimalsError(
        t,
        form.type,
        form.quantity,
        form.quantityUnit,
      );
      if (decimalsError) {
        toast.error(decimalsError);
        return;
      }
    }
    setSubmitting(true);
    try {
      const path = editing
        ? `/family-groups/${familyGroupId}/investments/${editing.id}`
        : `/family-groups/${familyGroupId}/investments`;
      // EPIC-024 C3 (D9) — canonicalize to lembar ONLY here, from whatever
      // is currently displayed + selected. Delegates to the exact
      // BigInt-scaled conversion in `quantity-conversion.ts` so this stays
      // idempotent AND drift-free for odd-lot values (review fix — HIGH).
      let canonicalQuantity = form.quantity;
      if (form.type === "saham") {
        canonicalQuantity = canonicalizeSahamQuantity(
          form.quantity || "0",
          form.quantityUnit,
        );
      } else if (form.type === "emas") {
        // B9 follow-up — the field always displays/accepts kg; canonicalize
        // to grams (the stored unit) ONLY here, exact BigInt-scaled ×1000,
        // same idempotency guarantee as saham's lot->lembar above.
        canonicalQuantity = kgToGrams(form.quantity || "0");
      } else if (isDeposito) {
        // Deposito nominal is the total (costBasisPerUnit); quantity is
        // fixed at 1, never user-entered.
        canonicalQuantity = "1";
      }

      const body: Record<string, unknown> = {
        ticker: form.ticker,
        name: form.name,
        type: form.type,
      };
      // EPIC-022 D2 retry (HIGH) — the server now REJECTS an update that
      // touches quantity/costBasisPerUnit for a lot-tracked holding (they
      // only change through a recorded Beli/Jual transaction). These
      // inputs are already disabled in edit mode for that case
      // (`isEditingLots`) — omit them from the payload entirely rather
      // than send an unchanged value the API would 400 on.
      if (!isEditingLots) {
        body["quantity"] = canonicalQuantity;
        body["costBasisPerUnit"] = moneyIdrDecimal(
          costField,
          () => toCanonicalAmount(form.costBasisPerUnit) ?? "0",
        );
      }
      if (form.interestRatePct.trim()) {
        body["interestRatePct"] = form.interestRatePct.trim();
      }
      if (form.purchasedAt.trim()) {
        body["purchasedAt"] = new Date(form.purchasedAt.trim()).toISOString();
      }
      if (isDeposito && form.maturityDate.trim()) {
        body["maturityDate"] = new Date(form.maturityDate.trim()).toISOString();
      }
      // EPIC-023 Task G retry (HIGH five-reviewer finding) — the holding
      // save and the optional manual-price save are two INDEPENDENT
      // failure modes. Previously both awaits shared one `try`/`catch`: if
      // the holding saved but only the price write failed, the user was
      // told the add/update FAILED even though the row existed
      // server-side, `invalidateQueries` never ran, and retrying created a
      // duplicate holding.
      let saved: InvestmentDto;
      try {
        saved = await apiFetch<InvestmentDto>(path, {
          method: editing ? "PATCH" : "POST",
          token,
          body: JSON.stringify(
            isEditingLots
              ? body
              : withFxInputs(body, [["costBasisPerUnit", costField]]),
          ),
        });
      } catch (err) {
        // F1 — surface the server's real message (e.g. a validation reason)
        // instead of a generic constant.
        handleError(err);
        return;
      }

      // The holding now exists server-side — every path from here on must
      // invalidate + close, even if the optional price write below fails.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });

      // EPIC-023 G1 (D15) — manual-only types never get an automated price;
      // an entered manual price is recorded as a separate, dated
      // InvestmentPrice right after the holding itself is saved.
      let priceSaveFailed = false;
      if (isManual && form.manualPrice.trim()) {
        try {
          await apiFetch(
            `/family-groups/${familyGroupId}/investments/${saved.id}/price`,
            {
              method: "POST",
              token,
              body: JSON.stringify(
                withFxInputs(
                  {
                    price: moneyIdrDecimal(
                      manualPriceField,
                      () => toCanonicalAmount(form.manualPrice) ?? "0",
                    ),
                    ...(form.manualPriceDate
                      ? { asOf: new Date(form.manualPriceDate).toISOString() }
                      : {}),
                  },
                  [["price", manualPriceField]],
                ),
              ),
            },
          );
          await queryClient.invalidateQueries({
            queryKey: queryKeys.investments.all(familyGroupId),
          });
        } catch {
          priceSaveFailed = true;
        }
      }

      if (priceSaveFailed) {
        toast.warning(t.investasi.toastPriceSaveFailed);
      } else {
        toast.success(
          editing ? t.investasi.toastUpdated : t.investasi.toastAdded,
        );
        // Batch B6 — "warn at input when a saham/kripto ticker is not
        // found": the create/update response itself never carries a fresh
        // automated-price status (findAll() is what triggers the actual
        // quote fetch), so re-read the just-saved holding from the
        // already-invalidated list and warn if it turned out to have no
        // real market price. Best-effort only — never blocks the save.
        if (AUTOMATED_PRICE_TYPES.includes(form.type)) {
          try {
            const freshList = await apiFetch<InvestmentDto[]>(
              `/family-groups/${familyGroupId}/investments`,
              { token },
            );
            const fresh = freshList.find((x) => x.id === saved.id);
            if (fresh?.automatedPriceUnmapped) {
              toast.warning(t.investasi.tickerNotFoundWarning);
            } else if (fresh?.automatedPriceSimulated) {
              toast.warning(t.investasi.tickerNoLivePriceWarning);
            }
          } catch {
            // Non-critical: the holding itself already saved successfully.
          }
        }
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      {/* EPIC-026 Wave 8 — rebuilt 1:1 against the prototype's #dlg-catat
          (docs/prototype/pages/investasi.html:329): a `dialog--wide
          investment-dialog` shell whose header/body/footer are three fixed
          rows, and whose body is the `wm-form` — bordered
          `wm-form__section` blocks, each with a heading + 2-up
          `wm-form__grid` field pairs and `.hint` lines. Field order
          matches the prototype: [Jenis | Tanggal Beli], [Nama | Kode], then
          quantity & price, then valuation. */}
      <PanelContent variant="side" size="lg" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {editing ? t.investasi.modalTitleEdit : t.investasi.modalTitleAdd}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {t.investasi.modalDesc}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <XIcon aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="wm-panel-body wm-form">
            <div className="wm-form__grid">
              <div className="field">
                <label className="label" htmlFor="type">
                  {t.investasi.fieldTypeLabel}
                </label>
                <select
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="select"
                >
                  {INVESTMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t.investasi.typeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="wm-form__grid">
              <div className="field">
                <label className="label" htmlFor="name">
                  {t.investasi.fieldNameLabel}
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder={t.investasi.fieldNamePlaceholder}
                  className="input"
                />
              </div>
              {/* E2E round-2 B1 — ticker is only meaningful (and only
                  required) for the types the price feed actually looks
                  up (saham/kripto, see AUTOMATED_PRICE_TYPES). Indonesian
                  users have no ticker for a deposito at BRI or emas Antam
                  fisik, so the field is hidden rather than forced for
                  every other type; the API derives an internal code. */}
              {requiresTicker && (
                <div className="field">
                  <label className="label" htmlFor="ticker">
                    {t.investasi.fieldTickerLabel}
                  </label>
                  <input
                    id="ticker"
                    name="ticker"
                    required
                    value={form.ticker}
                    onChange={handleChange}
                    placeholder={t.investasi.fieldTickerPlaceholder}
                    className="input mono"
                  />
                </div>
              )}
            </div>

            {/* batch 7a item 3 — the Lot/Lembar switch used to float at the
                right of a now-removed section heading; it now sits as its
                own labelled field, same rhythm as every other field in the
                grid. */}
            {form.type === "saham" && (
              <div className="field">
                <span className="label">
                  {t.investasi.fieldQuantityUnitLabel}
                </span>
                {/* `.segmented__item`'s selected style keys off
                    `[aria-selected="true"]`, which is only valid on a
                    role that supports it — hence the prototype's own
                    `role="tablist"`/`role="tab"` pairing (assets/shell.js
                    uses exactly this for its `.segmented`). */}
                <div
                  className="segmented"
                  role="tablist"
                  aria-label={t.investasi.fieldQuantityUnitLabel}
                >
                  {(["lot", "lembar"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      role="tab"
                      className="segmented__item"
                      aria-selected={form.quantityUnit === unit}
                      onClick={() => handleQuantityUnitChange(unit)}
                    >
                      {unit === "lot"
                        ? t.investasi.unitLot
                        : t.investasi.unitLembar}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="wm-form__grid wm-form__grid--two">
              {/* EPIC-024 C3 (D9) — saham gets the Lot/Lembar toggle above
                    (canonical lembar, ×100, converted only at submit — see
                    handleQuantityUnitChange); kripto is coin decimals;
                    deposito has no quantity input at all (fixed at 1, its
                    nominal lives in costBasisPerUnit). */}
              {!isDeposito && (
                <div className="field">
                  <label className="label" htmlFor="quantity">
                    {t.investasi.fieldQuantityLabelByType[form.type]}
                  </label>
                  <input
                    id="quantity"
                    name="quantity"
                    type="number"
                    required
                    min="0"
                    step={quantityStep(form.type, form.quantityUnit)}
                    value={form.quantity}
                    onChange={handleChange}
                    disabled={isEditingLots}
                    placeholder={
                      form.type === "saham"
                        ? form.quantityUnit === "lot"
                          ? t.investasi.fieldQuantityLotPlaceholder
                          : t.investasi.fieldQuantityLembarPlaceholder
                        : t.investasi.fieldQuantityPlaceholderByType[form.type]
                    }
                    className="input mono disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {form.type === "saham" && !isEditingLots && (
                    <div className="hint">{t.investasi.hintLotConversion}</div>
                  )}
                  {form.type === "emas" &&
                    !isEditingLots &&
                    form.quantity.trim() !== "" && (
                      <div className="hint">
                        {t.investasi.hintGoldKgEquivalentTemplate.replace(
                          "{grams}",
                          formatQuantity(kgToGrams(form.quantity), "emas"),
                        )}
                      </div>
                    )}
                  {isEditingLots && (
                    <div className="hint">{t.investasi.hintQuantityLocked}</div>
                  )}
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="costBasisPerUnit">
                  {isDeposito
                    ? t.investasi.fieldDepositoNominalLabel
                    : t.investasi.fieldCostBasisLabel}
                </label>
                <MoneyInput
                  field={costField}
                  id="costBasisPerUnit"
                  disabled={isEditingLots}
                  required={!isEditingLots}
                  placeholder={
                    isDeposito
                      ? t.investasi.fieldDepositoNominalPlaceholder
                      : t.investasi.fieldCostBasisPlaceholder
                  }
                />
                {isEditingLots && (
                  <div className="hint">{t.investasi.hintCostBasisLocked}</div>
                )}
              </div>
            </div>

            {/* EPIC-024 C3 (D7) — "tanggal beli", every type. */}
            <div className="field">
              <label className="label" htmlFor="purchasedAt">
                {t.investasi.fieldPurchaseDateLabel}
              </label>
              <DateField
                id="purchasedAt"
                name="purchasedAt"
                value={form.purchasedAt}
                locale={locale}
                label={t.investasi.fieldPurchaseDateLabel}
                onChange={(iso) =>
                  setForm((prev) => ({ ...prev, purchasedAt: iso }))
                }
              />
              <div className="hint">{t.investasi.hintPurchaseDate}</div>
            </div>

            <div className="wm-form__grid">
              {INTEREST_BEARING_TYPES.includes(form.type) && (
                <div className="field">
                  <label className="label" htmlFor="interestRatePct">
                    {t.investasi.fieldInterestRateLabel}
                  </label>
                  <input
                    id="interestRatePct"
                    name="interestRatePct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.interestRatePct}
                    onChange={handleChange}
                    placeholder={t.investasi.fieldInterestRatePlaceholder}
                    className="input mono"
                  />
                </div>
              )}

              {/* EPIC-024 C3 (D10) — deposito's jatuh tempo. */}
              {isDeposito && (
                <div className="field">
                  <label className="label" htmlFor="maturityDate">
                    {t.investasi.fieldMaturityDateLabel}
                  </label>
                  <DateField
                    id="maturityDate"
                    name="maturityDate"
                    value={form.maturityDate}
                    locale={locale}
                    label={t.investasi.fieldMaturityDateLabel}
                    onChange={(iso) =>
                      setForm((prev) => ({ ...prev, maturityDate: iso }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Prototype `#blok-manual` + its automated counterpart, as the
                third group. EPIC-023 G1 (D15) — per-type pricing: manual
                types get a dated manual-price field; automated types
                (saham/kripto) get an honest note instead, since the price
                comes from Yahoo/CoinGecko. EPIC-024 C3 (D10) — deposito gets
                neither: its value is computed from bunga %/thn, never
                entered. batch 7a item 3 — this notice is the ONE place the
                per-type pricing-source note is shown now; the duplicate
                hint that used to sit under the Jenis select is gone. */}
            <div className="iv-form-note">
              {isDeposito ? (
                <div className="notice notice--info">
                  <Calculator className="size-4 shrink-0" aria-hidden="true" />
                  <span>{t.investasi.depositoValuationNote}</span>
                </div>
              ) : isFamilyGoldPriced ? (
                <div className="notice notice--info">
                  <Info className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span>
                      {goldPrice.hasPrice && goldPrice.pricePerGram !== null
                        ? t.investasi.familyGoldPriceHintTemplate
                            .replace(
                              "{price}",
                              money.format(goldPrice.pricePerGram),
                            )
                            .replace(
                              "{date}",
                              goldPrice.updatedAt
                                ? formatManualDate(goldPrice.updatedAt, locale)
                                : "—",
                            )
                        : t.investasi.familyGoldPriceUnsetHint}
                    </span>{" "}
                    <Link
                      href="/akun"
                      className="font-semibold text-primary-strong hover:underline"
                    >
                      {t.investasi.familyGoldPriceLinkLabel}
                    </Link>
                  </span>
                </div>
              ) : isManual ? (
                <>
                  <div className="notice notice--warning">
                    <PencilLine
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {isAutomatedUnmapped
                        ? t.investasi.automatedUnmappedNote
                        : t.investasi.manualPriceNote}
                    </span>
                  </div>
                  <div className="wm-form__grid">
                    <div className="field">
                      <label className="label" htmlFor="manualPrice">
                        {t.investasi.fieldManualPriceLabel}
                      </label>
                      <MoneyInput
                        field={manualPriceField}
                        id="manualPrice"
                        placeholder={t.investasi.fieldManualPricePlaceholder}
                      />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="manualPriceDate">
                        {t.investasi.fieldManualPriceDateLabel}
                      </label>
                      <DateField
                        id="manualPriceDate"
                        name="manualPriceDate"
                        value={form.manualPriceDate}
                        locale={locale}
                        label={t.investasi.fieldManualPriceDateLabel}
                        onChange={(iso) =>
                          setForm((prev) => ({ ...prev, manualPriceDate: iso }))
                        }
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="notice notice--info">
                  <Zap className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {form.type === "kripto"
                      ? t.investasi.autoPriceNoteKripto
                      : t.investasi.autoPriceNoteSaham}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onClose}>
              {t.common.cancel}
            </PillButton>
            <PillButton type="submit" variant="primary" disabled={submitting}>
              {submitting ? t.investasi.saving : t.investasi.saveButton}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}

/**
 * EPIC-022 D2 — the replacement for editing quantity/costBasisPerUnit
 * directly: a BUY grows the position (weighted-average cost, recomputed
 * server-side); a SELL shrinks it and books a realized P/L for the sold
 * portion. Every submission POSTs to `.../investments/:id/transactions`,
 * which is also the real history this dialog used to have none of.
 */
/** Far above any real per-gram gold price, well below a per-kg one. */
const GOLD_MAX_PRICE_PER_GRAM_IDR = 100_000_000;

function BuySellModal({
  open,
  onClose,
  familyGroupId,
  token,
  holding,
}: {
  open: boolean;
  onClose: () => void;
  familyGroupId: string;
  token: string;
  holding: InvestmentDto | null;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const formatDecimalRupiah = makeFormatDecimalRupiah(money.format);
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const [txType, setTxType] = useState<InvestmentTxType>("buy");
  const [quantity, setQuantity] = useState("");
  const isSaham = holding?.type === "saham";
  // B9 follow-up — a gold holding's quantity can ONLY change through a
  // Beli/Jual transaction (AddInvestmentModal locks it — isEditingLots), so
  // this is the real entry point for the user's "Per kilogram" choice: the
  // field displays/accepts kg; the price stays per gram (hint below), same
  // "quantity unit toggles, price unit doesn't" idiom as saham's lot/lembar.
  const isGold = holding?.type === "emas";
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>("lot");
  const effectiveUnit: QuantityUnit = isSaham ? quantityUnit : "lembar";
  const unitLabel = holding
    ? quantityUnitLabel(holding.type, effectiveUnit, unitLabels(t))
    : "";
  // pricePerUnit is a Decimal(18,2) column on the API for every instrument
  // type — the foreign-currency preview must convert at scale 2, matching
  // moneyIdrDecimal's contract.
  const priceField = useMoneyField({ idrScale: 2 });
  const [occurredAt, setOccurredAt] = useState(() => localIsoDate());
  // EPIC-033 p28 — optional settlement account: a buy debits it, a sell
  // credits the proceeds and books the realised gain as income.
  const [accountId, setAccountId] = useState("");
  const { data: settleAccounts } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: open && !!token && !!familyGroupId,
  });
  const settleOptions = (settleAccounts ?? []).filter((a) =>
    ["bank", "cash", "ewallet"].includes(a.type),
  );
  const [submitting, setSubmitting] = useState(false);

  function handleQuantityUnitChange(nextUnit: QuantityUnit) {
    setQuantity((prev) => convertQuantityDisplay(prev, quantityUnit, nextUnit));
    setQuantityUnit(nextUnit);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!holding) return;
    if (priceField.resolved.isPending) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const decimalsError = quantityDecimalsError(
      t,
      holding.type,
      quantity,
      effectiveUnit,
    );
    if (decimalsError) {
      toast.error(decimalsError);
      return;
    }
    // Gold is priced per gram here while quantity is in kg; a per-kg Antam
    // price typed into this field would silently inflate the value 1000x.
    if (
      isGold &&
      Number(
        moneyIdrDecimal(
          priceField,
          () => toCanonicalAmount(priceField.raw) ?? "0",
        ),
      ) > GOLD_MAX_PRICE_PER_GRAM_IDR
    ) {
      toast.error(t.investasi.goldPricePerGramTooHigh);
      return;
    }
    const canonicalQuantity = isSaham
      ? canonicalizeSahamQuantity(quantity, quantityUnit)
      : isGold
        ? kgToGrams(quantity || "0")
        : quantity;
    setSubmitting(true);
    try {
      const created = await apiFetch<InvestmentTransactionDto>(
        `/family-groups/${familyGroupId}/investments/${holding.id}/transactions`,
        {
          method: "POST",
          token,
          body: JSON.stringify(
            withFxInputs(
              {
                type: txType,
                quantity: canonicalQuantity,
                pricePerUnit: moneyIdrDecimal(
                  priceField,
                  () => toCanonicalAmount(priceField.raw) ?? "0",
                ),
                occurredAt: new Date(occurredAt).toISOString(),
                accountId: accountId || undefined,
              },
              [["pricePerUnit", priceField]],
            ),
          ),
        },
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
      await queryClient.invalidateQueries({
        queryKey: ["investments", familyGroupId, holding.id, "transactions"],
      });
      if (txType === "sell" && created.realizedPnl) {
        toast.success(
          t.investasi.toastSellSuccessTemplate.replace(
            "{pnl}",
            formatDecimalRupiah(created.realizedPnl),
          ),
        );
      } else {
        toast.success(t.investasi.toastBuySuccess);
      }
      onClose();
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  }

  // Live order preview — display only; the submitted values are computed in
  // handleSubmit exactly as before.
  const unitFactor =
    isSaham && quantityUnit === "lot" ? 100 : isGold ? 1000 : 1;
  const qtyCanonical = (Number(quantity) || 0) * unitFactor;
  let priceIdr = 0;
  if (!priceField.resolved.isPending) {
    try {
      priceIdr = Number(
        moneyIdrDecimal(
          priceField,
          () => toCanonicalAmount(priceField.raw) ?? "0",
        ),
      );
    } catch {
      priceIdr = 0;
    }
  }
  const held = Number(holding?.quantity ?? 0);
  const avgCost = Number(holding?.costBasisPerUnit ?? 0);
  const lastPrice =
    holding?.currentPrice != null ? Number(holding.currentPrice) : null;
  const total = qtyCanonical * priceIdr;
  const isSell = txType === "sell";
  const nextHeld = isSell ? held - qtyCanonical : held + qtyCanonical;
  const overSell = isSell && qtyCanonical > held + 1e-9;
  const newAvg =
    !isSell && nextHeld > 0
      ? (held * avgCost + qtyCanonical * priceIdr) / nextHeld
      : avgCost;
  const estPnl = isSell ? (priceIdr - avgCost) * qtyCanonical : 0;
  const hasPreview = qtyCanonical > 0 && priceIdr > 0;
  const showQty = (canonical: number) =>
    `${formatQuantity(String(canonical / unitFactor), holding?.type ?? "", effectiveUnit)} ${unitLabel}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <PanelContent variant="side" size="lg" className="wm-form-panel bs-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {isSell
                ? t.investasi.buySellModalTitleSell
                : t.investasi.buySellModalTitleBuy}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {holding?.name}
              {holding?.ticker ? ` · ${holding.ticker}` : ""}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <XIcon aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="wm-panel-body wm-form">
            {holding && (
              <section
                className="bs-pos"
                aria-label={t.investasi.bsHoldingTitle}
              >
                <div className="bs-pos-title">{t.investasi.bsHoldingTitle}</div>
                <dl className="bs-pos-grid">
                  <div>
                    <dt>{t.investasi.bsHeldLabel}</dt>
                    <dd>{showQty(held)}</dd>
                  </div>
                  <div>
                    <dt>{t.investasi.bsAvgPriceLabel}</dt>
                    <dd>{money.format(avgCost)}</dd>
                  </div>
                  <div>
                    <dt>{t.investasi.bsLastPriceLabel}</dt>
                    <dd>{lastPrice != null ? money.format(lastPrice) : "—"}</dd>
                  </div>
                </dl>
              </section>
            )}

            <div
              className="bs-side"
              role="tablist"
              aria-label={t.investasi.buySellButtonLabel}
            >
              {(["buy", "sell"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  data-side={type}
                  aria-selected={txType === type}
                  onClick={() => setTxType(type)}
                >
                  {type === "buy"
                    ? t.investasi.buySellTypeBuyLabel
                    : t.investasi.buySellTypeSellLabel}
                </button>
              ))}
            </div>

            {isSaham && (
              <div className="field">
                <span className="label">
                  {t.investasi.fieldQuantityUnitLabel}
                </span>
                <div
                  className="segmented"
                  role="tablist"
                  aria-label={t.investasi.fieldQuantityUnitLabel}
                >
                  {(["lot", "lembar"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      role="tab"
                      className="segmented__item"
                      aria-selected={quantityUnit === unit}
                      onClick={() => handleQuantityUnitChange(unit)}
                    >
                      {unit === "lot"
                        ? t.investasi.unitLot
                        : t.investasi.unitLembar}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="wm-form__grid wm-form__grid--two">
              <div className="field">
                <label className="label" htmlFor="tx-quantity">
                  {t.investasi.buySellFieldQuantityLabel} ({unitLabel})
                </label>
                <input
                  id="tx-quantity"
                  type="number"
                  required
                  min="0"
                  step={
                    holding ? quantityStep(holding.type, effectiveUnit) : "any"
                  }
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input mono"
                  aria-invalid={overSell || undefined}
                />
                {overSell ? (
                  <div className="hint t-danger">{t.investasi.bsOverSell}</div>
                ) : (
                  isSaham && (
                    <div className="hint">{t.investasi.hintLotConversion}</div>
                  )
                )}
              </div>
              <div className="field">
                <label className="label" htmlFor="tx-price">
                  {t.investasi.buySellFieldPriceLabel}
                </label>
                <MoneyInput field={priceField} id="tx-price" />
                {lastPrice != null && (
                  <button
                    type="button"
                    className="bs-chip"
                    onClick={() =>
                      priceField.setRaw(String(Math.round(lastPrice)))
                    }
                  >
                    {t.investasi.bsUseLastPrice} · {money.format(lastPrice)}
                  </button>
                )}
                {isSaham && (
                  <div className="hint">
                    {t.investasi.buySellPricePerLembarHint}
                  </div>
                )}
                {isGold && (
                  <div className="hint">
                    {t.investasi.buySellPricePerGramHint}
                  </div>
                )}
              </div>
            </div>

            <div className="wm-form__grid wm-form__grid--two">
              <div className="field">
                <label className="label" htmlFor="tx-account">
                  {t.investasi.buySellFieldAccountLabel}
                </label>
                <select
                  id="tx-account"
                  className="select"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">
                    {t.investasi.buySellAccountNoneOption}
                  </option>
                  {settleOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="tx-date">
                  {t.investasi.buySellFieldDateLabel}
                </label>
                <DateField
                  id="tx-date"
                  value={occurredAt}
                  locale={locale}
                  label={t.investasi.buySellFieldDateLabel}
                  required
                  onChange={setOccurredAt}
                />
              </div>
            </div>

            <section
              className="bs-sum"
              data-side={txType}
              aria-live="polite"
              aria-label={t.investasi.bsSummaryTitle}
            >
              <div className="bs-sum-title">{t.investasi.bsSummaryTitle}</div>
              {hasPreview ? (
                <>
                  <div className="bs-sum-total">
                    <span>
                      {isSell
                        ? t.investasi.bsTotalSell
                        : t.investasi.bsTotalBuy}
                    </span>
                    <b>{money.format(total)}</b>
                  </div>
                  <dl className="bs-sum-rows">
                    <div>
                      <dt>
                        {isSell
                          ? t.investasi.bsRemainingLabel
                          : t.investasi.bsNewHoldingLabel}
                      </dt>
                      <dd className={overSell ? "t-danger" : undefined}>
                        {showQty(Math.max(0, nextHeld))}
                      </dd>
                    </div>
                    {isSell ? (
                      <div>
                        <dt>{t.investasi.bsEstPnlLabel}</dt>
                        <dd className={estPnl >= 0 ? "t-success" : "t-danger"}>
                          {estPnl >= 0 ? "+" : "-"}
                          {money.format(Math.abs(estPnl))}
                        </dd>
                      </div>
                    ) : (
                      <div>
                        <dt>{t.investasi.bsNewAvgLabel}</dt>
                        <dd>{money.format(newAvg)}</dd>
                      </div>
                    )}
                  </dl>
                </>
              ) : (
                <p className="bs-sum-empty">{t.investasi.bsSummaryEmpty}</p>
              )}
            </section>
          </div>

          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onClose}>
              {t.common.cancel}
            </PillButton>
            <PillButton
              type="submit"
              variant="primary"
              disabled={submitting || overSell}
            >
              {submitting
                ? t.investasi.buySellSaving
                : hasPreview
                  ? `${isSell ? t.investasi.buySellTypeSellLabel : t.investasi.buySellTypeBuyLabel} · ${money.format(total)}`
                  : t.investasi.buySellSaveButton}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}

function DetailMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[10px] border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mono mt-1 font-medium", tone)}>{value}</div>
    </div>
  );
}

// Hardening batch G1 (P0 honesty) — this used to draw the exact same static
// curve for every holding under "Harga penutupan 12 bulan terakhir", a
// fabricated trend. It now builds a real polyline from the holding's own
// fetched price history (`detailPrices`), or shows an honest empty state
// when there isn't enough history to draw a line yet.
function RealSparkline({
  prices,
  emptyLabel,
}: {
  prices: { asOf: string; price: string }[];
  emptyLabel: string;
}) {
  const sorted = [...prices]
    .map((p) => ({ t: new Date(p.asOf).getTime(), v: Number(p.price) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t);

  if (sorted.length < 2) {
    return (
      <div className="flex h-[72px] w-full items-center justify-center text-[12px] text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const width = 320;
  const height = 72;
  const min = Math.min(...sorted.map((p) => p.v));
  const max = Math.max(...sorted.map((p) => p.v));
  const range = max - min || 1;
  const points = sorted.map((p, i) => {
    const x = (i / (sorted.length - 1)) * width;
    const y = height - ((p.v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[72px] w-full"
      role="img"
      aria-label="Tren harga dari riwayat tersimpan"
    >
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path d={area} fill="var(--primary)" opacity="0.12" />
    </svg>
  );
}

export default function InvestasiPage() {
  const { t, locale } = useLocale();
  const money = useMoney();
  const formatDecimalRupiah = makeFormatDecimalRupiah(money.format);
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { canManage } = useCanManage("Investment");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentDto | null>(
    null,
  );
  const [deletingHolding, setDeletingHolding] = useState<InvestmentDto | null>(
    null,
  );
  // EPIC-021 #19: filter tabs by type, matching the /aset tab pattern.
  const [activeFilter, setActiveFilter] = useState<FilterTabId>("semua");
  const [heroMore, setHeroMore] = useState(false);
  const [detailHolding, setDetailHolding] = useState<InvestmentDto | null>(
    null,
  );
  // EPIC-022 D2 — Beli/Jual is the only path to change quantity/cost once a
  // holding exists (see isEditingLots in AddInvestmentModal).
  const [buySellHolding, setBuySellHolding] = useState<InvestmentDto | null>(
    null,
  );

  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;

  const apiUrl = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

  const {
    data: holdings,
    isLoading: holdingsLoading,
    isError: holdingsError,
    // EPIC-025 N3 audit — real "last synced" timestamp for the pricing-source
    // notice, sourced from react-query's own fetch bookkeeping (not a fake
    // static timestamp).
    dataUpdatedAt: holdingsUpdatedAt,
  } = useQuery<InvestmentDto[]>({
    queryKey: [...queryKeys.investments.all(familyGroupId ?? ""), token ?? ""],
    queryFn: () =>
      apiFetch<InvestmentDto[]>(`/family-groups/${familyGroupId}/investments`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery<InvestmentSummaryDto>({
    queryKey: [
      ...queryKeys.investments.summary(familyGroupId ?? ""),
      token ?? "",
    ],
    queryFn: () =>
      apiFetch<InvestmentSummaryDto>(
        `/family-groups/${familyGroupId}/investments/summary`,
        { token },
      ),
    enabled: !!token && !!familyGroupId,
  });

  // EPIC-022 D2 — the buy/sell history for the currently-open detail
  // dialog; only fetched while that dialog is open (no reason to fetch
  // every holding's history for a page that shows it one at a time).
  const { data: detailTransactions } = useQuery<InvestmentTransactionDto[]>({
    queryKey: [
      "investments",
      familyGroupId ?? "",
      detailHolding?.id ?? "",
      "transactions",
    ],
    queryFn: () =>
      apiFetch<InvestmentTransactionDto[]>(
        `/family-groups/${familyGroupId}/investments/${detailHolding?.id}/transactions`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && !!detailHolding,
  });
  // EPIC-033 p18 — every recorded price for the holding in view.
  const { data: detailPrices } = useQuery<InvestmentPriceDto[]>({
    queryKey: [
      "investments",
      familyGroupId ?? "",
      detailHolding?.id ?? "",
      "prices",
    ],
    queryFn: () =>
      apiFetch<InvestmentPriceDto[]>(
        `/family-groups/${familyGroupId}/investments/${detailHolding?.id}/prices`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && !!detailHolding,
  });

  // Keyed by holding so a range never leaks into the next holding opened.
  const [historyRange, setHistoryRange] = useState<{
    holdingId: string;
    from: string;
    to: string;
  } | null>(null);
  const activeHistoryRange =
    historyRange && historyRange.holdingId === detailHolding?.id
      ? historyRange
      : null;
  const visibleTransactions = filterByOccurredAt(
    detailTransactions ?? [],
    activeHistoryRange?.from ?? "",
    activeHistoryRange?.to ?? "",
  );

  // Live price updates via Socket.io — join family-group room for tenant isolation
  useEffect(() => {
    if (!familyGroupId || !token) return;

    const socket = io(`${apiUrl}/prices`, {
      transports: ["websocket"],
      query: { familyGroupId },
      auth: { token },
    });

    socket.on("priceUpdate", () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [familyGroupId, token, queryClient, apiUrl]);

  // Show error toast on holdings fetch failure
  useEffect(() => {
    if (holdingsError) {
      toast.error(t.investasi.errorLoad);
    }
  }, [holdingsError, t]);

  async function handleDeleteConfirm() {
    if (!familyGroupId || !token || !deletingHolding) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/investments/${deletingHolding.id}`,
        { method: "DELETE", token },
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
      toast.success(t.investasi.toastDeleted);
    } catch (err) {
      handleError(err);
    } finally {
      setDeletingHolding(null);
    }
  }

  const isLoading = holdingsLoading || summaryLoading;
  // F5 — a failed fetch must not render as an honest "no investments yet"
  // empty state; combines both queries this page depends on for its totals.
  const isPageError = holdingsError || summaryError;

  const filteredHoldings = (holdings ?? []).filter(
    (h) => activeFilter === "semua" || h.type === activeFilter,
  );

  // EPIC-025 N3-F2 — allocation-by-instrument donut: derived from the same
  // `holdings` list already fetched above, no new endpoint.
  const allocationByType = new Map<string, number>();
  for (const h of holdings ?? []) {
    const label = investmentClassLabel(t, h.type);
    allocationByType.set(
      label,
      (allocationByType.get(label) ?? 0) + parseFloat(h.currentValue ?? "0"),
    );
  }
  const allocationSegments: CompositionItem[] = (holdings ?? [])
    .reduce<{ type: string; label: string }[]>((acc, h) => {
      if (acc.some((a) => a.type === h.type)) return acc;
      return [
        ...acc,
        {
          type: h.type,
          label: investmentClassLabel(t, h.type),
        },
      ];
    }, [])
    .map(({ type, label }) => ({
      label,
      value: allocationByType.get(label) ?? 0,
      color: assetClassColor(type),
    }))
    .filter((seg) => seg.value > 0);

  // EPIC-024 #6/#7 pricing-source explainer: "only N positions priced live"
  // is derived from real holdings, never a static/invented count.
  const livePositionsCount = (holdings ?? []).filter(hasLiveFeedPrice).length;

  const positionCount = filteredHoldings.length;
  const totalValueNum = parseFloat(summary?.totalCurrentValue ?? "0");
  const returnDir = deltaDirection(summary?.totalReturnPct ?? 0, 2);
  const todayDir = deltaDirection(summary?.todayReturnPct ?? 0, 2);
  const mosaicLive =
    (holdings?.length ?? 0) === 0
      ? 0
      : Math.round((livePositionsCount / (holdings?.length ?? 1)) * 45);
  const mosaic = Array.from({ length: 45 }, (_, i) =>
    i < mosaicLive ? ("a" as const) : ("b" as const),
  );
  const formulaText =
    summary?.totalReturnRp != null && summary.totalCostBasis != null
      ? t.investasi.returnFormulaLabel
          .replace(
            "{returnRp}",
            money.format(Math.abs(parseFloat(summary.totalReturnRp))),
          )
          .replace(
            "{costBasis}",
            money.format(parseFloat(summary.totalCostBasis)),
          )
      : null;

  return (
    <>
      <BentoGrid className="iv-grid">
        <BentoHero
          className={cn("iv-hero", heroMore && "iv-hero--more")}
          currency={null}
          value={
            isPageError
              ? "—"
              : isLoading
                ? "…"
                : summary?.totalCurrentValue != null
                  ? money.format(totalValueNum)
                  : "—"
          }
          caption={
            isPageError
              ? undefined
              : isLoading
                ? "…"
                : `${holdings?.length ?? 0} ${t.investasi.v2.heroCapSuffix}`
          }
          controls={
            <>
              <GhostButton
                disabled={!familyGroupId}
                onClick={() => {
                  if (!familyGroupId) return;
                  void queryClient.invalidateQueries({
                    queryKey: queryKeys.investments.all(familyGroupId),
                  });
                  void queryClient.invalidateQueries({
                    queryKey: queryKeys.investments.summary(familyGroupId),
                  });
                  toast.success(t.investasi.refreshPriceToast);
                }}
              >
                <RefreshCw aria-hidden="true" />{" "}
                {t.investasi.refreshPriceButton}
              </GhostButton>
              {canManage && (
                <GhostButton lit onClick={() => setModalOpen(true)}>
                  <Plus aria-hidden="true" />{" "}
                  {t.investasi.addInvestmentHeaderButton}
                </GhostButton>
              )}
              {/* proto `.legend` under the ctrl-row — Modal (cost) vs Nilai
                  (current value), same colors as the bar chart below. */}
              <span className="iv-legend" aria-hidden="true">
                <span>
                  <i className="iv-dot-cost" />
                  {t.investasi.v2.legendCost}
                </span>
                <span>
                  <i className="iv-dot-value" />
                  {t.investasi.v2.legendValue}
                </span>
              </span>
            </>
          }
          chart={
            <div className="iv-chartcol">
              <div className="iv-plot">
                {filteredHoldings.length > 0 ? (
                  <HatchedBarChart
                    labels={filteredHoldings.map(
                      (h) => h.name.split(" ")[0] ?? h.name,
                    )}
                    series={[
                      {
                        name: t.investasi.v2.legendCost,
                        data: filteredHoldings.map(
                          (h) =>
                            parseFloat(h.costBasisPerUnit) *
                            parseFloat(h.quantity),
                        ),
                        color: "var(--viz-6)",
                      },
                      {
                        name: t.investasi.v2.legendValue,
                        data: filteredHoldings.map((h) =>
                          parseFloat(h.currentValue ?? "0"),
                        ),
                        color: "var(--wm-lime)",
                      },
                    ]}
                    format={money.formatCompact}
                    formatFull={money.format}
                    wide
                    ariaLabel={t.investasi.v2.chartAria}
                  />
                ) : (
                  <p className="wm-cap">{t.investasi.v2.chartEmpty}</p>
                )}
              </div>
            </div>
          }
          kpis={
            <>
              <HeroKpi
                label={t.investasi.totalValueLabel}
                value={
                  summary?.totalCurrentValue != null
                    ? money.format(totalValueNum)
                    : "—"
                }
                delta={
                  <span className="wm-cap">
                    {t.investasi.capitalInvestedPrefix}{" "}
                    <span className="wm-amt">
                      {formatDecimalRupiah(summary?.totalCostBasis ?? null)}
                    </span>
                  </span>
                }
              />
              <HeroKpi
                label={t.investasi.totalReturnSuffix}
                value={formatDecimalRupiah(summary?.totalReturnRp ?? null)}
                delta={
                  <span className="iv-kdelta">
                    <Delta
                      dir={returnDir}
                      value={formatReturnPct(summary?.totalReturnPct ?? null)}
                    />
                    {formulaText && (
                      <Tooltip>
                        <TooltipTrigger
                          aria-label={formulaText}
                          className="iv-info"
                        >
                          <Info className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent>{formulaText}</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                }
              />
              <HeroKpi
                label={t.investasi.todayReturnLabel}
                value={formatDecimalRupiah(summary?.todayReturnRp ?? null)}
                delta={
                  summary?.todayReturnPct == null ? (
                    <span className="wm-delta" data-tone="neutral">
                      —
                    </span>
                  ) : (
                    <span className="iv-kdelta">
                      <Delta
                        dir={todayDir}
                        value={formatReturnPct(summary.todayReturnPct)}
                      />
                      <span className="wm-cap">
                        {t.investasi.livePositionsOnlyPrefix}{" "}
                        {livePositionsCount} {t.investasi.livePositionsSuffix}
                      </span>
                    </span>
                  )
                }
              />
              <button
                type="button"
                className="iv-hero-more"
                aria-expanded={heroMore}
                onClick={() => setHeroMore((open) => !open)}
              >
                {heroMore ? t.transaksi.v2.heroLess : t.transaksi.v2.heroMore}
                <ChevronDown aria-hidden="true" />
              </button>
            </>
          }
        />

        {!isLoading && allocationSegments.length > 0 && (
          <BentoCard
            className={cn("iv-comp", heroMore && "iv-comp--more")}
            title={t.investasi.v2.allocTitle}
            caption={t.investasi.v2.allocCaption}
          >
            <CompositionStack
              label={t.investasi.allocationTitle}
              center={money.format(totalValueNum)}
              sub={t.investasi.totalValueLabel}
              format={money.formatCompact}
              formatFull={money.format}
              items={allocationSegments}
            />
          </BentoCard>
        )}

        {/* The type filter lives right above the list as one scrollable row
            (it used to sit inside the hero chart). */}
        <div className="iv-chips-row">
          <Segmented
            className="iv-filters"
            label={t.investasi.v2.filterLabel}
            value={activeFilter}
            onChange={setActiveFilter}
            options={FILTER_TAB_IDS.map((id) => ({
              value: id,
              label:
                id === "semua"
                  ? t.investasi.filterAllLabel
                  : t.investasi.typeLabels[id],
            }))}
          />
        </div>

        <BentoCard
          className="iv-list"
          title={t.investasi.v2.listTitle}
          caption={`${positionCount} ${t.investasi.positionsCountSuffix}`}
        >
          {!isLoading && isPageError && (
            <p className="iv-state iv-state-bad" role="alert">
              {t.investasi.errorLoad}
            </p>
          )}
          <ul className="iv-rows">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <HoldingRowSkeleton key={`row-skeleton-${i}`} />
              ))}

            {!isLoading && !holdingsError && filteredHoldings.length === 0 && (
              <li className="iv-state">
                {t.investasi.emptyState}{" "}
                {(holdings?.length ?? 0) === 0 && canManage && (
                  <button
                    type="button"
                    className="iv-link"
                    onClick={() => setModalOpen(true)}
                  >
                    {t.investasi.emptyStateCta}
                  </button>
                )}
              </li>
            )}

            {filteredHoldings.map((h) => {
              const variant = TYPE_BADGE_VARIANT[h.type] ?? "gray";
              const label = investmentClassLabel(t, h.type);
              const logoBg = `color-mix(in srgb, ${assetClassColor(h.type)} 24%, var(--wm-card))`;
              const totalCost =
                parseFloat(h.costBasisPerUnit) * parseFloat(h.quantity);
              const isUp = parseFloat(h.returnRp ?? "0") >= 0;
              // No real price: the value is a cost-basis stand-in, so its
              // return is unknown, not zero (the price cell says why).
              const priced = hasMarketPrice(h);

              return (
                <li key={h.id} className="iv-row">
                  <span
                    className="iv-logo"
                    style={{ background: logoBg, color: "var(--wm-ink)" }}
                    aria-hidden="true"
                  >
                    {toLogoText(
                      AUTOMATED_PRICE_TYPES.includes(h.type as InvestmentType)
                        ? h.ticker
                        : h.name,
                    )}
                  </span>
                  <div className="iv-id">
                    <div className="iv-name">
                      <b>{h.name}</b>
                      <StatusBadge variant={variant}>{label}</StatusBadge>
                      {h.automatedPriceUnmapped && (
                        <StatusBadge variant="warning">
                          {t.investasi.automatedUnmappedBadge}
                        </StatusBadge>
                      )}
                    </div>
                    <small>{formatInstrumentSubline(h, t, locale)}</small>
                    <button
                      type="button"
                      className="iv-link"
                      onClick={() => setDetailHolding(h)}
                    >
                      {t.investasi.detailToggleShow}
                    </button>
                  </div>
                  <div className="iv-src">
                    <span className="mono">
                      {formatQuantityCell(h, t, money.format)}
                    </span>
                    {formatPriceSourceCell(h, t, locale, money.format)}
                  </div>
                  <div
                    className={`iv-val ${priced ? (isUp ? "is-up" : "is-down") : ""}`}
                  >
                    <b className="mono">
                      {formatDecimalRupiah(h.currentValue)}
                    </b>
                    <small className="mono">
                      {priced ? (
                        <>
                          <span className="wm-amt">
                            {formatDecimalRupiah(h.returnRp)}
                          </span>{" "}
                          ·{" "}
                          <span className="wm-amt">
                            {formatReturnPct(h.returnPct)}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </small>
                    <small className="iv-cost mono">
                      {t.investasi.v2.rowCapital}{" "}
                      <span className="wm-amt">{money.format(totalCost)}</span>
                    </small>
                  </div>
                  {canManage && (
                    <div className="iv-act">
                      {/* proto `data-buysell` icon — the only path to grow/
                          shrink a lot once it exists (see isEditingLots in
                          AddInvestmentModal), restored alongside edit/delete. */}
                      <button
                        type="button"
                        className="iv-buysell"
                        aria-label={t.investasi.buySellButtonLabel}
                        title={t.investasi.buySellButtonLabel}
                        onClick={() => setBuySellHolding(h)}
                      >
                        <ArrowLeftRight aria-hidden="true" />
                      </button>
                      <RowActions
                        onEdit={() => {
                          setEditingHolding(h);
                          setModalOpen(true);
                        }}
                        onDelete={() => setDeletingHolding(h)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </BentoCard>

        <section className="wm-card wm-tips iv-note">
          <div>
            <h2>
              <Info className="size-4" aria-hidden="true" />{" "}
              <strong>{t.investasi.pricingSourceNoticeTitle}</strong>
            </h2>
            {holdingsUpdatedAt > 0 && (
              <p>
                {t.investasi.pricingSourceLastSyncedPrefix}{" "}
                <span className="mono">
                  {formatLocaleDateTime(
                    new Date(holdingsUpdatedAt).toISOString(),
                    locale,
                  )}
                </span>
                .
              </p>
            )}
            <details className="iv-more">
              <summary>{t.investasi.pricingSourceMoreLabel}</summary>
              <p>{t.investasi.pricingSourceNoticeBody}</p>
            </details>
            <Link className="iv-link" href="/transaksi">
              {t.investasi.v2.noteDividends} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="wm-mosaic" aria-hidden="true">
            {mosaic.map((cell, index) => (
              <i key={index} data-v={cell} />
            ))}
          </div>
        </section>

        <div className="iv-tax">
          <InvestmentTaxCard />
        </div>
      </BentoGrid>

      {familyGroupId && token && (
        <AddInvestmentModal
          key={`edit-${editingHolding?.id ?? "add"}`}
          open={modalOpen}
          editing={editingHolding}
          onClose={() => {
            setModalOpen(false);
            setEditingHolding(null);
          }}
          familyGroupId={familyGroupId}
          token={token}
        />
      )}
      {familyGroupId && token && (
        <BuySellModal
          key={`trade-${buySellHolding?.id ?? "none"}`}
          open={!!buySellHolding}
          holding={buySellHolding}
          onClose={() => setBuySellHolding(null)}
          familyGroupId={familyGroupId}
          token={token}
        />
      )}
      <ConfirmDeleteDialog
        label={deletingHolding ? `"${deletingHolding.name}"` : null}
        onClose={() => setDeletingHolding(null)}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
      />
      <Dialog
        open={!!detailHolding}
        onOpenChange={(open) => {
          if (!open) setDetailHolding(null);
        }}
      >
        <DialogContent className="min-[769px]:w-[min(56rem,calc(100%-2rem))]">
          {detailHolding && (
            <>
              <DialogHeader>
                <DialogTitle>{detailHolding.name}</DialogTitle>
                <DialogDescription>
                  {formatInstrumentSubline(detailHolding, t, locale)}
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="grid gap-4 md:grid-cols-2">
                <div className="min-w-0 space-y-3">
                  <div className="rounded-[10px] border bg-muted/30 p-3">
                    <RealSparkline
                      prices={detailPrices ?? []}
                      emptyLabel={t.investasi.priceHistoryEmpty}
                    />
                    <div className="mt-2 text-[12px] text-muted-foreground">
                      {t.investasi.priceHistoryChartCaption}
                    </div>
                  </div>
                  <div className="grid gap-2 text-[12.5px] sm:grid-cols-2">
                    <DetailMetric
                      label={t.investasi.detailLatestPriceLabel}
                      value={formatDecimalRupiah(detailHolding.currentPrice)}
                    />
                    <DetailMetric
                      label={t.investasi.tableValue}
                      value={formatDecimalRupiah(detailHolding.currentValue)}
                    />
                    <DetailMetric
                      label={t.investasi.detailSourceLabel}
                      value={String(
                        detailHolding.latestPriceSource === "manual"
                          ? t.investasi.detailManualLabelPrefix.replace(
                              /:?\s*$/,
                              "",
                            )
                          : PRICE_SOURCE_LABEL_KEYS[
                                detailHolding.latestPriceSource as keyof typeof PRICE_SOURCE_LABEL_KEYS
                              ]
                            ? t.investasi.sourceLabels[
                                PRICE_SOURCE_LABEL_KEYS[
                                  detailHolding.latestPriceSource as keyof typeof PRICE_SOURCE_LABEL_KEYS
                                ]
                              ]
                            : detailHolding.latestPriceSource,
                      )}
                    />
                    <DetailMetric
                      label={t.investasi.totalReturnSuffix}
                      value={
                        hasMarketPrice(detailHolding)
                          ? `${formatDecimalRupiah(detailHolding.returnRp)} (${formatReturnPct(
                              detailHolding.returnPct,
                            )})`
                          : "—"
                      }
                      tone={
                        !hasMarketPrice(detailHolding)
                          ? undefined
                          : parseFloat(detailHolding.returnRp ?? "0") >= 0
                            ? "text-success"
                            : "text-destructive"
                      }
                    />
                    {/* EPIC-022 D2 — realized P/L, the sum of every SELL ever
                      recorded against this holding. Null (never a
                      fabricated "0") until a sell has been recorded. */}
                    <DetailMetric
                      label={t.investasi.detailRealizedPnlLabel}
                      value={formatDecimalRupiah(detailHolding.realizedPnlRp)}
                      tone={
                        detailHolding.realizedPnlRp &&
                        parseFloat(detailHolding.realizedPnlRp) >= 0
                          ? "text-success"
                          : detailHolding.realizedPnlRp
                            ? "text-destructive"
                            : undefined
                      }
                    />
                  </div>
                  <div className="rounded-[10px] bg-accent p-3 text-[12px] text-accent-foreground">
                    {detailHolding.currentPrice === null
                      ? detailHolding.automatedPriceSimulated
                        ? t.investasi.priceSimulatedNote
                        : detailHolding.automatedPriceUnmapped
                          ? t.investasi.automatedUnmappedNote
                          : isManualPriceType(
                                detailHolding.type as InvestmentType,
                              )
                            ? t.investasi.detailNoManualPrice
                            : t.investasi.detailPriceUnavailable
                      : detailHolding.latestPriceSource === "manual"
                        ? `${t.investasi.detailManualLabelPrefix}${formatManualDate(
                            detailHolding.latestPriceAsOf ??
                              detailHolding.latestPriceRecordedAt ??
                              new Date().toISOString(),
                            locale,
                          )}`
                        : `${t.investasi.detailRecordedAtLabel}: ${
                            (detailHolding.latestPriceAsOf ??
                            detailHolding.latestPriceRecordedAt)
                              ? formatLocaleDateTime(
                                  detailHolding.latestPriceAsOf ??
                                    detailHolding.latestPriceRecordedAt ??
                                    "",
                                  locale,
                                )
                              : "—"
                          }`}
                  </div>
                  {/* EPIC-033 p18 — price history (manual + feed). */}
                  <div>
                    <div className="mb-1.5 text-[12px] font-semibold text-muted-foreground">
                      {t.investasi.priceHistoryTitle}
                    </div>
                    {(detailPrices ?? []).length === 0 ? (
                      <div className="text-[12px] text-muted-foreground">
                        {t.investasi.priceHistoryEmpty}
                      </div>
                    ) : (
                      <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                        {(detailPrices ?? []).map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-2 rounded-[8px] border p-2 text-[11.5px]"
                          >
                            <span className="text-muted-foreground">
                              {new Date(p.asOf).toLocaleDateString(
                                locale === "id" ? "id-ID" : "en-US",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                              {" · "}
                              {p.source === "manual"
                                ? t.investasi.priceSourceManual
                                : p.source}
                            </span>
                            <span className="mono font-semibold">
                              {formatDecimalRupiah(p.price)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <DateRangeFilterField
                      from={activeHistoryRange?.from ?? ""}
                      to={activeHistoryRange?.to ?? ""}
                      locale={locale}
                      label={t.investasi.historyFilterLabel}
                      cancelLabel={t.common.cancel}
                      applyLabel={t.investasi.historyFilterApply}
                      onApply={(from, to) =>
                        setHistoryRange({
                          holdingId: detailHolding.id,
                          from,
                          to,
                        })
                      }
                    />
                    {activeHistoryRange && (
                      <button
                        type="button"
                        className="text-[11.5px] font-semibold text-primary"
                        onClick={() => setHistoryRange(null)}
                      >
                        {t.investasi.historyFilterClear}
                      </button>
                    )}
                  </div>
                  {/* EPIC-022 D2 — the real buy/sell history a whole-record
                    "edit" used to destroy with no trace. */}
                  <div>
                    <div className="mb-1.5 text-[12px] font-semibold text-muted-foreground">
                      {t.investasi.historySectionTitle}
                    </div>
                    {(detailTransactions ?? []).length === 0 ? (
                      <div className="text-[12px] text-muted-foreground">
                        {t.investasi.historyEmptyLabel}
                      </div>
                    ) : visibleTransactions.length === 0 ? (
                      <div className="text-[12px] text-muted-foreground">
                        {t.investasi.historyFilterEmpty}
                      </div>
                    ) : (
                      <ul className="space-y-1.5">
                        {visibleTransactions.map((tx) => (
                          <li
                            key={tx.id}
                            className="flex items-center justify-between gap-2 rounded-[8px] border p-2 text-[11.5px]"
                          >
                            <div className="flex items-center gap-1.5">
                              <StatusBadge
                                variant={tx.type === "buy" ? "info" : "warning"}
                              >
                                {tx.type === "buy"
                                  ? t.investasi.historyBuyLabel
                                  : t.investasi.historySellLabel}
                              </StatusBadge>
                              <span className="mono">
                                {/* B9 follow-up — a gold transaction is
                                    stored in grams @ price-per-gram
                                    (unchanged); displayed here as kg @
                                    price-per-kg (×1000, exact) so the shown
                                    quantity always matches the holding's
                                    kg unit. */}
                                {formatQuantity(
                                  detailHolding.type === "emas"
                                    ? gramsToKg(tx.quantity)
                                    : tx.quantity,
                                  detailHolding.type,
                                )}{" "}
                                {quantityUnitLabel(
                                  detailHolding.type,
                                  "lembar",
                                  unitLabels(t),
                                ).toLowerCase()}{" "}
                                @{" "}
                                {formatDecimalRupiah(
                                  detailHolding.type === "emas"
                                    ? multiplyBy1000(tx.pricePerUnit)
                                    : tx.pricePerUnit,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {tx.realizedPnl && (
                                <span
                                  className={cn(
                                    "mono",
                                    parseFloat(tx.realizedPnl) >= 0
                                      ? "text-success"
                                      : "text-destructive",
                                  )}
                                >
                                  {t.investasi.historyRealizedPnlTemplate.replace(
                                    "{pnl}",
                                    formatDecimalRupiah(tx.realizedPnl),
                                  )}
                                </span>
                              )}
                              <span>
                                {formatManualDate(tx.occurredAt, locale)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {canManage && detailHolding.type !== "deposito" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setBuySellHolding(detailHolding);
                        setDetailHolding(null);
                      }}
                    >
                      {t.investasi.buySellButtonLabel}
                    </Button>
                  )}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" onClick={() => setDetailHolding(null)}>
                  Tutup
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
