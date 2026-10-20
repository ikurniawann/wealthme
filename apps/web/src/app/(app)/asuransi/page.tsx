"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { useSession } from "@/lib/auth-compat";
import { queryKeys } from "@/lib/query-keys";

import "./asuransi.css";
import "./asuransi-list.css";
import "./asuransi-responsive.css";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  filtersToQuery,
  holderKey,
  jakartaToday,
  parseFilters,
  personKey,
  scheduleRows,
  sortByDue,
  type AsuransiFilters,
} from "./asuransi-model";
import { AsuransiHeader, AsuransiSummary } from "./asuransi-summary";
import {
  AsuransiFilterBar,
  type FilterOption,
  type FilterOptions,
} from "./asuransi-filters";
import { PolicyList } from "./policy-list";
import { PremiumSchedule, UnitLinkValueCard } from "./schedule-and-value";
import { PayDialog } from "./pay-dialog";
import { ReportDialog } from "./report-dialog";
import { InsuranceModal } from "./policy-form";
import type { FamilyMember } from "./beneficiary-editor";
import type { PolicyAction } from "./policy-row-parts";

import type {
  AccountDto,
  InsuranceDto,
  InsuranceSummaryDto,
} from "@wealthme/contracts";

const byLabel = (a: FilterOption, b: FilterOption) =>
  a.label.localeCompare(b.label);

function uniqueOptions(entries: [string, string][]): FilterOption[] {
  return Array.from(new Map(entries), ([value, label]) => ({
    value,
    label,
  })).sort(byLabel);
}

/**
 * Asuransi — policy list, premium schedule and payments (Task 24). Premiums,
 * protection benefits and policy values stay separate: sums assured are
 * grouped by kind + currency and never added to net worth; only confirmed
 * policy values are shown as value. Filters live in the URL.
 */
