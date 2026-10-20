"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDto } from "@wealthme/contracts";

import { useSession, signOut } from "@/lib/auth-compat";
import { CardSkinPanel, useCardLooks } from "@/components/wm";
import { ConfirmDeleteDialog } from "@/components/crud";
import { AccountTaxNotice } from "@/components/tax/account-tax-notice";
import { MintaDanaDialog } from "@/components/allowance/minta-dana-dialog";
import { useFxSnapshot } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { useMyRole } from "@/hooks/use-my-role";
import { useMoney } from "@/hooks/use-money";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { apiErrorMessage } from "@/lib/api-error";
import { fill } from "@/i18n/rekening-v3";

import "./rekening.css";
import {
  AccountForm,
  type AccountFormOpen,
  type FormMember,
} from "./account-form";
import {
  EMPTY_FILTERS,
  applyFilters,
  hasActiveFilters,
  attentionItems,
  groupByBank,
  insuranceExposures,
  insuredShare,
  liquidity,
  monthlyNetInterest,
  toRows,
  type RekeningFilters,
  type RekeningRow,
} from "./rekening-model";
import {
  RekeningFilterPanel,
  type RekeningSort,
  type RekeningView,
} from "./rekening-filters";
import { RekeningGroups } from "./rekening-groups";
import { AttentionCard, RekeningHero } from "./rekening-hero";

const VIEW_KEY = "wm:rekening:view";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sortRows(rows: RekeningRow[], sort: RekeningSort): RekeningRow[] {
  const copy = [...rows];
  if (sort === "name")
    return copy.sort((a, b) =>
      a.account.name.localeCompare(b.account.name, "id"),
    );
  if (sort === "newest") return copy.sort((a, b) => a.idleDays - b.idleDays);
  return copy;
}

/**
 * Rekening v3 — bank accounts as a wealth register: a summary of what is
 * liquid, locked, insured and earning; what needs attention; filters by
 * bank / holder / product / access; and the family's cards grouped per bank.
 */
