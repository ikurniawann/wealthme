import { AppShell } from "@/components/shell/app-shell";
import { ForcePasswordChangeGuard } from "@/components/auth/force-password-change-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ForcePasswordChangeGuard>
      <AppShell>{children}</AppShell>
    </ForcePasswordChangeGuard>
  );
}
