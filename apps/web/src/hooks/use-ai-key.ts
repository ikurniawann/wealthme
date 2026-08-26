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
  /** The family's chosen model, null when they are on the default. */
  model?: string | null;
  /** What runs when nothing is chosen, so the UI never implies "no model". */
  defaultModel?: string | null;
};

/** One entry of the provider's own catalogue — see provider-models.util.ts.
 *  Fetched with the family's key rather than hardcoded, because a baked-in
 *  list is wrong the moment a model ships or is retired. */
export type ProviderModel = {
  id: string;
  label: string;
  isDefault: boolean;
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
      // A new key means a different catalogue — and the server clears the
      // model choice, because a model id belongs to one provider. Keeping the
      // old list cached would offer models this key cannot use.
      void queryClient.invalidateQueries({
        queryKey: [...aiKeyQueryKey, "models"],
      });
    },
  });

  /**
   * The catalogue is fetched ON DEMAND, not with the status.
   *
   * It costs a round trip to the provider on the family's key, so it is not
   * worth paying on every page load that merely wants to know whether a key
   * exists. `enabled` is passed by the caller when the picker is actually
   * shown.
   */
  const modelsQuery = useQuery<ProviderModel[]>({
    queryKey: [...aiKeyQueryKey, "models"],
    queryFn: () =>
      apiFetch<ProviderModel[]>(
        `/family-groups/${familyGroupId}/ai-key/models`,
        { token },
      ),
    enabled:
      Boolean(familyGroupId) && Boolean(token) && Boolean(data?.configured),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { mutate: setModel, isPending: isSettingModel } = useMutation({
    mutationFn: (model: string | null) =>
      apiFetch<AiKeyStatusDto>(`/family-groups/${familyGroupId}/ai-key/model`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ model }),
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
        model: null,
        defaultModel: null,
      } satisfies AiKeyStatusDto);
      queryClient.removeQueries({ queryKey: [...aiKeyQueryKey, "models"] });
    },
  });

  return {
    configured: data?.configured ?? false,
    provider: data?.provider ?? null,
    keyHint: data?.keyHint ?? null,
    // EPIC-027 B1 — receipt scanning needs a vision-capable provider, which
    // is a strictly narrower condition than `configured`.
    scanAvailable: data?.scanAvailable ?? false,
    model: data?.model ?? null,
    defaultModel: data?.defaultModel ?? null,
    models: modelsQuery.data ?? [],
    isLoadingModels: modelsQuery.isLoading,
    // Surfaced so the UI can say the list could not be loaded rather than
    // rendering an empty select that reads as "no models exist".
    modelsError: modelsQuery.isError,
    setModel,
    isSettingModel,
    canManage,
    isLoading,
    isError,
    setKey,
    isSettingKey,
    deleteKey,
    isDeletingKey,
  };
}
