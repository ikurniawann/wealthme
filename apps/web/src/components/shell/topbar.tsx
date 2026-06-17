"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Eye, LogOut, Search } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery } from "@tanstack/react-query";
import { PAGE_TITLES } from "@/lib/nav";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ThemePicker } from "./theme-picker";
import { ThemeToggle } from "./theme-toggle";
import { useShell } from "./shell-context";

function usePageTitle() {
  const pathname = usePathname();
  const seg = pathname.split("/")[1] || "beranda";
  return PAGE_TITLES[seg] ?? "WealthMe";
}

export function Topbar() {
  const title = usePageTitle();
  const { setSearchOpen } = useShell();
  const { logout } = useAuth();
  const router = useRouter();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: queryKeys.notifications.unreadCount(familyGroupId ?? ""),
    queryFn: ({ signal }) =>
      apiFetch<{ count: number }>(
        `/family-groups/${familyGroupId}/notifications/unread-count`,
        { token, signal },
      ),
    enabled: Boolean(familyGroupId) && Boolean(token),
    refetchInterval: 30_000,
  });

  const hasUnread = (unreadData?.count ?? 0) > 0;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="sticky top-0 z-50 hidden h-16 items-center gap-3.5 border-b bg-card px-6 md:flex">
      <div className="text-lg font-extrabold">{title}</div>
      <div className="flex-1" />
      <button
        onClick={() => setSearchOpen(true)}
        className="flex max-w-[260px] flex-1 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-[7px] text-[12.5px] text-muted-foreground transition-colors hover:border-primary"
      >
        <Search className="size-[13px]" />
        <span className="flex-1 text-left">Cari transaksi, rekening...</span>
        <span className="mono rounded bg-border px-1.5 py-0.5 text-[10px]">
          ⌘K
        </span>
      </button>
      <div className="flex gap-1.5">
        <ThemePicker />
        <ThemeToggle />
        <Link
          href="/notifikasi"
          className="relative flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <Bell className="size-[15px]" />
          {hasUnread && (
            <span className="absolute right-1.5 top-1.5 size-[7px] rounded-full border-2 border-card bg-destructive" />
          )}
        </Link>
        <button className="flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-primary">
          <Eye className="size-[15px]" />
        </button>
        <button
          onClick={handleLogout}
          aria-label="Keluar"
          className="flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <LogOut className="size-[15px]" />
        </button>
      </div>
    </div>
  );
}
