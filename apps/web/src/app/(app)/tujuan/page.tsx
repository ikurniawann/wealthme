"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  GraduationCap,
  CircleCheck,
  Gauge,
  TriangleAlert,
  PiggyBank,
  Target,
  Wallet,
} from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { useApiError } from "@/hooks/use-api-error";
import { useCanManage } from "@/hooks/use-role-permissions";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { parseGoalFormValues } from "@/lib/goals-utils";
import {
  StatusBadge,
  AnimatedProgress,
  IconChip,
  CountUpRupiah,
  Rise,
} from "@/components/wm";
import { Button } from "@/components/ui/button";
import { CrudModal, ConfirmDeleteDialog } from "@/components/crud";
import type { CrudModalState, CrudMode } from "@/components/crud";

import {
  ContributeDialog,
  type SourceAccountOption,
} from "./_components/contribute-dialog";
import { ContributionHistory } from "./_components/contribution-history";

import type { GoalDto, GoalStatus } from "@wealthme/contracts";

function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />
  );
}

type BadgeVariant = "success" | "info" | "warning" | "purple";

function statusToBadge(
  status: GoalStatus,
  t: ReturnType<typeof useLocale>["t"],
): {
  label: string;
  variant: BadgeVariant;
  color: string;
  stripColor: string;
  iconBg: string;
} {
  switch (status) {
    case "achieved":
      return {
        label: t.tujuan.statusLabels.achieved,
        variant: "success",
        color: "var(--success)",
        stripColor: "var(--success)",
        iconBg: "#DCFCE7",
      };
    case "on_track":
      return {
        label: t.tujuan.statusLabels.on_track,
        variant: "info",
        color: "var(--primary)",
        stripColor: "var(--primary)",
        iconBg: "#DBEAFE",
      };
    case "needs_boost":
      return {
        label: t.tujuan.statusLabels.needs_boost,
        variant: "warning",
        color: "var(--warning)",
        stripColor: "var(--warning)",
        iconBg: "#FEF9C3",
      };
    case "at_risk":
      return {
        label: t.tujuan.statusLabels.at_risk,
        variant: "purple",
        color: "var(--brand-purple)",
        stripColor: "var(--brand-purple)",
        iconBg: "#EDE9FE",
      };
  }
}

function formatTargetDate(
  iso: string | null,
  t: ReturnType<typeof useLocale>["t"],
  locale: Locale,
): string {
  if (!iso) return t.tujuan.noTargetDate;
  const d = new Date(iso);
  return (
    t.tujuan.targetDatePrefix +
    d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
      month: "long",
      year: "numeric",
    })
  );
}

// EPIC-025 N3 restructure — how many whole months remain until `targetDate`
// (floored at 1 so an imminent/past-due date never divides by zero or goes
// negative), used to derive the "perlu menabung Rp X / bulan selama N
// bulan" notice from data already on `GoalDto` — no new endpoint.
function monthsUntilTarget(targetDate: string): number {
  const target = new Date(targetDate);
  const now = new Date();
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(months, 1);
}

// Returns null when the monthly figure can't be honestly computed (no
// target date) or isn't needed (goal already fully funded) — the caller
// omits the notice entirely rather than showing a fabricated number.
function monthlyNeededFor(goal: GoalDto): number | null {
  if (!goal.targetDate || goal.remainingAmount <= 0) return null;
  return Math.ceil(goal.remainingAmount / monthsUntilTarget(goal.targetDate));
}

function GoalCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border bg-card">
      <div className="h-[3px] bg-muted" />
      <div className="p-[18px]">
        <div className="mb-3 flex items-center gap-2.5">
          <Bone className="size-[40px] rounded-[11px]" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-24" />
          </div>
          <Bone className="h-5 w-16 rounded-full" />
        </div>
        <Bone className="mb-1.5 h-8 w-16" />
        <Bone className="h-[9px] w-full rounded-full" />
        <div className="mt-2.5 flex justify-between">
          <Bone className="h-3 w-28" />
          <Bone className="h-3 w-24" />
        </div>
        <div className="mt-3 flex justify-between border-t pt-3">
          <Bone className="h-3 w-24" />
          <Bone className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

