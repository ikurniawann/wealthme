"use client";

// EPIC-016 Task B2 — the user's display currency preference, resolved from
// their real profile (GET /auth/profile) and the FX rates service
// (GET /fx/rates?base=IDR, public — no auth token needed). Batch C
// (revisi-2, 2026-09-28): /fx/rates is now backed by FrankfurterFxService (a
// live feed, cached like fx_rates) by default — FxMockService only runs
// under FX_PROVIDER=mock. `isIndicative` still flags every non-IDR amount as
// an approximation, since the cached feed can be stale, so it must never be
// presented as an authoritative real-time conversion.

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";

// Mock rates barely move — refetching every hour is plenty and avoids
// hammering /fx/rates on every currency-aware page mount.
const FX_STALE_TIME_MS = 60 * 60 * 1000;

type FxRatesResponse = { base: string; rates: Record<string, number> };

export function useCurrencyPreference() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "IDR";
  const isIndicative = currency !== "IDR";

  // lib/query-keys.ts is a protected foundation file — inline key here.
  // `enabled: isIndicative` — users on the IDR default never need a
  // conversion rate, so skip firing /fx/rates for them entirely.
  const {
    data: fx,
    isLoading: isFxLoading,
    isError: isFxError,
  } = useQuery<FxRatesResponse>({
    queryKey: ["fx", "rates", "IDR"],
    queryFn: () => apiFetch<FxRatesResponse>("/fx/rates?base=IDR"),
    staleTime: FX_STALE_TIME_MS,
    enabled: isIndicative,
  });

  const resolvedRate = fx?.rates[currency];
  const rate = isIndicative ? (resolvedRate ?? 1) : 1;
  // isReady: false only while a non-IDR conversion rate is still in flight
  // or has failed to load — callers MUST treat that as "don't render a
  // number yet", never fall back to a 1:1 rate labeled with a foreign
  // currency symbol (that would silently misrepresent the amount by orders
  // of magnitude). IDR (no conversion needed) is always ready.
  const isReady = !isIndicative || (resolvedRate !== undefined && !isFxError);

  function formatMoney(value: number): string {
    return formatRupiah(
      value,
      isIndicative ? { code: currency, rate } : undefined,
    );
  }

  return {
    currency,
    rate,
    isIndicative,
    isReady,
    isRateLoading: isIndicative && isFxLoading,
    isRateError: isIndicative && isFxError,
    formatMoney,
  };
}
