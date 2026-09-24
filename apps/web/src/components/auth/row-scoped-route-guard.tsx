"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useMyAccess } from "@/hooks/use-my-access";
import { isRouteAllowedForAccess } from "@/lib/nav";

/**
 * EPIC-030 — sends a member away from any page the Master did not grant them
 * (custom role + overrides), to /akses-saya, which explains what they can
 * reach. UX only: the API refuses the same pages with 403
 * (PageAccessGuard). While access is resolving nothing is blocked, so a
 * Master never sees a flash-redirect.
 *
 * (Name kept from EPIC-026, when only dependant/operational were gated.)
 */
export function RowScopedRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { access } = useMyAccess();

  const blocked = !isRouteAllowedForAccess(pathname, access);

  useEffect(() => {
    if (blocked) router.replace("/akses-saya");
  }, [blocked, router]);

  if (blocked) return null;
  return <>{children}</>;
}
