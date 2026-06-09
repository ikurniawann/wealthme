"use client";

import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { StatusBadge, ProgressBar } from "@/components/wm";
import { Button } from "@/components/ui/button";

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
  borderColor: string;
  iconBg: string;
} {
  switch (status) {
    case "achieved":
      return {
        label: "Tercapai",
        variant: "success",
        color: "var(--success)",
        borderColor: "var(--success)",
        iconBg: "#DCFCE7",
      };
    case "on_track":
      return {
        label: "On Track",
        variant: "info",
        color: "var(--primary)",
        borderColor: "var(--primary)",
        iconBg: "#DBEAFE",
      };
    case "needs_boost":
      return {
        label: "Perlu Boost",
        variant: "warning",
        color: "var(--warning)",
        borderColor: "var(--warning)",
        iconBg: "#FEF9C3",
      };
    case "at_risk":
      return {
        label: "Berisiko",
        variant: "purple",
        color: "var(--brand-purple)",
        borderColor: "var(--brand-purple)",
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
    <div className="rounded-[14px] border-2 border-muted bg-card p-[18px]">
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
  );
}

function GoalCard({ goal }: { goal: GoalDto }) {
  const { label, variant, color, borderColor, iconBg } = statusToBadge(
    goal.status,
  );
  const icon = goal.icon ?? "🎯";

  return (
    <div
      className="rounded-[14px] border-2 bg-card p-[18px]"
      style={{ borderColor }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex size-[40px] shrink-0 items-center justify-center rounded-[11px] text-[18px]"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
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
      <ProgressBar value={goal.progressPercent} color={color} height={9} />

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
    </div>
  );
}

export default function TujuanPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[15px] font-bold">
            {isLoading ? "…" : `${goals?.length ?? 0} Tujuan Aktif`}
          </div>
          <div className="text-xs text-muted-foreground">
            Total dialokasikan: {formatRupiah(totalAllocated)}
          </div>
        </div>
        <Button
          onClick={() => toast("Form tambah tujuan")}
          className="h-auto px-[18px] py-2.5"
        >
          <Plus className="size-4" /> Tambah Tujuan
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="rounded-[14px] border border-[#86EFAC] bg-[#DCFCE7] p-4">
          <div className="text-[10.5px] text-[#15803D]">On Track</div>
          <div className="text-[22px] font-black text-[#15803D]">
            {onTrackCount}
          </div>
          <div className="text-[11px] text-[#15803D]">tujuan berjalan baik</div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="text-[10.5px] text-warning">Perlu Boost</div>
          <div className="text-[22px] font-black text-warning">
            {needsBoostCount}
          </div>
          <div className="text-[11px] text-muted-foreground">
            tujuan perlu percepatan
          </div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="text-[10.5px] text-muted-foreground">Berisiko</div>
          <div className="text-[22px] font-black text-primary">
            {atRiskCount}
          </div>
          <div className="text-[11px] text-muted-foreground">
            tujuan berisiko tidak tercapai
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          Gagal memuat tujuan keuangan. Silakan refresh halaman.
        </div>
      )}

      {/* Goal cards */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <GoalCardSkeleton key={i} />
            ))
          : goals?.map((g) => <GoalCard key={g.id} goal={g} />)}
        {!isLoading && !isError && goals?.length === 0 && (
          <div className="col-span-full rounded-[14px] border bg-card px-4 py-8 text-center text-[13px] text-muted-foreground">
            Belum ada tujuan keuangan. Klik &quot;Tambah Tujuan&quot; untuk
            mulai.
          </div>
        )}
      </div>
    </div>
  );
}
