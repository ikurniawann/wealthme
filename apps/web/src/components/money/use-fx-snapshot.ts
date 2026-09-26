"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

import type { FxRatesResponse } from "@wealthme/contracts";

const FX_STALE_TIME_MS = 60 * 60 * 1000;

/** Same key as useCurrencyPreference, so one cached /fx/rates serves both. */
export function useFxSnapshot(enabled: boolean) {
  return useQuery<FxRatesResponse>({
    queryKey: ["fx", "rates", "IDR"],
    queryFn: () => apiFetch<FxRatesResponse>("/fx/rates?base=IDR"),
    staleTime: FX_STALE_TIME_MS,
    enabled,
  });
}
