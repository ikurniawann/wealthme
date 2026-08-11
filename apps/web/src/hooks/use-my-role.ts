"use client";

// EPIC-024 A5 (D6, US-FAM-19) — small shared hook so "owner/co-master only"
// gating (the /persetujuan nav item + page itself) doesn't hand-roll its
// own `/family-groups/mine` query. Mirrors the `isOwner` pattern already
// proven in `use-gold-price.ts` — same query key, so this shares its cache
// entry with any other consumer on the same page instead of firing an
// extra network round trip. A co-master (istri, role `owner` per A1) is
// indistinguishable from the original master here: CASL already treats
// them identically, and "owner/co-master only" per D6 is exactly
// `myRole === "owner"`, no separate check needed.

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/auth-compat";

type FamilyGroupMine = { id: string; myRole: string };

export function useMyRole() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;

  const { data: familyGroups, isLoading } = useQuery<FamilyGroupMine[]>({
    queryKey: [...queryKeys.familyGroups.mine(), token],
    queryFn: () =>
      apiFetch<FamilyGroupMine[]>("/family-groups/mine", { token }),
    enabled: Boolean(token),
    staleTime: 60_000,
  });

  const myRole =
    familyGroups?.find((g) => g.id === familyGroupId)?.myRole ?? null;

  return {
    myRole,
    isOwner: myRole === "owner",
    isLoading,
  };
}
