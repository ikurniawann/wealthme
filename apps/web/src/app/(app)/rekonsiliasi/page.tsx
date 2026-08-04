"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  CloudUpload,
  FileText,
  FileSpreadsheet,
  Lightbulb,
  RotateCw,
  Save,
  Scissors,
  Bot,
  X,
  ChevronRight,
} from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  SectionCard,
  StatusBadge,
  ProgressBar,
  CardLink,
} from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, parseRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

/* ─────────────────────────── Types ─────────────────────────── */

type BankSyncDto = {
  id: string;
  familyGroupId: string;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
};

/**
 * EPIC-021 Group C (#9) — read-only summary of the entry's matched
 * Transaction, embedded by the API's `/entries` and `/split` responses
 * (mirrors `apps/api/src/reconciliation/reconciliation.service.ts`'s
 * `MatchedTransactionSummaryDto`).
 */
type MatchedTransactionSummaryDto = {
  id: string;
  accountId: string;
  accountName: string;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  amount: string;
  type: string;
  description: string | null;
  occurredAt: string;
  createdAt: string;
};

type BankSyncEntryDto = {
  id: string;
  bankSyncId: string;
  date: string;
  description: string;
  amount: string;
  currency: string;
  reconStatus: string;
  matchedTxId: string | null;
  suggestedTxId: string | null;
  createdAt: string;
  matchedTransaction: MatchedTransactionSummaryDto | null;
};

type AutoMatchResultDto = {
  totalEntries: number;
  suggested: number;
};

/** Minimal account shape for the split dialog's source/destination selects
 * (same shape as `@/components/shell/transaction-dialog.tsx`'s local AccountDto). */
type AccountDto = { id: string; name: string; institution: string | null };

/* ─────────────────────────── Static data ─────────────────────────── */

const STEP_NUMS = [1, 2, 3, 4] as const;

// NOTE: real bank names/codes — proper nouns, kept as-is in both locales
// (same value-locked-copy convention as `donation`'s `LEMBAGA_OPTIONS`).
const SUPPORTED_BANKS = [
  { code: "BCA", name: "BCA", bg: "#0061AF", color: "#fff" },
  { code: "MDR", name: "Mandiri", bg: "#F9A01B", color: "#000" },
  { code: "BNI", name: "BNI", bg: "#FF6600", color: "#fff" },
  { code: "BRI", name: "BRI", bg: "#E31937", color: "#fff" },
  { code: "CMB", name: "CIMB", bg: "#C8282E", color: "#fff" },
  { code: "PMT", name: "Permata", bg: "#E8002D", color: "#fff" },
] as const;

type MatchStatus = "ok" | "warn" | "err";

/* ─────────────────────────── Stepper ─────────────────────────── */

