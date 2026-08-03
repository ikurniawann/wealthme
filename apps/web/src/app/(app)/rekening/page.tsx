"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, EllipsisVertical, HandCoins, Save } from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { StatusBadge } from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { formatRupiah, parseRupiah, formatAmountInput } from "@/lib/format";

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
  // EPIC-019 Task A — per-member ownership; null = family-shared (unchanged).
  ownerUserId: string | null;
  ownerName: string | null;
};

// Minimal shape — mirrors the FamilyMember type on /akun (this page is not
// yet i18n'd, so no dictionary keys are pulled in here).
type FamilyMemberLite = {
  userId: string;
  name: string;
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
    ownerUserId: account.ownerUserId,
    ownerName: account.ownerName,
  };
}

// ---------------------------------------------------------------------------
// AccountCardItem
// ---------------------------------------------------------------------------

interface AccountCardItemProps {
  account: AccountCard;
  isMine: boolean;
  onEdit: (account: AccountCard) => void;
  onDelete: () => void;
  onMintaDana: () => void;
}

function AccountCardItem({
  account,
  isMine,
  onEdit,
  onDelete,
  onMintaDana,
}: AccountCardItemProps) {
  const router = useRouter();
  return (
    <Card
      className={`gap-0 space-y-3.5 p-5 transition-shadow hover:shadow-md ${
        isMine ? "border-primary/40 ring-1 ring-primary/15" : ""
      }`}
    >
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
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span>{account.type}</span>
          {/* EPIC-019 Task A — per-member ownership badge. Family-shared
              (ownerUserId null) accounts show no badge, unchanged. */}
          {account.ownerUserId &&
            (isMine ? (
              <StatusBadge variant="info" className="text-[10px]">
                👤 Milik Saya
              </StatusBadge>
            ) : (
              <StatusBadge variant="gray" className="text-[10px]">
                👤 {account.ownerName ?? "Anggota"}
              </StatusBadge>
            ))}
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
        {/* EPIC-019 Task B/D — a member requests funding for their OWN
            account; the owner approves via /akun (family section). */}
        {isMine && (
          <button
            type="button"
            aria-label="Minta Dana"
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={onMintaDana}
          >
            <HandCoins className="size-3.5" /> Minta Dana
          </button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Minta Dana (allowance request) dialog
// ---------------------------------------------------------------------------

function MintaDanaDialog({
  account,
  familyGroupId,
  token,
  onClose,
}: {
  account: AccountCard | null;
  familyGroupId: string | null;
  token: string | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!account} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[420px] p-6 sm:max-w-[420px]">
        {/* Keyed by account id (not an effect) so amount/note reset whenever
            a different account's "Minta Dana" button is clicked. */}
        {account && (
          <MintaDanaForm
            key={account.id}
            account={account}
            familyGroupId={familyGroupId}
            token={token}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MintaDanaForm({
  account,
  familyGroupId,
  token,
  onClose,
}: {
  account: AccountCard;
  familyGroupId: string | null;
  token: string | undefined;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  async function handleSend() {
    if (!familyGroupId || !token) return;
    const parsed = parseRupiah(amount);
    if (parsed <= 0) {
      toast.error("Masukkan jumlah yang valid.");
      return;
    }
    setIsSaving(true);
    try {
      await apiFetch(`/family-groups/${familyGroupId}/allowance-requests`, {
        token,
        method: "POST",
        body: JSON.stringify({
          targetAccountId: account.id,
          amount: parsed,
          note: note || undefined,
        }),
      });
      // So the owner's pending-requests panel (/akun) and any other view of
      // this member's own requests reflect the new request immediately.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.allowanceRequests.all(familyGroupId),
      });
      toast.success(
        "Permintaan dana terkirim. Menunggu persetujuan pemilik family.",
      );
      onClose();
    } catch {
      toast.error("Gagal mengirim permintaan dana. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-[15px] font-bold">
          Minta Dana — {account.name}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
            Jumlah
          </label>
          <div className="relative">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-[12px] font-semibold text-muted-foreground">
              Rp
            </span>
            <Input
              inputMode="numeric"
              className="pl-9 text-[13px]"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
            Catatan (opsional)
          </label>
          <Textarea
            rows={2}
            className="resize-none text-[13px]"
            placeholder="cth: uang jajan bulan ini"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <Button className="w-full" onClick={handleSend} disabled={isSaving}>
        <Save className="size-4" />{" "}
        {isSaving ? "Mengirim..." : "Kirim Permintaan"}
      </Button>
    </>
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
  const myUserId = session?.userId;

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

  // EPIC-019 Task A — family members feed the "Pemilik" select in the
  // create/edit modal (owner-only concept, but harmless to fetch always).
  const { data: familyMembers } = useQuery<FamilyMemberLite[]>({
    queryKey: [...queryKeys.familyGroups.members(familyGroupId ?? ""), token],
    queryFn: () =>
      apiFetch<FamilyMemberLite[]>(`/family-groups/${familyGroupId}/members`, {
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

  // EPIC-019 Task A — "Milik saya" filter chip. Filtered client-side over
  // the already-fetched list (the backend's `?owner=me|family|all` query
  // param is exercised by accounts.service.spec.ts; this page just needs the
  // narrower view, not a second round-trip).
  const [onlyMine, setOnlyMine] = useState(false);
  const visibleAccounts = onlyMine
    ? (accounts ?? []).filter((a) => a.ownerUserId === myUserId)
    : (accounts ?? []);

  const totalBalance = (accounts ?? []).reduce(
    (sum, a) => sum + parseFloat(a.balance),
    0,
  );

  const queryClient = useQueryClient();
  const [crudState, setCrudState] = useState<CrudModalState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AccountCard | null>(null);
  const [requesting, setRequesting] = useState<AccountCard | null>(null);

  const ownerOptions = [
    { value: "", label: "Keluarga (bersama)" },
    ...(familyMembers ?? []).map((m) => ({ value: m.userId, label: m.name })),
  ];

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
        ownerUserId: account.ownerUserId ?? "",
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
      // "" (the "Keluarga (bersama)" option) means family-shared: `null` on
      // edit (explicit clear) or simply omitted on create.
      const ownerUserId = values.ownerUserId || null;
      if (mode === "edit" && editingId) {
        await apiFetch(
          `/family-groups/${familyGroupId}/accounts/${editingId}`,
          {
            token,
            method: "PATCH",
            body: JSON.stringify({
              name: values.nama,
              balance,
              isPrivate,
              ownerUserId,
            }),
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
            ...(ownerUserId ? { ownerUserId } : {}),
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

      {/* EPIC-019 Task A — "Milik saya" filter chip. Only meaningful once at
          least one account has an owner; harmless (no-op filter) otherwise. */}
      {!isLoading && (accounts?.some((a) => a.ownerUserId) ?? false) && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOnlyMine(false)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
              !onlyMine
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:border-primary/50"
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setOnlyMine(true)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
              onlyMine
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:border-primary/50"
            }`}
          >
            👤 Milik saya
          </button>
        </div>
      )}

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

      {!isLoading && !isError && onlyMine && visibleAccounts.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-[13px] text-muted-foreground">
          Belum ada rekening yang menjadi milikmu.
        </div>
      )}

      {visibleAccounts.map((account) => {
        const card = toCardData(account);
        return (
          <AccountCardItem
            key={account.id}
            account={card}
            isMine={!!myUserId && account.ownerUserId === myUserId}
            onEdit={openEdit}
            onDelete={() => setDeleting(card)}
            onMintaDana={() => setRequesting(card)}
          />
        );
      })}

      <CrudModal
        state={crudState}
        onClose={() => setCrudState(null)}
        onSubmit={handleSubmit}
        dynamicOptions={{ ownerUserId: ownerOptions }}
      />
      <ConfirmDeleteDialog
        label={deleting ? `"${deleting.name}"` : null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteConfirm}
      />
      <MintaDanaDialog
        account={requesting}
        familyGroupId={familyGroupId ?? null}
        token={token}
        onClose={() => setRequesting(null)}
      />
    </div>
  );
}
