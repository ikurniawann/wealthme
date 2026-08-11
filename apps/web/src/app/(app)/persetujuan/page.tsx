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

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";
import { SectionCard, StatusBadge } from "@/components/wm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  const pendingCount = (requests ?? []).filter(
    (r) => r.status === "pending",
  ).length;
  const riwayat = (requests ?? [])
    .filter((r) => r.status !== "pending")
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));

  return (
    <div className="space-y-3.5">
      <div className="text-[12.5px] text-muted-foreground">
        {t.persetujuan.pageDesc}
      </div>

      <div className="flex gap-1.5 rounded-lg border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`flex-1 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors ${
            tab === "pending"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          {t.persetujuan.tabPending}
          {pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setTab("riwayat")}
          className={`flex-1 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors ${
            tab === "riwayat"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
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
// EPIC-024 A5 — relocated here from akun/page.tsx unchanged in behavior).
export function AllowanceRequestsPanel({
  familyGroupId,
  token,
}: {
  familyGroupId: string | null;
  token: string | undefined;
}) {
  const { t } = useLocale();
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
        return (
          <div
            key={r.id}
            className="flex items-center gap-3 border-b py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">
                {isHeld
                  ? `${r.requesterName} · ${r.targetAccountName}`
                  : `${r.requesterName} → ${r.targetAccountName}`}
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {formatRupiah(Number(r.amount))}
                {isHeld
                  ? r.description
                    ? ` · ${r.description}`
                    : r.categoryName
                      ? ` · ${r.categoryName}`
                      : ""
                  : r.note
                    ? ` · ${r.note}`
                    : ""}
              </div>
            </div>
            <StatusBadge
              variant={isHeld ? "danger" : "warning"}
              className="text-[10px]"
            >
              {isHeld
                ? t.akun.family.allowanceRequestHeldBadge
                : t.akun.family.allowanceRequestPendingBadge}
            </StatusBadge>
            <button
              type="button"
              aria-label={t.akun.family.allowanceRequestApproveButton}
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-success-soft text-success"
              onClick={() => (isHeld ? handleApproveHeld(r) : setApproving(r))}
            >
              <Check className="size-4" />
            </button>
            <button
              type="button"
              aria-label={t.akun.family.allowanceRequestRejectButton}
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive"
              onClick={() => handleReject(r)}
            >
              <X className="size-4" />
            </button>
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
