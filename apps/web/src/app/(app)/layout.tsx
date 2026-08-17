import { AppShell } from "@/components/shell/app-shell";
import { ForcePasswordChangeGuard } from "@/components/auth/force-password-change-guard";
import { RowScopedRouteGuard } from "@/components/auth/row-scoped-route-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ForcePasswordChangeGuard>
      {/* Inside AppShell, not around it: a redirected dependant/operational
          still gets the shell (their own reduced sidebar), only the denied
          page body is withheld. */}
      <AppShell>
        <RowScopedRouteGuard>{children}</RowScopedRouteGuard>
      </AppShell>
    </ForcePasswordChangeGuard>
  );
}
