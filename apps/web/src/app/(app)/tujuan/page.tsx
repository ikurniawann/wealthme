"use client";

import { useState } from "react";
import "./tujuan.css";
import { Plus } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { useApiError } from "@/hooks/use-api-error";
import { useCanManage } from "@/hooks/use-role-permissions";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { useMoney } from "@/hooks/use-money";
import { queryKeys } from "@/lib/query-keys";
import { parseGoalFormValues } from "@/lib/goals-utils";
import {
  AddTile,
  BentoCard,
  BentoGrid,
  BentoHero,
  BentoTiles,
  GhostButton,
  GoalIcon,
  HeroKpi,
  MiniList,
  MiniRow,
  SeeAll,
  TipsCard,
  Track,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { CrudModal, ConfirmDeleteDialog, withCrudFx } from "@/components/crud";
import type { CrudModalState, CrudMode } from "@/components/crud";

import {
  ContributeDialog,
  type SourceAccountOption,
} from "./_components/contribute-dialog";
import { GoalDetailPanel } from "./_components/goal-detail-panel";

import type { GoalDto, GoalStatus } from "@wealthme/contracts";

type GoalTone = "lime" | "orange" | "bad";

function goalTone(status: GoalStatus): GoalTone {
  switch (status) {
    case "achieved":
    case "on_track":
      return "lime";
    case "needs_boost":
      return "orange";
    case "at_risk":
      return "bad";
  }
}

const NEEDS_ATTENTION: readonly GoalStatus[] = ["needs_boost", "at_risk"];
const MOSAIC_CELLS = 45;
const MAX_ATTENTION_ROWS = 5;

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

function GoalSkeleton() {
  return (
    <div className="tj-skeleton" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="wm-btile animate-pulse" />
      ))}
    </div>
  );
}

interface GoalTileProps {
  goal: GoalDto;
  onOpenDetail: (goal: GoalDto) => void;
}

// EPIC-033 revision — the tile face is now ONLY icon, name, %, progress
// bar, and one meta line, matching docs/design/proto/tujuan.html. The
// "Perlu menabung" advice, Setor/Edit/Hapus actions, and Riwayat Setoran
// moved into GoalDetailPanel, opened by clicking the tile (the whole tile
// is the trigger, same as the proto's `data-tile` button).
function GoalTile({ goal, onOpenDetail }: GoalTileProps) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const tone = goalTone(goal.status);

  const metaLine =
    goal.remainingAmount > 0
      ? `${money.formatCompact(goal.remainingAmount)}${t.tujuan.remainingAmountSuffix}`
      : t.tujuan.collectedSuffix.trim();
  const dateLine = goal.targetDate
    ? formatTargetDate(goal.targetDate, t, locale).replace(
        t.tujuan.targetDatePrefix,
        "",
      )
    : null;

  return (
    <div className="wm-btile tj-tile" data-tone={tone}>
      <button
        type="button"
        className="tj-tile-main"
        onClick={() => onOpenDetail(goal)}
        aria-label={`${goal.name}, ${goal.progressPercent}% ${t.tujuan.collectedSuffix.trim()}`}
      >
        <span className="wm-btile-tt">
          <span className="wm-ci tj-icon">
            <GoalIcon icon={goal.icon} name={goal.name} size={16} />
          </span>
          <span className="tj-name">{goal.name}</span>
          <span className="tj-status sr-only">
            {t.tujuan.statusLabels[goal.status]}
          </span>
        </span>
        <span className="wm-pv tj-pv">{goal.progressPercent}%</span>
        <Track value={goal.progressPercent} fill={tone} />
        <small className="tj-meta-line">
          {metaLine}
          {dateLine ? ` · ${dateLine}` : ""}
        </small>
      </button>
    </div>
  );
}

