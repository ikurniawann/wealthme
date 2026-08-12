"use client";

import { useMemo, useState } from "react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { CardLink, SectionCard, StatusBadge } from "@/components/wm";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { NotificationDto } from "@wealthme/contracts";

// Prototype structural port (EPIC-025 N3-B1) — the prototype groups
// notifications by "Hari Ini / Minggu Ini / Lebih Lama" in separate `.card`
// sections and offers a filter. `NotificationDto` has no category field
// (only title/body/icon/isRead/createdAt), so only the two filters
// derivable from real data are ported (Semua / Belum dibaca) — the
// prototype's Transaksi/Anggaran/Persetujuan tabs would require guessing a
// category from free-text title/body, which is not honest filtering. The
// prototype's notification-detail and settings dialogs are NOT ported: they
// have no backing API (no per-notification detail endpoint, no settings
// persistence) — porting them would be a dead/mocked control (Honest UI).
type Filter = "semua" | "belum-dibaca";

function formatRelativeTime(
  iso: string,
  t: ReturnType<typeof useLocale>["t"],
  locale: Locale,
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t.notifikasi.relativeJustNow;
  if (minutes < 60) return `${minutes}${t.notifikasi.relativeMinutesSuffix}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t.notifikasi.relativeHoursSuffix}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return t.notifikasi.relativeYesterday;
  if (days < 7) return `${days}${t.notifikasi.relativeDaysSuffix}`;
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function groupByRecency(notifications: NotificationDto[]) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const today: NotificationDto[] = [];
  const thisWeek: NotificationDto[] = [];
  const older: NotificationDto[] = [];
  for (const n of notifications) {
    const age = now - new Date(n.createdAt).getTime();
    if (age < oneDay) today.push(n);
    else if (age < 7 * oneDay) thisWeek.push(n);
    else older.push(n);
  }
  return { today, thisWeek, older };
}

function NotifSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3 border-b pb-3.5">
          <div className="size-10 shrink-0 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-2.5 w-1/4 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NotifRow({
  n,
  t,
  locale,
}: {
  n: NotificationDto;
  t: ReturnType<typeof useLocale>["t"];
  locale: Locale;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b py-3.5 last:border-b-0",
        n.isRead && "opacity-60",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-[18px]">
        {n.icon ?? "🔔"}
      </div>
      <div className="flex-1">
        <div className="text-[13.5px] font-bold text-foreground">{n.title}</div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">
          {n.body}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {formatRelativeTime(n.createdAt, t, locale)}
        </div>
      </div>
      {!n.isRead && (
        <StatusBadge variant="success" className="text-[10px]">
          {t.notifikasi.unreadBadge}
        </StatusBadge>
      )}
    </div>
  );
}

function NotifGroup({
  title,
  items,
  t,
  locale,
}: {
  title: string;
  items: NotificationDto[];
  t: ReturnType<typeof useLocale>["t"];
  locale: Locale;
}) {
  if (items.length === 0) return null;
  const unreadCount = items.filter((n) => !n.isRead).length;
  return (
    <SectionCard
      title={title}
      action={
        unreadCount > 0 ? (
          <StatusBadge variant="danger">
            {unreadCount}
            {t.notifikasi.newCountSuffix}
          </StatusBadge>
        ) : undefined
      }
    >
      {items.map((n) => (
        <NotifRow key={n.id} n={n} t={t} locale={locale} />
      ))}
    </SectionCard>
  );
}

export default function NotifikasiPage() {
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("semua");

  const {
    data: notifications,
    isLoading,
    isError,
  } = useQuery<NotificationDto[]>({
    queryKey: queryKeys.notifications.all(familyGroupId ?? ""),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("no familyGroupId");
      return apiFetch<NotificationDto[]>(
        `/family-groups/${familyGroupId}/notifications`,
        { token, signal },
      );
    },
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: queryKeys.notifications.unreadCount(familyGroupId ?? ""),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("no familyGroupId");
      return apiFetch<{ count: number }>(
        `/family-groups/${familyGroupId}/notifications/unread-count`,
        { token, signal },
      );
    },
    enabled: Boolean(familyGroupId) && Boolean(token),
    refetchInterval: 30_000,
  });

  const unreadCount = unreadData?.count ?? 0;

  const markAllRead = useMutation({
    mutationFn: (fgId: string) =>
      apiFetch<{ updated: number }>(
        `/family-groups/${fgId}/notifications/mark-read`,
        { method: "PATCH", token, body: JSON.stringify({}) },
      ),
    onSuccess: (_data, fgId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(fgId),
      });
    },
  });

  const filtered = useMemo(() => {
    const all = notifications ?? [];
    return filter === "belum-dibaca" ? all.filter((n) => !n.isRead) : all;
  }, [notifications, filter]);

  const { today, thisWeek, older } = groupByRecency(filtered);

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="notifikasi-heading"
        className="flex flex-wrap items-center gap-4"
      >
        <div className="min-w-[220px] flex-1">
          <h1
            id="notifikasi-heading"
            className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight"
          >
            {t.notifikasi.title}
            {unreadCount > 0 && (
              <StatusBadge variant="danger">
                {unreadCount}
                {t.notifikasi.newCountSuffix}
              </StatusBadge>
            )}
          </h1>
        </div>
        <CardLink
          onClick={() => familyGroupId && markAllRead.mutate(familyGroupId)}
          disabled={markAllRead.isPending || unreadCount === 0}
          className="rounded-md border bg-card px-3 py-1.5 text-[11.5px] no-underline shadow-sm hover:no-underline"
        >
          {markAllRead.isPending
            ? t.notifikasi.processing
            : t.notifikasi.markAllRead}
        </CardLink>
      </section>

      <section
        role="group"
        aria-label={t.notifikasi.title}
        className="inline-flex gap-0.5 rounded-[10px] bg-secondary p-[3px]"
      >
        {(["semua", "belum-dibaca"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors",
              filter === f && "bg-card text-foreground shadow-sm",
            )}
          >
            {f === "semua" ? t.notifikasi.filterAll : t.notifikasi.filterUnread}
          </button>
        ))}
      </section>

      {isLoading && (
        <SectionCard>
          <NotifSkeleton />
        </SectionCard>
      )}

      {isError && (
        <SectionCard>
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t.notifikasi.errorLoad}
          </p>
        </SectionCard>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <SectionCard>
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t.notifikasi.emptyState}
          </p>
        </SectionCard>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <>
          <NotifGroup
            title={t.notifikasi.groupToday}
            items={today}
            t={t}
            locale={locale}
          />
          <NotifGroup
            title={t.notifikasi.groupThisWeek}
            items={thisWeek}
            t={t}
            locale={locale}
          />
          <NotifGroup
            title={t.notifikasi.groupOlder}
            items={older}
            t={t}
            locale={locale}
          />
        </>
      )}
    </div>
  );
}
