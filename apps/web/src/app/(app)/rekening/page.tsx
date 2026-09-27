"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  EllipsisVertical,
  HandCoins,
  Landmark,
  Users,
  User,
  List,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { StatusBadge, SummaryCard } from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  CrudModal,
  ConfirmDeleteDialog,
  RowActions,
  withCrudFx,
} from "@/components/crud";
import type { CrudModalState } from "@/components/crud";
import { AccountTaxNotice } from "@/components/tax/account-tax-notice";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { useMyRole } from "@/hooks/use-my-role";
import { MintaDanaDialog } from "@/components/allowance/minta-dana-dialog";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, parseRupiah } from "@/lib/format";

import type { AccountDto } from "@wealthme/contracts";

// EPIC-022 A2 — "Data Kas bisa minus": `parseRupiah` (lib/format.ts, a
// protected foundation file) strips every non-digit character including a
// leading "-", so it can never round-trip a negative cash balance. This
// page-local helper mirrors /dana's (see WM_CONVENTIONS.md — inline a helper
// here instead of touching lib/*) and is only used for the `cash` entity
// below; every other account type keeps using the shared `parseRupiah`.
function parseSignedRupiah(value: string | null | undefined): number {
  if (!value) return 0;
  const isNegative = value.trim().startsWith("-");
  const digits = parseInt(value.replace(/\D/g, ""), 10) || 0;
  return isNegative ? -digits : digits;
}

// Batch 2 (#7) — the indicative USD total below used a bare `toFixed(2)`
// ("USD 16308.70"), the only un-grouped currency figure on this page while
// the Rupiah total right next to it goes through `formatRupiah`'s grouped
// `toLocaleString`. `lib/format.ts` is a protected foundation file, so this
// page-local helper follows the same "inline instead of touching lib/*"
// convention as `parseSignedRupiah` above rather than adding a sibling
// export there.
function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// EPIC-022 F — the API's ConflictException carries a message the user can act
// on (e.g. a duplicate account name); the generic toast threw it away and
// left "Coba lagi" as the only guidance. Prefer the server's message and fall
// back only when there isn't one.
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// EPIC-025 N3 audit fix — "two account cards render a raw UUID/hash as the
// account subtitle, overflowing the card". Root cause: `Account.maskedNumber`
// is AES-256-GCM encrypted at rest (`apps/api/src/crypto/crypto.service.ts`,
// `decrypt()`). When decryption fails — a stale/rotated `ENCRYPTION_KEY`, a
// row written before encryption was added, or a corrupted value — `decrypt()`
// deliberately falls back to returning the raw `iv:authTag:ciphertext` hex
// blob AS-IS (logged as a warning) instead of throwing, and that blob is what
// lands in `AccountDto.maskedNumber` and gets rendered verbatim as the
// account subtitle. That backend key/data issue is out of scope for this
// page-only PR (see the code-agent report), so this page defensively detects
// that specific undecrypted-blob shape (three colon-separated hex runs sized
// like iv (12B/24 hex) + authTag (16B/32 hex) + ciphertext) and hides it — a
// real masked number ("···9010") never matches this shape.
const UNDECRYPTED_BLOB_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;
function safeMaskedNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  return UNDECRYPTED_BLOB_RE.test(value) ? null : value;
}

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
  // EPIC-022 A2 — the original `AccountDto.type` ("bank" | "ewallet" | "cash"
  // | "investment" | "property"), kept alongside the display-formatted
  // `type` string above so edit routing can branch on it (a `cash` account
  // must open the "cash" CRUD entity — see `openEdit` — instead of the
  // "Rekening Bank" form, whose "Saldo" field can't round-trip a negative
  // balance).
  rawType: string;
  isPrivate: boolean;
  // EPIC-019 Task A — per-member ownership; null = family-shared (unchanged).
  ownerUserId: string | null;
  ownerName: string | null;
  // F6 — the raw (unformatted) institution + account number, so `openEdit`
  // can prefill "Nama Bank"/"Nomor Rekening" instead of always defaulting to
  // the select's first option / a blank field regardless of the real data.
  institution: string | null;
  rawMaskedNumber: string | null;
};

