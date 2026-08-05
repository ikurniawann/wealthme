"use client";

import { useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  SquarePen,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatAmountInput, parseRupiah } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useShell } from "./shell-context";

const TAB_TYPES = ["income", "expense", "transfer", "expense"] as const;

type MeResponse = { familyGroupId: string | null };
type AccountDto = { id: string; name: string; institution: string | null };
type CategoryDto = {
  id: string;
  name: string;
  kind: string;
  icon: string | null;
};
type CreateTransactionInput = {
  accountId: string;
  categoryId?: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  description?: string;
  occurredAt: string;
  // EPIC-021 Group B (#23/#27/#28) — real source -> destination transfers.
  toAccountId?: string;
  adminFee?: number;
};
// EPIC-023 Task D (D3/D9, US-FAM-14) — the API's honest "did NOT create a
// transaction" response for a row-scoped member's over-threshold expense
// (POST /transactions returns 202 + this shape instead of 201 + the normal
// transaction DTO). `held: true` is a literal discriminator — see
// HeldExpenseResponseDto on the API.
type CreateTransactionResult = { held: true } | Record<string, unknown>;
// Simulated scanned-receipt content (merchant name/address, item list, OCR
// "detected" values) — this represents what the camera would read off a real
// (Indonesian) receipt, not app UI chrome, so it intentionally stays
// hardcoded in Indonesian regardless of the active locale (EPIC-018 A1).
const OCR_ITEMS = [
  ["AQUA 600ML", "Rp 5.000"],
  ["INDOMIE GORENG", "Rp 3.500"],
  ["ROTI TAWAR SARI ROTI", "Rp 12.500"],
  ["TELUR AYAM 10'S", "Rp 20.000"],
  ["MINYAK GORENG BIMOLI 1L", "Rp 17.000"],
];

const fieldClass =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

type View = "form" | "ocr-scan" | "ocr-result";

