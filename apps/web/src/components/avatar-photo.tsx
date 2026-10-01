"use client";

import type { ReactNode } from "react";

import { useAvatarSrc } from "@/hooks/use-my-avatar";

/**
 * Content for an existing avatar circle: the user's photo when one is set
 * and loaded, otherwise `fallback` (initials). The photo fills and is
 * clipped by the parent's own size and border-radius.
 */
export function AvatarPhoto({
  url,
  fallback,
}: {
  url: string | null | undefined;
  fallback: ReactNode;
}) {
  // No URL → no session/query hooks at all (keeps initials-only callers,
  // and their tests, free of the auth client).
  if (!url) return <>{fallback}</>;
  return <LoadedPhoto url={url} fallback={fallback} />;
}

function LoadedPhoto({ url, fallback }: { url: string; fallback: ReactNode }) {
  const src = useAvatarSrc(url);
  if (!src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob:/remote src, not optimisable
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        borderRadius: "inherit",
        display: "block",
      }}
    />
  );
}
