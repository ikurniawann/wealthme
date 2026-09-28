"use client";

import { useEffect, useState } from "react";
import { Plus, Info, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { useCanManage } from "@/hooks/use-role-permissions";
import { MintaDanaDialog } from "@/components/allowance/minta-dana-dialog";
import type { Locale } from "@/i18n";
import { SectionCard, HeroCard, CardLink, SummaryCard } from "@/components/wm";
import { Button } from "@/components/ui/button";
import { DonutChart } from "@/components/charts/apex-presets";
import type { DonutSegment } from "@/components/charts/donut";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { parseRupiah } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import {
  CrudModal,
  RowActions,
  ConfirmDeleteDialog,
  withCrudFx,
} from "@/components/crud";
import type { CrudModalState } from "@/components/crud";

import type {
  AccountDto,
  TransactionDto,
  TransactionListResponse,
} from "@wealthme/contracts";

// EPIC-022 F — the API's ConflictException carries a message the user can act
// on (e.g. a duplicate cash-account name); the generic toast threw it away and
// left "Coba lagi" as the only guidance. Prefer the server's message and fall
// back only when there isn't one.
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

const EWALLET_TYPES = new Set(["ewallet"]);
const CASH_TYPES = new Set(["cash"]);
const DANA_TYPES = new Set(["ewallet", "cash"]);

// EPIC-021 #21 — "Data Kas bisa minus": `parseRupiah` (lib/format.ts, a
// protected foundation file) strips every non-digit character including a
// leading "-", so it can never round-trip a negative cash balance. This
// page-local helper (see WM_CONVENTIONS.md — inline a helper here instead of
// touching lib/*) preserves the sign; only used for the `cash` entity below,
// e-wallet keeps using the shared `parseRupiah`.
function parseSignedRupiah(value: string | null | undefined): number {
  if (!value) return 0;
  const isNegative = value.trim().startsWith("-");
  const digits = parseInt(value.replace(/\D/g, ""), 10) || 0;
  return isNegative ? -digits : digits;
}

// EPIC-025 N3 audit fix (also applied on /rekening) — `Account.maskedNumber`
// is AES-256-GCM encrypted at rest (`apps/api/src/crypto/crypto.service.ts`).
// When decryption fails (stale `ENCRYPTION_KEY`, a value stored before
// encryption was added, or a corrupted row) the API's `decrypt()` silently
// PASSES THROUGH the raw `iv:authTag:ciphertext` hex blob instead of
// throwing, and that blob lands in `AccountDto.maskedNumber` — the exact
// "raw UUID/hash" overflowing an account subtitle in the audit's live
// screenshot. This page cannot fix the backend key/decrypt issue (out of
// scope for a page-only PR — see the code-agent report), so it defensively
// detects that specific undecrypted-blob shape and hides it, matching how a
// real masked number ("···9010") never looks: three colon-separated hex
// runs of iv (12B/24 hex)+authTag (16B/32 hex)+ciphertext lengths.
const UNDECRYPTED_BLOB_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;
function safeMaskedNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  return UNDECRYPTED_BLOB_RE.test(value) ? null : value;
}

/** "D Mon" abbreviated date (prototype: "6 Agu") — no year, matches the
 * dana list rows' "diperbarui 6 Agu" / mutation table's "6 Agu" cells. */
function formatShortDate(isoString: string, locale: Locale): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
  });
}

// EPIC-021 #3 — cash accounts are real, plural accounts (AccountType
// "cash", name-scoped uniqueness — see apps/api/src/accounts), same as
// e-wallets. Both sections below get the same Add/Edit/Delete treatment
// instead of cash being a read-only display of a single hardcoded row.
// Entity display labels ("Kas Tunai"/"E-Wallet") come from t.dana.entityLabels
// (see useLocale() below) instead of a hardcoded module-level map, so the
// toasts and this page stay translated.
type DanaEntity = "cash" | "ewallet";

