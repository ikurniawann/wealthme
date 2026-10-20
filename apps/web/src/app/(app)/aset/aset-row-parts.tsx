"use client";

import { createElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  Minus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
} from "lucide-react";
import type { AssetOverviewRowDto } from "@wealthme/contracts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import {
  detailHref,
  fillCopy,
  fmtDate,
  fmtPct,
  fmtQty,
  isManagedAsset,
  roundIdr,
  rowIcon,
  subtypeLabel,
} from "./aset-model";

export type RowAction = "edit" | "archive";

export function AssetMark({ row }: { row: AssetOverviewRowDto }) {
  return (
    <span className="as3-mark" data-class={row.class} aria-hidden="true">
      {createElement(rowIcon(row))}
    </span>
  );
}

export function TypeChip({ row }: { row: AssetOverviewRowDto }) {
  const { t } = useLocale();
  return (
    <span className="as3-type" data-class={row.class}>
      {createElement(rowIcon(row), { "aria-hidden": true })}
      {subtypeLabel(row, t.aset)}
    </span>
  );
}

/** Name, code/ticker and the badges that explain where the row comes from. */
export function AssetName({ row }: { row: AssetOverviewRowDto }) {
  const { t } = useLocale();
  const c = t.aset.v3;
  // Account rows only show a masked number ("···5586"); never a raw or
  // encrypted account identifier.
  const rawCode = row.ticker ?? row.internalCode;
  const code =
    row.sourceModule === "accounts" && rawCode && !/^[·•*]/.test(rawCode)
      ? null
      : rawCode;
  const investSource = row.sources.find((s) => s.module === "investments");
  return (
    <div className="as3-name">
      <Link href={detailHref(row)} className="as3-name-link">
        {row.name}
      </Link>
      {code && <small className="as3-code">{code}</small>}
      <span className="as3-badges">
        {investSource && (
          <Link href={investSource.href} className="as3-badge as3-badge--src">
            {c.sourceInvestasi}
          </Link>
        )}
        {row.accountClosed && (
          <span className="as3-badge as3-badge--muted">{c.closed}</span>
        )}
        {row.status !== "active" && (
          <span className="as3-badge as3-badge--muted">
            {c.statuses[row.status]}
          </span>
        )}
        {row.duplicateWarning && (
          <span className="as3-badge as3-badge--warn">{c.duplicate}</span>
        )}
      </span>
    </div>
  );
}

export function QtyText({ row }: { row: AssetOverviewRowDto }) {
  const { locale } = useLocale();
  if (row.quantity == null) return <>—</>;
  return (
    <>
      {fmtQty(row.quantity, locale)}
      {row.unit ? ` ${row.unit}` : ""}
    </>
  );
}

export function AcquiredText({ row }: { row: AssetOverviewRowDto }) {
  const { t, locale } = useLocale();
  const c = t.aset.v3;
  if (row.acquisition.multiple) {
    return (
      <>
        {c.multiple}
        {row.acquisition.date && (
          <small>
            {fillCopy(c.firstOn, {
              date: fmtDate(row.acquisition.date, locale),
            })}
          </small>
        )}
      </>
    );
  }
  return <>{fmtDate(row.acquisition.date, locale)}</>;
}

/**
 * Current value + its basis. An unvalued row is "Belum dinilai", never Rp0;
 * a cost fallback is labelled as such, never called a market value.
 */
export function ValueCell({ row }: { row: AssetOverviewRowDto }) {
  const { t, locale } = useLocale();
  const c = t.aset.v3;
  const money = useMoney();
  const basis = c.basis[row.valuationBasis] ?? row.valuationBasis;
  const priceDate = row.price?.asOf
    ? fmtDate(row.price.asOf.slice(0, 10), locale)
    : null;
  if (row.valueIdr != null) {
    const note = priceDate ? `${basis} · ${priceDate}` : basis;
    return (
      <div className="as3-value">
        <strong className="as3-amount">
          {money.formatExact(roundIdr(row.valueIdr))}
        </strong>
        <small data-basis={row.valuationBasis}>{note}</small>
      </div>
    );
  }
  const fallback = roundIdr(row.netWorthValueIdr);
  if (row.valuationBasis === "cost_basis") {
    return (
      <div className="as3-value">
        <strong className="as3-amount">{money.formatExact(fallback)}</strong>
        <small data-basis="cost_basis">{basis}</small>
      </div>
    );
  }
  return (
    <div className="as3-value">
      <strong className="as3-unvalued">{c.notValued}</strong>
      <small data-basis={row.valuationBasis}>{basis}</small>
      {fallback > BigInt(0) && (
        <small>
          {fillCopy(c.totalUsesCost, { amount: money.formatExact(fallback) })}
        </small>
      )}
    </div>
  );
}

/** A6 valuation change: arrow + sign + words, never colour alone. */
export function ChangeCell({ row }: { row: AssetOverviewRowDto }) {
  const { t, locale } = useLocale();
  const c = t.aset.v3;
  const money = useMoney();
  const ch = row.change;
  if (ch.period === "none" || ch.amountIdr == null) {
    return (
      <span className="as3-change" data-tone="none" title={c.noComparison}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{c.noComparison}</span>
      </span>
    );
  }
  const amount = roundIdr(ch.amountIdr);
  const dir = amount > BigInt(0) ? "up" : amount < BigInt(0) ? "down" : "flat";
  const Icon =
    dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const sign = dir === "up" ? "+" : dir === "down" ? "−" : "";
  const abs = amount < BigInt(0) ? -amount : amount;
  return (
    <span className="as3-change" data-tone={dir}>
      <Icon aria-hidden="true" />
      <span className="as3-change-body">
        <span className="sr-only">{c[dir]} </span>
        <strong>
          {sign}
          {money.formatExact(abs)}
        </strong>
        {ch.percent != null && (
          <small>
            {sign}
            {fmtPct(ch.percent, locale)}
          </small>
        )}
        {ch.comparisonDate && (
          <small className="as3-vs">
            {fillCopy(c.vsDate, {
              date: fmtDate(ch.comparisonDate, locale),
            })}
          </small>
        )}
      </span>
    </span>
  );
}

export function RowMenu({
  row,
  canManage,
  onAction,
}: {
  row: AssetOverviewRowDto;
  canManage: boolean;
  onAction: (action: RowAction, row: AssetOverviewRowDto) => void;
}) {
  const { t } = useLocale();
  const c = t.aset.v3;
  const router = useRouter();
  const href = detailHref(row);
  const managed = canManage && isManagedAsset(row);
  const label = fillCopy(c.rowMenu, { name: row.name });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="btn btn--ghost btn--icon as3-menu-btn"
        aria-label={label}
        title={label}
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(href)}>
            <Eye aria-hidden="true" /> {c.viewDetail}
          </DropdownMenuItem>
          {managed && row.status === "active" && (
            <DropdownMenuItem onClick={() => router.push(href)}>
              <RefreshCw aria-hidden="true" /> {c.updateValue}
            </DropdownMenuItem>
          )}
          {managed && (
            <DropdownMenuItem onClick={() => onAction("edit", row)}>
              <Pencil aria-hidden="true" /> {c.edit}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        {managed && row.status !== "archived" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onAction("archive", row)}
            >
              <Archive aria-hidden="true" /> {c.archive}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
