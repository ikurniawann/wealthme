"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge } from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CrudModal, ConfirmDeleteDialog } from "@/components/crud";
import type { CrudModalState } from "@/components/crud";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";

import type { AccountDto } from "@wealthme/contracts";

type AccountCard = {
  id: string;
  logo: string;
  logoBg: string;
  name: string;
  number: string;
  badge: { variant: "success" | "gray"; label: string };
  balanceLabel: string;
  balance: string;
  rawBalance: number;
  type: string;
};

const TYPE_LABELS: Record<string, string> = {
  bank: "Tabungan",
  ewallet: "E-Wallet",
  cash: "Tunai",
  investment: "Investasi",
  property: "Properti",
};

const TYPE_LOGO_BG: Record<string, string> = {
  bank: "#0061AF",
  ewallet: "#10B981",
  cash: "#6B7280",
  investment: "#8B5CF6",
  property: "#F59E0B",
};

function toLogoText(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);
}

function toCardData(account: AccountDto): AccountCard {
  const rawBalance = parseFloat(account.balance);
  return {
    id: account.id,
    logo: account.institution
      ? toLogoText(account.institution)
      : toLogoText(account.name),
    logoBg: TYPE_LOGO_BG[account.type] ?? "#6B7280",
    name: account.name,
    number: account.maskedNumber ?? "—",
    badge: {
      variant: "success",
      label: TYPE_LABELS[account.type] ?? account.type,
    },
    balanceLabel: "Saldo",
    balance: formatRupiah(rawBalance),
    rawBalance,
    type: account.institution
      ? `${TYPE_LABELS[account.type] ?? account.type} · ${account.institution}`
      : (TYPE_LABELS[account.type] ?? account.type),
  };
}

interface AccountCardItemProps {
  account: AccountCard;
  onEdit: (account: AccountCard) => void;
  onDelete: () => void;
}

function AccountCardItem({ account, onEdit, onDelete }: AccountCardItemProps) {
  return (
    <Card className="gap-0 space-y-3.5 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-12 items-center justify-center rounded-md text-[12px] font-extrabold text-white"
          style={{ background: account.logoBg }}
        >
          {account.logo}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold">{account.name}</div>
          <div className="mono text-[12px] text-muted-foreground">
            {account.number}
          </div>
        </div>
        <StatusBadge variant={account.badge.variant}>
          {account.badge.label}
        </StatusBadge>
      </div>

      <div>
        <div className="text-[11px] text-muted-foreground">
          {account.balanceLabel}
        </div>
        <div className="text-[22px] font-black">{account.balance}</div>
        <div className="text-[11.5px] text-muted-foreground">
          {account.type}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-label="Transfer"
          className="cursor-pointer rounded-md border bg-background px-3 py-2 text-[12px] font-semibold transition-colors hover:bg-accent"
          onClick={() => toast("Transfer")}
        >
          ↗ Transfer
        </button>
        <button
          type="button"
          aria-label="Lihat Mutasi"
          className="cursor-pointer rounded-md border bg-background px-3 py-2 text-[12px] font-semibold transition-colors hover:bg-accent"
          onClick={() => toast("Mutasi")}
        >
          📋 Mutasi
        </button>
        <button
          type="button"
          aria-label="Edit rekening"
          className="cursor-pointer rounded-md border bg-background px-3 py-2 text-[12px] font-semibold transition-colors hover:bg-accent"
          onClick={() => onEdit(account)}
        >
          ✏️ Edit
        </button>
        <button
          type="button"
          aria-label="Hapus rekening"
          className="cursor-pointer rounded-md border bg-background px-3 py-2 text-[12px] font-semibold text-destructive transition-colors hover:bg-accent"
          onClick={onDelete}
        >
          🗑️ Hapus
        </button>
      </div>
    </Card>
  );
}

export default function RekeningPage() {
  const { data: session } = useSession();

  useEffect(() => {
    if ((session as { error?: string } | null)?.error === "RefreshTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.user?.memberships?.[0]?.familyGroupId;

  const {
    data: accounts,
    isLoading,
    isError,
  } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const { data: fxRates } = useQuery({
    queryKey: queryKeys.fx.rates("IDR"),
    queryFn: () =>
      apiFetch<{ base: string; rates: Record<string, number> }>(
        "/fx/rates?base=IDR",
      ),
    staleTime: 5 * 60 * 1000,
  });

  const totalBalance = (accounts ?? []).reduce(
    (sum, a) => sum + parseFloat(a.balance),
    0,
  );

  const [crudState, setCrudState] = useState<CrudModalState | null>(null);
  const [deleteLabel, setDeleteLabel] = useState<string | null>(null);

  function openAdd() {
    setCrudState({ entity: "rekening", mode: "add" });
  }

  function openEdit(account: AccountCard) {
    setCrudState({
      entity: "rekening",
      mode: "edit",
      initialValues: { nama: account.name, saldo: String(account.rawBalance) },
    });
  }

  function openDelete() {
    setDeleteLabel("Rekening");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[13px] font-bold">
            {isLoading
              ? "Memuat..."
              : `${accounts?.length ?? 0} Rekening Terhubung`}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {!isLoading && accounts && (
              <>
                {`Total: ${formatRupiah(totalBalance)}`}
                {fxRates?.rates["USD"] != null && (
                  <span className="ml-2 text-muted-foreground/70">
                    {`≈ USD ${(totalBalance * fxRates.rates["USD"]).toFixed(2)}`}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <Button type="button" onClick={openAdd}>
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
        >
          <span className="font-semibold">Kesalahan: </span>Gagal memuat
          rekening. Silakan refresh halaman.
        </div>
      )}

      {!isLoading && !isError && accounts?.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-[13px] text-muted-foreground">
          Belum ada rekening.{" "}
          <button
            type="button"
            className="font-semibold text-primary"
            onClick={openAdd}
          >
            Tambah sekarang
          </button>
        </div>
      )}

      {accounts?.map((account) => {
        const card = toCardData(account);
        return (
          <AccountCardItem
            key={account.id}
            account={card}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        );
      })}

      <CrudModal state={crudState} onClose={() => setCrudState(null)} />
      <ConfirmDeleteDialog
        label={deleteLabel}
        onClose={() => setDeleteLabel(null)}
        onConfirm={() => {
          setDeleteLabel(null);
          toast("🗑️ Rekening dihapus.");
        }}
      />
    </div>
  );
}
