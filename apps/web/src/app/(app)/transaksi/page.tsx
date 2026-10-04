"use client";

import {
  useState,
  useEffect,
  Suspense,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ArrowDownLeft,
  CreditCard,
  ArrowLeftRight,
  FileText,
  Filter,
  Image as ImageIcon,
  ImagePlus,
  Eye,
  Lock,
  Pencil,
  Search,
  Tag,
  Trash2,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { useShell } from "@/components/shell/shell-context";
import { parseRupiah } from "@/lib/format";
import {
  MoneyInput,
  useMoneyField,
  moneyIdr,
  withFxInputs,
} from "@/components/money";
import { cn } from "@/lib/utils";
import { PpnHint } from "@/components/tax/ppn-hint";

import {
  StatusBadge,
  IconChip,
  DateField,
  BentoCard,
  BentoGrid,
  BentoHero,
  GhostButton,
  HeroKpi,
  PillButton,
  ContextMenu,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { CategoryIcon } from "@/components/shell/tx-pickers";
import "./transaksi.css";
import {
  DateRangeFilterField,
  formatMonthYear,
} from "@/components/wm/date-range-field";
import { RowActions, ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useMoney } from "@/hooks/use-money";
import type {
  TransactionAttachmentDto,
  TransactionDto,
  TransactionListResponse,
} from "@wealthme/contracts";
import { getActiveTransactionFilterCount } from "./filter-count";

// EPIC-024 Task L3 (D15, US-TXN-9) — page-local helper, same convention as
// `app/(app)/dana/page.tsx`'s own copy: never touch lib/api-client.ts.
// A2 (revisi-2) — `fetchAttachmentBlob`'s last-resort message is a raw
// `HTTP 504`-style status string (only reached when the response isn't from
// the API at all), which is not fit to show a user; that shape falls back
// to `fallback` here instead of rendering verbatim.
const RAW_HTTP_STATUS_MESSAGE = /^HTTP \d{3}$/;
function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object" || !("message" in err)) return fallback;
  const message = String((err as Partial<ApiError>).message);
  return RAW_HTTP_STATUS_MESSAGE.test(message) ? fallback : message;
}

// `lib/api-client.ts` only exports an `ApiError` *type* (no class), so
// `apiFetch`'s own error path throws a plain object literal too — not an
// `Error` instance, losing stack traces. `fetchAttachmentBlob` below needs
// its own raw `fetch` (see comment above it) and therefore its own error
// path; this local class keeps that path a real `Error` subclass instead of
// repeating the plain-object anti-pattern. Page-local per WM_CONVENTIONS.md
// (never touch lib/api-client.ts for a page-specific need).
class AttachmentFetchError extends Error implements ApiError {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AttachmentFetchError";
    this.status = status;
  }
}

