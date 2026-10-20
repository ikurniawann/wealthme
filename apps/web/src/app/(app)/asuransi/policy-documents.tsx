"use client";

import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";

import { formatDay, jakartaToday } from "./asuransi-model";
import {
  DOCUMENT_MAX_BYTES,
  useInsuranceDocuments,
} from "./use-insurance-report";

import type { InsuranceDocumentDto } from "@wealthme/contracts";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];

function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Policy documents (S8): list, open (bearer fetch → new tab), upload
 * (pdf/jpg/png ≤ 5 MB, optional report date) and delete with confirmation.
 * Files are sensitive: access is checked by the API (tenant + S9).
 */
export function PolicyDocuments({ insuranceId }: { insuranceId: string }) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3.form;
  const docs = useInsuranceDocuments(insuranceId);
  const [file, setFile] = useState<File | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<InsuranceDocumentDto | null>(null);
  const inputId = `ins3-doc-file-${insuranceId}`;

  function pick(f: File | null) {
    setError(null);
    if (f && !ACCEPTED.includes(f.type))
      return setError(t.asuransi.v3.reportBadType);
    if (f && f.size > DOCUMENT_MAX_BYTES)
      return setError(t.asuransi.v3.reportTooBig);
    setFile(f);
  }

  function upload() {
    if (!file) return;
    docs.upload.mutate(
      { file, ...(reportDate && { reportDate }) },
      {
        onSuccess: () => {
          toast.success(t.asuransi.v3.reportUploaded);
          setFile(null);
          setReportDate("");
        },
        onError: (err) =>
          setError(apiErrorMessage(err, t.asuransi.v3.reportFailed)),
      },
    );
  }

  const rows = docs.list.data ?? [];
  return (
    <div className="ins3-docs">
      {docs.list.isLoading ? (
        <p className="ins3-state" role="status">
          {t.asuransi.v3.loading}
        </p>
      ) : docs.list.isError ? (
        <p className="error-text" role="alert">
          {c.docsError}
        </p>
      ) : rows.length === 0 ? (
        <p className="hint">{c.docsEmpty}</p>
      ) : (
        <ul className="ins3-doc-list">
          {rows.map((d) => (
            <li key={d.id}>
              <FileText aria-hidden="true" />
              <button
                type="button"
                className="ins3-link ins3-doc-name"
                onClick={() =>
                  void docs
                    .open(d.id)
                    .catch(() => toast.error(c.docsOpenFailed))
                }
              >
                {d.fileName}
              </button>
              <small>
                {sizeLabel(d.size)}
                {d.reportDate
                  ? ` · ${c.docsReportDate} ${formatDay(d.reportDate, locale)}`
                  : ""}{" "}
                · {c.docsUploaded} {formatDay(d.createdAt, locale)}
              </small>
              <button
                type="button"
                className="ins3f-icon-btn"
                aria-label={`${c.docsDelete} ${d.fileName}`}
                onClick={() => setDeleting(d)}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="ins3-doc-upload">
        <div className="field mt-0">
          <label className="label" htmlFor={inputId}>
            {c.docsAdd}
          </label>
          <input
            id={inputId}
            type="file"
            className="input"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="field mt-0">
          <label className="label" htmlFor={`${inputId}-date`}>
            {t.asuransi.v3.reportDate}
          </label>
          <input
            id={`${inputId}-date`}
            type="date"
            className="input"
            max={jakartaToday()}
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn--outline"
          disabled={!file || docs.upload.isPending}
          onClick={upload}
        >
          {docs.upload.isPending
            ? t.asuransi.v3.reportUploading
            : t.asuransi.v3.reportUpload}
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <ConfirmDeleteDialog
        label={deleting ? `"${deleting.fileName}"` : null}
        title={c.docsDeleteTitle}
        body={c.docsDeleteBody}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          docs.remove.mutate(deleting.id, {
            onSuccess: () => toast.success(c.docsDeleted),
            onError: (err) =>
              toast.error(apiErrorMessage(err, c.docsDeleteFailed)),
            onSettled: () => setDeleting(null),
          });
        }}
      />
    </div>
  );
}
