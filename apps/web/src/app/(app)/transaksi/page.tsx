"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

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

function TxRow({
  tx,
  onDeleteClick,
}: {
  tx: TransactionDto;
  onDeleteClick: () => void;
}) {
  const isIncome = tx.type === "income";
  const amount = parseFloat(tx.amount);
  const amountStr = (isIncome ? "+" : "-") + formatRupiah(amount);
  const iconBg = isIncome ? "#DCFCE7" : "#FEE2E2";
  const icon = isIncome ? "📥" : tx.type === "transfer" ? "↗️" : "💳";

  return (
    <button
      onClick={() => toast("Detail transaksi")}
      className="flex w-full items-center gap-3 rounded-[12px] border bg-card p-3 text-left transition-colors hover:bg-accent/40"
    >
      <div
        className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-[15px]"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">
          {tx.description ?? "—"}
        </div>
        <div className="truncate text-[11.5px] text-muted-foreground capitalize">
          {tx.type}
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
        onEdit={() => toast("✏️ Edit transaksi")}
        onDelete={onDeleteClick}
        className="ml-1"
      />
    </button>
  );
}

export default function TransaksiPage() {
  const [filter, setFilter] = useState<TxnType>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;

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
          onClick={() => toast("Form tambah transaksi")}
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
          onClick={() => toast("Tambah transaksi")}
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

      <ConfirmDeleteDialog
        label={deleteTarget !== null ? "Transaksi" : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          setDeleteTarget(null);
          toast("🗑️ Transaksi dihapus.");
        }}
      />
    </div>
  );
}
