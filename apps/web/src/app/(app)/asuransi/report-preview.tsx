"use client";

import { useLocale } from "@/hooks/use-locale";

import { fillCopy, formatNative } from "./asuransi-model";

import type {
  InsuranceReportPreviewDto,
  InsuranceReportValuationDraftDto,
} from "@wealthme/contracts";

/** A draft can be confirmed as-is only when it is clean and dated. */
export function confirmable(d: InsuranceReportValuationDraftDto): boolean {
  return (
    d.status === "ai_extracted" &&
    !d.warning &&
    Boolean(d.effectiveDate) &&
    Boolean(d.computedValue ?? d.reportedValue ?? d.cashValue)
  );
}

/** What the AI read (page + snippet + status) and the value drafts. */
export function PreviewResult({
  preview,
  ready,
  locale,
}: {
  preview: InsuranceReportPreviewDto;
  ready: boolean;
  locale: string;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  return (
    <div className="ins3-ai-result">
      <p className="ins3-callout-title">{c.aiFieldsTitle}</p>
      <ul className="ins3-ai-fields">
        {preview.fields.map((f, i) => (
          <li key={`${f.key}-${f.fund ?? ""}-${i}`}>
            <span>
              {c.fieldKeys[f.key]}
              {f.fund ? ` · ${f.fund}` : ""}
            </span>
            <strong>{f.value}</strong>
            <small>
              {fillCopy(c.aiPage, { n: f.page })} · “{f.snippet}”
            </small>
            <span
              className="ins3-chip"
              data-tone={f.status === "ai_extracted" ? "sky" : "warn"}
            >
              {c.aiStatus[f.status]}
            </span>
          </li>
        ))}
      </ul>
      {!preview.complete && preview.missing.length > 0 && (
        <p className="hint" role="status">
          {fillCopy(c.aiMissing, {
            fields: preview.missing
              .map(
                (m) => `${c.fieldKeys[m.key]}${m.fund ? ` (${m.fund})` : ""}`,
              )
              .join(", "),
          })}
        </p>
      )}
      <p className="ins3-callout-title">{c.aiDrafts}</p>
      {preview.valuations.length === 0 ? (
        <p className="hint">{c.aiNoDrafts}</p>
      ) : (
        <ul className="ins3-ai-fields">
          {preview.valuations.map((d, i) => (
            <li key={`${d.fund ?? "policy"}-${i}`}>
              <span>{d.fund ?? c.fieldKeys.policyValue}</span>
              <strong className="ins3-amount">
                {formatNative(
                  d.computedValue ?? d.reportedValue ?? d.cashValue,
                  d.currency ?? "IDR",
                  locale,
                )}
              </strong>
              <small>{d.effectiveDate ?? "—"}</small>
              <span
                className="ins3-chip"
                data-tone={confirmable(d) ? "sky" : "warn"}
              >
                {c.aiStatus[d.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">{ready ? c.aiEditHint : c.aiConfirmBlocked}</p>
    </div>
  );
}