function AsuransiPageInner() {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId ?? "";
  const enabled = Boolean(token && familyGroupId);

  const list = useQuery<InsuranceDto[]>({
    queryKey: queryKeys.insurances.all(familyGroupId),
    enabled,
    queryFn: ({ signal }) =>
      apiFetch<InsuranceDto[]>(`/family-groups/${familyGroupId}/insurances`, {
        token,
        signal,
      }),
  });
  const summary = useQuery<InsuranceSummaryDto>({
    queryKey: queryKeys.insurances.summary(familyGroupId),
    enabled,
    queryFn: ({ signal }) =>
      apiFetch<InsuranceSummaryDto>(
        `/family-groups/${familyGroupId}/insurances/summary`,
        { token, signal },
      ),
  });
  const accounts = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId),
    enabled,
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
  });
  const members = useQuery<FamilyMember[], ApiError>({
    queryKey: [...queryKeys.familyGroups.members(familyGroupId), token],
    enabled,
    retry: false,
    queryFn: () =>
      apiFetch<FamilyMember[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
  });

  const [formTarget, setFormTarget] = useState<"add" | InsuranceDto | null>(
    null,
  );
  const [payFor, setPayFor] = useState<{ policyId: string | null } | null>(
    null,
  );
  const [reportFor, setReportFor] = useState<{
    policyId: string | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<InsuranceDto | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/family-groups/${familyGroupId}/insurances/${id}`, {
        method: "DELETE",
        token,
      }).catch((err: unknown) => {
        // 204 has no body: only a real API error (with a status) rethrows.
        if (err && typeof err === "object" && "status" in err) throw err;
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(familyGroupId),
      });
      toast.success(t.asuransi.toastDeleted);
    },
    onError: (err) => toast.error(apiErrorMessage(err, c.deleteFailed)),
    onSettled: () => setDeleting(null),
  });

  const filters = parseFilters(new URLSearchParams(searchParams.toString()));
  const setFilters = useCallback(
    (patch: Partial<AsuransiFilters>) => {
      const current = parseFilters(new URLSearchParams(window.location.search));
      const q = filtersToQuery({ ...current, ...patch }).toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const policies = useMemo(() => list.data ?? [], [list.data]);
  const today = jakartaToday();
  const rows = sortByDue(applyFilters(policies, filters, today));
  const options = useMemo<FilterOptions>(() => {
    const memberName = new Map(
      (members.data ?? []).map((m) => [m.userId, m.name]),
    );
    const holders: [string, string][] = [];
    const insured: [string, string][] = [];
    for (const p of policies) {
      const hk = holderKey(p);
      if (hk) {
        holders.push([
          hk,
          p.holderName ?? memberName.get(p.holderUserId ?? "") ?? "—",
        ]);
      }
      for (const i of p.insured ?? []) {
        insured.push([personKey(i.memberUserId, i.name), i.name]);
      }
    }
    return {
      holders: uniqueOptions(holders),
      insured: uniqueOptions(insured),
      providers: uniqueOptions(
        policies
          .filter((p) => p.provider)
          .map((p) => [p.provider!, p.provider!]),
      ),
      types: uniqueOptions(
        policies.map((p) => [p.type, t.asuransi.typeLabels[p.type] ?? p.type]),
      ),
      statuses: uniqueOptions(
        policies.map((p) => [
          p.status,
          t.asuransi.statusLabels[p.status] ?? p.status,
        ]),
      ),
      currencies: uniqueOptions(policies.map((p) => [p.currency, p.currency])),
    };
  }, [policies, members.data, t]);

  const onAction = (action: PolicyAction, policy: InsuranceDto) => {
    if (action === "pay") setPayFor({ policyId: policy.id });
    else if (action === "delete") setDeleting(policy);
    else if (action === "detail") router.push(`/asuransi/${policy.id}`);
    else setFormTarget(policy);
  };
  const closeForm = useCallback(() => setFormTarget(null), []);
  const isFiltered = activeFilterCount(filters) > 0 || Boolean(filters.q);
  const familyMembers = members.data ?? [];

  return (
    <div className="ins3" data-page="asuransi">
      <AsuransiHeader
        disabled={!enabled}
        onUpload={() => setReportFor({ policyId: null })}
        onPay={() => setPayFor({ policyId: null })}
        onAdd={() => setFormTarget("add")}
      />
      <AsuransiSummary summary={summary.data} isLoading={summary.isLoading} />
      <PolicyList
        rows={rows}
        total={policies.length}
        isLoading={list.isLoading}
        isError={list.isError}
        isFiltered={isFiltered}
        onRetry={() => void list.refetch()}
        onAction={onAction}
        filterBar={
          <AsuransiFilterBar
            filters={filters}
            options={options}
            onChange={setFilters}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />
        }
      />
      <div className="ins3-bottom">
        <PremiumSchedule
          rows={scheduleRows(policies, today)}
          isLoading={list.isLoading}
          onPay={(p) => setPayFor({ policyId: p.id })}
          onSeeAll={() => {
            setFilters({ due: "d90" });
            document
              .getElementById("ins3-list")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <UnitLinkValueCard
          policies={policies}
          summary={summary.data}
          isLoading={list.isLoading || summary.isLoading}
          onUpdate={() =>
            setReportFor({
              policyId:
                policies.find((p) => p.policyType === "unit_link")?.id ?? null,
            })
          }
          onDetail={(p) => router.push(`/asuransi/${p.id}`)}
        />
      </div>

      {formTarget && familyGroupId && (
        <InsuranceModal
          key={formTarget === "add" ? "add" : formTarget.id}
          familyGroupId={familyGroupId}
          token={token}
          editing={formTarget === "add" ? null : formTarget}
          familyMembers={familyMembers}
          membersUnavailable={members.isError}
          accounts={accounts.data ?? []}
          onClose={closeForm}
        />
      )}
      {payFor && (
        <PayDialog
          familyGroupId={familyGroupId}
          token={token}
          policies={policies}
          accounts={accounts.data ?? []}
          initialPolicyId={payFor.policyId}
          onClose={() => setPayFor(null)}
        />
      )}
      {reportFor && (
        <ReportDialog
          policies={policies}
          initialPolicyId={reportFor.policyId}
          onClose={() => setReportFor(null)}
        />
      )}
      <ConfirmDeleteDialog
        label={deleting ? `"${deleting.name}"` : null}
        title={t.asuransi.deleteDialogTitle}
        body={t.asuransi.deleteDialogBody}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
      />
    </div>
  );
}

export default function AsuransiPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p role="status">{t.asuransi.v3.loading}</p>}>
      <AsuransiPageInner />
    </Suspense>
  );
}
