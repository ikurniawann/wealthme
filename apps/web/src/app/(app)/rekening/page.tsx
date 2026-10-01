"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  EllipsisVertical,
  HandCoins,
  Landmark,
  List,
  Palette,
  GitCompare,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  InfoTip,
  AccountCard,
  BentoCard,
  BentoGrid,
  BentoHero,
  CardSkinPanel,
  GhostButton,
  HeroKpi,
  useCardLooks,
  type CardLook,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { useShell } from "@/components/shell/shell-context";
import Link from "next/link";
import "./rekening.css";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CrudModal, ConfirmDeleteDialog, withCrudFx } from "@/components/crud";
import type { CrudModalState } from "@/components/crud";
import { AccountTaxNotice } from "@/components/tax/account-tax-notice";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { useMyRole } from "@/hooks/use-my-role";
import { MintaDanaDialog } from "@/components/allowance/minta-dana-dialog";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { parseRupiah } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";

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
/** Axis ticks: "200 jt" / "1,5 M", no currency or decimals. */
function axisJt(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const trim = (n: number) =>
    n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)} M`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)} jt`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)} rb`;
  return `${sign}${Math.round(abs)}`;
}

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
  const rawBalance = parseFloat(account.balance ?? "0");
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
  onCustomize: (account: AccountCard) => void;
  look: CardLook;
  canManage: boolean;
}

function AccountCardItem({
  account,
  isMine,
  onEdit,
  onDelete,
  onMintaDana,
  onCustomize,
  look,
  canRequest,
  canManage,
}: AccountCardItemProps) {
  const router = useRouter();
  const { t } = useLocale();
  const money = useMoney();
  const goMutasi = () =>
    router.push(`/transaksi?accountId=${encodeURIComponent(account.id)}`);
  const ownerBadge = !account.ownerUserId ? (
    <span className="wm-plate-badge">{t.rekening.filterSharedLabel}</span>
  ) : isMine ? (
    <span className="wm-plate-badge">{t.rekening.ownerMineBadge}</span>
  ) : (
    <span className="wm-plate-badge">
      {t.rekening.ownerBadgePrefix}
      {account.ownerName ?? t.rekening.ownerUnknownLabel}
    </span>
  );
  return (
    <article className="rk-card" data-mine={isMine || undefined}>
      <AccountCard
        look={look}
        bank={account.institution ?? account.logo}
        name={account.name}
        number={
          account.rawMaskedNumber
            ? `**** ${account.rawMaskedNumber.replace(/^[·•.\s]+/, "")}`
            : null
        }
        holder={account.type}
        balance={money.format(account.rawBalance).replace(/,00$/, "")}
        badge={
          <span className="rk-card-badges">
            {account.isPrivate && (
              <span
                className="wm-plate-badge"
                title={t.rekening.privateBadgeTooltip}
              >
                {t.rekening.privateBadge}
              </span>
            )}
            {ownerBadge}
          </span>
        }
      />
      <div className="rk-card-acts">
        <button
          type="button"
          aria-label={t.rekening.viewMutationAriaLabel}
          className="rk-card-btn"
          onClick={goMutasi}
        >
          <List aria-hidden="true" /> {t.rekening.mutasiFooterButton}
        </button>
        {canRequest && (
          <button
            type="button"
            aria-label={t.rekening.mintaDanaButtonLabel}
            className="rk-card-btn"
            data-lit="true"
            onClick={onMintaDana}
          >
            <HandCoins aria-hidden="true" /> {t.rekening.mintaDanaButtonLabel}
          </button>
        )}
        <button
          type="button"
          className="rk-card-icon"
          aria-label={t.rekening.v2.customize}
          title={t.rekening.v2.customize}
          onClick={() => onCustomize(account)}
        >
          <Palette aria-hidden="true" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t.rekening.optionsAriaLabel}
            render={<button type="button" className="rk-card-icon" />}
          >
            <EllipsisVertical aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem onClick={goMutasi}>
              {t.rekening.viewMutationMenuItem}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCustomize(account)}>
              {t.rekening.v2.customize}
            </DropdownMenuItem>
            {/* F3 — CASL grants "manage Account" only to owner/spouse. */}
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
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RekeningPage() {
  const { t } = useLocale();
  const money = useMoney();
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
    (sum, a) => sum + parseFloat(a.balance ?? "0"),
    0,
  );
  // N3-D3 (prototype rekening.html "auto-grid--metrics") — Saldo Bank /
  // Rekening Bersama / Milik Anggota all derive from the same already-
  // fetched accounts list, no new endpoint needed.
  const sharedBalance = scopedAccounts
    .filter((a) => a.ownerUserId === null)
    .reduce((sum, a) => sum + parseFloat(a.balance ?? "0"), 0);
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
  const { setTxnOpen } = useShell();
  const { lookFor, setLook } = useCardLooks();
  const [customizing, setCustomizing] = useState<AccountCard | null>(null);
  const myAccounts = (accounts ?? []).filter(
    (a) => !!myUserId && a.ownerUserId === myUserId,
  );

  return (
    <div className="flex flex-col gap-4">
      <BentoGrid className="rk-grid">
        <h1 className="sr-only">{t.shell.pageTitles.rekening}</h1>
        <BentoHero
          className="rk-hero"
          currency={null}
          value={
            isLoading ? "…" : money.format(totalBalance).replace(/,00$/, "")
          }
          caption={
            <>
              {`${scopedAccounts.length}${t.rekening.accountsConnectedSuffix}`}
              {!isLoading &&
                fxRates?.rates["USD"] != null &&
                ` · ${t.rekening.approxUsdPrefix}${formatUsd(totalBalance * fxRates.rates["USD"])}`}
            </>
          }
          controls={
            <>
              <div
                role="tablist"
                aria-label={t.rekening.filterGroupLabel}
                className="wm-seg"
              >
                {(
                  [
                    ["all", t.rekening.filterAllLabel],
                    ["mine", t.rekening.filterMineLabel],
                    ["shared", t.rekening.filterSharedLabel],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={ownerFilter === value}
                    onClick={() => setOwnerFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {canManage && (
                <GhostButton lit onClick={openAdd}>
                  <Plus aria-hidden="true" /> {t.rekening.addButton}
                </GhostButton>
              )}
              <InfoTip label={t.rekening.filterNoteText}>
                {t.rekening.filterNoteText}
              </InfoTip>
            </>
          }
          chart={
            visibleAccounts.length > 0 ? (
              <HatchedBarChart
                labels={visibleAccounts.map((a) => a.institution || a.name)}
                series={[
                  {
                    name: t.rekening.balanceLabel,
                    data: visibleAccounts.map((a) =>
                      parseFloat(a.balance ?? "0"),
                    ),
                    color: "var(--wm-lime)",
                  },
                ]}
                highlight={visibleAccounts.reduce(
                  (m, a, i, arr) =>
                    parseFloat(a.balance ?? "0") >
                    parseFloat(arr[m].balance ?? "0")
                      ? i
                      : m,
                  0,
                )}
                format={money.formatCompact}
                axis={axisJt}
                wide
                ariaLabel={t.rekening.statBankBalanceLabel}
              />
            ) : null
          }
          kpis={
            <>
              <HeroKpi
                label={t.rekening.statBankBalanceLabel}
                value={money.format(totalBalance).replace(/,00$/, "")}
                short={money.formatCompact(totalBalance)}
              />
              <HeroKpi
                label={t.rekening.statSharedLabel}
                value={money.format(sharedBalance).replace(/,00$/, "")}
                short={money.formatCompact(sharedBalance)}
                delta={
                  <small className="wm-cap">{`${sharedCount}${t.rekening.statSharedDeltaSuffix}`}</small>
                }
              />
              <HeroKpi
                label={t.rekening.statOwnedLabel}
                value={money.format(ownedBalance).replace(/,00$/, "")}
                short={money.formatCompact(ownedBalance)}
                delta={
                  <small className="wm-cap">{`${ownedCount}${t.rekening.statOwnedDeltaSuffix}`}</small>
                }
              />
            </>
          }
        />
        <BentoCard
          className="rk-deck"
          title={t.rekening.v2.cardsTitle}
          caption={`${visibleAccounts.length}${t.rekening.accountsConnectedSuffix}`}
        >
          {visibleAccounts.length > 0 && (
            <div className="wm-pcards rk-pcards">
              {visibleAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  decorative
                  className="rk-deck-card"
                  look={lookFor(account.id, account.type)}
                  bank={account.institution ?? account.name}
                  name={account.name}
                  number={safeMaskedNumber(account.maskedNumber)}
                  holder={
                    account.isPrivate
                      ? t.rekening.privateBadge
                      : (account.ownerName ?? "")
                  }
                  balance={money.formatCompact(
                    parseFloat(account.balance ?? "0"),
                  )}
                />
              ))}
            </div>
          )}
          <div className="rk-qa">
            <button type="button" onClick={() => setTxnOpen(true)}>
              <span>
                <Plus aria-hidden="true" />
              </span>
              {t.rekening.v2.record}
            </button>
            <Link href="/rekonsiliasi">
              <span>
                <GitCompare aria-hidden="true" />
              </span>
              {t.rekening.v2.reconcile}
            </Link>
            <Link href="/transaksi">
              <span>
                <History aria-hidden="true" />
              </span>
              {t.rekening.v2.mutations}
            </Link>
            {canManage && (
              <button type="button" onClick={openAdd}>
                <span>
                  <Landmark aria-hidden="true" />
                </span>
                {t.rekening.addButton}
              </button>
            )}
          </div>
        </BentoCard>
      </BentoGrid>

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
      <h2 className="rk-list-title">{t.rekening.v2.allTitle}</h2>
      <div className="rk-wall">
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
              look={lookFor(account.id, account.type)}
              onCustomize={setCustomizing}
            />
          );
        })}
        {!isLoading && !isError && canManage && (
          <button type="button" onClick={openAdd} className="rk-add">
            <Plus aria-hidden="true" />
            {t.rekening.addCardTitle}
            <small className="wm-cap">{t.rekening.addCardSubtitle}</small>
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
      <CardSkinPanel
        preview={
          customizing
            ? {
                name: customizing.name,
                bank: customizing.institution ?? customizing.logo,
                number: customizing.rawMaskedNumber,
                holder: customizing.type,
                balance: money
                  .format(customizing.rawBalance)
                  .replace(/,00$/, ""),
              }
            : null
        }
        look={customizing ? lookFor(customizing.id, customizing.rawType) : null}
        onChange={(look) => customizing && setLook(customizing.id, look)}
        onReset={() => customizing && setLook(customizing.id, null)}
        onClose={() => setCustomizing(null)}
      />
      <AccountTaxNotice />
    </div>
  );
}
