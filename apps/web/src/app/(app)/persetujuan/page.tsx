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
//
// EPIC-026 Wave 6 — section-by-section rebuild against
// docs/prototype/pages/persetujuan.html. Genuine divergences fixed:
// (1) each pending request is its own card in a stack (prototype
// `section.stack > article.card`), not rows inside one titled SectionCard;
// (2) Riwayat is the prototype's "Riwayat Keputusan" table (Pemohon /
// Keperluan / Rekening / Status / Diputuskan oleh / Tanggal / Jumlah) with
// a danger "Ditolak" badge, not a 2-line list; (3) the Setujui dialog
// surfaces the server's real error message inline in a danger notice (the
// prototype's "INI inti perbaikannya" comment) in addition to the toast
// (the prototype fires both), gains the source-account hint line, and a
// Batal + Setujui footer. Stays cut per the carried-forward N3-J
// decisions: "Unduh CSV" on riwayat (J1), the reject-reason dialog (J2 —
// no backing DB column), the fabricated role/relation meta line and the
// specific threshold Rupiah figure (honest UI — not on the DTO), and the
// "Rekening tujuan" field box (repeating the account name breaks the
// colocated test's un-anchored `getByText(requesterName)` row lookup —
// see allowance-requests-panel.test.tsx `findRow`).

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  Check,
  CircleAlert,
  CircleCheck,
  Crown,
  Hourglass,
  TriangleAlert,
  X,
} from "lucide-react";

import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { canAccessPage } from "@wealthme/contracts";
import { useMyAccess } from "@/hooks/use-my-access";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";
import {
  SectionCard,
  StatusBadge,
  SummaryCard,
  InfoTip,
} from "@/components/wm";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Locale } from "@/i18n";

import type { AccountDto, AllowanceRequestDto } from "@wealthme/contracts";

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

