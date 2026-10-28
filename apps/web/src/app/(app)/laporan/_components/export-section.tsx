import { toastApiError } from "@/hooks/use-api-error";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";
import type {
  ExportJobRequestDto,
  ExportJobStatusDto,
  ExportReportType,
} from "@wealthme/contracts";

/* ───────────────────────── Export Section ───────────────────────── */

export const EXPORT_REPORT_TYPE_IDS: ExportReportType[] = [
  "summary",
  "bank",
  "detail",
  "pnl",
  "balance-sheet",
  "cashflow",
];

/**
 * This selector drives the EXPORT job's report type, not the currently
 * viewed tab — the two can legitimately differ (e.g. exporting a Bank
 * report while reading rsum). It used to default to and stay on "summary"
 * ("Ringkasan") on every tab, which read as if it mirrored the active tab
 * and never changed. Map each tab to its closest export type so switching
 * tabs updates the default sensibly; the user can still override it.
 */
export const EXPORT_TYPE_FOR_TAB: Record<string, ExportReportType> = {
  rbank: "bank",
  rdetail: "detail",
  rpnl: "pnl",
  rbalance: "balance-sheet",
  rasl: "balance-sheet",
  rcashflow: "cashflow",
};

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
      } catch (err) {
        toastApiError(err, t, t.laporan.export.toastExportCreateFailed);
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
