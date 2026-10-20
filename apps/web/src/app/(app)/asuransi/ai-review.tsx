"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { canonicalToTyping, toCanonicalAmount } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import { apiErrorMessage } from "@/lib/api-error";

import { fillCopy, formatNative } from "./asuransi-model";
import {
  DOCUMENT_MAX_BYTES,
  ReportPdfError,
  extractInsuranceReportText,
  useInsuranceReport,
  type InsuranceReportError,
} from "./use-insurance-report";

import type {
  InsuranceReportFieldDto,
  InsuranceReportFieldKey,
  InsuranceReportPreviewDto,
  InsuranceReportValuationDraftDto,
} from "@wealthme/contracts";

/** Keys whose value is money (edited id-ID style, sent as a decimal). */
const MONEY_KEYS: InsuranceReportFieldKey[] = [
  "premiumAmount",
  "sumAssured",
  "policyValue",
  "cashValue",
  "surrenderValue",
  "maturityBenefit",
  "fundUnits",
  "fundNav",
  "fundValue",
];
const DATE_KEYS: InsuranceReportFieldKey[] = [
  "coverageStartDate",
  "coverageEndDate",
  "nextPremiumDueDate",
  "reportDate",
  "fundNavDate",
  "fundUnitsDate",
];

export type ReviewedField = {
  key: InsuranceReportFieldKey;
  fund: string | null;
  value: string;
  page: number;
  snippet: string;
};

export type AiApplyPayload = {
  fields: ReviewedField[];
  drafts: InsuranceReportValuationDraftDto[];
  file: File;
};

type Row = {
  field: InsuranceReportFieldDto;
  text: string;
  use: boolean;
};

function initialText(f: InsuranceReportFieldDto): string {
  const v = f.normalized ?? f.value;
  if (MONEY_KEYS.includes(f.key) && f.normalized)
    return canonicalToTyping(f.normalized, 4);
  return v;
}

function finalValue(r: Row): string {
  if (MONEY_KEYS.includes(r.field.key)) return toCanonicalAmount(r.text) ?? "";
  return r.text.trim();
}

/**
 * "Baca laporan dengan AI" (S8). Without a family AI key the button is
 * disabled with the reason and a link to set the key — manual entry stays
 * available. The review step lists every field with its page, snippet and
 * status; the user edits, unticks and applies. Applying only fills the form:
 * nothing is stored until the policy is saved.
 */
