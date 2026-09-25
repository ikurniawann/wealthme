"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReferenceItemDto, ReferenceItemGroup } from "@wealthme/contracts";

import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";

// Not in lib/query-keys.ts (protected); Master Data invalidates this same key so every form refreshes.
export const referenceItemsQueryKey = (familyGroupId: string) =>
  ["reference-items", familyGroupId] as const;

export function useReferenceItems(
  group?: ReferenceItemGroup,
  { enabled = true }: { enabled?: boolean } = {},
): { items: ReferenceItemDto[]; isLoading: boolean } {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? "";

  const { data, isLoading } = useQuery<ReferenceItemDto[]>({
    queryKey: referenceItemsQueryKey(familyGroupId),
    queryFn: ({ signal }) =>
      apiFetch<ReferenceItemDto[]>(
        `/family-groups/${familyGroupId}/reference-items`,
        { token, signal },
      ),
    enabled: enabled && Boolean(token) && Boolean(familyGroupId),
    staleTime: 60_000,
    // "+ Tambah ke Master Data" opens a new tab; refresh the list when the user comes back.
    refetchOnWindowFocus: "always",
  });

  const all = Array.isArray(data) ? data : [];
  return {
    items: group ? all.filter((i) => i.group === group) : all,
    isLoading,
  };
}
