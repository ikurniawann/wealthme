"use client";

import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Gauge,
  Receipt,
  Settings,
  Target,
} from "lucide-react";

import "./notifikasi.css";

import { useMemo, useState } from "react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import {
  BentoCard,
  BentoGrid,
  BentoHero,
  GhostButton,
  HeroKpi,
  Segmented,
  StatusBadge,
} from "@/components/wm";
import { cn } from "@/lib/utils";
import { displayNotificationText } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { NotificationDto } from "@wealthme/contracts";

type Filter =
  | "semua"
  | "belum-dibaca"
  | "transaksi"
  | "anggaran"
  | "persetujuan"
  | "jatuh-tempo"
  | "sistem";

const FILTER_IDS: Filter[] = [
  "semua",
  "belum-dibaca",
  "transaksi",
  "anggaran",
  "persetujuan",
  "jatuh-tempo",
  "sistem",
];

const CATEGORY_COLOR: Record<string, string> = {
  transaksi: "var(--wm-ink)",
  anggaran: "var(--wm-orange)",
  persetujuan: "var(--wm-sky)",
  "jatuh-tempo": "var(--wm-yellow)",
  sistem: "var(--wm-muted)",
};

const CATEGORY_ICON = {
  transaksi: Target,
  anggaran: Gauge,
  persetujuan: CheckCircle2,
  "jatuh-tempo": Receipt,
  sistem: Settings,
};

function inferNotificationFilter(
  n: NotificationDto,
): Exclude<Filter, "semua" | "belum-dibaca"> {
  const text = `${n.title} ${n.body} ${n.icon ?? ""}`.toLowerCase();
  if (/(setuju|approval|persetujuan|request|permintaan)/.test(text)) {
    return "persetujuan";
  }
  if (/(jatuh tempo|tempo|tagihan|cicilan|premi|renewal)/.test(text)) {
    return "jatuh-tempo";
  }
  if (/(budget|anggaran|limit|kategori)/.test(text)) {
    return "anggaran";
  }
  if (/(login|password|pin|akun|sistem|keamanan|device)/.test(text)) {
    return "sistem";
  }
  return "transaksi";
}

const MONEY_SPLIT = /(-?Rp\s[\d.]*\d)/;

/** Wraps each "Rp 1.234" figure in `.wm-amt` (tabular numerals, no wrapping). */
function MoneyText({ text }: { text: string }) {
  return (
    <>
      {text.split(MONEY_SPLIT).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="wm-amt">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

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
  onMarkRead,
}: {
  n: NotificationDto;
  t: ReturnType<typeof useLocale>["t"];
  locale: Locale;
  onMarkRead: (id: string) => void;
}) {
  // Opening (clicking) an unread notification marks it read for THIS member
  // only — the server keeps a per-member receipt, so other family members
  // still see it as new until they read it themselves.
  const markRead = () => {
    if (!n.isRead) onMarkRead(n.id);
  };
  const category = inferNotificationFilter(n);
  const Icon = n.isRead ? Bell : CATEGORY_ICON[category];
  return (
    <div
      role={n.isRead ? undefined : "button"}
      tabIndex={n.isRead ? undefined : 0}
      aria-label={
        n.isRead
          ? undefined
          : `${displayNotificationText(n.title)}: ${t.notifikasi.markOneRead}`
      }
      onClick={markRead}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          markRead();
        }
      }}
      className={cn("nf-row", n.isRead ? "read" : "unread")}
    >
      <span className="nf-ic" data-cat={category} aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="nf-body">
        <span className="nf-line block">
          <b>{displayNotificationText(n.title)}</b>{" "}
          <span>
            <MoneyText text={displayNotificationText(n.body)} />
          </span>
        </span>
        <span className="nf-time block">
          {formatRelativeTime(n.createdAt, t, locale)}
        </span>
      </span>
      {!n.isRead && (
        <span className="nf-side">
          <StatusBadge variant="info" className="nf-new">
            {t.notifikasi.unreadBadge}
          </StatusBadge>
          <span className="nf-hint text-primary-strong">
            {t.notifikasi.markOneRead}
          </span>
        </span>
      )}
    </div>
  );
}

