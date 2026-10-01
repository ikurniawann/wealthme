"use client";

import { useQuery } from "@tanstack/react-query";
import {
  resolveEffectiveAccess,
  type EffectiveAccess,
  type MemberRoleKey,
} from "@wealthme/contracts";

import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";
import { queryKeys } from "@/lib/query-keys";

import { useMyRole } from "./use-my-role";

/**
 * EPIC-030 — the signed-in member's effective IAM access (Master grants:
 * custom role + overrides), resolved by the API.
 *
 * `access`:
 *  - `undefined` while anything is still resolving (callers stay permissive
 *    so a Master's menu never flickers shut — the API enforces regardless);
 *  - `null` when the user has no active family (menu empty, routes send
 *    them to /akses-saya);
 *  - if the lookup itself fails, the built-in role's default access (a
 *    Master stays a Master — a backend hiccup must not lock out the one
 *    person who administers access; the API enforces the real grants);
 *  - otherwise the resolved map.
 */
export function useMyAccess(): {
  access: EffectiveAccess | null | undefined;
  isLoading: boolean;
} {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  const { myRole } = useMyRole();

  const { data, isError } = useQuery<EffectiveAccess>({
    queryKey: [...queryKeys.familyGroups.myAccess(familyGroupId ?? ""), token],
    queryFn: ({ signal }) =>
      apiFetch<EffectiveAccess>(`/family-groups/${familyGroupId}/access/me`, {
        token,
        signal,
      }),
    enabled: Boolean(token) && Boolean(familyGroupId),
    staleTime: 60_000,
  });

  if (status !== "authenticated" || !token) {
    return { access: undefined, isLoading: true };
  }
  if (!familyGroupId) {
    // The session's family may still be resolving; only a resolved "no
    // membership" (useMyRole → null) is a definite no.
    return myRole === null
      ? { access: null, isLoading: false }
      : { access: undefined, isLoading: true };
  }
  if (isError) {
    if (myRole === undefined) return { access: undefined, isLoading: true };
    if (myRole === null) return { access: null, isLoading: false };
    return {
      access: resolveEffectiveAccess({ role: myRole as MemberRoleKey }),
      isLoading: false,
    };
  }
  if (!data) return { access: undefined, isLoading: true };
  return { access: data, isLoading: false };
}

/**
 * "Lihat saldo" — true when the API withholds balance figures from the
 * signed-in member. Observes the `access/me` cache that `useMyAccess` (the
 * always-mounted sidebar) fills, without issuing a request of its own.
 */
export function useBalancesHidden(): boolean {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? "";
  const { data } = useQuery<EffectiveAccess>({
    queryKey: [...queryKeys.familyGroups.myAccess(familyGroupId), token],
    enabled: false,
  });
  return data?.balancesHidden === true;
}
