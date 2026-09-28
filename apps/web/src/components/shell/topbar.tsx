"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, LogOut, Plus, Search } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery } from "@tanstack/react-query";
import { canRecordTransaction, isPageTitleId } from "@/lib/nav";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import type { I18nDictionary } from "@/i18n/types";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useAppBack } from "@/hooks/use-app-back";
import { NavSheet } from "./nav-sheet";
import { ThemePicker } from "./theme-picker";
import { ThemeToggle } from "./theme-toggle";
import { useShell } from "./shell-context";

function usePageTitle(t: I18nDictionary): string {
  const pathname = usePathname();
  const seg = pathname.split("/")[1] || "beranda";
  return isPageTitleId(seg) ? t.shell.pageTitles[seg] : "WealthMe";
}

/**
 * EPIC-026 shell migration — the prototype's single `.topbar`, which serves
 * every breakpoint: `design-system.css` reveals `.topbar__menu-btn` and
 * shrinks `.topbar__search` to an icon below 768px. This replaces the app's
 * previous split desktop-Topbar / mobile-MobileHeader pair; every control from
 * both is present here.
 */
export function Topbar() {
  const { access } = useMyAccess();
  const { t } = useLocale();
  const title = usePageTitle(t);
  const pathname = usePathname();
  const { setSearchOpen, setTxnOpen } = useShell();
  const { logout } = useAuth();
  const router = useRouter();
  const { goBack } = useAppBack();
  const showBackButton = pathname !== "/beranda";
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
    <header className="topbar">
      <NavSheet />
      {showBackButton && (
        <button
          type="button"
          onClick={goBack}
          aria-label={t.shell.back}
          title={t.shell.back}
          className="btn btn--ghost btn--icon btn--sm"
        >
          <ArrowLeft className="size-[17px]" aria-hidden="true" />
        </button>
      )}
      <div className="topbar__title">{title}</div>
      <div className="topbar__spacer" />
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label={t.shell.search}
        className="topbar__search"
      >
        <Search className="size-[15px] shrink-0" aria-hidden="true" />
        <span>{t.shell.searchPlaceholder}</span>
        <span className="kbd">⌘K</span>
      </button>
      {canRecordTransaction(access) && (
        <button
          type="button"
          onClick={() => setTxnOpen(true)}
          className="btn btn--primary btn--sm topbar__txn"
          aria-label={t.shell.addTransaction}
        >
          <Plus className="size-[15px] shrink-0" aria-hidden="true" />
          <span>{t.shell.addTransaction}</span>
        </button>
      )}
      <LocaleSwitcher />
      <ThemeToggle />
      <Link
        href="/notifikasi"
        aria-label={t.shell.notifications}
        className="btn btn--ghost btn--icon btn--sm relative"
      >
        <Bell className="size-[17px]" aria-hidden="true" />
        {hasUnread && (
          <span className="absolute top-1 right-1 size-[7px] rounded-full border-2 border-card bg-destructive" />
        )}
      </Link>
      <ThemePicker />
      <button
        type="button"
        onClick={handleLogout}
        aria-label={t.shell.logout}
        className="btn btn--ghost btn--icon btn--sm"
      >
        <LogOut className="size-[17px]" aria-hidden="true" />
      </button>
    </header>
  );
}
