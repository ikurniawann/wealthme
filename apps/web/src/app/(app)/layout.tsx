import { AppShell } from "@/components/shell/app-shell";
import { ForcePasswordChangeGuard } from "@/components/auth/force-password-change-guard";
import { RowScopedRouteGuard } from "@/components/auth/row-scoped-route-guard";
import { DisplayCurrencyProvider } from "@/hooks/use-money";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ForcePasswordChangeGuard>
      {/* Inside AppShell, not around it: a redirected dependant/operational
          still gets the shell (their own reduced sidebar), only the denied
          page body is withheld. */}
      <AppShell>
        {/* Batch C — one display-currency resolution for the whole app
            shell; pages read it via useMoney() instead of each calling
            useCurrencyPreference() directly. */}
        <DisplayCurrencyProvider>
          <RowScopedRouteGuard>{children}</RowScopedRouteGuard>
        </DisplayCurrencyProvider>
      </AppShell>
    </ForcePasswordChangeGuard>
  );
}
