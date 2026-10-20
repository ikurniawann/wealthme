"use client";

/**
 * Asuransi S8 — "Baca laporan dengan AI" + policy documents, for the page
 * (Task 24) and the form/detail (Task 25).
 *
 * Mirrors the statement-PDF reader: the PDF's TEXT LAYER is extracted in the
 * browser (pdfjs, lazily loaded; the file and any password never reach the
 * AI endpoint), sent page by page to `POST …/insurances/report-preview`,
 * which answers with strings + page + snippet and deterministic drafts.
 * Nothing is stored until `confirm` — and only what the user confirmed.
 *
 * Without a family AI key the read is unavailable (`aiAvailable: false`):
 * the button must be disabled with a link to `AI_KEY_SETTINGS_HREF`, and
 * manual entry stays available. A scan with no text layer is refused here
 * (`pdf-no-text-layer`) before any paid call.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  extractStatementPdfText,
  StatementPdfError,
  type StatementPdfFailure,
} from "@/hooks/statement-pdf";
import { useAiKeyStatus } from "@/hooks/use-ai-key";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";

import type {
  ConfirmInsuranceReportDto,
  ConfirmInsuranceReportResultDto,
  InsuranceDocumentDto,
  InsuranceReportErrorCode,
  InsuranceReportPreviewDto,
} from "@wealthme/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Where the family's AI key is set (Akun → Pengaturan AI). */
export const AI_KEY_SETTINGS_HREF = "/akun";

/** Same bounds as the API DTO (MAX_REPORT_PAGES / MAX_REPORT_TOTAL_CHARS). */
export const REPORT_MAX_PAGES = 30;
export const REPORT_MAX_TEXT_CHARS = 120_000;
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

/** The read can take most of the API's 55s provider budget. */
const PREVIEW_TIMEOUT_MS = 60_000;

export type ReportPdfFailure = StatementPdfFailure;
export { StatementPdfError as ReportPdfError };

export type ReportPage = { page: number; text: string };

/**
 * Extracts the text layer per page (1-based page numbers kept, blank pages
 * dropped). Throws `ReportPdfError` with `pdf-password-required`,
 * `pdf-wrong-password`, `pdf-too-many-pages`, `pdf-text-too-large`,
 * `pdf-no-text-layer` ("tidak bisa dibaca") or `pdf-corrupt`.
 */
export async function extractInsuranceReportText(
  file: File,
  password?: string,
): Promise<ReportPage[]> {
  const { pages } = await extractStatementPdfText(file, password, {
    maxPages: REPORT_MAX_PAGES,
    maxTextChars: REPORT_MAX_TEXT_CHARS,
  });
  return pages
    .map((text, i) => ({ page: i + 1, text }))
    .filter((p) => p.text.trim().length > 0);
}

/** A typed failure the UI can branch on (`code`), with the API's message. */
export type InsuranceReportError = ApiError & {
  code?: InsuranceReportErrorCode | string;
};

export function insuranceDocumentsKey(
  familyGroupId: string | null,
  insuranceId: string | null,
) {
  return ["insurances", familyGroupId, insuranceId, "documents"] as const;
}

export function useInsuranceReport() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  const queryClient = useQueryClient();
  const ai = useAiKeyStatus();

  const preview = useMutation<
    InsuranceReportPreviewDto,
    InsuranceReportError,
    {
      pages: ReportPage[];
      insuranceId?: string;
      documentId?: string;
      fileName?: string;
    }
  >({
    mutationFn: (body) =>
      apiFetch<InsuranceReportPreviewDto>(
        `/family-groups/${familyGroupId}/insurances/report-preview`,
        {
          method: "POST",
          token,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
        },
      ),
  });

  const confirm = useMutation<
    ConfirmInsuranceReportResultDto,
    InsuranceReportError,
    { insuranceId: string; body: ConfirmInsuranceReportDto }
  >({
    mutationFn: ({ insuranceId, body }) =>
      apiFetch<ConfirmInsuranceReportResultDto>(
        `/family-groups/${familyGroupId}/insurances/${insuranceId}/valuations/confirm`,
        { method: "POST", token, body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["insurances"] });
    },
  });

  return {
    /** A key is configured — the AI read may be offered. */
    aiAvailable: ai.configured,
    aiStatusLoading: ai.isLoading,
    settingsHref: AI_KEY_SETTINGS_HREF,
    preview,
    confirm,
  };
}

export function useInsuranceDocuments(insuranceId: string | null) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  const queryClient = useQueryClient();
  const key = insuranceDocumentsKey(familyGroupId, insuranceId);
  const base = `/family-groups/${familyGroupId}/insurances/${insuranceId}/documents`;

  const list = useQuery<InsuranceDocumentDto[]>({
    queryKey: key,
    queryFn: () => apiFetch<InsuranceDocumentDto[]>(base, { token }),
    enabled: Boolean(familyGroupId && token && insuranceId),
  });

  const upload = useMutation<
    InsuranceDocumentDto,
    InsuranceReportError,
    { file: File; reportDate?: string }
  >({
    mutationFn: async ({ file, reportDate }) => {
      // Multipart bypasses apiFetch's JSON Content-Type (browser sets the
      // boundary), same as asset documents.
      const form = new FormData();
      form.append("file", file);
      if (reportDate) form.append("reportDate", reportDate);
      const res = await fetch(`${API_URL}${base}`, {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          code?: string;
        };
        throw {
          status: res.status,
          message: body.message ?? res.statusText,
          code: body.code,
        } satisfies InsuranceReportError;
      }
      return (await res.json()) as InsuranceDocumentDto;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation<void, InsuranceReportError, string>({
    mutationFn: (documentId) =>
      apiFetch<void>(`${base}/${documentId}`, { method: "DELETE", token }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  });

  /** Fetches the bytes with the bearer token and opens them in a new tab. */
  async function open(documentId: string): Promise<void> {
    const res = await fetch(`${API_URL}${base}/${documentId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      throw {
        status: res.status,
        message: res.statusText,
      } satisfies InsuranceReportError;
    }
    const url = URL.createObjectURL(await res.blob());
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return { list, upload, remove, open };
}
