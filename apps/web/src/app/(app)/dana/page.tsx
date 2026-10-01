"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Plus,
  HandCoins,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { useCanManage } from "@/hooks/use-role-permissions";
import { MintaDanaDialog } from "@/components/allowance/minta-dana-dialog";
import type { Locale } from "@/i18n";
import {
  AccountCard,
  CardSkinPanel,
  SectionCard,
  CardLink,
  useCardLooks,
  type CardLook,
  BentoCard,
  BentoGrid,
  BentoHero,
  CompositionStack,
  GhostButton,
  HeroKpi,
  TipsCard,
  ARow,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import "./dana.css";
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

function WalletTile({
  item,
  look,
  onEdit,
  onDelete,
  onRequest,
  onCustomize,
}: {
  item: AccountDto;
  look: CardLook;
  onEdit?: () => void;
  onDelete?: () => void;
  /** EPIC-033 R5 — members ask for money FROM this family-shared wallet. */
  onRequest?: () => void;
  onCustomize: () => void;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const negative = parseFloat(item.balance) < 0;

  return (
    <article className="dn-wallet">
      <AccountCard
        decorative
        look={look}
        bank={item.institution ?? item.name}
        name={item.name}
        number={safeMaskedNumber(item.maskedNumber)}
        holder={item.ownerName ?? (item.ownerUserId ? "" : SHARED_LABEL)}
        balance={money.format(parseFloat(item.balance))}
      />
      <div className="dn-wallet-meta">
        <span className="sr-only">
          <span>{item.name}</span>
          <span data-negative={negative || undefined}>
            {money.format(parseFloat(item.balance))}
          </span>
        </span>
        {buildWalletMeta(item, t, locale)}
      </div>
      <div className="dn-wallet-acts">
        {onRequest && (
          <button
            type="button"
            className="dn-wallet-btn"
            data-lit="true"
            onClick={onRequest}
          >
            <HandCoins aria-hidden="true" /> {t.rekening.mintaDanaButtonLabel}
          </button>
        )}
        <button
          type="button"
          className="dn-wallet-icon"
          aria-label={t.rekening.v2.customize}
          title={t.rekening.v2.customize}
          onClick={onCustomize}
        >
          <Palette aria-hidden="true" />
        </button>
        {onEdit && onDelete && (
          <RowActions className="ml-auto" onEdit={onEdit} onDelete={onDelete} />
        )}
      </div>
    </article>
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

  const Icon = isTransfer
    ? ArrowLeftRight
    : isIncome
      ? ArrowDownLeft
      : ArrowUpRight;

  return (
    <ARow
      badge={<Icon className="size-4" aria-hidden="true" />}
      title={tx.description ?? tx.categoryName ?? "—"}
      meta={`${formatShortDate(tx.occurredAt, locale)} · ${accountLabel ?? "—"}`}
      amount={<span className={amountClass}>{amountStr}</span>}
    />
  );
}

/** Axis ticks: "20 jt", "500 rb". */
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
  const [customizing, setCustomizing] = useState<AccountDto | null>(null);
  const { lookFor, setLook } = useCardLooks();

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
    <BentoGrid className="dn-grid">
      <h1 className="sr-only">{t.shell.pageTitles.dana}</h1>
      <BentoHero
        className="dn-hero"
        currency={null}
        value={
          isLoading
            ? t.dana.loadingLabel
            : isError
              ? "—"
              : money.format(totalBalance).replace(/,00$/, "")
        }
        caption={`${t.dana.totalLabel} · ${danaAccounts.length}${t.dana.accountsConnectedSuffix}`}
        controls={
          <>
            <GhostButton onClick={() => openAdd("cash")}>
              <Plus aria-hidden="true" /> {t.dana.addCashHeaderButton}
            </GhostButton>
            <GhostButton lit onClick={() => openAdd("ewallet")}>
              <Plus aria-hidden="true" /> {t.dana.addEwalletHeaderButton}
            </GhostButton>
          </>
        }
        chart={
          danaAccounts.length > 0 ? (
            <HatchedBarChart
              labels={danaAccounts.map((a) => a.institution || a.name)}
              series={[
                {
                  name: t.dana.totalLabel,
                  data: danaAccounts.map((a) => parseFloat(a.balance)),
                  color: "var(--wm-lime)",
                },
              ]}
              highlight={danaAccounts.reduce(
                (m, a, k, arr) =>
                  parseFloat(a.balance) > parseFloat(arr[m].balance) ? k : m,
                0,
              )}
              format={money.formatCompact}
              axis={axisJt}
              wide
              ariaLabel={t.dana.compositionTitle}
            />
          ) : null
        }
        kpis={
          <>
            <HeroKpi
              label={t.dana.cashStatLabel}
              value={money.formatCompact(
                cashItems.reduce((sum, a) => sum + parseFloat(a.balance), 0),
              )}
              delta={
                <small className="wm-cap">{`${cashItems.length}${t.dana.cashCountSuffix}`}</small>
              }
            />
            <HeroKpi
              label={t.dana.ewalletStatLabel}
              value={money.formatCompact(
                ewalletItems.reduce((sum, a) => sum + parseFloat(a.balance), 0),
              )}
              delta={
                <small className="wm-cap">{`${ewalletItems.length}${t.dana.ewalletCountSuffix}`}</small>
              }
            />
            <HeroKpi
              label={t.dana.v2.connected}
              value={String(danaAccounts.length)}
            />
          </>
        }
      />

      {isError && (
        <div
          role="alert"
          className="dn-full rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
        >
          <span className="font-semibold">{t.dana.errorPrefixLabel}</span>
          {t.dana.errorLoadBody}
        </div>
      )}

      <BentoCard
        className="dn-comp"
        title={t.dana.compositionTitle}
        caption={t.dana.v2.perInstrument}
      >
        {compositionSegments.length > 0 ? (
          <div className="mt-3">
            <CompositionStack
              label={t.dana.compositionTitle}
              center={money.formatCompact(totalBalance)}
              sub={t.dana.compositionTotalLabel}
              format={money.formatCompact}
              items={compositionSegments.map((seg) => ({
                label: seg.label,
                value: seg.value,
                color: seg.color,
              }))}
            />
          </div>
        ) : (
          <p className="wm-cap mt-4">{t.dana.emptyEwallet}</p>
        )}
      </BentoCard>

      <TipsCard
        className="dn-tip"
        title={t.dana.infoNoticeBold}
        mosaic={[
          "",
          "b",
          "a",
          "",
          "b",
          "a",
          "b",
          "a",
          "a",
          "",
          "c",
          "a",
          "",
          "b",
          "a",
          "a",
          "b",
          "a",
        ]}
      >
        {t.dana.infoNoticeBody}
        <a href="/rekening" className="font-bold">
          {t.dana.infoNoticeLinkLabel}
        </a>
        {t.dana.infoNoticeSuffix}
      </TipsCard>

      <SectionCard
        className="dn-cash"
        title={t.dana.cashSectionTitle}
        action={
          <CardLink
            className="rounded-md bg-accent px-3 py-[5px] text-[11px]"
            onClick={() => openAdd("cash")}
          >
            {t.dana.addButton}
          </CardLink>
        }
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
        <div className="dn-wallets">
          {cashItems.map((item) => (
            <WalletTile
              key={item.id}
              item={item}
              look={lookFor(item.id, item.type)}
              onEdit={canManage ? () => openEdit("cash", item) : undefined}
              onDelete={canManage ? () => setDeleting(item) : undefined}
              onRequest={
                !isMasterLike && item.ownerUserId === null
                  ? () => setRequesting(item)
                  : undefined
              }
              onCustomize={() => setCustomizing(item)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        className="dn-ew"
        title={t.dana.ewalletSectionTitle}
        action={
          <CardLink
            className="rounded-md bg-accent px-3 py-[5px] text-[11px]"
            onClick={() => openAdd("ewallet")}
          >
            {t.dana.addButton}
          </CardLink>
        }
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
        <div className="dn-wallets">
          {ewalletItems.map((item) => (
            <WalletTile
              key={item.id}
              item={item}
              look={lookFor(item.id, item.type)}
              onEdit={canManage ? () => openEdit("ewallet", item) : undefined}
              onDelete={canManage ? () => setDeleting(item) : undefined}
              onRequest={
                !isMasterLike && item.ownerUserId === null
                  ? () => setRequesting(item)
                  : undefined
              }
              onCustomize={() => setCustomizing(item)}
            />
          ))}
        </div>
      </SectionCard>

      {/* Prototype structural port — "Mutasi Tunai & E-Wallet Terakhir".
          Rendered only once there's real data to show (no empty-table
          placeholder rows). */}
      {recentDanaTransactions.length > 0 && (
        <SectionCard
          className="dn-full"
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
          <div className="dn-mut-list">
            {recentDanaTransactions.map((tx) => (
              <MutationRow
                key={tx.id}
                tx={tx}
                danaAccountIds={danaAccountIds}
                locale={locale}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <CrudModal
        state={crudState}
        onClose={() => setCrudState(null)}
        onSubmit={handleSubmit}
        dynamicOptions={{ ownerUserId: ownerOptions }}
      />

      <CardSkinPanel
        preview={
          customizing
            ? {
                name: customizing.name,
                bank: customizing.institution ?? customizing.name,
                number: safeMaskedNumber(customizing.maskedNumber),
                holder: customizing.ownerName ?? SHARED_LABEL,
                balance: money.format(parseFloat(customizing.balance)),
              }
            : null
        }
        look={customizing ? lookFor(customizing.id, customizing.type) : null}
        onChange={(look) => customizing && setLook(customizing.id, look)}
        onReset={() => customizing && setLook(customizing.id, null)}
        onClose={() => setCustomizing(null)}
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
    </BentoGrid>
  );
}
