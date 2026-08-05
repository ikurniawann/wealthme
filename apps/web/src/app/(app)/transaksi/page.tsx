"use client";

import { useState, useEffect, Suspense, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ChevronDown,
  ArrowDownLeft,
  CreditCard,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useShell } from "@/components/shell/shell-context";
import { formatAmountInput, parseRupiah } from "@/lib/format";

import { SectionCard, MoneyStat, IconChip, Rise } from "@/components/wm";
import { RowActions, ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";
import type {
  TransactionDto,
  TransactionListResponse,
} from "@wealthme/contracts";

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

function formatDayLabel(
  dateStr: string,
  t: ReturnType<typeof useLocale>["t"],
  locale: Locale,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (dateStr === today) return t.common.today;
  if (dateStr === yesterday) return t.common.yesterday;
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Absolute "D Month YYYY" date, always the real calendar date (never "Hari
 * ini"/"Kemarin" relative labels) — used in the read-only detail view where
 * the exact date matters. Parses the date parts directly from the ISO
 * string (like formatDayLabel above) rather than `new Date(isoString)`, to
 * avoid a timezone-conversion shift of the displayed calendar day.
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

const TX_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  income: { icon: ArrowDownLeft, chip: "bg-green-100 text-green-600" },
  expense: { icon: CreditCard, chip: "bg-red-100 text-red-600" },
  transfer: { icon: ArrowLeftRight, chip: "bg-violet-100 text-violet-600" },
};

export function TxRow({
  tx,
  onDeleteClick,
  onEditClick,
}: {
  tx: TransactionDto;
  onDeleteClick: () => void;
  onEditClick: () => void;
}) {
  const { t } = useLocale();
  const [detailOpen, setDetailOpen] = useState(false);
  const isIncome = tx.type === "income";
  const amount = parseFloat(tx.amount);
  const amountStr = (isIncome ? "+" : "-") + formatRupiah(amount);
  const txIcon = TX_ICON[tx.type] ?? TX_ICON.expense;
  const typeLabels: Record<string, string> = t.transaksi.typeLabels;
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
        />
      </div>
      <TransactionDetailDialog
        tx={tx}
        open={detailOpen}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] font-medium">{value}</span>
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
}: {
  tx: TransactionDto;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useLocale();
  const isIncome = tx.type === "income";
  const amount = parseFloat(tx.amount);
  const amountStr = (isIncome ? "+" : "-") + formatRupiah(amount);
  const txIcon = TX_ICON[tx.type] ?? TX_ICON.expense;
  const typeLabel = t.transaksi.typeLabels[tx.type] ?? tx.type;

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
          <div className="flex gap-2 pt-3">
            <button
              onClick={onEdit}
              className="flex-1 rounded-md border py-2.5 text-[13px] font-semibold"
            >
              {t.transaksi.detailEditButton}
            </button>
            <button
              onClick={onDelete}
              className="flex-1 rounded-md bg-destructive py-2.5 text-[13px] font-semibold text-white"
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
    queryKey: [...queryKeys.transactions.all(familyGroupId), token, accountId],
    queryFn: () =>
      apiFetch<TransactionListResponse>(
        `/family-groups/${familyGroupId}/transactions?limit=50${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`,
        { token },
      ),
    enabled: !!token && !!familyGroupId,
  });

  // Per-account "mutasi" lens (EPIC-021 #24): resolve the account name for the
  // filter pill only when an accountId filter is active.
  const { data: filterAccounts } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["accounts", familyGroupId, "txn-filter"],
    queryFn: () =>
      apiFetch<{ id: string; name: string }[]>(
        `/family-groups/${familyGroupId}/accounts`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && !!accountId,
  });
  const filterAccountName = accountId
    ? (filterAccounts?.find((a) => a.id === accountId)?.name ?? "…")
    : null;

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

  const groups = sorted.reduce<Record<string, TransactionDto[]>>((acc, tx) => {
    const day = tx.occurredAt.slice(0, 10);
    const existing = acc[day];
    return { ...acc, [day]: existing ? [...existing, tx] : [tx] };
  }, {});

  // Day order derived from sort: newest = desc, oldest = asc
  const sortedDays = Object.keys(groups).sort((a, b) =>
    sortOrder === "newest" ? b.localeCompare(a) : a.localeCompare(b),
  );

  const totalIncome = summary ? parseFloat(summary.totalIncome) : 0;
  const totalExpense = summary ? parseFloat(summary.totalExpense) : 0;
  const netBalance = summary ? parseFloat(summary.netBalance) : 0;

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

      {/* Summary bar */}
      <div className="rounded-[14px] border bg-card p-4">
        <div className="grid grid-cols-3 gap-3">
          <MoneyStat
            label={t.transaksi.totalIncomeLabel}
            value={isLoading ? "…" : formatRupiah(totalIncome)}
            valueClass="text-success"
          />
          <MoneyStat
            label={t.transaksi.totalExpenseLabel}
            value={isLoading ? "…" : formatRupiah(totalExpense)}
            valueClass="text-destructive"
          />
          <MoneyStat
            label={t.transaksi.differenceLabel}
            value={isLoading ? "…" : formatRupiah(netBalance)}
            valueClass={netBalance >= 0 ? "text-success" : "text-destructive"}
          />
        </div>
      </div>

      {/* Filter pills (left) + sort control (right) — redundant "Tambah" button removed */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          {FILTER_VALUES.map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
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
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
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

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
        >
          {t.transaksi.errorLoad}
        </div>
      )}

      {/* Transaction list */}
      <div className="space-y-1">
        {isLoading && (
          <SectionCard>
            <div className="py-6 text-center text-[13px] text-muted-foreground">
              {t.transaksi.loadingLabel}
            </div>
          </SectionCard>
        )}

        {!isLoading &&
          sortedDays.map((day, i) => (
            <Rise key={day} index={i}>
              <div>
                <div className="mt-3 mb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  {formatDayLabel(day, t, locale)}
                </div>
                <div className="space-y-1.5">
                  {groups[day]?.map((tx) => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      onDeleteClick={() => setDeleteTarget(tx.id)}
                      onEditClick={() => setEditTarget(tx)}
                    />
                  ))}
                </div>
              </div>
            </Rise>
          ))}

        {!isLoading && sortedDays.length === 0 && !isError && (
          <SectionCard>
            <div className="py-6 text-center text-[13px] text-muted-foreground">
              {t.transaksi.emptyFiltered}
            </div>
          </SectionCard>
        )}
      </div>

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
