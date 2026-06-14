export type ExportReportType =
  | "summary"
  | "bank"
  | "detail"
  | "pnl"
  | "balance-sheet"
  | "cashflow";

export type ExportFormat = "pdf" | "excel";

export type ExportJobStatus = "pending" | "processing" | "done" | "failed";

export interface ExportJobRequestDto {
  type: ExportReportType;
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
  months?: number;
}

export interface ExportJobStatusDto {
  id: string;
  status: ExportJobStatus;
  downloadUrl?: string;
  errorMessage?: string;
}