// `apiFetch` (lib/api-client.ts) always calls `res.json()`, which throws on
// a binary response — the streamed attachment download route returns raw
// file bytes, not JSON, so it needs its own raw `fetch` (page-local, per
// WM_CONVENTIONS.md).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function fetchAttachmentBlob(
  familyGroupId: string,
  transactionId: string,
  attachmentId: string,
  token: string | undefined,
): Promise<Blob> {
  const res = await fetch(
    `${API_URL}/family-groups/${familyGroupId}/transactions/${transactionId}/attachments/${attachmentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );
  if (!res.ok) {
    // `res.statusText` is the empty string over HTTP/2 (h2 carries no reason
    // phrase), and `extractApiErrorMessage` passes an empty message straight
    // through — which renders a toast with no text in it. Same silent
    // failure that hid a gateway timeout on /rekonsiliasi.
    throw new AttachmentFetchError(
      res.status,
      res.statusText.trim() || `HTTP ${res.status}`,
    );
  }
  return res.blob();
}

type TxnType = "income" | "expense" | "transfer" | "all";

/**
 * Extended filter value: standard TxnType values plus "kartu_kredit".
 */
type FilterValue = TxnType | "kartu_kredit";

type SortOrder = "newest" | "oldest";

type MeResponse = {
  id: string;
  email: string;
  name: string;
  familyGroupId: string | null;
};

// EPIC-023 Task E retry (HIGH 4) — only the fields the "Kartu Kredit"
// filter needs to tell a credit-card liability apart from any other
// liability type (KPR, pinjaman pribadi, ...).
type LiabilityFilterDto = { id: string; type: string };

const FILTER_VALUES: FilterValue[] = [
  "all",
  "income",
  "expense",
  "transfer",
  "kartu_kredit",
];

const SORT_VALUES: SortOrder[] = ["newest", "oldest"];

/**
 * EPIC-023 Task E retry (HIGH 4) — the "Kartu Kredit" filter used to
 * substring-match `tx.accountName`, which is `""` for every real card
 * purchase (E3's `accountId` is null on those rows), so the filter matched
 * zero of the very transactions it exists to show. `Transaction.liabilityId`
 * (E1/E3) plus the liability's own `type` field is the real, unambiguous
 * signal: a transaction is a "kartu_kredit" row when it is linked to a
 * liability of that type, whether it's a purchase (raises the card's debt)
 * or a payment (pays it down).
 */
export function isCreditCard(
  tx: TransactionDto,
  creditCardLiabilityIds: ReadonlySet<string>,
): boolean {
  return !!tx.liabilityId && creditCardLiabilityIds.has(tx.liabilityId);
}

function formatTime(isoString: string): string {
  return isoString.slice(11, 16);
}

/**
 * Absolute "D Month YYYY" date, always the real calendar date (never "Hari
 * ini"/"Kemarin" relative labels) — used in the read-only detail view where
 * the exact date matters. Parses the date parts directly rather than
 * `new Date(isoString)`, to avoid a timezone-conversion shift of the
 * displayed calendar day.
 */
function formatFullDate(dateStr: string, locale: Locale): string {
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "D Month YYYY, HH:MM" — full date + time for the transaction detail view. */
function formatDetailDateTime(isoString: string, locale: Locale): string {
  return `${formatFullDate(isoString.slice(0, 10), locale)}, ${formatTime(isoString)}`;
}

/**
 * "D Mon YYYY" — abbreviated absolute date for the transaction table's
 * Tanggal column (prototype: "6 Agu 2026"). Same manual date-part parsing
 * as `formatFullDate` above to avoid a timezone-shift of the displayed
 * calendar day.
 */
function formatShortDate(dateStr: string, locale: Locale): string {
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Agustus 2026" — used for the stat cards' "N transaksi · <bulan>" subtext,
 * only when a real date-range filter (`summary.period.from`) is active. */

const PAGE_SIZE = 10;

/** Server page size when collecting the full list. 100 is the API's own
 *  `@Max(100)` ceiling, so this is the fewest round trips it allows. */
const FETCH_PAGE_SIZE = 100;

/** Hard ceiling on how many transactions the page will pull in one go. Ten
 *  requests is already far past any real family's history; beyond this the
 *  UI says so rather than pretending the list is complete. */
const MAX_FETCHED_TRANSACTIONS = 1000;

const TX_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  income: { icon: ArrowDownLeft, chip: "bg-green-100 text-green-600" },
  expense: { icon: CreditCard, chip: "bg-red-100 text-red-600" },
  transfer: { icon: ArrowLeftRight, chip: "bg-violet-100 text-violet-600" },
};

export function TxRow({
  tx,
  onDeleteClick,
  onEditClick,
  familyGroupId,
  token,
}: {
  tx: TransactionDto;
  onDeleteClick: () => void;
  onEditClick: () => void;
  // EPIC-024 Task L3 (D15, US-TXN-9) — forwarded to TransactionDetailDialog
  // for its attachment list; optional so existing/other callers still work.
  familyGroupId?: string;
  token?: string;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const [detailOpen, setDetailOpen] = useState(false);
  const isIncome = tx.type === "income";
  // A transfer moves money between the family's own accounts — neither a
  // gain nor a loss — so it renders with NO sign and a neutral colour. This
  // mirrors `TxTableRow` below (the desktop table), which already did it;
  // this mobile card treated every non-income row as an expense, so the very
  // same transfer read "Rp 500.000" on desktop but "-Rp 500.000" on a phone.
  const isTransfer = tx.type === "transfer";
  const amount = parseFloat(tx.amount);
  const amountStr = isTransfer
    ? money.format(amount)
    : (isIncome ? "+" : "-") + money.format(amount);
  const txIcon = TX_ICON[tx.type] ?? TX_ICON.expense;
  const typeLabels: Record<string, string> = t.transaksi.typeLabels;
  // EPIC-023 group E retry round 4 (C4) — the API now REFUSES to edit or
  // delete an obligation-linked transaction (a liability payment/purchase
  // or insurance premium): editing/deleting it would desync the debt/
  // coverage it recorded from the ledger. Honest UI: disable Edit/Hapus
  // here instead of leaving a live-looking control the server rejects.
  const isObligationLinked = !!tx.liabilityId || !!tx.insuranceId;
  // EPIC-036 (edit-rights, "Pembuat + pemilik rekening") — the API's own
  // canModify (creator or owner of a leg's private account) gates Edit/Hapus
  // the same honest way as the obligation lock above, including for
  // Master/Co-Master. Obligation lock takes precedence in the tooltip when
  // both apply — it names a concrete other place to go fix it.
  const isEditLocked = isObligationLinked || tx.canModify === false;
  const editLockTooltip = isObligationLinked
    ? t.transaksi.obligationLockedTooltip
    : t.transaksi.editRightsLockedTooltip;
  // EPIC-021 Group B #23 — a real (two-sided) transfer shows its route;
  // legacy one-sided transfer rows (toAccountName null) render exactly as
  // before via the existing fallback chain.
  const isTransferWithDest = tx.type === "transfer" && !!tx.toAccountName;
  const typeLabel = typeLabels[tx.type] ?? tx.type;
  const displayName = isTransferWithDest
    ? (tx.description ?? typeLabels.transfer)
    : (tx.description ?? tx.categoryName ?? tx.accountName ?? "—");
  const subtitle = isTransferWithDest
    ? `${tx.accountName ?? "—"} → ${tx.toAccountName}`
    : (tx.categoryName ?? tx.accountName ?? typeLabels[tx.type] ?? tx.type);

  const openDetail = () => setDetailOpen(true);
  // The detail-trigger is keyboard-operable (Enter/Space) per WM a11y
  // convention for clickable non-<button> elements. RowActions renders as a
  // sibling (not a descendant) of this element, so its own button clicks/
  // keydowns never bubble into this handler.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  };

  return (
    <>
      {/* RowActions is a SIBLING of the role="button" detail-trigger below,
          not nested inside it — nesting real <button>s inside a role="button"
          container is an ARIA "nested-interactive" violation, and a keydown
          on those buttons would otherwise bubble up and re-trigger this row's
          own Enter/Space handler, hijacking keyboard Edit/Hapus. */}
      {/* uiarc.dev context-menu reference — right-click/long-press gives the
          same Edit/Hapus/Lihat Detail set as the visible controls below, as
          a supplementary desktop/power-user path. It does not replace them:
          a context menu has no visible affordance, so RowActions and the
          tap-to-detail trigger stay the accessible, discoverable baseline. */}
      <ContextMenu
        label={`${typeLabel} ${displayName}`}
        items={[
          {
            id: "detail",
            label: t.transaksi.detailDialogTitle,
            icon: <Eye className="size-3.5" aria-hidden="true" />,
            onSelect: openDetail,
          },
          {
            id: "edit",
            label: t.common.edit,
            icon: <Pencil className="size-3.5" aria-hidden="true" />,
            onSelect: onEditClick,
            disabled: isEditLocked,
          },
          {
            id: "delete",
            label: t.common.delete,
            icon: <Trash2 className="size-3.5" aria-hidden="true" />,
            onSelect: onDeleteClick,
            disabled: isEditLocked,
            destructive: true,
          },
        ]}
      >
        <div className="flex w-full items-center gap-3 rounded-[12px] border bg-card py-3.5 px-3 transition-colors hover:bg-accent/40">
          <div
            role="button"
            tabIndex={0}
            onClick={openDetail}
            onKeyDown={handleKeyDown}
            aria-label={`${t.transaksi.detailAriaLabelPrefix}${typeLabel} ${displayName}, ${amountStr}`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[8px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <IconChip
              icon={txIcon.icon}
              className={txIcon.chip}
              size={34}
              rounded="rounded-full"
            />
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
                  (isTransfer
                    ? "text-muted-foreground"
                    : isIncome
                      ? "text-success"
                      : "text-destructive")
                }
              >
                {amountStr}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {formatTime(tx.occurredAt)}
              </div>
            </div>
          </div>
          <RowActions
            onEdit={onEditClick}
            onDelete={onDeleteClick}
            className="ml-1"
            disabled={isEditLocked}
            disabledLabel={editLockTooltip}
          />
        </div>
      </ContextMenu>
      <TransactionDetailDialog
        tx={tx}
        open={detailOpen}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {
          setDetailOpen(false);
          onEditClick();
        }}
        onDelete={() => {
          setDetailOpen(false);
          onDeleteClick();
        }}
      />
    </>
  );
}

/**
 * Table-row rendering of a transaction, ported from
 * `docs/prototype/pages/transaksi.html`'s `.table.table--transactions`
 * (Tanggal / Deskripsi / Kategori / Akun / Jumlah / Opsi columns). Shares
 * `TransactionDetailDialog`/`RowActions`/the obligation-lock guard with
 * `TxRow` above — only the row's own markup differs (table cells instead of
 * a flex list row). `TxRow` itself stays exported/rendered as-is; it is
 * covered by `txrow-detail.test.tsx` and kept for that contract, but the
 * page below now renders `TxTableRow`, not `TxRow`, per the prototype.
 *
 * Honest-UI note: the prototype shows a "dicatat oleh <nama>" line and a
 * paperclip attachment-count chip per row — `TransactionDto` (the list
 * response) carries neither a recorder name nor an attachment count (that
 * data is only fetched, lazily, once the detail dialog for a single
 * transaction is opened), so both are omitted here rather than faked.
 */
export function TxTableRow({
  tx,
  onDeleteClick,
  onEditClick,
  familyGroupId,
  token,
}: {
  tx: TransactionDto;
  onDeleteClick: () => void;
  onEditClick: () => void;
  familyGroupId?: string;
  token?: string;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const [detailOpen, setDetailOpen] = useState(false);
  const isIncome = tx.type === "income";
  const isTransfer = tx.type === "transfer";
  const amount = parseFloat(tx.amount);
  // A transfer moves money between the family's own accounts — neither a
  // gain nor a loss — so (unlike income/expense) it renders with no sign and
  // a neutral color, matching the prototype's "Rp 1.000.000" transfer row.
  const amountStr = isTransfer
    ? money.format(amount)
    : (isIncome ? "+" : "-") + money.format(amount);
  const typeLabels: Record<string, string> = t.transaksi.typeLabels;
  const isObligationLinked = !!tx.liabilityId || !!tx.insuranceId;
  // EPIC-036 (edit-rights) — mirrors TxRow's own guard.
  const isEditLocked = isObligationLinked || tx.canModify === false;
  const editLockTooltip = isObligationLinked
    ? t.transaksi.obligationLockedTooltip
    : t.transaksi.editRightsLockedTooltip;
  const isTransferWithDest = isTransfer && !!tx.toAccountName;
  const typeLabel = typeLabels[tx.type] ?? tx.type;
  const displayName = isTransferWithDest
    ? (tx.description ?? typeLabels.transfer)
    : (tx.description ?? tx.categoryName ?? tx.accountName ?? "—");
  const accountCell = isTransferWithDest
    ? `${tx.accountName ?? "—"} → ${tx.toAccountName}`
    : (tx.accountName ?? "—");

  const openDetail = () => setDetailOpen(true);
  // Delegated keyboard handling: only react to Enter/Space when the event's
  // target IS the row itself, not a bubbled keydown from a nested RowActions
  // button — a table row can't keep RowActions as a DOM sibling (it must be
  // a cell inside this same <tr>), so without this guard, pressing Enter on
  // the focused Edit/Hapus button would re-trigger this row's own handler
  // and hijack keyboard Edit/Hapus, same regression class `TxRow` above
  // avoids via sibling structure.
  const handleRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  };

  return (
    <>
      {/* uiarc.dev context-menu reference — `<tr>` can't be a child of
          `ContextMenuTrigger`'s default `<div>` (invalid table markup), so
          the trigger renders AS this row via Base UI's `render` prop
          (same pattern as rekening/page.tsx's icon-button trigger) instead
          of wrapping it. */}
      <ContextMenu
        label={`${typeLabel} ${displayName}`}
        items={[
          {
            id: "detail",
            label: t.transaksi.detailDialogTitle,
            icon: <Eye className="size-3.5" aria-hidden="true" />,
            onSelect: openDetail,
          },
          {
            id: "edit",
            label: t.common.edit,
            icon: <Pencil className="size-3.5" aria-hidden="true" />,
            onSelect: onEditClick,
            disabled: isEditLocked,
          },
          {
            id: "delete",
            label: t.common.delete,
            icon: <Trash2 className="size-3.5" aria-hidden="true" />,
            onSelect: onDeleteClick,
            disabled: isEditLocked,
            destructive: true,
          },
        ]}
        render={
          <tr
            tabIndex={0}
            onClick={openDetail}
            onKeyDown={handleRowKeyDown}
            aria-label={`${t.transaksi.detailAriaLabelPrefix}${typeLabel} ${displayName}, ${amountStr}`}
            className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent/40 focus:outline-none focus-visible:bg-accent/40"
          />
        }
      >
        <td className="px-3 py-3 align-top text-[11.5px] font-[family-name:var(--font-mono)] whitespace-nowrap">
          {formatShortDate(tx.occurredAt.slice(0, 10), locale)}
          <div className="text-muted-foreground">
            {formatTime(tx.occurredAt)}
          </div>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-semibold">{displayName}</span>
            {isEditLocked && (
              // Batch 8 item 8 — the full lock explanation used to render
              // as its own line under every locked row, repeating the same
              // sentence verbatim across 5+ rows. Show it once per row, as
              // a native tooltip on the lock badge itself. EPIC-036 — same
              // badge now also covers the edit-rights lock, not just the
              // obligation lock.
              <span title={editLockTooltip}>
                <StatusBadge variant="warning">
                  <Lock className="size-2.5" />
                  {t.transaksi.lockedBadgeLabel}
                </StatusBadge>
              </span>
            )}
          </div>
          {isTransferWithDest && !isEditLocked && (
            <div className="text-[11px] text-muted-foreground">
              {accountCell}
            </div>
          )}
        </td>
        <td className="px-3 py-3 align-top">
          {isTransfer ? (
            <StatusBadge variant="purple">🔁 {typeLabels.transfer}</StatusBadge>
          ) : (
            <StatusBadge variant="gray">
              <Tag className="size-2.5" />
              {tx.categoryName ?? "—"}
            </StatusBadge>
          )}
        </td>
        <td className="px-3 py-3 align-top text-[12px] text-muted-foreground">
          {accountCell}
        </td>
        <td
          className={cn(
            "px-3 py-3 text-right align-top font-[family-name:var(--font-mono)] text-[13px] font-bold whitespace-nowrap",
            isTransfer
              ? "text-muted-foreground"
              : isIncome
                ? "text-success"
                : "text-destructive",
          )}
        >
          {amountStr}
        </td>
        <td className="px-3 py-3 text-right align-top">
          <RowActions
            onEdit={onEditClick}
            onDelete={onDeleteClick}
            className="justify-end"
            disabled={isEditLocked}
            disabledLabel={editLockTooltip}
          />
        </td>
      </ContextMenu>
      <TransactionDetailDialog
        tx={tx}
        open={detailOpen}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {
          setDetailOpen(false);
          onEditClick();
        }}
        onDelete={() => {
          setDetailOpen(false);
          onDeleteClick();
        }}
      />
    </>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="tx-kv-row">
      <dt>{label}</dt>
      <dd className={cn(mono && "wm-num")}>{value}</dd>
    </div>
  );
}

/** "1.2 MB" / "340 KB" — human-readable attachment size. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * EPIC-024 Task L3 (D15, US-TXN-9) — attachment list rendered inside
 * `TransactionDetailDialog`. Fetched only while the detail dialog is open
 * (`enabled: open`) — no point pre-loading attachments for a dialog that
 * might never be opened. The response DTO carries no filename (the server
 * never trusts a client-supplied name — see the contract's own doc
 * comment), so each row is labeled generically by `mimeType` + size + date.
 */
export function AttachmentList({
  familyGroupId,
  transactionId,
  token,
  open,
  // EPIC-036 (edit-rights) — optional, defaults to true so any pre-existing
  // caller that doesn't pass it keeps behaving as before.
  canModify = true,
}: {
  familyGroupId: string;
  transactionId: string;
  token: string | undefined;
  open: boolean;
  canModify?: boolean;
}) {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [pendingViewId, setPendingViewId] = useState<string | null>(null);

  const attachmentsQueryKey = [
    "transactions",
    familyGroupId,
    transactionId,
    "attachments",
  ] as const;

  const {
    data: attachments = [],
    isLoading,
    isError,
  } = useQuery<TransactionAttachmentDto[]>({
    queryKey: attachmentsQueryKey,
    queryFn: () =>
      apiFetch<TransactionAttachmentDto[]>(
        `/family-groups/${familyGroupId}/transactions/${transactionId}/attachments`,
        { token },
      ),
    enabled: open && !!familyGroupId && !!transactionId && !!token,
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      apiFetch<void>(
        `/family-groups/${familyGroupId}/transactions/${transactionId}/attachments/${attachmentId}`,
        { method: "DELETE", token },
      ),
    onSuccess: () => {
      toast.success(t.transaksi.attachmentDeletedToast);
      void queryClient.invalidateQueries({ queryKey: attachmentsQueryKey });
    },
    onError: (err) => {
      toast.error(
        extractApiErrorMessage(err, t.transaksi.attachmentDeleteFailedToast),
      );
    },
  });

  const handleView = async (attachmentId: string) => {
    setPendingViewId(attachmentId);
    try {
      const blob = await fetchAttachmentBlob(
        familyGroupId,
        transactionId,
        attachmentId,
        token,
      );
      const url = URL.createObjectURL(blob);
      // Streamed inline (see attachments.controller.ts's `download()`) — a
      // new tab is the simplest honest "view" affordance for both an image
      // and a PDF without building a bespoke in-app viewer.
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(
        extractApiErrorMessage(err, t.transaksi.attachmentViewFailedToast),
      );
    } finally {
      setPendingViewId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="mt-4">
      {/* Prototype #dlg-tx-detail uses a simple heading row plus a card-link
          affordance. Upload is still routed through the create/edit flows, so
          this card-link only gives the same informational cue as the HTML
          prototype instead of pretending this read-only detail view can mutate
          attachments directly. */}
      <div className="row row--between mb-2">
        <span className="t-sm t-bold">
          {t.transaksi.attachmentsSectionLabel}
        </span>
        {canModify && (
          <button
            type="button"
            className="card-link"
            onClick={() => toast("Pilih file struk untuk diunggah")}
          >
            + Tambah Lampiran
          </button>
        )}
      </div>

      {isLoading && (
        <p className="text-[12px] text-muted-foreground">
          {t.transaksi.attachmentsLoadingLabel}
        </p>
      )}
      {isError && (
        <p className="text-[12px] text-destructive">
          {t.transaksi.attachmentsLoadFailedLabel}
        </p>
      )}
      {!isLoading && !isError && attachments.length === 0 && canModify && (
        <button
          type="button"
          className="empty min-h-[78px] w-full cursor-pointer rounded-[11px] border border-dashed bg-transparent px-[18px] py-2.5"
          onClick={() => toast("Pilih file struk untuk diunggah")}
        >
          <span className="empty__icon text-[20px]">
            <ImagePlus className="size-5" aria-hidden="true" />
          </span>
          <span className="t-xs t-muted">
            {t.transaksi.attachmentsEmptyLabel}
          </span>
        </button>
      )}
      {!isLoading && !isError && attachments.length === 0 && !canModify && (
        <p className="text-[12px] text-muted-foreground">
          {t.transaksi.attachmentsEmptyLabel}
        </p>
      )}

      <div className="row row--wrap gap-2.5">
        {attachments.map((att) => {
          const isImage = att.mimeType.startsWith("image/");
          const AttIcon = isImage ? ImageIcon : FileText;
          const label = isImage
            ? t.transaksi.attachmentImageLabel
            : t.transaksi.attachmentPdfLabel;
          return (
            <div
              key={att.id}
              className="row min-w-[220px] flex-1 cursor-pointer gap-2.5 rounded-[11px] border bg-card p-2 text-left"
            >
              <IconChip
                icon={AttIcon}
                className="bg-secondary text-muted-foreground"
                size={54}
                rounded="rounded-[11px]"
              />
              <div className="min-w-0 flex-1">
                <div className="list-row__title truncate">{label}</div>
                <div className="list-row__sub mono truncate">
                  {formatFileSize(att.size)} ·{" "}
                  {formatDetailDateTime(att.createdAt, locale)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleView(att.id)}
                disabled={pendingViewId === att.id}
                className="btn btn--outline btn--sm"
              >
                {t.transaksi.attachmentViewButton}
              </button>
              {canModify && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(att.id)}
                  aria-label={t.transaksi.attachmentDeleteButton}
                  className="btn btn--ghost btn--icon text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDeleteDialog
        label={
          deleteTarget !== null ? t.transaksi.attachmentsSectionLabel : null
        }
        title={t.transaksi.attachmentDeleteConfirmTitle}
        body={t.transaksi.attachmentDeleteConfirmBody}
        confirmLabel={t.transaksi.attachmentDeleteButton}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

/** Read-only transaction detail view — opened by clicking/tapping a TxRow. */
export function TransactionDetailDialog({
  tx,
  open,
  onClose,
  onEdit,
  onDelete,
  familyGroupId,
  token,
}: {
  tx: TransactionDto;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  // EPIC-024 Task L3 (D15, US-TXN-9) — needed to scope the attachment list
  // request; optional so any pre-existing caller that doesn't pass them
  // simply renders without the attachment section instead of crashing.
  familyGroupId?: string;
  token?: string;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const isIncome = tx.type === "income";
  const amount = parseFloat(tx.amount);
  const amountStr = (isIncome ? "+" : "-") + money.format(amount);
  const typeLabel = t.transaksi.typeLabels[tx.type] ?? tx.type;
  // C4 (group E retry round 4) — mirrors TxRow's own guard: the detail
  // view's own Edit/Hapus buttons must be honest too.
  const isObligationLinked = !!tx.liabilityId || !!tx.insuranceId;
  // EPIC-036 (edit-rights) — same additional lock as TxRow/TxTableRow.
  const isEditLocked = isObligationLinked || tx.canModify === false;
  const editLockTooltip = isObligationLinked
    ? t.transaksi.obligationLockedTooltip
    : t.transaksi.editRightsLockedTooltip;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      {/* EPIC-026 Wave 8 — #dlg-tx-detail is the prototype's DEFAULT 480px
          `.dialog` (only #dlg-tx-delete carries `dialog--sm`), so no width
          modifier here. */}
      {/* Bento v2: detail views open as a right side panel (bottom sheet on phones). */}
      <PanelContent variant="side">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {t.transaksi.detailDialogTitle}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {t.transaksi.detailDialogDesc}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <XIcon aria-hidden="true" />
          </DialogClose>
        </header>
        <div className="wm-panel-body">
          <div className="tx-detail-hero" data-type={tx.type}>
            <span className="tx-detail-badge">{typeLabel}</span>
            <span className="tx-detail-amt wm-num">{amountStr}</span>
          </div>
          <dl className="tx-kv">
            <DetailRow
              label={t.transaksi.detailCategoryLabel}
              value={tx.categoryName ?? "—"}
            />
            <DetailRow
              label={t.transaksi.detailAccountLabel}
              value={tx.accountName ?? "—"}
            />
            <DetailRow
              label={t.transaksi.detailDateTimeLabel}
              value={formatDetailDateTime(tx.occurredAt, locale)}
              mono
            />
            <DetailRow
              label={t.transaksi.fieldDescLabel}
              value={tx.description ?? "—"}
            />
            <DetailRow
              label={t.transaksi.detailCreatedAtLabel}
              value={formatDetailDateTime(tx.createdAt, locale)}
              mono
            />
          </dl>
          {isEditLocked && <p className="wm-cap">{editLockTooltip}</p>}
          {tx.type === "expense" && (
            <PpnHint amount={tx.amount} occurredAt={tx.occurredAt} />
          )}
          {familyGroupId && (
            <AttachmentList
              familyGroupId={familyGroupId}
              transactionId={tx.id}
              token={token}
              open={open}
              // EPIC-036 — attachments are NOT obligation-locked on the API
              // (only PATCH/DELETE on the transaction row itself is), so
              // this uses tx.canModify alone, not the combined isEditLocked.
              canModify={tx.canModify !== false}
            />
          )}
        </div>
        <div className="wm-panel-foot">
          <PillButton
            onClick={onEdit}
            disabled={isEditLocked}
            title={isEditLocked ? editLockTooltip : undefined}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t.transaksi.detailEditButton}
          </PillButton>
          <PillButton
            variant="danger"
            onClick={onDelete}
            disabled={isEditLocked}
            title={isEditLocked ? editLockTooltip : undefined}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t.transaksi.detailDeleteButton}
          </PillButton>
        </div>
      </PanelContent>
    </Dialog>
  );
}

export function EditTransactionDialog({
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
  const { t, locale } = useLocale();
  // State is initialised from props; parent passes key={tx.id} to reset on change
  const amountField = useMoneyField({
    initialRaw: tx ? String(Math.round(parseFloat(tx.amount))) : "",
    isEdit: true,
  });
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
      toast.success(t.transaksi.toastUpdated);
      onSaved();
    },
    onError: () => toast.error(t.transaksi.toastUpdateFailed),
  });

  if (!tx) return null;

  const handleSave = () => {
    const amountNum = moneyIdr(amountField, parseRupiah);
    if (!amountNum || amountNum <= 0) {
      toast.error(t.transaksi.toastInvalidAmount);
      return;
    }
    updateMutation.mutate(
      withFxInputs(
        {
          amount: amountNum,
          ...(description ? { description } : { description: null }),
          occurredAt: new Date(date).toISOString(),
        },
        [["amount", amountField]],
      ),
    );
  };

  return (
    <Dialog
      open={!!tx}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* EPIC-026 Wave 8 — #dlg-tx-edit is the prototype's default 480px
          `.dialog`, no width modifier. */}
      <DialogContent>
        <DialogTitle>{t.transaksi.editDialogTitle}</DialogTitle>
        {/* Prototype `.dialog__desc` (transaksi.html:542). */}
        <DialogDescription>{t.transaksi.editDialogDesc}</DialogDescription>
        <DialogBody>
          {/* Prototype field order: Jumlah → Deskripsi → [Tanggal | Kategori]
              → Akun. Kategori and Akun are deliberately NOT rendered: this
              dialog's PATCH body only carries amount/description/occurredAt,
              so a category or account picker here would silently discard the
              user's choice (honest UI). That also leaves Tanggal without its
              2-up partner, so it stays a full-width `.field`. */}
          <label className="field">
            <span className="label">{t.transaksi.fieldAmountLabel}</span>
            <MoneyInput field={amountField} id="tx-edit-amount" />
          </label>
          <label className="field">
            <span className="label">{t.transaksi.fieldDescLabel}</span>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.transaksi.fieldDescPlaceholder}
              maxLength={200}
            />
          </label>
          <div className="field">
            <label className="label" htmlFor="tx-edit-date">
              {t.transaksi.fieldDateLabel}
            </label>
            <DateField
              id="tx-edit-date"
              value={date}
              locale={locale}
              label={t.transaksi.fieldDateLabel}
              required
              onChange={setDate}
            />
          </div>
        </DialogBody>
        {/* Prototype `.dialog__footer` — Batal (outline) then Simpan
            (primary), right-aligned (transaksi.html:576-581). */}
        <DialogFooter>
          <button type="button" onClick={onClose} className="btn btn--outline">
            {t.transaksi.cancelButton}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              updateMutation.isPending || amountField.resolved.isPending
            }
            className="btn btn--primary"
          >
            {updateMutation.isPending
              ? t.transaksi.savingLabel
              : t.transaksi.saveButton}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── bento v2 ───────────── */

/** Axis ticks without the currency: "25 jt", "1,5 M". */
function compactAxis(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) =>
    n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)} M`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)} jt`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)} rb`;
  return `${sign}${Math.round(abs)}`;
}

