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

export type FamilyReligionDto = {
  religion: FamilyReligion;
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
    // "islam" is the server-side default for every pre-existing family
    // (see the FamilyGroup.religion migration comment) — this local
    // fallback only covers the brief window before the query resolves.
    religion: data?.religion ?? "islam",
    isOwner: Boolean(isOwner),
    isLoading,
    isError,
    updateReligion,
    isUpdating,
  };
}