// Prototype structural port (EPIC-025 N3 audit) — per-provider e-wallet
// brand colors, mirroring `/rekening`'s `BANK_BRANDS` (page-local, not
// shared — WM_CONVENTIONS.md: inline a helper here instead of a new
// components/wm primitive for one page).
const EWALLET_BRANDS: Array<{ match: string; bg: string }> = [
  { match: "gopay", bg: "#00AAD2" },
  { match: "ovo", bg: "#4C2A86" },
  { match: "dana", bg: "#118EEA" },
  { match: "shopeepay", bg: "#EE4D2D" },
  { match: "linkaja", bg: "#E62129" },
];

function resolveWalletBg(item: AccountDto): string {
  if (EWALLET_TYPES.has(item.type)) {
    const haystack = `${item.institution ?? ""} ${item.name}`.toLowerCase();
    const brand = EWALLET_BRANDS.find((b) => haystack.includes(b.match));
    return brand?.bg ?? "#DCFCE7";
  }
  return "#EEF2FF";
}

/** Real-data-only meta line for a wallet row — never fabricates a fixed
 * "Kas pribadi"-style description the API doesn't actually expose
 * (AccountDto has no notes/description field), only real owner + masked
 * number + last-updated fields. */
/** Family-shared (ownerUserId null) wallets/cash — visible to every member with this page. */
const SHARED_LABEL = "Bersama";

function buildWalletMeta(
  item: AccountDto,
  t: ReturnType<typeof useLocale>["t"],
  locale: Locale,
): string {
  if (EWALLET_TYPES.has(item.type)) {
    const parts = [
      safeMaskedNumber(item.maskedNumber),
      item.ownerName ?? (item.ownerUserId ? null : SHARED_LABEL),
    ].filter((v): v is string => !!v);
    return parts.length > 0 ? parts.join(" · ") : (item.institution ?? "—");
  }
  const parts: string[] = [];
  if (item.ownerName) parts.push(item.ownerName);
  else if (!item.ownerUserId) parts.push(SHARED_LABEL);
  parts.push(
    `${t.dana.updatedPrefix}${formatShortDate(item.updatedAt, locale)}`,
  );
  return parts.join(" · ");
}

