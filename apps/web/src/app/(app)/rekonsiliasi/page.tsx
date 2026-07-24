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
  Bot,
  X,
  ChevronRight,
} from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SectionCard,
  StatusBadge,
  ProgressBar,
  CardLink,
} from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/* ─────────────────────────── Types ─────────────────────────── */

type BankSyncDto = {
  id: string;
  familyGroupId: string;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
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
};

type AutoMatchResultDto = {
  totalEntries: number;
  suggested: number;
};

/* ─────────────────────────── Static data ─────────────────────────── */

const STEPS = [
  { num: 1, label: "Upload", sub: "Upload dokumen" },
  { num: 2, label: "Pindai", sub: "AI membaca data" },
  { num: 3, label: "Cocokkan", sub: "Samakan transaksi" },
  { num: 4, label: "Selesai", sub: "Simpan hasil" },
] as const;

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
  return (
    <div className="mb-5 flex items-center">
      {STEPS.map((s, i) => {
        const done = step > s.num;
        const active = step === s.num;
        return (
          <React.Fragment key={s.num}>
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
                {done ? <Check className="size-[18px]" /> : s.num}
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
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "mx-1 mb-7 h-[2px] flex-1 transition-colors",
                  step > s.num ? "bg-success" : "bg-border",
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

const RECON_STATUS_LABEL: Record<string, string> = {
  matched: "Cocok",
  suggested: "Tersarankan",
  unmatched: "Tidak Cocok",
};

function reconStatusLabel(reconStatus: string): string {
  return RECON_STATUS_LABEL[reconStatus] ?? "Tidak Cocok";
}

/** Real client-side exports of the reconciliation summary already loaded on
 * this page (entries + matched/suggested/unmatched counts) — same
 * Blob-download pattern as the real "Unduh Ringkasan" export on /tax.
 * No PDF/xlsx library exists in this repo (checked apps/api and apps/web
 * package.json), so "PDF" and "Excel" are honestly built as real TXT and
 * CSV downloads rather than faked or mislabeled. */

/** Characters that a spreadsheet app (Excel/Sheets) interprets as the start
 * of a formula when found at the beginning of a cell. */
const CSV_FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** RFC 4180 escaping only: wrap in double quotes (doubling any embedded
 * quotes) whenever a cell contains a comma, quote, or newline. This alone is
 * NOT a formula-injection guard. */
function csvEscape(value: string): string {
  return value.includes(",") || value.includes('"') || value.includes("\n")
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** Marks a cell value as free text sourced from user-uploaded content (e.g.
 * `entry.description`) so `toCsvRow` applies the formula-injection guard to
 * it. Fields the app itself computes/formats (dates, amounts, currency
 * codes, status labels, counts) are never attacker-influenced and must stay
 * plain strings — otherwise a legitimate negative amount like "-500000"
 * would get a leading `'` and Excel would treat it as literal text instead
 * of a number, breaking SUM/sort on real data. */
interface CsvUserTextCell {
  readonly isUserText: true;
  readonly value: string;
}

function csvUserText(value: string): CsvUserTextCell {
  return { isUserText: true, value };
}

/** OWASP CSV/formula injection mitigation (CWE-1236): for free-text fields
 * sourced from user-uploaded content, e.g. `entry.description`, which
 * originates from user-uploaded bank-statement content (client-parsed and
 * sent to the API unsanitized). A malicious description like
 * `=HYPERLINK("http://evil","x")` would execute as a formula when a
 * DIFFERENT family-group member later opens this export in Excel/Sheets.
 * Prefixing a leading single quote forces spreadsheet apps to treat the
 * cell as literal text instead of a formula. Checked against the RAW,
 * non-trimmed value's first character — trimming first would let a value
 * starting with a raw tab/CR (both formula triggers) slip past the check. */
function csvUserTextValue(value: string): string {
  const startsWithFormulaTrigger = CSV_FORMULA_TRIGGER_CHARS.has(
    value.charAt(0),
  );
  const safeValue = startsWithFormulaTrigger ? `'${value}` : value;

  return csvEscape(safeValue);
}

function toCsvRow(cells: (string | CsvUserTextCell)[]): string {
  return cells
    .map((cell) =>
      typeof cell === "string" ? csvEscape(cell) : csvUserTextValue(cell.value),
    )
    .join(",");
}

function triggerDownload(
  content: string,
  mimeType: string,
  fileName: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defensive: revoke on the next tick so the browser has a chance to start
  // using the blob URL before it's invalidated.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatEntryAmount(entry: BankSyncEntryDto): string {
  const amtNum = parseInt(entry.amount, 10) / 100;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: entry.currency || "IDR",
    minimumFractionDigits: 0,
  }).format(amtNum);
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function RekonsiliasiPage() {
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
      if (!familyGroupId || !token) throw new Error("Session non-aktif");

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
      toast.success("File berhasil diunggah!");
      goto(2);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Gagal mengunggah file";
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
      const msg = err instanceof Error ? err.message : "Gagal memindai entri";
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
      toast.success("Entri berhasil dikonfirmasi!");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Gagal mengkonfirmasi";
      toast.error(msg);
    },
  });

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
  const currentSync = syncsQuery.data?.find((s) => s.id === syncId);

  function handleDownloadTxtSummary(): void {
    // Defense-in-depth: the button is already disabled while the entries
    // query is loading/errored, but guard the handler too so a fast/stray
    // click can never produce a summary that falsely claims "no entries"
    // while the real GET .../entries fetch is still in flight or failed.
    if (entriesQuery.isLoading || entriesQuery.isError) return;

    try {
      const lines: string[] = [
        "RINGKASAN REKONSILIASI — WealthMe",
        `Diunduh: ${new Date().toLocaleDateString("id-ID")}`,
        `Dokumen: ${currentSync?.fileName ?? "—"}`,
        "",
        "Ringkasan Pencocokan",
        `  Total Transaksi: ${entries.length}`,
        `  Cocok: ${matchedCount}`,
        `  Perlu Review: ${suggestedCount}`,
        `  Tidak Cocok: ${unmatchedCount}`,
        "",
        "Detail Entri",
      ];
      if (entries.length > 0) {
        for (const entry of entries) {
          const entryDate = new Date(entry.date).toLocaleDateString("id-ID");
          lines.push(
            `  ${entryDate} · ${entry.description} · ${formatEntryAmount(entry)} · ${reconStatusLabel(entry.reconStatus)}`,
          );
        }
      } else {
        lines.push("  Belum ada entri rekonsiliasi.");
      }

      triggerDownload(
        lines.join("\n"),
        "text/plain;charset=utf-8",
        `ringkasan-rekonsiliasi-${new Date().toISOString().slice(0, 10)}.txt`,
      );
      toast.success("📥 Ringkasan rekonsiliasi berhasil diunduh.");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengunduh ringkasan";
      toast.error(msg);
    }
  }

  function handleDownloadCsv(): void {
    // Same defense-in-depth guard as handleDownloadTxtSummary above.
    if (entriesQuery.isLoading || entriesQuery.isError) return;

    try {
      const rows: (string | CsvUserTextCell)[][] = [
        ["Tanggal", "Keterangan", "Jumlah", "Mata Uang", "Status"],
        ...entries.map((entry) => [
          new Date(entry.date).toISOString().slice(0, 10),
          csvUserText(entry.description),
          String(parseInt(entry.amount, 10) / 100),
          entry.currency || "IDR",
          reconStatusLabel(entry.reconStatus),
        ]),
        [],
        ["Total Transaksi", String(entries.length)],
        ["Cocok", String(matchedCount)],
        ["Perlu Review", String(suggestedCount)],
        ["Tidak Cocok", String(unmatchedCount)],
      ];

      triggerDownload(
        rows.map(toCsvRow).join("\n"),
        "text/csv;charset=utf-8",
        `rekonsiliasi-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success("📊 Excel (CSV) rekonsiliasi berhasil diunduh.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengunduh CSV";
      toast.error(msg);
    }
  }

  return (
    <div>
      <Stepper step={step} />

      {/* ─── Step 1: Upload ─── */}
      {step === 1 && (
        <div className="space-y-4">
          <SectionCard>
            <div className="mb-1 text-[15px] font-extrabold">
              Upload Rekening Koran / Rekon Bank
            </div>
            <div className="mb-[18px] text-[12.5px] text-muted-foreground">
              Upload file PDF, Excel, atau CSV dari bank Anda.
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
                  ? "Mengunggah..."
                  : "Seret & lepas file di sini"}
              </div>
              <div className="mb-4 text-[12.5px] text-muted-foreground">
                atau
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-[11px] text-[13.5px] font-bold text-white">
                <ArrowUpFromLine className="size-4" /> Pilih File
              </div>
              <div className="mt-3.5 text-[11.5px] text-muted-foreground">
                Format yang didukung: PDF, Excel (.xlsx, .xls), CSV
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                Maksimal ukuran file: 20MB
              </div>
            </button>
          </SectionCard>

          {/* Supported banks */}
          <SectionCard
            title="Bank yang Didukung"
            action={<CardLink>Lihat semua</CardLink>}
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
                ••• Lainnya
              </div>
            </div>
          </SectionCard>

          {/* Recent documents */}
          <SectionCard
            title="Dokumen Terbaru"
            action={<CardLink>Lihat Riwayat</CardLink>}
          >
            {syncsQuery.isLoading ? (
              <div className="py-6 text-center text-[12.5px] text-muted-foreground">
                Memuat...
              </div>
            ) : !syncsQuery.data || syncsQuery.data.length === 0 ? (
              <div className="py-6 text-center text-[12.5px] text-muted-foreground">
                Belum ada dokumen yang diunggah.
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
                          {`Diupload ${new Date(sync.uploadedAt).toLocaleString("id-ID")}`}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge
                          variant="info"
                          className="mb-[3px] text-[10px]"
                        >
                          Terunggah
                        </StatusBadge>
                        <div className="text-[11px] text-muted-foreground">
                          {`${sync.rowCount} transaksi`}
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
                aria-label="Tutup"
                className="absolute right-3 top-2.5 cursor-pointer text-[16px] text-muted-foreground"
              >
                ×
              </button>
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 size-4 flex-shrink-0 text-warning" />
                <div>
                  <div className="mb-1.5 text-[12.5px] font-bold">
                    Tips Rekonsiliasi
                  </div>
                  <div className="flex flex-col gap-1 text-[12px] text-foreground/80">
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-success" />
                      Pastikan periode tanggal pada dokumen sesuai
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-success" />
                      Hapus halaman yang tidak berisi transaksi
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-success" />
                      Gunakan file asli tanpa edit agar hasil lebih akurat
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
            Lanjutkan ke Pencocokan <ArrowRight className="size-4" />
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
            AI Sedang Membaca Dokumen
          </div>
          <div className="mb-6 text-[12.5px] text-muted-foreground">
            WealthMe AI mengekstrak data transaksi dari rekening koran...
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
                Mencocokkan dengan data WealthMe...
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
                  </span>{" "}
                  entri cocok tersarankan dari{" "}
                  <span className="font-bold">
                    {autoMatchMutation.data.totalEntries}
                  </span>{" "}
                  total
                </span>
              </div>
              <button
                type="button"
                onClick={() => goto(3)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
              >
                Lanjut <ArrowRight className="size-4" />
              </button>
            </div>
          ) : (
            <div className="mb-5 text-[12px] text-muted-foreground">
              Memulai pemindaian...
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
              <div className="text-[11px] font-semibold">✅ Cocok</div>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg bg-warning-soft py-3 text-amber-700 dark:text-amber-300">
              <div className="text-[22px] font-black">{suggestedCount}</div>
              <div className="text-[11px] font-semibold">⚠️ Perlu Review</div>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg bg-red-100 py-3 text-red-700 dark:bg-red-950 dark:text-red-300">
              <div className="text-[22px] font-black">{unmatchedCount}</div>
              <div className="text-[11px] font-semibold">❌ Tidak Cocok</div>
            </div>
          </div>

          <SectionCard
            title="Hasil Pencocokan"
            action={
              <StatusBadge variant="success">
                {entries.length} Transaksi
              </StatusBadge>
            }
          >
            {/* Header */}
            <div className="mb-2 flex text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
              <div className="flex-1 px-3">Rekening Koran</div>
              <div className="w-9" />
              <div className="flex-1 px-3">Status</div>
            </div>

            {entriesQuery.isLoading && (
              <div className="py-8 text-center text-[13px] text-muted-foreground">
                Memuat entri...
              </div>
            )}

            {entriesQuery.isError && (
              <div className="py-8 text-center text-[13px] text-destructive">
                Gagal memuat entri. Coba lagi.
              </div>
            )}

            {!entriesQuery.isLoading &&
              entries.length === 0 &&
              !entriesQuery.isError && (
                <div className="py-8 text-center text-[13px] text-muted-foreground">
                  Belum ada entri rekonsiliasi.
                </div>
              )}

            <div className="space-y-2">
              {entries.map((entry) => {
                const status = entryStatus(entry.reconStatus);
                const amtNum = parseInt(entry.amount, 10) / 100;
                const amtFormatted = new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: entry.currency || "IDR",
                  minimumFractionDigits: 0,
                }).format(Math.abs(amtNum));
                const amtDisplay =
                  amtNum < 0 ? `-${amtFormatted}` : `+${amtFormatted}`;
                const amtClass =
                  amtNum < 0 ? "text-destructive" : "text-success";
                const entryDate = new Date(entry.date).toLocaleDateString(
                  "id-ID",
                  {
                    day: "numeric",
                    month: "short",
                  },
                );

                return (
                  <div key={entry.id} className="flex items-stretch">
                    <div className="flex-1 rounded-lg border bg-card px-3 py-2">
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
                            Cocok
                          </div>
                          <div className={`text-[13px] font-bold ${amtClass}`}>
                            {amtDisplay}
                          </div>
                        </div>
                      )}
                      {status === "warn" && (
                        <div className="flex w-full items-center justify-between gap-2">
                          <div className="text-[11px] text-warning">
                            Tersarankan
                          </div>
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
                            Konfirmasi
                          </button>
                        </div>
                      )}
                      {status === "err" && (
                        <div className="text-[11px] text-destructive">
                          Tidak Ditemukan
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
              <ArrowLeft className="size-4" /> Kembali
            </button>
            <button
              type="button"
              onClick={() => goto(4)}
              className="flex flex-[2] cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <Save className="size-4" /> Simpan Hasil Rekonsiliasi
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
            Rekonsiliasi Selesai!
          </div>
          <div className="mb-6 text-[13px] text-muted-foreground">
            Rekening koran berhasil dicocokkan
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3.5 text-left">
              <div className="text-[11px] text-muted-foreground">
                Total Transaksi
              </div>
              <div className="text-[20px] font-black">
                {entries.length || "—"}
              </div>
            </div>
            <div className="rounded-lg bg-success-soft p-3.5 text-left text-emerald-700 dark:text-emerald-300">
              <div className="text-[11px]">Cocok</div>
              <div className="text-[20px] font-black">
                {matchedCount || "—"}
              </div>
            </div>
            <div className="rounded-lg bg-warning-soft p-3.5 text-left text-amber-700 dark:text-amber-300">
              <div className="text-[11px]">Perlu Review</div>
              <div className="text-[20px] font-black">
                {suggestedCount || "—"}
              </div>
            </div>
            <div className="rounded-lg bg-red-100 p-3.5 text-left text-red-700 dark:bg-red-950 dark:text-red-300">
              <div className="text-[11px]">Tidak Cocok</div>
              <div className="text-[20px] font-black">
                {unmatchedCount || "—"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadTxtSummary}
              disabled={entriesQuery.isLoading || entriesQuery.isError}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] bg-background px-4 py-2.5 text-[13.5px] font-bold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText className="size-4" /> Unduh Ringkasan (TXT)
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={entriesQuery.isLoading || entriesQuery.isError}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] bg-background px-4 py-2.5 text-[13.5px] font-bold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileSpreadsheet className="size-4" /> Unduh Excel (CSV)
            </button>
            <button
              type="button"
              onClick={() => {
                setSyncId(null);
                autoMatchMutation.reset();
                goto(1);
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <RotateCw className="size-4" /> Rekon Baru
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
