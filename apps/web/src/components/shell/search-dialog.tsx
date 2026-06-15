"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { SEARCH_DATA } from "@/lib/data";
import { queryKeys } from "@/lib/query-keys";
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

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchDialog() {
  const { searchOpen, setSearchOpen } = useShell();
  const router = useRouter();
  const { data: session } = useSession();
  const [query, setQuery] = useState("");

  const debouncedQuery = useDebounce(query, 300);

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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return SEARCH_DATA.filter(
      (d) =>
        d.label.toLowerCase().includes(q) || d.sub.toLowerCase().includes(q),
    );
  }, [query]);

  const go = (href: string) => {
    setSearchOpen(false);
    router.push(href);
  };

  const apiResults = searchData?.results ?? [];
  const showApi = debouncedQuery.length >= 2 && apiResults.length > 0;
  const hasQuery = query.trim().length > 0;
  const showNoResults =
    hasQuery && !showApi && matches !== null && matches.length === 0;

  return (
    <Dialog open={searchOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12%] max-w-[520px] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[520px]"
      >
        <DialogTitle className="sr-only">Pencarian</DialogTitle>
        <div className="flex items-center gap-2.5 border-b px-4 py-3.5">
          <Search className="size-[15px] text-muted-foreground" />
          <input
            autoFocus
            aria-label="Cari transaksi, rekening, menu"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari transaksi, rekening, menu..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {showApi && (
            <>
              <div className="px-[18px] pt-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-muted-foreground">
                Hasil dari Data Keuangan
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
          {matches !== null && matches.length > 0 && (
            <>
              <div className="px-[18px] pt-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-muted-foreground">
                Halaman
              </div>
              {matches.map((d) => {
                const Icon = ICONS[d.icon] ?? Home;
                return (
                  <button
                    key={d.href}
                    onClick={() => go(d.href)}
                    className="flex w-full items-center gap-3 px-[18px] py-2.5 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Icon
                        className="size-[15px]"
                        style={{ color: d.color }}
                      />
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
          {!hasQuery && (
            <>
              <div className="px-[18px] pt-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-muted-foreground">
                Akses Cepat
              </div>
              {SEARCH_DATA.slice(0, 8).map((d) => {
                const Icon = ICONS[d.icon] ?? Home;
                return (
                  <button
                    key={d.href}
                    onClick={() => go(d.href)}
                    className="flex w-full items-center gap-3 px-[18px] py-2.5 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Icon
                        className="size-[15px]"
                        style={{ color: d.color }}
                      />
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
          {showNoResults && (
            <div className="px-7 py-7 text-center text-[13px] text-muted-foreground">
              Tidak ada hasil untuk &ldquo;<strong>{query}</strong>&rdquo;
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
