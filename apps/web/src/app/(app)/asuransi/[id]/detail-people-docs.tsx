"use client";

import { useLocale } from "@/hooks/use-locale";

import { fillCopy, formatDay } from "../asuransi-model";
import { PolicyDocuments } from "../policy-documents";

import type {
  InsuranceDto,
  InsurancePaymentDto,
  InsuranceValuationDto,
} from "@wealthme/contracts";

/** Penerima manfaat — relationship + share; sum ≤ 100 (validated on save), < 100 warned. */
export function BeneficiariesTab({
  policy: p,
  memberName,
  onEdit,
}: {
  policy: InsuranceDto;
  memberName: (id: string | null) => string | null;
  onEdit: () => void;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3.detail;
  const rows = p.beneficiaries;
  const total = rows.reduce((s, b) => s + (Number(b.sharePercent) || 0), 0);
  const rounded = Math.round(total * 100) / 100;
  return (
    <section className="ins3-card" aria-labelledby="ins3d-benef">
      <div className="ins3-card-head">
        <h2 id="ins3d-benef" className="ins3-h2">
          {c.beneficiariesTitle}
        </h2>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={onEdit}
        >
          {c.editBeneficiaries}
        </button>
      </div>
      <p className="ins3-muted">{c.beneficiariesNote}</p>
      {rows.length === 0 ? (
        <p className="ins3-state">{c.beneficiariesEmpty}</p>
      ) : (
        <>
          <ul className="ins3d-payments">
            {rows.map((b) => (
              <li key={b.id}>
                <div>
                  <strong>{memberName(b.memberUserId) ?? b.name}</strong>
                  <small>{b.relationship || "—"}</small>
                </div>
                <div>
                  <span className="ins3-amount">
                    {Number(b.sharePercent).toLocaleString("id-ID", {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </span>
                </div>
                <small>
                  {b.memberUserId ? c.familyMember : c.outsideFamily}
                </small>
              </li>
            ))}
          </ul>
          <p
            className="ins3-chip"
            data-tone={rounded === 100 ? "good" : "warn"}
            role="status"
          >
            {rounded === 100
              ? c.sharesFull
              : fillCopy(c.sharesPartial, {
                  pct: rounded.toLocaleString("id-ID"),
                })}
          </p>
        </>
      )}
    </section>
  );
}

/** Dokumen & riwayat — files + the policy's own record trail. */
export function DocsTab({
  policy: p,
  payments,
  valuations,
}: {
  policy: InsuranceDto;
  payments: InsurancePaymentDto[];
  valuations: InsuranceValuationDto[];
}) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3.detail;
  const events = [
    { at: p.createdAt, label: c.evCreated },
    ...(p.updatedAt.slice(0, 16) !== p.createdAt.slice(0, 16)
      ? [{ at: p.updatedAt, label: c.evUpdated }]
      : []),
    ...payments.map((x) => ({ at: x.createdAt, label: c.evPayment })),
    ...valuations.map((v) => ({ at: v.createdAt, label: c.evValuation })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="ins3d-stack">
      <section className="ins3-card" aria-labelledby="ins3d-docs">
        <h2 id="ins3d-docs" className="ins3-h2">
          {c.docsTitle}
        </h2>
        <p className="ins3-muted">{c.docsSub}</p>
        <PolicyDocuments insuranceId={p.id} />
      </section>
      <section className="ins3-card" aria-labelledby="ins3d-log">
        <h2 id="ins3d-log" className="ins3-h2">
          {c.logTitle}
        </h2>
        <p className="ins3-muted">{c.logSub}</p>
        <ul className="ins3d-timeline">
          {events.slice(0, 30).map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span>{e.label}</span>
              <small>{formatDay(e.at, locale, "long")}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