/**
 * Hero chart buckets over the same (type-filtered) rows as the list: weekly
 * when the chosen range is a month or less, otherwise monthly (the last six
 * months when no range is set). `peak` is the busiest bucket, highlighted.
 */
export function bucketFlow(
  rows: readonly Pick<TransactionDto, "amount" | "type" | "occurredAt">[],
  from: string,
  to: string,
  locale: Locale,
  now = new Date(),
) {
  const tag = locale === "en" ? "en-US" : "id-ID";
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
  const start = from
    ? day(from)
    : new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const end = to ? day(to) : now;
  const spanDays =
    Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  type Bucket = {
    label: string;
    from: Date;
    to: Date;
    income: number;
    expense: number;
  };
  const buckets: Bucket[] = [];
  if (from && spanDays <= 35) {
    for (
      let d = new Date(start);
      d <= end;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
    ) {
      const last = new Date(
        Math.min(
          end.getTime(),
          new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6).getTime(),
        ),
      );
      buckets.push({
        label: `${d.getDate()}–${last.getDate()}`,
        from: d,
        to: last,
        income: 0,
        expense: 0,
      });
    }
  } else {
    for (
      let d = new Date(start.getFullYear(), start.getMonth(), 1);
      d <= end;
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    ) {
      buckets.push({
        label: d.toLocaleDateString(tag, { month: "short" }),
        from: d,
        to: new Date(d.getFullYear(), d.getMonth() + 1, 0),
        income: 0,
        expense: 0,
      });
    }
  }
  for (const tx of rows) {
    const at = day(tx.occurredAt);
    const bucket = buckets.find((b) => at >= b.from && at <= b.to);
    if (!bucket) continue;
    const amount = Math.abs(parseFloat(tx.amount));
    if (tx.type === "income") bucket.income += amount;
    else if (tx.type === "expense") bucket.expense += amount;
  }
  let peak = buckets.length - 1;
  buckets.forEach((b, i) => {
    if (
      b.income + b.expense >
      (buckets[peak]?.income ?? 0) + (buckets[peak]?.expense ?? 0)
    )
      peak = i;
  });
  return {
    labels: buckets.map((b) => b.label),
    income: buckets.map((b) => b.income),
    expense: buckets.map((b) => b.expense),
    peak: Math.max(0, peak),
  };
}

