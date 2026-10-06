import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { LikeForLikeWindow } from "@/lib/laporan-period";
import type { PriorWindowTotals } from "@/lib/month-compare";
import type { DetailReportDto } from "@wealthme/contracts";

/**
 * Income/expense of the prior month's day-aligned window (see
 * `likeForLikeWindow`) — the like-for-like base for "Dibanding bulan lalu"
 * (Laporan) and the Beranda month deltas while the current month is still
 * running. Uses the same `reports/detail` endpoint (and cache key) as the
 * Detail tab, whose totals classify by COA direction exactly like the
 * summary's monthly buckets, so both sides of the comparison share one basis.
 * `undefined` while loading, on error, or when no window applies (the
 * compared month is complete).
 */
export function usePriorWindowTotals({
  familyGroupId,
  token,
  window,
}: {
  familyGroupId: string;
  token: string | undefined;
  window: LikeForLikeWindow | null;
}): PriorWindowTotals | undefined {
  const start = window?.priorStartDate ?? "";
  const end = window?.priorEndDate ?? "";
  const { data } = useQuery<DetailReportDto>({
    queryKey: queryKeys.reports.detail(familyGroupId, start, end),
    queryFn: () =>
      apiFetch<DetailReportDto>(
        `/family-groups/${familyGroupId}/reports/detail?startDate=${start}&endDate=${end}`,
        { token },
      ),
    enabled: Boolean(window && familyGroupId && token),
    staleTime: 60_000,
  });
  if (!window || !data) return undefined;
  return {
    income: data.totalIncome,
    expense: data.totalExpense,
    net: data.totalIncome - data.totalExpense,
  };
}
