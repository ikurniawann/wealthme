"use client";

import {
  useState,
  useEffect,
  Suspense,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ChevronDown,
  ArrowDownLeft,
  CreditCard,
  ArrowLeftRight,
  FileText,
  Filter,
  Image as ImageIcon,
  Lock,
  Paperclip,
  Scale,
  Sparkles,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useShell } from "@/components/shell/shell-context";
import { formatAmountInput, parseRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

import { SectionCard, CardLink, StatusBadge, IconChip } from "@/components/wm";
import { RowActions, ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";
import type {
  TransactionAttachmentDto,
  TransactionDto,
  TransactionListResponse,
} from "@wealthme/contracts";

// EPIC-024 Task L3 (D15, US-TXN-9) — page-local helper, same convention as
// `app/(app)/dana/page.tsx`'s own copy: never touch lib/api-client.ts.
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as Partial<ApiError>).message)
    : fallback;
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
    throw new AttachmentFetchError(res.status, res.statusText);
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
function formatMonthYear(dateStr: string, locale: Locale): string {
  const [year, month] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    month: "long",
    year: "numeric",
  });
}

const PAGE_SIZE = 10;

const fieldClass =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

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
  const [detailOpen, setDetailOpen] = useState(false);
  const isIncome = tx.type === "income";
  const amount = parseFloat(tx.amount);
  const amountStr = (isIncome ? "+" : "-") + formatRupiah(amount);
  const txIcon = TX_ICON[tx.type] ?? TX_ICON.expense;
  const typeLabels: Record<string, string> = t.transaksi.typeLabels;
  // EPIC-023 group E retry round 4 (C4) — the API now REFUSES to edit or
  // delete an obligation-linked transaction (a liability payment/purchase
  // or insurance premium): editing/deleting it would desync the debt/
  // coverage it recorded from the ledger. Honest UI: disable Edit/Hapus
  // here instead of leaving a live-looking control the server rejects.
  const isObligationLinked = !!tx.liabilityId || !!tx.insuranceId;
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
                (isIncome ? "text-success" : "text-destructive")
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
          disabled={isObligationLinked}
          disabledLabel={t.transaksi.obligationLockedTooltip}
        />
      </div>
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
function TxTableRow({
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
  const [detailOpen, setDetailOpen] = useState(false);
  const isIncome = tx.type === "income";
  const isTransfer = tx.type === "transfer";
  const amount = parseFloat(tx.amount);
  // A transfer moves money between the family's own accounts — neither a
  // gain nor a loss — so (unlike income/expense) it renders with no sign and
  // a neutral color, matching the prototype's "Rp 1.000.000" transfer row.
  const amountStr = isTransfer
    ? formatRupiah(amount)
    : (isIncome ? "+" : "-") + formatRupiah(amount);
  const typeLabels: Record<string, string> = t.transaksi.typeLabels;
  const isObligationLinked = !!tx.liabilityId || !!tx.insuranceId;
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
      <tr
        tabIndex={0}
        onClick={openDetail}
        onKeyDown={handleRowKeyDown}
        aria-label={`${t.transaksi.detailAriaLabelPrefix}${typeLabel} ${displayName}, ${amountStr}`}
        className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent/40 focus:outline-none focus-visible:bg-accent/40"
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
            {isObligationLinked && (
              <StatusBadge variant="warning">
                <Lock className="size-2.5" />
                {t.transaksi.lockedBadgeLabel}
              </StatusBadge>
            )}
          </div>
          {(isTransferWithDest || isObligationLinked) && (
            <div className="text-[11px] text-muted-foreground">
              {isObligationLinked
                ? t.transaksi.obligationLockedTooltip
                : accountCell}
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
            "px-3 py-3 text-right align-top font-[family-name:var(--font-mono)] text-[13px] font-bold",
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
            disabled={isObligationLinked}
            disabledLabel={t.transaksi.obligationLockedTooltip}
          />
        </td>
      </tr>
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

/** `.stat` card (icon + label + amount + optional muted subtext line) —
 * matches `@/components/wm`'s `SummaryCard` visuals exactly, but adds a
 * neutral (non success/destructive-forced) subtext slot that
 * `SummaryCard` (a protected foundation component) doesn't expose, needed
 * for the income/expense cards' "N transaksi · <bulan>" line. Inlined per
 * WM_CONVENTIONS.md's "if not, inline the Tailwind translation in the page
 * file" rule rather than editing the shared primitive. */
function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  amount,
  subtext,
  subtextClassName,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor?: string;
  label: ReactNode;
  amount: ReactNode;
  subtext?: ReactNode;
  subtextClassName?: string;
}) {
  return (
    <Card className="gap-0 p-4">
      <div
        className="mb-2 flex size-[34px] items-center justify-center rounded-md text-[15px]"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="mb-0.5 text-[10.5px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mb-[3px] text-[15px] font-extrabold">{amount}</div>
      {subtext && (
        <div
          className={cn(
            "text-[10.5px] font-bold",
            subtextClassName ?? "text-muted-foreground",
          )}
        >
          {subtext}
        </div>
      )}
    </Card>
  );
}

/** Top insight pill row — prototype's `.value-strip`/`.value-pill`. Only
 * the "% terkategori" pill is honest here: the other two prototype pills
 * ("N anggota aktif mencatat", "N transaksi besar sudah diverifikasi")
 * need a per-transaction recorder identity and a verification flag that
 * `TransactionDto` doesn't carry — they are deliberately NOT rendered
 * rather than shipped with an invented number. */
function InsightPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <span className="text-[12.5px] font-semibold">{value}</span>
      </span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] font-medium">{value}</span>
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
}: {
  familyGroupId: string;
  transactionId: string;
  token: string | undefined;
  open: boolean;
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
    <div className="pt-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <Paperclip className="size-3.5" />
        {t.transaksi.attachmentsSectionLabel}
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
      {!isLoading && !isError && attachments.length === 0 && (
        <p className="text-[12px] text-muted-foreground">
          {t.transaksi.attachmentsEmptyLabel}
        </p>
      )}

      <div className="space-y-1.5">
        {attachments.map((att) => {
          const isImage = att.mimeType.startsWith("image/");
          const AttIcon = isImage ? ImageIcon : FileText;
          const label = isImage
            ? t.transaksi.attachmentImageLabel
            : t.transaksi.attachmentPdfLabel;
          return (
            <div
              key={att.id}
              className="flex items-center gap-2.5 rounded-md border bg-card px-2.5 py-2"
            >
              <IconChip
                icon={AttIcon}
                className="bg-secondary text-muted-foreground"
                size={28}
                rounded="rounded-md"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium">
                  {label}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {formatFileSize(att.size)} ·{" "}
                  {formatDetailDateTime(att.createdAt, locale)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleView(att.id)}
                disabled={pendingViewId === att.id}
                className="rounded-md border px-2 py-1 text-[11.5px] font-semibold disabled:opacity-50"
              >
                {t.transaksi.attachmentViewButton}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(att.id)}
                aria-label={t.transaksi.attachmentDeleteButton}
                className="rounded-md border p-1.5 text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
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
  const isIncome = tx.type === "income";
  const amount = parseFloat(tx.amount);
  const amountStr = (isIncome ? "+" : "-") + formatRupiah(amount);
  const txIcon = TX_ICON[tx.type] ?? TX_ICON.expense;
  const typeLabel = t.transaksi.typeLabels[tx.type] ?? tx.type;
  // C4 (group E retry round 4) — mirrors TxRow's own guard: the detail
  // view's own Edit/Hapus buttons must be honest too.
  const isObligationLinked = !!tx.liabilityId || !!tx.insuranceId;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogTitle>{t.transaksi.detailDialogTitle}</DialogTitle>
        <div className="space-y-1 pt-1">
          <div className="mb-2 flex items-center justify-between">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${txIcon.chip}`}
            >
              {typeLabel}
            </span>
            <span
              className={
                "text-[17px] font-bold " +
                (isIncome ? "text-success" : "text-destructive")
              }
            >
              {amountStr}
            </span>
          </div>
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
          />
          <DetailRow
            label={t.transaksi.fieldDescLabel}
            value={tx.description ?? "—"}
          />
          <DetailRow
            label={t.transaksi.detailCreatedAtLabel}
            value={formatDetailDateTime(tx.createdAt, locale)}
          />
          {isObligationLinked && (
            <p className="pt-2 text-[11.5px] text-muted-foreground">
              {t.transaksi.obligationLockedTooltip}
            </p>
          )}
          {familyGroupId && (
            <AttachmentList
              familyGroupId={familyGroupId}
              transactionId={tx.id}
              token={token}
              open={open}
            />
          )}
          <div className="flex gap-2 pt-3">
            <button
              onClick={onEdit}
              disabled={isObligationLinked}
              title={
                isObligationLinked
                  ? t.transaksi.obligationLockedTooltip
                  : undefined
              }
              className="flex-1 rounded-md border py-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.transaksi.detailEditButton}
            </button>
            <button
              onClick={onDelete}
              disabled={isObligationLinked}
              title={
                isObligationLinked
                  ? t.transaksi.obligationLockedTooltip
                  : undefined
              }
              className="flex-1 rounded-md bg-destructive py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.transaksi.detailDeleteButton}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const { t } = useLocale();
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
      toast.success(t.transaksi.toastUpdated);
      onSaved();
    },
    onError: () => toast.error(t.transaksi.toastUpdateFailed),
  });

  if (!tx) return null;

  const handleSave = () => {
    const amountNum = parseRupiah(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error(t.transaksi.toastInvalidAmount);
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
        <DialogTitle>{t.transaksi.editDialogTitle}</DialogTitle>
        <div className="space-y-3 pt-1">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              {t.transaksi.fieldAmountLabel}
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
              {t.transaksi.fieldDescLabel}
            </label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.transaksi.fieldDescPlaceholder}
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              {t.transaksi.fieldDateLabel}
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
              {t.transaksi.cancelButton}
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex-1 rounded-md bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {updateMutation.isPending
                ? t.transaksi.savingLabel
                : t.transaksi.saveButton}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
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
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const { setTxnOpen } = useShell();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId");

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
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (accountId) params.set("accountId", accountId);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      return apiFetch<TransactionListResponse>(
        `/family-groups/${familyGroupId}/transactions?${params.toString()}`,
        { token },
      );
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
    setPage(1);
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

  // Prototype's table renders a flat, paginated row list (no date-group
  // headers) — the date is its own table column instead.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTransactions = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const totalIncome = summary ? parseFloat(summary.totalIncome) : 0;
  const totalExpense = summary ? parseFloat(summary.totalExpense) : 0;
  const netBalance = summary ? parseFloat(summary.netBalance) : 0;

  // EPIC-025 N3-E4 — per-stat cards (translation table's `.stat` →
  // `SummaryCard`) replace the single combined MoneyStat row; the surplus/
  // deficit % is derived from the already-fetched summary, not invented copy.
  const netPct =
    totalIncome > 0 ? Math.round((netBalance / totalIncome) * 100) : 0;

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

  // "Otomatis rapi" insight pill — the one honest number derivable from the
  // already-fetched list (see the omission note on `InsightPill` above).
  const categorizedCount = transactions.filter((tx) => !!tx.categoryId).length;
  const categorizedPct =
    transactions.length > 0
      ? Math.round((categorizedCount / transactions.length) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-[13px] text-muted-foreground">
          {t.transaksi.headerDesc}
        </span>
        {filterAccountName && (
          <button
            type="button"
            onClick={() => router.replace("/transaksi")}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-primary"
            aria-label={`${t.transaksi.removeAccountFilterAriaLabelPrefix}${filterAccountName}`}
          >
            {t.transaksi.accountFilterPrefix}
            {filterAccountName}
            {t.transaksi.accountFilterSuffix}
          </button>
        )}
        <button
          onClick={() => setTxnOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-3.5" /> {t.transaksi.addTransactionButton}
        </button>
      </div>

      {/* Insight pill row — prototype's `.value-strip`. Only the honestly
          derivable pill is rendered; see `InsightPill`'s own doc comment for
          the two prototype pills deliberately omitted instead of faked. */}
      {!isLoading && transactions.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          <InsightPill
            icon={<Sparkles className="size-4" />}
            label={t.transaksi.insightCategorizedLabel}
            value={`${categorizedPct}${t.transaksi.insightCategorizedValueSuffix}`}
          />
        </div>
      )}

      {/* Filter card — prototype's `.card.transaction-filter-section`
          (translation table: `.card` → `SectionCard`). Rentang Tanggal/
          Akun/Kategori below are real controls wired to the API's own
          `from`/`to`/`categoryId`/`accountId` query params — see the
          `data` query above. */}
      <SectionCard
        title={
          <span className="inline-flex items-center gap-1.5">
            <Filter className="size-3.5" />
            {t.transaksi.filterCardTitle}
          </span>
        }
        action={
          <div className="flex items-center gap-2.5">
            {!isLoading && (
              <StatusBadge variant="gray">
                {sorted.length}
                {t.transaksi.transactionsCountSuffix}
              </StatusBadge>
            )}
            <CardLink onClick={handleResetFilters}>
              {t.transaksi.resetFilterButton}
            </CardLink>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              {t.transaksi.dateRangeLabel}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                aria-label={t.transaksi.dateFromAriaLabel}
                className={fieldClass}
              />
              <span className="text-[12px] text-muted-foreground">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                aria-label={t.transaksi.dateToAriaLabel}
                className={fieldClass}
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              {t.transaksi.accountFilterFieldLabel}
            </span>
            <select
              value={accountId ?? ""}
              onChange={handleAccountFilterChange}
              className={fieldClass}
            >
              <option value="">{t.transaksi.allAccountsOption}</option>
              {filterAccounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              {t.transaksi.categoryFilterFieldLabel}
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">{t.transaksi.allCategoriesOption}</option>
              {filterCategories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label={t.transaksi.filterCardTitle}
            className="hide-scrollbar flex gap-2 overflow-x-auto"
          >
            {FILTER_VALUES.map((value) => (
              <button
                key={value}
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
                aria-pressed={filter === value}
                className={
                  "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors " +
                  (filter === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent")
                }
              >
                {t.transaksi.filterLabels[value]}
              </button>
            ))}
          </div>

          {/* Sort control — styled native select per WM conventions for simplicity */}
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3 text-[12px] text-muted-foreground select-none">
              {t.transaksi.sortByLabel}
            </span>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as SortOrder);
                setPage(1);
              }}
              className="appearance-none rounded-lg border bg-card py-1.5 pl-[68px] pr-7 text-[13px] font-semibold text-foreground outline-none transition-colors focus:border-primary cursor-pointer"
              aria-label={t.transaksi.sortAriaLabel}
            >
              {SORT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t.transaksi.sortLabels[value]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
          </div>
        </div>
      </SectionCard>

      {/* Summary stat cards — prototype's `.auto-grid--metrics` of
          `.card.stat`. Subtext lines are derived from the already-fetched
          list/summary, not invented copy — the month label only appears
          when a real date-range filter is active (`summary.period.from`). */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard
          icon={<ArrowDownLeft className="size-[17px]" />}
          iconBg="var(--success-soft)"
          iconColor="var(--success)"
          label={t.transaksi.totalIncomeLabel}
          amount={isLoading ? "…" : formatRupiah(totalIncome)}
          subtext={incomeSubtext}
        />
        <StatCard
          icon={<CreditCard className="size-[17px]" />}
          iconBg="color-mix(in oklab, var(--destructive) 14%, transparent)"
          iconColor="var(--destructive)"
          label={t.transaksi.totalExpenseLabel}
          amount={isLoading ? "…" : formatRupiah(totalExpense)}
          subtext={expenseSubtext}
        />
        <StatCard
          icon={<Scale className="size-[17px]" />}
          iconBg="var(--accent)"
          iconColor="var(--accent-foreground)"
          label={t.transaksi.differenceLabel}
          amount={isLoading ? "…" : formatRupiah(netBalance)}
          subtext={
            isLoading
              ? undefined
              : `${netBalance >= 0 ? t.transaksi.surplusLabel : t.transaksi.deficitLabel} ${Math.abs(netPct)}${t.transaksi.ofIncomeSuffix}`
          }
          subtextClassName={
            netBalance >= 0 ? "text-success" : "text-destructive"
          }
        />
      </div>

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
        >
          {t.transaksi.errorLoad}
        </div>
      )}

      {/* Transaction table — prototype's `.card.transaction-table-section`
          `.table.table--transactions` (translation table: `.card` →
          `SectionCard`). Wrapped for horizontal scroll on mobile per
          WM_CONVENTIONS.md's table responsiveness rule. */}
      <SectionCard
        title={t.transaksi.listSectionTitle}
        action={
          <span className="text-[11.5px] text-muted-foreground">
            {t.transaksi.listSectionHint}
          </span>
        }
        bodyClassName="pt-0"
      >
        {isLoading && (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            {t.transaksi.loadingLabel}
          </div>
        )}

        {!isLoading && sorted.length > 0 && (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      {t.transaksi.tableColDate}
                    </th>
                    <th className="px-3 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      {t.transaksi.tableColDesc}
                    </th>
                    <th className="px-3 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      {t.transaksi.tableColCategory}
                    </th>
                    <th className="px-3 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      {t.transaksi.tableColAccount}
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      {t.transaksi.tableColAmount}
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      {t.transaksi.tableColOptions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTransactions.map((tx) => (
                    <TxTableRow
                      key={tx.id}
                      tx={tx}
                      familyGroupId={familyGroupId}
                      token={token}
                      onDeleteClick={() => setDeleteTarget(tx.id)}
                      onEditClick={() => setEditTarget(tx)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3">
              <span className="text-[11.5px] text-muted-foreground">
                {t.transaksi.paginationShowingLabel}
                {pagedTransactions.length}
                {t.transaksi.paginationOfMid}
                {sorted.length}
                {t.transaksi.transactionsCountSuffix}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border px-3 py-1.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.transaksi.paginationPrevButton}
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md border px-3 py-1.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.transaksi.paginationNextButton}
                </button>
              </div>
            </div>
          </>
        )}

        {!isLoading && sorted.length === 0 && !isError && (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            {t.transaksi.emptyFiltered}
          </div>
        )}
      </SectionCard>

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
        label={deleteTarget !== null ? t.transaksi.deleteLabel : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
