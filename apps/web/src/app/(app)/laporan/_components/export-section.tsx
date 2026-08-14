import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";
import type {
  ExportJobRequestDto,
  ExportJobStatusDto,
  ExportReportType,
} from "@wealthme/contracts";

/* ───────────────────────── Export Section ───────────────────────── */

const EXPORT_REPORT_TYPE_IDS: ExportReportType[] = [
  "summary",
  "bank",
  "detail",
  "pnl",
  "balance-sheet",
  "cashflow",
];

/**
 * EPIC-025 N3-J1 — export job logic extracted from `ExportSection` into a
 * hook so the prototype's header "Excel"/"PDF" buttons (gap 1) can trigger
 * the SAME real export job as the detailed export card below the tabs,
 * instead of a second, disconnected implementation. Behaviour is unchanged
 * from the original `ExportSection` — only the state moved up one level.
 */
export function useExportJob({
  familyGroupId,
  accessToken,
  startDate,
  endDate,
}: {
  familyGroupId: string;
  accessToken: string | undefined;
  /** Selected /laporan period bounds — threaded into the export job so the
   * downloaded report reflects the same period the user is viewing. */
  startDate: string;
  endDate: string;
}) {
  const { t } = useLocale();
  const [reportType, setReportType] = useState<ExportReportType>("summary");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<ExportJobStatusDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollStatus = useCallback(
    async (id: string) => {
      if (!familyGroupId || !accessToken) return;
      try {
        const res = await apiFetch<ExportJobStatusDto>(
          `/family-groups/${familyGroupId}/exports/${id}`,
          { token: accessToken },
        );
        setStatus(res);
        if (res.status === "done" || res.status === "failed") {
          stopPolling();
          if (res.status === "done") {
            toast.success(t.laporan.export.toastExportDone);
          } else {
            toast.error(
              `${t.laporan.export.toastExportFailedPrefix} ${res.errorMessage ?? t.laporan.export.unknownErrorFallback}`,
            );
          }
        }
      } catch {
        stopPolling();
        toast.error(t.laporan.export.toastFetchStatusFailed);
      }
    },
    [familyGroupId, accessToken, stopPolling, t],
  );

  const startExport = useCallback(
    async (format: "pdf" | "excel") => {
      if (!familyGroupId || !accessToken) {
        toast.error(t.laporan.export.toastInvalidSession);
        return;
      }
      stopPolling();
      setIsSubmitting(true);
      setJobId(null);
      setStatus(null);

      const reqBody: ExportJobRequestDto = {
        type: reportType,
        format,
        startDate,
        endDate,
      };

      try {
        const res = await apiFetch<ExportJobStatusDto>(
          `/family-groups/${familyGroupId}/exports`,
          {
            token: accessToken,
            method: "POST",
            body: JSON.stringify(reqBody),
          },
        );
        setJobId(res.id);
        setStatus(res);
        toast(
          `${t.laporan.export.creatingExportPrefix} ${format.toUpperCase()}${t.laporan.export.creatingExportSuffix}`,
        );

        pollRef.current = setInterval(() => {
          void pollStatus(res.id);
        }, 2000);
      } catch {
        toast.error(t.laporan.export.toastExportCreateFailed);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      familyGroupId,
      accessToken,
      reportType,
      startDate,
      endDate,
      stopPolling,
      pollStatus,
      t,
    ],
  );

  const handleDownload = useCallback(() => {
    if (!status?.downloadUrl) return;
    const url = status.downloadUrl;
    if (!url.startsWith("data:") && !url.startsWith("https://")) {
      // invalid scheme — do not set href
      return;
    }
    const mimeToExt: Record<string, string> = {
      "data:text/csv": "csv",
      "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
      "data:application/pdf": "pdf",
      "data:text/plain": "txt",
    };
    const prefix = Object.keys(mimeToExt).find((k) => url.startsWith(k));
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${reportType}.${prefix ? mimeToExt[prefix] : "bin"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [status, reportType]);

  const isActive =
    status && status.status !== "done" && status.status !== "failed";
  const isDone = status?.status === "done";

  return {
    reportType,
    setReportType,
    jobId,
    status,
    isSubmitting,
    startExport,
    handleDownload,
    isActive,
    isDone,
  };
}

/* ───────────────────────── Export Section ───────────────────────── */

type ExportJobState = ReturnType<typeof useExportJob>;

export function ExportSection({ exportJob }: { exportJob: ExportJobState }) {
  const { t } = useLocale();
  const {
    reportType,
    setReportType,
    jobId,
    status,
    isSubmitting,
    startExport,
    handleDownload,
    isActive,
    isDone,
  } = exportJob;

  return (
    <div className="rounded-[12px] border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-bold">{t.laporan.export.title}</div>
        {isDone && status?.downloadUrl && (
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
          >
            <Download className="size-3.5" /> {t.laporan.export.downloadButton}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">
            {t.laporan.export.reportTypeLabel}
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ExportReportType)}
            disabled={!!isActive || isSubmitting}
            className="rounded-md border bg-background px-3 py-[7px] text-[13px] outline-none focus:border-primary disabled:opacity-50"
          >
            {EXPORT_REPORT_TYPE_IDS.map((id) => (
              <option key={id} value={id}>
                {t.laporan.export.reportTypeLabels[id]}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => void startExport("pdf")}
          disabled={!!isActive || isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-3.5" /> {t.laporan.export.pdfButton}
        </button>
        <button
          onClick={() => void startExport("excel")}
          disabled={!!isActive || isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileSpreadsheet className="size-3.5" /> {t.laporan.export.csvButton}
        </button>
      </div>
      {status && (
        <div className="mt-3 flex items-center gap-2 text-[12px]">
          <span className="text-muted-foreground">
            {t.laporan.export.statusLabel}
          </span>
          <span
            className={
              status.status === "done"
                ? "font-semibold text-success"
                : status.status === "failed"
                  ? "font-semibold text-destructive"
                  : "font-semibold text-primary"
            }
          >
            {status.status === "pending" && t.laporan.export.statusPending}
            {status.status === "processing" &&
              t.laporan.export.statusProcessing}
            {status.status === "done" && t.laporan.export.statusDone}
            {status.status === "failed" &&
              `${t.laporan.export.statusFailedPrefix} ${status.errorMessage ?? ""}`}
          </span>
          {jobId && <span className="text-muted-foreground">#{jobId}</span>}
        </div>
      )}
    </div>
  );
}
