"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDto, TransactionListResponse } from "@wealthme/contracts";

import { MintaDanaDialog } from "@/components/allowance/minta-dana-dialog";
import { useFxSnapshot } from "@/components/money";
import { ConfirmDeleteDialog } from "@/components/crud";
import { useShell } from "@/components/shell/shell-context";
import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";
import { useCanManage } from "@/hooks/use-role-permissions";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { useSession, signOut } from "@/lib/auth-compat";
import { queryKeys } from "@/lib/query-keys";

import type { FormMember } from "../rekening/account-form";
import { KasActivity, KasAttention } from "./kas-activity";
import { KasFilterBar } from "./kas-filters";
import { KasForm, type KasFormOpen } from "./kas-form";
import {
  applyFilters,
  EMPTY_FILTERS,
  hasActiveFilters,
  needsCheck,
  toRows,
  totals,
  type KasFilters,
  type KasRow,
} from "./kas-model";
import { KasSidePanel } from "./kas-side-panel";
import { KasHeader, KasSummary } from "./kas-summary";
import { KasTable } from "./kas-table";
import { ReconcileDialog } from "./reconcile-dialog";
import "./dana.css";

const ACTIVITY_LIMIT = 5;

export default function DanaPage() {
  const { t, locale } = useLocale();
  const c = t.dana.v3.page;
  const { openTxnAt } = useShell();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if ((session as { error?: string } | null)?.error === "RefreshTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;
  const myUserId = session?.userId;

  const {
    data: allAccounts,
    isLoading,
    isError,
  } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });
  // KasForm needs each member's dataScope, which /members returns.
  const { data: formMembers } = useQuery<FormMember[]>({
    queryKey: [...queryKeys.familyGroups.members(familyGroupId ?? ""), token],
    queryFn: () =>
      apiFetch<FormMember[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });
  const { data: rates } = useFxSnapshot(true);
  const { myRole } = useMyRole();
  const isMasterLike = myRole === "owner" || myRole === "spouse";
  const { canManage } = useCanManage("Account");

  const rows = useMemo(
    () => toRows(allAccounts ?? [], rates, new Date(), c.family),
    [allAccounts, rates, c.family],
  );
  const [filters, setFilters] = useState<KasFilters>(EMPTY_FILTERS);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  // The summary follows the search and filters (includeInNetWorth still
  // decides what is counted, inside `totals`).
  const sum = useMemo(() => totals(filtered), [filtered]);
  const isFiltered = hasActiveFilters(filters);
  const kasIds = useMemo(() => new Set(rows.map((r) => r.account.id)), [rows]);

  const { data: recentResponse } = useQuery<TransactionListResponse>({
    queryKey: [
      ...queryKeys.transactions.all(familyGroupId ?? ""),
      "dana-recent",
    ],
    queryFn: () =>
      apiFetch<TransactionListResponse>(
        `/family-groups/${familyGroupId}/transactions?limit=20`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && !isLoading && rows.length > 0,
  });
  const activity = useMemo(
    () =>
      (recentResponse?.data ?? [])
        .filter(
          (tx) =>
            (tx.accountId && kasIds.has(tx.accountId)) ||
            (tx.toAccountId && kasIds.has(tx.toAccountId)),
        )
        .slice(0, ACTIVITY_LIMIT),
    [recentResponse, kasIds],
  );

  const [hidden, setHidden] = useState(false);
  const [form, setForm] = useState<KasFormOpen | null>(null);
  const [reconciling, setReconciling] = useState<KasRow | null>(null);
  const [deleting, setDeleting] = useState<AccountDto | null>(null);
  const [requesting, setRequesting] = useState<AccountDto | null>(null);

  const myAccounts = (allAccounts ?? []).filter(
    (a) => !!myUserId && a.ownerUserId === myUserId,
  );
  const attention = canManage ? needsCheck(rows) : [];

  async function refresh() {
    if (!familyGroupId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.accounts.all(familyGroupId),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.transactions.all(familyGroupId),
    });
  }

  async function handleDelete() {
    if (!familyGroupId || !token || !deleting) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/accounts/${deleting.id}`,
        { token, method: "DELETE" },
      );
      toast.success(c.deleted);
      await refresh();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, c.deleteFailed));
    } finally {
      setDeleting(null);
    }
  }

  const addForm = (kind: "cash" | "ewallet") =>
    setForm({ kind, mode: "add", account: null });
  const showContent = !isLoading && !isError;

  return (
    <div className="kw">
      <KasHeader
        canManage={!!canManage}
        onTransfer={() => openTxnAt(2)}
        onAdd={addForm}
      />
      <KasSummary
        rows={filtered}
        totals={sum}
        filtered={isFiltered}
        onClearFilters={() => setFilters(EMPTY_FILTERS)}
        rates={rates}
        hidden={hidden}
        onToggleHidden={() => setHidden((h) => !h)}
        loading={isLoading}
        error={isError}
      />
      {isLoading && (
        <p className="kw-state" role="status">
          {c.loading}
        </p>
      )}
      {isError && (
        <p className="kw-state kw-state-error" role="alert">
          {c.errorLoad}
        </p>
      )}
      {showContent && rows.length > 0 && (
        <KasFilterBar
          rows={rows}
          filters={filters}
          onChange={setFilters}
          hidden={hidden}
          onToggleHidden={() => setHidden((h) => !h)}
        />
      )}
      <div className="kw-body">
        <div className="kw-main">
          {showContent && rows.length === 0 ? (
            <section className="kw-card kw-empty">
              <p>{c.empty}</p>
              {canManage && (
                <div className="kw-empty-actions">
                  <button
                    type="button"
                    className="kw-btn"
                    data-primary=""
                    onClick={() => addForm("cash")}
                  >
                    {c.addCash}
                  </button>
                  <button
                    type="button"
                    className="kw-btn"
                    onClick={() => addForm("ewallet")}
                  >
                    {c.addEwallet}
                  </button>
                </div>
              )}
            </section>
          ) : (
            showContent && (
              <>
                {filtered.length === 0 ? (
                  <section className="kw-card kw-empty">
                    <p>{c.noResults}</p>
                  </section>
                ) : (
                  <KasTable
                    rows={filtered}
                    hidden={hidden}
                    actions={{
                      canManage: !!canManage,
                      isMasterLike,
                      onEdit: (r) =>
                        setForm({
                          kind: r.kind,
                          mode: "edit",
                          account: r.account,
                        }),
                      onReconcile: setReconciling,
                      onRequest: (r) => setRequesting(r.account),
                      onDelete: (r) => setDeleting(r.account),
                    }}
                  />
                )}
                <KasAttention items={attention} onReconcile={setReconciling} />
                <KasActivity txns={activity} hidden={hidden} locale={locale} />
              </>
            )
          )}
        </div>
        <KasSidePanel canManage={!!canManage} onOpen={setForm} />
      </div>

      <KasForm
        open={form}
        onClose={() => setForm(null)}
        onSaved={refresh}
        members={formMembers ?? []}
        familyGroupId={familyGroupId ?? undefined}
        token={token}
        myUserId={myUserId}
        isMasterLike={isMasterLike}
      />
      <ReconcileDialog
        row={reconciling}
        onClose={() => setReconciling(null)}
        onDone={refresh}
        familyGroupId={familyGroupId ?? undefined}
        token={token}
      />
      <MintaDanaDialog
        source={requesting}
        targets={myAccounts}
        familyGroupId={familyGroupId ?? null}
        token={token}
        onClose={() => setRequesting(null)}
      />
      <ConfirmDeleteDialog
        label={deleting ? `"${deleting.name}"` : null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
