"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationDto } from "@wealthme/contracts";
import { POP_CLASS, POP_ITEM_CLASS } from "./pop-classes";

/** Bento v2 bell: the latest notifications in a popover, full list on /notifikasi. */
export function NotificationsPopover({ unreadCount }: { unreadCount: number }) {
  const { data: session } = useSession();
  const { t } = useLocale();
  const router = useRouter();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const { data } = useQuery<NotificationDto[]>({
    queryKey: queryKeys.notifications.all(familyGroupId ?? ""),
    queryFn: ({ signal }) =>
      apiFetch<NotificationDto[]>(
        `/family-groups/${familyGroupId}/notifications`,
        { token, signal },
      ),
    enabled: Boolean(familyGroupId && token),
  });
  const label =
    unreadCount > 0
      ? `${t.shell.notifications}, ${t.shell.v2.notificationsUnread.replace("{count}", String(unreadCount))}`
      : t.shell.notifications;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="wm-icon-btn" aria-label={label}>
        <Bell aria-hidden="true" />
        {unreadCount > 0 && <span className="wm-dot" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={`${POP_CLASS} w-[min(360px,calc(100vw-24px))]`}
      >
        <div className="wm-pop-title">
          <span>{t.shell.notifications}</span>
          {unreadCount > 0 && <span className="wm-badge">{unreadCount}</span>}
        </div>
        {(data ?? []).slice(0, 5).map((notification) => (
          <DropdownMenuItem
            key={notification.id}
            onClick={() => router.push("/notifikasi")}
            className={`${POP_ITEM_CLASS} items-start`}
          >
            <span
              className="wm-noti w-full min-w-0"
              data-unread={notification.isRead ? undefined : "true"}
            >
              <i aria-hidden="true" />
              <span className="min-w-0">
                <b>{notification.title}</b>
                <small>{notification.body}</small>
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        {data?.length === 0 && (
          <p className="px-3 py-4 text-[13px] text-[var(--wm-muted)]">
            {t.notifikasi.emptyState}
          </p>
        )}
        <DropdownMenuSeparator className="wm-pop-sep" />
        <DropdownMenuItem
          onClick={() => router.push("/notifikasi")}
          className={`${POP_ITEM_CLASS} justify-center font-semibold`}
        >
          {t.common.viewAll}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
