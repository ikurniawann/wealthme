"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  Search,
  ShieldCheck,
  Target,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocale } from "@/hooks/use-locale";
import { useShell } from "./shell-context";

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
  ShieldCheck,
  Bot,
  Calculator,
  User,
  Bell,
};

export function SearchDialog() {
  const { searchOpen, setSearchOpen } = useShell();
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLocale();
  const [query, setQuery] = useState("");

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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  const go = (href: string) => {
    setSearchOpen(false);
    router.push(href);
  };

  const trimmedQuery = query.trim();
  const meetsMinLength = trimmedQuery.length >= 2;
  const apiResults = searchData?.results ?? [];
  const showApi = meetsMinLength && apiResults.length > 0;
  // Only declare "no results" once the debounce has settled on the current
  // query — avoids a flash of the empty state mid-keystroke.
  const showNoResults =
    meetsMinLength && debouncedQuery === trimmedQuery && !showApi;
  const showHint = !meetsMinLength;

  return (
    <Dialog open={searchOpen} onOpenChange={handleOpenChange}>
      {/* EPIC-022 Group G (G1) — `overflow-y-auto`, not `overflow-hidden`:
          this dialog now inherits DialogContent's `max-h-[85dvh]` default
          uncontested (no max-h override here), so a hard `overflow-hidden`
          would silently clip content past that cap with no scroll escape —
          tailwind-merge's `overflow` group lets this class fully replace the
          base `overflow-y-auto`. The inner result list already self-limits
          at `max-h-[60vh]` below, so in practice this outer scroll rarely
          engages; it exists as a safety net if the header row or result
          list ever grows (long query text wraps, a future extra row) past
          the 85dvh cap on a short viewport. `overflow-y-auto` still clips
          children to the `rounded-xl` corners exactly like `overflow-hidden`
          did — it only adds the scroll affordance when actually needed. */}
      <DialogContent
        showCloseButton={false}
        className="top-[12%] max-w-[520px] translate-y-0 gap-0 overflow-y-auto p-0 sm:max-w-[520px]"
      >
        <DialogTitle className="sr-only">
          {t.shell.searchDialog.dialogTitle}
        </DialogTitle>
        <div className="flex items-center gap-2.5 border-b px-4 py-3.5">
          <Search className="size-[15px] text-muted-foreground" />
          <input
            autoFocus
            aria-label={t.shell.searchDialog.ariaLabel}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.shell.searchDialog.placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {/* Same dynamic-viewport reasoning as the DialogContent override
            above — `dvh` so this inner cap tracks the visible viewport on a
            real mobile browser, not the full layout viewport. */}
        <div className="max-h-[60dvh] overflow-y-auto py-2">
          {showApi && (
            <>
              <div className="px-[18px] pt-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-muted-foreground">
                {t.shell.searchDialog.financialResultsHeader}
              </div>
              {apiResults.map((d) => {
                const Icon = ICONS[d.icon] ?? Home;
                return (
                  <button
                    key={d.id}
                    onClick={() => go(d.href)}
                    className="flex w-full items-center gap-3 px-[18px] py-2.5 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Icon className="size-[15px] text-muted-foreground" />
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold">
                        {d.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {d.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </>
          )}
          {showHint && (
            <div className="px-7 py-7 text-center text-[13px] text-muted-foreground">
              {t.shell.searchDialog.typeToSearchHint}
            </div>
          )}
          {showNoResults && (
            <div className="px-7 py-7 text-center text-[13px] text-muted-foreground">
              {t.shell.searchDialog.noResultsFor} &ldquo;
              <strong>{query}</strong>&rdquo;
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