export function AiReadButton({
  insuranceId,
  onApply,
}: {
  insuranceId: string | null;
  onApply: (p: AiApplyPayload) => void;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3.form;
  const report = useInsuranceReport();
  const [open, setOpen] = useState(false);
  const disabled = !report.aiAvailable;
  return (
    <div className="ins3f-ai">
      <button
        type="button"
        className="btn btn--outline ins3f-ai-btn"
        disabled={disabled}
        aria-describedby="ins3f-ai-hint"
        onClick={() => setOpen(true)}
      >
        <Upload aria-hidden="true" /> {c.aiButton}
      </button>
      <p id="ins3f-ai-hint" className="hint">
        {report.aiStatusLoading
          ? c.aiChecking
          : disabled
            ? c.aiNoKey
            : c.aiHint}{" "}
        {disabled && !report.aiStatusLoading && (
          <Link href={report.settingsHref} className="ins3-link">
            {t.asuransi.v3.aiSetKey}
          </Link>
        )}
      </p>
      {open && (
        <AiReviewDialog
          insuranceId={insuranceId}
          onClose={() => setOpen(false)}
          onApply={(p) => {
            onApply(p);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AiReviewDialog({
  insuranceId,
  onClose,
  onApply,
}: {
  insuranceId: string | null;
  onClose: () => void;
  onApply: (p: AiApplyPayload) => void;
}) {
  const { t, locale } = useLocale();
  const v3 = t.asuransi.v3;
  const c = v3.form;
  const report = useInsuranceReport();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<InsuranceReportPreviewDto | null>(
    null,
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [useDraft, setUseDraft] = useState<boolean[]>([]);

  function pick(f: File | null) {
    setError(null);
    setPreview(null);
    if (f && f.type !== "application/pdf") return setError(v3.aiPdfOnly);
    if (f && f.size > DOCUMENT_MAX_BYTES) return setError(v3.reportTooBig);
    setFile(f);
  }

  async function read() {
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const pages = await extractInsuranceReportText(
        file,
        password || undefined,
      );
      const res = await report.preview.mutateAsync({
        pages,
        fileName: file.name,
        ...(insuranceId && { insuranceId }),
      });
      setPreview(res);
      setRows(
        res.fields.map((f) => ({
          field: f,
          text: initialText(f),
          use: f.status === "ai_extracted",
        })),
      );
      setUseDraft(
        res.valuations.map((d) => d.status === "ai_extracted" && !d.warning),
      );
    } catch (err) {
      setError(readError(err));
    } finally {
      setReading(false);
    }
  }

  function readError(err: unknown): string {
    if (err instanceof ReportPdfError) {
      if (err.reason === "pdf-no-text-layer") return v3.aiErrNoText;
      if (
        err.reason === "pdf-password-required" ||
        err.reason === "pdf-wrong-password"
      )
        return v3.aiErrPassword;
      return v3.aiErrGeneric;
    }
    const code = (err as InsuranceReportError | null)?.code;
    if (code === "INSURANCE_REPORT_NO_TEXT_LAYER") return v3.aiErrNoText;
    if (code === "INSURANCE_AI_TIMEOUT") return v3.aiErrTimeout;
    if (code === "INSURANCE_AI_RATE_LIMITED") return v3.aiErrRate;
    return apiErrorMessage(err, v3.aiErrGeneric);
  }

  function apply() {
    if (!file || !preview) return;
    onApply({
      file,
      fields: rows
        .filter((r) => r.use && finalValue(r))
        .map((r) => ({
          key: r.field.key,
          fund: r.field.fund,
          value: finalValue(r),
          page: r.field.page,
          snippet: r.field.snippet,
        })),
      drafts: preview.valuations.filter((_, i) => useDraft[i]),
    });
  }

  const chosen =
    rows.filter((r) => r.use).length + useDraft.filter(Boolean).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dialog--wide ins3f-ai-dialog">
        <DialogTitle>{c.aiReviewTitle}</DialogTitle>
        <DialogDescription>{c.aiReviewDesc}</DialogDescription>
        <DialogBody className="ins3-form">
          {!preview && (
            <div className="ins3f-ai-pick">
              <div className="field mt-0">
                <label className="label" htmlFor="ins3f-ai-file">
                  {c.aiFile}
                </label>
                <input
                  id="ins3f-ai-file"
                  type="file"
                  className="input"
                  accept=".pdf,application/pdf"
                  onChange={(e) => pick(e.target.files?.[0] ?? null)}
                />
                <p className="hint">{c.aiFileHint}</p>
              </div>
              <div className="field mt-0">
                <label className="label" htmlFor="ins3f-ai-pass">
                  {v3.aiPassword}
                </label>
                <input
                  id="ins3f-ai-pass"
                  type="password"
                  className="input"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}
          {preview && (
            <>
              {!preview.complete && preview.missing.length > 0 && (
                <p className="ins3-callout" role="status">
                  {fillCopy(v3.aiMissing, {
                    fields: preview.missing
                      .map(
                        (m) =>
                          `${v3.fieldKeys[m.key]}${m.fund ? ` (${m.fund})` : ""}`,
                      )
                      .join(", "),
                  })}
                </p>
              )}
              {rows.length === 0 ? (
                <p className="hint">{c.aiNoFields}</p>
              ) : (
                <ul className="ins3f-review" aria-label={v3.aiFieldsTitle}>
                  {rows.map((r, i) => (
                    <ReviewRow
                      key={`${r.field.key}-${r.field.fund ?? ""}-${i}`}
                      row={r}
                      onChange={(patch) =>
                        setRows(
                          rows.map((x, j) =>
                            j === i ? { ...x, ...patch } : x,
                          ),
                        )
                      }
                    />
                  ))}
                </ul>
              )}
              <p className="ins3-callout-title">{v3.aiDrafts}</p>
              {preview.valuations.length === 0 ? (
                <p className="hint">{v3.aiNoDrafts}</p>
              ) : (
                <ul className="ins3f-review">
                  {preview.valuations.map((d, i) => (
                    <li
                      key={`${d.fund ?? "policy"}-${i}`}
                      className="ins3f-review-row"
                    >
                      <label className="ins3f-review-use">
                        <input
                          type="checkbox"
                          checked={useDraft[i] ?? false}
                          onChange={(e) =>
                            setUseDraft(
                              useDraft.map((u, j) =>
                                j === i ? e.target.checked : u,
                              ),
                            )
                          }
                        />
                        <span>{d.fund ?? v3.fieldKeys.policyValue}</span>
                      </label>
                      <strong className="ins3-amount">
                        {formatNative(
                          d.computedValue ?? d.reportedValue ?? d.cashValue,
                          d.currency ?? "IDR",
                          locale,
                        )}
                      </strong>
                      <small>
                        {d.units && d.navPerUnit
                          ? `${d.units} × ${d.navPerUnit} · `
                          : ""}
                        {d.effectiveDate ?? "—"}
                        {d.page
                          ? ` · ${fillCopy(v3.aiPage, { n: d.page })}`
                          : ""}
                      </small>
                      <span
                        className="ins3-chip"
                        data-tone={
                          d.status === "ai_extracted" && !d.warning
                            ? "sky"
                            : "warn"
                        }
                      >
                        {d.warning
                          ? c.aiWarning[d.warning]
                          : v3.aiStatus[d.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint">{c.aiApplyHint}</p>
            </>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            {t.common.cancel}
          </button>
          {preview ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={chosen === 0}
              onClick={apply}
            >
              {fillCopy(c.aiApply, { n: chosen })}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!file || reading}
              onClick={() => void read()}
            >
              {reading ? v3.aiRunning : v3.aiRun}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({
  row,
  onChange,
}: {
  row: Row;
  onChange: (patch: Partial<Row>) => void;
}) {
  const { t } = useLocale();
  const v3 = t.asuransi.v3;
  const c = v3.form;
  const f = row.field;
  const id = `ins3f-rev-${f.key}-${f.fund ?? "p"}-${f.page}`;
  const isDate = DATE_KEYS.includes(f.key);
  return (
    <li className="ins3f-review-row">
      <label className="ins3f-review-use">
        <input
          type="checkbox"
          checked={row.use}
          onChange={(e) => onChange({ use: e.target.checked })}
        />
        <span>
          {v3.fieldKeys[f.key]}
          {f.fund ? ` · ${f.fund}` : ""}
        </span>
      </label>
      <input
        id={id}
        className="input ins3f-input"
        aria-label={`${v3.fieldKeys[f.key]} — ${c.aiValue}`}
        type={isDate ? "date" : "text"}
        inputMode={MONEY_KEYS.includes(f.key) ? "decimal" : undefined}
        value={row.text}
        onChange={(e) => onChange({ text: e.target.value, use: true })}
      />
      <small>
        {fillCopy(v3.aiPage, { n: f.page })} · “{f.snippet}”
      </small>
      <span
        className="ins3-chip"
        data-tone={f.status === "ai_extracted" ? "sky" : "warn"}
      >
        {v3.aiStatus[f.status]}
        {f.conflict ? ` · ${c.aiConflict[f.conflict]}` : ""}
      </span>
    </li>
  );
}
