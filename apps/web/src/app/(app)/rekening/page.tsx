"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, EllipsisVertical } from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { StatusBadge } from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CrudModal, ConfirmDeleteDialog } from "@/components/crud";
import type { CrudModalState } from "@/components/crud";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, parseRupiah } from "@/lib/format";

import type { AccountDto } from "@wealthme/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccountCard = {
  id: string;
  logo: string;
  logoBg: string;
  name: string;
  number: string;
  balanceLabel: string;
  balance: string;
  rawBalance: number;
  type: string;
  isPrivate: boolean;
};

// ---------------------------------------------------------------------------
// Brand lookup
// ---------------------------------------------------------------------------

type BrandEntry = { bg: string; label: string };

const BANK_BRANDS: Array<{ match: string; brand: BrandEntry }> = [
  { match: "bca", brand: { bg: "#0066AE", label: "BCA" } },
  { match: "mandiri", brand: { bg: "#003D79", label: "MDR" } },
  { match: "bni", brand: { bg: "#F05A22", label: "BNI" } },
  { match: "bri", brand: { bg: "#00529C", label: "BRI" } },
  { match: "cimb", brand: { bg: "#7A1F2B", label: "CIMB" } },
  { match: "permata", brand: { bg: "#00A4A6", label: "PRM" } },
  { match: "danamon", brand: { bg: "#005EB8", label: "DNM" } },
  { match: "btn", brand: { bg: "#00529C", label: "BTN" } },
  { match: "jenius", brand: { bg: "#00B0CA", label: "JEN" } },
  { match: "btpn", brand: { bg: "#00B0CA", label: "BTPN" } },
  { match: "gopay", brand: { bg: "#00AAD2", label: "GO" } },
  { match: "ovo", brand: { bg: "#4C2A86", label: "OVO" } },
  { match: "dana", brand: { bg: "#118EEA", label: "DANA" } },
  { match: "shopeepay", brand: { bg: "#EE4D2D", label: "SPay" } },
  { match: "linkaja", brand: { bg: "#E62129", label: "LINK" } },
];

function resolveBrand(institution: string | null): BrandEntry | null {
  if (!institution) return null;
  const lower = institution.toLowerCase();
  return BANK_BRANDS.find((b) => lower.includes(b.match))?.brand ?? null;
}

// ---------------------------------------------------------------------------
// Type color fallback (used when no brand matches)
// ---------------------------------------------------------------------------

const TYPE_LOGO_BG: Record<string, string> = {
  bank: "#0061AF",
  ewallet: "#10B981",
  cash: "#6B7280",
  investment: "#8B5CF6",
  property: "#F59E0B",
};

const TYPE_LABELS: Record<string, string> = {
  bank: "Tabungan",
  ewallet: "E-Wallet",
  cash: "Tunai",
  investment: "Investasi",
  property: "Properti",
};

