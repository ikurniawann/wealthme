"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, GraduationCap } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { buildGoalBody } from "@/lib/goals-utils";
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

import type { GoalDto, GoalStatus } from "@wealthme/contracts";

function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />
  );
}

type BadgeVariant = "success" | "info" | "warning" | "purple";

function statusToBadge(status: GoalStatus): {
  label: string;
  variant: BadgeVariant;
  color: string;
  stripColor: string;
  iconBg: string;
} {
  switch (status) {
    case "achieved":
      return {
        label: "Tercapai",
        variant: "success",
        color: "var(--success)",
        stripColor: "var(--success)",
        iconBg: "#DCFCE7",
      };
    case "on_track":
      return {
        label: "On Track",
        variant: "info",
        color: "var(--primary)",
        stripColor: "var(--primary)",
        iconBg: "#DBEAFE",
      };
    case "needs_boost":
      return {
        label: "Perlu Boost",
        variant: "warning",
        color: "var(--warning)",
        stripColor: "var(--warning)",
        iconBg: "#FEF9C3",
      };
    case "at_risk":
      return {
        label: "Berisiko",
        variant: "purple",
        color: "var(--brand-purple)",
        stripColor: "var(--brand-purple)",
        iconBg: "#EDE9FE",
      };
  }
}

function formatTargetDate(iso: string | null): string {
  if (!iso) return "Tanpa target";
  const d = new Date(iso);
  return (
    "Target: " +
    d.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
  );
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
}

function isEducationGoal(goal: GoalDto): boolean {
  const name = goal.name?.toLowerCase() ?? "";
  return name.includes("pendidikan") || name.includes("education");
}

function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const { label, variant, color, stripColor, iconBg } = statusToBadge(
    goal.status,
  );
  const icon = goal.icon ?? "🎯";
  const useEducationChip = isEducationGoal(goal);

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
            <div className="text-[14px] font-bold">{goal.name}</div>
            <div className="text-[11.5px] text-muted-foreground">
              {formatTargetDate(goal.targetDate)}
            </div>
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
          <span>{formatRupiah(goal.currentAmount)} terkumpul</span>
          <span>Target {formatRupiah(goal.targetAmount)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-[12px] font-semibold">
          <span>Sisa: {formatRupiah(goal.remainingAmount)}</span>
          {goal.autoDebitAmount != null ? (
            <span className="text-muted-foreground">
              Auto-debit {formatRupiah(goal.autoDebitAmount)}/bln
            </span>
          ) : (
            <span className="text-muted-foreground">Tanpa auto-debit</span>
          )}
        </div>

        <div className="mt-2.5 flex gap-1.5">
          <button
            onClick={() => onEdit(goal)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 py-[7px] text-[11px] font-semibold"
            style={{
              background: "var(--primary-light)",
              color: "var(--primary)",
            }}
          >
            <Pencil className="size-[13px]" /> Edit
          </button>
          <button
            onClick={() => onDelete(goal)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 py-[7px] text-[11px] font-semibold text-destructive"
            style={{ background: "hsl(var(--destructive) / 0.1)" }}
          >
            <Trash2 className="size-[13px]" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TujuanPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;
  const queryClient = useQueryClient();

  const [crud, setCrud] = useState<CrudModalState | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<GoalDto | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const onTrackCount =
    goals?.filter((g) => g.status === "on_track" || g.status === "achieved")
      .length ?? 0;
  const needsBoostCount =
    goals?.filter((g) => g.status === "needs_boost").length ?? 0;
  const atRiskCount = goals?.filter((g) => g.status === "at_risk").length ?? 0;
  const totalAllocated =
    goals?.reduce((sum, g) => sum + g.currentAmount, 0) ?? 0;

  function handleEdit(goal: GoalDto) {
    setEditingGoalId(goal.id);
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
      },
    });
  }

  function handleCloseCrud() {
    setCrud(null);
    setEditingGoalId(null);
  }

  async function handleSubmit(
    _entity: string,
    mode: CrudMode,
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token) return;
    setSubmitting(true);
    try {
      const body = buildGoalBody(values);
      if (mode === "edit" && editingGoalId) {
        await apiFetch(
          `/family-groups/${familyGroupId}/goals/${editingGoalId}`,
          { token, method: "PATCH", body },
        );
        toast.success("Tujuan berhasil diperbarui!");
      } else {
        await apiFetch(`/family-groups/${familyGroupId}/goals`, {
          token,
          method: "POST",
          body,
        });
        toast.success("Tujuan berhasil ditambahkan!");
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(familyGroupId),
      });
    } catch {
      toast.error("Gagal menyimpan tujuan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!familyGroupId || !token || !deletingGoal) return;
    setSubmitting(true);
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/goals/${deletingGoal.id}`,
        { token, method: "DELETE" },
      );
      toast.success("Tujuan berhasil dihapus.");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(familyGroupId),
      });
    } catch {
      toast.error("Gagal menghapus tujuan. Coba lagi.");
    } finally {
      setSubmitting(false);
      setDeletingGoal(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[15px] font-bold">
            {isLoading ? "…" : `${goals?.length ?? 0} Tujuan Aktif`}
          </div>
          <div className="text-xs text-muted-foreground">
            Total dialokasikan:{" "}
            {isLoading ? "…" : <CountUpRupiah value={totalAllocated} />}
          </div>
        </div>
        <Button
          onClick={() => setCrud({ entity: "tujuan", mode: "add" })}
          className="h-auto px-[18px] py-2.5"
        >
          <Plus className="size-4" /> Tambah Tujuan
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Rise index={0}>
          <div className="rounded-[14px] border border-[#86EFAC] bg-[#DCFCE7] p-4">
            <div className="text-[10.5px] text-[#15803D]">On Track</div>
            <div className="text-[22px] font-black text-[#15803D]">
              {onTrackCount}
            </div>
            <div className="text-[11px] text-[#15803D]">
              tujuan berjalan baik
            </div>
          </div>
        </Rise>
        <Rise index={1}>
          <div className="rounded-[14px] border bg-card p-4">
            <div className="text-[10.5px] text-warning">Perlu Boost</div>
            <div className="text-[22px] font-black text-warning">
              {needsBoostCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              tujuan perlu percepatan
            </div>
          </div>
        </Rise>
        <Rise index={2}>
          <div className="rounded-[14px] border bg-card p-4">
            <div className="text-[10.5px] text-muted-foreground">Berisiko</div>
            <div className="text-[22px] font-black text-primary">
              {atRiskCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              tujuan berisiko tidak tercapai
            </div>
          </div>
        </Rise>
      </div>

      {isError && (
        <div className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          Gagal memuat tujuan keuangan. Silakan refresh halaman.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <GoalCardSkeleton key={i} />
            ))
          : goals?.map((g, i) => (
              <Rise key={g.id} index={3 + i}>
                <GoalCard
                  goal={g}
                  onEdit={handleEdit}
                  onDelete={setDeletingGoal}
                />
              </Rise>
            ))}
        {!isLoading && !isError && goals?.length === 0 && (
          <div className="col-span-full rounded-[14px] border bg-card px-4 py-8 text-center text-[13px] text-muted-foreground">
            Belum ada tujuan keuangan. Klik &quot;Tambah Tujuan&quot; untuk
            mulai.
          </div>
        )}
      </div>

      <CrudModal
        state={crud}
        onClose={handleCloseCrud}
        onSubmit={submitting ? undefined : handleSubmit}
      />
      <ConfirmDeleteDialog
        label={deletingGoal ? `"${deletingGoal.name}"` : null}
        onClose={() => setDeletingGoal(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
