"use client";

import { authClient } from "./auth-client";

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

  const session: CompatSession | null = data
    ? {
        accessToken: data.session.token,
        familyGroupId:
          (data.session as { familyGroupId?: string | null }).familyGroupId ??
          null,
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