// Minimal shape — mirrors the FamilyMember type on /akun.
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

function toCardData(
  account: AccountDto,
  t: ReturnType<typeof useLocale>["t"],
): AccountCard {
  const rawBalance = parseFloat(account.balance);
  const brand = resolveBrand(account.institution ?? null);

  const logoBg = brand?.bg ?? TYPE_LOGO_BG[account.type] ?? "#6B7280";
  const logo =
    brand?.label ??
    (account.institution
      ? toLogoText(account.institution)
      : toLogoText(account.name));

  const typeLabels: Record<string, string> = t.rekening.typeLabels;
  const typeLabel = typeLabels[account.type] ?? account.type;

  return {
    id: account.id,
    logo,
    logoBg,
    name: account.name,
    number: safeMaskedNumber(account.maskedNumber) ?? "—",
    balanceLabel: t.rekening.balanceLabel,
    balance: formatRupiah(rawBalance),
    rawBalance,
    type: account.institution
      ? `${typeLabel} · ${account.institution}`
      : typeLabel,
    rawType: account.type,
    isPrivate: account.isPrivate,
    ownerUserId: account.ownerUserId,
    ownerName: account.ownerName,
    institution: account.institution ?? null,
    rawMaskedNumber: safeMaskedNumber(account.maskedNumber),
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
  /** EPIC-033 R5 — members ask for money FROM a family-shared account. */
  canRequest: boolean;
  canManage: boolean;
}

function AccountCardItem({
  account,
  isMine,
  onEdit,
  onDelete,
  onMintaDana,
  canRequest,
  canManage,
}: AccountCardItemProps) {
  const router = useRouter();
  const { t } = useLocale();
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
        <StatusBadge variant="success">{t.rekening.activeBadge}</StatusBadge>
        {account.isPrivate && (
          <span title={t.rekening.privateBadgeTooltip}>
            <StatusBadge variant="purple">
              {t.rekening.privateBadge}
            </StatusBadge>
          </span>
        )}

        {/* Kebab menu: Edit + Hapus folded out of the main action row */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t.rekening.optionsAriaLabel}
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
              onClick={() =>
                router.push(
                  `/transaksi?accountId=${encodeURIComponent(account.id)}`,
                )
              }
            >
              {t.rekening.viewMutationMenuItem}
            </DropdownMenuItem>
            {/* F3 — CASL grants "manage Account" only to owner/spouse; every
                other role (including the account's own "isMine" owner, if a
                plain member) gets 403 on edit/delete. */}
            {canManage && (
              <>
                <DropdownMenuItem onClick={() => onEdit(account)}>
                  {t.rekening.editMenuItem}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  {t.rekening.deleteMenuItem}
                </DropdownMenuItem>
              </>
            )}
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
              (ownerUserId null) accounts are labelled "Bersama" so it is
              clear who they belong to — restricted members can now see them
              (read-only). */}
          {!account.ownerUserId && (
            <StatusBadge variant="purple" className="text-[10px]">
              {t.rekening.filterSharedLabel}
            </StatusBadge>
          )}
          {account.ownerUserId &&
            (isMine ? (
              <StatusBadge variant="info" className="text-[10px]">
                {t.rekening.ownerMineBadge}
              </StatusBadge>
            ) : (
              <StatusBadge variant="gray" className="text-[10px]">
                {t.rekening.ownerBadgePrefix}
                {account.ownerName ?? t.rekening.ownerUnknownLabel}
              </StatusBadge>
            ))}
        </div>
      </div>

      {/* Prototype structural port (EPIC-025 N3 audit) — footer row: a
          "Mutasi" action (routes to the real transactions page; Transfer/Top
          Up stay out until a backend transfer endpoint exists — no fake
          actions) plus edit/delete icon buttons (same `RowActions` used by
          every other list row in the app), replacing the old full-width
          "Lihat Mutasi" button. The kebab menu above keeps its own
          Edit/Hapus entries too — same redundancy as the prototype (a kebab
          AND footer icon actions both open the same flows). */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t.rekening.viewMutationAriaLabel}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-background py-2 text-[12px] font-semibold transition-colors hover:bg-accent"
          onClick={() =>
            router.push(
              `/transaksi?accountId=${encodeURIComponent(account.id)}`,
            )
          }
        >
          <List className="size-3.5" /> {t.rekening.mutasiFooterButton}
        </button>
        {canManage && (
          <RowActions onEdit={() => onEdit(account)} onDelete={onDelete} />
        )}
      </div>
      {/* EPIC-033 R5 — a member requests funding FROM this family-shared
          account into one of their own; the Master approves on /persetujuan. */}
      {canRequest && (
        <button
          type="button"
          aria-label={t.rekening.mintaDanaButtonLabel}
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={onMintaDana}
        >
          <HandCoins className="size-3.5" /> {t.rekening.mintaDanaButtonLabel}
        </button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RekeningPage() {
  const { t } = useLocale();
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

  // EPIC-019 Task A — "Milik saya" filter chip, extended (N3-D3, prototype
  // rekening.html) with a "Bersama" (family-shared) chip alongside it.
  // Filtered client-side over the already-fetched list (the backend's
  // `?owner=me|family|all` query param is exercised by
  // accounts.service.spec.ts; this page just needs the narrower view, not a
  // second round-trip).
  const [ownerFilter, setOwnerFilter] = useState<"all" | "mine" | "shared">(
    "all",
  );
  // EPIC-025 N3 audit fix (SCOPE BUG) — the prototype restricts this page
  // to BANK accounts only (e-wallets belong on /dana). This page's own
  // `rekening.test.tsx` (EPIC-022 A2) locks in editing a `cash`-typed
  // account THROUGH this page — that test's fixture defaults to
  // `type: "cash"` and asserts it renders here — so a strict bank-only
  // filter would fail that test outright. Compromise, documented rather
  // than silently narrowed: exclude only `ewallet` (the unambiguous leak
  // visible in the audit's screenshot — GoPay/OVO) and `investment`/
  // `property` (which have their own dedicated pages), while `cash` stays
  // visible here until that regression test's fixture is revisited.
  // EPIC-033 p24 — cash lives on Cash & E-Wallet, not here.
  const RENDERED_TYPES = new Set(["bank"]);
  const scopedAccounts = (accounts ?? []).filter((a) =>
    RENDERED_TYPES.has(a.type),
  );

  const onlyMine = ownerFilter === "mine";
  const visibleAccounts = scopedAccounts.filter((a) => {
    if (ownerFilter === "mine") return a.ownerUserId === myUserId;
    if (ownerFilter === "shared") return a.ownerUserId === null;
    return true;
  });

  const totalBalance = scopedAccounts.reduce(
    (sum, a) => sum + parseFloat(a.balance),
    0,
  );
  // N3-D3 (prototype rekening.html "auto-grid--metrics") — Saldo Bank /
  // Rekening Bersama / Milik Anggota all derive from the same already-
  // fetched accounts list, no new endpoint needed.
  const sharedBalance = scopedAccounts
    .filter((a) => a.ownerUserId === null)
    .reduce((sum, a) => sum + parseFloat(a.balance), 0);
  const ownedBalance = totalBalance - sharedBalance;
  const sharedCount = scopedAccounts.filter(
    (a) => a.ownerUserId === null,
  ).length;
  const ownedCount = scopedAccounts.length - sharedCount;

  const queryClient = useQueryClient();
  const { canManage } = useCanManage("Account");
  const [crudState, setCrudState] = useState<CrudModalState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AccountCard | null>(null);
  const [requesting, setRequesting] = useState<AccountDto | null>(null);
  // EPIC-033 R2/R5 — only members request; Master/Co-Master approve.
  const { myRole } = useMyRole();
  const isMasterLike = myRole === "owner" || myRole === "spouse";

  // EPIC-033 R3 follow-up — a member who is not Master/Co-Master can only
  // own the accounts they create; the picker collapses to themselves (the
  // API enforces the same rule).
  const ownerOptions = isMasterLike
    ? [
        { value: "", label: t.rekening.ownerSelectFamilyLabel },
        ...(familyMembers ?? []).map((m) => ({
          value: m.userId,
          label: m.name,
        })),
      ]
    : (familyMembers ?? [])
        .filter((m) => m.userId === myUserId)
        .map((m) => ({ value: m.userId, label: m.name }));

  function openAdd() {
    setEditingId(null);
    setCrudState({
      entity: "rekening",
      mode: "add",
      ...(isMasterLike || !myUserId
        ? {}
        : { initialValues: { ownerUserId: myUserId } }),
    });
  }

  function openEdit(account: AccountCard) {
    setEditingId(account.id);
    // EPIC-022 A2 — a `cash` account must use the "cash" CRUD entity (same
    // one /dana already uses correctly): its "Saldo" field is the only
    // "amount" field configured with `allowNegative`, so a negative balance
    // pre-fills with its sign intact instead of silently displaying (and
    // then re-saving) as positive. The "Rekening Bank" form's bank/norek/
    // jenis fields don't apply to a cash account either way.
    if (account.rawType === "cash") {
      setCrudState({
        entity: "cash",
        mode: "edit",
        initialValues: {
          nama: account.name,
          saldo: String(account.rawBalance),
        },
      });
      return;
    }
    // CrudModal keeps a stored bank selectable even when it is not in Master Data.
    const bank = account.institution || "Bank Lainnya";
    setCrudState({
      entity: "rekening",
      mode: "edit",
      initialValues: {
        bank,
        nama: account.name,
        norek: account.rawMaskedNumber ?? "",
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
    entity: string,
    mode: "add" | "edit",
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token) return;
    // EPIC-022 A2 — cash accounts round-trip through the "cash" CRUD entity
    // (see `openEdit`): parse the balance signed (so a negative cash balance
    // survives an untouched edit) and resend `type: "cash"` even though this
    // is a partial update, because `UpdateAccountDto.balance`'s negative-
    // balance allowance is gated on `type` — omitting it makes the API see
    // `type: undefined !== "cash"` and reject/clamp the balance to >= 0.
    if (entity === "cash" && mode === "edit" && editingId) {
      try {
        const balance = parseSignedRupiah(values.saldo ?? "0");
        await apiFetch(
          `/family-groups/${familyGroupId}/accounts/${editingId}`,
          {
            token,
            method: "PATCH",
            body: JSON.stringify(
              withCrudFx({ name: values.nama, balance, type: "cash" }, values, {
                saldo: "balance",
              }),
            ),
          },
        );
        toast.success(t.rekening.toastUpdated);
        await invalidateAccounts();
      } catch (err: unknown) {
        // F2 — rethrow so CrudModal's `await onSubmit(...)` rejects and
        // skips its own `onClose()`; a failed save must not discard the
        // user's input by closing the modal as if it had succeeded.
        toast.error(extractApiErrorMessage(err, t.rekening.toastSaveFailed));
        throw err;
      }
      return;
    }
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
            body: JSON.stringify(
              withCrudFx(
                {
                  name: values.nama,
                  // F6 — "Nama Bank"/"Nomor Rekening" used to be dropped
                  // here entirely: an edit to either field was accepted by
                  // the form and silently discarded on save.
                  institution: values.bank || undefined,
                  maskedNumber: values.norek || undefined,
                  balance,
                  isPrivate,
                  ownerUserId,
                },
                values,
                { saldo: "balance" },
              ),
            ),
          },
        );
        toast.success(t.rekening.toastUpdated);
      } else {
        await apiFetch(`/family-groups/${familyGroupId}/accounts`, {
          token,
          method: "POST",
          body: JSON.stringify(
            withCrudFx(
              {
                type: "bank",
                name: values.nama || `${values.bank} ${values.jenis}`,
                institution: values.bank,
                maskedNumber: values.norek || undefined,
                balance,
                isPrivate,
                ...(ownerUserId ? { ownerUserId } : {}),
              },
              values,
              { saldo: "balance" },
            ),
          ),
        });
        toast.success(t.rekening.toastAdded);
      }
      await invalidateAccounts();
    } catch (err: unknown) {
      // F2 — same rethrow as the cash branch above.
      toast.error(extractApiErrorMessage(err, t.rekening.toastSaveFailed));
      throw err;
    }
  }

  async function handleDeleteConfirm() {
    if (!familyGroupId || !token || !deleting) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/accounts/${deleting.id}`,
        { token, method: "DELETE" },
      );
      toast.success(t.rekening.toastDeleted);
      await invalidateAccounts();
    } catch (err: unknown) {
      toast.error(extractApiErrorMessage(err, t.rekening.toastDeleteFailed));
    } finally {
      setDeleting(null);
    }
  }

  // Prototype structural port — header "Minta Dana" action. Reuses the
  // EPIC-033 R5 — every account the member owns (bank, cash, e-wallet) is a
  // valid destination for a fund request.
  const myAccounts = (accounts ?? []).filter(
    (a) => !!myUserId && a.ownerUserId === myUserId,
  );

  return (
    <div className="space-y-4">
      {/* Prototype structural port (EPIC-025 N3 audit) — page-lead header:
          title, subtitle (accounts count + total, already computed above),
          and the header actions. */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="text-[17px] font-extrabold tracking-tight">
            {t.shell.pageTitles.rekening}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {isLoading
              ? t.rekening.loadingLabel
              : `${scopedAccounts.length}${t.rekening.accountsConnectedSuffix} · ${t.rekening.totalPrefix}${formatRupiah(totalBalance)}`}
            {!isLoading && accounts && fxRates?.rates["USD"] != null && (
              <span className="ml-1 text-muted-foreground/70">
                {`${t.rekening.approxUsdPrefix}${formatUsd(totalBalance * fxRates.rates["USD"])}`}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button type="button" onClick={openAdd}>
              <Plus className="size-4" /> {t.rekening.addButton}
            </Button>
          )}
        </div>
      </div>

      {/* N3-D3 (prototype rekening.html "auto-grid--metrics") — Saldo Bank /
          Rekening Bersama / Milik Anggota, all derived from the already-
          fetched accounts list above. The prototype's balance-trend
          sparkline is CUT per the epic's J3 decision table (no balance
          history stored). Muted count sub-text is composed INTO `amount`
          (not passed as `delta`) so it never inherits SummaryCard's forced
          success/destructive delta coloring — these are neutral counts, not
          a trend, and the prototype renders them muted/gray, not red. */}
      {!isLoading && !isError && scopedAccounts.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <SummaryCard
            icon={<Landmark className="size-4" />}
            iconBg="var(--accent)"
            iconColor="var(--accent-foreground)"
            label={t.rekening.statBankBalanceLabel}
            amount={formatRupiah(totalBalance)}
          />
          <SummaryCard
            icon={<Users className="size-4" />}
            iconBg="var(--brand-purple-soft)"
            iconColor="var(--brand-purple)"
            label={t.rekening.statSharedLabel}
            amount={
              <>
                {formatRupiah(sharedBalance)}
                <span className="mt-[3px] block text-[10.5px] font-medium text-muted-foreground">
                  {`${sharedCount}${t.rekening.statSharedDeltaSuffix}`}
                </span>
              </>
            }
          />
          <SummaryCard
            icon={<User className="size-4" />}
            iconBg="var(--success-soft)"
            iconColor="var(--success)"
            label={t.rekening.statOwnedLabel}
            amount={
              <>
                {formatRupiah(ownedBalance)}
                <span className="mt-[3px] block text-[10.5px] font-medium text-muted-foreground">
                  {`${ownedCount}${t.rekening.statOwnedDeltaSuffix}`}
                </span>
              </>
            }
          />
        </div>
      )}

      {/* EPIC-019 Task A — ownership filter tabs ("Milik saya" originally;
          N3-D3 adds "Bersama" per the prototype's 3-tab filter). Restyled
          (N3 audit) to the epic's translation-table mapping for `.tabs`/
          `.tab` — role="tablist"/"tab" + aria-selected, same logic. Only
          meaningful once at least one account has an owner; still rendered
          on shared-only demo data so the page matches the prototype controls. */}
      {!isLoading && (
        <div className="flex min-w-0 items-center gap-2">
          <div
            role="tablist"
            aria-label={t.rekening.filterGroupLabel}
            className="hide-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={ownerFilter === "all"}
              onClick={() => setOwnerFilter("all")}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                ownerFilter === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t.rekening.filterAllLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={ownerFilter === "mine"}
              onClick={() => setOwnerFilter("mine")}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                ownerFilter === "mine"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:border-primary/50"
              }`}
            >
              <User className="size-3" /> {t.rekening.filterMineLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={ownerFilter === "shared"}
              onClick={() => setOwnerFilter("shared")}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                ownerFilter === "shared"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:border-primary/50"
              }`}
            >
              <Users className="size-3" /> {t.rekening.filterSharedLabel}
            </button>
          </div>
          {/* polish-j batch 7a item 11 — the negative-balance rule used to
              sit as always-visible text; it's context, not something every
              visitor needs to read, so it's now an info tooltip. */}
          <Tooltip>
            <TooltipTrigger
              aria-label={t.rekening.filterNoteText}
              className="hidden shrink-0 text-muted-foreground md:inline-flex"
            >
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>{t.rekening.filterNoteText}</TooltipContent>
          </Tooltip>
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
        >
          <span className="font-semibold">{t.rekening.errorPrefixLabel}</span>
          {t.rekening.errorLoadBody}
        </div>
      )}

      {!isLoading && !isError && scopedAccounts.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-[13px] text-muted-foreground">
          {t.rekening.emptyStatePrefix}
          {canManage && (
            <button
              type="button"
              className="font-semibold text-primary"
              onClick={openAdd}
            >
              {t.rekening.addNowButton}
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && onlyMine && visibleAccounts.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-[13px] text-muted-foreground">
          {t.rekening.emptyMineState}
        </div>
      )}

      {/* N3-D3 (prototype rekening.html "auto-grid--cards") — a responsive
          card grid instead of a single stacked column, plus (N3 audit) a
          dashed "add account" card at the end of the grid. */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {visibleAccounts.map((account) => {
          const card = toCardData(account, t);
          return (
            <AccountCardItem
              key={account.id}
              account={card}
              isMine={!!myUserId && account.ownerUserId === myUserId}
              onEdit={openEdit}
              onDelete={() => setDeleting(card)}
              onMintaDana={() => setRequesting(account)}
              canRequest={!isMasterLike && account.ownerUserId === null}
              canManage={!!canManage}
            />
          );
        })}
        {!isLoading && !isError && canManage && (
          <button
            type="button"
            onClick={openAdd}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Landmark className="size-5" />
            </span>
            <span className="text-[13px] font-bold">
              {t.rekening.addCardTitle}
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {t.rekening.addCardSubtitle}
            </span>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">
              <Plus className="size-3.5" /> {t.rekening.addCardButton}
            </span>
          </button>
        )}
      </div>

      <CrudModal
        state={crudState}
        onClose={() => setCrudState(null)}
        onSubmit={handleSubmit}
        dynamicOptions={{ ownerUserId: ownerOptions }}
      />
      {/* EPIC-026 Wave 3 — prototype `dlg-rekening-hapus`
          (docs/prototype/pages/rekening.html) supplies the title, body and
          confirm label; the shared `ConfirmDeleteDialog` already renders the
          prototype's `dialog--sm` confirm shape (outline Batal + destructive
          confirm), so only the copy is overridden here. */}
      <ConfirmDeleteDialog
        label={deleting ? `"${deleting.name}"` : null}
        title={t.rekening.deleteDialogTitle}
        body={t.rekening.deleteDialogBody}
        confirmLabel={t.rekening.deleteDialogConfirm}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteConfirm}
      />
      <MintaDanaDialog
        source={requesting}
        targets={myAccounts}
        familyGroupId={familyGroupId ?? null}
        token={token}
        onClose={() => setRequesting(null)}
      />
      <AccountTaxNotice />
    </div>
  );
}
