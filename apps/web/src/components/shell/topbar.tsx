"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Languages,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
  User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";
import { canRecordTransaction, isPageTitleId } from "@/lib/nav";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { useMyRole } from "@/hooks/use-my-role";
import { useAppBack } from "@/hooks/use-app-back";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AvatarPhoto } from "@/components/avatar-photo";
import { useMe } from "@/hooks/use-my-avatar";
import { useShell } from "./shell-context";
import { NotificationsPopover } from "./notifications-popover";
import { POP_CLASS, POP_ITEM_CLASS } from "./pop-classes";

/** Two-letter initials from a display name, matching the prototype avatar. */
export function initialsOf(name: string | undefined): string {
  if (!name) return "?";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  // Resolve the theme only after mount; the icon stays neutral during SSR.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      className="wm-icon-btn wm-theme"
      aria-label={t.shell.v2.toggleTheme}
      title={t.shell.v2.toggleTheme}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

/** Member button + menu. `placement="side"` is the sidebar-foot version (opens upward). */
export function MeMenu({ placement = "top" }: { placement?: "top" | "side" }) {
  const { data: session } = useSession();
  const { myRole } = useMyRole();
  const { locale, toggle, t } = useLocale();
  const { logout } = useAuth();
  const router = useRouter();
  const name = session?.user.name;
  const { data: me } = useMe();
  const roleLabel = myRole
    ? t.common.roleLabels[myRole as keyof typeof t.common.roleLabels]
    : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          placement === "side" ? "wm-me wm-me--side" : "wm-me wm-me--top"
        }
        aria-label={`${t.shell.v2.accountMenu}: ${name ?? ""}`}
      >
        <span className="wm-avatar" aria-hidden="true">
          <AvatarPhoto url={me?.avatarUrl} fallback={initialsOf(name)} />
        </span>
        <div>
          <b>{name ?? "WealthMe"}</b>
          {roleLabel && <small>{roleLabel}</small>}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={placement === "side" ? "top" : "bottom"}
        align={placement === "side" ? "start" : "end"}
        sideOffset={8}
        className={`${POP_CLASS} w-[min(260px,calc(100vw-24px))]`}
      >
        <DropdownMenuItem
          className={POP_ITEM_CLASS}
          onClick={() => router.push("/akun")}
        >
          <User aria-hidden="true" />
          {t.shell.v2.account}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={POP_ITEM_CLASS}
          closeOnClick={false}
          onClick={toggle}
        >
          <Languages aria-hidden="true" />
          {t.shell.v2.language}
          <span className="ml-auto text-[12px] font-semibold text-[var(--wm-muted)]">
            {locale.toUpperCase()}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="wm-pop-sep" />
        <DropdownMenuItem
          className={POP_ITEM_CLASS}
          onClick={() => {
            logout();
            router.push("/login");
          }}
        >
          <LogOut aria-hidden="true" />
          {t.shell.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Bento v2 topbar (`.wm-top`): search pill with Ctrl K, theme, notifications,
 * the member button (account, language, sign out) and the primary add button.
 * On phones it collapses to brand · bell · avatar (bento.css); a back button
 * appears only on nested routes such as `/aset/123`.
 */
export function Topbar() {
  const { access } = useMyAccess();
  const { t } = useLocale();
  const pathname = usePathname();
  const { setSearchOpen, setTxnOpen } = useShell();
  const { goBack } = useAppBack();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const nested = pathname.split("/").filter(Boolean).length > 1;
  // Desktop-only visible page title; the sr-only h1 (PageGreeting) stays the
  // one heading, so this copy is aria-hidden.
  const seg = pathname.split("/")[1] || "beranda";
  const pageTitle =
    seg === "beranda"
      ? t.shell.v2.homeTitle
      : isPageTitleId(seg)
        ? t.shell.pageTitles[seg]
        : null;

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

  // Phones (2026-10-20 refs): the brand row (brand · bell · avatar) heads
  // Beranda and Menu; other top-level pages lead with their own big title
  // (PageGreeting), so the row is hidden there; nested routes keep it for
  // the back button. Only read by the ≤720px rules in mobile-chrome.css.
  const phoneHead = nested
    ? "nested"
    : seg === "beranda"
      ? "home"
      : seg === "menu"
        ? "brand"
        : "page";

  return (
    <header className="wm-top" data-phone-head={phoneHead}>
      <Link href="/beranda" className="wm-mbrand">
        WealthMe
      </Link>
      {pageTitle && (
        <span className="wm-top-title" aria-hidden="true">
          {pageTitle}
        </span>
      )}
      {nested && (
        <button
          type="button"
          onClick={goBack}
          aria-label={t.common.back}
          title={t.common.back}
          className="wm-icon-btn"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="wm-search"
        onClick={() => setSearchOpen(true)}
        aria-label={t.shell.search}
      >
        <Search
          className="size-4 shrink-0"
          aria-hidden="true"
          strokeWidth={2}
        />
        <span>{t.shell.v2.searchShort}</span>
        <kbd className="wm-kbd">Ctrl K</kbd>
      </button>
      <span className="wm-spacer" />
      <ThemeButton />
      <NotificationsPopover unreadCount={unreadData?.count ?? 0} />
      <MeMenu />
      {canRecordTransaction(access) && (
        <button
          type="button"
          className="wm-add"
          onClick={() => setTxnOpen(true)}
        >
          <Plus aria-hidden="true" strokeWidth={2.4} />
          <span>{t.shell.addTransaction}</span>
        </button>
      )}
    </header>
  );
}