function toLogoText(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// Data mapping
// ---------------------------------------------------------------------------

function toCardData(account: AccountDto): AccountCard {
  const rawBalance = parseFloat(account.balance);
  const brand = resolveBrand(account.institution ?? null);

  const logoBg = brand?.bg ?? TYPE_LOGO_BG[account.type] ?? "#6B7280";
  const logo =
    brand?.label ??
    (account.institution
      ? toLogoText(account.institution)
      : toLogoText(account.name));

  return {
    id: account.id,
    logo,
    logoBg,
    name: account.name,
    number: account.maskedNumber ?? "—",
    balanceLabel: "Saldo",
    balance: formatRupiah(rawBalance),
    rawBalance,
    type: account.institution
      ? `${TYPE_LABELS[account.type] ?? account.type} · ${account.institution}`
      : (TYPE_LABELS[account.type] ?? account.type),
    isPrivate: account.isPrivate,
  };
}

// ---------------------------------------------------------------------------
// AccountCardItem
// ---------------------------------------------------------------------------

interface AccountCardItemProps {
  account: AccountCard;
  onEdit: (account: AccountCard) => void;
  onDelete: () => void;
}

function AccountCardItem({ account, onEdit, onDelete }: AccountCardItemProps) {
  const router = useRouter();
  return (
    <Card className="gap-0 space-y-3.5 p-5 transition-shadow hover:shadow-md">
      {/* Header row: brand badge · name + number · status badge · kebab menu */}
      <div className="flex items-center gap-3">
        {/* Bank-branded badge — brand color + short label, or type-color + initials fallback */}
        <div
          className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold tracking-tight text-white"
          style={{ background: account.logoBg }}
        >
          {account.logo}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold">{account.name}</div>
          {/* Masked account number — already mono-styled */}
          <div className="mono text-[12px] text-muted-foreground">
            {account.number}
          </div>
        </div>

        {/*
          Status badge always shows "Aktif".
          NOTE: A real "Utama" (primary) badge requires a backend `isPrimary`
          or `status` field on AccountDto — that field does not currently exist.
          When the API adds it, replace this with conditional logic.
        */}
        <StatusBadge variant="success">Aktif</StatusBadge>
        {account.isPrivate && (
          <StatusBadge variant="purple">🔒 Privat</StatusBadge>
        )}

        {/* Kebab menu: Edit + Hapus folded out of the main action row */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Opsi rekening"
            render={
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              />
            }
          >
            <EllipsisVertical className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
            <DropdownMenuItem
              onClick={() => router.push(`/transaksi?accountId=${account.id}`)}
            >
              📄 Lihat Mutasi
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(account)}>
              ✏️ Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              🗑️ Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Balance block */}
      <div>
        <div className="text-[11px] text-muted-foreground">
          {account.balanceLabel}
        </div>
        <div className="text-[22px] font-black">{account.balance}</div>
        <div className="text-[11.5px] text-muted-foreground">
          {account.type}
        </div>
      </div>

      {/* Mutasi routes to the real transactions page. Transfer/Top Up removed
          until a backend transfer endpoint exists — no fake actions. */}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          aria-label="Lihat Mutasi"
          className="cursor-pointer rounded-md border bg-background py-2 text-[12px] font-semibold transition-colors hover:bg-accent"
          onClick={() => router.push("/transaksi")}
        >
          📋 Lihat Mutasi
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RekeningPage() {
  const { data: session } = useSession();

  useEffect(() => {
    if ((session as { error?: string } | null)?.error === "RefreshTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;

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

  const queryClient = useQueryClient();
  const [crudState, setCrudState] = useState<CrudModalState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AccountCard | null>(null);

  function openAdd() {
    setEditingId(null);
    setCrudState({ entity: "rekening", mode: "add" });
  }

  function openEdit(account: AccountCard) {
    setEditingId(account.id);
    setCrudState({
      entity: "rekening",
      mode: "edit",
      initialValues: {
        nama: account.name,
        saldo: String(account.rawBalance),
        isPrivate: String(account.isPrivate),
      },
    });
  }

  async function invalidateAccounts() {
    if (!familyGroupId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.accounts.all(familyGroupId),
    });
  }

  async function handleSubmit(
    _entity: string,
    mode: "add" | "edit",
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token) return;
    try {
      const balance = parseRupiah(values.saldo ?? "0");
      const isPrivate = values.isPrivate === "true";
      if (mode === "edit" && editingId) {
        await apiFetch(
          `/family-groups/${familyGroupId}/accounts/${editingId}`,
          {
            token,
            method: "PATCH",
            body: JSON.stringify({ name: values.nama, balance, isPrivate }),
          },
        );
        toast.success("Rekening berhasil diperbarui!");
      } else {
        await apiFetch(`/family-groups/${familyGroupId}/accounts`, {
          token,
          method: "POST",
          body: JSON.stringify({
            type: "bank",
            name: values.nama || `${values.bank} ${values.jenis}`,
            institution: values.bank,
            maskedNumber: values.norek || undefined,
            balance,
            isPrivate,
          }),
        });
        toast.success("Rekening berhasil ditambahkan!");
      }
      await invalidateAccounts();
    } catch {
      toast.error("Gagal menyimpan rekening. Coba lagi.");
    }
  }

  async function handleDeleteConfirm() {
    if (!familyGroupId || !token || !deleting) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/accounts/${deleting.id}`,
        { token, method: "DELETE" },
      );
      toast.success("Rekening berhasil dihapus.");
      await invalidateAccounts();
    } catch {
      toast.error("Gagal menghapus rekening. Coba lagi.");
    } finally {
      setDeleting(null);
    }
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
        <Button type="button" onClick={openAdd} data-tour="add-rekening">
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
            onDelete={() => setDeleting(card)}
          />
        );
      })}

      <CrudModal
        state={crudState}
        onClose={() => setCrudState(null)}
        onSubmit={handleSubmit}
      />
      <ConfirmDeleteDialog
        label={deleting ? `"${deleting.name}"` : null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