interface GoalCardProps {
  goal: GoalDto;
  onEdit: (goal: GoalDto) => void;
  onDelete: (goal: GoalDto) => void;
  onContribute: (goal: GoalDto) => void;
  canManage: boolean;
  familyGroupId: string;
  token: string | undefined;
}

function isEducationGoal(goal: GoalDto): boolean {
  const name = goal.name?.toLowerCase() ?? "";
  return name.includes("pendidikan") || name.includes("education");
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onContribute,
  canManage,
  familyGroupId,
  token,
}: GoalCardProps) {
  const { t, locale } = useLocale();
  const [showHistory, setShowHistory] = useState(false);
  const { label, variant, color, stripColor, iconBg } = statusToBadge(
    goal.status,
    t,
  );
  const icon = goal.icon ?? "🎯";
  const useEducationChip = isEducationGoal(goal);
  const hasAutoDebit = goal.autoDebitAmount != null;
  const monthlyNeeded = monthlyNeededFor(goal);
  const noticeVariant = !hasAutoDebit
    ? "danger"
    : goal.status === "needs_boost"
      ? "warning"
      : goal.status === "at_risk"
        ? "danger"
        : "info";
  const noticeClass =
    noticeVariant === "danger"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : noticeVariant === "warning"
        ? "border-warning/35 bg-warning-soft text-warning"
        : "border-primary/25 bg-accent text-accent-foreground";

  return (
    <div className="overflow-hidden rounded-[14px] border bg-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
      <div className="h-[3px]" style={{ background: stripColor }} />
      <div className="p-[18px]">
        <div className="mb-3 flex items-center gap-2.5">
          {useEducationChip ? (
            <IconChip
              icon={GraduationCap}
              className="bg-blue-100 text-blue-600"
              size={40}
              rounded="rounded-[11px]"
            />
          ) : (
            <div
              className="flex size-[40px] shrink-0 items-center justify-center rounded-[11px] text-[18px]"
              style={{ background: iconBg }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <span className="text-[14px] font-bold">{goal.name}</span>{" "}
            <span className="text-[11.5px] text-muted-foreground">
              {formatTargetDate(goal.targetDate, t, locale)}
            </span>
          </div>
          <StatusBadge variant={variant} className="ml-auto">
            {label}
          </StatusBadge>
        </div>

        <div className="mb-1.5 text-[26px] font-black" style={{ color }}>
          {goal.progressPercent}%
        </div>
        <AnimatedProgress
          value={goal.progressPercent}
          color={color}
          height={9}
        />

        <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-muted-foreground">
          <span>
            {formatRupiah(goal.currentAmount)}
            {t.tujuan.collectedSuffix}
          </span>
          <span>
            {t.tujuan.targetPrefix}
            {formatRupiah(goal.targetAmount)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-[12px] font-semibold">
          <span>
            {t.tujuan.remainingPrefix}
            {formatRupiah(goal.remainingAmount)}
          </span>
          {goal.autoDebitAmount != null ? (
            <span className="text-muted-foreground">
              {t.tujuan.autoDebitPrefix}
              {formatRupiah(goal.autoDebitAmount)}
              {t.tujuan.autoDebitSuffix}
              {goal.autoDebitDay != null
                ? ` · ${t.tujuan.autoDebitDayPrefix}${goal.autoDebitDay}`
                : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t.tujuan.noAutoDebit}
            </span>
          )}
        </div>

        {monthlyNeeded != null && (
          <div
            className={`mt-2.5 flex items-start gap-2 rounded-[11px] border p-2.5 text-[11.5px] ${noticeClass}`}
          >
            <PiggyBank
              className="mt-0.5 size-[15px] shrink-0"
              aria-hidden="true"
            />
            <span>
              {t.tujuan.noticeSavingsPrefix}
              <strong className="font-[family-name:var(--font-mono)]">
                {formatRupiah(monthlyNeeded)}
              </strong>
              {hasAutoDebit
                ? `${t.tujuan.noticeSavingsPerMonthMiddle}${monthsUntilTarget(goal.targetDate as string)}${t.tujuan.noticeSavingsMonthsSuffix}`
                : t.tujuan.noticeSavingsNoAutoDebitSuffix}
            </span>
          </div>
        )}

        {/* F3 — CASL grants "manage Goal" only to owner/spouse/member;
            admin_staff/dependant/operational get 403 on edit/delete. */}
        {canManage && (
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onContribute(goal)}
              aria-label={`${t.tujuan.contributeButtonAriaPrefix}${goal.name}`}
              className="flex items-center justify-center gap-1.5 rounded-[7px] border border-primary/30 bg-accent px-3 py-[7px] text-[11px] font-semibold text-primary transition-colors hover:bg-accent/70"
            >
              <Wallet className="size-[13px]" aria-hidden="true" />{" "}
              {t.tujuan.contributeButton}
            </button>
            <button
              onClick={() => onEdit(goal)}
              className="flex items-center justify-center gap-1.5 rounded-[7px] border px-3 py-[7px] text-[11px] font-semibold transition-colors hover:bg-accent"
            >
              <Pencil className="size-[13px]" /> {t.tujuan.editButton}
            </button>
            <button
              onClick={() => onDelete(goal)}
              className="flex items-center justify-center gap-1.5 rounded-[7px] border px-3 py-[7px] text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/5"
            >
              <Trash2 className="size-[13px]" /> {t.tujuan.deleteButton}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowHistory((open) => !open)}
          aria-expanded={showHistory}
          className="mt-2 w-full text-left text-[11px] font-semibold text-primary hover:underline"
        >
          {showHistory
            ? t.tujuan.historyToggleHide
            : t.tujuan.historyToggleShow}
        </button>
        {showHistory && (
          <div className="mt-1.5 border-t pt-2">
            <ContributionHistory
              goalId={goal.id}
              familyGroupId={familyGroupId}
              token={token}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TujuanPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { canManage } = useCanManage("Goal");

  const [crud, setCrud] = useState<CrudModalState | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  // EPIC-022 A4 — the "original" currentAmount the edit form was seeded
  // with, so `buildGoalBody` can omit `currentAmount` from the PATCH when
  // the user never touched "Sudah Terkumpul" (see goals-utils.ts).
  const [editingOriginalCurrentAmount, setEditingOriginalCurrentAmount] =
    useState<number | null>(null);
  // Revisi F final-review Finding 1/3 — the "original" autoDebitAmount the
  // edit form was seeded with (as opposed to `null` for a genuinely new
  // goal), so `handleSubmit` can tell "the user cleared it" apart from
  // "the field was never touched", and only require a source account when
  // auto-debit is actually being set/changed (not on an unrelated edit of
  // a legacy goal that already had it set with no source account).
  const [editingOriginalAutoDebitAmount, setEditingOriginalAutoDebitAmount] =
    useState<number | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<GoalDto | null>(null);
  const [contributingGoal, setContributingGoal] = useState<GoalDto | null>(
    null,
  );

  const {
    data: goals,
    isLoading,
    isError,
  } = useQuery<GoalDto[]>({
    queryKey: queryKeys.goals.all(familyGroupId ?? ""),
    enabled: Boolean(familyGroupId) && Boolean(token),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<GoalDto[]>(`/family-groups/${familyGroupId}/goals`, {
        token,
        signal,
      });
    },
  });

  const { data: accounts = [] } = useQuery<SourceAccountOption[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    enabled: Boolean(familyGroupId) && Boolean(token) && canManage === true,
    queryFn: ({ signal }) =>
      apiFetch<SourceAccountOption[]>(
        `/family-groups/${familyGroupId}/accounts`,
        { token, signal },
      ),
  });

  const onTrackCount =
    goals?.filter((g) => g.status === "on_track" || g.status === "achieved")
      .length ?? 0;
  const needsBoostCount =
    goals?.filter((g) => g.status === "needs_boost").length ?? 0;
  const atRiskCount = goals?.filter((g) => g.status === "at_risk").length ?? 0;
  const totalAllocated =
    goals?.reduce((sum, g) => sum + g.currentAmount, 0) ?? 0;
  // EPIC-025 N3 restructure — "Progres Keseluruhan" summary card: overall
  // percent, total target, and the sum of every goal's own monthly-needed
  // figure, all derived from the goal list already fetched above.
  const totalTarget = goals?.reduce((sum, g) => sum + g.targetAmount, 0) ?? 0;
  const overallPercent =
    totalTarget > 0 ? Math.round((totalAllocated / totalTarget) * 100) : 0;
  const totalMonthlyNeeded =
    goals?.reduce((sum, g) => sum + (monthlyNeededFor(g) ?? 0), 0) ?? 0;

  function handleEdit(goal: GoalDto) {
    setEditingGoalId(goal.id);
    setEditingOriginalCurrentAmount(goal.currentAmount);
    setEditingOriginalAutoDebitAmount(goal.autoDebitAmount);
    setCrud({
      entity: "tujuan",
      mode: "edit",
      initialValues: {
        nama: goal.name,
        icon: goal.icon ?? "🛡️",
        target: String(goal.targetAmount),
        terkumpul: String(goal.currentAmount),
        deadline: goal.targetDate ?? "",
        autodebit:
          goal.autoDebitAmount != null ? String(goal.autoDebitAmount) : "",
        autodebitDay:
          goal.autoDebitDay != null ? String(goal.autoDebitDay) : "",
        sourceAccountId: goal.sourceAccountId ?? "",
      },
    });
  }

  function handleCloseCrud() {
    setCrud(null);
    setEditingGoalId(null);
    setEditingOriginalCurrentAmount(null);
    setEditingOriginalAutoDebitAmount(null);
  }

  async function handleSubmit(
    _entity: string,
    mode: CrudMode,
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token) {
      toast.error(t.tujuan.toastSessionNotReady);
      return;
    }
    const payload = parseGoalFormValues(
      values,
      mode === "edit" ? (editingOriginalCurrentAmount ?? undefined) : undefined,
    );
    // Revisi F Finding 1 — `parseGoalFormValues` (protected, not editable)
    // OMITS `autoDebitAmount` entirely when the field is blank, and a
    // blank/"0" field is indistinguishable from "0" itself. An edit of a
    // goal that HAD auto-debit set must send an EXPLICIT `null` so the API
    // actually clears it (an omitted field means "unchanged" there), not
    // silently keep the old value while the toast says success.
    const clearingAutoDebit =
      mode === "edit" &&
      editingOriginalAutoDebitAmount != null &&
      (payload.autoDebitAmount === undefined || payload.autoDebitAmount <= 0);
    // Revisi F Finding 3 — only require a source account when auto-debit is
    // newly being set or its amount is actually changing (or on create); a
    // pure rename/notes edit of a legacy goal that already had
    // autoDebitAmount set with no sourceAccountId must still save.
    const autoDebitChanging =
      mode === "create" ||
      payload.autoDebitAmount !== editingOriginalAutoDebitAmount;
    if (
      !clearingAutoDebit &&
      autoDebitChanging &&
      payload.autoDebitAmount &&
      !values.sourceAccountId
    ) {
      toast.error(t.tujuan.sourceAccountRequired);
      // Rejecting keeps CrudModal open with the user's input.
      throw new Error(t.tujuan.sourceAccountRequired);
    }
    const outgoing: Record<string, unknown> = clearingAutoDebit
      ? { ...payload, autoDebitAmount: null, sourceAccountId: null }
      : payload.autoDebitAmount
        ? { ...payload, sourceAccountId: values.sourceAccountId }
        : payload;
    const body = JSON.stringify(outgoing);
    try {
      if (mode === "edit" && editingGoalId) {
        await apiFetch(
          `/family-groups/${familyGroupId}/goals/${editingGoalId}`,
          { token, method: "PATCH", body },
        );
        toast.success(t.tujuan.toastUpdated);
      } else {
        await apiFetch(`/family-groups/${familyGroupId}/goals`, {
          token,
          method: "POST",
          body,
        });
        toast.success(t.tujuan.toastAdded);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(familyGroupId),
      });
    } catch (err) {
      // F1/F2 — surface the server's real message (e.g. a validation reason)
      // instead of a generic constant, AND rethrow so CrudModal's own
      // `await onSubmit(...)` rejects and skips its `onClose()` — a failed
      // save must not discard what the user typed.
      handleError(err);
      throw err;
    }
  }

  async function handleDeleteConfirm() {
    if (!familyGroupId || !token || !deletingGoal) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/goals/${deletingGoal.id}`,
        { token, method: "DELETE" },
      );
      toast.success(t.tujuan.toastDeleted);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(familyGroupId),
      });
    } catch (err) {
      handleError(err);
    } finally {
      setDeletingGoal(null);
    }
  }

  const sourceAccountOptions = [
    { value: "", label: t.tujuan.sourceAccountPlaceholder },
    ...accounts.map((a) => ({
      value: a.id,
      label: a.institution ? `${a.name} (${a.institution})` : a.name,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          {/* EPIC-025 N3-C4 — `.section-title` per the N3 translation table. */}
          <h1 className="text-[17px] font-extrabold tracking-tight">
            {isLoading
              ? "…"
              : `${goals?.length ?? 0}${t.tujuan.activeGoalsSuffix}`}
          </h1>
          <div className="text-xs text-muted-foreground">
            {t.tujuan.totalAllocatedPrefix}
            {isLoading ? "…" : <CountUpRupiah value={totalAllocated} />}
          </div>
          {/* Revisi F — contributions can now move real money; the line says
              when. */}
          <div className="text-[10.5px] text-muted-foreground/70">
            {t.tujuan.trackerDisclaimer}
          </div>
        </div>
        {canManage && (
          <Button
            onClick={() => setCrud({ entity: "tujuan", mode: "add" })}
            disabled={!familyGroupId}
            className="h-auto px-[18px] py-2.5"
          >
            <Plus className="size-4" /> {t.tujuan.addGoalButton}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Rise index={0}>
          <div className="rounded-[14px] border border-[#86EFAC] bg-[#DCFCE7] p-4">
            <div className="mb-1.5 flex size-[30px] items-center justify-center rounded-md bg-[#BBF7D0] text-[#15803D]">
              <CircleCheck className="size-[17px]" aria-hidden="true" />
            </div>
            <div className="text-[10.5px] text-[#15803D]">
              {t.tujuan.onTrackLabel}
            </div>
            <div className="text-[22px] font-black text-[#15803D]">
              {onTrackCount}
            </div>
            <div className="text-[11px] text-[#15803D]">
              {t.tujuan.onTrackDesc}
            </div>
          </div>
        </Rise>
        <Rise index={1}>
          <div className="rounded-[14px] border bg-card p-4">
            <div className="mb-1.5 flex size-[30px] items-center justify-center rounded-md bg-warning-soft text-warning">
              <Gauge className="size-[17px]" aria-hidden="true" />
            </div>
            <div className="text-[10.5px] text-warning">
              {t.tujuan.needsBoostLabel}
            </div>
            <div className="text-[22px] font-black text-warning">
              {needsBoostCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t.tujuan.needsBoostDesc}
            </div>
          </div>
        </Rise>
        <Rise index={2}>
          <div className="rounded-[14px] border bg-card p-4">
            <div className="mb-1.5 flex size-[30px] items-center justify-center rounded-md bg-brand-purple/15 text-brand-purple">
              <TriangleAlert className="size-[17px]" aria-hidden="true" />
            </div>
            <div className="text-[10.5px] text-muted-foreground">
              {t.tujuan.atRiskLabel}
            </div>
            <div className="text-[22px] font-black text-primary">
              {atRiskCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t.tujuan.atRiskDesc}
            </div>
          </div>
        </Rise>
        <Rise index={3}>
          <div className="flex flex-col justify-center rounded-[14px] border bg-card p-4">
            <div className="mb-1.5 text-[10.5px] font-bold text-muted-foreground">
              {t.tujuan.overallSectionTitle}
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-[10.5px] text-muted-foreground">
                  {t.tujuan.overallTotalLabel}
                </div>
                <div className="text-[22px] font-black text-primary">
                  {overallPercent}%
                </div>
              </div>
              <StatusBadge variant="success">
                {goals?.length ?? 0}
                {t.tujuan.overallActiveGoalsSuffix}
              </StatusBadge>
            </div>
            <div className="mt-2">
              <AnimatedProgress
                value={overallPercent}
                color="var(--primary)"
                height={9}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10.5px] text-muted-foreground">
              <span>
                {formatRupiah(totalAllocated)}
                {t.tujuan.collectedSuffix}
              </span>
              <span>
                {t.tujuan.targetPrefix}
                {formatRupiah(totalTarget)}
              </span>
            </div>
            <div className="mt-2 border-t pt-2 text-[10.5px] text-muted-foreground">
              {t.tujuan.overallMonthlyPrefix}
              <strong className="font-[family-name:var(--font-mono)] text-foreground">
                {formatRupiah(totalMonthlyNeeded)}
              </strong>
              {t.tujuan.overallMonthlySuffix}
            </div>
          </div>
        </Rise>
      </div>

      {isError && (
        <div className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          {t.tujuan.errorLoad}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <GoalCardSkeleton key={i} />
            ))
          : goals?.map((g, i) => (
              <Rise key={g.id} index={4 + i}>
                <GoalCard
                  goal={g}
                  onEdit={handleEdit}
                  onDelete={setDeletingGoal}
                  onContribute={setContributingGoal}
                  canManage={!!canManage}
                  familyGroupId={familyGroupId ?? ""}
                  token={token}
                />
              </Rise>
            ))}
        {!isLoading && !isError && goals?.length === 0 && (
          <div className="col-span-full rounded-[14px] border bg-card px-4 py-8 text-center text-[13px] text-muted-foreground">
            {t.tujuan.emptyState}
          </div>
        )}
        {!isLoading && !isError && canManage && (
          <button
            type="button"
            onClick={() => setCrud({ entity: "tujuan", mode: "add" })}
            disabled={!familyGroupId}
            className="flex flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed p-8 text-center transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
              <Target className="size-6" aria-hidden="true" />
            </span>
            <span className="text-[13px] font-bold">
              {t.tujuan.addGoalCardTitle}
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {t.tujuan.addGoalCardDesc}
            </span>
          </button>
        )}
      </div>

      <CrudModal
        state={crud}
        onClose={handleCloseCrud}
        onSubmit={handleSubmit}
        dynamicOptions={{ sourceAccountId: sourceAccountOptions }}
        labelOverrides={{ sourceAccountId: t.tujuan.sourceAccountFieldLabel }}
      />
      {contributingGoal && familyGroupId && token && (
        <ContributeDialog
          key={contributingGoal.id}
          goal={contributingGoal}
          accounts={accounts}
          familyGroupId={familyGroupId}
          token={token}
          onClose={() => setContributingGoal(null)}
        />
      )}
      <ConfirmDeleteDialog
        label={deletingGoal ? `"${deletingGoal.name}"` : null}
        // Revisi F final-review Finding 4 — the default body is one
        // sentence; append the net-worth scope note the same honest,
        // plain-copy way the Setor dialog does.
        body={
          deletingGoal
            ? `"${deletingGoal.name}" yang dihapus tidak bisa dikembalikan. ${t.tujuan.deleteConfirmNetWorthNote}`
            : undefined
        }
        onClose={() => setDeletingGoal(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