export default function RekeningPage() {
  const { t } = useLocale();
  const c = t.rekening.v3;
  const money = useMoney();
  const { data: session } = useSession();

  useEffect(() => {
    if ((session as { error?: string } | null)?.error === "RefreshTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;
  const myUserId = session?.userId;
  const queryClient = useQueryClient();

  const {
    data: accounts,
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
  const { data: members } = useQuery<FormMember[]>({
    queryKey: [...queryKeys.familyGroups.members(familyGroupId ?? ""), token],
    queryFn: () =>
      apiFetch<FormMember[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });
  const { data: rates } = useFxSnapshot(true);

  const { canManage } = useCanManage("Account");
  const { myRole } = useMyRole();
  const isMasterLike = myRole === "owner" || myRole === "spouse";

  const [filters, setFilters] = useState<RekeningFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<RekeningSort>("balance");
  const [viewChoice, setViewChoice] = useState<RekeningView | null>(null);
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormOpen | null>(null);
  const [deleting, setDeleting] = useState<AccountDto | null>(null);
  const [requesting, setRequesting] = useState<AccountDto | null>(null);
  const [customizing, setCustomizing] = useState<RekeningRow | null>(null);

  // The chosen view is a per-viewer convenience kept in localStorage; read
  // through useSyncExternalStore so server and first client render agree.
  const storedView = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const saved = window.localStorage.getItem(VIEW_KEY);
        return saved === "table" ? "table" : "cards";
      } catch {
        return "cards";
      }
    },
    () => "cards" as const,
  );
  const view: RekeningView = viewChoice ?? storedView;
  const setView = (v: RekeningView) => {
    setViewChoice(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage unavailable: the choice still holds for this visit */
    }
  };

  const today = todayIso();
  const bankAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.type === "bank"),
    [accounts],
  );
  const rows = useMemo(
    () => toRows(bankAccounts, today, { family: c.page.familyHolder }),
    [bankAccounts, today, c.page.familyHolder],
  );
  const filtered = useMemo(() => {
    const base = applyFilters(rows, filters, myUserId);
    const focused = focusIds
      ? base.filter((r) => focusIds.includes(r.account.id))
      : base;
    return sortRows(focused, sort);
  }, [rows, filters, myUserId, focusIds, sort]);
  // The hero summary follows the search, filters and attention focus — the
  // same rows the list shows (closed accounts never count toward balances).
  const isFiltered = hasActiveFilters(filters) || focusIds !== null;
  const summaryRows = useMemo(
    () => filtered.filter((r) => r.account.status !== "closed"),
    [filtered],
  );
  const exposures = useMemo(
    () => insuranceExposures(rows, rates),
    [rows, rates],
  );
  const summaryExposures = useMemo(
    () => insuranceExposures(summaryRows, rates),
    [summaryRows, rates],
  );
  const liq = liquidity(summaryRows);
  const insured = insuredShare(summaryExposures);
  const uninsured = summaryExposures.reduce(
    (s, e) => s + Math.max(0, e.total - e.capIdr),
    0,
  );
  const attention = attentionItems(rows, exposures);
  const usdPerUnit = Number(rates?.idrPerUnit?.USD ?? NaN);
  const usdTotal =
    Number.isFinite(usdPerUnit) && usdPerUnit > 0
      ? liq.total / usdPerUnit
      : null;

  const groups = groupByBank(filtered, filters.hideEmpty && !focusIds);
  const resultTotal = filtered.reduce((s, r) => s + (r.balance ?? 0), 0);
  const bankCount = new Set(summaryRows.map((r) => r.bankKey)).size;

  const { lookFor, setLook } = useCardLooks(accounts);
  const myAccounts = (accounts ?? []).filter(
    (a) => !!myUserId && a.ownerUserId === myUserId,
  );

  async function invalidate() {
    if (!familyGroupId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.accounts.all(familyGroupId),
    });
  }

  async function handleDelete() {
    if (!familyGroupId || !token || !deleting) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/accounts/${deleting.id}`,
        {
          token,
          method: "DELETE",
        },
      );
      toast.success(t.rekening.toastDeleted);
      await invalidate();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, t.rekening.toastDeleteFailed));
    } finally {
      setDeleting(null);
    }
  }

  function focusAccount(id: string) {
    setFocusIds(null);
    setFilters(EMPTY_FILTERS);
    setHighlightId(id);
    requestAnimationFrame(() =>
      document
        .getElementById(`rk-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    window.setTimeout(() => setHighlightId(null), 2400);
  }

  return (
    <div className="rk3">
      <div className="rk3-top">
        <RekeningHero
          rows={summaryRows}
          liquidity={liq}
          insuredShare={insured}
          uninsured={uninsured}
          interest={monthlyNetInterest(summaryRows)}
          filtered={isFiltered}
          onClearFilters={() => {
            setFilters(EMPTY_FILTERS);
            setFocusIds(null);
          }}
          bankCount={bankCount}
          usdTotal={usdTotal}
          loading={isLoading}
          error={isError}
          canManage={!!canManage}
          onAdd={() => setForm({ mode: "add", account: null })}
        />
        <AttentionCard
          items={attention}
          onFocusAccount={focusAccount}
          onFocusSet={(ids) => setFocusIds(ids.length > 0 ? ids : null)}
        />
      </div>

      {isError && (
        <div role="alert" className="rk3-error">
          <b>{t.rekening.errorPrefixLabel}</b>
          {t.rekening.errorLoadBody}
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 ? (
        <div className="rk3-empty">
          {c.page.emptyState}{" "}
          {canManage && (
            <button
              type="button"
              onClick={() => setForm({ mode: "add", account: null })}
            >
              {c.page.addAccount}
            </button>
          )}
        </div>
      ) : (
        <>
          <RekeningFilterPanel
            rows={rows}
            filters={filters}
            onChange={setFilters}
            resultCount={filtered.length}
            resultTotal={resultTotal}
            view={view}
            onView={setView}
            sort={sort}
            onSort={setSort}
            focusLabel={
              focusIds
                ? fill(c.page.accountsCount, { n: focusIds.length })
                : null
            }
            onClearFocus={() => setFocusIds(null)}
          />
          {groups.length === 0 && !isLoading ? (
            <div className="rk3-empty">{c.page.noResults}</div>
          ) : (
            <RekeningGroups
              groups={groups}
              view={view}
              exposures={exposures}
              rates={rates}
              lookFor={lookFor}
              myUserId={myUserId}
              canManage={!!canManage}
              isMasterLike={isMasterLike}
              grandTotal={liq.total}
              highlightId={highlightId}
              onEdit={(row) => setForm({ mode: "edit", account: row.account })}
              onDelete={(row) => setDeleting(row.account)}
              onCustomize={setCustomizing}
              onRequest={(row) => setRequesting(row.account)}
              onAddAtBank={(bank, country) =>
                setForm({
                  mode: "add",
                  account: null,
                  preset: { bank, country },
                })
              }
            />
          )}
        </>
      )}

      <AccountForm
        open={form}
        onClose={() => setForm(null)}
        onSaved={invalidate}
        members={members ?? []}
        accounts={bankAccounts}
        familyGroupId={familyGroupId ?? undefined}
        token={token}
        myUserId={myUserId}
        isMasterLike={isMasterLike}
      />
      <ConfirmDeleteDialog
        label={deleting ? `"${deleting.name}"` : null}
        title={t.rekening.deleteDialogTitle}
        body={t.rekening.deleteDialogBody}
        confirmLabel={t.rekening.deleteDialogConfirm}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
      <MintaDanaDialog
        source={requesting}
        targets={myAccounts}
        familyGroupId={familyGroupId ?? null}
        token={token}
        onClose={() => setRequesting(null)}
      />
      <CardSkinPanel
        preview={
          customizing
            ? {
                name:
                  customizing.account.productName || customizing.account.name,
                bank: customizing.bank?.short ?? customizing.bankName,
                number: customizing.account.maskedNumber ?? undefined,
                holder: customizing.holderLabel,
                balance: money.formatBalance(customizing.balance),
              }
            : null
        }
        look={
          customizing
            ? lookFor(customizing.account.id, customizing.account.type)
            : null
        }
        onChange={(look) =>
          customizing && setLook(customizing.account.id, look)
        }
        onReset={() => customizing && setLook(customizing.account.id, null)}
        onClose={() => setCustomizing(null)}
      />
      <div className="rk3-taxnote">
        <AccountTaxNotice />
      </div>
    </div>
  );
}
