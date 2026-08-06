"use client";

// EPIC-023 F2 (D20, US-DON-6/7) — the family's religion setting (zakat /
// perpuluhan / neither), backed by GET/PATCH
// /family-groups/:familyGroupId/religion. Mirrors use-gold-price.ts's
// shape exactly (the precedent for a family-level manual setting):
// member-readable, owner-writable.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/auth-compat";

export type FamilyReligion = "islam" | "kristen" | "none";

// EPIC-023 Group F fix round (MEDIUM 9) — `religion` is nullable at the API
// now: `null` means "the family has never chosen" (an honest state,
// distinct from all three real choices), not a loading placeholder.
export type FamilyReligionDto = {
  religion: FamilyReligion | null;
};

type FamilyGroupMine = { id: string; myRole: string };

export function useFamilyReligion() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  const queryClient = useQueryClient();

  // Not yet in lib/query-keys.ts (protected) — inline, mirroring
  // use-gold-price.ts's own inline key.
  const religionQueryKey = ["family-groups", familyGroupId, "religion"];

  const { data, isLoading, isError } = useQuery<FamilyReligionDto>({
    queryKey: religionQueryKey,
    queryFn: () =>
      apiFetch<FamilyReligionDto>(`/family-groups/${familyGroupId}/religion`, {
        token,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
    staleTime: 60_000,
  });

  // Shares its cache entry with AkunPage's/useGoldPrice's own
  // `/family-groups/mine` query (same key factory), so owner-status is
  // resolved without an extra network round trip.
  const { data: familyGroups } = useQuery<FamilyGroupMine[]>({
    queryKey: [...queryKeys.familyGroups.mine(), token],
    queryFn: () =>
      apiFetch<FamilyGroupMine[]>("/family-groups/mine", { token }),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const isOwner =
    familyGroups?.find((g) => g.id === familyGroupId)?.myRole === "owner";

  const { mutate: updateReligion, isPending: isUpdating } = useMutation({
    mutationFn: (religion: FamilyReligion) =>
      apiFetch<FamilyReligionDto>(`/family-groups/${familyGroupId}/religion`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ religion }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(religionQueryKey, updated);
    },
  });

  return {
    // EPIC-023 Group F fix round (HIGH 4 / MEDIUM 9) — no fallback to a
    // real religion here. `undefined` (still loading) and `null` (fetched,
    // family has never chosen) both resolve to `null` — callers MUST check
    // `isLoading`/`isError` themselves before treating `null` as "family
    // chose none": collapsing a permanent fetch failure into any real
    // religion previously showed the wrong calculator indefinitely with no
    // signal (see DonationPage).
    religion: data?.religion ?? null,
    isOwner: Boolean(isOwner),
    isLoading,
    isError,
    updateReligion,
    isUpdating,
  };
}
