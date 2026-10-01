"use client";

// Profile picture plumbing (PUT/DELETE /users/me/avatar, GET
// /users/:id/avatar). Stored avatars are served by an authenticated API
// stream — an <img src> cannot carry the bearer token — so API-relative
// URLs are fetched with it and rendered from a blob: URL.

import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/lib/auth-compat";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type MeAvatarResponse = {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
};

/** GET /auth/me — same query key as AkunPage, so the cache is shared. */
export function useMe() {
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  return useQuery<MeAvatarResponse>({
    queryKey: [...queryKeys.auth.me(), token],
    queryFn: () => apiFetch<MeAvatarResponse>("/auth/me", { token }),
    enabled: !!token,
  });
}

/** Renderable src for an avatar URL from the API, or null. */
export function useAvatarSrc(url: string | null | undefined): string | null {
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const isApiPath = !!url && url.startsWith("/");
  const { data: blob } = useQuery<Blob>({
    queryKey: ["avatar", url, token],
    queryFn: async () => {
      const res = await fetch(`${API_URL}${url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Avatar HTTP ${res.status}`);
      return res.blob();
    },
    enabled: isApiPath && !!token,
    staleTime: Infinity,
    retry: false,
  });
  const objectUrl = useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob],
  );
  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );
  if (!url) return null;
  if (!isApiPath) return url.startsWith("https://") ? url : null;
  return objectUrl;
}

export function useAvatarMutations() {
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });

  const upload = useMutation<{ avatarUrl: string | null }, ApiError, File>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/users/me/avatar`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw {
          status: res.status,
          message: body.message ?? (res.statusText || `HTTP ${res.status}`),
        } satisfies ApiError;
      }
      return (await res.json()) as { avatarUrl: string | null };
    },
    onSuccess: refresh,
  });

  const remove = useMutation<void, ApiError, void>({
    mutationFn: () =>
      apiFetch<void>("/users/me/avatar", { method: "DELETE", token }),
    onSuccess: refresh,
  });

  return { upload, remove };
}