/**
 * Bento v2 history row (prototype `transaksi.html`): category icon, title,
 * "Kategori · Rekening" (or the transfer route), signed amount. Tap opens the
 * detail panel, where Ubah / Hapus live (with the same edit-rights and
 * obligation locks as before); no per-row icon buttons.
 */
export function HistoryRow({
  tx,
  onDeleteClick,
  onEditClick,
  familyGroupId,
  token,
}: {
  tx: TransactionDto;
  onDeleteClick: () => void;
  onEditClick: () => void;
  familyGroupId?: string;
  token?: string;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const typeLabels: Record<string, string> = t.transaksi.typeLabels;
  const amount = parseFloat(tx.amount);
  const isIncome = tx.type === "income";
  const isTransfer = tx.type === "transfer";
  const plain = money.format(amount).replace(/,00$/, "");
  const amountStr = isTransfer ? plain : (isIncome ? "+" : "−") + plain;
  const withRoute = isTransfer && !!tx.toAccountName;
  const title = withRoute
    ? (tx.description ?? typeLabels.transfer)
    : (tx.description ?? tx.categoryName ?? tx.accountName ?? "—");
  const meta = withRoute
    ? `${typeLabels.transfer} · ${tx.accountName ?? "—"} → ${tx.toAccountName}`
    : [tx.categoryName ?? typeLabels[tx.type], tx.accountName]
        .filter(Boolean)
        .join(" · ");
  const icon = isTransfer ? (
    <ArrowLeftRight />
  ) : (
    <CategoryIcon name={tx.categoryName ?? ""} />
  );
  // EPIC-023 group E / EPIC-036 — same lock as TxRow/TxTableRow above: an
  // obligation-linked or edit-rights-locked transaction must not offer a
  // live-looking Edit/Hapus, context menu included.
  const isObligationLinked = !!tx.liabilityId || !!tx.insuranceId;
  const isEditLocked = isObligationLinked || tx.canModify === false;
  return (
    <>
      {/* uiarc.dev context-menu reference — right-click/long-press gives
          Edit/Hapus/Lihat Detail without opening the detail dialog first.
          This row has no visible RowActions (Edit/Hapus live in the
          dialog), so the context menu is a genuinely new, additive path,
          not a duplicate of an existing control. */}
      <ContextMenu
        label={`${typeLabels[tx.type] ?? tx.type} ${title}`}
        items={[
          {
            id: "detail",
            label: t.transaksi.detailDialogTitle,
            icon: <Eye className="size-3.5" aria-hidden="true" />,
            onSelect: () => setOpen(true),
          },
          {
            id: "edit",
            label: t.common.edit,
            icon: <Pencil className="size-3.5" aria-hidden="true" />,
            onSelect: onEditClick,
            disabled: isEditLocked,
          },
          {
            id: "delete",
            label: t.common.delete,
            icon: <Trash2 className="size-3.5" aria-hidden="true" />,
            onSelect: onDeleteClick,
            disabled: isEditLocked,
            destructive: true,
          },
        ]}
        render={
          <button
            type="button"
            className="tx-row"
            data-type={tx.type}
            onClick={() => setOpen(true)}
            aria-label={`${t.transaksi.detailAriaLabelPrefix}${typeLabels[tx.type] ?? tx.type} ${title}, ${amountStr}`}
          />
        }
      >
        <span className="tx-row-ic" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0">
          <b>{title}</b>
          <small>{meta}</small>
        </span>
        <span className="tx-row-amt wm-num">{amountStr}</span>
      </ContextMenu>
      <TransactionDetailDialog
        tx={tx}
        open={open}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setOpen(false)}
        onEdit={() => {
          setOpen(false);
          onEditClick();
        }}
        onDelete={() => {
          setOpen(false);
          onDeleteClick();
        }}
      />
    </>
  );
}

