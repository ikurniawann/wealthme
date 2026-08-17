"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useMyRole } from "@/hooks/use-my-role";
import { isRowScopedRole, isRouteAllowedForRole } from "@/lib/nav";

/**
 * Keeps a row-scoped member (`dependant` = "Anak", `operational` = "Staff")
 * out of the (app) routes their own API grants deny, and lands them on
 * `/akses-saya` instead.
 *
 * Hiding those entries from the sidebar (see `isNavItemVisibleForRole`) is
 * not sufficient on its own: `/beranda` is still the post-login landing
 * route for every role, and a bookmark or a typed URL reaches any page
 * directly. What the user then sees is worse than a refusal — the dashboard
 * calls `/dashboard/summary`, `assertHouseholdWideReadAllowed` answers 403,
 * and the page degrades to a screen of "Rp 0" tiles, which reads as "this
 * family has no money" rather than "you do not have access to this". Same
 * for /ringkasan and /laporan.
 *
 * This is UX, not enforcement: the API is the real boundary and already
 * refuses these roles regardless of what the client renders.
 */
export function RowScopedRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { myRole, isLoading } = useMyRole();

  const blocked =
    !isLoading &&
    isRowScopedRole(myRole) &&
    !isRouteAllowedForRole(pathname, myRole);

  useEffect(() => {
    if (blocked) router.replace("/akses-saya");
  }, [blocked, router]);

  // Withhold the page while redirecting so the denied surface never paints
  // a frame of fabricated zeroes — mirrors ForcePasswordChangeGuard, which
  // gates rendering rather than only navigation for the same reason.
  if (blocked) return null;
  return <>{children}</>;
}