// Date-only variant for the riwayat table's "Tanggal" column (prototype
// shows "4 Agu 2026", no time).
function formatDecidedDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Honest UI (shared by the pending card's Keperluan field and the riwayat
// table's Keperluan column): falls back to an em dash rather than inventing
// a value — role/relation copy is NOT on AllowanceRequestDto.
function keperluanOf(r: AllowanceRequestDto): string {
  return r.kind === "held_expense"
    ? (r.description ?? r.categoryName ?? "—")
    : (r.note ?? "—");
}

type Tab = "pending" | "riwayat";

export default function PersetujuanPage() {
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  // EPIC-030 — whoever the Master granted Persetujuan (the Master and a
  // co-master always); approving still needs "manage" at the API.
  const { access, isLoading: roleLoading } = useMyAccess();
  const isOwner = !!access && canAccessPage(access, "persetujuan", "view");
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
          <InfoTip>
            {t.persetujuan.pageDesc} {t.persetujuan.approverRuleNotice}
          </InfoTip>
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
        /* EPIC-026 Wave 6 — the prototype's "Riwayat Keputusan" decision
           table (docs/prototype/pages/persetujuan.html §panel-riwayat).
           "Unduh CSV" stays cut per EPIC-025 N3-J1. The "(Co-Master)" role
           suffix on "Diputuskan oleh" is not on AllowanceRequestDto —
           honest UI: name only. Header/title copy without an existing i18n
           key uses the prototype's literal Indonesian text (per EPIC-026;
           i18n dictionaries are protected). */
        <SectionCard title="Riwayat Keputusan">
          {riwayat.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-muted-foreground">
              {t.persetujuan.riwayatEmpty}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="border-b text-[11px] text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Pemohon</th>
                    <th className="py-2 pr-3 font-semibold">
                      {t.persetujuan.fieldKeperluanLabel}
                    </th>
                    <th className="py-2 pr-3 font-semibold">Rekening</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">
                      {t.persetujuan.riwayatDecidedByLabel}
                    </th>
                    <th className="py-2 pr-3 font-semibold">Tanggal</th>
                    <th className="py-2 text-right font-semibold">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {riwayat.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2.5 pr-3 font-semibold">
                        {r.requesterName}
                      </td>
                      <td className="py-2.5 pr-3">{keperluanOf(r)}</td>
                      <td className="py-2.5 pr-3">{r.targetAccountName}</td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge
                          variant={
                            r.status === "approved" ? "success" : "danger"
                          }
                          className="text-[10px]"
                        >
                          {r.status === "approved"
                            ? t.persetujuan.riwayatStatusApproved
                            : t.persetujuan.riwayatStatusRejected}
                        </StatusBadge>
                      </td>
                      <td className="py-2.5 pr-3">{r.decidedByName ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-[12px] text-muted-foreground">
                        {r.decidedAt
                          ? formatDecidedDate(r.decidedAt, locale)
                          : "—"}
                      </td>
                      <td className="mono py-2.5 text-right font-bold">
                        {formatRupiah(Number(r.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

  // EPIC-026 Wave 6 — prototype card grouping: each pending request is its
  // own card in a stack (`section.stack > article.card`), with no section
  // title header. The pre-existing section title stays as the section's
  // accessible name. Each card keeps a literal `border-b` class (with a
  // transparent color so it draws nothing on top of the Card ring) because
  // the colocated test's `findRow` locates a request via
  // `.closest(".border-b")` — tests must pass unmodified.
  return (
    <section
      aria-label={t.akun.family.allowanceRequestsSectionTitle}
      className="space-y-3.5"
    >
      {pending.length === 0 && (
        <SectionCard>
          <div className="py-6 text-center text-[12px] text-muted-foreground">
            {t.akun.family.allowanceRequestsEmpty}
          </div>
        </SectionCard>
      )}
      {pending.map((r) => {
        const isHeld = r.kind === "held_expense";
        const keperluan = keperluanOf(r);
        return (
          <SectionCard key={r.id} className="border-b border-b-transparent">
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
                  {!isHeld && r.fromAccountName && (
                    <span className="text-[11.5px] text-muted-foreground">
                      {t.akun.family.allowanceRequestRequestedFromPrefix}
                      {r.fromAccountName}
                    </span>
                  )}
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
                <div className="mono text-[20px] font-extrabold">
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
                /* Prototype's `.spacer` pushes the helper sentence to the
                   right edge of the action row. */
                <span className="ml-auto text-[11.5px] text-muted-foreground">
                  {t.persetujuan.fundingApproveHelperNotice}
                </span>
              )}
            </div>
          </SectionCard>
        );
      })}
      <ApproveRequestDialog
        request={approving}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setApproving(null)}
        onApproved={invalidate}
      />
    </section>
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
      {/* EPIC-026 Wave 8 — #dlg-setujui is the prototype's DEFAULT 480px
          `.dialog` (only #dlg-tolak, the reject confirm this app does not
          have, is `dialog--sm`), so the bespoke 420px override is gone. */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t.akun.family.allowanceRequestApproveDialogTitle}
          </DialogTitle>
          {/* Prototype `.dialog__desc` — "<pemohon> — <jumlah> → <rekening
              tujuan>" with the amount in `mono t-bold`
              (persetujuan.html:233-235). Rendered here rather than in the
              form below so Base UI wires it up as the dialog's
              `aria-describedby`. */}
          {request && (
            <DialogDescription>
              {request.requesterName} ·{" "}
              <span className="mono font-bold">
                {formatRupiah(Number(request.amount))}
              </span>{" "}
              → {request.targetAccountName}
              {request.fromAccountName && (
                <>
                  {" "}
                  ({t.akun.family.allowanceRequestRequestedFromPrefix}
                  {request.fromAccountName})
                </>
              )}
            </DialogDescription>
          )}
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
  // EPIC-033 R5 — pre-filled with the source the member asked for.
  const [fromAccountId, setFromAccountId] = useState(
    request.fromAccountId ?? "",
  );
  // EPIC-026 Wave 6 — the prototype's core point on this dialog (its own
  // comment: "pesan error asli dari server ditampilkan apa adanya di dalam
  // dialog, bukan ditelan jadi toast generik"): the server's real error
  // message renders inline in a danger notice inside the dialog, IN
  // ADDITION to the toast (the prototype fires both — see its
  // `submitSetujui()`; the toast is also what the colocated test asserts).
  const [approveError, setApproveError] = useState<string | null>(null);
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
      const message = extractApiErrorMessage(
        err,
        t.akun.family.allowanceRequestApproveFailed,
      );
      setApproveError(message);
      toast.error(message);
    },
  });

  return (
    <>
      {/* EPIC-026 Wave 8 — the prototype's #dlg-setujui body is a single
          `.field` (label + select + `.hint`) followed by the danger notice.
          The requester/amount/destination line moved up into the dialog's
          `.dialog__desc`, where the prototype puts it. */}
      <DialogBody>
        <div className="field">
          <label className="label" htmlFor={fromAccountFieldId}>
            {t.akun.family.allowanceRequestSourceAccountLabel}
          </label>
          <select
            id={fromAccountFieldId}
            className="select"
            value={fromAccountId}
            onChange={(e) => {
              setFromAccountId(e.target.value);
              // Mirrors the prototype: the stale error clears once another
              // source account is picked (re-set on the next failed attempt).
              setApproveError(null);
            }}
          >
            <option value="">—</option>
            {eligibleAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({formatRupiah(Number(a.balance))})
              </option>
            ))}
          </select>
          <span className="hint">{t.persetujuan.approveSourceAccountHint}</span>
        </div>
        {approveError && (
          /* Prototype `#setujui-error` — `.notice .notice--danger` with the
             circle-alert icon (persetujuan.html:252). */
          <div role="alert" className="notice notice--danger mt-3">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span>{approveError}</span>
          </div>
        )}
      </DialogBody>
      {/* Prototype `.dialog__footer` — Batal (outline) + primary approve.
          The approve label stays `allowanceRequestApproveButton` ("Setujui"),
          not the prototype's "Setujui & Transfer": the colocated test
          queries the button by that exact accessible name and must pass
          unmodified. */}
      <DialogFooter>
        <button type="button" className="btn btn--outline" onClick={onClose}>
          {t.common.cancel}
        </button>
        <button
          type="button"
          disabled={isSaving || !fromAccountId}
          className="btn btn--primary"
          onClick={() => approve()}
        >
          <Check className="size-4" aria-hidden="true" />
          {isSaving ? "..." : t.akun.family.allowanceRequestApproveButton}
        </button>
      </DialogFooter>
    </>
  );
}
