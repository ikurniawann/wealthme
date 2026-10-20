"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type {
  AssetClass,
  AssetOverviewRowDto,
  AssetsOverviewDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { CLASSES, fillCopy } from "./aset-model";
import {
  AcquiredText,
  AssetMark,
  AssetName,
  ChangeCell,
  QtyText,
  RowMenu,
  TypeChip,
  ValueCell,
  type RowAction,
} from "./aset-row-parts";

export function ClassTabs({
  value,
  onChange,
}: {
  value: "" | AssetClass;
  onChange: (v: "" | AssetClass) => void;
}) {
  const { t } = useLocale();
  const c = t.aset.v3;
  const tabs: { key: "" | AssetClass; label: string }[] = [
    { key: "", label: c.tabAll },
    ...CLASSES.map((k) => ({ key: k, label: c.classes[k] })),
  ];
  return (
    <div className="as3-tabs" role="tablist" aria-label={c.tabsAria}>
      {tabs.map((tab) => (
        <button
          key={tab.key || "all"}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Owner({ row }: { row: AssetOverviewRowDto }) {
  const { t } = useLocale();
  return <>{row.ownerName ?? t.aset.v3.shared}</>;
}

function SkeletonRows() {
  return (
    <div className="as3-skel-list" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="as3-skel as3-skel--row" />
      ))}
    </div>
  );
}

export function AsetList({
  data,
  isLoading,
  isError,
  isFiltered,
  canManage,
  onRetry,
  onAdd,
  onAction,
  onPage,
}: {
  data: AssetsOverviewDto | undefined;
  isLoading: boolean;
  isError: boolean;
  isFiltered: boolean;
  canManage: boolean;
  onRetry: () => void;
  onAdd: () => void;
  onAction: (action: RowAction, row: AssetOverviewRowDto) => void;
  onPage: (page: number) => void;
}) {
  const { t } = useLocale();
  const c = t.aset.v3;
  if (isError && !data) {
    return (
      <div className="as3-state" role="alert">
        <p>{c.loadError}</p>
        <button type="button" className="btn btn--outline" onClick={onRetry}>
          {c.retry}
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div aria-busy="true">
        <span className="sr-only">{c.loading}</span>
        <SkeletonRows />
      </div>
    );
  }
  const rows = data.rows;
  if (!rows.length) {
    return (
      <div className="as3-state">
        <p>{isFiltered ? c.noResults : c.empty}</p>
        {!isFiltered && canManage && (
          <button type="button" className="btn btn--primary" onClick={onAdd}>
            <Plus aria-hidden="true" /> {c.emptyCta}
          </button>
        )}
      </div>
    );
  }
  const { page, limit, total, totalPages } = data.meta;
  const from = (page - 1) * limit + 1;
  return (
    <div className="as3-list" aria-busy={isLoading}>
      <div className="as3-table-wrap">
        <table className="as3-table">
          <thead>
            <tr>
              <th scope="col">{c.colAsset}</th>
              <th scope="col">{c.colType}</th>
              <th scope="col">
                {c.colOwner} / {c.colPlace.toLowerCase()}
              </th>
              <th scope="col">{c.colQty}</th>
              <th scope="col" className="as3-col-acq">
                {c.colAcquired}
              </th>
              <th scope="col" className="as3-num">
                {c.colValue}
              </th>
              <th scope="col">{c.colChange}</th>
              <th scope="col" className="as3-col-act">
                <span className="sr-only">{c.colActions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-row-id={row.id}>
                <td>
                  <div className="as3-asset">
                    <AssetMark row={row} />
                    <AssetName row={row} />
                  </div>
                </td>
                <td>
                  <TypeChip row={row} />
                </td>
                <td className="as3-owner">
                  <Owner row={row} />
                  {row.custodian && <small>{row.custodian}</small>}
                </td>
                <td className="as3-qty">
                  <QtyText row={row} />
                </td>
                <td className="as3-col-acq as3-acq">
                  <AcquiredText row={row} />
                </td>
                <td className="as3-num">
                  <ValueCell row={row} />
                </td>
                <td>
                  <ChangeCell row={row} />
                </td>
                <td className="as3-col-act">
                  <RowMenu
                    row={row}
                    canManage={canManage}
                    onAction={onAction}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="as3-cards">
        {rows.map((row) => (
          <li key={row.id} className="as3-cardrow" data-row-id={row.id}>
            <div className="as3-cardrow-head">
              <AssetMark row={row} />
              <AssetName row={row} />
              <RowMenu row={row} canManage={canManage} onAction={onAction} />
            </div>
            <div className="as3-cardrow-value">
              <ValueCell row={row} />
              <ChangeCell row={row} />
            </div>
            <dl className="as3-cardrow-meta">
              <div>
                <dt>{c.colType}</dt>
                <dd>
                  <TypeChip row={row} />
                </dd>
              </div>
              <div>
                <dt>{c.colOwner}</dt>
                <dd>
                  <Owner row={row} />
                </dd>
              </div>
              {row.quantity != null && (
                <div>
                  <dt>{c.colQty}</dt>
                  <dd>
                    <QtyText row={row} />
                  </dd>
                </div>
              )}
              {row.acquisition.date && (
                <div>
                  <dt>{c.colAcquired}</dt>
                  <dd className="as3-acq">
                    <AcquiredText row={row} />
                  </dd>
                </div>
              )}
              {row.custodian && (
                <div>
                  <dt>{c.colPlace}</dt>
                  <dd>{row.custodian}</dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>

      <nav className="as3-pagination" aria-label={c.paginationAria}>
        <span>
          {fillCopy(c.showing, {
            from,
            to: from + rows.length - 1,
            total,
          })}
        </span>
        {totalPages > 1 && (
          <div>
            <button
              type="button"
              className="btn btn--outline btn--icon"
              aria-label={c.prev}
              title={c.prev}
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <span>{fillCopy(c.pageOf, { page, pages: totalPages })}</span>
            <button
              type="button"
              className="btn btn--outline btn--icon"
              aria-label={c.next}
              title={c.next}
              disabled={page >= totalPages}
              onClick={() => onPage(page + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
