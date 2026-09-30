"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type {
  AccountDto,
  BudgetDto,
  DashboardSummaryDto,
  GoalDto,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  getSetupChecklistState,
  SETUP_STEP_IDS,
  type SetupStepId,
} from "@/lib/setup-checklist";
import { isNavItemVisibleForAccess, NAV_SECTIONS } from "@/lib/nav";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";

const STEP_HREFS: Record<SetupStepId, string> = {
  account: "/rekening",
  budget: "/anggaran",
  transaction: "/transaksi",
  family: "/iam",
  goal: "/tujuan",
};

const BERANDA = NAV_SECTIONS.flatMap((section) => section.items).find(
  (item) => item.id === "beranda",
)!;

/**
 * Setup progress card at the foot of the hub sidebar (prototype `.promo`,
 * "Lengkapi profil"). Same queries and keys as Beranda, so they are shared,
 * not refetched. Only for members who see the household dashboard, and it
 * disappears once all five steps are done.
 */
export function SidebarSetup() {
  const { t } = useLocale();
  const { access } = useMyAccess();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? "";
  const token = session?.accessToken;
  const enabled =
    Boolean(familyGroupId && token) &&
    isNavItemVisibleForAccess(BERANDA, access);
  const get =
    <T,>(path: string) =>
    () =>
      apiFetch<T>(`/family-groups/${familyGroupId}${path}`, { token });

  const summary = useQuery<DashboardSummaryDto>({
    queryKey: queryKeys.dashboard.summary(familyGroupId),
    queryFn: get("/dashboard/summary"),
    enabled,
    staleTime: 60_000,
  });
  const accounts = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId),
    queryFn: get("/accounts"),
    enabled,
    staleTime: 60_000,
  });
  const budgets = useQuery<BudgetDto[]>({
    queryKey: queryKeys.budgets.all(familyGroupId),
    queryFn: get("/budgets"),
    enabled,
    staleTime: 60_000,
  });
  const goals = useQuery<GoalDto[]>({
    queryKey: queryKeys.goals.all(familyGroupId),
    queryFn: get("/goals"),
    enabled,
    staleTime: 60_000,
  });
  const members = useQuery<{ role: string }[]>({
    queryKey: queryKeys.familyGroups.members(familyGroupId),
    queryFn: get("/members"),
    enabled,
    staleTime: 60_000,
  });

  if (
    ![summary, accounts, budgets, goals, members].every(
      (query) => query.isSuccess,
    )
  )
    return null;
  const state = getSetupChecklistState({
    hasAccount: Boolean(accounts.data?.length),
    hasBudget: Boolean(budgets.data?.length),
    hasTransaction: Boolean(summary.data?.recentTransactions.length),
    hasFamilyMember:
      (members.data ?? []).filter((member) => member.role !== "admin_staff")
        .length > 1,
    hasGoal: Boolean(goals.data?.length),
  });
  if (state.complete || !state.nextStep) return null;
  const copy = t.beranda.setupChecklist;

  return (
    <div className="wm-promo">
      <h3>{copy.title}</h3>
      <div
        className="wm-steps"
        role="progressbar"
        aria-label={copy.title}
        aria-valuemin={0}
        aria-valuemax={SETUP_STEP_IDS.length}
        aria-valuenow={state.completedCount}
      >
        {state.steps.map((step) => (
          <i key={step.id} data-on={step.complete || undefined} />
        ))}
      </div>
      <p>
        {copy.progressLabelTemplate.replace(
          "{completed}",
          String(state.completedCount),
        )}
      </p>
      <Link href={STEP_HREFS[state.nextStep]} className="wm-promo-btn">
        {copy.nextStep}
      </Link>
    </div>
  );
}
