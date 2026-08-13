"use client";

import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { TrendingUp, RefreshCw, Info, Plus } from "lucide-react";

import {
  SectionCard,
  StatusBadge,
  IconChip,
  CountUpRupiah,
  Rise,
} from "@/components/wm";
import { DonutChart } from "@/components/charts/apex-presets";
import type { DonutSegment } from "@/components/charts/donut";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RowActions, ConfirmDeleteDialog } from "@/components/crud";
import { formatManualDate } from "@/components/consolidated-total-card";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, formatNumber } from "@/lib/format";
import {
  canonicalizeSahamQuantity,
  convertQuantityDisplay,
  divideBy100,
} from "./quantity-conversion";

import type { Locale } from "@/i18n";
import type { InvestmentDto, InvestmentSummaryDto } from "@wealthme/contracts";
import type { QuantityUnit } from "./quantity-conversion";

const TYPE_BADGE_VARIANT: Record<
  string,
  "info" | "purple" | "warning" | "success" | "gray"
> = {
  saham: "info",
  reksa_dana: "purple",
  obligasi: "success",
  emas: "warning",
  kripto: "info",
  lainnya: "gray",
  // EPIC-024 C2/C3 (D10).
  deposito: "success",
};

const TYPE_LOGO_BG: Record<string, string> = {
  saham: "#0061AF",
  reksa_dana: "#7C3AED",
  obligasi: "#1E3A5F",
  emas: "#D97706",
  kripto: "#F97316",
  lainnya: "#6B7280",
  deposito: "#0F766E",
};

// EPIC-025 N3-F2 — allocation-by-instrument donut (FOLD per J3): same
// per-type colors as TYPE_LOGO_BG, reused so the donut and the holdings
// table's ticker chips agree visually.
const TYPE_DONUT_COLOR = TYPE_LOGO_BG;

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
function isManualPriceType(type: InvestmentType): boolean {
  return !AUTOMATED_PRICE_TYPES.includes(type);
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

/** yyyy-mm-dd for a native `<input type="date">`, or "" when absent. */
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toLogoText(ticker: string): string {
  return ticker.slice(0, 4).toUpperCase();
}

function formatDecimalRupiah(value: string | null): string {
  if (!value) return "—";
  return formatRupiah(parseFloat(value));
}

function formatReturnPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
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
  if (purchasedDate) {
    return t.investasi.rowTickerPurchasedTemplate
      .replace("{ticker}", h.ticker)
      .replace("{date}", purchasedDate);
  }
  return h.ticker;
}

