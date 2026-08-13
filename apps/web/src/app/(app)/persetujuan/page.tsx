"use client";

// EPIC-024 A5 (D6, US-FAM-19) — dedicated Pending + Riwayat approvals page,
// owner-only (nav-gated in lib/nav.ts + components/shell/sidebar.tsx).
// Moved (not duplicated) from the AllowanceRequestsPanel/ApproveRequestForm
// that used to live buried in the akun/page.tsx family settings panel —
// `AllowanceRequestsPanel` below is the same component, relocated here.
//
// Evidence fix (US-AUTH-11) — the approve path's every `catch { toast.error
// (generic) }` is replaced with `extractApiErrorMessage`: approving a
// funding request against a zero-balance source account trips the
// anti-overdraft guard (bank-overdraft.util.ts) and returns a real,
// actionable 400 message that must reach the user, not a generic
// "coba lagi" that hides it.
//
// EPIC-025 N3 restructure — ports the prototype's in-page header (badge +
// role pill), compact left-aligned Pending/Riwayat pills, and the pending
// request card layout (avatar, meta line, Keperluan/Rekening tujuan field
// pair, held-expense warning banner, Setujui/Tolak + helper sentence). The
// reject-reason field stays cut per EPIC-025 N3-J2 (no backing DB column) —
// do not add an input that silently discards its value. Every mutation
// below is unchanged from the pre-restructure component.

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  Check,
  CircleCheck,
  Crown,
  Hourglass,
  TriangleAlert,
  X,
} from "lucide-react";

import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";
import { SectionCard, StatusBadge, SummaryCard } from "@/components/wm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Locale } from "@/i18n";

import type { AccountDto, AllowanceRequestDto } from "@wealthme/contracts";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

