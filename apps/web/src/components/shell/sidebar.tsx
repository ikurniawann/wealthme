"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/auth-compat";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, type BadgeVariant } from "@/lib/nav";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useShell } from "./shell-context";

const BADGE_CLASS: Record<BadgeVariant, string> = {
  danger: "bg-destructive text-white",
  "new-purple": "bg-brand-purple text-white",
  "new-success": "bg-success text-white",
};

function NavBadge({ text, variant }: { text: string; variant: BadgeVariant }) {
  return (
    <span
      className={cn(
        "ml-auto min-w-[18px] rounded-full px-1.5 py-px text-center text-[10px] font-bold",
        BADGE_CLASS[variant],
      )}
    >
      {text}
    </span>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setTxnOpen } = useShell();
  const activeTab = searchParams.get("tab");
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

  const unreadCount = unreadData?.count ?? 0;

  const [reportOpen, setReportOpen] = useState(pathname === "/laporan");

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b px-[18px] py-4">
        <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-primary text-[15px] font-extrabold text-white">
          W
        </div>
        <div className="text-base font-extrabold">
          Wealth<span className="text-primary">Me</span>
        </div>
        <button
          onClick={() => setTxnOpen(true)}
          title="Tambah Transaksi / Scan Struk"
          data-tour="add-transaction"
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary text-white shadow-[0_2px_8px_rgba(79,70,229,0.35)] transition-transform hover:scale-105"
        >
          <Plus className="size-[14px]" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2.5">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.label && (
              <div className="mt-1.5 px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[1px] text-muted-foreground">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              if (item.children) {
                const parentActive = pathname === item.href;
                return (
                  <div key={item.id}>
                    <button
                      onClick={() => setReportOpen((o) => !o)}
                      className={cn(
                        "mx-2 my-px flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-md px-3.5 py-[9px] text-[13px] font-medium transition-colors",
                        parentActive
                          ? "bg-accent font-semibold text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" />
                      {item.label}
                      <ChevronDown
                        className={cn(
                          "ml-auto size-3 text-muted-foreground transition-transform",
                          reportOpen && "rotate-180",
                        )}
                      />
                    </button>
                    <div
                      className={cn(
                        "overflow-hidden transition-[max-height] duration-300",
                        reportOpen ? "max-h-[600px]" : "max-h-0",
                      )}
                    >
                      {item.children.map((tab) => {
                        const tabActive =
                          pathname === "/laporan" && activeTab === tab.id;
                        return (
                          <Link
                            key={tab.id}
                            href={`/laporan?tab=${tab.id}`}
                            onClick={onNavigate}
                            className={cn(
                              "relative mx-2 my-px block rounded-md py-2 pr-4 pl-[42px] text-[12.5px] transition-colors",
                              "before:absolute before:left-[26px] before:top-1/2 before:size-[5px] before:-translate-y-1/2 before:rounded-full before:bg-border",
                              tabActive
                                ? "bg-accent font-semibold text-primary before:bg-primary"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )}
                          >
                            {tab.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNavigate}
                  data-tour={`nav-${item.id}`}
                  className={cn(
                    "mx-2 my-px flex items-center gap-2.5 rounded-md px-3.5 py-[9px] text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-accent font-semibold text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {item.label}
                  {item.id === "notifikasi" && unreadCount > 0 ? (
                    <NavBadge text={String(unreadCount)} variant="danger" />
                  ) : (
                    item.badge &&
                    item.badgeVariant && (
                      <NavBadge text={item.badge} variant={item.badgeVariant} />
                    )
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t p-3">
        <Link
          href="/akun"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md px-2 py-2.5 transition-colors hover:bg-secondary"
        >
          <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-purple text-[13px] font-bold text-white">
            {session?.user.name
              ? session.user.name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .join("")
              : "?"}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-bold">
              {session?.user.name ?? "—"}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {session?.user.email ?? "—"}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
