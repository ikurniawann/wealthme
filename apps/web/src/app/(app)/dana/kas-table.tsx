"use client";

import {
  AlertCircle,
  CheckCircle2,
  HandCoins,
  MoreHorizontal,
  Pencil,
  Scale,
  Trash2,
  Users,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fill } from "@/i18n/rekening-v3";

import { BrandTile, maskedId } from "./kas-brand";
import { formatNative, type KasRow } from "./kas-model";
import { MASK } from "./kas-summary";
import { walletCountry } from "./wallet-directory";

export interface KasRowActions {
  canManage: boolean;
  isMasterLike: boolean;
  onEdit: (row: KasRow) => void;
  onReconcile: (row: KasRow) => void;
  onRequest: (row: KasRow) => void;
  onDelete: (row: KasRow) => void;
}

function dayLabel(iso: string, locale: "id" | "en"): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RowMenu({ row, actions }: { row: KasRow; actions: KasRowActions }) {
  const { t } = useLocale();
  const c = t.dana.v3.page;
  const canReconcile = actions.canManage && row.idr !== null;
  const canRequest = !actions.isMasterLike && row.account.ownerUserId === null;
  if (!actions.canManage && !canRequest) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="kw-more"
            aria-label={fill(c.rowMenu, { name: row.account.name })}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.canManage && (
          <DropdownMenuItem onClick={() => actions.onEdit(row)}>
            <Pencil aria-hidden="true" /> {c.edit}
          </DropdownMenuItem>
        )}
        {canReconcile && (
          <DropdownMenuItem onClick={() => actions.onReconcile(row)}>
            <Scale aria-hidden="true" /> {c.reconcile}
          </DropdownMenuItem>
        )}
        {canRequest && (
          <DropdownMenuItem onClick={() => actions.onRequest(row)}>
            <HandCoins aria-hidden="true" /> {c.request}
          </DropdownMenuItem>
        )}
        {actions.canManage && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => actions.onDelete(row)}
          >
            <Trash2 aria-hidden="true" /> {c.remove}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CheckedCell({ row }: { row: KasRow }) {
  const { t, locale } = useLocale();
  const c = t.dana.v3.page;
  if (!row.checkedAt) {
    return (
      <span className="kw-checked" data-state="stale">
        <AlertCircle aria-hidden="true" /> {c.never}
        <i className="kw-chip" data-tone="warn">
          {c.checkBalance}
        </i>
      </span>
    );
  }
  return (
    <span className="kw-checked" data-state={row.stale ? "stale" : "fresh"}>
      {row.stale ? (
        <AlertCircle aria-hidden="true" />
      ) : (
        <CheckCircle2 aria-hidden="true" />
      )}
      {dayLabel(row.checkedAt, locale)}
      {row.stale && (
        <i className="kw-chip" data-tone="warn">
          {c.checkBalance}
        </i>
      )}
    </span>
  );
}

function KasTableRow({
  row,
  hidden,
  actions,
}: {
  row: KasRow;
  hidden: boolean;
  actions: KasRowActions;
}) {
  const { t, locale } = useLocale();
  const c = t.dana.v3.page;
  const money = useMoney();
  const countryName = walletCountry(row.country).name[locale];
  const id = row.kind === "ewallet" ? maskedId(row.account.maskedNumber) : "";
  const sub = [row.kind === "cash" ? c.cash : c.ewallet, countryName, id]
    .filter(Boolean)
    .join(" • ");
  const masked = hidden || row.idr === null;
  const native =
    masked || row.native === null
      ? MASK
      : formatNative(row.native, row.currency, locale);
  const idr = masked ? MASK : money.format(row.idr ?? 0);

  return (
    <div
      className="kw-row"
      role="row"
      data-excluded={!row.included || undefined}
    >
      <div className="kw-cell kw-cell-acc" role="cell">
        <BrandTile row={row} />
        <div className="kw-acc-text">
          <b>{row.account.name}</b>
          <small>{sub}</small>
          {!row.included && <i className="kw-chip">{c.excluded}</i>}
        </div>
      </div>
      <div className="kw-cell" role="cell" data-label={c.colOwner}>
        <span>{row.ownerLabel}</span>
        {row.shared && (
          <i className="kw-chip" data-tone="info">
            <Users aria-hidden="true" /> {c.shared}
          </i>
        )}
      </div>
      <div className="kw-cell kw-num" role="cell" data-label={c.colNative}>
        {native}
      </div>
      <div
        className="kw-cell kw-num kw-num-strong"
        role="cell"
        data-label={fill(c.colIdr, { cur: money.currency })}
      >
        {idr}
      </div>
      <div className="kw-cell" role="cell" data-label={c.colChecked}>
        <CheckedCell row={row} />
      </div>
      <div className="kw-cell kw-cell-menu" role="cell">
        <RowMenu row={row} actions={actions} />
      </div>
    </div>
  );
}

export function KasTable({
  rows,
  hidden,
  actions,
}: {
  rows: readonly KasRow[];
  hidden: boolean;
  actions: KasRowActions;
}) {
  const { t } = useLocale();
  const c = t.dana.v3.page;
  const money = useMoney();
  return (
    <section className="kw-card kw-list" aria-labelledby="kw-list-title">
      <h2 id="kw-list-title" className="kw-h2">
        {c.listTitle} <i className="kw-count">{rows.length}</i>
      </h2>
      <div className="kw-table" role="table" aria-label={c.listTitle}>
        <div className="kw-row kw-row-head" role="row">
          <span role="columnheader">{c.colAccount}</span>
          <span role="columnheader">{c.colOwner}</span>
          <span role="columnheader">{c.colNative}</span>
          <span role="columnheader">
            {fill(c.colIdr, { cur: money.currency })}
          </span>
          <span role="columnheader">{c.colChecked}</span>
          <span role="columnheader" aria-hidden="true" />
        </div>
        {rows.map((r) => (
          <KasTableRow
            key={r.account.id}
            row={r}
            hidden={hidden}
            actions={actions}
          />
        ))}
      </div>
    </section>
  );
}
