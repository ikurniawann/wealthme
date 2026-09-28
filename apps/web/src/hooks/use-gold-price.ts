"use client";

// EPIC-021 Group F (#6) / B9 (client revision round 2) — the family's gold
// price, per gram (IDR). Originally manual-only (Open Design Decision #6:
// "no live gold feed exists or may be fabricated") — B9 supersedes that with
// the user-approved emasantam.id Antam feed (GET /gold-price/antam, cached
// server-side, refreshed at most every 6h, honestly labelled stale/unset —
// see AntamGoldPriceService). The live feed is preferred whenever it has a
// price; the family's manually-entered price (GET/PATCH
// /family-groups/:familyGroupId/gold-price) remains as an owner-settable
// override/fallback for whenever the feed has nothing cached yet. Every
// consumer must label which source is active: "Harga Antam 1 kg, sumber
// emasantam.id, diperbarui <tanggal>" for the feed, "diinput manual, per
// <date>" for the manual override — never implying a live quote for the
// manual value, and never silently mixing the two numbers.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FxInput } from "@wealthme/contracts";

import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/auth-compat";
import { toGoldGrams } from "./gold-price-math";

export { toGoldGrams } from "./gold-price-math";

export type GoldPriceDto = {
  pricePerGram: string | null;
  updatedAt: string | null;
};

/** B9 — GET /gold-price/antam response shape (AntamGoldPriceService). */
export type AntamGoldPriceDto = {
  pricePerKgIdr: string | null;
  source: string | null;
  fetchedAt: string | null;
  stale: boolean;
};

type FamilyGroupMine = { id: string; myRole: string };

export function useGoldPrice() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  const queryClient = useQueryClient();

  // Not yet in lib/query-keys.ts (protected) — inline, mirroring the
  // `useCurrencyPreference` fx-rates key pattern.
  const goldPriceQueryKey = ["family-groups", familyGroupId, "gold-price"];
  const antamGoldPriceQueryKey = ["gold-price", "antam"];

  const { data, isLoading, isError } = useQuery<GoldPriceDto>({
    queryKey: goldPriceQueryKey,
    queryFn: () =>
      apiFetch<GoldPriceDto>(`/family-groups/${familyGroupId}/gold-price`, {
        token,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
    staleTime: 60_000,
  });

  // B9 — public market data, not family-scoped; fetched whenever the user
  // is authenticated at all (no familyGroupId dependency), same as
  // useCurrencyPreference's /fx/rates call.
  const { data: antam, isLoading: isAntamLoading } =
    useQuery<AntamGoldPriceDto>({
      queryKey: antamGoldPriceQueryKey,
      queryFn: () =>
        apiFetch<AntamGoldPriceDto>("/gold-price/antam", { token }),
      enabled: Boolean(token),
      staleTime: 60_000,
    });

  // Shares its cache entry with AkunPage's own `/family-groups/mine` query
  // (same key factory), so owner-status is resolved without an extra
  // network round trip on pages that already fetched it.
  const { data: familyGroups } = useQuery<FamilyGroupMine[]>({
    queryKey: [...queryKeys.familyGroups.mine(), token],
    queryFn: () =>
      apiFetch<FamilyGroupMine[]>("/family-groups/mine", { token }),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const isOwner =
    familyGroups?.find((g) => g.id === familyGroupId)?.myRole === "owner";

  const { mutate: updateGoldPrice, isPending: isUpdating } = useMutation({
    mutationFn: (
      input: number | { pricePerGram: number; fxInputs?: FxInput[] },
    ) =>
      apiFetch<GoldPriceDto>(`/family-groups/${familyGroupId}/gold-price`, {
        method: "PATCH",
        token,
        body: JSON.stringify(
          typeof input === "number" ? { pricePerGram: input } : input,
        ),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(goldPriceQueryKey, updated);
    },
  });

  const antamPricePerKg =
    antam?.pricePerKgIdr != null ? Number(antam.pricePerKgIdr) : null;
  const manualPricePerGram =
    data?.pricePerGram != null ? Number(data.pricePerGram) : null;

  // B9 — the live Antam feed wins whenever it has a price; the manual entry
  // is the fallback (bootstrap before the feed's first successful fetch, or
  // an owner's deliberate override). Never averaged/blended.
  const isAntamActive = antamPricePerKg !== null && antamPricePerKg > 0;
  const pricePerGram = isAntamActive
    ? antamPricePerKg / 1000
    : manualPricePerGram;
  const hasPrice = pricePerGram !== null && pricePerGram > 0;

  return {
    pricePerGram,
    updatedAt: isAntamActive
      ? (antam?.fetchedAt ?? null)
      : (data?.updatedAt ?? null),
    hasPrice,
    isOwner: Boolean(isOwner),
    isLoading: isLoading || isAntamLoading,
    isError,
    updateGoldPrice,
    isUpdating,
    toGoldGrams: (valueInIdr: number) => toGoldGrams(valueInIdr, pricePerGram),
    // B9 — lets a consumer render the right label/source instead of always
    // saying "diinput manual": true when the Antam feed (not the manual
    // entry) is the active source of `pricePerGram`.
    isAntamPrice: isAntamActive,
    antamPricePerKg,
    antamStale: antam?.stale ?? false,
  };
}
