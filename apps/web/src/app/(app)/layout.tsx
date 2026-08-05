import { AppShell } from "@/components/shell/app-shell";
import { ForcePasswordChangeGuard } from "@/components/auth/force-password-change-guard";
import { QuickUnlockOffer } from "@/components/auth/quick-unlock-offer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ForcePasswordChangeGuard>
      <QuickUnlockOffer />
      <AppShell>{children}</AppShell>
    </ForcePasswordChangeGuard>
  );
}