// EPIC-025 N3 audit — restores the prototype's "Jumlah" column. Every unit
// shown is derived from the real stored `quantity`/`costBasisPerUnit`
// (never invented). Saham shows both lot and lembar via the SAME exact
// decimal math (`divideBy100`) as the add/edit form's Lot/Lembar toggle.
function formatQuantityCell(h: InvestmentDto, t: Dict): ReactNode {
  const qty = parseFloat(h.quantity);
  if (h.type === "saham") {
    const lot = parseFloat(divideBy100(h.quantity));
    return (
      <>
        <div>
          {formatNumber(lot)} {t.investasi.unitLot.toLowerCase()}
        </div>
        <div className="text-muted-foreground">
          {formatNumber(qty)} {t.investasi.unitLembar.toLowerCase()}
        </div>
      </>
    );
  }
  if (h.type === "kripto") {
    return (
      <div>
        {qty.toLocaleString("id-ID", { maximumFractionDigits: 8 })} {h.ticker}
      </div>
    );
  }
  if (h.type === "reksa_dana") {
    return (
      <div>
        {formatNumber(qty)} {t.investasi.unitFundUnit}
      </div>
    );
  }
  if (h.type === "emas") {
    return (
      <div>
        {formatNumber(qty)} {t.investasi.unitGram}
      </div>
    );
  }
  if (h.type === "obligasi" || h.type === "deposito") {
    // Prototype shows the total nominal here, which equals this row's own
    // "Modal" column value (quantity × costBasisPerUnit) — not a separate,
    // invented figure.
    const nominal = parseFloat(h.costBasisPerUnit) * qty;
    return (
      <div>
        {t.investasi.nominalPrefix}
        {formatRupiah(nominal)}
      </div>
    );
  }
  return <div>{formatNumber(qty)}</div>;
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
): ReactNode {
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

  // Manual-priced types: reksa_dana, obligasi, emas, lainnya.
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

function SummaryCardSkeleton() {
  return (
    <Card className="gap-0 p-5">
      <SkeletonBlock className="mb-1 h-3 w-28" />
      <SkeletonBlock className="h-7 w-40" />
      <SkeletonBlock className="mt-1 h-3 w-36" />
    </Card>
  );
}

function HoldingRowSkeleton() {
  return (
    <tr className="border-b last:border-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={`skeleton-${i}`} className="py-3 pr-3">
          <SkeletonBlock className="h-4 w-20" />
        </td>
      ))}
    </tr>
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
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AddInvestmentForm>(() =>
    editing
      ? {
          ticker: editing.ticker,
          name: editing.name,
          type: editing.type as InvestmentType,
          // Stored quantity is ALWAYS canonical lembar — display it as
          // lembar with zero conversion (idempotency by construction).
          quantity: editing.quantity,
          quantityUnit: "lembar",
          costBasisPerUnit: editing.costBasisPerUnit,
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
  const isDeposito = form.type === "deposito";
  const isManual =
    (isManualPriceType(form.type) && !isDeposito) || isAutomatedUnmapped;

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
      } else if (isDeposito) {
        // Deposito nominal is the total (costBasisPerUnit); quantity is
        // fixed at 1, never user-entered.
        canonicalQuantity = "1";
      }

      const body: Record<string, string> = {
        ticker: form.ticker,
        name: form.name,
        type: form.type,
        quantity: canonicalQuantity,
        costBasisPerUnit: form.costBasisPerUnit,
      };
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
          body: JSON.stringify(body),
        });
      } catch {
        toast.error(
          editing ? t.investasi.toastUpdateFailed : t.investasi.toastAddFailed,
        );
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
              body: JSON.stringify({
                price: form.manualPrice.trim(),
                ...(form.manualPriceDate
                  ? { asOf: new Date(form.manualPriceDate).toISOString() }
                  : {}),
              }),
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? t.investasi.modalTitleEdit : t.investasi.modalTitleAdd}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <label
              className="text-[12px] text-muted-foreground"
              htmlFor="ticker"
            >
              {t.investasi.fieldTickerLabel}
            </label>
            <input
              id="ticker"
              name="ticker"
              required
              value={form.ticker}
              onChange={handleChange}
              placeholder={t.investasi.fieldTickerPlaceholder}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground" htmlFor="name">
              {t.investasi.fieldNameLabel}
            </label>
            <input
              id="name"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              placeholder={t.investasi.fieldNamePlaceholder}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground" htmlFor="type">
              {t.investasi.fieldTypeLabel}
            </label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            >
              {INVESTMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t.investasi.typeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          {/* EPIC-024 C3 (D9) — saham gets a Lot/Lembar toggle (canonical
              lembar, ×100, converted only at submit — see
              handleQuantityUnitChange); kripto is coin decimals; deposito
              has no quantity input at all (fixed at 1, nominal lives in
              costBasisPerUnit below). */}
          {!isDeposito && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  className="text-[12px] text-muted-foreground"
                  htmlFor="quantity"
                >
                  {form.type === "kripto"
                    ? t.investasi.fieldQuantityKriptoLabel
                    : t.investasi.fieldQuantityLabel}
                </label>
                {form.type === "saham" && (
                  <div
                    className="flex overflow-hidden rounded-md border text-[11px]"
                    role="group"
                    aria-label={t.investasi.fieldQuantityUnitLabel}
                  >
                    {(["lot", "lembar"] as const).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        aria-pressed={form.quantityUnit === unit}
                        onClick={() => handleQuantityUnitChange(unit)}
                        className={`px-2.5 py-1 font-semibold transition-colors ${
                          form.quantityUnit === unit
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {unit === "lot"
                          ? t.investasi.unitLot
                          : t.investasi.unitLembar}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                id="quantity"
                name="quantity"
                type="number"
                required
                min="0"
                step="any"
                value={form.quantity}
                onChange={handleChange}
                placeholder={
                  form.type === "kripto"
                    ? t.investasi.fieldQuantityKriptoPlaceholder
                    : form.type === "saham" && form.quantityUnit === "lot"
                      ? t.investasi.fieldQuantityLotPlaceholder
                      : form.type === "saham"
                        ? t.investasi.fieldQuantityLembarPlaceholder
                        : t.investasi.fieldQuantityPlaceholder
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          <div className="space-y-1">
            <label
              className="text-[12px] text-muted-foreground"
              htmlFor="costBasisPerUnit"
            >
              {isDeposito
                ? t.investasi.fieldDepositoNominalLabel
                : t.investasi.fieldCostBasisLabel}
            </label>
            <input
              id="costBasisPerUnit"
              name="costBasisPerUnit"
              type="number"
              required
              min="0"
              step="any"
              value={form.costBasisPerUnit}
              onChange={handleChange}
              placeholder={
                isDeposito
                  ? t.investasi.fieldDepositoNominalPlaceholder
                  : t.investasi.fieldCostBasisPlaceholder
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {/* EPIC-024 C3 (D7) — "tanggal beli", every instrument type. */}
          <div className="space-y-1">
            <label
              className="text-[12px] text-muted-foreground"
              htmlFor="purchasedAt"
            >
              {t.investasi.fieldPurchaseDateLabel}
            </label>
            <input
              id="purchasedAt"
              name="purchasedAt"
              type="date"
              value={form.purchasedAt}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {INTEREST_BEARING_TYPES.includes(form.type) && (
            <div className="space-y-1">
              <label
                className="text-[12px] text-muted-foreground"
                htmlFor="interestRatePct"
              >
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
                className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          {/* EPIC-024 C3 (D10) — deposito's jatuh tempo. */}
          {isDeposito && (
            <div className="space-y-1">
              <label
                className="text-[12px] text-muted-foreground"
                htmlFor="maturityDate"
              >
                {t.investasi.fieldMaturityDateLabel}
              </label>
              <input
                id="maturityDate"
                name="maturityDate"
                type="date"
                value={form.maturityDate}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          {/* EPIC-023 G1 (D15) — per-type pricing: manual types get a dated
              manual-price field; automated types (saham/kripto) get an
              honest note instead, since the price comes from Yahoo/CoinGecko.
              EPIC-024 C3 (D10) — deposito gets neither: its value is
              computed from bunga %/thn, never entered. */}
          {isDeposito ? (
            <div className="rounded-md border border-dashed p-3 text-[11.5px] text-muted-foreground">
              {t.investasi.depositoValuationNote}
            </div>
          ) : isManual ? (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <div className="text-[11.5px] text-muted-foreground">
                {isAutomatedUnmapped
                  ? t.investasi.automatedUnmappedNote
                  : t.investasi.manualPriceNote}
              </div>
              <div className="space-y-1">
                <label
                  className="text-[12px] text-muted-foreground"
                  htmlFor="manualPrice"
                >
                  {t.investasi.fieldManualPriceLabel}
                </label>
                <input
                  id="manualPrice"
                  name="manualPrice"
                  type="number"
                  min="0"
                  step="any"
                  value={form.manualPrice}
                  onChange={handleChange}
                  placeholder={t.investasi.fieldManualPricePlaceholder}
                  className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-[12px] text-muted-foreground"
                  htmlFor="manualPriceDate"
                >
                  {t.investasi.fieldManualPriceDateLabel}
                </label>
                <input
                  id="manualPriceDate"
                  name="manualPriceDate"
                  type="date"
                  value={form.manualPriceDate}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-[11.5px] text-muted-foreground">
              {form.type === "kripto"
                ? t.investasi.autoPriceNoteKripto
                : t.investasi.autoPriceNoteSaham}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t.investasi.saving : t.investasi.saveButton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function InvestasiPage() {
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentDto | null>(
    null,
  );
  const [deletingHolding, setDeletingHolding] = useState<InvestmentDto | null>(
    null,
  );
  // EPIC-021 #19: filter tabs by type, matching the /aset tab pattern.
  const [activeFilter, setActiveFilter] = useState<FilterTabId>("semua");
  // EPIC-021 #20: expandable per-row detail (latest price provenance +
  // interest-bearing projected yield).
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const { data: summary, isLoading: summaryLoading } =
    useQuery<InvestmentSummaryDto>({
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
    } catch {
      toast.error(t.investasi.toastDeleteFailed);
    } finally {
      setDeletingHolding(null);
    }
  }

  const isLoading = holdingsLoading || summaryLoading;

  const filteredHoldings = (holdings ?? []).filter(
    (h) => activeFilter === "semua" || h.type === activeFilter,
  );

  // EPIC-025 N3-F2 — allocation-by-instrument donut (FOLD per J3): derived
  // from the same `holdings` list already fetched above, no new endpoint.
  // The prototype's "Nilai Portofolio 6 Bulan" trend chart is CUT per J3 —
  // no historical price-snapshot series exists to build it from.
  const allocationByType = new Map<string, number>();
  for (const h of holdings ?? []) {
    const label = t.investasi.typeLabels[h.type as InvestmentType] ?? h.type;
    allocationByType.set(
      label,
      (allocationByType.get(label) ?? 0) + parseFloat(h.currentValue ?? "0"),
    );
  }
  const allocationSegments: DonutSegment[] = (holdings ?? [])
    .reduce<{ type: string; label: string }[]>((acc, h) => {
      if (acc.some((a) => a.type === h.type)) return acc;
      return [
        ...acc,
        {
          type: h.type,
          label: t.investasi.typeLabels[h.type as InvestmentType] ?? h.type,
        },
      ];
    }, [])
    .map(({ type, label }) => ({
      label,
      value: allocationByType.get(label) ?? 0,
      color: TYPE_DONUT_COLOR[type] ?? "#6B7280",
    }))
    .filter((seg) => seg.value > 0);

  // EPIC-024 #6/#7 pricing-source explainer: "only N positions priced live"
  // is derived from real holdings, never a static/invented count.
  const livePositionsCount = (holdings ?? []).filter((h) =>
    AUTOMATED_PRICE_TYPES.includes(h.type as InvestmentType),
  ).length;

  return (
    <div className="space-y-4">
      {/* EPIC-025 N3 audit (structural port) — page-lead header: title +
          subtitle, "Perbarui Harga" (real manual refresh — invalidates the
          same live-price queries the socket.io listener above invalidates,
          not just a toast with no effect) and "Catat Investasi" (the SAME
          openAdd flow the table used to expose as a header link). Gap #2:
          the prototype orders stat cards → info callout → filter pills →
          table; the old layout put the filter pills first. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="text-[17px] font-extrabold tracking-tight">
            {t.shell.pageTitles.investasi}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {t.investasi.pageSubtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
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
            <RefreshCw className="size-3.5" /> {t.investasi.refreshPriceButton}
          </Button>
          <Button type="button" size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="size-3.5" />{" "}
            {t.investasi.addInvestmentHeaderButton}
          </Button>
        </div>
      </div>

      {familyGroupId && token && (
        <AddInvestmentModal
          key={editingHolding?.id ?? "add"}
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
      <ConfirmDeleteDialog
        label={deletingHolding ? `"${deletingHolding.name}"` : null}
        onClose={() => setDeletingHolding(null)}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
      />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {isLoading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <Rise index={0}>
              <div className="transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
                <Card className="gap-0 p-5">
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <IconChip
                      icon={TrendingUp}
                      className="bg-violet-100 text-violet-600"
                      size={34}
                      rounded="rounded-full"
                    />
                    {t.investasi.totalValueLabel}
                  </div>
                  <div className="mono text-[24px] font-black text-primary">
                    {summary?.totalCurrentValue != null ? (
                      <CountUpRupiah
                        value={parseFloat(summary.totalCurrentValue)}
                      />
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {t.investasi.capitalInvestedPrefix}{" "}
                    <span className="mono">
                      {formatDecimalRupiah(summary?.totalCostBasis ?? null)}
                    </span>
                  </div>
                </Card>
              </div>
            </Rise>
            <Rise index={1}>
              <div className="transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
                <Card className="gap-0 p-5">
                  <div className="mb-1 text-[11px] text-muted-foreground">
                    {t.investasi.totalReturnSuffix}
                  </div>
                  <div
                    className={`mono text-[24px] font-black ${
                      (summary?.totalReturnPct ?? 0) >= 0
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {formatDecimalRupiah(summary?.totalReturnRp ?? null)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge
                      variant={
                        (summary?.totalReturnPct ?? 0) >= 0
                          ? "success"
                          : "danger"
                      }
                    >
                      {(summary?.totalReturnPct ?? 0) >= 0 ? "▲" : "▼"}{" "}
                      {formatReturnPct(summary?.totalReturnPct ?? null)}
                    </StatusBadge>
                    {/* Gap #3 — formula sub-line, computed from the real
                        summary DTO (never a static/invented figure). */}
                    {summary?.totalReturnRp != null &&
                      summary.totalCostBasis != null && (
                        <span className="text-[11px] text-muted-foreground">
                          {t.investasi.returnFormulaLabel
                            .replace(
                              "{returnRp}",
                              formatRupiah(
                                Math.abs(parseFloat(summary.totalReturnRp)),
                              ),
                            )
                            .replace(
                              "{costBasis}",
                              formatRupiah(parseFloat(summary.totalCostBasis)),
                            )}
                        </span>
                      )}
                  </div>
                </Card>
              </div>
            </Rise>
            <Rise index={2}>
              <div className="transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
                <Card className="gap-0 p-5">
                  <div className="mb-1 text-[11px] text-muted-foreground">
                    {t.investasi.todayReturnLabel}
                  </div>
                  <div
                    className={`mono text-[24px] font-black ${
                      (summary?.todayReturnPct ?? 0) >= 0
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {formatDecimalRupiah(summary?.todayReturnRp ?? null)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge
                      variant={
                        (summary?.todayReturnPct ?? 0) >= 0
                          ? "success"
                          : "danger"
                      }
                    >
                      {formatReturnPct(summary?.todayReturnPct ?? null)}
                    </StatusBadge>
                    <span className="text-[11px] text-muted-foreground">
                      {t.investasi.livePositionsOnlyPrefix} {livePositionsCount}{" "}
                      {t.investasi.livePositionsSuffix}
                    </span>
                  </div>
                </Card>
              </div>
            </Rise>
          </>
        )}
      </div>

      {/* EPIC-024 #6/#7 pricing-source explainer, extended by the N3 audit
          (gap #9) with a real "Terakhir sinkron" line sourced from
          react-query's own `dataUpdatedAt` for the holdings fetch — never a
          static/invented timestamp. */}
      <div className="flex items-start gap-2.5 rounded-[11px] border border-primary/25 bg-accent p-3 text-[12.5px] text-accent-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>{t.investasi.pricingSourceNoticeTitle}</strong>{" "}
          {t.investasi.pricingSourceNoticeBody}
          {holdingsUpdatedAt > 0 && (
            <>
              {" "}
              {t.investasi.pricingSourceLastSyncedPrefix}{" "}
              <span className="mono">
                {formatLocaleDateTime(
                  new Date(holdingsUpdatedAt).toISOString(),
                  locale,
                )}
              </span>
              .
            </>
          )}
        </span>
      </div>

      {/* EPIC-021 #19: filter tabs by type. Gap #2 — moved below the info
          callout (prototype order: stats → callout → pills → table). Gap
          #4 — "Baru" badge on the deposito pill, matching the prototype. */}
      <div className="hide-scrollbar flex gap-2 overflow-x-auto">
        {FILTER_TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveFilter(id)}
            className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
              activeFilter === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {id === "semua"
              ? t.investasi.filterAllLabel
              : t.investasi.typeLabels[id]}
            {id === "deposito" && (
              <StatusBadge variant="purple" className="ml-1.5">
                {t.investasi.filterNewBadge}
              </StatusBadge>
            )}
          </button>
        ))}
      </div>

      <SectionCard
        title={t.investasi.portfolioSectionTitle}
        action={
          <span className="text-[12px] text-muted-foreground">
            {filteredHoldings.length} {t.investasi.positionsCountSuffix}
          </span>
        }
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[580px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableName}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableType}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableQuantity}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tablePriceSource}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableCapital}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableValue}
                </th>
                <th className="py-2.5 pr-3 font-semibold">
                  {t.investasi.tableReturn}
                </th>
                <th className="py-2.5 font-semibold">
                  {t.investasi.tableAction}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <HoldingRowSkeleton key={`row-skeleton-${i}`} />
                ))}

              {!isLoading &&
                !holdingsError &&
                filteredHoldings.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-[13px] text-muted-foreground"
                    >
                      {t.investasi.emptyState}{" "}
                      {(holdings?.length ?? 0) === 0 && (
                        <button
                          type="button"
                          className="font-semibold text-primary"
                          onClick={() => setModalOpen(true)}
                        >
                          {t.investasi.emptyStateCta}
                        </button>
                      )}
                    </td>
                  </tr>
                )}

              {filteredHoldings.map((h, i) => {
                const variant = TYPE_BADGE_VARIANT[h.type] ?? "gray";
                const label =
                  t.investasi.typeLabels[h.type as InvestmentType] ?? h.type;
                const logoBg = TYPE_LOGO_BG[h.type] ?? "#6B7280";
                const totalCost =
                  parseFloat(h.costBasisPerUnit) * parseFloat(h.quantity);
                const isUp = parseFloat(h.returnRp ?? "0") >= 0;
                const isExpanded = expandedId === h.id;
                // EPIC-023 Task G retry (MEDIUM finding) — an unrecognised
                // source (a future real provider not yet in
                // PRICE_SOURCE_LABEL_KEYS) must render its own raw name, not
                // fall back to "Simulated" and imply it's fake.
                const priceSourceLabelKey =
                  PRICE_SOURCE_LABEL_KEYS[
                    h.latestPriceSource as keyof typeof PRICE_SOURCE_LABEL_KEYS
                  ];
                const priceSourceLabel = priceSourceLabelKey
                  ? t.investasi.sourceLabels[priceSourceLabelKey]
                  : h.latestPriceSource;

                return (
                  <Fragment key={h.id}>
                    <tr
                      className="animate-rise border-b last:border-0"
                      style={{ animationDelay: `${i * 70}ms` }}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex size-8 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                            style={{ background: logoBg }}
                          >
                            {toLogoText(h.ticker)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold">
                              {h.name}
                              {/* EPIC-024 C1 (D8) — permanent "no automated
                                  route for this ticker" state; distinct
                                  from a transient refresh failure. */}
                              {h.automatedPriceUnmapped && (
                                <StatusBadge variant="warning">
                                  {t.investasi.automatedUnmappedBadge}
                                </StatusBadge>
                              )}
                            </div>
                            {/* Gap #6 — ticker + purchase date (coupon/
                                maturity for obligasi/deposito), derived from
                                the real purchasedAt/interestRatePct/
                                maturityDate fields. */}
                            <div className="text-[11px] text-muted-foreground">
                              {formatInstrumentSubline(h, t, locale)}
                            </div>
                            <button
                              type="button"
                              className="mt-0.5 text-[10.5px] font-semibold text-primary"
                              onClick={() =>
                                setExpandedId(isExpanded ? null : h.id)
                              }
                            >
                              {isExpanded
                                ? t.investasi.detailToggleHide
                                : t.investasi.detailToggleShow}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge variant={variant}>{label}</StatusBadge>
                      </td>
                      {/* Gap #5 — restored "Jumlah" column. */}
                      <td className="mono py-3 pr-3 text-[11.5px] whitespace-nowrap">
                        {formatQuantityCell(h, t)}
                      </td>
                      {/* Gap #6 — restored "Harga / Sumber" column with
                          per-row price-source badges. */}
                      <td className="py-3 pr-3 text-[11.5px] whitespace-nowrap">
                        {formatPriceSourceCell(h, t, locale)}
                      </td>
                      <td className="mono py-3 pr-3 whitespace-nowrap">
                        {formatRupiah(totalCost)}
                      </td>
                      <td className="mono py-3 pr-3 font-extrabold whitespace-nowrap">
                        {formatDecimalRupiah(h.currentValue)}
                      </td>
                      {/* Gap #5 — merged Return-Rp + Return-% back into one
                          "Untung / Rugi" column, matching the prototype. */}
                      <td
                        className={`mono py-3 pr-3 whitespace-nowrap ${
                          isUp ? "text-success" : "text-destructive"
                        }`}
                      >
                        <div className="font-semibold">
                          {formatDecimalRupiah(h.returnRp)}
                        </div>
                        <div className="text-[11px]">
                          {formatReturnPct(h.returnPct)}
                        </div>
                      </td>
                      <td className="py-3">
                        <RowActions
                          onEdit={() => {
                            setEditingHolding(h);
                            setModalOpen(true);
                          }}
                          onDelete={() => setDeletingHolding(h)}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b bg-muted/30 last:border-0">
                        <td colSpan={8} className="px-3 py-3 text-[12px]">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                              <div className="text-muted-foreground">
                                {t.investasi.detailLatestPriceLabel}
                              </div>
                              <div className="mono font-semibold">
                                {formatDecimalRupiah(h.currentPrice)}
                              </div>
                            </div>
                            {/* EPIC-023 G1 (D15) — honesty bar: every
                                automated price states its source and delay;
                                every manual price states its entry date. */}
                            {h.currentPrice === null ? (
                              <div className="col-span-2 text-muted-foreground">
                                {h.automatedPriceUnmapped
                                  ? t.investasi.automatedUnmappedNote
                                  : isManualPriceType(h.type as InvestmentType)
                                    ? t.investasi.detailNoManualPrice
                                    : t.investasi.detailPriceUnavailable}
                              </div>
                            ) : h.latestPriceSource === "manual" ? (
                              <div className="col-span-2">
                                <div className="text-muted-foreground">
                                  {t.investasi.detailSourceLabel}
                                </div>
                                <div className="font-semibold">
                                  {t.investasi.detailManualLabelPrefix}
                                  {formatManualDate(
                                    h.latestPriceAsOf ??
                                      h.latestPriceRecordedAt ??
                                      new Date().toISOString(),
                                    locale,
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <div className="text-muted-foreground">
                                    {t.investasi.detailRecordedAtLabel}
                                  </div>
                                  <div className="font-semibold">
                                    {/* EPIC-023 Task G retry (MEDIUM finding)
                                        — the provider's own quote time
                                        (latestPriceAsOf), not the row's DB
                                        write time. */}
                                    {(h.latestPriceAsOf ??
                                    h.latestPriceRecordedAt)
                                      ? formatLocaleDateTime(
                                          h.latestPriceAsOf ??
                                            h.latestPriceRecordedAt ??
                                            "",
                                          locale,
                                        )
                                      : "—"}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">
                                    {t.investasi.detailSourceLabel}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                                    {priceSourceLabel}
                                    {h.latestPriceDelayed && (
                                      <StatusBadge variant="warning">
                                        {t.investasi.detailDelayedLabel}
                                      </StatusBadge>
                                    )}
                                    {/* EPIC-023 Task G retry (MEDIUM finding)
                                        — a refresh WAS attempted this
                                        request and failed: the price above
                                        is retained/stale, not fresh. */}
                                    {h.priceRefreshFailed && (
                                      <StatusBadge variant="warning">
                                        {t.investasi.detailRefreshFailedLabel}
                                      </StatusBadge>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                            {h.interestRatePct ? (
                              <>
                                <div>
                                  <div className="text-muted-foreground">
                                    {t.investasi.detailInterestRateLabel}
                                  </div>
                                  <div className="font-semibold">
                                    {h.interestRatePct}%
                                  </div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">
                                    {t.investasi.detailProjectedYieldLabel}
                                  </div>
                                  <div className="mono font-semibold">
                                    {formatDecimalRupiah(
                                      h.projectedAnnualYield,
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="col-span-2 text-muted-foreground">
                                {INTEREST_BEARING_TYPES.includes(h.type)
                                  ? t.investasi.detailNoRateSet
                                  : t.investasi.detailNoInterestRate}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Allocation-by-instrument donut (FOLD per J3 — derived from the
          holdings list already fetched above). Gap #7/#8 — the prototype's
          "Nilai Portofolio 6 Bulan" trend chart stays CUT per J3 (no
          historical price-snapshot series is persisted anywhere in the
          schema — confirmed still true, not fabricated): with no second
          chart to share the row, the donut is rendered on its own,
          constrained to a sensible width (not full-bleed) with a thinner
          ring and no legend row (matches `/aset`'s DonutChart treatment —
          `DonutChart` itself is protected and exposes no legend toggle, so
          the default ApexCharts legend is hidden page-locally). */}
      {!isLoading && allocationSegments.length > 0 && (
        <div className="max-w-md [&_.apexcharts-legend]:hidden">
          <SectionCard title={t.investasi.allocationTitle}>
            <DonutChart
              segments={allocationSegments}
              centerLabel={t.investasi.totalValueLabel}
              height={220}
              ariaLabel={`${t.investasi.allocationTitle}: ${allocationSegments.map((s) => `${s.label} ${formatDecimalRupiah(String(s.value))}`).join(", ")}`}
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
