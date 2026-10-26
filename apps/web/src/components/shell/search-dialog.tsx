"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ArrowUpDown,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Calculator,
  ClipboardList,
  Home,
  Landmark,
  LineChart,
  ReceiptText,
  Plus,
  Languages,
  Sun,
  UserCheck,
  Search,
  ShieldCheck,
  Target,
  User,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { isEditableTarget, useShortcutHint } from "@/hooks/use-shortcut-hint";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocale } from "@/hooks/use-locale";
import {
  NAV_SECTIONS,
  canRecordTransaction,
  isNavItemVisibleForAccess,
} from "@/lib/nav";
import { useMyAccess } from "@/hooks/use-my-access";
import { useShell } from "./shell-context";
import { hubLabel, useHubs } from "./sidebar-sections";

import type { SearchResponseDto } from "@wealthme/contracts";

const ICONS: Record<string, LucideIcon> = {
  Home,
  ArrowUpDown,
  BarChart3,
  LineChart,
  Target,
  ClipboardList,
  Wallet,
  Landmark,
  Briefcase,
  ReceiptText,
  Plus,
  Languages,
  Sun,
  UserCheck,
  ShieldCheck,
  Bot,
  Calculator,
  User,
  Bell,
};

// Batch 4 (Arc UI migration, 2026-10-06) — a visual-only clear-button pass
// over the query input, matching Arc's search-field reference. Debounce,
// the auth-filtered API query, and the keyboard/roving-index semantics
// below are unchanged; `uiarc.dev/components/search-field` has no debounce
// or async-results handling of its own, so only its clear-button affordance
// was worth borrowing.
export function SearchDialog() {
  const { searchOpen, setSearchOpen, setTxnOpen } = useShell();
  const { access } = useMyAccess();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const shortcut = useShortcutHint();
  const canAddTransaction = canRecordTransaction(access);
  const { data: session } = useSession();
  const { t, locale, toggle } = useLocale();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Trim before debouncing so the fetch gate and the render gates below
  // agree on what counts as a >=2-char query (" a" must not fetch).
  const debouncedQuery = useDebounce(query.trim(), 300);

  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;

  const { data: searchData } = useQuery<SearchResponseDto>({
    queryKey: queryKeys.search.results(familyGroupId ?? "", debouncedQuery),
    queryFn: ({ signal }) => {
      if (!familyGroupId || debouncedQuery.length < 2) throw new Error("skip");
      return apiFetch<SearchResponseDto>(
        `/family-groups/${familyGroupId}/search?q=${encodeURIComponent(debouncedQuery)}`,
        { token, signal },
      );
    },
    enabled:
      Boolean(familyGroupId) && Boolean(token) && debouncedQuery.length >= 2,
  });

  const handleOpenChange = (open: boolean) => {
    setSearchOpen(open);
    if (!open) setQuery("");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        e.repeat ||
        isEditableTarget(e.target) ||
        e.altKey
      )
        return;
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key === "Enter" &&
        canAddTransaction
      ) {
        e.preventDefault();
        setTxnOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setSearchOpen, setTxnOpen, canAddTransaction]);

  const { primary, secondary } = useHubs();
  const allPages = [...primary, ...secondary].flatMap((hub) => {
    const group = hubLabel(hub, t);
    const self = { href: hub.href, label: group, icon: hub.icon, group: "" };
    const subs = hub.children
      .filter((child) => child.href !== hub.href)
      .map((child) => ({
        href: child.href,
        label: t.shell.navSections[child.id],
        icon: child.icon,
        group,
      }));
    return [self, ...subs];
  });
  // Include routes outside the hub sidebar, using the same access rules.
  for (const item of NAV_SECTIONS.flatMap((section) => section.items)) {
    if (
      isNavItemVisibleForAccess(item, access) &&
      !allPages.some((page) => page.href === item.href)
    ) {
      allPages.push({
        href: item.href,
        label: t.shell.navSections[item.id],
        icon: item.icon,
        group: "",
      });
    }
  }
  allPages.push(
    { href: "/akun", label: t.shell.v2.account, icon: User, group: "" },
    {
      href: "/akses-saya",
      label: t.shell.pageTitles["akses-saya"],
      icon: UserCheck,
      group: "",
    },
  );

  const go = (href: string) => {
    handleOpenChange(false);
    router.push(href);
  };
  const actions = [
    ...(canAddTransaction
      ? [
          {
            shortcut: shortcut.transaction,
            id: "transaction",
            label: t.shell.addTransaction,
            icon: Plus,
            run: () => setTxnOpen(true),
          },
        ]
      : []),
    {
      id: "theme",
      label: t.shell.v2.toggleTheme,
      icon: Sun,
      run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
    {
      id: "language",
      label: t.shell.localeSwitcher.ariaLabel.replace(
        "%s",
        locale.toUpperCase(),
      ),
      icon: Languages,
      run: toggle,
    },
  ];

  const trimmedQuery = query.trim();
  const meetsMinLength = trimmedQuery.length >= 2;
  const apiResults = searchData?.results ?? [];
  const showApi = meetsMinLength && apiResults.length > 0;
  // Pages match instantly on any query (no debounce, no API): the hub model is
  // already access-filtered, so a member only ever finds pages they may open.
  const needle = trimmedQuery.toLowerCase();
  const pages = allPages.filter(
    (page) => !needle || page.label.toLowerCase().includes(needle),
  );
  const matchingActions = actions.filter(
    (action) => !needle || action.label.toLowerCase().includes(needle),
  );
  // Only declare "no results" once the debounce has settled on the current
  // query — avoids a flash of the empty state mid-keystroke.
  const showNoResults =
    meetsMinLength &&
    debouncedQuery === trimmedQuery &&
    !showApi &&
    pages.length === 0 &&
    matchingActions.length === 0;

  // uiarc.dev reference — a command palette's results should be fully
  // keyboard-navigable (Arrow Up/Down + Enter), not mouse-only. `.wm-pal-item`
  // already had `aria-selected="true"` styling in bento.css with nothing
  // ever setting it; this wires up the roving index that was missing.
  const flatItems = [
    ...pages.map((p) => ({ run: () => go(p.href) })),
    ...(showApi ? apiResults.map((r) => ({ run: () => go(r.href) })) : []),
    ...matchingActions.map((action) => ({
      run: () => {
        handleOpenChange(false);
        action.run();
      },
    })),
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  // Reset the active index whenever the result set itself changes — derived
  // during render (no effect), same "adjusting state when a prop changes"
  // pattern as family-handle-card.tsx's draft reset.
  const resultsKey = `${query}:${showApi}:${flatItems.length}`;
  const [prevResultsKey, setPrevResultsKey] = useState(resultsKey);
  if (resultsKey !== prevResultsKey) {
    setPrevResultsKey(resultsKey);
    setActiveIndex(0);
  }
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleQueryKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (flatItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Enter") {
      const target = flatItems[activeIndex];
      if (target) {
        e.preventDefault();
        target.run();
      }
    }
  };

  return (
    <Dialog open={searchOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] bottom-auto translate-y-0 w-[min(620px,calc(100%-24px))] max-h-[72dvh] overflow-hidden rounded-[22px] p-0 min-[769px]:top-[12vh] min-[769px]:translate-y-0 min-[769px]:w-[min(620px,calc(100%-24px))]"
      >
        <DialogTitle className="sr-only">
          {t.shell.searchDialog.dialogTitle}
        </DialogTitle>
        <div className="wm-pal-in">
          <Search className="size-[18px] shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            aria-label={t.shell.searchDialog.ariaLabel}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleQueryKeyDown}
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-controls="search-dialog-listbox"
            aria-activedescendant={
              flatItems.length > 0
                ? `search-dialog-item-${activeIndex}`
                : undefined
            }
            placeholder={t.shell.v2.searchShort}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="wm-pal-clear"
              aria-label={t.shell.searchDialog.clearAriaLabel}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
          <kbd className="wm-kbd" title={t.shell.search}>
            {shortcut.search}
          </kbd>
          <kbd className="wm-kbd">Esc</kbd>
        </div>
        <div
          id="search-dialog-listbox"
          role="listbox"
          className="wm-pal-list max-h-[60dvh]"
        >
          {pages.length > 0 && (
            <>
              <h4>{t.shell.v2.pagesGroup}</h4>
              {pages.map((page, i) => {
                const Icon = page.icon;
                return (
                  <button
                    key={page.href}
                    id={`search-dialog-item-${i}`}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    className="wm-pal-item"
                    onClick={() => go(page.href)}
                  >
                    <span className="wm-ic">
                      <Icon aria-hidden="true" />
                    </span>
                    {page.label}
                    {page.group && <small>{page.group}</small>}
                  </button>
                );
              })}
            </>
          )}
          {showApi && (
            <>
              <h4>{t.shell.searchDialog.financialResultsHeader}</h4>
              {apiResults.map((d, i) => {
                const Icon = ICONS[d.icon] ?? Home;
                const index = pages.length + i;
                return (
                  <button
                    key={d.id}
                    id={`search-dialog-item-${index}`}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className="wm-pal-item"
                    onClick={() => go(d.href)}
                  >
                    <span className="wm-ic">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{d.label}</span>
                      <span className="block truncate text-[12px] text-[var(--wm-muted)]">
                        {d.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </>
          )}
          {matchingActions.length > 0 && (
            <>
              <h4>{t.shell.searchDialog.actionsHeader}</h4>
              {matchingActions.map((action, i) => {
                const index =
                  pages.length + (showApi ? apiResults.length : 0) + i;
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    id={`search-dialog-item-${index}`}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className="wm-pal-item"
                    onClick={() => flatItems[index].run()}
                  >
                    <span className="wm-ic">
                      <Icon aria-hidden="true" />
                    </span>
                    {action.label}
                    {"shortcut" in action && (
                      <kbd className="wm-kbd ml-auto">{action.shortcut}</kbd>
                    )}
                  </button>
                );
              })}
            </>
          )}
          {showNoResults && (
            <p className="wm-pal-empty">
              {t.shell.v2.noResults}: &ldquo;<strong>{query}</strong>&rdquo;
            </p>
          )}
          {!meetsMinLength && pages.length === 0 && (
            <p className="wm-pal-empty">
              {t.shell.searchDialog.typeToSearchHint}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
