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
  ChevronRight,
  CheckCheck,
  ReceiptText,
  TriangleAlert,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
// EPIC-026 Wave 5 note — the prototype's rekonsiliasi page mounts NO chart
// at all (its <script> block loads only shell.js); the composition card is
// a hand-rolled stacked bar. The DonutChart previously rendered here was an
// invention relative to the prototype and has been replaced by that bar.
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  SectionCard,
  StatusBadge,
  ProgressBar,
  CardLink,
  InfoTip,
} from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
// EPIC-029 group 4 — client-side unlock of a password-protected statement.
// Only the taxonomy/orchestration module is imported statically; both
// decryptors sit behind `await import(...)` inside it (E4e).
import {
  StatementFileError,
  inspectStatementFile,
  needsPassword,
  prepareStatementFile,
  statementFileErrorMessage,
  type StatementFileKind,
} from "@/hooks/statement-file";
// EPIC-029 group 1 — PDF text extraction. Only the taxonomy/orchestration
// module is imported statically; `pdfjs-dist` itself sits behind an
// `await import(...)` inside it, so it costs nothing on first paint.
import {
  StatementPdfError,
  extractStatementPdfText,
  statementPdfErrorMessage,
} from "@/hooks/statement-pdf";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah, parseRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

/* ─────────────────────────── Types ─────────────────────────── */

/** EPIC-023 Task G retry (HIGH five-reviewer finding) — one data row that
 * failed to map/parse during upload, mirroring the API's SkippedRowDto. */
type SkippedRowDto = {
  line: number;
  reason: string;
};

type BankSyncDto = {
  id: string;
  familyGroupId: string;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
  skippedRows?: SkippedRowDto[];
  // EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — the real
  // total, even when `skippedRows` itself is capped server-side (mirrors
  // reconciliation.service.ts's BankSyncDto.skippedRowsTotal).
  skippedRowsTotal?: number;
};

// EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — bounds
// how many skipped-row lines this page renders, independent of the API's
// own cap: a 9,999-skip file rendered one <li> per row with no limit here.
const MAX_SKIPPED_ROWS_RENDERED = 50;

/**
 * EPIC-021 Group C (#9) — read-only summary of the entry's matched
 * Transaction, embedded by the API's `/entries` and `/split` responses
 * (mirrors `apps/api/src/reconciliation/reconciliation.service.ts`'s
 * `MatchedTransactionSummaryDto`).
 */
/* ── EPIC-029 groups 2-3 — statement PDF preview, mirroring the API's
      StatementPreviewDto / StatementTotalsVerdictDto. Amounts are decimal
      STRINGS on the wire: they are whole-rupiah `bigint` server-side, and a
      JSON number would reintroduce float rounding into money. ── */
type StatementTotalsCheckDto = {
  label: "opening-to-closing" | "total-credit" | "total-debit";
  expected: string;
  actual: string;
  difference: string;
  matched: boolean;
};

type StatementTotalsVerdictDto = {
  status: "matched" | "mismatch" | "unavailable";
  tolerance: string;
  checks: StatementTotalsCheckDto[];
};

/** What a bulk import did. `skippedTotal` can exceed `skipped.length` (the
 *  list is capped server-side), and `remaining` is what is still unimported —
 *  both exist so a partial run cannot be reported as a clean success. */
type ImportEntriesResultDto = {
  imported: number;
  skipped: { description: string; reason: string }[];
  skippedTotal: number;
  remaining: number;
};

type StatementDraftRow = { date: string; description: string; amount: string };

type StatementDraftTotals = {
  openingBalance: string | null;
  closingBalance: string | null;
  totalCredit: string | null;
  totalDebit: string | null;
};

type StatementDraftDto = {
  fileName: string;
  rows: StatementDraftRow[];
  totals: StatementDraftTotals;
};

/** One page's RAW reading, merged in the browser before the single parse +
 *  totals-gate call. Strings only, like every other statement payload. */
type StatementPageRead = {
  pageIndex: number;
  rows: StatementDraftRow[];
  totals: StatementDraftTotals;
};

/** Mirrors MIN_STATEMENT_PAGE_TEXT_CHARS server-side. A page under this is a
 *  cover or a divider: skipping it locally saves the family a paid call the
 *  server would refuse anyway. */
const MIN_PAGE_TEXT_CHARS = 40;

type StatementPreviewDto = {
  fileName: string;
  pageCount: number;
  rowCount: number;
  rows: { date: string; description: string; amount: string }[];
  skippedRows: SkippedRowDto[];
  skippedRowsTotal: number;
  totals: StatementTotalsVerdictDto;
  draft: StatementDraftDto;
};