function WalletRow({
  item,
  border,
  onEdit,
  onDelete,
  onRequest,
}: {
  item: AccountDto;
  border: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** EPIC-033 R5 — members ask for money FROM this family-shared wallet. */
  onRequest?: () => void;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const isEwallet = EWALLET_TYPES.has(item.type);
  const icon = isEwallet ? "💳" : "👛";
  const iconBg = resolveWalletBg(item);

  return (
    <div className={`flex items-center gap-3 py-3 ${border ? "border-b" : ""}`}>
      <div
        className="flex size-10 items-center justify-center rounded-[10px] text-[18px] text-white"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">{item.name}</div>
        <div className="text-[11.5px] text-muted-foreground">
          {buildWalletMeta(item, t, locale)}
        </div>
      </div>
      <div className="text-right">
        <div
          className={`text-[15px] font-extrabold ${parseFloat(item.balance) < 0 ? "text-destructive" : ""}`}
        >
          {money.format(parseFloat(item.balance))}
        </div>
      </div>
      {onRequest && (
        <button
          type="button"
          className="btn btn--outline btn--sm ml-2"
          onClick={onRequest}
        >
          <HandCoins className="size-3.5" /> {t.rekening.mintaDanaButtonLabel}
        </button>
      )}
      {onEdit && onDelete && (
        <RowActions className="ml-2" onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}

// Prototype structural port (EPIC-025 N3 audit) — "Mutasi Tunai & E-Wallet
// Terakhir" table. Built entirely from the SAME `/transactions` endpoint
// `/transaksi` and `/quickinput` already call (`TransactionListResponse`
// envelope `{ data, meta, summary }`, NOT a bare array — that exact
// bare-array assumption just crashed `/quickinput`, see its own fix
// comment), filtered client-side to transactions touching a dana account.
// No new backend endpoint.
function MutationRow({
  tx,
  danaAccountIds,
  locale,
}: {
  tx: TransactionDto;
  danaAccountIds: ReadonlySet<string>;
  locale: Locale;
}) {
  const money = useMoney();
  const isIncome = tx.type === "income";
  const isTransfer = tx.type === "transfer";
  const amount = parseFloat(tx.amount);
  const amountStr = isTransfer
    ? money.format(amount)
    : (isIncome ? "+" : "-") + money.format(amount);
  const amountClass = isTransfer
    ? ""
    : isIncome
      ? "text-success"
      : "text-destructive";
  // Prefer whichever side of the transaction is the dana account being
  // reported on (matters for a transfer touching one dana + one non-dana
  // account).
  const accountLabel =
    tx.accountId && danaAccountIds.has(tx.accountId)
      ? tx.accountName
      : (tx.toAccountName ?? tx.accountName);

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2.5 align-top font-[family-name:var(--font-mono)] text-[11.5px] whitespace-nowrap">
        {formatShortDate(tx.occurredAt, locale)}
      </td>
      <td className="px-3 py-2.5 align-top text-[13px]">
        {tx.description ?? tx.categoryName ?? "—"}
      </td>
      <td className="px-3 py-2.5 align-top">
        <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-[3px] text-[11px] font-semibold text-secondary-foreground">
          {accountLabel ?? "—"}
        </span>
      </td>
      <td
        className={`px-3 py-2.5 text-right align-top font-[family-name:var(--font-mono)] text-[13px] font-semibold whitespace-nowrap ${amountClass}`}
      >
        {amountStr}
      </td>
    </tr>
  );
}

export default function DanaPage() {
  const { t, locale } = useLocale();
  const money = useMoney();
  const { data: session } = useSession();

  useEffect(() => {
    if ((session as { error?: string } | null)?.error === "RefreshTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;

  const {
    data: allAccounts,
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

  const danaAccounts = (allAccounts ?? []).filter((a) =>
    DANA_TYPES.has(a.type),
  );
  const cashItems = danaAccounts.filter((a) => CASH_TYPES.has(a.type));
  const ewalletItems = danaAccounts.filter((a) => EWALLET_TYPES.has(a.type));
  const totalBalance = danaAccounts.reduce(
    (sum, a) => sum + parseFloat(a.balance),
    0,
  );
  const cashTotal = cashItems.reduce(
    (sum, a) => sum + parseFloat(a.balance),
    0,
  );
  const danaAccountIds = new Set(danaAccounts.map((a) => a.id));

  // Prototype structural port — "Mutasi Tunai & E-Wallet Terakhir". A
  // DEPENDENT query, only enabled once the accounts list has resolved with
  // at least one dana account: this both avoids a wasted fetch when there's
  // nothing to filter against, and (component test note) keeps this query
  // strictly ordered AFTER the accounts fetch instead of racing it.
  const { data: recentResponse } = useQuery<TransactionListResponse>({
    queryKey: [
      ...queryKeys.transactions.all(familyGroupId ?? ""),
      "dana-recent",
    ],
    queryFn: () =>
      apiFetch<TransactionListResponse>(
        `/family-groups/${familyGroupId}/transactions?limit=20`,
        { token },
      ),
    enabled:
      !!token && !!familyGroupId && !isLoading && danaAccounts.length > 0,
  });
  const recentDanaTransactions = (recentResponse?.data ?? [])
    .filter(
      (tx) =>
        (tx.accountId && danaAccountIds.has(tx.accountId)) ||
        (tx.toAccountId && danaAccountIds.has(tx.toAccountId)),
    )
    .slice(0, 4);

  // Prototype structural port — "Komposisi" donut: one segment per e-wallet
  // instrument (brand-colored, matching its list-row icon) plus a single
  // aggregate "Tunai" segment for every cash account's net balance — same
  // shape as the prototype's own donut (5 named e-wallets + one "Tunai"
  // bucket), not a per-account breakdown of cash (a donut can't chart a
  // negative slice, and cash balances may legitimately be negative).
  const compositionSegments: DonutSegment[] = [
    ...ewalletItems.map((item) => ({
      label: item.name,
      value: parseFloat(item.balance),
      color: resolveWalletBg(item),
    })),
    ...(cashTotal > 0
      ? [
          {
            label: t.dana.cashSectionTitle,
            value: cashTotal,
            color: "var(--success)",
          },
        ]
      : []),
  ].filter((s) => s.value > 0);

  const queryClient = useQueryClient();
  const [crudState, setCrudState] = useState<CrudModalState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AccountDto | null>(null);
  const [requesting, setRequesting] = useState<AccountDto | null>(null);

  // EPIC-033 R3 — "Pemilik" picker for cash/e-wallet, same shape as the
  // bank form on /rekening (family-shared = "").
  const { data: familyMembers } = useFamilyMembers();
  // EPIC-033 R2/R5 — only members request; Master/Co-Master approve.
  const { myRole } = useMyRole();
  const isMasterLike = myRole === "owner" || myRole === "spouse";
  const myUserId = session?.userId;
  // EPIC-033 R3 follow-up — non-Master members can only own what they
  // create; the picker collapses to themselves (API enforces the same).
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
  // Members with "Lihat" on this page could open edit/delete before; the
  // API refused them, but the affordance should not show at all.
  const { canManage } = useCanManage("Account");
  const myAccounts = (allAccounts ?? []).filter(
    (a) => !!myUserId && a.ownerUserId === myUserId,
  );

  async function invalidateAccounts() {
    if (!familyGroupId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.accounts.all(familyGroupId),
    });
  }

  function openAdd(entity: DanaEntity) {
    setEditingId(null);
    setCrudState({
      entity,
      mode: "add",
      ...(isMasterLike || !myUserId
        ? {}
        : { initialValues: { ownerUserId: myUserId } }),
    });
  }

  function openEdit(entity: DanaEntity, item: AccountDto) {
    setEditingId(item.id);
    setCrudState({
      entity,
      mode: "edit",
      initialValues: {
        nama: item.name,
        saldo: String(item.balance),
        ownerUserId: item.ownerUserId ?? "",
      },
    });
  }

  async function handleSubmit(
    entity: string,
    mode: "add" | "edit",
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token) return;
    const danaEntity = (entity === "cash" ? "cash" : "ewallet") as DanaEntity;
    const label = t.dana.entityLabels[danaEntity];
    try {
      // EPIC-021 #21 — cash balances may be negative; e-wallets stay
      // non-negative via the shared parseRupiah.
      const balance =
        danaEntity === "cash"
          ? parseSignedRupiah(values.saldo ?? "0")
          : parseRupiah(values.saldo ?? "0");
      if (mode === "edit" && editingId) {
        await apiFetch(
          `/family-groups/${familyGroupId}/accounts/${editingId}`,
          {
            token,
            method: "PATCH",
            // EPIC-021 #21 — `type` must be resent so the API's negative-
            // balance relaxation (cash only, see CreateAccountDto.balance)
            // can see this is a cash account even on a partial update that
            // doesn't otherwise touch `type`.
            body: JSON.stringify(
              withCrudFx(
                {
                  name: values.nama,
                  // F6 — `nama` on the e-wallet form IS the provider select
                  // (GoPay/OVO/...), exactly like at create time; only
                  // sending `name` here let a provider change desync
                  // `name` from the account's real `institution`, and any
                  // picker keyed off `institution` (e.g. rekening's brand
                  // logo lookup) kept showing the OLD provider after the
                  // "rename".
                  ...(danaEntity === "ewallet"
                    ? { institution: values.nama }
                    : {}),
                  balance,
                  type: danaEntity,
                  ownerUserId: values.ownerUserId || null,
                },
                values,
                { saldo: "balance" },
              ),
            ),
          },
        );
        toast.success(`${label}${t.dana.toastUpdatedSuffix}`);
      } else {
        await apiFetch(`/family-groups/${familyGroupId}/accounts`, {
          token,
          method: "POST",
          body: JSON.stringify(
            withCrudFx(
              {
                type: danaEntity,
                name: values.nama,
                institution: danaEntity === "ewallet" ? values.nama : undefined,
                maskedNumber: values.phone || undefined,
                balance,
                ownerUserId: values.ownerUserId || undefined,
              },
              values,
              { saldo: "balance" },
            ),
          ),
        });
        toast.success(`${label}${t.dana.toastAddedSuffix}`);
      }
      await invalidateAccounts();
    } catch (err: unknown) {
      toast.error(
        extractApiErrorMessage(
          err,
          `${t.dana.toastSaveFailedPrefix}${label.toLowerCase()}${t.dana.toastSaveFailedSuffix}`,
        ),
      );
    }
  }

  async function handleDeleteConfirm() {
    if (!familyGroupId || !token || !deleting) return;
    const label =
      t.dana.entityLabels[CASH_TYPES.has(deleting.type) ? "cash" : "ewallet"];
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/accounts/${deleting.id}`,
        { token, method: "DELETE" },
      );
      toast.success(`${label}${t.dana.toastDeletedSuffix}`);
      await invalidateAccounts();
    } catch {
      toast.error(
        `${t.dana.toastDeleteFailedPrefix}${label.toLowerCase()}${t.dana.toastDeleteFailedSuffix}`,
      );
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Prototype structural port (EPIC-025 N3 audit) — page-lead header:
          title, subtitle, and the two header add actions. Wired to the
          SAME openAdd() the section "+ Tambah" links already use — no new
          add flow. */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="text-[17px] font-extrabold tracking-tight">
            {t.shell.pageTitles.dana}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openAdd("cash")}
          >
            <Plus className="size-3.5" /> {t.dana.addCashHeaderButton}
          </Button>
          <Button type="button" size="sm" onClick={() => openAdd("ewallet")}>
            <Plus className="size-3.5" /> {t.dana.addEwalletHeaderButton}
          </Button>
        </div>
      </div>

      <HeroCard className="gradient-emerald">
        <div className="mb-1 text-xs opacity-80">{t.dana.totalLabel}</div>
        <div className="text-[28px] font-black">
          {isLoading
            ? t.dana.loadingLabel
            : isError
              ? "—"
              : money.format(totalBalance)}
        </div>
        {!isLoading && !isError && (
          <div className="mt-1.5 text-xs text-[#86EFAC]">
            {danaAccounts.length}
            {t.dana.accountsConnectedSuffix}
          </div>
        )}
      </HeroCard>

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
        >
          <span className="font-semibold">{t.dana.errorPrefixLabel}</span>
          {t.dana.errorLoadBody}
        </div>
      )}

      {/* Prototype structural port (EPIC-025 N3-B3, extended by the N3
          audit) — the prototype's cash-summary-grid: two stacked stat
          cards in a left column beside a "Komposisi" donut in the right
          column. The hero's own category-trend line chart and its "↑ N%
          dari bulan lalu" delta are still NOT ported: this page fetches
          account balances, not a balance history/trend series, so there is
          no real number to show — fabricating one would violate the
          Honest UI mandate. The donut IS derivable (per-account balances,
          already fetched above), so it's ported. */}
      {!isLoading && danaAccounts.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <div className="grid grid-cols-1 gap-3.5 md:col-span-2">
            <SummaryCard
              icon="👛"
              iconBg="var(--accent)"
              label={t.dana.cashStatLabel}
              amount={money.format(
                cashItems.reduce((sum, a) => sum + parseFloat(a.balance), 0),
              )}
              delta={`${cashItems.length}${t.dana.cashCountSuffix}`}
              deltaUp
            />
            <SummaryCard
              icon="💳"
              iconBg="var(--success-soft)"
              iconColor="var(--success)"
              label={t.dana.ewalletStatLabel}
              amount={money.format(
                ewalletItems.reduce((sum, a) => sum + parseFloat(a.balance), 0),
              )}
              delta={`${ewalletItems.length}${t.dana.ewalletCountSuffix}`}
              deltaUp
            />
          </div>
          {compositionSegments.length > 0 && (
            <SectionCard title={t.dana.compositionTitle} bodyClassName="pt-0">
              <DonutChart
                segments={compositionSegments}
                centerLabel={t.dana.compositionTotalLabel}
                ariaLabel={`${t.dana.compositionTitle}: ${compositionSegments
                  .map((s) => `${s.label} ${money.format(s.value)}`)
                  .join(", ")}`}
              />
            </SectionCard>
          )}
        </div>
      )}

      {/* Prototype structural port — info callout (real, static copy; no
          derived numbers). */}
      <div className="flex items-start gap-2.5 rounded-[11px] border border-primary/25 bg-accent p-3 text-[12.5px] text-accent-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>{t.dana.infoNoticeBold}</strong>
          {t.dana.infoNoticeBody}
          <a href="/rekening" className="font-bold text-primary">
            {t.dana.infoNoticeLinkLabel}
          </a>
          {t.dana.infoNoticeSuffix}
        </span>
      </div>

      {/* EPIC-021 #3 — Kas Tunai is now a real, plural account list (Add/Edit/
          Delete), not a single read-only "Kas Tunai" row. */}
      <SectionCard
        title={t.dana.cashSectionTitle}
        action={
          <CardLink
            className="rounded-md bg-accent px-3 py-[5px] text-[11px]"
            onClick={() => openAdd("cash")}
          >
            {t.dana.addButton}
          </CardLink>
        }
        bodyClassName="-my-3"
      >
        {isLoading && (
          <div className="py-3 text-[13px] text-muted-foreground">
            {t.dana.loadingLabel}
          </div>
        )}
        {!isLoading && cashItems.length === 0 && (
          <div className="py-3 text-[13px] text-muted-foreground">
            {t.dana.emptyCash}
          </div>
        )}
        {cashItems.map((item, i) => (
          <WalletRow
            key={item.id}
            item={item}
            border={i < cashItems.length - 1}
            onEdit={canManage ? () => openEdit("cash", item) : undefined}
            onDelete={canManage ? () => setDeleting(item) : undefined}
            onRequest={
              !isMasterLike && item.ownerUserId === null
                ? () => setRequesting(item)
                : undefined
            }
          />
        ))}
      </SectionCard>

      <SectionCard
        title={t.dana.ewalletSectionTitle}
        action={
          <CardLink
            className="rounded-md bg-accent px-3 py-[5px] text-[11px]"
            onClick={() => openAdd("ewallet")}
          >
            {t.dana.addButton}
          </CardLink>
        }
        bodyClassName="-my-3"
      >
        {isLoading && (
          <div className="py-3 text-[13px] text-muted-foreground">
            {t.dana.loadingLabel}
          </div>
        )}
        {!isLoading && ewalletItems.length === 0 && (
          <div className="py-3 text-[13px] text-muted-foreground">
            {t.dana.emptyEwallet}
          </div>
        )}
        {ewalletItems.map((item, i) => (
          <WalletRow
            key={item.id}
            item={item}
            border={i < ewalletItems.length - 1}
            onEdit={canManage ? () => openEdit("ewallet", item) : undefined}
            onDelete={canManage ? () => setDeleting(item) : undefined}
            onRequest={
              !isMasterLike && item.ownerUserId === null
                ? () => setRequesting(item)
                : undefined
            }
          />
        ))}
      </SectionCard>

      {/* Prototype structural port — "Mutasi Tunai & E-Wallet Terakhir".
          Rendered only once there's real data to show (no empty-table
          placeholder rows). */}
      {recentDanaTransactions.length > 0 && (
        <SectionCard
          title={t.dana.mutationsSectionTitle}
          action={
            <a
              href="/transaksi"
              className="text-xs font-semibold whitespace-nowrap text-primary hover:underline"
            >
              {t.dana.mutationsViewAllLabel}
            </a>
          }
        >
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="px-3 py-2 font-bold">
                    {t.dana.tableDateHeader}
                  </th>
                  <th className="px-3 py-2 font-bold">
                    {t.dana.tableDescriptionHeader}
                  </th>
                  <th className="px-3 py-2 font-bold">
                    {t.dana.tableAccountHeader}
                  </th>
                  <th className="px-3 py-2 text-right font-bold">
                    {t.dana.tableAmountHeader}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentDanaTransactions.map((tx) => (
                  <MutationRow
                    key={tx.id}
                    tx={tx}
                    danaAccountIds={danaAccountIds}
                    locale={locale}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <CrudModal
        state={crudState}
        onClose={() => setCrudState(null)}
        onSubmit={handleSubmit}
        dynamicOptions={{ ownerUserId: ownerOptions }}
      />

      <MintaDanaDialog
        source={requesting}
        targets={myAccounts}
        familyGroupId={familyGroupId ?? null}
        token={token}
        onClose={() => setRequesting(null)}
      />

      <ConfirmDeleteDialog
        label={deleting ? `"${deleting.name}"` : null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
