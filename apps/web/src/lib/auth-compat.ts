"use client";

import { useQuery } from "@tanstack/react-query";
import { authClient } from "./auth-client";
import { apiFetch } from "./api-client";
import { queryKeys } from "./query-keys";

export type CompatSession = {
  accessToken: string;
  familyGroupId: string | null;
  userId: string;
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
};

export function useSession() {
  const { data, isPending } = authClient.useSession();

  const token = data?.session.token;
  const stampedFamilyGroupId =
    (data?.session as { familyGroupId?: string | null } | undefined)
      ?.familyGroupId ?? null;

  // The session's familyGroupId is stamped once, at session-creation time, by
  // a better-auth hook that looks up the user's Member row. On a brand-new
  // signup that lookup can race the transaction that creates the Member row,
  // permanently baking in `null` for the life of that session (it's never
  // recomputed). Live-resolve from /auth/me — the backend's TenantGuard
  // already does its own per-request Member lookup and never trusts this
  // field, so this fallback only needs to fix the frontend's stale copy.
  const { data: me } = useQuery({
    queryKey: [...queryKeys.auth.me(), token],
    queryFn: () =>
      apiFetch<{ familyGroupId: string | null }>("/auth/me", { token }),
    enabled: !stampedFamilyGroupId && !!token,
    staleTime: 60_000,
  });

  const session: CompatSession | null = data
    ? {
        accessToken: data.session.token,
        familyGroupId: stampedFamilyGroupId ?? me?.familyGroupId ?? null,
        userId: data.user.id,
        user: {
          name: data.user.name,
          email: data.user.email,
          image: data.user.image,
        },
      }
    : null;

  return {
    data: session,
    status: (isPending
      ? "loading"
      : data
        ? "authenticated"
        : "unauthenticated") as "loading" | "authenticated" | "unauthenticated",
  };
}

export async function signOut(options?: { callbackUrl?: string }) {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        if (options?.callbackUrl && typeof window !== "undefined") {
          window.location.href = options.callbackUrl;
        }
      },
    },
  });
}
