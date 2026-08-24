"use client";

// EPIC-023 G3 (D16) — bring-your-own AI provider key. The API never returns
// the raw/encrypted key (see ai-key.service.ts) — only a configured/not
// indicator, the provider, and a masked hint. Managing the key (set/delete)
// is owner/spouse-level (casl-ability.factory.ts); every other role can
// only read the status, which is exactly what `useAiKeyStatus` below
// exposes to the /ai chat page to decide whether to show the chat surface
// or a disabled-with-instructions panel.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/auth-compat";

export type AiProvider = "claude" | "openai" | "gemini";

export type AiKeyStatusDto = {
  configured: boolean;
  provider: AiProvider | null;
  keyHint: string | null;
  // EPIC-027 B5/B1 (D11) — "a key is configured AND its provider has a
  // vision adapter". Receipt OCR runs on this same family key, so the scan
  // control is gated on this rather than on `configured` alone (a provider
  // without a vision adapter would fail at the API with
  // OCR_NOT_CONFIGURED). Optional here so an older API response, which
  // predates the field, degrades to "scan unavailable" instead of `undefined`
  // being read as truthy.
  scanAvailable?: boolean;
};

type FamilyGroupMine = { id: string; myRole: string };

export function useAiKeyStatus() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  const queryClient = useQueryClient();

  // Not yet in lib/query-keys.ts (protected) — inline, mirroring
  // use-gold-price.ts's fx-rates key pattern.
  const aiKeyQueryKey = ["family-groups", familyGroupId, "ai-key"];

  const { data, isLoading, isError } = useQuery<AiKeyStatusDto>({
    queryKey: aiKeyQueryKey,
    queryFn: () =>
      apiFetch<AiKeyStatusDto>(`/family-groups/${familyGroupId}/ai-key`, {
        token,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
    staleTime: 60_000,
  });

  // Shares its cache entry with useGoldPrice/AkunPage's own
  // `/family-groups/mine` query (same key factory).
  const { data: familyGroups } = useQuery<FamilyGroupMine[]>({
    queryKey: [...queryKeys.familyGroups.mine(), token],
    queryFn: () =>
      apiFetch<FamilyGroupMine[]>("/family-groups/mine", { token }),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const myRole = familyGroups?.find((g) => g.id === familyGroupId)?.myRole;
  const canManage = myRole === "owner" || myRole === "spouse";

  const { mutate: setKey, isPending: isSettingKey } = useMutation({
    mutationFn: (input: { provider: AiProvider; apiKey: string }) =>
      apiFetch<AiKeyStatusDto>(`/family-groups/${familyGroupId}/ai-key`, {
        method: "PUT",
        token,
        body: JSON.stringify(input),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(aiKeyQueryKey, updated);
    },
  });

  const { mutate: deleteKey, isPending: isDeletingKey } = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/family-groups/${familyGroupId}/ai-key`, {
        method: "DELETE",
        token,
      }),
    onSuccess: () => {
      queryClient.setQueryData(aiKeyQueryKey, {
        configured: false,
        provider: null,
        keyHint: null,
        scanAvailable: false,
      } satisfies AiKeyStatusDto);
    },
  });

  return {
    configured: data?.configured ?? false,
    provider: data?.provider ?? null,
    keyHint: data?.keyHint ?? null,
    // EPIC-027 B1 — receipt scanning needs a vision-capable provider, which
    // is a strictly narrower condition than `configured`.
    scanAvailable: data?.scanAvailable ?? false,
    canManage,
    isLoading,
    isError,
    setKey,
    isSettingKey,
    deleteKey,
    isDeletingKey,
  };
}
