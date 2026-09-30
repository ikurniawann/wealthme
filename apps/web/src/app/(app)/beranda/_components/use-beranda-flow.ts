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

/** The API caps a page at 100 rows; the UI says so when a window holds more. */
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
 * "Tabungan" is money moved by transfer (to savings, goals, investments),
 * the only savings signal a transaction carries.
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
    return { label: dayLabel(date), savings: 0, income: 0, expense: 0 };
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
    else if (tx.type === "transfer") out[index].savings += amount;
  }
  return out;
}

/** Month-to-date expense by category, largest first. */
export function spendByCategory(
  transactions: readonly Pick<
    TransactionDto,
    "amount" | "type" | "categoryName"
  >[],
  otherLabel: string,
) {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const name = tx.categoryName || otherLabel;
    totals.set(name, (totals.get(name) ?? 0) + Math.abs(Number(tx.amount)));
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function useBerandaFlow(range: FlowRange) {
  const today = new Date();
  const windowStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (range - 1),
  );
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const window = useTxWindow(`w${range}`, windowStart, today);
  const month = useTxWindow("mtd", monthStart, today);
  return {
    today,
    window: window.data?.data ?? [],
    windowTotal: window.data?.meta.total ?? 0,
    windowSummary: window.data?.summary,
    month: month.data?.data ?? [],
    monthTotal: month.data?.meta.total ?? 0,
    isLoading: window.isLoading || month.isLoading,
  };
}
