"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";

import { jakartaToday } from "./asuransi-model";
import { PreviewResult, confirmable } from "./report-preview";
import {
  DOCUMENT_MAX_BYTES,
  ReportPdfError,
  extractInsuranceReportText,
  useInsuranceDocuments,
  useInsuranceReport,
  type InsuranceReportError,
} from "./use-insurance-report";

import type {
  ConfirmInsuranceReportItemDto,
  InsuranceDocumentDto,
  InsuranceDto,
  InsuranceReportPreviewDto,
  InsuranceReportValuationDraftDto,
} from "@wealthme/contracts";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];

function toItem(
  d: InsuranceReportValuationDraftDto,
): ConfirmInsuranceReportItemDto {
  const pick = <K extends keyof InsuranceReportValuationDraftDto>(k: K) =>
    d[k] != null ? { [k]: d[k] } : {};
  return {
    ...(d.fundId
      ? { fundId: d.fundId }
      : d.fund
        ? { newFundName: d.fund }
        : {}),
    ...pick("currency"),
    ...pick("units"),
    ...pick("navPerUnit"),
    ...pick("navDate"),
    ...pick("unitsDate"),
    ...pick("reportedValue"),
    ...pick("cashValue"),
    ...pick("surrenderEstimate"),
    ...pick("maturityBenefit"),
    ...pick("page"),
    ...pick("snippet"),
    effectiveDate: d.effectiveDate!,
  } as ConfirmInsuranceReportItemDto;
}

/**
 * Unggah laporan — stores a company report on a policy (StoragePort, S8) and,
 * when the family AI key is set and the file is a text PDF, reads it: each
 * field with its page, snippet and status. Only clean value drafts can be
 * confirmed here; anything flagged is edited in the policy form (Task 25).
 */
export function ReportDialog({
  policies,
  initialPolicyId,
  onClose,
}: {
  policies: InsuranceDto[];
  initialPolicyId: string | null;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3;
  const [policyId, setPolicyId] = useState(
    initialPolicyId ?? policies[0]?.id ?? "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [password, setPassword] = useState("");
  const [doc, setDoc] = useState<InsuranceDocumentDto | null>(null);
  const [preview, setPreview] = useState<InsuranceReportPreviewDto | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const docs = useInsuranceDocuments(policyId || null);
  const report = useInsuranceReport();
  const isPdf = file?.type === "application/pdf";

  function pickFile(f: File | null) {
    setError(null);
    setDoc(null);
    setPreview(null);
    if (f && !ACCEPTED.includes(f.type)) return setError(c.reportBadType);
    if (f && f.size > DOCUMENT_MAX_BYTES) return setError(c.reportTooBig);
    setFile(f);
  }

  function upload() {
    if (!file || !policyId) return;
    setError(null);
    docs.upload.mutate(
      { file, ...(reportDate && { reportDate }) },
      {
        onSuccess: (d) => {
          setDoc(d);
          toast.success(c.reportUploaded);
        },
        onError: (err) => setError(apiErrorMessage(err, c.reportFailed)),
      },
    );
  }

  async function read() {
    if (!file || !doc) return;
    setError(null);
    setReading(true);
    try {
      const pages = await extractInsuranceReportText(
        file,
        password || undefined,
      );
      const res = await report.preview.mutateAsync({
        pages,
        insuranceId: policyId,
        documentId: doc.id,
        fileName: file.name,
      });
      setPreview(res);
    } catch (err) {
      setError(readError(err));
    } finally {
      setReading(false);
    }
  }

  function readError(err: unknown): string {
    if (err instanceof ReportPdfError) {
      if (err.reason === "pdf-no-text-layer") return c.aiErrNoText;
      if (
        err.reason === "pdf-password-required" ||
        err.reason === "pdf-wrong-password"
      )
        return c.aiErrPassword;
      return c.aiErrGeneric;
    }
    const code = (err as InsuranceReportError | null)?.code;
    if (code === "INSURANCE_REPORT_NO_TEXT_LAYER") return c.aiErrNoText;
    if (code === "INSURANCE_AI_TIMEOUT") return c.aiErrTimeout;
    if (code === "INSURANCE_AI_RATE_LIMITED") return c.aiErrRate;
    return apiErrorMessage(err, c.aiErrGeneric);
  }

  const drafts = preview?.valuations ?? [];
  const ready = drafts.length > 0 && drafts.every(confirmable);
  function confirm() {
    if (!preview || !ready) return;
    report.confirm.mutate(
      {
        insuranceId: policyId,
        body: { ...(doc && { documentId: doc.id }), items: drafts.map(toItem) },
      },
      {
        onSuccess: (res) => {
          toast.success(
            res.supersededIds.length ? c.aiSuperseded : c.aiConfirmed,
          );
          onClose();
        },
        onError: (err) => setError(apiErrorMessage(err, c.aiErrGeneric)),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog--wide ins3-report-dialog">
        <DialogTitle>{c.reportTitle}</DialogTitle>
        <DialogDescription>{c.reportDesc}</DialogDescription>
        <DialogBody className="ins3-form">
          {policies.length === 0 ? (
            <p className="ins3-state">{c.reportNoPolicies}</p>
          ) : (
            <>
              <div className="field mt-0">
                <label className="label" htmlFor="ins3-rep-policy">
                  {c.reportPolicy}
                </label>
                <select
                  id="ins3-rep-policy"
                  className="select"
                  value={policyId}
                  disabled={Boolean(doc)}
                  onChange={(e) => setPolicyId(e.target.value)}
                >
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ins3-pay-when">
                <div className="field">
                  <label className="label" htmlFor="ins3-rep-file">
                    {c.reportFile}
                  </label>
                  <input
                    id="ins3-rep-file"
                    className="input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    disabled={Boolean(doc)}
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="ins3-rep-date">
                    {c.reportDate}
                  </label>
                  <input
                    id="ins3-rep-date"
                    className="input"
                    type="date"
                    max={jakartaToday()}
                    value={reportDate}
                    disabled={Boolean(doc)}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                </div>
              </div>

              <section className="ins3-ai" aria-labelledby="ins3-ai-title">
                <p id="ins3-ai-title" className="ins3-callout-title">
                  {c.aiTitle}
                </p>
                <p className="hint">{c.aiBody}</p>
                {!report.aiAvailable && !report.aiStatusLoading ? (
                  <p className="hint">
                    {c.aiNoKey}{" "}
                    <Link href={report.settingsHref} className="ins3-link">
                      {c.aiSetKey}
                    </Link>
                  </p>
                ) : file && !isPdf ? (
                  <p className="hint">{c.aiPdfOnly}</p>
                ) : (
                  doc &&
                  isPdf && (
                    <div className="ins3-ai-run">
                      <input
                        className="input"
                        type="password"
                        autoComplete="off"
                        aria-label={c.aiPassword}
                        placeholder={c.aiPassword}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn--outline"
                        disabled={reading}
                        onClick={() => void read()}
                      >
                        {reading ? c.aiRunning : c.aiRun}
                      </button>
                    </div>
                  )
                )}
                {preview && (
                  <PreviewResult
                    preview={preview}
                    ready={ready}
                    locale={locale}
                  />
                )}
              </section>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            {t.common.close}
          </button>
          {preview ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!ready || report.confirm.isPending}
              onClick={confirm}
            >
              {report.confirm.isPending ? c.aiConfirming : c.aiConfirm}
            </button>
          ) : (
            !doc && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!file || !policyId || docs.upload.isPending}
                onClick={upload}
              >
                {docs.upload.isPending ? c.reportUploading : c.reportUpload}
              </button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