function NotifGroup({
  title,
  items,
  t,
  locale,
  onMarkRead,
}: {
  title: string;
  items: NotificationDto[];
  t: ReturnType<typeof useLocale>["t"];
  locale: Locale;
  onMarkRead: (id: string) => void;
}) {
  if (items.length === 0) return null;
  const unreadCount = items.filter((n) => !n.isRead).length;
  return (
    <div className="nf-group">
      <h2 className="nf-group-title">
        {title}
        {unreadCount > 0 && (
          <StatusBadge variant="info">
            {unreadCount}
            {t.notifikasi.groupUnreadSuffix}
          </StatusBadge>
        )}
      </h2>
      {items.map((n) => (
        <NotifRow
          key={n.id}
          n={n}
          t={t}
          locale={locale}
          onMarkRead={onMarkRead}
        />
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
  const [filter, setFilter] = useState<Filter>("semua");
  const [heroMore, setHeroMore] = useState(false);

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
    // Without this the request could fail and the only thing the user saw was
    // the button leaving its "Memproses..." state with every notification
    // still unread — a silent no-op that reads as "the button is broken".
    onError: (err: unknown) => {
      toast.error(
        (err as { message?: string }).message ?? t.notifikasi.markAllReadFailed,
      );
    },
  });

  // Mark ONE notification read. Optimistic: the "Baru" badge and the unread
  // counters drop immediately, and roll back if the server refuses.
  const markOneRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ updated: number }>(
        `/family-groups/${familyGroupId}/notifications/mark-read`,
        { method: "PATCH", token, body: JSON.stringify({ ids: [id] }) },
      ),
    onMutate: async (id: string) => {
      const listKey = queryKeys.notifications.all(familyGroupId ?? "");
      const countKey = queryKeys.notifications.unreadCount(familyGroupId ?? "");
      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: countKey });
      const prevList = queryClient.getQueryData<NotificationDto[]>(listKey);
      const prevCount = queryClient.getQueryData<{ count: number }>(countKey);
      queryClient.setQueryData<NotificationDto[]>(listKey, (old) =>
        old?.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      queryClient.setQueryData<{ count: number }>(countKey, (old) =>
        old ? { count: Math.max(0, old.count - 1) } : old,
      );
      return { prevList, prevCount };
    },
    onError: (err: unknown, _id, ctx) => {
      const listKey = queryKeys.notifications.all(familyGroupId ?? "");
      const countKey = queryKeys.notifications.unreadCount(familyGroupId ?? "");
      if (ctx?.prevList) queryClient.setQueryData(listKey, ctx.prevList);
      if (ctx?.prevCount) queryClient.setQueryData(countKey, ctx.prevCount);
      toast.error(
        (err as { message?: string }).message ?? t.notifikasi.markAllReadFailed,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all(familyGroupId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(familyGroupId ?? ""),
      });
    },
  });

  const filtered = useMemo(() => {
    const all = notifications ?? [];
    if (filter === "semua") return all;
    if (filter === "belum-dibaca") return all.filter((n) => !n.isRead);
    return all.filter((n) => inferNotificationFilter(n) === filter);
  }, [notifications, filter]);

  const { today, thisWeek, older } = groupByRecency(filtered);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notifications ?? []) {
      const c = inferNotificationFilter(n);
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [notifications]);
  const v2 = t.notifikasi.v2;
  const categoryLabel: Record<string, string> = {
    transaksi: v2.filterTransaksi,
    anggaran: v2.filterAnggaran,
    persetujuan: v2.filterPersetujuan,
    "jatuh-tempo": v2.filterTempo,
    sistem: v2.filterSistem,
  };
  const categoryKeys = Object.keys(categoryLabel).filter(
    (k) => (categoryCounts[k] ?? 0) > 0,
  );
  const filterLabel = (id: Filter) =>
    id === "semua"
      ? t.notifikasi.filterAll
      : id === "belum-dibaca"
        ? t.notifikasi.filterUnread
        : categoryLabel[id];
  const onMarkRead = (id: string) => familyGroupId && markOneRead.mutate(id);

  return (
    <div className="space-y-4" data-page="notifikasi">
      <BentoGrid className="nf-grid">
        <BentoHero
          collapse={false}
          className={heroMore ? "nf-hero nf-hero--more" : "nf-hero"}
          currency={null}
          value={unreadCount}
          caption={v2.heroCap}
          controls={
            <GhostButton
              lit
              onClick={() => familyGroupId && markAllRead.mutate(familyGroupId)}
              disabled={markAllRead.isPending || unreadCount === 0}
            >
              {markAllRead.isPending
                ? t.notifikasi.processing
                : t.notifikasi.markAllRead}
            </GhostButton>
          }
          chart={
            categoryKeys.length > 0 ? (
              <div>
                <div className="nf-strip" role="img" aria-label={v2.compAria}>
                  {categoryKeys.map((k) => (
                    <span
                      key={k}
                      style={{
                        flexGrow: categoryCounts[k],
                        background: CATEGORY_COLOR[k],
                      }}
                    />
                  ))}
                </div>
                <div className="nf-legend">
                  {categoryKeys.map((k) => (
                    <span
                      key={k}
                      style={
                        { "--c": CATEGORY_COLOR[k] } as React.CSSProperties
                      }
                    >
                      <i aria-hidden="true" />
                      {categoryLabel[k]}
                      <b>{categoryCounts[k]}</b>
                    </span>
                  ))}
                </div>
              </div>
            ) : undefined
          }
          kpis={
            <>
              <HeroKpi
                label={v2.kpiApproval}
                value={String(categoryCounts.persetujuan ?? 0)}
              />
              <HeroKpi
                label={v2.kpiBill}
                value={String(categoryCounts["jatuh-tempo"] ?? 0)}
              />
              {categoryKeys.length > 0 && (
                <button
                  type="button"
                  className="nf-hero-more"
                  aria-expanded={heroMore}
                  onClick={() => setHeroMore((open) => !open)}
                >
                  {heroMore ? t.transaksi.v2.heroLess : t.transaksi.v2.heroMore}
                  <ChevronDown aria-hidden="true" />
                </button>
              )}
            </>
          }
        />

        <BentoCard className="nf-list">
          <div className="nf-head">
            <Segmented
              label={v2.filterLabel}
              value={filter}
              onChange={setFilter}
              options={FILTER_IDS.map((id) => ({
                value: id,
                label: filterLabel(id),
              }))}
            />
            {!isLoading && !isError && (
              <span className="nf-count">
                {filtered.length}
                {t.notifikasi.metaCountSuffix}
              </span>
            )}
          </div>
          <div className="nf-groups">
            {isLoading && <NotifSkeleton />}
            {isError && <p className="nf-empty">{t.notifikasi.errorLoad}</p>}
            {!isLoading && !isError && filtered.length === 0 && (
              <p className="nf-empty">
                {filter === "semua" ? t.notifikasi.emptyState : v2.emptyFilter}
              </p>
            )}
            {!isLoading && !isError && filtered.length > 0 && (
              <>
                <NotifGroup
                  title={t.notifikasi.groupToday}
                  items={today}
                  t={t}
                  locale={locale}
                  onMarkRead={onMarkRead}
                />
                <NotifGroup
                  title={t.notifikasi.groupThisWeek}
                  items={thisWeek}
                  t={t}
                  locale={locale}
                  onMarkRead={onMarkRead}
                />
                <NotifGroup
                  title={t.notifikasi.groupOlder}
                  items={older}
                  t={t}
                  locale={locale}
                  onMarkRead={onMarkRead}
                />
              </>
            )}
          </div>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
