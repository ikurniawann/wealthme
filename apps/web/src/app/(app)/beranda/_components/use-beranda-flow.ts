"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  TransactionDto,
  TransactionListResponse,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import type { FlowDay } from "@/components/charts/bento-charts";

export type FlowRange = 7 | 30;

/** The API caps a page at 100 rows. Windows here feed charts and lists only, never a headline total. */
const PAGE = 100;

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function useTxWindow(key: string, from: Date, to: Date) {
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const range = `from=${ymd(from)}&to=${ymd(to)}`;
  return useQuery<TransactionListResponse>({
    // Under the shared ["transactions", fg] prefix so recording a transaction refreshes it.
    queryKey: ["transactions", familyGroupId ?? "", "beranda", key, range],
    queryFn: ({ signal }) =>
      apiFetch<TransactionListResponse>(
        `/family-groups/${familyGroupId}/transactions?${range}&limit=${PAGE}`,
        { token, signal },
      ),
    enabled: Boolean(familyGroupId && token),
    staleTime: 60_000,
  });
}

/**
 * Daily buckets for the hero chart. Income and expense are what they say;
 * `net` ("Selisih") is income - expense of the bucket, the same definition as
 * the hero KPI (`currentMonth.net`). Transfers move money between the family's
 * own accounts and are not part of any of the three.
 */
export function bucketDays(
  transactions: readonly Pick<
    TransactionDto,
    "amount" | "type" | "occurredAt"
  >[],
  days: number,
  today: Date,
  dayLabel: (date: Date) => string,
): FlowDay[] {
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (days - 1),
  );
  const out: FlowDay[] = Array.from({ length: days }, (_, i) => {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
    );
    return { label: dayLabel(date), net: 0, income: 0, expense: 0 };
  });
  for (const tx of transactions) {
    const at = new Date(tx.occurredAt);
    const index = Math.round(
      (new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() -
        start.getTime()) /
        86_400_000,
    );
    if (index < 0 || index >= days) continue;
    const amount = Math.abs(Number(tx.amount));
    if (tx.type === "income") out[index].income += amount;
    else if (tx.type === "expense") out[index].expense += amount;
  }
  for (const day of out) day.net = day.income - day.expense;
  return out;
}

export function useBerandaFlow(range: FlowRange) {
  const today = new Date();
  const windowStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (range - 1),
  );
  const window = useTxWindow(`w${range}`, windowStart, today);
  return {
    today,
    window: window.data?.data ?? [],
    windowTotal: window.data?.meta.total ?? 0,
    windowSummary: window.data?.summary,
    isLoading: window.isLoading,
  };
}