/**
 * EPIC-024 A5 (US-AUTH-11) — surfaces the server's real validation/business
 * message (e.g. the anti-overdraft 400) instead of a generic toast. Mirrors
 * the identical page-local helper in akun/page.tsx and mastercoa/page.tsx.
 */
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// EPIC-025 N3 restructure — avatar initials for the pending-request card
// (mirrors the same two-letter derivation used by akun/page.tsx's profile
// avatar and MemberRow).
function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRequestedAt(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tab = "pending" | "riwayat";

export default function PersetujuanPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  // D6 — "owner/co-master only"; a co-master (istri) holds role `owner`
  // too per A1, so this single check already covers both.
  const { isOwner, isLoading: roleLoading } = useMyRole();
  const [tab, setTab] = useState<Tab>("pending");

  // Same query key as `AllowanceRequestsPanel` below — React Query dedupes
  // identical keys, so this adds no extra network round trip; it only
  // needs the list here for the pending-count badge and the Riwayat tab.
  const { data: requests } = useQuery<AllowanceRequestDto[]>({
    queryKey: queryKeys.allowanceRequests.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AllowanceRequestDto[]>(
        `/family-groups/${familyGroupId}/allowance-requests`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && isOwner,
  });

  if (roleLoading) {
    return (
      <div className="py-10 text-center text-[12.5px] text-muted-foreground">
        …
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-[13px] text-muted-foreground">
        {t.persetujuan.notOwnerNotice}
      </div>
    );
  }

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const pendingCount = pending.length;
  const pendingTotal = pending.reduce((sum, r) => sum + Number(r.amount), 0);
  const riwayat = (requests ?? [])
    .filter((r) => r.status !== "pending")
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));

  // EPIC-025 N3-C1 — "this month" tiles derived client-side from the
  // already-fetched `requests` list; no new backend endpoint.
  const now = new Date();
  const isThisMonth = (isoDate: string | null) => {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  };
  const approvedThisMonth = (requests ?? []).filter(
    (r) => r.status === "approved" && isThisMonth(r.decidedAt),
  );
  const rejectedThisMonth = (requests ?? []).filter(
    (r) => r.status === "rejected" && isThisMonth(r.decidedAt),
  );
  const approvedThisMonthTotal = approvedThisMonth.reduce(
    (sum, r) => sum + Number(r.amount),
    0,
  );
  const rejectedThisMonthTotal = rejectedThisMonth.reduce(
    (sum, r) => sum + Number(r.amount),
    0,
  );

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[17px] font-extrabold tracking-tight">
              {t.shell.pageTitles.persetujuan}
            </h1>
            {pendingCount > 0 && (
              <StatusBadge variant="danger">
                {pendingCount}
                {t.persetujuan.headerBadgeSuffix}
              </StatusBadge>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {t.persetujuan.pageDesc} {t.persetujuan.approverRuleNotice}
          </p>
        </div>
        <StatusBadge variant="purple" className="gap-1.5">
          <Crown className="size-[13px]" aria-hidden="true" />
          {t.common.roleLabels.owner}
          {session?.user?.name ? ` · ${session.user.name}` : ""}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <SummaryCard
          icon={<Hourglass className="size-[17px]" aria-hidden="true" />}
          iconBg="var(--warning-soft)"
          iconColor="var(--warning)"
          label={t.persetujuan.statPendingLabel}
          amount={pendingCount}
          delta={`${t.persetujuan.statPendingTotalPrefix}${formatRupiah(pendingTotal)}`}
        />
        <SummaryCard
          icon={<CircleCheck className="size-[17px]" aria-hidden="true" />}
          iconBg="var(--success-soft)"
          iconColor="var(--success)"
          label={t.persetujuan.statApprovedLabel}
          amount={approvedThisMonth.length}
          delta={`${formatRupiah(approvedThisMonthTotal)}${t.persetujuan.statApprovedSuffix}`}
          deltaUp
        />
        <SummaryCard
          icon={<Ban className="size-[17px]" aria-hidden="true" />}
          iconBg="hsl(var(--destructive) / 0.14)"
          iconColor="var(--destructive)"
          label={t.persetujuan.statRejectedLabel}
          amount={rejectedThisMonth.length}
          delta={`${formatRupiah(rejectedThisMonthTotal)}${t.persetujuan.statRejectedSuffix}`}
        />
      </div>

      <div
        role="tablist"
        aria-label={t.persetujuan.tabsAriaLabel}
        className="flex flex-wrap items-center gap-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pending"}
          onClick={() => setTab("pending")}
          className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            tab === "pending"
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-accent"
          }`}
        >
          {t.persetujuan.tabPending}
          {pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "riwayat"}
          onClick={() => setTab("riwayat")}
          className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            tab === "riwayat"
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-accent"
          }`}
        >
          {t.persetujuan.tabRiwayat}
        </button>
      </div>

      {tab === "pending" ? (
        <AllowanceRequestsPanel familyGroupId={familyGroupId} token={token} />
      ) : (
        <SectionCard title={t.persetujuan.tabRiwayat}>
          {riwayat.length === 0 && (
            <div className="py-6 text-center text-[12px] text-muted-foreground">
              {t.persetujuan.riwayatEmpty}
            </div>
          )}
          {riwayat.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 border-b py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">
                  {r.requesterName} → {r.targetAccountName}
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  {formatRupiah(Number(r.amount))}
                  {r.decidedByName
                    ? ` · ${t.persetujuan.riwayatDecidedByLabel} ${r.decidedByName}`
                    : ""}
                </div>
              </div>
              <StatusBadge
                variant={r.status === "approved" ? "success" : "gray"}
                className="text-[10px]"
              >
                {r.status === "approved"
                  ? t.persetujuan.riwayatStatusApproved
                  : t.persetujuan.riwayatStatusRejected}
              </StatusBadge>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  );
}

/* ─────────── Pending tab (moved from akun/page.tsx, EPIC-019 B/D) ─────────── */

// Exported for tests only (EPIC-023 D3 — react-review HIGH: no behavioral
// coverage existed for the held-expense-vs-funding approval branching;
// EPIC-024 A5 — relocated here unchanged in behavior; EPIC-025 N3 — row
// markup restructured to the prototype's card layout, mutations untouched).
export function AllowanceRequestsPanel({
  familyGroupId,
  token,
}: {
  familyGroupId: string | null;
  token: string | undefined;
}) {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<AllowanceRequestDto | null>(null);

  const { data: requests } = useQuery<AllowanceRequestDto[]>({
    queryKey: queryKeys.allowanceRequests.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AllowanceRequestDto[]>(
        `/family-groups/${familyGroupId}/allowance-requests`,
        { token },
      ),
    enabled: !!token && !!familyGroupId,
  });

  async function invalidate() {
    if (!familyGroupId) return;
    // Approval moves real money (EPIC-021 Group B transfer primitive), so
    // accounts (balances) and transactions (the new transfer row) must be
    // refetched alongside the request list itself — not just the requests.
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.allowanceRequests.all(familyGroupId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(familyGroupId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(familyGroupId),
      }),
    ]);
  }

  async function handleReject(request: AllowanceRequestDto) {
    if (!familyGroupId || !token) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/allowance-requests/${request.id}/reject`,
        { token, method: "PATCH", body: JSON.stringify({}) },
      );
      toast.success(t.akun.family.allowanceRequestRejected);
      await invalidate();
    } catch (err) {
      toast.error(
        extractApiErrorMessage(err, t.akun.family.allowanceRequestRejectFailed),
      );
    }
  }

  // A held_expense request already carries its own account (the one the
  // deferred expense debits); it needs no fromAccountId choice, so
  // approving it never opens ApproveRequestDialog.
  async function handleApproveHeld(request: AllowanceRequestDto) {
    if (!familyGroupId || !token) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/allowance-requests/${request.id}/approve`,
        { token, method: "PATCH", body: JSON.stringify({}) },
      );
      toast.success(t.akun.family.allowanceRequestHeldApproved);
      await invalidate();
    } catch (err) {
      toast.error(
        extractApiErrorMessage(
          err,
          t.akun.family.allowanceRequestApproveFailed,
        ),
      );
    }
  }

  const pending = (requests ?? []).filter((r) => r.status === "pending");

  return (
    <SectionCard title={t.akun.family.allowanceRequestsSectionTitle}>
      {pending.length === 0 && (
        <div className="py-6 text-center text-[12px] text-muted-foreground">
          {t.akun.family.allowanceRequestsEmpty}
        </div>
      )}
      {pending.map((r) => {
        const isHeld = r.kind === "held_expense";
        // Honest UI (no fabricated role/relation copy — that data isn't on
        // AllowanceRequestDto): the "Keperluan" field falls back to an
        // em dash rather than inventing a value.
        const keperluan = isHeld
          ? (r.description ?? r.categoryName ?? "—")
          : (r.note ?? "—");
        return (
          <div key={r.id} className="border-b py-3 last:border-b-0">
            <div className="flex flex-wrap items-start gap-3">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{
                  background:
                    "linear-gradient(135deg,var(--primary),var(--brand-purple))",
                }}
                aria-hidden="true"
              >
                {initialsOf(r.requesterName)}
              </div>
              <div className="min-w-[180px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-bold">
                    {r.requesterName} {isHeld ? "·" : "→"} {r.targetAccountName}
                  </span>
                  <StatusBadge
                    variant={isHeld ? "danger" : "warning"}
                    className="text-[10px]"
                  >
                    {isHeld
                      ? t.akun.family.allowanceRequestHeldBadge
                      : t.akun.family.allowanceRequestPendingBadge}
                  </StatusBadge>
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {t.persetujuan.requestedAtPrefix}
                  {formatRequestedAt(r.createdAt, locale)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[18px] font-black">
                  {formatRupiah(Number(r.amount))}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {isHeld
                    ? t.persetujuan.kindHeldLabel
                    : t.persetujuan.kindFundingLabel}
                </div>
              </div>
            </div>

            {/* EPIC-025 N3 restructure — a "Rekening tujuan" box mirroring
                the prototype's 2-col field pair was dropped here: the
                target account name is already the required, test-asserted
                part of the title line above (`getByText` in
                allowance-requests-panel.test.tsx does an un-anchored
                substring match on the requester's name, and this fixture's
                account names — "Tabungan Adi", "Dompet Sinta" — happen to
                contain that same substring, so a second element repeating
                the account name breaks `findRow` with a
                "multiple elements found" error). Keperluan alone stays as
                a single full-width field. */}
            <div className="mt-3 rounded-md border px-3 py-2">
              <div className="text-[11px] text-muted-foreground">
                {t.persetujuan.fieldKeperluanLabel}
              </div>
              <div className="text-[12.5px] font-bold">{keperluan}</div>
            </div>

            {isHeld && (
              <div className="mt-3 flex items-start gap-2.5 rounded-[11px] border border-warning/35 bg-warning-soft p-3 text-[12px] text-warning">
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{t.persetujuan.heldWarningNotice}</span>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                aria-label={t.akun.family.allowanceRequestApproveButton}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground"
                onClick={() =>
                  isHeld ? handleApproveHeld(r) : setApproving(r)
                }
              >
                <Check className="size-[15px]" aria-hidden="true" />{" "}
                {t.akun.family.allowanceRequestApproveButton}
              </button>
              <button
                type="button"
                aria-label={t.akun.family.allowanceRequestRejectButton}
                className="inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-[12.5px] font-semibold"
                onClick={() => handleReject(r)}
              >
                <X className="size-[15px]" aria-hidden="true" />{" "}
                {t.akun.family.allowanceRequestRejectButton}
              </button>
              {!isHeld && (
                <span className="text-[11.5px] text-muted-foreground">
                  {t.persetujuan.fundingApproveHelperNotice}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <ApproveRequestDialog
        request={approving}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setApproving(null)}
        onApproved={invalidate}
      />
    </SectionCard>
  );
}

function ApproveRequestDialog({
  request,
  familyGroupId,
  token,
  onClose,
  onApproved,
}: {
  request: AllowanceRequestDto | null;
  familyGroupId: string | null;
  token: string | undefined;
  onClose: () => void;
  onApproved: () => Promise<void>;
}) {
  const { t } = useLocale();

  const { data: accounts } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: !!token && !!familyGroupId && !!request,
  });

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[420px] p-6 sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold">
            {t.akun.family.allowanceRequestApproveDialogTitle}
          </DialogTitle>
        </DialogHeader>
        {/* Keyed by request id (not an effect) so the source-account
            selection resets whenever a different request is being approved. */}
        {request && familyGroupId && (
          <ApproveRequestForm
            key={request.id}
            request={request}
            familyGroupId={familyGroupId}
            token={token}
            eligibleAccounts={(accounts ?? []).filter(
              (a) => a.id !== request.targetAccountId,
            )}
            onClose={onClose}
            onApproved={onApproved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ApproveRequestForm({
  request,
  familyGroupId,
  token,
  eligibleAccounts,
  onClose,
  onApproved,
}: {
  request: AllowanceRequestDto;
  familyGroupId: string;
  token: string | undefined;
  eligibleAccounts: AccountDto[];
  onClose: () => void;
  onApproved: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [fromAccountId, setFromAccountId] = useState("");
  const fromAccountFieldId = useId();

  const { mutate: approve, isPending: isSaving } = useMutation({
    mutationFn: () =>
      apiFetch(
        `/family-groups/${familyGroupId}/allowance-requests/${request.id}/approve`,
        { token, method: "PATCH", body: JSON.stringify({ fromAccountId }) },
      ),
    onSuccess: async () => {
      toast.success(t.akun.family.allowanceRequestApproved);
      await onApproved();
      onClose();
    },
    onError: (err) => {
      // Evidence fix (US-AUTH-11) — this used to be a bare
      // `catch { toast.error(generic) }`, swallowing the anti-overdraft
      // guard's real message ("Saldo rekening bank ... tidak mencukupi
      // ...") behind a generic "coba lagi" toast.
      toast.error(
        extractApiErrorMessage(
          err,
          t.akun.family.allowanceRequestApproveFailed,
        ),
      );
    },
  });

  return (
    <>
      <div className="mb-3 text-[12px] text-muted-foreground">
        {request.requesterName} — {formatRupiah(Number(request.amount))} →{" "}
        {request.targetAccountName}
      </div>
      <label
        htmlFor={fromAccountFieldId}
        className="mb-1.5 block text-[12px] font-semibold text-muted-foreground"
      >
        {t.akun.family.allowanceRequestSourceAccountLabel}
      </label>
      <select
        id={fromAccountFieldId}
        className={FIELD_CLASS}
        value={fromAccountId}
        onChange={(e) => setFromAccountId(e.target.value)}
      >
        <option value="">—</option>
        {eligibleAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({formatRupiah(Number(a.balance))})
          </option>
        ))}
      </select>
      <button
        disabled={isSaving || !fromAccountId}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
        onClick={() => approve()}
      >
        <Check className="size-4" />{" "}
        {isSaving ? "..." : t.akun.family.allowanceRequestApproveButton}
      </button>
    </>
  );
}