export function TransactionDialog() {
  const { txnOpen, setTxnOpen } = useShell();
  const { t } = useLocale();
  const TABS = [
    t.shell.transactionDialog.tabIncome,
    t.shell.transactionDialog.tabExpense,
    t.shell.transactionDialog.tabTransfer,
    t.shell.transactionDialog.tabCreditCard,
  ];
  const [view, setView] = useState<View>("form");
  const [tab, setTab] = useState(0);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [adminFee, setAdminFee] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const queryClient = useQueryClient();

  const { data: me } = useQuery<MeResponse>({
    queryKey: [...queryKeys.auth.me(), token],
    queryFn: () => apiFetch<MeResponse>("/auth/me", { token }),
    enabled: !!token,
  });
  const fgId = me?.familyGroupId ?? "";

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: fgId ? queryKeys.accounts.all(fgId) : ["accounts-off"],
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${fgId}/accounts`, { token }),
    enabled: !!fgId && !!token,
  });

  const { data: categories = [] } = useQuery<CategoryDto[]>({
    queryKey: fgId ? queryKeys.categories.all(fgId) : ["categories-off"],
    queryFn: () =>
      apiFetch<CategoryDto[]>(`/family-groups/${fgId}/categories`, { token }),
    enabled: !!fgId && !!token,
  });

  const txType = TAB_TYPES[tab] ?? "expense";
  const relevantCategories = categories.filter(
    (c) => c.kind === txType || c.kind === "both",
  );

  const createMutation = useMutation({
    mutationFn: (dto: CreateTransactionInput) =>
      apiFetch<CreateTransactionResult>(`/family-groups/${fgId}/transactions`, {
        method: "POST",
        body: JSON.stringify(dto),
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(fgId),
      });
      // A new transaction changes report classification (COA) AND account
      // balances, so refresh reports, accounts, and net worth too — otherwise
      // /laporan shows stale cached data ("transaksi tidak masuk ke laporan").
      void queryClient.invalidateQueries({ queryKey: ["reports", fgId] });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(fgId),
      });
    },
    onError: (err: { message?: string }) => {
      toast.error(
        t.shell.transactionDialog.saveFailedPrefix +
          (err.message ?? t.shell.transactionDialog.retryFallback),
      );
    },
  });

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const resetForm = () => {
    setAmount("");
    setAccountId("");
    setToAccountId("");
    setAdminFee("");
    setCategoryId("");
    setDescription("");
    setDate(new Date().toISOString().slice(0, 10));
  };

  const handleOpenChange = (open: boolean) => {
    setTxnOpen(open);
    if (!open) {
      clearTimers();
      setView("form");
      setShowReceipt(false);
      setShowItems(false);
      resetForm();
    }
  };

  const startOcr = () => {
    clearTimers();
    setView("ocr-scan");
    setShowReceipt(false);
    timers.current.push(setTimeout(() => setShowReceipt(true), 2200));
    timers.current.push(setTimeout(() => setView("ocr-result"), 3400));
  };

  const saveTxn = (addMore?: boolean) => {
    const amountNum = parseRupiah(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error(t.shell.transactionDialog.invalidAmount);
      return;
    }
    if (!accountId) {
      toast.error(t.shell.transactionDialog.selectAccountFirst);
      return;
    }
    if (txType === "transfer") {
      if (!toAccountId) {
        toast.error(t.shell.transactionDialog.selectDestAccountFirst);
        return;
      }
      if (toAccountId === accountId) {
        toast.error(t.shell.transactionDialog.sameAccountError);
        return;
      }
    }
    if (!fgId) {
      toast.error(t.shell.transactionDialog.noFamilyGroup);
      return;
    }

    const adminFeeNum = txType === "transfer" ? parseRupiah(adminFee) : 0;

    createMutation.mutate(
      {
        accountId,
        ...(categoryId ? { categoryId } : {}),
        amount: amountNum,
        type: txType,
        ...(description ? { description } : {}),
        occurredAt: new Date(date).toISOString(),
        ...(txType === "transfer" ? { toAccountId } : {}),
        ...(adminFeeNum > 0 ? { adminFee: adminFeeNum } : {}),
      },
      {
        // EPIC-023 Task D (D3/D9, US-FAM-14) — reviewed foundation
        // exception: this dialog is a protected shell file, but the held
        // response can only be branched on here, where the mutation's
        // result actually arrives. Minimal diff: a row-scoped member's
        // over-threshold expense was NOT posted — it must show an honest
        // "held pending approval" message, never the success toast.
        onSuccess: (result) => {
          const wasHeld =
            !!result && typeof result === "object" && "held" in result;
          toast[wasHeld ? "warning" : "success"](
            wasHeld
              ? t.shell.transactionDialog.heldToast
              : addMore
                ? t.shell.transactionDialog.savedAddMoreToast
                : t.shell.transactionDialog.savedToast,
          );
          if (wasHeld) {
            handleOpenChange(false);
          } else if (addMore) {
            resetForm();
          } else {
            handleOpenChange(false);
          }
        },
      },
    );
  };

  const saveOcr = () => {
    handleOpenChange(false);
    toast.success(t.shell.transactionDialog.ocrSavedToast);
  };

  return (
    <Dialog open={txnOpen} onOpenChange={handleOpenChange}>
      {/* EPIC-022 Group G (G1) — `dvh`, not `vh`: this override fully
          replaces the DialogContent default via tailwind-merge, so it must
          carry the same dynamic-viewport unit or it silently reintroduces
          the bug (see components/ui/dialog.tsx). No reason for this
          global, frequently-opened dialog to be exempt from the fix. */}
      <DialogContent
        showCloseButton={view === "form"}
        className="max-h-[90dvh] w-full max-w-[480px] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-[480px]"
      >
        {view === "form" && (
          <div className="p-6">
            <DialogTitle className="mb-5 text-[17px] font-extrabold">
              {t.shell.transactionDialog.title}
            </DialogTitle>

            <div className="mb-[18px] flex gap-2">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-md border border-primary bg-accent px-3.5 py-2.5 text-[12.5px] font-semibold text-primary">
                <SquarePen className="size-4" />{" "}
                {t.shell.transactionDialog.manualInput}
              </button>
              <button
                onClick={startOcr}
                className="relative flex flex-1 items-center justify-center gap-2 rounded-md border bg-background px-3.5 py-2.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Camera className="size-4" />{" "}
                {t.shell.transactionDialog.scanReceipt}
                <span className="rounded-full bg-success px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {t.shell.transactionDialog.newBadge}
                </span>
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-secondary p-1">
              {TABS.map((tabLabel, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setTab(i);
                    setCategoryId("");
                    setToAccountId("");
                    setAdminFee("");
                  }}
                  className={cn(
                    "rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors",
                    tab === i
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tabLabel}
                </button>
              ))}
            </div>

            <Field label={t.shell.transactionDialog.amountLabel}>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  Rp
                </span>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  placeholder="0"
                  className={cn(
                    fieldClass,
                    "pl-[38px] text-xl font-extrabold placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground",
                  )}
                />
              </div>
            </Field>

            <Field label={t.shell.transactionDialog.categoryLabel}>
              <select
                className={fieldClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">
                  {t.shell.transactionDialog.categoryPlaceholder}
                </option>
                {relevantCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            {txType === "transfer" ? (
              <>
                <Field label={t.shell.transactionDialog.sourceAccountLabel}>
                  <select
                    className={fieldClass}
                    value={accountId}
                    onChange={(e) => {
                      const nextAccountId = e.target.value;
                      setAccountId(nextAccountId);
                      // Keep source/destination mutually exclusive: dropping
                      // the now-invalid destination avoids a stale option
                      // hidden by the destination select's own filter.
                      if (toAccountId === nextAccountId) setToAccountId("");
                    }}
                  >
                    <option value="">
                      {t.shell.transactionDialog.sourceAccountPlaceholder}
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.institution ? ` — ${a.institution}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t.shell.transactionDialog.destAccountLabel}>
                  <select
                    className={fieldClass}
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                  >
                    <option value="">
                      {t.shell.transactionDialog.destAccountPlaceholder}
                    </option>
                    {accounts
                      .filter((a) => a.id !== accountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.institution ? ` — ${a.institution}` : ""}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field
                  label={
                    <>
                      {t.shell.transactionDialog.adminFeeLabel}{" "}
                      <span className="font-normal text-muted-foreground">
                        {t.shell.transactionDialog.optionalSuffix}
                      </span>
                    </>
                  }
                >
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                      Rp
                    </span>
                    <input
                      inputMode="numeric"
                      value={adminFee}
                      onChange={(e) =>
                        setAdminFee(formatAmountInput(e.target.value))
                      }
                      placeholder="0"
                      className={cn(fieldClass, "pl-[38px]")}
                    />
                  </div>
                </Field>
              </>
            ) : (
              <Field label={t.shell.transactionDialog.accountLabel}>
                <select
                  className={fieldClass}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">
                    {t.shell.transactionDialog.accountPlaceholder}
                  </option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.institution ? ` — ${a.institution}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label={t.shell.transactionDialog.dateLabel}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass}
              />
            </Field>

            <Field
              label={
                <>
                  {t.shell.transactionDialog.descriptionLabel}{" "}
                  <span className="font-normal text-muted-foreground">
                    {t.shell.transactionDialog.optionalSuffix}
                  </span>
                </>
              }
            >
              <textarea
                rows={2}
                placeholder={t.shell.transactionDialog.descriptionPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={cn(fieldClass, "resize-none")}
              />
            </Field>

            <button
              onClick={() => saveTxn()}
              disabled={createMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
            >
              <Save className="size-4" />{" "}
              {createMutation.isPending
                ? t.shell.transactionDialog.saving
                : t.shell.transactionDialog.saveTransaction}
            </button>
            <button
              onClick={() => saveTxn(true)}
              disabled={createMutation.isPending}
              className="mt-2 mb-2 w-full rounded-md py-2.5 text-[13.5px] font-bold text-primary transition-colors hover:bg-accent disabled:opacity-60"
            >
              {t.shell.transactionDialog.saveAndAddMore}
            </button>
          </div>
        )}

        {view === "ocr-scan" && (
          <div>
            <div className="flex items-center justify-between border-b px-[18px] py-4">
              <div>
                <DialogTitle className="text-[17px] font-extrabold">
                  {t.shell.transactionDialog.scanTitle}
                </DialogTitle>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {t.shell.transactionDialog.scanSubtitle}
                </div>
              </div>
              <button
                onClick={() => toast(t.shell.transactionDialog.flashToast)}
                className="rounded-md bg-slate-900/85 px-3 py-1.5 text-xs font-bold text-white"
              >
                {t.shell.transactionDialog.autoButton}
              </button>
            </div>
            <div className="relative m-[18px] flex aspect-[3/4] items-center justify-center overflow-hidden rounded-[14px] bg-slate-950">
              <Corner className="left-5 top-5 rounded-tl border-l-[3px] border-t-[3px]" />
              <Corner className="right-5 top-5 rounded-tr border-r-[3px] border-t-[3px]" />
              <Corner className="bottom-5 left-5 rounded-bl border-b-[3px] border-l-[3px]" />
              <Corner className="bottom-5 right-5 rounded-br border-b-[3px] border-r-[3px]" />
              {!showReceipt && (
                <div className="animate-scan absolute left-5 right-5 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
              )}
              {showReceipt && (
                <div className="mono w-[68%] rounded-lg bg-white p-4 text-[10px] leading-relaxed text-slate-800 shadow-2xl">
                  <div className="text-center text-[13px] font-extrabold">
                    Alfamart
                  </div>
                  <div className="text-center text-[10px]">
                    ALFAMART PAHLAWAN
                  </div>
                  <div className="mb-1.5 text-center text-[10px] text-slate-500">
                    Jl. Pahlawan Seribu No. 123
                    <br />
                    BSD City, Tangerang Selatan
                  </div>
                  <div className="my-1.5 border-t border-dashed border-slate-300" />
                  <div>18/05/2025 14:32:15</div>
                  <div>No. Struk: 250518143215</div>
                  <div className="my-1.5 border-t border-dashed border-slate-300" />
                  {OCR_ITEMS.map(([n, p]) => (
                    <div key={n} className="flex justify-between">
                      <span className="truncate pr-1">{n}</span>
                      <span>{p.replace("Rp ", "")}</span>
                    </div>
                  ))}
                  <div className="my-1.5 border-t border-dashed border-slate-300" />
                  <div className="flex justify-between font-extrabold text-[11px]">
                    <span>Total Belanja</span>
                    <span>58.000</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/85 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                <span className="size-2 animate-pulse rounded-full bg-green-400" />
                {showReceipt
                  ? t.shell.transactionDialog.scanGuidanceReady
                  : t.shell.transactionDialog.scanGuidanceScanning}
              </div>
            </div>
          </div>
        )}

        {view === "ocr-result" && (
          <div>
            <div className="flex items-center justify-between border-b px-[18px] py-3.5">
              <div>
                <DialogTitle className="text-sm font-extrabold">
                  {t.shell.transactionDialog.resultTitle}
                </DialogTitle>
                <div className="text-[11.5px] text-muted-foreground">
                  {t.shell.transactionDialog.resultSubtitle}
                </div>
              </div>
              <button
                onClick={() => toast(t.shell.transactionDialog.editManualToast)}
                className="flex items-center gap-1.5 text-[12.5px] font-bold text-primary"
              >
                <SquarePen className="size-3.5" />{" "}
                {t.shell.transactionDialog.editManual}
              </button>
            </div>
            <div>
              <OcrRow
                icon="📅"
                label={t.shell.transactionDialog.dateLabel}
                value="18 Mei 2025, 14:32"
                trailing={
                  <ChevronRight className="size-3 text-muted-foreground" />
                }
              />
              <OcrRow
                icon="🏬"
                label={t.shell.transactionDialog.merchantLabel}
                value="Alfamart Pahlawan"
                trailing={
                  <ChevronRight className="size-3 text-muted-foreground" />
                }
              />
              <OcrRow
                icon="🏷️"
                label={t.shell.transactionDialog.categoryLabel}
                value="🛒 Belanja"
                trailing={
                  <ChevronRight className="size-3 text-muted-foreground" />
                }
              />
              <OcrRow
                icon="💵"
                label={t.shell.transactionDialog.totalLabel}
                value={<span className="text-destructive">Rp 58.000</span>}
                trailing={
                  <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-[3px] text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <Check className="size-3" />{" "}
                    {t.shell.transactionDialog.detectedBadge}
                  </span>
                }
              />
              <button
                onClick={() => setShowItems((s) => !s)}
                className="w-full text-left"
              >
                <OcrRow
                  icon="📋"
                  label={t.shell.transactionDialog.detailItemLabel}
                  value="5 item"
                  trailing={
                    <ChevronDown
                      className={cn(
                        "size-3 text-muted-foreground transition-transform",
                        showItems && "rotate-180",
                      )}
                    />
                  }
                />
              </button>
              {showItems && (
                <div className="bg-secondary px-4 pb-2.5">
                  {OCR_ITEMS.map(([n, p]) => (
                    <div
                      key={n}
                      className="flex justify-between border-b py-1 text-xs last:border-0"
                    >
                      <span>{n}</span>
                      <span className="font-bold">{p}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 px-[18px] py-4">
              <button
                onClick={saveOcr}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong"
              >
                <Save className="size-4" />{" "}
                {t.shell.transactionDialog.saveToTransaction}
              </button>
              <button
                onClick={startOcr}
                className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-[13.5px] font-bold text-primary transition-colors hover:bg-accent"
              >
                <RotateCcw className="size-4" />{" "}
                {t.shell.transactionDialog.scanAgain}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Corner({ className }: { className?: string }) {
  return <div className={cn("absolute size-7 border-white", className)} />;
}

function OcrRow({
  icon,
  label,
  value,
  trailing,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-[14px] py-3 last:border-0">
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-md bg-secondary text-sm">
        {icon}
      </span>
      <div className="flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-[13.5px] font-bold">{value}</div>
      </div>
      {trailing}
    </div>
  );
}
