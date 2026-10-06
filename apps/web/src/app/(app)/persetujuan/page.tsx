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
import { Check, CircleAlert, TriangleAlert, X } from "lucide-react";

import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { canAccessPage } from "@wealthme/contracts";
import { useMyAccess } from "@/hooks/use-my-access";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useMoney } from "@/hooks/use-money";
import {
  BentoCard,
  BentoGrid,
  BentoHero,
  GhostButton,
  HeroKpi,
  MiniList,
  MiniRow,
  PillButton,
  Segmented,
  SectionCard,
  StatusBadge,
  TipsCard,
} from "@/components/wm";
import "./persetujuan.css";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogClose,
  PanelContent,
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
  const money = useMoney();
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

  const v2 = t.persetujuan.v2;
  const decidedMax = Math.max(
    approvedThisMonth.length,
    rejectedThisMonth.length,
    1,
  );
  const sidePending = pending.slice(0, 5);

  return (
    <BentoGrid className="ps-grid">
      <BentoHero
        className="ps-hero"
        currency={null}
        value={money.format(pendingTotal)}
        caption={v2.heroCap}
        controls={
          <span className="ps-chip">
            {pendingCount} {v2.chip}
          </span>
        }
        chart={
          approvedThisMonth.length + rejectedThisMonth.length === 0 ? (
            <p className="ps-empty">{v2.chartEmpty}</p>
          ) : (
            <div className="ps-bars" role="group" aria-label={v2.chartTitle}>
              <div className="ps-bar">
                <span>{t.persetujuan.riwayatStatusApproved}</span>
                <i
                  data-tone="good"
                  style={{
                    width: `${(approvedThisMonth.length / decidedMax) * 100}%`,
                  }}
                />
                <b>{approvedThisMonth.length}</b>
              </div>
              <div className="ps-bar">
                <span>{t.persetujuan.riwayatStatusRejected}</span>
                <i
                  data-tone="bad"
                  style={{
                    width: `${(rejectedThisMonth.length / decidedMax) * 100}%`,
                  }}
                />
                <b>{rejectedThisMonth.length}</b>
              </div>
            </div>
          )
        }
        kpis={
          <>
            <HeroKpi label={v2.kpiPending} value={String(pendingCount)} />
            <HeroKpi
              label={v2.kpiApproved}
              value={String(approvedThisMonth.length)}
              short={money.format(approvedThisMonthTotal)}
            />
            <HeroKpi
              label={v2.kpiRejected}
              value={String(rejectedThisMonth.length)}
              short={money.format(rejectedThisMonthTotal)}
            />
          </>
        }
      />

      <BentoCard
        className="ps-side"
        title={v2.sideTitle}
        caption={
          pendingCount > 0
            ? `${v2.sideCaption}: ${money.format(pendingTotal / pendingCount)}`
            : undefined
        }
      >
        {sidePending.length === 0 ? (
          <p className="ps-empty">{v2.sideEmpty}</p>
        ) : (
          <MiniList label={v2.sideTitle}>
            {sidePending.map((r) => (
              <MiniRow
                key={r.id}
                icon={initialsOf(r.requesterName)}
                title={r.requesterName}
                meta={keperluanOf(r)}
                amount={money.format(Number(r.amount))}
              />
            ))}
          </MiniList>
        )}
        <GhostButton onClick={() => setTab("riwayat")}>
          {v2.seeHistory}
        </GhostButton>
      </BentoCard>

      <BentoCard
        className="ps-main"
        title={tab === "pending" ? v2.mainTitle : v2.riwayatTitle}
        action={
          <Segmented
            label={t.persetujuan.tabsAriaLabel}
            value={tab}
            onChange={setTab}
            options={[
              {
                value: "pending",
                label: `${t.persetujuan.tabPending}${pendingCount > 0 ? ` (${pendingCount})` : ""}`,
              },
              { value: "riwayat", label: t.persetujuan.tabRiwayat },
            ]}
          />
        }
      >
        {tab === "pending" ? (
          <AllowanceRequestsPanel familyGroupId={familyGroupId} token={token} />
        ) : riwayat.length === 0 ? (
          <p className="ps-empty">{t.persetujuan.riwayatEmpty}</p>
        ) : (
          <div className="ps-tbl-wrap">
            <table className="ps-tbl">
              <thead>
                <tr>
                  <th>{v2.colRequester}</th>
                  <th>{t.persetujuan.fieldKeperluanLabel}</th>
                  <th>{v2.colAccount}</th>
                  <th>{v2.colStatus}</th>
                  <th>{t.persetujuan.riwayatDecidedByLabel}</th>
                  <th>{v2.colDate}</th>
                  <th className="ps-num">{v2.colAmount}</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.requesterName}</b>
                    </td>
                    <td>{keperluanOf(r)}</td>
                    <td>{r.targetAccountName}</td>
                    <td>
                      <StatusBadge
                        variant={r.status === "approved" ? "success" : "danger"}
                      >
                        {r.status === "approved"
                          ? t.persetujuan.riwayatStatusApproved
                          : t.persetujuan.riwayatStatusRejected}
                      </StatusBadge>
                    </td>
                    <td>{r.decidedByName ?? "—"}</td>
                    <td>
                      {r.decidedAt
                        ? formatDecidedDate(r.decidedAt, locale)
                        : "—"}
                    </td>
                    <td className="ps-num">{money.format(Number(r.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>

      <TipsCard
        className="ps-tips"
        title={v2.tipsTitle}
        mosaic={[
          "a",
          "b",
          "",
          "c",
          "",
          "a",
          "",
          "b",
          "o",
          "",
          "a",
          "",
          "c",
          "",
          "b",
          "",
          "a",
          "",
        ]}
      >
        {v2.tipsBody}
      </TipsCard>
    </BentoGrid>
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
  const money = useMoney();
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
                  {money.format(Number(r.amount))}
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
  const money = useMoney();

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
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {t.akun.family.allowanceRequestApproveDialogTitle}
            </DialogTitle>
            {/* Prototype `.dialog__desc` — "<pemohon> — <jumlah> → <rekening
              tujuan>" with the amount in `mono t-bold`
              (persetujuan.html:233-235). Rendered here rather than in the
              form below so Base UI wires it up as the dialog's
              `aria-describedby`. */}
            {request && (
              <DialogDescription className="wm-panel-desc">
                {request.requesterName} ·{" "}
                <span className="mono font-bold">
                  {money.format(Number(request.amount))}
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
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
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
      </PanelContent>
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
  const money = useMoney();
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* EPIC-026 Wave 8 — the prototype's #dlg-setujui body is a single
          `.field` (label + select + `.hint`) followed by the danger notice.
          The requester/amount/destination line moved up into the dialog's
          `.dialog__desc`, where the prototype puts it. */}
      <div className="wm-panel-body wm-form">
        <div className="wm-form__grid">
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
                  {a.name} ({money.format(Number(a.balance))})
                </option>
              ))}
            </select>
            <span className="hint">
              {t.persetujuan.approveSourceAccountHint}
            </span>
          </div>
          {approveError && (
            /* Prototype `#setujui-error` — `.notice .notice--danger` with the
             circle-alert icon (persetujuan.html:252). */
            <div role="alert" className="notice notice--danger mt-3">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              <span>{approveError}</span>
            </div>
          )}
        </div>
      </div>
      {/* Prototype `.dialog__footer` — Batal (outline) + primary approve.
          The approve label stays `allowanceRequestApproveButton` ("Setujui"),
          not the prototype's "Setujui & Transfer": the colocated test
          queries the button by that exact accessible name and must pass
          unmodified. */}
      <div className="wm-panel-foot">
        <PillButton type="button" onClick={onClose}>
          {t.common.cancel}
        </PillButton>
        <PillButton
          type="button"
          variant="primary"
          disabled={isSaving || !fromAccountId}
          onClick={() => approve()}
        >
          <Check className="size-4" aria-hidden="true" />
          {isSaving ? "..." : t.akun.family.allowanceRequestApproveButton}
        </PillButton>
      </div>
    </div>
  );
}
