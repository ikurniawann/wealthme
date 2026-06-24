"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  SectionCard,
  CountUpRupiah,
  AnimatedProgress,
  Rise,
} from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatAmountInput, formatRupiah, parseRupiah } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { BudgetDto, CreateBudgetDto } from "@wealthme/contracts";

function budgetBarColor(dto: BudgetDto): string {
  if (dto.isOverBudget) return "var(--destructive)";
  if (dto.isNearLimit) return "var(--warning)";
  return "var(--success)";
}

function budgetPctLabel(dto: BudgetDto): string {
  const label = `${dto.usagePercent}%`;
  if (dto.isOverBudget) return `${label} ⚠️`;
  return label;
}

function budgetAmountsLabel(dto: BudgetDto): string {
  return `${formatRupiah(dto.spentAmount)} dari ${formatRupiah(dto.limitAmount)}`;
}

const PERIOD_MAP: Record<string, CreateBudgetDto["period"]> = {
  Bulanan: "monthly",
  Mingguan: "weekly",
  Tahunan: "yearly",
};

const ICON_OPTIONS = ["🎓", "🎨", "🎁", "🐶", "👶", "📚", "💪", "🙏"];

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

function BudgetItem({ dto, index }: { dto: BudgetDto; index: number }) {
  const color = budgetBarColor(dto);
  const icon = dto.categoryIcon ?? "📦";
  return (
    <Rise index={index}>
      <div className="rounded-[12px] border bg-card p-3.5 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-[14px]">
            {icon}
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold">
              {dto.categoryName}
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              {budgetAmountsLabel(dto)}
            </div>
          </div>
          <div className="text-[13px] font-bold" style={{ color }}>
            {budgetPctLabel(dto)}
          </div>
        </div>
        <AnimatedProgress
          value={Math.min(dto.usagePercent, 100)}
          color={color}
        />
      </div>
    </Rise>
  );
}

function BudgetSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse space-y-2 rounded-[12px] border bg-card p-3.5"
        >
          <div className="flex items-center gap-2.5">
            <div className="size-[34px] rounded-[9px] bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded bg-muted" />
              <div className="h-2.5 w-48 rounded bg-muted" />
            </div>
            <div className="h-3 w-8 rounded bg-muted" />
          </div>
          <div className="h-2 w-full rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export default function AnggaranPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICON_OPTIONS[0] ?? "🎓");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<string>("Bulanan");

  const {
    data: budgets,
    isLoading,
    isError,
  } = useQuery<BudgetDto[]>({
    queryKey: queryKeys.budgets.all(familyGroupId ?? ""),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<BudgetDto[]>(`/family-groups/${familyGroupId}/budgets`, {
        token,
        signal,
      });
    },
    enabled: !!token && !!familyGroupId,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      icon: string;
      limitAmount: number;
      period: string;
    }) => {
      if (!familyGroupId) throw new Error("familyGroupId missing");

      let categoryId: string;
      try {
        const cat = await apiFetch<{ id: string }>(
          `/family-groups/${familyGroupId}/categories`,
          {
            method: "POST",
            token,
            body: JSON.stringify({
              name: payload.name,
              kind: "expense",
              icon: payload.icon,
            }),
          },
        );
        categoryId = cat.id;
      } catch (err) {
        const apiErr = err as { status?: number; message?: string };
        if (apiErr.status === 409) {
          const cats = await apiFetch<Array<{ id: string; name: string }>>(
            `/family-groups/${familyGroupId}/categories?kind=expense`,
            { token },
          );
          const match = cats.find(
            (c) => c.name.toLowerCase() === payload.name.toLowerCase(),
          );
          if (!match)
            throw new Error("Kategori tidak ditemukan setelah konflik");
          categoryId = match.id;
        } else {
          throw err;
        }
      }

      const dto: CreateBudgetDto = {
        categoryId,
        period: PERIOD_MAP[payload.period] ?? "monthly",
        limitAmount: payload.limitAmount,
      };
      return apiFetch<BudgetDto>(`/family-groups/${familyGroupId}/budgets`, {
        method: "POST",
        token,
        body: JSON.stringify(dto),
      });
    },
    onSuccess: (budget) => {
      if (familyGroupId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.all(familyGroupId),
        });
      }
      setOpen(false);
      resetForm();
      toast.success(`Anggaran "${budget.categoryName}" ditambahkan`);
    },
    onError: (err: unknown) => {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message ?? "Gagal menyimpan anggaran");
    },
  });

  function resetForm() {
    setName("");
    setIcon(ICON_OPTIONS[0] ?? "🎓");
    setAmount("");
    setPeriod("Bulanan");
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning("Nama kategori wajib diisi");
      return;
    }
    const limitAmount = parseRupiah(amount);
    if (limitAmount <= 0) {
      toast.warning("Budget harus lebih dari Rp 0");
      return;
    }
    if (!familyGroupId) {
      toast.error("Silakan bergabung ke Family Group terlebih dahulu");
      return;
    }
    createMutation.mutate({ name: trimmed, icon, limitAmount, period });
  }

  const totalLimit = budgets?.reduce((s, b) => s + b.limitAmount, 0) ?? 0;
  const totalSpent = budgets?.reduce((s, b) => s + b.spentAmount, 0) ?? 0;
  const totalRemaining = Math.max(0, totalLimit - totalSpent);
  const overBudgetItems = budgets?.filter((b) => b.isOverBudget) ?? [];
  const nearLimitItems = budgets?.filter((b) => b.isNearLimit) ?? [];

  const now = new Date();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const usagePct =
    totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[15px] font-bold">
            Anggaran{" "}
            {now.toLocaleString("id-ID", { month: "long", year: "numeric" })}
          </div>
          <div className="text-xs text-muted-foreground">
            Total budget: {formatRupiah(totalLimit)}
          </div>
        </div>
        <Button
          onClick={() => setOpen(true)}
          disabled={!familyGroupId}
          className="h-auto px-[18px] py-2.5"
        >
          <Plus className="size-4" /> Tambah Kategori
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Rise index={0}>
          <div className="rounded-[14px] border border-[#86EFAC] bg-[#DCFCE7] p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <div className="mb-1 text-[11px] text-[#15803D]">
              Budget Tersisa
            </div>
            <div className="mono text-[22px] font-black text-[#15803D]">
              <CountUpRupiah value={totalRemaining} />
            </div>
            <div className="text-[11px] text-[#15803D]">
              {totalLimit > 0
                ? `${100 - usagePct}% dari budget`
                : "Belum ada budget"}
            </div>
          </div>
        </Rise>
        <Rise index={1}>
          <div className="rounded-[14px] border bg-card p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <div className="mb-1 text-[11px] text-muted-foreground">
              Total Terpakai
            </div>
            <div className="mono text-[22px] font-black text-destructive">
              <CountUpRupiah value={totalSpent} />
            </div>
            <div className="text-[11px] text-muted-foreground">
              {usagePct}% dari budget
            </div>
          </div>
        </Rise>
        <Rise index={2}>
          <div className="rounded-[14px] border bg-card p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <div className="mb-1 text-[11px] text-muted-foreground">
              Hari Tersisa
            </div>
            <div className="text-[22px] font-black text-primary">
              {daysLeft} Hari
            </div>
            <div className="text-[11px] text-muted-foreground">
              dari {daysInMonth} hari
            </div>
          </div>
        </Rise>
      </div>

      <SectionCard title="Rincian Anggaran per Kategori" bodyClassName="-mt-1">
        {isLoading && <BudgetSkeleton />}
        {isError && (
          <div className="py-4 text-center text-[13px] text-destructive">
            Gagal memuat anggaran. Silakan refresh halaman.
          </div>
        )}
        {!isLoading && !isError && (!budgets || budgets.length === 0) && (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            Belum ada anggaran. Klik &ldquo;Tambah Kategori&rdquo; untuk
            memulai.
          </div>
        )}
        {!isLoading && !isError && budgets && budgets.length > 0 && (
          <div className="space-y-3">
            {budgets.map((b, i) => (
              <BudgetItem key={b.id} dto={b} index={i} />
            ))}
          </div>
        )}
      </SectionCard>

      {(overBudgetItems.length > 0 || nearLimitItems.length > 0) && (
        <div className="flex items-center gap-3 rounded-[14px] border border-primary/20 bg-accent p-4">
          <div className="text-[24px]">⚠️</div>
          <div className="flex-1">
            {overBudgetItems.length > 0 ? (
              <>
                <div className="text-[13px] font-bold text-primary-strong">
                  {overBudgetItems[0]!.categoryName} melebihi budget{" "}
                  {overBudgetItems[0]!.usagePercent - 100}%!
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Pengeluaran bulan ini melebihi batas anggaran yang ditetapkan.
                </div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-bold text-primary-strong">
                  {nearLimitItems[0]!.categoryName} mendekati batas budget (
                  {nearLimitItems[0]!.usagePercent}%)
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Pantau pengeluaran agar tidak melebihi anggaran.
                </div>
              </>
            )}
          </div>
          <span
            aria-disabled="true"
            className="shrink-0 text-[12.5px] font-bold text-primary opacity-60"
          >
            Tips Hemat →
          </span>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">
            Tambah Kategori Anggaran
          </DialogTitle>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="budget-name"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                Nama Kategori
              </label>
              <input
                id="budget-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: Pendidikan Anak, Hobi, Donasi..."
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <div
                role="group"
                aria-label="Pilih ikon"
                className="mb-1.5 text-[12.5px] font-semibold"
              >
                Ikon
              </div>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    aria-label={`Ikon ${opt}`}
                    aria-pressed={icon === opt}
                    onClick={() => setIcon(opt)}
                    className={
                      "flex size-[42px] items-center justify-center rounded-[10px] border text-[18px] transition-colors " +
                      (icon === opt
                        ? "border-primary bg-accent"
                        : "border-border bg-background hover:bg-accent/50")
                    }
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor="budget-amount"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                Budget per Bulan (Rp)
              </label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
                <span className="text-[13.5px] text-muted-foreground">Rp</span>
                <input
                  id="budget-amount"
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  placeholder="0"
                  className="w-full bg-transparent text-[13.5px] outline-none"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="budget-period"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                Periode
              </label>
              <select
                id="budget-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className={FIELD_CLASS}
              >
                <option>Bulanan</option>
                <option>Mingguan</option>
                <option>Tahunan</option>
              </select>
            </div>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="w-full"
            >
              <Save className="size-4" />
              {createMutation.isPending ? "Menyimpan..." : "Simpan Kategori"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