function Stepper({ step }: { step: number }) {
  const { t } = useLocale();
  return (
    <div className="mb-5 flex items-center">
      {STEP_NUMS.map((num, i) => {
        const done = step > num;
        const active = step === num;
        const s = t.rekonsiliasi.steps[num];
        return (
          <React.Fragment key={num}>
            <div className="flex flex-1 flex-col items-center text-center">
              <div
                className={[
                  "flex size-9 items-center justify-center rounded-full text-[14px] font-bold transition-colors",
                  done
                    ? "bg-success text-white"
                    : active
                      ? "bg-primary text-white ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {done ? <Check className="size-[18px]" /> : num}
              </div>
              <div
                className={[
                  "mt-1.5 text-[12px] font-bold",
                  active || done ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {s.label}
                <span className="block text-[10px] font-normal text-muted-foreground">
                  {s.sub}
                </span>
              </div>
            </div>
            {i < STEP_NUMS.length - 1 && (
              <div
                className={[
                  "mx-1 mb-7 h-[2px] flex-1 transition-colors",
                  step > num ? "bg-success" : "bg-border",
                ].join(" ")}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Status icon ─────────────────────────── */

function MatchIcon({ status }: { status: MatchStatus }) {
  const cls =
    status === "ok"
      ? "bg-success"
      : status === "warn"
        ? "bg-warning"
        : "bg-destructive";
  return (
    <div className="flex w-9 flex-shrink-0 items-center justify-center">
      <div
        className={`flex size-6 items-center justify-center rounded-full ${cls}`}
      >
        {status === "ok" && <Check className="size-[13px] text-white" />}
        {status === "warn" && (
          <span className="text-[12px] font-bold leading-none text-white">
            !
          </span>
        )}
        {status === "err" && <X className="size-[13px] text-white" />}
      </div>
    </div>
  );
}

function entryStatus(reconStatus: string): MatchStatus {
  if (reconStatus === "matched") return "ok";
  if (reconStatus === "suggested") return "warn";
  return "err";
}

/**
 * EPIC-021 Group C (#9/#29) — `BankSyncEntry.amount` matches
 * `Transaction.amount`'s plain-Rupiah scale (confirmed by the seed data and
 * by `ReconciliationService.autoMatch`, which compares the two directly with
 * no scaling). This deliberately does NOT reuse the Step-3 row's existing
 * `/100` display division below — that division only makes sense for the
 * CSV-upload path's amount parsing and does not match real (seeded) entries;
 * fixing that pre-existing display quirk is out of scope here. Both new
 * dialogs below need the un-scaled value: the detail view to show it
 * correctly, and the split dialog because its principal+fee sum is
 * validated server-side against the raw, un-scaled `entry.amount`.
 */
function formatEntryAmount(
  entry: Pick<BankSyncEntryDto, "amount" | "currency">,
  numLocale: string,
): { display: string; className: string; magnitude: number } {
  const amtNum = Number(entry.amount);
  const formatted = new Intl.NumberFormat(numLocale, {
    style: "currency",
    currency: entry.currency || "IDR",
    minimumFractionDigits: 0,
  }).format(Math.abs(amtNum));
  return {
    display: amtNum < 0 ? `-${formatted}` : `+${formatted}`,
    className: amtNum < 0 ? "text-destructive" : "text-success",
    magnitude: Math.abs(amtNum),
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] font-medium">{value}</span>
    </div>
  );
}

/** EPIC-021 Group C (#9) — read-only detail view for a reconciliation
 * entry, opened by clicking/tapping its row (mirrors the `/transaksi`
 * `TxRow` → `TransactionDetailDialog` pattern). Shows the entry itself and,
 * when matched, the full matched Transaction. */
export function EntryDetailDialog({
  entry,
  onClose,
}: {
  entry: BankSyncEntryDto | null;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const numLocale = locale === "en" ? "en-US" : "id-ID";
  const dateOpts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };

  const amt = entry
    ? formatEntryAmount(entry, numLocale)
    : { display: "", className: "" };
  const status = entry ? entryStatus(entry.reconStatus) : "err";
  const statusLabel =
    status === "ok"
      ? t.rekonsiliasi.matchedLabel
      : status === "warn"
        ? t.rekonsiliasi.suggestedLabel
        : t.rekonsiliasi.notFoundLabel;
  const statusChipClass =
    status === "ok"
      ? "bg-success-soft text-emerald-700 dark:text-emerald-300"
      : status === "warn"
        ? "bg-warning-soft text-amber-700 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";

  const tx = entry?.matchedTransaction ?? null;
  const txTypeLabels = t.rekonsiliasi.txTypeLabels as Record<string, string>;
  const txAmountDisplay = tx
    ? new Intl.NumberFormat(numLocale, {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(Number(tx.amount))
    : "";

  return (
    <Dialog
      open={!!entry}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogTitle>{t.rekonsiliasi.detailDialogTitle}</DialogTitle>
        {entry && (
          <div className="space-y-1 pt-1">
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusChipClass}`}
              >
                {statusLabel}
              </span>
              <span className={`text-[17px] font-bold ${amt.className}`}>
                {amt.display}
              </span>
            </div>
            <DetailRow
              label={t.rekonsiliasi.detailDateLabel}
              value={new Date(entry.date).toLocaleDateString(
                numLocale,
                dateOpts,
              )}
            />
            <DetailRow
              label={t.rekonsiliasi.detailDescriptionLabel}
              value={entry.description}
            />
            {/* Status is not repeated as its own row — the colored chip
                above already states it; a duplicate row would render the
                same status text twice for no added information. */}
            {tx ? (
              <>
                <div className="mb-1 mt-3 text-[12px] font-bold">
                  {t.rekonsiliasi.detailMatchedTxTitle}
                </div>
                <DetailRow
                  label={t.rekonsiliasi.detailTxTypeLabel}
                  value={txTypeLabels[tx.type] ?? tx.type}
                />
                <DetailRow
                  label={t.rekonsiliasi.detailTxAccountLabel}
                  value={tx.accountName}
                />
                {tx.toAccountName && (
                  <DetailRow
                    label={t.rekonsiliasi.detailTxToAccountLabel}
                    value={tx.toAccountName}
                  />
                )}
                <DetailRow
                  label={t.rekonsiliasi.detailTxCategoryLabel}
                  value={tx.categoryName ?? "—"}
                />
                <DetailRow
                  label={t.rekonsiliasi.detailTxAmountLabel}
                  value={txAmountDisplay}
                />
                <DetailRow
                  label={t.rekonsiliasi.detailTxDateLabel}
                  value={new Date(tx.occurredAt).toLocaleDateString(
                    numLocale,
                    dateOpts,
                  )}
                />
              </>
            ) : (
              <div className="mt-3 text-[12px] text-muted-foreground">
                {t.rekonsiliasi.detailNoMatchedTx}
              </div>
            )}
            <div className="pt-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-md border py-2.5 text-[13px] font-semibold"
              >
                {t.rekonsiliasi.closeButton}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const splitFieldClass =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

// Explicit `htmlFor`/`id` pairing (not the shell `transaction-dialog.tsx`
// Field's unassociated sibling `<label>`) — a real `<label for>` gives every
// field a correct accessible name for screen readers AND `getByLabelText`,
// and keeps the label's own text (e.g. "Jumlah Pokok") from being polluted
// by unrelated decorative text (the "Rp" prefix) rendered inside `children`.
function SplitField({
  id,
  label,
  children,
}: {
  id: string;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/** EPIC-021 Group C (#29) — fee-split dialog (Decision #10: produces real
 * Transactions, not a side-table). Captures a principal + admin fee that
 * must sum to the entry's amount, plus source/destination accounts, then
 * POSTs to the split endpoint which creates the transfer (+ linked fee
 * expense on the destination, per Decision #10/#28) and marks the entry
 * matched. */
export function SplitEntryDialog({
  entry,
  accounts,
  familyGroupId,
  syncId,
  token,
  onClose,
  onSuccess,
}: {
  entry: BankSyncEntryDto | null;
  accounts: AccountDto[];
  familyGroupId: string | undefined;
  syncId: string | null;
  token: string | undefined;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t, locale } = useLocale();
  const numLocale = locale === "en" ? "en-US" : "id-ID";
  const [sourceAccountId, setSourceAccountId] = React.useState("");
  const [destAccountId, setDestAccountId] = React.useState("");
  const [principal, setPrincipal] = React.useState("");
  const [adminFee, setAdminFee] = React.useState("");
  const [description, setDescription] = React.useState("");

  // The form resets to fresh, empty state whenever a different entry is
  // targeted (or the dialog closes) because the CALLER renders this
  // component with `key={splitEntryTarget?.id ?? "..."}` — a key change
  // remounts it, which is React's own recommended way to "reset state when
  // a prop changes" (no reset-effect needed). Re-opening the SAME entry
  // after a failed submit keeps its in-progress values, since the key (and
  // therefore this instance) does not change in that case.
  const entryMagnitude = entry ? Math.abs(Number(entry.amount)) : 0;
  const entryAmountDisplay = entry
    ? new Intl.NumberFormat(numLocale, {
        style: "currency",
        currency: entry.currency || "IDR",
        minimumFractionDigits: 0,
      }).format(entryMagnitude)
    : "";

  const splitMutation = useMutation({
    mutationFn: () => {
      if (!familyGroupId || !syncId || !entry) {
        throw new Error(t.rekonsiliasi.errorSessionInactive);
      }
      return apiFetch<BankSyncEntryDto>(
        `/family-groups/${familyGroupId}/reconciliation/${syncId}/entries/${entry.id}/split`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            accountId: sourceAccountId,
            toAccountId: destAccountId,
            principalAmount: parseRupiah(principal),
            adminFee: parseRupiah(adminFee) || 0,
            ...(description ? { description } : {}),
          }),
        },
      );
    },
    onSuccess: () => {
      toast.success(t.rekonsiliasi.toastSplitSuccess);
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : t.rekonsiliasi.toastSplitFailedDefault;
      toast.error(msg);
    },
  });

  function handleSubmit() {
    if (!sourceAccountId) {
      toast.error(t.rekonsiliasi.splitValidationSelectSourceAccount);
      return;
    }
    if (!destAccountId) {
      toast.error(t.rekonsiliasi.splitValidationSelectDestAccount);
      return;
    }
    if (sourceAccountId === destAccountId) {
      toast.error(t.rekonsiliasi.splitValidationSameAccount);
      return;
    }
    const principalNum = parseRupiah(principal);
    if (!principalNum || principalNum <= 0) {
      toast.error(t.rekonsiliasi.splitValidationPrincipalPositive);
      return;
    }
    const feeNum = parseRupiah(adminFee) || 0;
    if (principalNum + feeNum !== entryMagnitude) {
      toast.error(t.rekonsiliasi.splitValidationSumMismatch);
      return;
    }
    splitMutation.mutate();
  }

  return (
    <Dialog
      open={!!entry}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-[440px] sm:max-w-[440px]">
        <DialogTitle>{t.rekonsiliasi.splitDialogTitle}</DialogTitle>
        {entry && (
          <div className="pt-1">
            <p className="mb-3.5 text-[12.5px] text-muted-foreground">
              {t.rekonsiliasi.splitDialogDescription}
            </p>

            <DetailRow
              label={t.rekonsiliasi.splitEntryAmountLabel}
              value={entryAmountDisplay}
            />

            <div className="mt-3.5">
              <SplitField
                id="split-source-account"
                label={t.rekonsiliasi.splitSourceAccountLabel}
              >
                <select
                  id="split-source-account"
                  className={splitFieldClass}
                  value={sourceAccountId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSourceAccountId(next);
                    if (destAccountId === next) setDestAccountId("");
                  }}
                >
                  <option value="">
                    {t.rekonsiliasi.splitSourceAccountPlaceholder}
                  </option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.institution ? ` — ${a.institution}` : ""}
                    </option>
                  ))}
                </select>
              </SplitField>

              <SplitField
                id="split-dest-account"
                label={t.rekonsiliasi.splitDestAccountLabel}
              >
                <select
                  id="split-dest-account"
                  className={splitFieldClass}
                  value={destAccountId}
                  onChange={(e) => setDestAccountId(e.target.value)}
                >
                  <option value="">
                    {t.rekonsiliasi.splitDestAccountPlaceholder}
                  </option>
                  {accounts
                    .filter((a) => a.id !== sourceAccountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.institution ? ` — ${a.institution}` : ""}
                      </option>
                    ))}
                </select>
              </SplitField>

              <SplitField
                id="split-principal"
                label={t.rekonsiliasi.splitPrincipalLabel}
              >
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground"
                  >
                    Rp
                  </span>
                  <input
                    id="split-principal"
                    inputMode="numeric"
                    value={principal}
                    onChange={(e) =>
                      setPrincipal(formatAmountInput(e.target.value))
                    }
                    placeholder="0"
                    className={`${splitFieldClass} pl-[38px]`}
                  />
                </div>
              </SplitField>

              <SplitField
                id="split-admin-fee"
                label={t.rekonsiliasi.splitAdminFeeLabel}
              >
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground"
                  >
                    Rp
                  </span>
                  <input
                    id="split-admin-fee"
                    inputMode="numeric"
                    value={adminFee}
                    onChange={(e) =>
                      setAdminFee(formatAmountInput(e.target.value))
                    }
                    placeholder="0"
                    className={`${splitFieldClass} pl-[38px]`}
                  />
                </div>
              </SplitField>

              <SplitField
                id="split-description"
                label={t.rekonsiliasi.splitDescriptionLabel}
              >
                <input
                  id="split-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.rekonsiliasi.splitDescriptionPlaceholder}
                  className={splitFieldClass}
                />
              </SplitField>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border py-2.5 text-[13px] font-semibold"
              >
                {t.rekonsiliasi.splitCancelButton}
              </button>
              <button
                type="button"
                disabled={splitMutation.isPending}
                onClick={handleSubmit}
                className="flex-1 rounded-md bg-primary py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {t.rekonsiliasi.splitSubmitButton}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function RekonsiliasiPage() {
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId ?? undefined;
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState(1);
  const [syncId, setSyncId] = React.useState<string | null>(null);
  const [showTips, setShowTips] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const goto = React.useCallback((next: number) => {
    setStep(next);
  }, []);

  /* ─── Step 1: recent uploads ─── */
  const syncsQuery = useQuery<BankSyncDto[]>({
    queryKey: familyGroupId
      ? queryKeys.reconciliation.list(familyGroupId)
      : ["reconciliation-syncs-disabled"],
    queryFn: () =>
      apiFetch<BankSyncDto[]>(
        `/family-groups/${familyGroupId}/reconciliation`,
        {
          token,
        },
      ),
    enabled: !!familyGroupId && !!token,
  });

  /* ─── Step 1: upload mutation ─── */
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!familyGroupId || !token)
        throw new Error(t.rekonsiliasi.errorSessionInactive);

      let rows: {
        date: string;
        description: string;
        amount: number;
        currency?: string;
      }[] = [];

      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        const lines = text.split("\n").filter((l) => l.trim() !== "");
        rows = lines.slice(1).map((l) => {
          const [date, description, amount] = l.split(",");
          return {
            date: new Date(date.trim()).toISOString(),
            description: description?.trim() ?? "",
            amount: Math.round(parseFloat((amount ?? "0").trim()) * 100),
          };
        });
      } else {
        // Non-CSV: send empty rows as placeholder — server handles parsing
        rows = [];
      }

      return apiFetch<BankSyncDto>(
        `/family-groups/${familyGroupId}/reconciliation/upload`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ fileName: file.name, rows }),
        },
      );
    },
    onSuccess: (data) => {
      setSyncId(data.id);
      if (familyGroupId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.reconciliation.list(familyGroupId),
        });
      }
      toast.success(t.rekonsiliasi.toastUploaded);
      goto(2);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : t.rekonsiliasi.toastUploadFailedDefault;
      toast.error(msg);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    uploadMutation.mutate(file, {
      onSettled: () => setUploading(false),
    });
  }

  function handleUploadAreaClick() {
    fileInputRef.current?.click();
  }

  /* ─── Step 2: auto-match mutation ─── */
  const autoMatchMutation = useMutation({
    mutationFn: ({
      fgId,
      sid,
      tkn,
    }: {
      fgId: string;
      sid: string;
      tkn: string;
    }) =>
      apiFetch<AutoMatchResultDto>(
        `/family-groups/${fgId}/reconciliation/${sid}/auto-match`,
        { method: "POST", token: tkn },
      ),
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : t.rekonsiliasi.toastScanFailedDefault;
      toast.error(msg);
    },
  });

  React.useEffect(() => {
    if (step !== 2 || !syncId || !familyGroupId || !token) return;
    autoMatchMutation.mutate({ fgId: familyGroupId, sid: syncId, tkn: token });
    // autoMatchMutation.mutate is stable; including it would cause infinite re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, syncId, familyGroupId, token]);

  /* ─── Step 3: entries query ─── */
  const entriesQuery = useQuery<BankSyncEntryDto[]>({
    queryKey:
      familyGroupId && syncId
        ? queryKeys.reconciliation.entries(familyGroupId, syncId)
        : ["reconciliation-entries-disabled"],
    queryFn: () =>
      apiFetch<BankSyncEntryDto[]>(
        `/family-groups/${familyGroupId}/reconciliation/${syncId}/entries`,
        { token },
      ),
    enabled: step === 3 && !!familyGroupId && !!syncId && !!token,
  });

  const confirmMutation = useMutation({
    mutationFn: ({
      entryId,
      transactionId,
    }: {
      entryId: string;
      transactionId: string;
    }) =>
      apiFetch<BankSyncEntryDto>(
        `/family-groups/${familyGroupId}/reconciliation/${syncId}/entries/${entryId}/match`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ transactionId }),
        },
      ),
    onSuccess: () => {
      if (familyGroupId && syncId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.reconciliation.entries(familyGroupId, syncId),
        });
      }
      toast.success(t.rekonsiliasi.toastConfirmed);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : t.rekonsiliasi.toastConfirmFailedDefault;
      toast.error(msg);
    },
  });

  /* ─── Step 3: entry detail (#9) + fee-split (#29) dialogs ─── */
  const [detailEntry, setDetailEntry] = React.useState<BankSyncEntryDto | null>(
    null,
  );
  const [splitEntryTarget, setSplitEntryTarget] =
    React.useState<BankSyncEntryDto | null>(null);

  const accountsQuery = useQuery<AccountDto[]>({
    queryKey: familyGroupId
      ? queryKeys.accounts.all(familyGroupId)
      : ["accounts-disabled"],
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: step === 3 && !!familyGroupId && !!token,
  });

  /** The split endpoint creates real Transactions (a transfer + linked
   * admin-fee expense) — refresh every view those balances/reports feed,
   * mirroring the invalidation set in `components/shell/transaction-dialog.tsx`'s
   * createMutation.onSuccess. */
  function handleSplitSuccess() {
    if (familyGroupId && syncId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reconciliation.entries(familyGroupId, syncId),
      });
    }
    if (familyGroupId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["reports", familyGroupId],
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(familyGroupId),
      });
    }
    setSplitEntryTarget(null);
  }

  /* ─── Step 4 summary counts ─── */
  const entries = entriesQuery.data ?? [];
  const matchedCount = entries.filter(
    (e) => e.reconStatus === "matched",
  ).length;
  const suggestedCount = entries.filter(
    (e) => e.reconStatus === "suggested",
  ).length;
  const unmatchedCount = entries.filter(
    (e) => e.reconStatus === "unmatched",
  ).length;

  return (
    <div>
      <Stepper step={step} />

      {/* ─── Step 1: Upload ─── */}
      {step === 1 && (
        <div className="space-y-4">
          <SectionCard>
            <div className="mb-1 text-[15px] font-extrabold">
              {t.rekonsiliasi.uploadTitle}
            </div>
            <div className="mb-[18px] text-[12.5px] text-muted-foreground">
              {t.rekonsiliasi.uploadSubtitle}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              className="sr-only"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={handleUploadAreaClick}
              disabled={uploading || uploadMutation.isPending}
              className="w-full cursor-pointer rounded-[14px] border-2 border-dashed border-primary/40 bg-accent/40 px-5 py-8 text-center transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent">
                <CloudUpload className="size-7 text-primary" />
              </div>
              <div className="mb-1.5 text-[15px] font-bold text-primary-strong">
                {uploading || uploadMutation.isPending
                  ? t.rekonsiliasi.uploadingLabel
                  : t.rekonsiliasi.dragDropLabel}
              </div>
              <div className="mb-4 text-[12.5px] text-muted-foreground">
                {t.rekonsiliasi.orLabel}
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-[11px] text-[13.5px] font-bold text-white">
                <ArrowUpFromLine className="size-4" />{" "}
                {t.rekonsiliasi.chooseFileButton}
              </div>
              <div className="mt-3.5 text-[11.5px] text-muted-foreground">
                {t.rekonsiliasi.supportedFormatsLabel}
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {t.rekonsiliasi.maxFileSizeLabel}
              </div>
            </button>
          </SectionCard>

          {/* Supported banks */}
          <SectionCard
            title={t.rekonsiliasi.supportedBanksTitle}
            action={<CardLink>{t.rekonsiliasi.viewAllLink}</CardLink>}
          >
            <div className="flex flex-wrap gap-2.5">
              {SUPPORTED_BANKS.map((b) => (
                <div
                  key={b.code}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold"
                >
                  <div
                    className="flex h-6 min-w-9 items-center justify-center rounded px-1 text-[10px] font-extrabold"
                    style={{ background: b.bg, color: b.color }}
                  >
                    {b.code}
                  </div>
                  {b.name}
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold text-muted-foreground">
                {t.rekonsiliasi.othersLabel}
              </div>
            </div>
          </SectionCard>

          {/* Recent documents */}
          <SectionCard
            title={t.rekonsiliasi.recentDocsTitle}
            action={<CardLink>{t.rekonsiliasi.viewHistoryLink}</CardLink>}
          >
            {syncsQuery.isLoading ? (
              <div className="py-6 text-center text-[12.5px] text-muted-foreground">
                {t.rekonsiliasi.loadingLabel}
              </div>
            ) : !syncsQuery.data || syncsQuery.data.length === 0 ? (
              <div className="py-6 text-center text-[12.5px] text-muted-foreground">
                {t.rekonsiliasi.emptyDocs}
              </div>
            ) : (
              <div className="space-y-2">
                {syncsQuery.data.map((sync) => {
                  const isSpreadsheet = /\.(xlsx?|csv)$/i.test(sync.fileName);
                  return (
                    <button
                      key={sync.id}
                      type="button"
                      onClick={() => {
                        setSyncId(sync.id);
                        setStep(2);
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50"
                    >
                      <div
                        className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-white"
                        style={{
                          background: isSpreadsheet ? "#217346" : "#E53E3E",
                        }}
                      >
                        {isSpreadsheet ? (
                          <FileSpreadsheet className="size-[18px]" />
                        ) : (
                          <FileText className="size-[18px]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold">
                          {sync.fileName}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {`${t.rekonsiliasi.uploadedAtPrefix}${new Date(
                            sync.uploadedAt,
                          ).toLocaleString(
                            locale === "en" ? "en-US" : "id-ID",
                          )}`}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge
                          variant="info"
                          className="mb-[3px] text-[10px]"
                        >
                          {t.rekonsiliasi.uploadedBadge}
                        </StatusBadge>
                        <div className="text-[11px] text-muted-foreground">
                          {`${sync.rowCount}${t.rekonsiliasi.transactionsCountSuffix}`}
                        </div>
                      </div>
                      <ChevronRight className="size-3 flex-shrink-0 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Tips */}
          {showTips && (
            <div className="relative rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3.5 dark:border-amber-900 dark:bg-amber-950/30">
              <button
                type="button"
                onClick={() => setShowTips(false)}
                aria-label={t.rekonsiliasi.closeTipsAriaLabel}
                className="absolute right-3 top-2.5 cursor-pointer text-[16px] text-muted-foreground"
              >
                ×
              </button>
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 size-4 flex-shrink-0 text-warning" />
                <div>
                  <div className="mb-1.5 text-[12.5px] font-bold">
                    {t.rekonsiliasi.tipsTitle}
                  </div>
                  <div className="flex flex-col gap-1 text-[12px] text-foreground/80">
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-success" />
                      {t.rekonsiliasi.tip1}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-success" />
                      {t.rekonsiliasi.tip2}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-success" />
                      {t.rekonsiliasi.tip3}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            {t.rekonsiliasi.continueToMatchButton}{" "}
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {/* ─── Step 2: Scanning ─── */}
      {step === 2 && (
        <SectionCard className="text-center" bodyClassName="px-2 py-3">
          <div
            className="mx-auto mb-4 flex size-[72px] items-center justify-center rounded-full border-[3px] border-primary"
            style={{ background: "var(--accent)" }}
          >
            <Bot className="size-7 text-primary" />
          </div>
          <div className="mb-1.5 text-[16px] font-extrabold">
            {t.rekonsiliasi.aiReadingTitle}
          </div>
          <div className="mb-6 text-[12.5px] text-muted-foreground">
            {t.rekonsiliasi.aiReadingSubtitle}
          </div>

          {autoMatchMutation.isPending ? (
            <>
              <ProgressBar
                value={50}
                height={10}
                color="linear-gradient(90deg,var(--primary),var(--brand-purple))"
                className="mb-2.5"
              />
              <div className="mb-5 text-[12px] text-muted-foreground">
                {t.rekonsiliasi.matchingWithDataLabel}
              </div>
            </>
          ) : autoMatchMutation.data ? (
            <div className="mb-6 space-y-3">
              <ProgressBar
                value={100}
                height={10}
                color="linear-gradient(90deg,var(--primary),var(--brand-purple))"
                className="mb-2.5"
              />
              <div className="flex items-center justify-center gap-2 text-[13px]">
                <Check className="size-4 flex-shrink-0 text-success" />
                <span>
                  <span className="font-bold">
                    {autoMatchMutation.data.suggested}
                  </span>
                  {t.rekonsiliasi.suggestedEntriesMidText}
                  <span className="font-bold">
                    {autoMatchMutation.data.totalEntries}
                  </span>
                  {t.rekonsiliasi.totalSuffix}
                </span>
              </div>
              <button
                type="button"
                onClick={() => goto(3)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
              >
                {t.rekonsiliasi.continueButton}{" "}
                <ArrowRight className="size-4" />
              </button>
            </div>
          ) : (
            <div className="mb-5 text-[12px] text-muted-foreground">
              {t.rekonsiliasi.startingScanLabel}
            </div>
          )}
        </SectionCard>
      )}

      {/* ─── Step 3: Matching ─── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="flex flex-col items-center gap-0.5 rounded-lg bg-success-soft py-3 text-emerald-700 dark:text-emerald-300">
              <div className="text-[22px] font-black">{matchedCount}</div>
              <div className="text-[11px] font-semibold">
                {t.rekonsiliasi.matchedStatLabel}
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg bg-warning-soft py-3 text-amber-700 dark:text-amber-300">
              <div className="text-[22px] font-black">{suggestedCount}</div>
              <div className="text-[11px] font-semibold">
                {t.rekonsiliasi.needsReviewStatLabel}
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg bg-red-100 py-3 text-red-700 dark:bg-red-950 dark:text-red-300">
              <div className="text-[22px] font-black">{unmatchedCount}</div>
              <div className="text-[11px] font-semibold">
                {t.rekonsiliasi.notMatchedStatLabel}
              </div>
            </div>
          </div>

          <SectionCard
            title={t.rekonsiliasi.matchResultsTitle}
            action={
              <StatusBadge variant="success">
                {entries.length}
                {t.rekonsiliasi.transactionsCountBadgeSuffix}
              </StatusBadge>
            }
          >
            {/* Header */}
            <div className="mb-2 flex text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
              <div className="flex-1 px-3">
                {t.rekonsiliasi.colBankStatement}
              </div>
              <div className="w-9" />
              <div className="flex-1 px-3">{t.rekonsiliasi.colStatus}</div>
            </div>

            {entriesQuery.isLoading && (
              <div className="py-8 text-center text-[13px] text-muted-foreground">
                {t.rekonsiliasi.loadingEntries}
              </div>
            )}

            {entriesQuery.isError && (
              <div className="py-8 text-center text-[13px] text-destructive">
                {t.rekonsiliasi.errorLoadEntries}
              </div>
            )}

            {!entriesQuery.isLoading &&
              entries.length === 0 &&
              !entriesQuery.isError && (
                <div className="py-8 text-center text-[13px] text-muted-foreground">
                  {t.rekonsiliasi.emptyEntries}
                </div>
              )}

            <div className="space-y-2">
              {entries.map((entry) => {
                const status = entryStatus(entry.reconStatus);
                const amtNum = parseInt(entry.amount, 10) / 100;
                const amtFormatted = new Intl.NumberFormat(
                  locale === "en" ? "en-US" : "id-ID",
                  {
                    style: "currency",
                    currency: entry.currency || "IDR",
                    minimumFractionDigits: 0,
                  },
                ).format(Math.abs(amtNum));
                const amtDisplay =
                  amtNum < 0 ? `-${amtFormatted}` : `+${amtFormatted}`;
                const amtClass =
                  amtNum < 0 ? "text-destructive" : "text-success";
                const entryDate = new Date(entry.date).toLocaleDateString(
                  locale === "en" ? "en-US" : "id-ID",
                  {
                    day: "numeric",
                    month: "short",
                  },
                );
                // EPIC-021 Group C (#9) — detail-trigger is keyboard-operable
                // (Enter/Space), mirroring the `/transaksi` TxRow convention.
                // The Confirm/Pecah buttons below render as SIBLINGS of this
                // role="button" element (not nested inside it) so neither a
                // click nor a keydown on those buttons bubbles up and
                // re-triggers this row's own handler.
                const openDetail = () => setDetailEntry(entry);
                const handleRowKeyDown = (
                  e: React.KeyboardEvent<HTMLDivElement>,
                ) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail();
                  }
                };

                return (
                  <div key={entry.id} className="flex items-stretch">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={openDetail}
                      onKeyDown={handleRowKeyDown}
                      aria-label={`${t.rekonsiliasi.entryDetailAriaLabelPrefix} ${entry.description}, ${amtDisplay}`}
                      className="flex-1 cursor-pointer rounded-lg border bg-card px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="text-[11px] text-muted-foreground">
                        {entryDate} · {entry.description}
                      </div>
                      <div className={`text-[13px] font-bold ${amtClass}`}>
                        {amtDisplay}
                      </div>
                    </div>
                    <MatchIcon status={status} />
                    <div
                      className={[
                        "flex flex-1 items-center rounded-lg border bg-card px-3 py-2",
                        status === "warn"
                          ? "bg-warning-soft border-amber-300"
                          : status === "err"
                            ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                            : "",
                      ].join(" ")}
                    >
                      {status === "ok" && (
                        <div>
                          <div className="text-[11px] text-muted-foreground">
                            {t.rekonsiliasi.matchedLabel}
                          </div>
                          <div className={`text-[13px] font-bold ${amtClass}`}>
                            {amtDisplay}
                          </div>
                        </div>
                      )}
                      {status === "warn" && (
                        <div className="flex w-full items-center justify-between gap-2">
                          <div className="text-[11px] text-warning">
                            {t.rekonsiliasi.suggestedLabel}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={confirmMutation.isPending}
                              onClick={() => {
                                if (entry.suggestedTxId) {
                                  confirmMutation.mutate({
                                    entryId: entry.id,
                                    transactionId: entry.suggestedTxId,
                                  });
                                }
                              }}
                              className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                            >
                              {t.rekonsiliasi.confirmButton}
                            </button>
                            <button
                              type="button"
                              aria-label={`${t.rekonsiliasi.splitButtonAriaLabelPrefix} ${entry.description}`}
                              onClick={() => setSplitEntryTarget(entry)}
                              className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-accent"
                            >
                              <Scissors className="size-3" />
                              {t.rekonsiliasi.splitButton}
                            </button>
                          </div>
                        </div>
                      )}
                      {status === "err" && (
                        <div className="flex w-full items-center justify-between gap-2">
                          <div className="text-[11px] text-destructive">
                            {t.rekonsiliasi.notFoundLabel}
                          </div>
                          <button
                            type="button"
                            aria-label={`${t.rekonsiliasi.splitButtonAriaLabelPrefix} ${entry.description}`}
                            onClick={() => setSplitEntryTarget(entry)}
                            className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-accent"
                          >
                            <Scissors className="size-3" />
                            {t.rekonsiliasi.splitButton}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => goto(1)}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] bg-background px-4 py-2.5 text-[13.5px] font-bold transition-colors hover:bg-accent"
            >
              <ArrowLeft className="size-4" /> {t.rekonsiliasi.backButton}
            </button>
            <button
              type="button"
              onClick={() => goto(4)}
              className="flex flex-[2] cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <Save className="size-4" />{" "}
              {t.rekonsiliasi.saveReconciliationButton}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Done ─── */}
      {step === 4 && (
        <SectionCard className="text-center" bodyClassName="px-2 py-6">
          <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-success-soft">
            <CheckCircle2 className="size-9 text-success" />
          </div>
          <div className="mb-1.5 text-[18px] font-black text-success">
            {t.rekonsiliasi.doneTitle}
          </div>
          <div className="mb-6 text-[13px] text-muted-foreground">
            {t.rekonsiliasi.doneSubtitle}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3.5 text-left">
              <div className="text-[11px] text-muted-foreground">
                {t.rekonsiliasi.totalTransactionsLabel}
              </div>
              <div className="text-[20px] font-black">
                {entries.length || "—"}
              </div>
            </div>
            <div className="rounded-lg bg-success-soft p-3.5 text-left text-emerald-700 dark:text-emerald-300">
              <div className="text-[11px]">
                {t.rekonsiliasi.matchedSummaryLabel}
              </div>
              <div className="text-[20px] font-black">
                {matchedCount || "—"}
              </div>
            </div>
            <div className="rounded-lg bg-warning-soft p-3.5 text-left text-amber-700 dark:text-amber-300">
              <div className="text-[11px]">
                {t.rekonsiliasi.needsReviewSummaryLabel}
              </div>
              <div className="text-[20px] font-black">
                {suggestedCount || "—"}
              </div>
            </div>
            <div className="rounded-lg bg-red-100 p-3.5 text-left text-red-700 dark:bg-red-950 dark:text-red-300">
              <div className="text-[11px]">
                {t.rekonsiliasi.notMatchedSummaryLabel}
              </div>
              <div className="text-[20px] font-black">
                {unmatchedCount || "—"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSyncId(null);
                autoMatchMutation.reset();
                goto(1);
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <RotateCw className="size-4" />{" "}
              {t.rekonsiliasi.newReconciliationButton}
            </button>
          </div>
        </SectionCard>
      )}

      {/* EPIC-021 Group C — dialogs stay mounted regardless of step; each
          uses `open={!!entry}` so they only render/open when a row targets
          them. */}
      <EntryDetailDialog
        entry={detailEntry}
        onClose={() => setDetailEntry(null)}
      />
      <SplitEntryDialog
        // `key` on the entry id: a genuinely different (or newly-null)
        // target remounts the dialog with fresh state — see the component's
        // own comment for why this replaces a reset-effect.
        key={splitEntryTarget?.id ?? "no-split-entry"}
        entry={splitEntryTarget}
        accounts={accountsQuery.data ?? []}
        familyGroupId={familyGroupId}
        syncId={syncId}
        token={token}
        onClose={() => setSplitEntryTarget(null)}
        onSuccess={handleSplitSuccess}
      />
    </div>
  );
}
