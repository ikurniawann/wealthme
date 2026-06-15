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
import { useShell } from "./shell-context";

const TABS = [
  "📥 Pemasukan",
  "📤 Pengeluaran",
  "↕️ Transfer",
  "💳 Kartu Kredit",
];
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
};
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
  const [view, setView] = useState<View>("form");
  const [tab, setTab] = useState(0);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
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
      apiFetch(`/family-groups/${fgId}/transactions`, {
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
    },
    onError: (err: { message?: string }) => {
      toast.error("Gagal menyimpan: " + (err.message ?? "Coba lagi"));
    },
  });

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const resetForm = () => {
    setAmount("");
    setAccountId("");
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
      toast.error("Jumlah tidak valid");
      return;
    }
    if (!accountId) {
      toast.error("Pilih akun terlebih dahulu");
      return;
    }
    if (!fgId) {
      toast.error("Tidak ada family group aktif");
      return;
    }

    createMutation.mutate(
      {
        accountId,
        ...(categoryId ? { categoryId } : {}),
        amount: amountNum,
        type: txType,
        ...(description ? { description } : {}),
        occurredAt: new Date(date).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success(
            addMore
              ? "Disimpan! Tambah lagi..."
              : "Transaksi berhasil disimpan!",
          );
          if (addMore) {
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
    toast.success("Transaksi Alfamart Rp 58.000 berhasil disimpan!");
  };

  return (
    <Dialog open={txnOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={view === "form"}
        className="max-h-[90vh] w-full max-w-[480px] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-[480px]"
      >
        {view === "form" && (
          <div className="p-6">
            <DialogTitle className="mb-5 text-[17px] font-extrabold">
              Tambah Transaksi
            </DialogTitle>

            <div className="mb-[18px] flex gap-2">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-md border border-primary bg-accent px-3.5 py-2.5 text-[12.5px] font-semibold text-primary">
                <SquarePen className="size-4" /> Input Manual
              </button>
              <button
                onClick={startOcr}
                className="relative flex flex-1 items-center justify-center gap-2 rounded-md border bg-background px-3.5 py-2.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Camera className="size-4" /> Scan Struk
                <span className="rounded-full bg-success px-1.5 py-0.5 text-[9px] font-bold text-white">
                  Baru
                </span>
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-secondary p-1">
              {TABS.map((t, i) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(i);
                    setCategoryId("");
                  }}
                  className={cn(
                    "rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors",
                    tab === i
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <Field label="Jumlah">
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

            <Field label="Kategori">
              <select
                className={fieldClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Pilih kategori...</option>
                {relevantCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Akun">
              <select
                className={fieldClass}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Pilih akun...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.institution ? ` — ${a.institution}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tanggal">
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
                  Deskripsi{" "}
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </>
              }
            >
              <textarea
                rows={2}
                placeholder="Tulis deskripsi..."
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
              {createMutation.isPending ? "Menyimpan..." : "Simpan Transaksi"}
            </button>
            <button
              onClick={() => saveTxn(true)}
              disabled={createMutation.isPending}
              className="mt-2 mb-2 w-full rounded-md py-2.5 text-[13.5px] font-bold text-primary transition-colors hover:bg-accent disabled:opacity-60"
            >
              Simpan &amp; Tambah Lagi
            </button>
          </div>
        )}

        {view === "ocr-scan" && (
          <div>
            <div className="flex items-center justify-between border-b px-[18px] py-4">
              <div>
                <DialogTitle className="text-[17px] font-extrabold">
                  Scan Struk / Bon
                </DialogTitle>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Arahkan kamera ke struk belanja
                </div>
              </div>
              <button
                onClick={() => toast("Flash: Auto")}
                className="rounded-md bg-slate-900/85 px-3 py-1.5 text-xs font-bold text-white"
              >
                ⚡ Auto
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
                  ? "Pastikan semua teks terlihat jelas"
                  : "Memindai struk..."}
              </div>
            </div>
          </div>
        )}

        {view === "ocr-result" && (
          <div>
            <div className="flex items-center justify-between border-b px-[18px] py-3.5">
              <div>
                <DialogTitle className="text-sm font-extrabold">
                  ✨ Hasil Pindai
                </DialogTitle>
                <div className="text-[11.5px] text-muted-foreground">
                  Periksa dan edit data jika diperlukan
                </div>
              </div>
              <button
                onClick={() => toast("Mode edit manual")}
                className="flex items-center gap-1.5 text-[12.5px] font-bold text-primary"
              >
                <SquarePen className="size-3.5" /> Edit Manual
              </button>
            </div>
            <div>
              <OcrRow
                icon="📅"
                label="Tanggal"
                value="18 Mei 2025, 14:32"
                trailing={
                  <ChevronRight className="size-3 text-muted-foreground" />
                }
              />
              <OcrRow
                icon="🏬"
                label="Merchant"
                value="Alfamart Pahlawan"
                trailing={
                  <ChevronRight className="size-3 text-muted-foreground" />
                }
              />
              <OcrRow
                icon="🏷️"
                label="Kategori"
                value="🛒 Belanja"
                trailing={
                  <ChevronRight className="size-3 text-muted-foreground" />
                }
              />
              <OcrRow
                icon="💵"
                label="Total"
                value={<span className="text-destructive">Rp 58.000</span>}
                trailing={
                  <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-[3px] text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <Check className="size-3" /> Terdeteksi
                  </span>
                }
              />
              <button
                onClick={() => setShowItems((s) => !s)}
                className="w-full text-left"
              >
                <OcrRow
                  icon="📋"
                  label="Detail Item"
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
                <Save className="size-4" /> Simpan ke Transaksi
              </button>
              <button
                onClick={startOcr}
                className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-[13.5px] font-bold text-primary transition-colors hover:bg-accent"
              >
                <RotateCcw className="size-4" /> Pindai Ulang
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
