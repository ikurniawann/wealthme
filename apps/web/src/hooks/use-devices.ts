"use client";

// EPIC-023 D2 (US-FAM-13, D7) — device-bound PIN unlock, react-query wiring
// for the AUTHENTICATED device endpoints (register/list/setPin/revoke). The
// unauthenticated unlock flow does NOT go through here — see
// `components/auth/device-unlock-pad.tsx`, which calls the Next.js
// `/api/device-unlock` route handler instead (it needs to set an httpOnly
// cookie server-side, which no client-side fetch can do).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";

export type DeviceRow = {
  id: string;
  label: string | null;
  hasPinSet: boolean;
  createdAt: string;
  lastUsedAt: string;
};

// lib/query-keys.ts is a protected foundation file — inline keys here,
// matching the existing KeamananBody sessions query's own convention.
function devicesQueryKey(token: string | undefined) {
  return ["auth", "devices", token] as const;
}

export function useDevices() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  return useQuery<DeviceRow[]>({
    queryKey: devicesQueryKey(token),
    queryFn: () => apiFetch<DeviceRow[]>("/auth/devices", { token }),
    enabled: !!token,
  });
}

export function useRegisterDevice() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (label?: string) =>
      apiFetch<{ deviceId: string; deviceSecret: string }>("/auth/devices", {
        method: "POST",
        token,
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: devicesQueryKey(token) });
    },
  });
}

export function useSetDevicePin() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, pin }: { deviceId: string; pin: string }) =>
      apiFetch<void>(`/auth/devices/${deviceId}/pin`, {
        method: "POST",
        token,
        body: JSON.stringify({ pin }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: devicesQueryKey(token) });
    },
  });
}

export function useRevokeDevice() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch<void>(`/auth/devices/${deviceId}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: devicesQueryKey(token) });
    },
  });
}
