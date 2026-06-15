"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useShell } from "@/components/shell/shell-context";
import { formatAmountInput, parseRupiah } from "@/lib/format";

import { SectionCard, MoneyStat } from "@/components/wm";
import { RowActions, ConfirmDeleteDialog } from "@/components/crud";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";
import type {
  TransactionDto,
  TransactionListResponse,
} from "@wealthme/contracts";

type TxnType = "income" | "expense" | "transfer" | "all";

type MeResponse = {
  id: string;
  email: string;
  name: string;
  familyGroupId: string | null;
};

const FILTERS: { label: string; value: TxnType }[] = [
  { label: "Semua", value: "all" },
  { label: "Masuk", value: "income" },
  { label: "Keluar", value: "expense" },
  { label: "Transfer", value: "transfer" },
];

function formatTime(isoString: string): string {
  return isoString.slice(11, 16);
}

function formatDayLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (dateStr === today) return "Hari ini";
  if (dateStr === yesterday) return "Kemarin";
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const TYPE_LABEL: Record<string, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

function TxRow({
  tx,
  onDeleteClick,
  onEditClick,
}: {
  tx: TransactionDto;
  onDeleteClick: () => void;
  onEditClick: () => void;
}) {
  const isIncome = tx.type === "income";
  const amount = parseFloat(tx.amount);
  const amountStr = (isIncome ? "+" : "-") + formatRupiah(amount);
  const iconBg = isIncome ? "#DCFCE7" : "#FEE2E2";
  const icon = isIncome ? "📥" : tx.type === "transfer" ? "↗️" : "💳";
  const displayName =
    tx.description ?? tx.categoryName ?? tx.accountName ?? "—";
  const subtitle =
    tx.categoryName ?? tx.accountName ?? TYPE_LABEL[tx.type] ?? tx.type;

  return (
    <div className="flex w-full items-center gap-3 rounded-[12px] border bg-card p-3 text-left transition-colors hover:bg-accent/40">
      <div
        className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-[15px]"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">
          {displayName}
        </div>
        <div className="truncate text-[11.5px] text-muted-foreground capitalize">
          {subtitle}
        </div>
      </div>
      <div className="text-right">
        <div
          className={
            "text-[13.5px] font-bold " +
            (isIncome ? "text-success" : "text-destructive")
          }
        >
          {amountStr}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {formatTime(tx.occurredAt)}
        </div>
      </div>
      <RowActions
        onEdit={onEditClick}
        onDelete={onDeleteClick}
        className="ml-1"
      />
    </div>
  );
}

