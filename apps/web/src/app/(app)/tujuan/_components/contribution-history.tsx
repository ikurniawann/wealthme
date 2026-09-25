"use client";

import { useQuery } from "@tanstack/react-query";

import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type { GoalContributionDto } from "@wealthme/contracts";

interface ContributionHistoryProps {
  goalId: string;
  familyGroupId: string;
  token: string | undefined;
}

export function ContributionHistory({
  goalId,
  familyGroupId,
  token,
}: ContributionHistoryProps) {
  const { t, locale } = useLocale();
  const { data, isLoading, isError } = useQuery<GoalContributionDto[]>({
    queryKey: [...queryKeys.goals.all(familyGroupId), goalId, "contributions"],
    enabled: Boolean(token) && Boolean(familyGroupId),
    queryFn: ({ signal }) =>
      apiFetch<GoalContributionDto[]>(
        `/family-groups/${familyGroupId}/goals/${goalId}/contributions`,
        { token, signal },
      ),
  });

  if (isLoading) {
    return (
      <div className="text-[11.5px] text-muted-foreground">
        {t.tujuan.historyLoading}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="text-[11.5px] text-destructive">
        {t.tujuan.historyError}
      </div>
    );
  }
  if (!data?.length) {
    return (
      <div className="text-[11.5px] text-muted-foreground">
        {t.tujuan.historyEmpty}
      </div>
    );
  }

  return (
    <ul className="space-y-1.5" aria-label={t.tujuan.historyToggleShow}>
      {data.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between gap-2 text-[11.5px]"
        >
          <span className="min-w-0 truncate text-muted-foreground">
            {new Date(c.occurredAt).toLocaleDateString(
              locale === "en" ? "en-US" : "id-ID",
              { day: "numeric", month: "short", year: "numeric" },
            )}
            {" · "}
            {c.source === "auto"
              ? t.tujuan.historySourceAuto
              : t.tujuan.historySourceManual}
            {c.accountName ? ` · ${c.accountName}` : ""}
          </span>
          <span className="mono shrink-0 font-semibold">
            {formatRupiah(Number(c.amount))}
          </span>
        </li>
      ))}
    </ul>
  );
}