type MatchedTransactionSummaryDto = {
  id: string;
  // EPIC-023 Task E retry (MEDIUM 6) — widened to match the API's real
  // return type (`reconciliation.service.ts`'s `MatchedTransactionSummaryDto`
  // has `accountId: string | null` since Transaction.accountId went
  // nullable for a card purchase, E3). Nothing dereferenced it as
  // non-nullable before this fix, but the type itself was a lie that would
  // have type-checked a future null read as safe.
  accountId: string | null;
  // MEDIUM 5 — null (not "") for a card purchase; symmetric with the
  // server-side fix.
  accountName: string | null;
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

/** EPIC-023 G2 (D17) — mirrors reconciliation.service.ts's
 * ReconciliationTemplateDto. */
type ReconciliationTemplateDto = {
  id: string;
  familyGroupId: string;
  bankCode: string;
  name: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  dateFormat: string | null;
  createdAt: string;
  updatedAt: string;
};

/* ─────────────────────────── Static data ─────────────────────────── */

const STEP_NUMS = [1, 2, 3, 4] as const;

// NOTE: real bank names/codes — proper nouns, kept as-is in both locales
// (same value-locked-copy convention as `donation`'s `LEMBAGA_OPTIONS`).
const SUPPORTED_BANKS = [
  { code: "BCA", name: "BCA", bg: "#0061AF", color: "#fff" },
  { code: "MDR", name: "Mandiri", bg: "#F9A01B", color: "#000" },
] as const;

type MatchStatus = "ok" | "warn" | "err";

/* ─────────────────────────── Step cards ─────────────────────────── */

/** Restructure (prototype parity) — bordered numbered step cards with a
 * status badge (Selesai / Sedang berjalan / Menunggu) and an outlined
 * active card, replacing the plain circles-and-lines stepper. Purely a
 * navigation/visual change — `step` state and the 4-step flow are
 * unchanged. */
function StepCards({ step }: { step: number }) {
  const { t } = useLocale();
  return (
    <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {STEP_NUMS.map((num) => {
        const done = step > num;
        const active = step === num;
        const s = t.rekonsiliasi.steps[num];
        const statusLabel = done
          ? t.rekonsiliasi.stepStatusDone
          : active
            ? t.rekonsiliasi.stepStatusActive
            : t.rekonsiliasi.stepStatusPending;
        return (
          <div
            key={num}
            className={[
              "rounded-[14px] border-2 bg-card p-3.5 transition-colors",
              active ? "border-primary" : "border-transparent",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center justify-between">
              <div
                className={[
                  "flex size-7 items-center justify-center rounded-full text-[12px] font-bold",
                  done
                    ? "bg-success text-white"
                    : active
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {done ? <Check className="size-[14px]" /> : num}
              </div>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  done
                    ? "bg-success-soft text-emerald-700 dark:text-emerald-300"
                    : active
                      ? "bg-accent text-primary-strong"
                      : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {statusLabel}
              </span>
            </div>
            <div className="text-[13.5px] font-extrabold">{s.label}</div>
            <div className="text-[11px] text-muted-foreground">{s.sub}</div>
          </div>
        );
      })}
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
 * no scaling).
 *
 * The Step-3 table and the "tercocokkan" summary card used to divide by 100
 * instead, on the belief that the CSV path stored cents — so they showed every
 * figure a hundred times too small while these dialogs showed it correctly.
 * EPIC-021 spotted that disagreement and deferred it; importing a real
 * statement is what made it matter, because the numbers on screen no longer
 * matched the PDF in the user's hand. Both use THIS function now, so there is
 * one scale and one formatter.
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
      <DialogContent className="dialog--sm">
        <DialogTitle>{t.rekonsiliasi.detailDialogTitle}</DialogTitle>
        {/* No prototype counterpart — `rekonsiliasi.html` ships upload /
            split / template dialogs only, and this read-only entry detail
            (EPIC-021 #9) is a genuine post-prototype feature. It is kept and
            re-composed with the same `.dialog__body` / `.dialog__footer`
            grammar so it sits consistently beside the ported dialogs. */}
        {entry && (
          <DialogBody className="space-y-1">
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
                  value={tx.accountName ?? "—"}
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
          </DialogBody>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.rekonsiliasi.closeButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  const money = (n: number) =>
    new Intl.NumberFormat(numLocale, {
      style: "currency",
      currency: entry?.currency || "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  // Display-only running totals, mirroring the prototype's two
  // `.row--between` lines and its balance notice. The authoritative check is
  // still `handleSubmit`'s — nothing here blocks or alters submission.
  const splitTotal = parseRupiah(principal) + (parseRupiah(adminFee) || 0);
  const isBalanced = entry !== null && splitTotal === entryMagnitude;

  return (
    <Dialog
      open={!!entry}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      {/* EPIC-026 Wave 8 — composition ported 1:1 from the prototype's
          `dlg-split` (docs/prototype/pages/rekonsiliasi.html): a
          `dialog--wide` (720px) box, title + desc, the entry-summary
          `.notice`, two 2-up `.field-row`s (source/destination, then
          principal/admin fee), the optional note field, the running totals
          and the balance notice, and an outline/primary `.dialog__footer`.
          The multi-step import/matching logic and this dialog's own
          validation + mutation are untouched. */}
      <DialogContent className="dialog--wide">
        <DialogTitle>{t.rekonsiliasi.splitDialogTitle}</DialogTitle>
        <DialogDescription>
          {t.rekonsiliasi.splitDialogDescription}
        </DialogDescription>
        {entry && (
          <DialogBody>
            <div className="notice mb-3.5">
              <ReceiptText aria-hidden="true" className="size-4 shrink-0" />
              <span>
                <strong>{entry.description}</strong>
                {" · "}
                {new Date(entry.date).toLocaleDateString(numLocale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {" · "}
                <span className="mono">{entryAmountDisplay}</span>
              </span>
            </div>

            <div className="field-row">
              <label className="field mt-0">
                <span className="label">
                  {t.rekonsiliasi.splitSourceAccountLabel}
                </span>
                <select
                  className="select"
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
              </label>

              <label className="field mt-0">
                <span className="label">
                  {t.rekonsiliasi.splitDestAccountLabel}
                </span>
                <select
                  className="select"
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
              </label>
            </div>

            <div className="field-row mt-3">
              <label className="field mt-0">
                <span className="label">
                  {t.rekonsiliasi.splitPrincipalLabel}
                </span>
                <input
                  className="input mono"
                  inputMode="numeric"
                  value={principal}
                  onChange={(e) =>
                    setPrincipal(formatAmountInput(e.target.value))
                  }
                  placeholder="0"
                />
              </label>

              <label className="field mt-0">
                <span className="label">
                  {t.rekonsiliasi.splitAdminFeeLabel}
                </span>
                <input
                  className="input mono"
                  inputMode="numeric"
                  value={adminFee}
                  onChange={(e) =>
                    setAdminFee(formatAmountInput(e.target.value))
                  }
                  placeholder="0"
                />
              </label>
            </div>

            <label className="field">
              <span className="label">
                {t.rekonsiliasi.splitDescriptionLabel}
              </span>
              <input
                className="input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.rekonsiliasi.splitDescriptionPlaceholder}
              />
            </label>

            <div className="row row--between mt-3.5">
              <span className="t-sm t-muted">
                {t.rekonsiliasi.splitTotalLabel}
              </span>
              <span className="t-sm t-bold mono">{money(splitTotal)}</span>
            </div>
            <div className="row row--between mt-1">
              <span className="t-sm t-muted">
                {t.rekonsiliasi.splitEntryAmountLabel}
              </span>
              <span className="t-sm t-bold mono">{entryAmountDisplay}</span>
            </div>

            <div
              className={`notice mt-2.5 ${
                isBalanced ? "notice--info" : "notice--warning"
              }`}
            >
              {isBalanced ? (
                <CheckCheck aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span>
                {isBalanced
                  ? t.rekonsiliasi.splitBalancedNotice
                  : t.rekonsiliasi.splitUnbalancedNotice}
              </span>
            </div>
          </DialogBody>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.rekonsiliasi.splitCancelButton}
          </Button>
          <Button
            type="button"
            disabled={splitMutation.isPending}
            onClick={handleSubmit}
          >
            {t.rekonsiliasi.splitSubmitButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Column-mapping templates ─────────────────────────── */

/**
 * EPIC-023 G2 (D17) — "map my bank's columns once and reuse it": one saved
 * template per bank per family. Create/update/delete is owner/admin_staff/
 * spouse-level (casl-ability.factory.ts's ReconciliationTemplate subject) —
 * the page only renders the "Kelola Template" entry point for those roles
 * (see canManageTemplates in RekonsiliasiPage), but the API is the real
 * enforcement.
 */
function ReconciliationTemplateManagerDialog({
  open,
  onClose,
  familyGroupId,
  token,
}: {
  open: boolean;
  onClose: () => void;
  familyGroupId?: string;
  token?: string;
}) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [bankCode, setBankCode] = React.useState<string>(
    SUPPORTED_BANKS[0].code,
  );
  const [name, setName] = React.useState("");
  const [dateColumn, setDateColumn] = React.useState("");
  const [descriptionColumn, setDescriptionColumn] = React.useState("");
  const [amountColumn, setAmountColumn] = React.useState("");
  const [dateFormat, setDateFormat] = React.useState("");

  const templatesQuery = useQuery<ReconciliationTemplateDto[]>({
    queryKey: familyGroupId
      ? ["reconciliation-templates", familyGroupId]
      : ["reconciliation-templates-disabled"],
    queryFn: () =>
      apiFetch<ReconciliationTemplateDto[]>(
        `/family-groups/${familyGroupId}/reconciliation/templates`,
        { token },
      ),
    enabled: open && !!familyGroupId && !!token,
  });

  function invalidateTemplates() {
    if (!familyGroupId) return;
    void queryClient.invalidateQueries({
      queryKey: ["reconciliation-templates", familyGroupId],
    });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<ReconciliationTemplateDto>(
        `/family-groups/${familyGroupId}/reconciliation/templates`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            bankCode,
            name: name.trim() || bankCode,
            dateColumn,
            descriptionColumn,
            amountColumn,
            ...(dateFormat ? { dateFormat } : {}),
          }),
        },
      ),
    onSuccess: () => {
      invalidateTemplates();
      toast.success(t.rekonsiliasi.toastTemplateSaved);
      setName("");
      setDateColumn("");
      setDescriptionColumn("");
      setAmountColumn("");
      setDateFormat("");
    },
    onError: () => toast.error(t.rekonsiliasi.toastTemplateSaveFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) =>
      apiFetch<void>(
        `/family-groups/${familyGroupId}/reconciliation/templates/${code}`,
        { method: "DELETE", token },
      ),
    onSuccess: () => {
      invalidateTemplates();
      toast.success(t.rekonsiliasi.toastTemplateDeleted);
    },
    onError: () => toast.error(t.rekonsiliasi.toastTemplateDeleteFailed),
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      {/* EPIC-026 Wave 8 — composition ported from the prototype's
          `dlg-template` (docs/prototype/pages/rekonsiliasi.html): a
          `dialog--wide` box, title + desc, the saved-template
          `.table-wrap` table, then 2-up `.field-row`s for bank/name and the
          column mapping, the date-format select, and a `.dialog__footer`
          with "Tutup" left of "Simpan Template".

          Honest-UI deviation: the prototype splits the amount mapping into
          "Kolom Debit" + "Kolom Kredit". The API's
          `ReconciliationTemplateDto` has a single `amountColumn` and no
          debit/credit pair, so one "Kolom Jumlah" field is rendered instead
          of two inputs whose second value would be silently dropped. */}
      <DialogContent className="dialog--wide">
        <DialogTitle>{t.rekonsiliasi.templateManagerTitle}</DialogTitle>
        <DialogDescription>
          {t.rekonsiliasi.templateManagerHint}
        </DialogDescription>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <DialogBody>
            {(templatesQuery.data?.length ?? 0) > 0 && (
              <div className="table-wrap mb-4">
                <table className="table min-w-[520px]">
                  <thead>
                    <tr>
                      <th>{t.rekonsiliasi.templateBankLabel}</th>
                      <th>{t.rekonsiliasi.templateNameLabel}</th>
                      <th>{t.rekonsiliasi.templateColumnsHeader}</th>
                      <th>{t.rekonsiliasi.templateActionHeader}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templatesQuery.data?.map((tpl) => (
                      <tr key={tpl.id}>
                        <td className="t-sm t-bold">{tpl.bankCode}</td>
                        <td className="t-sm">{tpl.name}</td>
                        <td className="t-xs t-muted mono">
                          {[
                            tpl.dateColumn,
                            tpl.descriptionColumn,
                            tpl.amountColumn,
                          ].join(" · ")}
                        </td>
                        <td>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(tpl.bankCode)}
                            disabled={deleteMutation.isPending}
                          >
                            {t.rekonsiliasi.templateDeleteButton}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="field-row">
              <label className="field mt-0">
                <span className="label">
                  {t.rekonsiliasi.templateBankLabel}
                </span>
                <select
                  className="select"
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                >
                  {SUPPORTED_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field mt-0">
                <span className="label">
                  {t.rekonsiliasi.templateNameLabel}
                </span>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.rekonsiliasi.templateNamePlaceholder}
                />
              </label>
            </div>

            <div className="field-row mt-3">
              <label className="field mt-0">
                <span className="label">
                  {t.rekonsiliasi.templateDateColumnLabel}
                </span>
                <input
                  className="input"
                  required
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value)}
                  placeholder={t.rekonsiliasi.templateDateColumnPlaceholder}
                />
              </label>
              <label className="field mt-0">
                <span className="label">
                  {t.rekonsiliasi.templateDescriptionColumnLabel}
                </span>
                <input
                  className="input"
                  required
                  value={descriptionColumn}
                  onChange={(e) => setDescriptionColumn(e.target.value)}
                  placeholder={
                    t.rekonsiliasi.templateDescriptionColumnPlaceholder
                  }
                />
              </label>
            </div>

            <label className="field">
              <span className="label">
                {t.rekonsiliasi.templateAmountColumnLabel}
              </span>
              <input
                className="input"
                required
                value={amountColumn}
                onChange={(e) => setAmountColumn(e.target.value)}
                placeholder={t.rekonsiliasi.templateAmountColumnPlaceholder}
              />
            </label>

            <label className="field">
              <span className="label">
                {t.rekonsiliasi.templateDateFormatLabel}
              </span>
              <select
                className="select"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
              >
                <option value="">{t.rekonsiliasi.templateDateFormatIso}</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </label>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.rekonsiliasi.closeButton}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {t.rekonsiliasi.templateSaveButton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * EPIC-023 G2 (D17) — the real upload path: the raw file is sent to the
 * server, which parses CSV (proper quote handling)/Excel for real, refuses
 * PDF with a clear reason, and never reports success on zero imported rows
 * (reconciliation-parsers.ts). This replaces the former client-side
 * `split(",")` + ×100 parser entirely — `lib/api-client.ts` is protected
 * and cannot be extended for multipart bodies, so this is a page-local
 * fetch mirroring its error-shape handling (`{message}` on failure).
 */
/** EPIC-023 Task G retry (MEDIUM finding) — carries the API's stable error
 * `code` alongside its (Indonesian) message, so the caller can render a
 * localized message for an English-locale user instead of the raw text. */
class ReconciliationUploadError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ReconciliationUploadError";
    this.code = code;
  }
}

async function uploadReconciliationFile(
  familyGroupId: string,
  token: string,
  file: File,
  bankCode: string | null,
): Promise<BankSyncDto> {
  const form = new FormData();
  form.append("file", file);
  if (bankCode) form.append("bankCode", bankCode);

  const res = await fetch(
    `${API_BASE}/family-groups/${familyGroupId}/reconciliation/upload-file`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    // Same trap as `postStatementJson`: when the response does not come from
    // the API (an nginx 413 or 504 page), `res.json()` fails and
    // `res.statusText` is the empty string over HTTP/2, which renders as a
    // toast with no text in it. The status code is the last resort.
    throw new ReconciliationUploadError(
      body.message?.trim() || res.statusText.trim() || `HTTP ${res.status}`,
      body.code,
    );
  }
  return res.json() as Promise<BankSyncDto>;
}

/**
 * EPIC-029 groups 2-3 — the two statement-PDF calls.
 *
 * A page-local fetch rather than `apiFetch` for the same reason
 * `uploadReconciliationFile` is one: `lib/api-client.ts` is protected and
 * discards the API's stable error `code`, which every refusal on this path
 * depends on to render its own localized message (and, for a totals
 * mismatch, the numbers).
 */
class StatementReadError extends Error {
  code?: string;
  totals?: StatementTotalsVerdictDto;
  constructor(
    message: string,
    code?: string,
    totals?: StatementTotalsVerdictDto,
  ) {
    super(message);
    this.name = "StatementReadError";
    this.code = code;
    this.totals = totals;
  }
}

async function postStatementJson<T>(
  familyGroupId: string,
  token: string,
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(
    `${API_BASE}/family-groups/${familyGroupId}/reconciliation/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
      totals?: StatementTotalsVerdictDto;
    };
    // This threw an EMPTY message in production and the failure was
    // completely silent. When the response does not come from the API at all
    // — an nginx 504 page, a Cloudflare error — `res.json()` fails and the
    // fallback was `res.statusText`, which over HTTP/2 is ALWAYS the empty
    // string (h2 carries no reason phrase). `toast.error("")` renders a toast
    // with no text in it. So the status code is the last resort here, and it
    // is never blank.
    const message =
      payload.message?.trim() || res.statusText.trim() || `HTTP ${res.status}`;
    throw new StatementReadError(message, payload.code, payload.totals);
  }
  return res.json() as Promise<T>;
}

/** The shape check `runPdfRead` applies before rendering a preview. Narrow on
 *  purpose: it asserts the fields the preview UI dereferences, nothing more. */
function isStatementPreview(value: unknown): value is StatementPreviewDto {
  const preview = value as StatementPreviewDto | null;
  return (
    !!preview &&
    Array.isArray(preview.rows) &&
    Array.isArray(preview.skippedRows) &&
    typeof preview.totals?.status === "string" &&
    Array.isArray(preview.totals.checks) &&
    Array.isArray(preview.draft?.rows)
  );
}

/** EPIC-029 E3b — one label per totals check. Kept beside the preview so a
 *  newly-added check cannot render as a bare enum string. */
function totalsCheckLabel(
  label: StatementTotalsCheckDto["label"],
  t: ReturnType<typeof useLocale>["t"],
): string {
  switch (label) {
    case "opening-to-closing":
      return t.rekonsiliasi.pdfPreviewTotalsOpeningToClosing;
    case "total-credit":
      return t.rekonsiliasi.pdfPreviewTotalsCredit;
    case "total-debit":
      return t.rekonsiliasi.pdfPreviewTotalsDebit;
    default: {
      const _exhaustive: never = label;
      void _exhaustive;
      return "";
    }
  }
}

/** EPIC-029 E2d — one localized message per stable API error code, so an
 *  English-locale user does not get the API's Indonesian text. Returns
 *  undefined for an unrecognised code so the caller falls back to the raw
 *  message rather than showing nothing. */
function statementErrorMessageForCode(
  code: string | undefined,
  t: ReturnType<typeof useLocale>["t"],
): string | undefined {
  switch (code) {
    case "STATEMENT_AI_NOT_CONFIGURED":
      return t.rekonsiliasi.uploadErrorStatementAiNotConfigured;
    case "AI_KEY_CORRUPTED":
      return t.rekonsiliasi.uploadErrorStatementAiKeyCorrupted;
    case "STATEMENT_AI_AUTH":
      return t.rekonsiliasi.uploadErrorStatementAiAuth;
    case "STATEMENT_AI_RATE_LIMITED":
      return t.rekonsiliasi.uploadErrorStatementAiRateLimited;
    case "STATEMENT_AI_TIMEOUT":
      return t.rekonsiliasi.uploadErrorStatementAiTimeout;
    case "STATEMENT_AI_PARSE_FAILED":
      return t.rekonsiliasi.uploadErrorStatementAiParseFailed;
    case "STATEMENT_AI_UPSTREAM_FAILED":
      return t.rekonsiliasi.uploadErrorStatementAiUpstreamFailed;
    case "STATEMENT_TEXT_TOO_LARGE":
      return t.rekonsiliasi.uploadErrorStatementTextTooLarge;
    case "STATEMENT_NO_TEXT_LAYER":
      return t.rekonsiliasi.uploadErrorStatementNoTextLayer;
    case "STATEMENT_NO_ROWS":
      return t.rekonsiliasi.uploadErrorStatementNoRows;
    case "STATEMENT_ZERO_VALID_ROWS":
      return t.rekonsiliasi.uploadErrorStatementZeroValidRows;
    case "STATEMENT_COLUMN_MAPPING_MISMATCH":
      return t.rekonsiliasi.uploadErrorStatementColumnMappingMismatch;
    case "STATEMENT_TOTALS_MISMATCH":
      return t.rekonsiliasi.uploadErrorStatementTotalsMismatch;
    default:
      return undefined;
  }
}

/** EPIC-023 Task G retry (MEDIUM finding) — maps the backend's stable error
 * code to a localized message; returns `undefined` for a code it doesn't
 * recognise so the caller falls back to the raw (Indonesian) API message
 * rather than showing nothing. */
function uploadErrorMessageForCode(
  code: string | undefined,
  t: ReturnType<typeof useLocale>["t"],
): string | undefined {
  switch (code) {
    case "PDF_UNSUPPORTED":
      return t.rekonsiliasi.uploadErrorPdfUnsupported;
    case "XLS_UNSUPPORTED":
      return t.rekonsiliasi.uploadErrorXlsUnsupported;
    case "UNSUPPORTED_FORMAT":
      return t.rekonsiliasi.uploadErrorUnsupportedFormat;
    case "EMPTY_FILE":
      return t.rekonsiliasi.uploadErrorEmptyFile;
    case "XLSX_UNREADABLE":
      return t.rekonsiliasi.uploadErrorXlsxUnreadable;
    case "XLSX_LIMIT_EXCEEDED":
      return t.rekonsiliasi.uploadErrorXlsxLimitExceeded;
    case "COLUMN_MAPPING_MISMATCH":
      return t.rekonsiliasi.uploadErrorColumnMappingMismatch;
    case "ZERO_VALID_ROWS":
      return t.rekonsiliasi.uploadErrorZeroValidRows;
    case "NO_AUTO_DETECT_MAPPING":
      return t.rekonsiliasi.uploadErrorNoAutoDetectMapping;
    case "NO_SAVED_TEMPLATE":
      return t.rekonsiliasi.uploadErrorNoSavedTemplate;
    default:
      return undefined;
  }
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
  // EPIC-023 G2 (D17) — null = auto-detect columns from the file's header;
  // otherwise the family's saved template for that bank is applied.
  const [selectedBankCode, setSelectedBankCode] = React.useState<string | null>(
    null,
  );
  const [templateManagerOpen, setTemplateManagerOpen] = React.useState(false);
  // EPIC-023 Task G retry (HIGH five-reviewer finding) — rows the server
  // skipped on the most recent upload, surfaced so a partial import never
  // looks identical to a fully-clean one. Cleared on every new upload
  // attempt so a previous file's skips don't linger against a new one.
  const [lastUploadSkippedRows, setLastUploadSkippedRows] = React.useState<
    SkippedRowDto[]
  >([]);
  // EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — the real
  // total skipped count, which can exceed `lastUploadSkippedRows.length`
  // once the server-side cap (`MAX_SKIPPED_ROWS_RETURNED`) applies.
  const [lastUploadSkippedRowsTotal, setLastUploadSkippedRowsTotal] =
    React.useState(0);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /* ─── EPIC-029 group 4 (E4b/E4c/E4d) — password-protected statements ───
     The password lives HERE and nowhere else: component state, cleared the
     moment the prompt closes, the file changes, or the upload succeeds. It
     is never persisted, never logged, and never added to a request — what
     the upload mutation receives is the DECRYPTED file (E8/E10). */
  const [protectedFile, setProtectedFile] = React.useState<{
    file: File;
    kind: StatementFileKind;
  } | null>(null);
  const [filePassword, setFilePassword] = React.useState("");
  const [showFilePassword, setShowFilePassword] = React.useState(false);
  const [unlockError, setUnlockError] = React.useState<string | null>(null);
  const [unlocking, setUnlocking] = React.useState(false);

  /* ─── EPIC-029 groups 1-3 — statement PDF ───
     `pdfPreview` is the ONLY thing a successful read produces: nothing is
     stored until the user presses confirm (E3a). `pdfBusy` names which of
     the two phases is running, because they fail for entirely different
     reasons and take very different amounts of time — "Membaca PDF di
     browser" is local and instant, "AI sedang merapikan" is a paid network
     round-trip on the family's own key. */
  const [pdfPreview, setPdfPreview] =
    React.useState<StatementPreviewDto | null>(null);
  /** Which page the AI is on, so a multi-page read shows progress instead of
   *  one spinner that used to end in nothing at all. */
  const [pdfProgress, setPdfProgress] = React.useState<{
    page: number;
    total: number;
  } | null>(null);
  const [pdfBusy, setPdfBusy] = React.useState<"reading" | "analyzing" | null>(
    null,
  );
  const [pdfConfirming, setPdfConfirming] = React.useState(false);

  // EPIC-023 G2 (D17) — column-mapping templates: read is available to
  // whoever can already upload/reconcile (member+); the manager dialog
  // (create/update/delete) is owner/admin_staff/spouse-level, mirroring
  // casl-ability.factory.ts's ReconciliationTemplate subject. This is a UI
  // convenience only — the API is the real enforcement.
  const templatesQuery = useQuery<ReconciliationTemplateDto[]>({
    queryKey: familyGroupId
      ? ["reconciliation-templates", familyGroupId]
      : ["reconciliation-templates-disabled"],
    queryFn: () =>
      apiFetch<ReconciliationTemplateDto[]>(
        `/family-groups/${familyGroupId}/reconciliation/templates`,
        { token },
      ),
    enabled: !!familyGroupId && !!token,
  });
  const templateBankCodes = new Set(
    (templatesQuery.data ?? []).map((tpl) => tpl.bankCode),
  );

  const { data: familyGroupsMine } = useQuery<{ id: string; myRole: string }[]>(
    {
      queryKey: [...queryKeys.familyGroups.mine(), token],
      queryFn: () =>
        apiFetch<{ id: string; myRole: string }[]>("/family-groups/mine", {
          token,
        }),
      enabled: !!token,
      staleTime: 60_000,
    },
  );
  const myRole = familyGroupsMine?.find((g) => g.id === familyGroupId)?.myRole;
  const canManageTemplates =
    myRole === "owner" || myRole === "admin_staff" || myRole === "spouse";

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
      return uploadReconciliationFile(
        familyGroupId,
        token,
        file,
        selectedBankCode,
      );
    },
    onSuccess: (data) => {
      setSyncId(data.id);
      if (familyGroupId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.reconciliation.list(familyGroupId),
        });
      }
      const skipped = data.skippedRows ?? [];
      // EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — the
      // TRUE total, not the (possibly server-capped) array length, so the
      // toast/banner count is accurate even for a file with thousands of
      // skips.
      const skippedTotal = data.skippedRowsTotal ?? skipped.length;
      setLastUploadSkippedRows(skipped);
      setLastUploadSkippedRowsTotal(skippedTotal);
      // EPIC-023 Task G retry (HIGH five-reviewer finding) — a partial
      // import (some rows skipped) must never read as an unqualified
      // success; the full detail renders in the skipped-rows banner below.
      if (skippedTotal > 0) {
        toast.warning(
          `${t.rekonsiliasi.toastUploadedPartialPrefix}${skippedTotal}${t.rekonsiliasi.toastUploadedPartialSuffix}`,
        );
      } else {
        toast.success(t.rekonsiliasi.toastUploaded);
      }
      goto(2);
    },
    onError: (err: unknown) => {
      // A2 (revisi-2) — a known error code renders its own localized
      // message; an unrecognised one used to fall back to the API's raw
      // message, which can be a technical last-resort string like
      // "HTTP 504" (postStatementJson/postStatementMultipart's fallback
      // when the response isn't from the API at all, e.g. an nginx error
      // page). The raw error still goes to the console for debugging; the
      // user only ever sees localized copy.
      const code =
        err instanceof ReconciliationUploadError ? err.code : undefined;
      if (err instanceof Error)
        console.error("[rekonsiliasi] upload failed:", err);
      toast.error(
        uploadErrorMessageForCode(code, t) ??
          t.rekonsiliasi.toastUploadFailedDefault,
      );
    },
  });

  /** E4d — the single place the password is discarded. Called on cancel, on
   *  a new pick, and on a successful unlock, so it never outlives the one
   *  upload it was typed for. */
  const clearPasswordState = React.useCallback(() => {
    setProtectedFile(null);
    setFilePassword("");
    setShowFilePassword(false);
    setUnlockError(null);
    setUnlocking(false);
  }, []);

  /**
   * Decrypt/extract client-side if needed, then upload the PLAINTEXT result
   * through the unchanged mutation. `password` is passed by value and is
   * never stored anywhere by `prepareStatementFile`.
   */
  const runUpload = React.useCallback(
    async (file: File, password: string | undefined) => {
      setLastUploadSkippedRows([]);
      setLastUploadSkippedRowsTotal(0);
      setUnlockError(null);
      setUnlocking(true);
      setUploading(true);
      let prepared: File;
      try {
        prepared = await prepareStatementFile(file, password);
      } catch (err) {
        setUnlocking(false);
        setUploading(false);
        const message = statementFileErrorMessage(err, t);
        const reason =
          err instanceof StatementFileError ? err.reason : "corrupt-file";
        if (password !== undefined || reason === "password-required") {
          // The prompt is open (or must open): keep it open and say
          // precisely what went wrong, so a wrong password is retryable
          // without re-picking the file.
          setUnlockError(message);
          return;
        }
        toast.error(message);
        return;
      }
      setUnlocking(false);
      clearPasswordState();
      uploadMutation.mutate(prepared, {
        onSettled: () => setUploading(false),
      });
    },
    [clearPasswordState, t, uploadMutation],
  );

  /**
   * EPIC-029 groups 1-3 — the PDF path. Extract the text layer HERE, in the
   * tab, then post only that text (E8/E9/E10: the file and the password
   * never leave the browser).
   *
   * `password` is `undefined` on the first attempt, and
   * `extractStatementPdfText` tries the EMPTY password before reporting
   * `pdf-password-required` (E11) — most bank PDFs carry only an
   * owner/permissions lock and open with none, so most users are never
   * asked for anything.
   */
  const runPdfRead = React.useCallback(
    async (file: File, password: string | undefined) => {
      setLastUploadSkippedRows([]);
      setLastUploadSkippedRowsTotal(0);
      setPdfPreview(null);
      setUnlockError(null);
      setUnlocking(true);
      setPdfBusy("reading");

      let extraction: Awaited<ReturnType<typeof extractStatementPdfText>>;
      try {
        extraction = await extractStatementPdfText(file, password);
      } catch (err) {
        setUnlocking(false);
        setPdfBusy(null);
        const message = statementPdfErrorMessage(err, t);
        const reason =
          err instanceof StatementPdfError ? err.reason : "pdf-corrupt";
        // Keep the prompt open (or open it) so a wrong password is
        // retryable without re-picking the file.
        if (password !== undefined || reason === "pdf-password-required") {
          setProtectedFile({ file, kind: "pdf" });
          setUnlockError(message);
          return;
        }
        toast.error(message);
        return;
      }

      setUnlocking(false);
      // The password (if any) has done its only job and is dropped BEFORE
      // the network call — there is nothing left in state to leak into the
      // request that follows.
      clearPasswordState();
      setPdfBusy("analyzing");

      if (!familyGroupId || !token) {
        setPdfBusy(null);
        toast.error(t.rekonsiliasi.errorSessionInactive);
        return;
      }
      try {
        // Read PAGE BY PAGE rather than the whole statement in one call.
        //
        // The single call could not work in production: a 5-page statement
        // ran past the reader's 120s budget, while nginx cuts an idle
        // upstream at 60s and Cloudflare caps a request at ~100s. The request
        // was simply longer than the path allows, so the browser saw a dead
        // connection and (because HTTP/2 carries no reason phrase) an empty
        // error message. A page is roughly ten rows and finishes in seconds.
        //
        // A blank page is skipped without spending anything: the server
        // refuses near-empty text anyway, and a cover page is not worth a
        // paid call.
        const merged: StatementDraftRow[] = [];
        const mergedTotals: StatementDraftTotals = {
          openingBalance: null,
          closingBalance: null,
          totalCredit: null,
          totalDebit: null,
        };
        const readablePages = extraction.pages
          .map((text, index) => ({ text, index }))
          .filter(
            (page) =>
              page.text.replace(/\s+/g, "").length >= MIN_PAGE_TEXT_CHARS,
          );

        if (readablePages.length === 0) {
          throw new StatementReadError("", "STATEMENT_NO_TEXT_LAYER");
        }

        for (const [position, page] of readablePages.entries()) {
          setPdfProgress({ page: position + 1, total: readablePages.length });
          const read = await postStatementJson<StatementPageRead>(
            familyGroupId,
            token,
            "statement-pdf/page",
            {
              fileName: file.name,
              pageCount: extraction.pageCount,
              pageIndex: page.index,
              text: page.text,
            },
          );
          // Same reason `isStatementPreview` exists: during a rolling deploy
          // this client can meet an API that answers a shape it does not
          // expect. Spreading a missing `rows` would throw a raw TypeError
          // and surface as a stack-trace message instead of the retryable,
          // localized error the user should see.
          if (!Array.isArray(read?.rows)) {
            throw new StatementReadError("", "STATEMENT_AI_UPSTREAM_FAILED");
          }
          merged.push(...read.rows);
          // Statements print their totals on one page (usually the summary),
          // so the first non-null wins and a later page cannot overwrite a
          // figure with a null. Two pages disagreeing would be a statement
          // bug; the totals gate is what catches that, not this merge.
          for (const key of Object.keys(
            mergedTotals,
          ) as (keyof StatementDraftTotals)[]) {
            mergedTotals[key] ??= read.totals?.[key] ?? null;
          }
        }
        setPdfProgress(null);

        if (merged.length === 0) {
          throw new StatementReadError("", "STATEMENT_NO_ROWS");
        }

        // Parsing and the totals gate run server-side over the merged set —
        // no AI call, so this is free and retryable. The commit re-runs the
        // very same pipeline before it writes, which is what makes a
        // client-merged draft safe to send.
        const preview = await postStatementJson<StatementPreviewDto>(
          familyGroupId,
          token,
          "statement-pdf/preview",
          {
            fileName: file.name,
            pageCount: extraction.pageCount,
            rows: merged,
            totals: mergedTotals,
          },
        );
        // Validated before it is rendered. Not defensive decoration: during a
        // rolling deploy this client can meet an older API, and a preview
        // missing its totals verdict would throw inside render and take the
        // whole page down — a white screen instead of a retryable error.
        if (!isStatementPreview(preview)) {
          throw new StatementReadError("", "STATEMENT_AI_UPSTREAM_FAILED");
        }
        setPdfPreview(preview);
      } catch (err) {
        const code = err instanceof StatementReadError ? err.code : undefined;
        // A2 (revisi-2) — every branch must still end in visible text (a
        // blank message once made this failure invisible), but the raw
        // fallback text (`readStatementResponse`'s last-resort `HTTP 504`
        // for a non-API response) is not fit to show a user, so it only
        // reaches the console now.
        if (err instanceof Error)
          console.error("[rekonsiliasi] statement read failed:", err);
        toast.error(
          statementErrorMessageForCode(code, t) ??
            t.rekonsiliasi.toastUploadFailedDefault,
        );
      } finally {
        setPdfBusy(null);
        setPdfProgress(null);
      }
    },
    [clearPasswordState, familyGroupId, t, token],
  );

  /**
   * E3a/E7 — the explicit confirm. Posts the SAME raw draft back; the server
   * re-parses every amount through `parseStatementAmount` and re-runs the
   * totals gate before it writes anything, so this button cannot smuggle a
   * number past the parser.
   */
  const confirmPdfPreview = React.useCallback(async () => {
    if (!pdfPreview || !familyGroupId || !token) return;
    setPdfConfirming(true);
    try {
      const sync = await postStatementJson<BankSyncDto>(
        familyGroupId,
        token,
        "statement-pdf/confirm",
        pdfPreview.draft,
      );
      setPdfPreview(null);
      setSyncId(sync.id);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reconciliation.list(familyGroupId),
      });
      const skipped = sync.skippedRows ?? [];
      const skippedTotal = sync.skippedRowsTotal ?? skipped.length;
      setLastUploadSkippedRows(skipped);
      setLastUploadSkippedRowsTotal(skippedTotal);
      if (skippedTotal > 0) {
        toast.warning(
          `${t.rekonsiliasi.toastUploadedPartialPrefix}${skippedTotal}${t.rekonsiliasi.toastUploadedPartialSuffix}`,
        );
      } else if (pdfPreview.totals.status === "unavailable") {
        // Once the preview closes this toast is the ONLY thing left on
        // screen, so an unqualified "berhasil" here would quietly upgrade
        // "nothing was checked" into "it checked out".
        toast.warning(t.rekonsiliasi.toastUploadedUnverified);
      } else {
        toast.success(t.rekonsiliasi.toastUploaded);
      }
      goto(2);
    } catch (err) {
      const code = err instanceof StatementReadError ? err.code : undefined;
      // A2 (revisi-2) — same reasoning as the preview catch above: never
      // surface the raw `HTTP 504`-style last-resort message to the user.
      if (err instanceof Error)
        console.error("[rekonsiliasi] statement confirm failed:", err);
      toast.error(
        statementErrorMessageForCode(code, t) ??
          t.rekonsiliasi.toastUploadFailedDefault,
      );
    } finally {
      setPdfConfirming(false);
    }
  }, [familyGroupId, goto, pdfPreview, queryClient, t, token]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the SAME file after a wrong password
    // still fires `change`.
    e.target.value = "";
    if (!file) return;
    clearPasswordState();
    setPdfPreview(null);
    void (async () => {
      let kind: StatementFileKind;
      try {
        kind = await inspectStatementFile(file);
      } catch (err) {
        toast.error(statementFileErrorMessage(err, t));
        return;
      }
      // EPIC-029 group 1 — a PDF never becomes an uploaded file: its text is
      // extracted here and only the text is posted.
      if (kind === "pdf") {
        await runPdfRead(file, undefined);
        return;
      }
      // E4b/E4c — prompt ONLY when the file's own magic bytes say it is
      // encrypted. An ordinary CSV/XLSX is never asked for a password.
      if (needsPassword(kind)) {
        setProtectedFile({ file, kind });
        return;
      }
      await runUpload(file, undefined);
    })();
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

  // Restructure (prototype parity) — the segmented filter above the match
  // table narrows which fetched entries render; it never re-fetches or
  // changes the real matched/suggested/unmatched counts above it (those
  // stay computed off the full `entries` list).
  const [entryFilter, setEntryFilter] = React.useState<"all" | "warn" | "err">(
    "all",
  );

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

  /**
   * Turning bank lines into transactions.
   *
   * Reconciliation could only ever MATCH a line against a transaction that
   * already existed, so with nothing to match against every line read "Tidak
   * Ditemukan" and an imported statement never reached /transaksi. These two
   * mutations are the missing direction.
   *
   * The destination account is asked for once, defaulting to the family's
   * first account — the upload step only records a bank CODE, never an
   * account, so there is nothing better to inherit and the user must be able
   * to see and change it. Category is left empty on purpose: a statement
   * description is not a category, and inventing one would write a wrong
   * number into every budget that reads it.
   */
  const [importAccountId, setImportAccountId] = React.useState<string>("");
  const accountsList = accountsQuery.data ?? [];
  const resolvedImportAccountId = importAccountId || accountsList[0]?.id || "";

  const invalidateAfterImport = React.useCallback(() => {
    if (!familyGroupId) return;
    // The imported rows are transactions now, so every view that counts money
    // is stale — not just this page's entry list.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.transactions.all(familyGroupId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.accounts.all(familyGroupId),
    });
    if (syncId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reconciliation.entries(familyGroupId, syncId),
      });
    }
  }, [familyGroupId, queryClient, syncId]);

  const importEntryMutation = useMutation({
    mutationFn: ({ entryId }: { entryId: string }) =>
      apiFetch<BankSyncEntryDto>(
        `/family-groups/${familyGroupId}/reconciliation/${syncId}/entries/${entryId}/import`,
        {
          method: "POST",
          token,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: resolvedImportAccountId }),
        },
      ),
    onSuccess: () => {
      invalidateAfterImport();
      toast.success(t.rekonsiliasi.toastEntryImported);
    },
    onError: (err: unknown) => {
      toast.error(
        (err instanceof Error && err.message.trim()) ||
          t.rekonsiliasi.toastImportFailedDefault,
      );
    },
  });

  const importAllMutation = useMutation({
    mutationFn: () =>
      apiFetch<ImportEntriesResultDto>(
        `/family-groups/${familyGroupId}/reconciliation/${syncId}/import-unmatched`,
        {
          method: "POST",
          token,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: resolvedImportAccountId }),
        },
      ),
    onSuccess: (result) => {
      invalidateAfterImport();
      // Say what actually happened. "Berhasil" over a run that skipped nine
      // rows is the kind of half-truth that gets found weeks later, when the
      // balance does not agree with the bank.
      if (result.skippedTotal > 0) {
        toast.warning(
          t.rekonsiliasi.toastEntriesImportedPartial
            .replace("{imported}", String(result.imported))
            .replace("{skipped}", String(result.skippedTotal)),
        );
      } else {
        toast.success(
          t.rekonsiliasi.toastEntriesImported.replace(
            "{imported}",
            String(result.imported),
          ),
        );
      }
    },
    onError: (err: unknown) => {
      toast.error(
        (err instanceof Error && err.message.trim()) ||
          t.rekonsiliasi.toastImportFailedDefault,
      );
    },
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

  // EPIC-026 Wave 5 (prototype parity) — composition percentages + the
  // matched-amount sum for the prototype's `.card stat` summary cards and
  // its stacked `.recon-composition` bar. All derived from the SAME fetched
  // `entries` list, at the SAME unscaled whole-rupiah scale as the table's
  // rows (see the scale note on `formatEntryAmount`).
  const numLocale = locale === "en" ? "en-US" : "id-ID";
  const txTypeLabelsPage = t.rekonsiliasi.txTypeLabels as Record<
    string,
    string
  >;
  const totalEntriesCount = entries.length;
  const matchedPct =
    totalEntriesCount > 0 ? (matchedCount / totalEntriesCount) * 100 : 0;
  const suggestedPct =
    totalEntriesCount > 0 ? (suggestedCount / totalEntriesCount) * 100 : 0;
  const unmatchedPct =
    totalEntriesCount > 0 ? (unmatchedCount / totalEntriesCount) * 100 : 0;
  const matchedPctDisplay = matchedPct.toLocaleString(numLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  // Whole rupiah, NOT cents — see the note on `formatEntryAmount`. Divided by
  // 100, this card claimed "Rp 156.300 tercocokkan" for a statement that had
  // matched Rp 15.630.000.
  const matchedAmountSum = entries
    .filter((e) => e.reconStatus === "matched")
    .reduce((sum, e) => sum + Math.abs(parseInt(e.amount, 10)), 0);

  return (
    <div>
      {/* Restructure (prototype parity) — page header with title/subtitle
          and the two header actions from the prototype. "Kelola Template"
          is gated the same as its existing bank-picker CardLink
          (owner/admin_staff/spouse — casl-ability.factory.ts's
          ReconciliationTemplate subject); "Upload Mutasi" jumps to Step 1
          and opens the real file picker. */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-[19px] font-extrabold">
            {t.rekonsiliasi.headerTitle}
          </div>
          <div className="h-[3px] w-9 rounded-full bg-primary" />
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageTemplates && (
            <button
              type="button"
              onClick={() => setTemplateManagerOpen(true)}
              className="rounded-lg border px-3.5 py-2 text-[12.5px] font-bold transition-colors hover:bg-accent"
            >
              {t.rekonsiliasi.manageTemplatesLink}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              goto(1);
              handleUploadAreaClick();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            <ArrowUpFromLine className="size-3.5" />
            {t.rekonsiliasi.uploadMutasiButton}
          </button>
        </div>
      </div>

      <StepCards step={step} />

      {/* EPIC-023 Task G retry (HIGH five-reviewer finding) — a partial
          import must stay visible past the upload toast: every skipped row
          is listed with its line number and reason until the next upload.
          EPIC-023 Task G retry (MEDIUM finding, round 2) — rendering is
          bounded to MAX_SKIPPED_ROWS_RENDERED with an "and N more" line,
          independent of the API's own MAX_SKIPPED_ROWS_RETURNED cap; a
          9,999-skip file otherwise rendered one <li> per row with no limit.
          `role="status"` (LOW finding) — a screen-reader user is told this
          banner appeared instead of only sighted users noticing it. */}
      {step > 1 && lastUploadSkippedRows.length > 0 && (
        <div
          role="status"
          className="mb-4 rounded-[14px] border border-warning/40 bg-warning-soft p-4 text-[12.5px]"
        >
          <div className="mb-1.5 font-bold text-amber-800 dark:text-amber-300">
            {lastUploadSkippedRowsTotal}
            {t.rekonsiliasi.skippedRowsTitleSuffix}
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-amber-800 dark:text-amber-300">
            {lastUploadSkippedRows
              .slice(0, MAX_SKIPPED_ROWS_RENDERED)
              .map((row, i) => (
                <li key={`${row.line}-${i}`}>
                  {t.rekonsiliasi.skippedRowLinePrefix}
                  {row.line}: {row.reason}
                </li>
              ))}
          </ul>
          {lastUploadSkippedRowsTotal > MAX_SKIPPED_ROWS_RENDERED && (
            <div className="mt-1.5 font-semibold text-amber-800 dark:text-amber-300">
              {t.rekonsiliasi.skippedRowsMorePrefix}
              {lastUploadSkippedRowsTotal - MAX_SKIPPED_ROWS_RENDERED}
              {t.rekonsiliasi.skippedRowsMoreSuffix}
            </div>
          )}
        </div>
      )}

      {/* ─── Step 1: Upload — restructured into the prototype's 2-column
          layout: upload/mapping/history on the left, a reference rail
          (supported banks + tips) on the right. ─── */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <SectionCard
              action={
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {t.rekonsiliasi.maxFileSizeLabel}
                </span>
              }
            >
              <div className="mb-1 text-[15px] font-extrabold">
                {t.rekonsiliasi.uploadTitle}
                <InfoTip>
                  <p>
                    <strong>{t.rekonsiliasi.formatCalloutTitle}</strong>{" "}
                    {t.rekonsiliasi.formatCalloutBody}
                  </p>
                  <p className="mt-2">
                    <strong>{t.rekonsiliasi.protectedCalloutTitle}</strong>{" "}
                    {t.rekonsiliasi.protectedCalloutBody}
                  </p>
                  <p className="mt-2">
                    <strong>{t.rekonsiliasi.pdfCalloutTitle}</strong>{" "}
                    {t.rekonsiliasi.pdfCalloutBody}{" "}
                    {t.rekonsiliasi.pdfCalloutScanNote}
                  </p>
                </InfoTip>
              </div>
              <div className="mb-[18px] text-[12.5px] text-muted-foreground">
                {t.rekonsiliasi.uploadSubtitle}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.pdf,.zip"
                className="sr-only"
                onChange={handleFileChange}
              />

              <button
                type="button"
                onClick={handleUploadAreaClick}
                disabled={uploading || uploadMutation.isPending || !!pdfBusy}
                className="w-full cursor-pointer rounded-[14px] border-2 border-dashed border-primary/40 bg-accent/40 px-5 py-8 text-center transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent">
                  <CloudUpload className="size-7 text-primary" />
                </div>
                <div className="mb-1.5 text-[15px] font-bold text-primary-strong">
                  {pdfBusy === "reading"
                    ? t.rekonsiliasi.pdfReadingLabel
                    : pdfBusy === "analyzing"
                      ? pdfProgress
                        ? t.rekonsiliasi.pdfAnalyzingPageLabel
                            .replace("{page}", String(pdfProgress.page))
                            .replace("{total}", String(pdfProgress.total))
                        : t.rekonsiliasi.pdfAnalyzingLabel
                      : uploading || uploadMutation.isPending
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
                <div className="mt-3.5 flex items-center justify-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    CSV
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    XLSX
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    ZIP
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    PDF
                  </span>
                </div>
              </button>
            </SectionCard>

            {/* EPIC-029 E3c — the mandatory review screen. Nothing has been
                stored at this point: `pdfPreview` came back from a read that
                deliberately persists nothing, and the confirm button below is
                the only thing that writes. */}
            {pdfPreview && (
              <SectionCard
                action={
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {pdfPreview.rowCount}
                    {t.rekonsiliasi.pdfPreviewRowsSuffix}
                  </span>
                }
              >
                <div className="mb-1 text-[15px] font-extrabold">
                  {t.rekonsiliasi.pdfPreviewTitle}
                </div>
                <div className="mb-3 text-[12.5px] text-muted-foreground">
                  {t.rekonsiliasi.pdfPreviewSubtitle}
                </div>

                {/* E3b/E7 — the totals verdict, stated before the rows. A
                    mismatch is not a warning banner over an import that
                    happened anyway: the confirm button below is disabled and
                    the server refuses the same draft independently. */}
                <div
                  className={`mb-3 rounded-lg border px-3.5 py-3 text-[12px] ${
                    pdfPreview.totals.status === "matched"
                      ? "border-success/30 bg-success-soft text-emerald-800 dark:text-emerald-300"
                      : pdfPreview.totals.status === "mismatch"
                        ? "border-destructive/40 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                        : "border-amber-400/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                  }`}
                >
                  {/* The HEADING differs, not just the body. "unavailable"
                      means nothing was checked — a strictly weaker claim than
                      "matched" — and a shared title would let a glance read
                      the two as the same outcome. */}
                  <div className="font-bold">
                    {pdfPreview.totals.status === "matched"
                      ? t.rekonsiliasi.pdfPreviewTotalsTitleVerified
                      : pdfPreview.totals.status === "mismatch"
                        ? t.rekonsiliasi.pdfPreviewTotalsTitleMismatch
                        : t.rekonsiliasi.pdfPreviewTotalsTitleUnverified}
                  </div>
                  <div className="mt-0.5">
                    {pdfPreview.totals.status === "matched"
                      ? t.rekonsiliasi.pdfPreviewTotalsMatched
                      : pdfPreview.totals.status === "mismatch"
                        ? t.rekonsiliasi.pdfPreviewTotalsMismatch
                        : t.rekonsiliasi.pdfPreviewTotalsUnavailable}
                  </div>
                  {pdfPreview.totals.checks.map((check) => (
                    <div
                      key={check.label}
                      className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5"
                    >
                      <span className="font-semibold">
                        {totalsCheckLabel(check.label, t)}
                      </span>
                      <span>
                        {t.rekonsiliasi.pdfPreviewExpectedLabel}:{" "}
                        {formatRupiah(Number(check.expected))}
                      </span>
                      <span>
                        {t.rekonsiliasi.pdfPreviewActualLabel}:{" "}
                        {formatRupiah(Number(check.actual))}
                      </span>
                      {!check.matched && (
                        <span className="font-bold">
                          {t.rekonsiliasi.pdfPreviewDifferenceLabel}:{" "}
                          {formatRupiah(Number(check.difference))}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="max-h-80 overflow-auto rounded-lg border">
                  <table className="w-full text-[12px]">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="px-2.5 py-2 text-left font-bold">
                          {t.rekonsiliasi.pdfPreviewDateCol}
                        </th>
                        <th className="px-2.5 py-2 text-left font-bold">
                          {t.rekonsiliasi.pdfPreviewDescCol}
                        </th>
                        <th className="px-2.5 py-2 text-right font-bold">
                          {t.rekonsiliasi.pdfPreviewAmountCol}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfPreview.rows.map((row, index) => {
                        const amount = Number(row.amount);
                        return (
                          <tr key={`${row.date}-${index}`} className="border-t">
                            <td className="whitespace-nowrap px-2.5 py-1.5">
                              {row.date.slice(0, 10)}
                            </td>
                            <td className="px-2.5 py-1.5">{row.description}</td>
                            <td
                              className={`whitespace-nowrap px-2.5 py-1.5 text-right font-semibold ${
                                amount < 0 ? "text-destructive" : "text-success"
                              }`}
                            >
                              {formatRupiah(amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* A partial read must never read as a complete one — every
                    dropped row is listed with the reason it was dropped. */}
                {pdfPreview.skippedRowsTotal > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <div className="font-bold">
                      {t.rekonsiliasi.pdfPreviewSkippedTitle} (
                      {pdfPreview.skippedRowsTotal})
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {pdfPreview.skippedRows.map((skip) => (
                        <li key={skip.line}>
                          {t.rekonsiliasi.pdfPreviewLinePrefix}
                          {skip.line}: {skip.reason}
                        </li>
                      ))}
                    </ul>
                    {pdfPreview.skippedRowsTotal >
                      pdfPreview.skippedRows.length && (
                      <div className="mt-1">
                        {t.rekonsiliasi.pdfPreviewSkippedMorePrefix}
                        {pdfPreview.skippedRowsTotal -
                          pdfPreview.skippedRows.length}
                        {t.rekonsiliasi.pdfPreviewSkippedMoreSuffix}
                      </div>
                    )}
                  </div>
                )}

                {/* E7 still lets an "unavailable" verdict commit — refusing
                    every statement that prints no totals would block
                    legitimate imports. But the confirm must not be WORDED as
                    though something was verified, so it names what is being
                    accepted instead. */}
                {pdfPreview.totals.status === "unavailable" && (
                  <div className="mt-3 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">
                    {t.rekonsiliasi.pdfPreviewUnverifiedConfirmNote}
                  </div>
                )}
                <div className="mt-3.5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPdfPreview(null)}
                    disabled={pdfConfirming}
                  >
                    {t.rekonsiliasi.pdfPreviewCancelButton}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void confirmPdfPreview()}
                    disabled={
                      pdfConfirming || pdfPreview.totals.status === "mismatch"
                    }
                  >
                    {pdfConfirming
                      ? t.rekonsiliasi.pdfPreviewImportingLabel
                      : pdfPreview.totals.status === "unavailable"
                        ? t.rekonsiliasi.pdfPreviewConfirmButtonUnverified
                        : t.rekonsiliasi.pdfPreviewConfirmButton}
                  </Button>
                </div>
              </SectionCard>
            )}

            {/* EPIC-023 G2 (D17) — bank picker: selecting a bank applies its
                saved column-mapping template; leaving it unselected falls
                back to header-alias auto-detection on the server. */}
            <SectionCard title={t.rekonsiliasi.supportedBanksTitle}>
              <div className="mb-2.5 text-[11.5px] text-muted-foreground">
                {t.rekonsiliasi.bankPickerHint}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {SUPPORTED_BANKS.map((b) => {
                  const selected = selectedBankCode === b.code;
                  const hasTemplate = templateBankCodes.has(b.code);
                  return (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() =>
                        setSelectedBankCode(selected ? null : b.code)
                      }
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                        selected
                          ? "border-primary bg-accent"
                          : "bg-card hover:bg-accent/50"
                      }`}
                    >
                      <div
                        className="flex h-6 min-w-9 items-center justify-center rounded px-1 text-[10px] font-extrabold"
                        style={{ background: b.bg, color: b.color }}
                      >
                        {b.code}
                      </div>
                      {b.name}
                      {hasTemplate && (
                        <span
                          className="size-1.5 rounded-full bg-success"
                          title={t.rekonsiliasi.templateSavedIndicator}
                        />
                      )}
                    </button>
                  );
                })}
                <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold text-muted-foreground">
                  {t.rekonsiliasi.othersLabel}
                </div>
              </div>
              {selectedBankCode && (
                <div className="mt-2.5 text-[11.5px] text-primary">
                  {templateBankCodes.has(selectedBankCode)
                    ? t.rekonsiliasi.bankSelectedWithTemplate
                    : t.rekonsiliasi.bankSelectedNoTemplate}
                </div>
              )}
            </SectionCard>

            {/* Restructure (prototype parity) — "Pemetaan Kolom" as an
                inline section (not only inside the template-manager
                dialog), scoped to the real template fields the API
                actually stores: dateColumn/descriptionColumn/amountColumn
                (upsert-reconciliation-template.dto.ts). The prototype also
                shows separate Debit/Kredit selects and a "Uji 5 baris"
                preview button — neither has a backing field/endpoint
                (`ReconciliationTemplate` has one `amountColumn`, and there
                is no dry-run endpoint), so both are omitted rather than
                faked. */}
            {selectedBankCode && (
              <SectionCard
                title={`${t.rekonsiliasi.mappingSectionTitle} — ${
                  SUPPORTED_BANKS.find((b) => b.code === selectedBankCode)
                    ?.name ?? selectedBankCode
                }`}
                action={
                  templateBankCodes.has(selectedBankCode) ? (
                    <StatusBadge variant="success" className="text-[10px]">
                      {t.rekonsiliasi.templateSavedIndicator}
                    </StatusBadge>
                  ) : undefined
                }
              >
                <div className="mb-3 text-[11.5px] text-muted-foreground">
                  {t.rekonsiliasi.mappingSectionHint}
                </div>
                {canManageTemplates ? (
                  <button
                    type="button"
                    onClick={() => setTemplateManagerOpen(true)}
                    className="rounded-md bg-primary px-4 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
                  >
                    {t.rekonsiliasi.manageTemplatesLink}
                  </button>
                ) : (
                  <div className="text-[11.5px] text-muted-foreground">
                    {t.rekonsiliasi.bankSelectedNoTemplate}
                  </div>
                )}
              </SectionCard>
            )}

            <ReconciliationTemplateManagerDialog
              open={templateManagerOpen}
              onClose={() => setTemplateManagerOpen(false)}
              familyGroupId={familyGroupId}
              token={token}
            />

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
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              ·{" "}
                              {`${t.rekonsiliasi.uploadedAtPrefix}${new Date(
                                sync.uploadedAt,
                              ).toLocaleString(
                                locale === "en" ? "en-US" : "id-ID",
                              )} · ${sync.rowCount}${t.rekonsiliasi.transactionsCountSuffix}`}
                            </span>
                          </div>
                        </div>
                        <StatusBadge
                          variant="info"
                          className="flex-shrink-0 text-[10px]"
                        >
                          {t.rekonsiliasi.uploadedBadge}
                        </StatusBadge>
                        <ChevronRight className="size-3 flex-shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
            >
              {t.rekonsiliasi.continueToMatchButton}{" "}
              <ArrowRight className="size-4" />
            </button>
          </div>

          {/* Right rail — supported banks quick reference + tips card,
              matching the prototype's 2-column layout. */}
          <div className="space-y-4">
            <SectionCard title={t.rekonsiliasi.supportedBanksTitle}>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_BANKS.map((b) => (
                  <span
                    key={b.code}
                    className="rounded-full border bg-card px-2.5 py-1 text-[11px] font-semibold"
                  >
                    {b.name}
                  </span>
                ))}
              </div>
              <div className="mt-2.5 text-[11px] text-muted-foreground">
                {t.rekonsiliasi.bankPickerHint}
              </div>
            </SectionCard>

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
          </div>
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
      {step === 3 &&
        (() => {
          // Lines with no LINKED transaction — not "unmatched" by status: a
          // "suggested" line is unconfirmed too, and importing it would be
          // just as new.
          const unimportedCount = entries.filter(
            (entry) => !entry.matchedTxId,
          ).length;
          const filteredEntries = entries.filter((entry) => {
            if (entryFilter === "all") return true;
            return entryStatus(entry.reconStatus) === entryFilter;
          });
          return (
            <div className="space-y-4">
              {/* EPIC-026 Wave 5 (prototype parity) — the prototype's
                  summary section: three `.card stat` cards (icon chip +
                  label + mono count + delta line) beside a "Komposisi
                  Hasil" card whose composition is a stacked BAR + legend
                  — not a chart (see the import-side note: this page has no
                  chart mount in the prototype). Delta lines are real: the
                  matched Rp sum is computed from the same entries the
                  table shows, at the same display scale. */}
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="rounded-[14px] border bg-card p-4">
                    <div className="mb-2 flex size-9 items-center justify-center rounded-[10px] bg-success-soft text-[16px]">
                      ✅
                    </div>
                    <div className="text-[11.5px] font-bold text-muted-foreground">
                      {t.rekonsiliasi.matchedSummaryLabel}
                    </div>
                    <div className="mono text-[20px] font-extrabold">
                      {matchedCount}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-success">
                      {formatRupiah(matchedAmountSum)} tercocokkan
                    </div>
                  </div>
                  <div className="rounded-[14px] border bg-card p-4">
                    <div className="mb-2 flex size-9 items-center justify-center rounded-[10px] bg-warning-soft text-[16px]">
                      ⚠️
                    </div>
                    <div className="text-[11.5px] font-bold text-muted-foreground">
                      {t.rekonsiliasi.needsReviewSummaryLabel}
                    </div>
                    <div className="mono text-[20px] font-extrabold">
                      {suggestedCount}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-warning">
                      Tersarankan, menunggu konfirmasi
                    </div>
                  </div>
                  <div className="rounded-[14px] border bg-card p-4">
                    <div className="mb-2 flex size-9 items-center justify-center rounded-[10px] bg-destructive/10 text-[16px]">
                      ❌
                    </div>
                    <div className="text-[11.5px] font-bold text-muted-foreground">
                      {t.rekonsiliasi.notMatchedSummaryLabel}
                    </div>
                    <div className="mono text-[20px] font-extrabold">
                      {unmatchedCount}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-destructive">
                      Belum ada transaksi padanan
                    </div>
                  </div>
                </div>

                <SectionCard
                  title={t.rekonsiliasi.compositionTitle}
                  action={
                    <StatusBadge variant="gray">
                      {entries.length}
                      {t.rekonsiliasi.matchResultsFooterSuffix}
                    </StatusBadge>
                  }
                >
                  <div className="mb-2 flex items-center justify-between text-[11.5px]">
                    <span className="text-muted-foreground">
                      Cocok otomatis
                    </span>
                    <strong className="mono text-[13px]">
                      {matchedPctDisplay}%
                    </strong>
                  </div>
                  <div
                    role="img"
                    aria-label={`${matchedCount} baris cocok, ${suggestedCount} perlu review, dan ${unmatchedCount} tidak cocok dari total ${entries.length} baris`}
                    className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
                  >
                    {matchedCount > 0 && (
                      <span
                        className="h-full bg-success"
                        style={{ width: `${matchedPct}%` }}
                      />
                    )}
                    {suggestedCount > 0 && (
                      <span
                        className="h-full bg-warning"
                        style={{ width: `${suggestedPct}%` }}
                      />
                    )}
                    {unmatchedCount > 0 && (
                      <span
                        className="h-full bg-destructive"
                        style={{ width: `${unmatchedPct}%` }}
                      />
                    )}
                  </div>
                  <div className="mt-3 space-y-1.5 text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full bg-success" />
                      <span className="flex-1 text-muted-foreground">
                        {t.rekonsiliasi.matchedSummaryLabel}
                      </span>
                      <strong className="mono">{matchedCount}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full bg-warning" />
                      <span className="flex-1 text-muted-foreground">
                        {t.rekonsiliasi.needsReviewSummaryLabel}
                      </span>
                      <strong className="mono">{suggestedCount}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full bg-destructive" />
                      <span className="flex-1 text-muted-foreground">
                        {t.rekonsiliasi.notMatchedSummaryLabel}
                      </span>
                      <strong className="mono">{unmatchedCount}</strong>
                    </div>
                  </div>
                </SectionCard>
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
                {/* Restructure (prototype parity) — segmented filter narrows
                the already-fetched `entries` list client-side; it does not
                change the stat counts or re-fetch. */}
                <div
                  className="mb-3 inline-flex rounded-lg border p-0.5"
                  role="group"
                  aria-label="Filter rekonsiliasi"
                >
                  {(
                    [
                      ["all", t.rekonsiliasi.matchFilterAll],
                      ["warn", t.rekonsiliasi.matchFilterNeedsReview],
                      ["err", t.rekonsiliasi.matchFilterNotMatched],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={entryFilter === value}
                      onClick={() => setEntryFilter(value)}
                      className={`rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                        entryFilter === value
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Turning bank lines into transactions. Matching alone
                    could only ever LINK a line to a transaction that already
                    existed, so a family importing a statement before typing
                    anything in saw every line red and nothing on /transaksi.
                    The account is asked for here because the bank line does
                    not carry one; the direction is not asked for, because the
                    sign on the line already decides it. */}
                {unimportedCount > 0 && (
                  <div className="mb-3 flex flex-wrap items-end gap-3 rounded-[12px] border bg-accent/30 p-3">
                    <label className="field mb-0 min-w-[200px] flex-1">
                      <span className="label">
                        {t.rekonsiliasi.importAccountLabel}
                      </span>
                      <select
                        className="select"
                        value={resolvedImportAccountId}
                        onChange={(event) =>
                          setImportAccountId(event.target.value)
                        }
                        disabled={
                          accountsList.length === 0 ||
                          importAllMutation.isPending ||
                          importEntryMutation.isPending
                        }
                      >
                        {accountsList.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => importAllMutation.mutate()}
                      disabled={
                        !resolvedImportAccountId ||
                        importAllMutation.isPending ||
                        importEntryMutation.isPending
                      }
                      className="btn btn--primary"
                    >
                      {importAllMutation.isPending
                        ? t.rekonsiliasi.importAllPendingLabel
                        : t.rekonsiliasi.importAllButton.replace(
                            "{count}",
                            String(unimportedCount),
                          )}
                    </button>
                    <p className="w-full text-[11.5px] text-muted-foreground">
                      {t.rekonsiliasi.importHelpText}
                    </p>
                  </div>
                )}

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

                {/* Restructure (EPIC-026 Wave 5, prototype parity) — the
                    prototype renders results as a 6-column TABLE (Tanggal /
                    Rekening Koran / Jumlah / Transaksi WealthMe / Status /
                    Aksi), not the previous two-panel row layout. Only
                    actions with a real backend render: Detail (detail
                    dialog — keeps the old row-click affordance as an
                    explicit, keyboard-focusable button), Konfirmasi
                    (PATCH …/match) and Pecah (split dialog). The
                    prototype's "Abaikan" and "Buat Transaksi" buttons have
                    no backing endpoint (no ignored state, no
                    create-transaction-from-entry route) — cut per the
                    honest-UI rule rather than shipped dead. */}
                {filteredEntries.length > 0 && (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
                      <thead>
                        <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                          <th className="py-2.5 pr-3 font-semibold">
                            {t.rekonsiliasi.detailDateLabel}
                          </th>
                          <th className="py-2.5 pr-3 font-semibold">
                            {t.rekonsiliasi.colBankStatement}
                          </th>
                          <th className="py-2.5 pr-3 font-semibold">
                            {t.rekonsiliasi.detailAmountLabel}
                          </th>
                          <th className="py-2.5 pr-3 font-semibold">
                            Transaksi WealthMe
                          </th>
                          <th className="py-2.5 pr-3 font-semibold">
                            {t.rekonsiliasi.colStatus}
                          </th>
                          <th className="py-2.5 font-semibold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.map((entry) => {
                          const status = entryStatus(entry.reconStatus);
                          // This divided by 100 for years, on the belief that
                          // the CSV path stored cents. It does not: every path
                          // — CSV, XLSX, statement PDF and the seed data —
                          // stores WHOLE RUPIAH, which is also why `autoMatch`
                          // compares `entry.amount` with `Transaction.amount`
                          // and applies no scaling at all. The table showed
                          // Rp 38.500 as Rp 385: every figure a hundred times
                          // too small, and none of them agreeing with the
                          // statement in the user's hand.
                          const {
                            display: amtDisplay,
                            className: amtClass,
                            magnitude: amtNum,
                          } = formatEntryAmount(entry, numLocale);
                          const entryDate = new Date(
                            entry.date,
                          ).toLocaleDateString(numLocale);
                          const tx = entry.matchedTransaction;
                          const statusVariant =
                            status === "ok"
                              ? "success"
                              : status === "warn"
                                ? "warning"
                                : "danger";
                          const statusLabel =
                            status === "ok"
                              ? t.rekonsiliasi.matchedLabel
                              : status === "warn"
                                ? t.rekonsiliasi.suggestedLabel
                                : t.rekonsiliasi.notFoundLabel;
                          return (
                            <tr
                              key={entry.id}
                              className="border-b last:border-0"
                            >
                              <td className="mono py-3 pr-3 text-[12px] whitespace-nowrap">
                                {entryDate}
                              </td>
                              <td className="py-3 pr-3">
                                <div className="font-semibold">
                                  {entry.description}
                                </div>
                              </td>
                              <td
                                className={`mono py-3 pr-3 font-bold whitespace-nowrap ${amtClass}`}
                              >
                                {amtDisplay}
                              </td>
                              <td className="py-3 pr-3">
                                {tx ? (
                                  <>
                                    <div>
                                      {tx.description ??
                                        txTypeLabelsPage[tx.type] ??
                                        tx.type}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {[
                                        tx.accountName,
                                        tx.categoryName,
                                        new Date(
                                          tx.occurredAt,
                                        ).toLocaleDateString(numLocale, {
                                          day: "numeric",
                                          month: "short",
                                        }),
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                  </>
                                ) : status === "warn" ? (
                                  <span className="text-muted-foreground">
                                    {t.rekonsiliasi.suggestedLabel}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {t.rekonsiliasi.detailNoMatchedTx}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 pr-3">
                                <StatusBadge variant={statusVariant}>
                                  {statusLabel}
                                </StatusBadge>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1.5">
                                  {status === "warn" && entry.suggestedTxId && (
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
                                  )}
                                  {!entry.matchedTxId && (
                                    <button
                                      type="button"
                                      aria-label={`${t.rekonsiliasi.importEntryAriaLabelPrefix} ${entry.description}`}
                                      disabled={
                                        importEntryMutation.isPending ||
                                        importAllMutation.isPending ||
                                        !resolvedImportAccountId
                                      }
                                      onClick={() =>
                                        importEntryMutation.mutate({
                                          entryId: entry.id,
                                        })
                                      }
                                      className="flex items-center gap-1 rounded-md border border-primary/40 bg-accent/40 px-2.5 py-1 text-[11px] font-bold text-primary-strong transition-colors hover:bg-accent disabled:opacity-60"
                                    >
                                      <Plus className="size-3" />
                                      {t.rekonsiliasi.importEntryButton}
                                    </button>
                                  )}
                                  {status !== "ok" && (
                                    <button
                                      type="button"
                                      aria-label={`${t.rekonsiliasi.splitButtonAriaLabelPrefix} ${entry.description}`}
                                      onClick={() => setSplitEntryTarget(entry)}
                                      className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-accent"
                                    >
                                      <Scissors className="size-3" />
                                      {t.rekonsiliasi.splitButton}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    aria-label={`${t.rekonsiliasi.entryDetailAriaLabelPrefix} ${entry.description}, ${amtDisplay}`}
                                    onClick={() => setDetailEntry(entry)}
                                    className="rounded-md px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-accent"
                                  >
                                    Detail
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Restructure (EPIC-026 Wave 5, prototype parity) — the
                    prototype puts the count + Kembali + Simpan footer INSIDE
                    the results card. Same goto(1)/goto(4) actions as the
                    previous outside-the-card button row. */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {!entriesQuery.isLoading && entries.length > 0 && (
                    <span className="text-[11.5px] text-muted-foreground">
                      {t.rekonsiliasi.matchResultsFooterPrefix}
                      {filteredEntries.length}
                      {t.rekonsiliasi.matchResultsFooterMid}
                      {entries.length}
                      {t.rekonsiliasi.matchResultsFooterSuffix}
                    </span>
                  )}
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => goto(1)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] bg-background px-4 py-2 text-[12.5px] font-bold transition-colors hover:bg-accent"
                  >
                    <ArrowLeft className="size-3.5" />{" "}
                    {t.rekonsiliasi.backButton}
                  </button>
                  <button
                    type="button"
                    onClick={() => goto(4)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
                  >
                    <Save className="size-3.5" />{" "}
                    {t.rekonsiliasi.saveReconciliationButton}
                  </button>
                </div>
              </SectionCard>
            </div>
          );
        })()}

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

      {/* EPIC-029 group 4 (E4d) — the password prompt. Everything typed
          here stays in `filePassword` and dies with `clearPasswordState`;
          the form has no `action`, the input has no `name`, and nothing
          here is ever serialised into a request. */}
      <Dialog
        open={!!protectedFile}
        onOpenChange={(open) => {
          if (!open) clearPasswordState();
        }}
      >
        <DialogContent className="dialog--sm">
          <DialogTitle>{t.rekonsiliasi.protectedDialogTitle}</DialogTitle>
          <DialogDescription>
            {protectedFile?.kind === "pdf"
              ? t.rekonsiliasi.protectedDialogDescPdf
              : protectedFile?.kind === "encrypted-zip"
                ? t.rekonsiliasi.protectedDialogDescZip
                : t.rekonsiliasi.protectedDialogDescXlsx}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!protectedFile || unlocking) return;
              void (protectedFile.kind === "pdf"
                ? runPdfRead(protectedFile.file, filePassword)
                : runUpload(protectedFile.file, filePassword));
            }}
          >
            <DialogBody>
              <label className="field">
                <span className="label">
                  {t.rekonsiliasi.protectedPasswordLabel}
                </span>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showFilePassword ? "text" : "password"}
                    value={filePassword}
                    autoFocus
                    autoComplete="off"
                    // Off for every assistant that might otherwise store it:
                    // this secret belongs to the bank file, not to the user's
                    // password manager or the browser's form cache.
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-1p-ignore
                    data-lpignore="true"
                    placeholder={t.rekonsiliasi.protectedPasswordPlaceholder}
                    onChange={(e) => {
                      setFilePassword(e.target.value);
                      setUnlockError(null);
                    }}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
                    aria-label={
                      showFilePassword
                        ? t.rekonsiliasi.protectedHidePassword
                        : t.rekonsiliasi.protectedShowPassword
                    }
                    onClick={() => setShowFilePassword((v) => !v)}
                  >
                    {showFilePassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </label>
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                {t.rekonsiliasi.protectedPasswordHint}
              </p>
              {unlockError && (
                <p role="alert" className="error-text mt-2">
                  {unlockError}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={clearPasswordState}
              >
                {t.rekonsiliasi.protectedCancelButton}
              </Button>
              <Button type="submit" disabled={unlocking || !filePassword}>
                {unlocking
                  ? t.rekonsiliasi.protectedUnlockingLabel
                  : t.rekonsiliasi.protectedSubmitButton}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