function EditTransactionDialog({
  tx,
  token,
  familyGroupId,
  onClose,
  onSaved,
}: {
  tx: TransactionDto | null;
  token: string | undefined;
  familyGroupId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  // State is initialised from props; parent passes key={tx.id} to reset on change
  const [amount, setAmount] = useState(
    tx ? formatAmountInput(String(Math.round(parseFloat(tx.amount)))) : "",
  );
  const [description, setDescription] = useState(tx?.description ?? "");
  const [date, setDate] = useState(tx?.occurredAt.slice(0, 10) ?? "");

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/family-groups/${familyGroupId}/transactions/${tx!.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        token,
      }),
    onSuccess: () => {
      toast.success("Transaksi berhasil diperbarui.");
      onSaved();
    },
    onError: () => toast.error("Gagal memperbarui transaksi."),
  });

  if (!tx) return null;

  const handleSave = () => {
    const amountNum = parseRupiah(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Jumlah tidak valid");
      return;
    }
    updateMutation.mutate({
      amount: amountNum,
      ...(description ? { description } : { description: null }),
      occurredAt: new Date(date).toISOString(),
    });
  };

  return (
    <Dialog
      open={!!tx}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogTitle>Edit Transaksi</DialogTitle>
        <div className="space-y-3 pt-1">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              Jumlah
            </label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              inputMode="numeric"
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              Deskripsi
            </label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opsional"
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              Tanggal
            </label>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border py-2.5 text-[13px] font-semibold"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex-1 rounded-md bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {updateMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TransaksiPage() {
  const [filter, setFilter] = useState<TxnType>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<TransactionDto | null>(null);
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const { setTxnOpen } = useShell();
  const queryClient = useQueryClient();

  useEffect(() => {
    if ((session as { error?: string } | null)?.error === "RefreshTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  const { data: me } = useQuery<MeResponse>({
    queryKey: [...queryKeys.auth.me(), token],
    queryFn: () => apiFetch<MeResponse>("/auth/me", { token }),
    enabled: !!token,
  });

  const familyGroupId = me?.familyGroupId ?? "";

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/family-groups/${familyGroupId}/transactions/${id}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(familyGroupId),
      });
      toast.success("Transaksi berhasil dihapus.");
    },
    onError: () => {
      toast.error("Gagal menghapus transaksi.");
    },
  });

  const { data, isLoading, isError } = useQuery<TransactionListResponse>({
    queryKey: [...queryKeys.transactions.all(familyGroupId), token],
    queryFn: () =>
      apiFetch<TransactionListResponse>(
        `/family-groups/${familyGroupId}/transactions?limit=50`,
        { token },
      ),
    enabled: !!token && !!familyGroupId,
  });

  const transactions = data?.data ?? [];
  const summary = data?.summary;

  const filtered =
    filter === "all"
      ? transactions
      : transactions.filter((tx) => tx.type === filter);

  const groups = filtered.reduce<Record<string, TransactionDto[]>>(
    (acc, tx) => {
      const day = tx.occurredAt.slice(0, 10);
      const existing = acc[day];
      return { ...acc, [day]: existing ? [...existing, tx] : [tx] };
    },
    {},
  );

  const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const totalIncome = summary ? parseFloat(summary.totalIncome) : 0;
  const totalExpense = summary ? parseFloat(summary.totalExpense) : 0;
  const netBalance = summary ? parseFloat(summary.netBalance) : 0;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-[13px] text-muted-foreground">
          Catat &amp; kelola semua transaksimu
        </span>
        <button
          onClick={() => setTxnOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-3.5" /> Tambah Transaksi
        </button>
      </div>

      {/* Summary bar */}
      <div className="rounded-[14px] border bg-card p-4">
        <div className="grid grid-cols-3 gap-3">
          <MoneyStat
            label="Total Pemasukan"
            value={isLoading ? "…" : formatRupiah(totalIncome)}
            valueClass="text-success"
          />
          <MoneyStat
            label="Total Pengeluaran"
            value={isLoading ? "…" : formatRupiah(totalExpense)}
            valueClass="text-destructive"
          />
          <MoneyStat
            label="Selisih"
            value={isLoading ? "…" : formatRupiah(netBalance)}
            valueClass={netBalance >= 0 ? "text-success" : "text-destructive"}
          />
        </div>
      </div>

      {/* Filter tabs + add button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors " +
                (filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setTxnOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-3.5" /> Tambah
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
        >
          Gagal memuat transaksi. Silakan refresh halaman.
        </div>
      )}

      {/* Transaction list */}
      <div className="space-y-1">
        {isLoading && (
          <SectionCard>
            <div className="py-6 text-center text-[13px] text-muted-foreground">
              Memuat transaksi…
            </div>
          </SectionCard>
        )}

        {!isLoading &&
          sortedDays.map((day) => (
            <div key={day}>
              <div className="mt-3 mb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {formatDayLabel(day)}
              </div>
              <div className="space-y-1.5">
                {groups[day]?.map((tx) => (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    onDeleteClick={() => setDeleteTarget(tx.id)}
                    onEditClick={() => setEditTarget(tx)}
                  />
                ))}
              </div>
            </div>
          ))}

        {!isLoading && sortedDays.length === 0 && !isError && (
          <SectionCard>
            <div className="py-6 text-center text-[13px] text-muted-foreground">
              Tidak ada transaksi pada filter ini.
            </div>
          </SectionCard>
        )}
      </div>

      <EditTransactionDialog
        key={editTarget?.id ?? "edit-none"}
        tx={editTarget}
        token={token}
        familyGroupId={familyGroupId}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          void queryClient.invalidateQueries({
            queryKey: queryKeys.transactions.all(familyGroupId),
          });
        }}
      />

      <ConfirmDeleteDialog
        label={deleteTarget !== null ? "Transaksi" : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