export default function TujuanPage() {
  const { t, locale } = useLocale();
  const money = useMoney();
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
  const [detailGoal, setDetailGoal] = useState<GoalDto | null>(null);

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
  const totalTarget = goals?.reduce((sum, g) => sum + g.targetAmount, 0) ?? 0;
  const overallPercent =
    totalTarget > 0 ? Math.round((totalAllocated / totalTarget) * 100) : 0;

  const sortedGoals = [...(goals ?? [])].sort(
    (a, b) => a.progressPercent - b.progressPercent,
  );
  // EPIC-033 revision — docs/design/proto/tujuan.html's "Perlu perhatian"
  // list is never just the goals that are behind: it's `attn` (needs_boost
  // / at_risk, at_risk sorted first) followed by every other goal sorted
  // by progress descending, capped at MAX_ATTENTION_ROWS. The card always
  // lists every goal as a row — "all good" is no longer a one-sentence
  // empty state, it's just the natural result when nothing is behind.
  const needsAttentionGoals = sortedGoals
    .filter((g) => NEEDS_ATTENTION.includes(g.status))
    .sort((a, b) =>
      a.status === b.status ? 0 : a.status === "at_risk" ? -1 : 1,
    );
  const restGoals = (goals ?? [])
    .filter((g) => !NEEDS_ATTENTION.includes(g.status))
    .sort((a, b) => b.progressPercent - a.progressPercent);
  const attentionGoals = needsAttentionGoals
    .concat(restGoals)
    .slice(0, MAX_ATTENTION_ROWS);
  const worst = needsAttentionGoals[0];
  const worstMonthly = worst ? monthlyNeededFor(worst) : null;
  const lowestIndex = (goals ?? []).reduce(
    (m, g, k, arr) => (g.progressPercent < arr[m]!.progressPercent ? k : m),
    0,
  );
  const mosaicFilled = Math.round((overallPercent / 100) * MOSAIC_CELLS);
  const mosaic = Array.from({ length: MOSAIC_CELLS }, (_, i) =>
    i < mosaicFilled
      ? i > mosaicFilled - 6
        ? "c"
        : "a"
      : i % 5 === 0
        ? "b"
        : "",
  ) as ("a" | "b" | "c" | "o" | "")[];
  const openAdd = () => setCrud({ entity: "tujuan", mode: "add" });
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
        // polish-j batch 6 item 3 — targetDate can arrive as a full ISO
        // timestamp; DateField's formatFullDate expects a plain YYYY-MM-DD
        // and renders the literal string "Invalid Date" otherwise.
        deadline: goal.targetDate?.slice(0, 10) ?? "",
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
      mode === "add" ||
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
    const outgoing = clearingAutoDebit
      ? { ...payload, autoDebitAmount: null, sourceAccountId: null }
      : payload.autoDebitAmount
        ? { ...payload, sourceAccountId: values.sourceAccountId }
        : payload;
    const body = JSON.stringify(
      withCrudFx(outgoing, values, {
        target: "targetAmount",
        terkumpul: "currentAmount",
        autodebit: "autoDebitAmount",
      }),
    );
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
    <BentoGrid className="tj-grid">
      <h1 className="sr-only">{t.shell.pageTitles.tujuan}</h1>

      <BentoHero
        className="tj-hero"
        currency={null}
        value={
          isLoading ? "…" : money.format(totalAllocated).replace(/,00$/, "")
        }
        caption={
          isLoading
            ? "…"
            : `${t.tujuan.v2.heroCapPrefix}${goals?.length ?? 0}${t.tujuan.v2.heroCapSuffix}`
        }
        controls={
          <div className="tj-hero-ctrl">
            {canManage && (
              <GhostButton lit onClick={openAdd} disabled={!familyGroupId}>
                <Plus aria-hidden="true" /> {t.tujuan.addGoalButton}
              </GhostButton>
            )}
            {goals && goals.length > 0 && (
              <div className="tj-legend" aria-hidden="true">
                <span>
                  <i className="tj-legend-dot" data-tone="lime" />
                  {t.tujuan.v2.legendSaved}
                </span>
                <span>
                  <i className="tj-legend-dot" data-tone="ghost" />
                  {t.tujuan.v2.legendTarget}
                </span>
              </div>
            )}
          </div>
        }
        chart={
          goals && goals.length > 0 ? (
            <HatchedBarChart
              labels={goals.map((g) => g.name.split(" ")[0] ?? "")}
              series={[
                {
                  name: t.tujuan.v2.legendTarget,
                  data: goals.map((g) => g.targetAmount),
                  color: "var(--wm-ghost)",
                },
                {
                  name: t.tujuan.v2.legendSaved,
                  data: goals.map((g) => g.currentAmount),
                  color: "var(--wm-lime)",
                },
              ]}
              highlight={lowestIndex}
              format={money.formatCompact}
              wide
              ariaLabel={t.tujuan.v2.legendSaved}
            />
          ) : (
            <p className="wm-cap">{t.tujuan.v2.chartEmpty}</p>
          )
        }
        kpis={
          <>
            <HeroKpi label={t.tujuan.v2.kpiOnTrack} value={onTrackCount} />
            <HeroKpi label={t.tujuan.v2.kpiBoost} value={needsBoostCount} />
            <HeroKpi label={t.tujuan.v2.kpiRisk} value={atRiskCount} />
          </>
        }
      />

      <BentoCard
        className="tj-side"
        title={t.tujuan.v2.attTitle}
        caption={t.tujuan.v2.attCaption}
      >
        {attentionGoals.length > 0 ? (
          <div role="list" aria-label={t.tujuan.v2.attTitle}>
            {attentionGoals.map((g) => (
              <div key={g.id} role="listitem" className="tj-att">
                <MiniList>
                  <MiniRow
                    icon={<GoalIcon icon={g.icon} name={g.name} size={16} />}
                    title={`${g.name} ${g.progressPercent}%`}
                    meta={`${g.progressPercent}% · ${t.tujuan.statusLabels[g.status]}`}
                    amount={money.formatCompact(g.remainingAmount)}
                  />
                </MiniList>
                <Track value={g.progressPercent} fill={goalTone(g.status)} />
              </div>
            ))}
          </div>
        ) : (
          <p className="tj-state">{t.tujuan.v2.attAllGood}</p>
        )}
      </BentoCard>

      <BentoCard
        className="tj-tiles"
        title={t.tujuan.v2.tilesTitle}
        caption={t.tujuan.v2.tilesCaption}
      >
        {isLoading && <GoalSkeleton />}
        {isError && (
          <p role="alert" className="tj-state tj-state-bad">
            {t.tujuan.errorLoad}
          </p>
        )}
        {!isLoading && !isError && goals?.length === 0 && (
          <p className="tj-state">{t.tujuan.emptyState}</p>
        )}
        {!isLoading && !isError && goals && (
          <BentoTiles>
            {sortedGoals.map((g) => (
              <GoalTile key={g.id} goal={g} onOpenDetail={setDetailGoal} />
            ))}
            {canManage && (
              <AddTile onClick={openAdd}>
                <Plus aria-hidden="true" /> {t.tujuan.v2.addTile}
              </AddTile>
            )}
          </BentoTiles>
        )}
      </BentoCard>

      <TipsCard
        className="tj-tips"
        title={
          worst
            ? `${worst.name}${t.tujuan.v2.tipsWorstSuffix}`
            : t.tujuan.v2.tipsOkTitle
        }
        mosaic={mosaic}
        action={
          worst ? (
            <SeeAll href="/transaksi">{t.tujuan.v2.tipsSeeTransactions}</SeeAll>
          ) : undefined
        }
      >
        {worst && worstMonthly != null
          ? `${t.tujuan.noticeSavingsPrefix}${money.format(worstMonthly)}${t.tujuan.noticeSavingsNoAutoDebitSuffix}`
          : `${t.tujuan.v2.tipsOverallPrefix}${overallPercent}%. ${t.tujuan.v2.tipsOkBody}`}
      </TipsCard>

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
      {detailGoal && (
        <GoalDetailPanel
          key={detailGoal.id}
          goal={detailGoal}
          tone={goalTone(detailGoal.status)}
          metaLine={
            detailGoal.remainingAmount > 0
              ? `${money.formatCompact(detailGoal.remainingAmount)}${t.tujuan.remainingAmountSuffix}`
              : t.tujuan.collectedSuffix.trim()
          }
          dateLine={
            detailGoal.targetDate
              ? formatTargetDate(detailGoal.targetDate, t, locale).replace(
                  t.tujuan.targetDatePrefix,
                  "",
                )
              : null
          }
          monthlyNeeded={monthlyNeededFor(detailGoal)}
          monthsUntilTarget={
            detailGoal.targetDate
              ? monthsUntilTarget(detailGoal.targetDate)
              : null
          }
          canManage={!!canManage}
          familyGroupId={familyGroupId ?? ""}
          token={token}
          onClose={() => setDetailGoal(null)}
          onEdit={(g) => {
            setDetailGoal(null);
            handleEdit(g);
          }}
          onDelete={(g) => {
            setDetailGoal(null);
            setDeletingGoal(g);
          }}
          onContribute={(g) => {
            setDetailGoal(null);
            setContributingGoal(g);
          }}
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
    </BentoGrid>
  );
}
