"use client";

// EPIC-021 Group F (#6) — consolidated net worth shown simultaneously in
// IDR + USD + gram-emas, per Open Design Decision #6: USD comes from the
// same indicative mock FX table as everywhere else (never a live rate),
// and gold comes from the family's manually-entered price per gram (never
// a fabricated market feed). Shared between /ringkasan and /beranda.

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { SectionCard } from "@/components/wm";
import { formatRupiah } from "@/lib/format";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";

type FxRatesResponse = { base: string; rates: Record<string, number> };

const FX_STALE_TIME_MS = 60 * 60 * 1000;

export function formatGoldGrams(grams: number): string {
  return grams.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formats `goldPriceUpdatedAt` as a locale-aware short date for the
 * "diinput manual, per <date>" disclosure. */
export function formatManualDate(isoDate: string, locale: string): string {
  return new Date(isoDate).toLocaleDateString(
    locale === "id" ? "id-ID" : "en-US",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

type ConsolidatedTotalCardProps = {
  netWorthIdr: number;
  isLoading?: boolean;
  className?: string;
};

export function ConsolidatedTotalCard({
  netWorthIdr,
  isLoading = false,
  className,
}: ConsolidatedTotalCardProps) {
  const { t, locale } = useLocale();
  const {
    updatedAt,
    hasPrice,
    toGoldGrams,
    isLoading: isGoldLoading,
    isAntamPrice,
  } = useGoldPrice();

  // Same query key as `useCurrencyPreference` — shares its cache entry
  // rather than issuing a second /fx/rates request.
  const { data: fx, isLoading: isFxLoading } = useQuery<FxRatesResponse>({
    queryKey: ["fx", "rates", "IDR"],
    queryFn: () => apiFetch<FxRatesResponse>("/fx/rates?base=IDR"),
    staleTime: FX_STALE_TIME_MS,
  });
  const usdRate = fx?.rates["USD"];

  const goldGrams = hasPrice ? toGoldGrams(netWorthIdr) : null;

  return (
    <SectionCard title={t.consolidatedTotal.title} className={className}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <div className="text-[11px] text-muted-foreground">
            {t.consolidatedTotal.idrLabel}
          </div>
          <div className="text-[16px] font-extrabold text-foreground">
            {isLoading
              ? t.consolidatedTotal.loadingLabel
              : formatRupiah(netWorthIdr)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">
            {t.consolidatedTotal.usdLabel}
          </div>
          <div className="text-[16px] font-extrabold text-foreground">
            {isLoading || isFxLoading || usdRate == null
              ? t.consolidatedTotal.loadingLabel
              : `≈ ${formatRupiah(netWorthIdr, { code: "USD", rate: usdRate })}`}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">
            {t.consolidatedTotal.goldLabel}
          </div>
          {isLoading || isGoldLoading ? (
            <div className="text-[16px] font-extrabold text-foreground">
              {t.consolidatedTotal.loadingLabel}
            </div>
          ) : goldGrams !== null ? (
            <div className="text-[16px] font-extrabold text-foreground">
              {formatGoldGrams(goldGrams)}
              {t.consolidatedTotal.goldUnitSuffix}
            </div>
          ) : (
            // No deep-link support into /akun's Pengaturan sub-page (local
            // component state, not a route) — link to /akun itself rather
            // than promising a jump this app can't make.
            <Link
              href="/akun"
              className="text-[12px] font-semibold text-primary hover:underline"
            >
              {t.consolidatedTotal.goldPromptText}
            </Link>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-0.5 text-[10.5px] text-muted-foreground">
        <div>{t.consolidatedTotal.indicativeFxNote}</div>
        {hasPrice && updatedAt && (
          <div>
            {isAntamPrice
              ? t.consolidatedTotal.antamLabelTemplate.replace(
                  "{date}",
                  formatManualDate(updatedAt, locale),
                )
              : `${t.consolidatedTotal.manualLabelPrefix}${formatManualDate(updatedAt, locale)}`}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
