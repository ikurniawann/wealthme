"use client";

import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { CardLink, SectionCard, StatusBadge } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { NotificationDto } from "@wealthme/contracts";

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

export default function NotifikasiPage() {
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const queryClient = useQueryClient();

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

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          {t.notifikasi.title}
          {unreadCount > 0 && (
            <StatusBadge variant="danger">
              {unreadCount}
              {t.notifikasi.newCountSuffix}
            </StatusBadge>
          )}
        </span>
      }
      action={
        <CardLink
          onClick={() => familyGroupId && markAllRead.mutate(familyGroupId)}
          disabled={markAllRead.isPending || unreadCount === 0}
        >
          {markAllRead.isPending
            ? t.notifikasi.processing
            : t.notifikasi.markAllRead}
        </CardLink>
      }
      bodyClassName="flex flex-col"
    >
      {isLoading && <NotifSkeleton />}

      {isError && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t.notifikasi.errorLoad}
        </p>
      )}

      {!isLoading && !isError && notifications?.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t.notifikasi.emptyState}
        </p>
      )}

      {!isLoading &&
        !isError &&
        notifications?.map((n, i) => {
          const isLast = i === (notifications.length ?? 0) - 1;
          return (
            <div
              key={n.id}
              className={`flex items-start gap-3 py-3.5 ${isLast ? "" : "border-b"} ${n.isRead ? "opacity-60" : ""} ${i === 0 ? "pt-0" : ""}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-[18px]">
                {n.icon ?? "🔔"}
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold text-foreground">
                  {n.title}
                </div>
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
        })}
    </SectionCard>
  );
}
