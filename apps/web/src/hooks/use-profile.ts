"use client";

// Shared react-query hook for GET /auth/profile — the full profile detail
// (name/email plus the extra fields GET /auth/me omits, including the
// EPIC-016 Task B2 `currency` preference). Mirrors the inline query already
// used by AkunPage/ProfilBody so the cache is shared (same query key).

import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";

export type ProfileDetail = {
  id: string;
  email: string;
  name: string;
  avatarInitials?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  jobTitle?: string | null;
  monthlyIncome?: string | null;
  // Absent for users created before the EPIC-016 Task B2 migration; callers
  // must fall back to "IDR" (the server also defaults new rows to "IDR").
  currency?: string;
};

export function useProfile() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  // lib/query-keys.ts is a protected foundation file — inline key here,
  // matching AkunPage's own inline ["auth", "profile", token] key exactly so
  // both share the same cache entry.
  return useQuery<ProfileDetail>({
    queryKey: ["auth", "profile", token],
    queryFn: () => apiFetch<ProfileDetail>("/auth/profile", { token }),
    enabled: !!token,
  });
}
