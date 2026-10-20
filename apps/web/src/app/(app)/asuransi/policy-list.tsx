"use client";

import { useState, type ReactNode } from "react";

import { useLocale } from "@/hooks/use-locale";

import { PAGE_SIZE, fillCopy } from "./asuransi-model";
import {
  DueCell,
  KindAndType,
  MainBenefit,
  People,
  PolicyMark,
  PolicyName,
  Premium,
  RowActions,
  StatusPill,
  type PolicyAction,
} from "./policy-row-parts";

import type { InsuranceDto } from "@wealthme/contracts";

type Props = {
  rows: InsuranceDto[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isFiltered: boolean;
  onRetry: () => void;
  onAction: (action: PolicyAction, policy: InsuranceDto) => void;
  filterBar: ReactNode;
};

function PolicyTable({ rows, onAction }: Pick<Props, "rows" | "onAction">) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  return (
    <div className="ins3-table-wrap">
      <table className="ins3-table">
        <thead>
          <tr>
            <th scope="col">{c.colPolicy}</th>
            <th scope="col">{c.colTypes}</th>
            <th scope="col">{c.colPeople}</th>
            <th scope="col">{c.colPremium}</th>
            <th scope="col">{c.colBenefit}</th>
            <th scope="col">{c.colDue}</th>
            <th scope="col">{c.colStatus}</th>
            <th scope="col">
              <span className="sr-only">{c.colActions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} data-policy-id={p.id}>
              <td>
                <span className="ins3-policy">
                  <PolicyMark policy={p} />
                  <PolicyName policy={p} onOpen={() => onAction("detail", p)} />
                </span>
              </td>
              <td>
                <KindAndType
                  policy={p}
                  onComplete={() => onAction("edit", p)}
                />
              </td>
              <td>
                <People policy={p} onComplete={() => onAction("edit", p)} />
              </td>
              <td>
                <Premium policy={p} />
              </td>
              <td>
                <MainBenefit policy={p} />
              </td>
              <td>
                <DueCell
                  policy={p}
                  onConfirm={() => onAction("confirmDue", p)}
                />
              </td>
              <td>
                <StatusPill policy={p} />
              </td>
              <td className="ins3-col-act">
                <RowActions policy={p} onAction={onAction} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Phone + tablet: one card per policy, nothing hidden behind a swipe. */
function PolicyCards({ rows, onAction }: Pick<Props, "rows" | "onAction">) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  return (
    <ul className="ins3-cards">
      {rows.map((p) => (
        <li key={p.id} className="ins3-cardrow" data-policy-id={p.id}>
          <div className="ins3-cardrow-head">
            <PolicyMark policy={p} />
            <PolicyName policy={p} onOpen={() => onAction("detail", p)} />
            <StatusPill policy={p} />
          </div>
          <dl className="ins3-cardrow-grid">
            <div>
              <dt>{c.colTypes}</dt>
              <dd>
                <KindAndType
                  policy={p}
                  onComplete={() => onAction("edit", p)}
                />
              </dd>
            </div>
            <div>
              <dt>{c.colPeople}</dt>
              <dd>
                <People policy={p} onComplete={() => onAction("edit", p)} />
              </dd>
            </div>
            <div>
              <dt>{c.colPremium}</dt>
              <dd>
                <Premium policy={p} />
              </dd>
            </div>
            <div>
              <dt>{c.colBenefit}</dt>
              <dd>
                <MainBenefit policy={p} />
              </dd>
            </div>
            <div className="ins3-cardrow-due">
              <dt>{c.colDue}</dt>
              <dd>
                <DueCell
                  policy={p}
                  onConfirm={() => onAction("confirmDue", p)}
                />
              </dd>
            </div>
          </dl>
          <RowActions policy={p} onAction={onAction} />
        </li>
      ))}
    </ul>
  );
}

export function PolicyList({
  rows,
  total,
  isLoading,
  isError,
  isFiltered,
  onRetry,
  onAction,
  filterBar,
}: Props) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visible = rows.slice(0, limit);
  const remaining = rows.length - visible.length;

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div className="ins3-skeleton" role="status" aria-label={c.loading}>
        <span className="ins3-bone" />
        <span className="ins3-bone" />
        <span className="ins3-bone" />
      </div>
    );
  } else if (isError) {
    body = (
      <div className="ins3-state" role="alert">
        <p>{c.error}</p>
        <button type="button" className="btn btn--outline" onClick={onRetry}>
          {c.retry}
        </button>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <p className="ins3-state">{isFiltered ? c.emptyFiltered : c.empty}</p>
    );
  } else {
    body = (
      <>
        <PolicyTable rows={visible} onAction={onAction} />
        <PolicyCards rows={visible} onAction={onAction} />
        {remaining > 0 && (
          <button
            type="button"
            className="btn btn--outline ins3-more"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
          >
            {fillCopy(c.showMore, { n: Math.min(remaining, PAGE_SIZE) })}
          </button>
        )}
      </>
    );
  }

  return (
    <section
      className="ins3-card ins3-list"
      id="ins3-list"
      aria-labelledby="ins3-list-title"
    >
      <div className="ins3-list-head">
        <div>
          <h2 id="ins3-list-title" className="ins3-h2">
            {c.listTitle}
          </h2>
          {!isLoading && !isError && (
            <small aria-live="polite">
              {fillCopy(c.listCount, { n: rows.length, total })}
            </small>
          )}
        </div>
        {filterBar}
      </div>
      {body}
    </section>
  );
}