export default function TransaksiPage() {
  // useSearchParams needs a Suspense boundary for prerender (EPIC-021 #24)
  return (
    <Suspense fallback={null}>
      <TransaksiPageInner />
    </Suspense>
  );
}

function TransaksiPageInner() {
  const { t, locale } = useLocale();
  const money = useMoney();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<TransactionDto | null>(null);
  // EPIC-025 restructure — real filter-card controls wired to the API's own
  // `categoryId`/`from`/`to` query params (ListTransactionsQueryDto already
  // supports them); `accountId` reuses the existing URL-driven "mutasi" lens
  // below instead of a second, conflicting piece of state.
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [[todayIso, yesterdayIso]] = useState(() => [
    new Date().toISOString().slice(0, 10),
    new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  ]);
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const { setTxnOpen } = useShell();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId");
  const activeFilterCount = getActiveTransactionFilterCount({
    hasDateRange: Boolean(dateFrom || dateTo),
    hasAccount: Boolean(accountId),
    hasCategory: Boolean(categoryFilter),
    hasType: filter !== "all",
    hasSort: sortOrder !== "newest",
  });

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
      toast.success(t.transaksi.toastDeleted);
    },
    onError: () => {
      toast.error(t.transaksi.toastDeleteFailed);
    },
  });

  const { data, isLoading, isError } = useQuery<TransactionListResponse>({
    queryKey: [
      ...queryKeys.transactions.all(familyGroupId),
      token,
      accountId,
      categoryFilter,
      dateFrom,
      dateTo,
    ],
    queryFn: async () => {
      // Fetch EVERY page, not just the first.
      //
      // This asked for `limit=50` and never sent `page`, while the table
      // paginated CLIENT-side over whatever came back — so "Semua transaksi"
      // silently showed the newest 50 and the page buttons only walked those.
      // An imported bank statement is 45+ rows in one month, which pushed
      // everything older out of the window; filtering by month brought the
      // same rows back, because the narrower filter fit under the cap. Rows
      // that exist and are quietly not shown are worse than slow.
      //
      // Both remaining client-side filters need the WHOLE set to be correct:
      // the type chips, and "Kartu Kredit", which is derived from liability
      // ids the API cannot filter on. So the pages are collected here and the
      // existing filter/sort/paginate chain below is left untouched.
      const buildParams = (page: number) => {
        const params = new URLSearchParams({
          limit: String(FETCH_PAGE_SIZE),
          page: String(page),
        });
        if (accountId) params.set("accountId", accountId);
        if (categoryFilter) params.set("categoryId", categoryFilter);
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
        return params;
      };

      const first = await apiFetch<TransactionListResponse>(
        `/family-groups/${familyGroupId}/transactions?${buildParams(1).toString()}`,
        { token },
      );

      const total = first.meta?.total ?? first.data.length;
      const rows = [...first.data];
      // Bounded so a pathological account cannot spawn unbounded requests.
      // Whatever is dropped is REPORTED (see `truncated` below) rather than
      // silently missing, which is the bug this replaces.
      const maxPages = Math.ceil(MAX_FETCHED_TRANSACTIONS / FETCH_PAGE_SIZE);
      const pagesNeeded = Math.min(
        Math.ceil(total / FETCH_PAGE_SIZE),
        maxPages,
      );

      for (let page = 2; page <= pagesNeeded; page += 1) {
        const next = await apiFetch<TransactionListResponse>(
          `/family-groups/${familyGroupId}/transactions?${buildParams(page).toString()}`,
          { token },
        );
        rows.push(...next.data);
        // A shorter page than asked for means the server has no more.
        if (next.data.length < FETCH_PAGE_SIZE) break;
      }

      return { ...first, data: rows };
    },
    enabled: !!token && !!familyGroupId,
  });

  // Per-account "mutasi" lens (EPIC-021 #24) + the filter card's "Akun"
  // select below share this same fetch — always loaded once a family group
  // is known, not only when a chip/filter is already active, since the
  // select needs the full list of options regardless.
  const { data: filterAccounts } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["accounts", familyGroupId, "txn-filter"],
    queryFn: () =>
      apiFetch<{ id: string; name: string }[]>(
        `/family-groups/${familyGroupId}/accounts`,
        { token },
      ),
    enabled: !!token && !!familyGroupId,
  });
  const filterAccountName = accountId
    ? (filterAccounts?.find((a) => a.id === accountId)?.name ?? "…")
    : null;

  // Filter card's "Kategori" select — same real endpoint
  // `transaction-dialog.tsx`'s own category picker already uses.
  const { data: filterCategories } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["categories", familyGroupId, "txn-filter"],
    queryFn: () =>
      apiFetch<{ id: string; name: string }[]>(
        `/family-groups/${familyGroupId}/categories`,
        { token },
      ),
    enabled: !!token && !!familyGroupId,
  });

  const handleAccountFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setPage(1);
    router.replace(
      value
        ? `/transaksi?accountId=${encodeURIComponent(value)}`
        : "/transaksi",
    );
  };

  const handleResetFilters = () => {
    setFilter("all");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
    setSortOrder("newest");
    setPage(1);
    if (accountId) router.replace("/transaksi", { scroll: false });
  };

  // EPIC-023 Task E retry (HIGH 4) — only fetched when the "Kartu Kredit"
  // filter is actually selected, mirroring the `filterAccounts` lazy-fetch
  // pattern above.
  const { data: filterLiabilities } = useQuery<LiabilityFilterDto[]>({
    queryKey: ["liabilities", familyGroupId, "txn-filter"],
    queryFn: () =>
      apiFetch<LiabilityFilterDto[]>(
        `/family-groups/${familyGroupId}/liabilities`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && filter === "kartu_kredit",
  });
  const creditCardLiabilityIds = new Set(
    (filterLiabilities ?? [])
      .filter((l) => l.type === "kartu_kredit")
      .map((l) => l.id),
  );

  const transactions = data?.data ?? [];
  /** True when the hard fetch ceiling cut the list short. Says so out loud —
   *  a list that is quietly incomplete is exactly the bug this replaces. */
  const truncated = (data?.meta?.total ?? 0) > transactions.length;
  const summary = data?.summary;

  // Apply filter
  const filtered =
    filter === "all"
      ? transactions
      : filter === "kartu_kredit"
        ? transactions.filter((tx) => isCreditCard(tx, creditCardLiabilityIds))
        : transactions.filter((tx) => tx.type === filter);

  // Sort by occurredAt — affects both day-group order and within-day row
  // order. occurredAt is date-only (no time picker in the add-transaction
  // form), so same-day entries tie; createdAt breaks the tie so the most
  // recently added transaction is always on top.
  const sorted = [...filtered].sort((a, b) => {
    const cmp =
      a.occurredAt.localeCompare(b.occurredAt) ||
      a.createdAt.localeCompare(b.createdAt);
    return sortOrder === "newest" ? -cmp : cmp;
  });

  const totalIncome = summary ? parseFloat(summary.totalIncome) : 0;
  const totalExpense = summary ? parseFloat(summary.totalExpense) : 0;
  const netBalance = summary ? parseFloat(summary.netBalance) : 0;

  // Income/expense transaction counts + the real applied period (only set
  // when the date-range filter above is actually in use — `summary.period`
  // echoes back the API's own `from`/`to` query params, never fabricated).
  const incomeCount = transactions.filter((tx) => tx.type === "income").length;
  const expenseCount = transactions.filter(
    (tx) => tx.type === "expense",
  ).length;
  const monthLabel = summary?.period.from
    ? formatMonthYear(summary.period.from, locale)
    : null;
  const incomeSubtext = isLoading
    ? undefined
    : `${incomeCount}${t.transaksi.transactionsCountSuffix}${monthLabel ? ` · ${monthLabel}` : ""}`;
  const expenseSubtext = isLoading
    ? undefined
    : `${expenseCount}${t.transaksi.transactionsCountSuffix}${monthLabel ? ` · ${monthLabel}` : ""}`;

  // "Otomatis rapi" insight — the one honest number derivable from the
  // already-fetched list (the other prototype pills need identity/verification
  // data the API doesn't expose, so they're deliberately not rendered).
  const categorizedCount = transactions.filter((tx) => !!tx.categoryId).length;
  const categorizedPct =
    transactions.length > 0
      ? Math.round((categorizedCount / transactions.length) * 100)
      : 0;

  const v2 = t.transaksi.v2;
  /** Whole-rupiah display: the ",00" adds nothing on a summary figure. */
  const whole = (n: number) => money.format(n).replace(/,00$/, "");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? sorted.filter((tx) =>
        [tx.description, tx.categoryName, tx.accountName, tx.toAccountName]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(needle)),
      )
    : sorted;
  const visiblePages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const visiblePage = Math.min(page, visiblePages);
  const visibleRows = visible.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );
  const flow = bucketFlow(filtered, dateFrom, dateTo, locale);
  const periodLabel =
    dateFrom || dateTo
      ? [
          dateFrom && formatShortDate(dateFrom, locale),
          dateTo && formatShortDate(dateTo, locale),
        ]
          .filter(Boolean)
          .join(" – ")
      : v2.allTime;

  const exportCsv = () => {
    if (visible.length === 0) {
      toast(v2.exportEmpty);
      return;
    }
    const rows = [
      [
        "Tanggal",
        "Jenis",
        "Deskripsi",
        "Kategori",
        "Rekening",
        "Ke rekening",
        "Jumlah",
      ],
      ...visible.map((tx) => [
        tx.occurredAt.slice(0, 10),
        t.transaksi.typeLabels[
          tx.type as keyof typeof t.transaksi.typeLabels
        ] ?? tx.type,
        tx.description ?? "",
        tx.categoryName ?? "",
        tx.accountName ?? "",
        tx.toAccountName ?? "",
        tx.amount,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(v2.exported.replace("{n}", String(visible.length)));
  };

  // Day groups over the visible page: header with the day's net, then its rows.
  const today = todayIso;
  const yesterday = yesterdayIso;
  const groups: { day: string; rows: TransactionDto[]; net: number }[] = [];
  for (const tx of visibleRows) {
    const day = tx.occurredAt.slice(0, 10);
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      group = { day, rows: [], net: 0 };
      groups.push(group);
    }
    group.rows.push(tx);
    const amount = parseFloat(tx.amount);
    if (tx.type === "income") group.net += amount;
    else if (tx.type === "expense") group.net -= amount;
  }
  const dayLabel = (day: string) =>
    day === today
      ? v2.today
      : day === yesterday
        ? v2.yesterday
        : formatFullDate(day, locale);

  return (
    <div className="flex flex-col gap-4">
      <BentoGrid className="tx-grid">
        <BentoHero
          className="tx-hero"
          valueAs="h1"
          currency={isLoading ? null : netBalance < 0 ? "−Rp" : "Rp"}
          value={
            isLoading ? "…" : whole(Math.abs(netBalance)).replace(/^[^\d]*/, "")
          }
          caption={`${netBalance >= 0 ? v2.surplus : v2.deficit} · ${periodLabel}`}
          controls={
            <>
              <GhostButton onClick={exportCsv}>{v2.exportCsv}</GhostButton>
              <GhostButton lit onClick={() => setTxnOpen(true)}>
                <Plus aria-hidden="true" /> {v2.record}
              </GhostButton>
            </>
          }
          chart={
            flow.labels.length > 0 ? (
              <HatchedBarChart
                labels={flow.labels}
                series={[
                  {
                    name: t.transaksi.totalIncomeLabel,
                    data: flow.income,
                    color: "var(--wm-lime)",
                  },
                  {
                    name: t.transaksi.totalExpenseLabel,
                    data: flow.expense,
                    color: "var(--wm-orange)",
                  },
                ]}
                highlight={flow.peak}
                format={money.formatCompact}
                axis={compactAxis}
                ariaLabel={v2.chartAria}
              />
            ) : null
          }
          kpis={
            <>
              <HeroKpi
                label={t.transaksi.totalIncomeLabel}
                value={isLoading ? "…" : whole(totalIncome)}
                short={money.formatCompact(totalIncome)}
                delta={<small className="wm-cap">{incomeSubtext}</small>}
              />
              <HeroKpi
                label={t.transaksi.totalExpenseLabel}
                value={isLoading ? "…" : whole(totalExpense)}
                short={money.formatCompact(totalExpense)}
                delta={<small className="wm-cap">{expenseSubtext}</small>}
              />
              <HeroKpi
                label={v2.txCount}
                value={isLoading ? "…" : String(visible.length)}
                delta={
                  !isLoading && transactions.length > 0 ? (
                    <small className="wm-cap">{`${categorizedPct}${t.transaksi.insightCategorizedValueSuffix}`}</small>
                  ) : undefined
                }
              />
            </>
          }
        />

        <div className="tx-filters-wrap">
          <button
            type="button"
            aria-controls="transaction-filters"
            aria-expanded={mobileFiltersOpen}
            onClick={() => setMobileFiltersOpen((open) => !open)}
            className="tx-filters-toggle"
          >
            <Filter className="size-4" aria-hidden="true" />
            {v2.filtersToggle.replace(
              "{count}",
              String(activeFilterCount + (needle ? 1 : 0)),
            )}
          </button>
          <BentoCard
            className="tx-filters"
            title={v2.filterTitle}
            action={
              <button
                type="button"
                className="tx-reset"
                onClick={() => {
                  handleResetFilters();
                  setQuery("");
                }}
              >
                {v2.reset}
              </button>
            }
          >
            <div
              id="transaction-filters"
              className="tx-filter-body"
              data-open={mobileFiltersOpen || undefined}
            >
              <label className="tx-search">
                <Search className="size-4 shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder={v2.searchPlaceholder}
                  aria-label={v2.searchPlaceholder}
                />
              </label>
              <div className="tx-types" role="group" aria-label={v2.typeAria}>
                {FILTER_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => {
                      setFilter(value);
                      setPage(1);
                    }}
                  >
                    {t.transaksi.filterLabels[value]}
                  </button>
                ))}
              </div>
              <DateRangeFilterField
                from={dateFrom}
                to={dateTo}
                locale={locale}
                label={t.transaksi.dateRangeLabel}
                cancelLabel={locale === "en" ? "Cancel" : "Batal"}
                applyLabel={locale === "en" ? "Apply" : "Terapkan"}
                onApply={(nextFrom, nextTo) => {
                  setDateFrom(nextFrom);
                  setDateTo(nextTo);
                  setPage(1);
                }}
              />
              <label className="tx-field">
                <span>{t.transaksi.accountFilterFieldLabel}</span>
                <select
                  value={accountId ?? ""}
                  onChange={handleAccountFilterChange}
                  className="select"
                >
                  <option value="">{t.transaksi.allAccountsOption}</option>
                  {filterAccounts?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tx-field">
                <span>{t.transaksi.categoryFilterFieldLabel}</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="select"
                >
                  <option value="">{t.transaksi.allCategoriesOption}</option>
                  {filterCategories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tx-field">
                <span>{t.transaksi.sortByLabel}</span>
                <select
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value as SortOrder);
                    setPage(1);
                  }}
                  className="select"
                  aria-label={t.transaksi.sortAriaLabel}
                >
                  {SORT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {t.transaksi.sortLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              {filterAccountName && (
                <button
                  type="button"
                  onClick={() => router.replace("/transaksi")}
                  className="wm-chip"
                  aria-pressed="true"
                  aria-label={`${t.transaksi.removeAccountFilterAriaLabelPrefix}${filterAccountName}`}
                >
                  {t.transaksi.accountFilterPrefix}
                  {filterAccountName}
                  {t.transaksi.accountFilterSuffix}
                </button>
              )}
            </div>
          </BentoCard>
        </div>

        <BentoCard
          className="tx-history"
          title={v2.history}
          action={
            !isLoading ? (
              <span className="wm-cap">{`${visible.length}${t.transaksi.transactionsCountSuffix}`}</span>
            ) : undefined
          }
        >
          {isError && (
            <div role="alert" className="tx-note" data-tone="bad">
              {t.transaksi.errorLoad}
            </div>
          )}
          {isLoading && (
            <p className="wm-cap py-6 text-center">
              {t.transaksi.loadingLabel}
            </p>
          )}
          {truncated && (
            <div className="tx-note" data-tone="warn">
              {t.transaksi.listTruncatedNote
                .replace("{shown}", String(transactions.length))
                .replace("{total}", String(data?.meta?.total ?? 0))}
            </div>
          )}
          {!isLoading &&
            groups.map((group) => (
              <section
                key={group.day}
                className="tx-day"
                aria-label={dayLabel(group.day)}
              >
                <header>
                  <span>{dayLabel(group.day)}</span>
                  <span className={"wm-num " + (group.net > 0 ? "wm-pos" : "")}>
                    {group.net > 0 ? "+" : group.net < 0 ? "−" : ""}
                    {money.formatCompact(Math.abs(group.net))}
                  </span>
                </header>
                {group.rows.map((tx) => (
                  <HistoryRow
                    key={tx.id}
                    tx={tx}
                    familyGroupId={familyGroupId}
                    token={token}
                    onDeleteClick={() => setDeleteTarget(tx.id)}
                    onEditClick={() => setEditTarget(tx)}
                  />
                ))}
              </section>
            ))}
          {!isLoading && visible.length === 0 && !isError && (
            <p className="wm-cap py-6 text-center">
              {t.transaksi.emptyFiltered}
            </p>
          )}
          {!isLoading && visible.length > 0 && (
            <footer className="tx-pager">
              <span className="wm-cap">
                {t.transaksi.paginationShowingLabel}
                {visibleRows.length}
                {t.transaksi.paginationOfMid}
                {visible.length}
                {t.transaksi.transactionsCountSuffix}
              </span>
              <div>
                <PillButton
                  disabled={visiblePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t.transaksi.paginationPrevButton}
                </PillButton>
                <PillButton
                  disabled={visiblePage >= visiblePages}
                  onClick={() => setPage((p) => Math.min(visiblePages, p + 1))}
                >
                  {t.transaksi.paginationNextButton}
                </PillButton>
              </div>
            </footer>
          )}
        </BentoCard>
      </BentoGrid>

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

      {/* EPIC-026 Wave 8 — the prototype's #dlg-tx-delete copy: title
          "Hapus Transaksi?" + the `.dialog__desc` that spells out the
          consequence ("...saldo akun akan disesuaikan"). The shared
          ConfirmDeleteDialog already renders the prototype's `dialog--sm`
          box and Batal/destructive footer; only the copy was generic. */}
      <ConfirmDeleteDialog
        label={deleteTarget !== null ? t.transaksi.deleteLabel : null}
        title={t.transaksi.deleteDialogTitle}
        body={t.transaksi.deleteDialogBody}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
