"use client";

// EPIC-021 Group F (#6) — the family's manually-entered gold price per gram
// (IDR). No live gold price feed exists or may be fabricated (Open Design
// Decision #6): this is a single owner-editable value, backed by
// GET/PATCH /family-groups/:familyGroupId/gold-price. Every consumer must
// label the value "diinput manual, per <date>" (never implying a live
// quote) and must show an honest prompt instead of a fabricated number
// when no price has been set yet.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/auth-compat";
import { toGoldGrams } from "./gold-price-math";

export { toGoldGrams } from "./gold-price-math";

export type GoldPriceDto = {
  pricePerGram: string | null;
  updatedAt: string | null;
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

  const { data, isLoading, isError } = useQuery<GoldPriceDto>({
    queryKey: goldPriceQueryKey,
    queryFn: () =>
      apiFetch<GoldPriceDto>(`/family-groups/${familyGroupId}/gold-price`, {
        token,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
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
    mutationFn: (pricePerGram: number) =>
      apiFetch<GoldPriceDto>(`/family-groups/${familyGroupId}/gold-price`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ pricePerGram }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(goldPriceQueryKey, updated);
    },
  });

  const pricePerGram =
    data?.pricePerGram != null ? Number(data.pricePerGram) : null;
  const hasPrice = pricePerGram !== null && pricePerGram > 0;

  return {
    pricePerGram,
    updatedAt: data?.updatedAt ?? null,
    hasPrice,
    isOwner: Boolean(isOwner),
    isLoading,
    isError,
    updateGoldPrice,
    isUpdating,
    toGoldGrams: (valueInIdr: number) => toGoldGrams(valueInIdr, pricePerGram),
  };
}
