"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  Eye,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import type { TransactionDto } from "@wealthme/contracts";
import {
  CenteredDialogContent,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryIcon } from "@/components/shell/tx-pickers";
import { DateRangeFilterField } from "@/components/wm/date-range-field";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { cn } from "@/lib/utils";
import { investmentBreakdown, rowKind, type RowKind } from "./investment-row";

export type DeskFilter =
  | "all"
  | "income"
  | "expense"
  | "transfer"
  | "investasi"
  | "kartu_kredit";

const CHIPS: DeskFilter[] = [
  "all",
  "income",
  "expense",
  "transfer",
  "investasi",
];
const PAGE_SIZES = [10, 25, 50, 100];
const MONTH_WINDOW = 24;

type Option = { id: string; name: string };

export type DeskDetailProps = {
  tx: TransactionDto;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

type DesktopViewProps = {
  isLoading: boolean;
  isError: boolean;
  income: number;
  expense: number;
  net: number;
  dateFrom: string;
  dateTo: string;
  onRange: (from: string, to: string) => void;
  query: string;
  onQuery: (value: string) => void;
  filter: DeskFilter;
  onFilter: (value: DeskFilter) => void;
  accounts: Option[] | undefined;
  accountId: string;
  onAccount: (value: string) => void;
  categories: Option[] | undefined;
  categoryId: string;
  onCategory: (value: string) => void;
  owners: Option[];
  ownerId: string;
  onOwner: (value: string) => void;
  sortOrder: "newest" | "oldest";
  onSort: (value: "newest" | "oldest") => void;
  onReset: () => void;
  activeFilterCount: number;
  onExport: () => void;
  onRecord: () => void;
  trend: ReactNode;
  rows: TransactionDto[];
  total: number;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  pageSize: number;
  onPageSize: (size: number) => void;
  truncatedNote: string | null;
  fullDate: (day: string) => string;
  DetailDialog: (props: DeskDetailProps) => ReactNode;
  onEdit: (tx: TransactionDto) => void;
  onDelete: (id: string) => void;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM" bounds as ISO days — parts only, never a timezone round trip. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function monthOptions(now: Date, locale: string): Option[] {
  return Array.from({ length: MONTH_WINDOW }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      id: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      name: d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
        month: "long",
        year: "numeric",
      }),
    };
  });
}

function selectedMonth(from: string, to: string): string {
  if (!from && !to) return "";
  const month = from.slice(0, 7);
  return from &&
    to &&
    monthBounds(month).from === from &&
    monthBounds(month).to === to
    ? month
    : "custom";
}

function rowTime(tx: TransactionDto): string {
  const iso = tx.occurredAt.length > 10 ? tx.occurredAt : tx.createdAt;
  return iso.slice(11, 16);
}

export function DesktopView(props: DesktopViewProps) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const d = t.transaksi.v2;
  const [trendOpen, setTrendOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [now] = useState(() => new Date());
  const months = monthOptions(now, locale);
  const month = selectedMonth(props.dateFrom, props.dateTo);
  const signed = props.net > 0 ? "+" : props.net < 0 ? "-" : "";

  const groups: { day: string; rows: TransactionDto[] }[] = [];
  for (const tx of props.rows) {
    const day = tx.occurredAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(tx);
    else groups.push({ day, rows: [tx] });
  }

  return (
    <div className="tx-desk">
      <header className="tx-desk-head">
        <div>
          <p className="tx-desk-title">{t.shell.pageTitles.transaksi}</p>
          <p className="tx-desk-sub">{d.deskSubtitle}</p>
        </div>
        <div className="tx-desk-actions">
          <DropdownMenu>
            <DropdownMenuTrigger className="tx-btn">
              <Upload aria-hidden="true" />
              {d.deskExport}
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={props.onExport}>
                {d.exportCsv}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className="tx-btn tx-btn--primary"
            onClick={props.onRecord}
          >
            <Plus aria-hidden="true" />
            {d.record}
          </button>
        </div>
      </header>

      <section className="tx-kpis" aria-label={d.deskMonthLabel}>
        <label className="tx-kpi-month">
          <span className="sr-only">{d.deskMonthLabel}</span>
          <select
            className="select"
            value={month}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "custom") return;
              if (!value) props.onRange("", "");
              else {
                const b = monthBounds(value);
                props.onRange(b.from, b.to);
              }
            }}
          >
            <option value="">{d.deskAllPeriods}</option>
            {month === "custom" && (
              <option value="custom">{d.deskCustomRange}</option>
            )}
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <div className="tx-kpi">
          <small>{d.deskIncome}</small>
          <b className="wm-num">
            {props.isLoading ? "…" : money.format(props.income)}
          </b>
        </div>
        <div className="tx-kpi">
          <small>{d.deskExpense}</small>
          <b className="wm-num">
            {props.isLoading ? "…" : money.format(props.expense)}
          </b>
        </div>
        <div className="tx-kpi tx-kpi--net">
          <small>{d.deskNetCash}</small>
          <b className="wm-num" data-sign={props.net < 0 ? "neg" : "pos"}>
            {props.isLoading
              ? "…"
              : `${signed}${money.format(Math.abs(props.net))}`}
            <Info aria-hidden="true" />
          </b>
          <span>{d.deskNetCashNote}</span>
        </div>
      </section>

      <section className="tx-bar">
        <div className="tx-bar-row">
          <label className="tx-search">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={props.query}
              onChange={(e) => props.onQuery(e.target.value)}
              placeholder={d.deskSearchDesk}
              aria-label={d.deskSearchDesk}
            />
          </label>
          <label className="tx-bar-field">
            <span>{d.deskAccountLabel}</span>
            <select
              className="select"
              value={props.accountId}
              onChange={(e) => props.onAccount(e.target.value)}
            >
              <option value="">{d.deskAllOption}</option>
              {props.accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          {props.owners.length > 0 && (
            <label className="tx-bar-field">
              <span>{d.deskOwnerLabel}</span>
              <select
                className="select"
                value={props.ownerId}
                onChange={(e) => props.onOwner(e.target.value)}
              >
                <option value="">{d.deskAllOption}</option>
                {props.owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="tx-btn"
            onClick={() => setFilterOpen(true)}
            data-active={props.activeFilterCount > 0 || undefined}
          >
            <SlidersHorizontal aria-hidden="true" />
            {d.deskFilterButton}
            {props.activeFilterCount > 0 && (
              <span className="tx-count">{props.activeFilterCount}</span>
            )}
          </button>
          <button
            type="button"
            className="tx-trend-link"
            onClick={() => setTrendOpen(true)}
          >
            {d.deskTrend}
            <ArrowUpRight aria-hidden="true" />
          </button>
        </div>
        <div className="tx-types" role="group" aria-label={d.typeAria}>
          {CHIPS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={props.filter === value}
              onClick={() => props.onFilter(value)}
            >
              {value === "investasi"
                ? d.deskChipInvestment
                : t.transaksi.filterLabels[value]}
            </button>
          ))}
        </div>
      </section>

      <section className="tx-table-card" aria-labelledby="tx-desk-history">
        <div className="tx-table-top">
          <h2 id="tx-desk-history">{d.history}</h2>
          {!props.isLoading && (
            <span className="wm-cap">{`${props.total}${t.transaksi.transactionsCountSuffix}`}</span>
          )}
        </div>
        {props.isError && (
          <div role="alert" className="tx-note" data-tone="bad">
            {t.transaksi.errorLoad}
          </div>
        )}
        {props.truncatedNote && (
          <div className="tx-note" data-tone="warn">
            {props.truncatedNote}
          </div>
        )}
        {props.isLoading ? (
          <p className="wm-cap py-6 text-center">{t.transaksi.loadingLabel}</p>
        ) : props.total === 0 && !props.isError ? (
          <p className="wm-cap py-6 text-center">{t.transaksi.emptyFiltered}</p>
        ) : (
          <div role="table" className="tx-table" aria-label={d.history}>
            <div role="row" className="tx-trow tx-thead">
              <span role="columnheader">{d.deskColTime}</span>
              <span role="columnheader">{d.deskColTx}</span>
              <span role="columnheader">{d.deskColKind}</span>
              <span role="columnheader">{d.deskColAccount}</span>
              <span role="columnheader" className="tx-num">
                {d.deskColAmount}
              </span>
              <span role="columnheader">
                <span className="sr-only">{d.deskRowActions}</span>
              </span>
            </div>
            {groups.map((group) => (
              <div role="rowgroup" key={group.day}>
                <div className="tx-tday">{props.fullDate(group.day)}</div>
                {group.rows.map((tx) => (
                  <DeskRow key={tx.id} tx={tx} {...props} />
                ))}
              </div>
            ))}
          </div>
        )}
        {!props.isLoading && props.total > 0 && (
          <footer className="tx-tfoot">
            <span className="wm-cap">
              {t.transaksi.paginationShowingLabel}
              {props.rows.length}
              {t.transaksi.paginationOfMid}
              {props.total}
              {t.transaksi.transactionsCountSuffix}
            </span>
            <label className="tx-pagesize">
              <span className="sr-only">
                {d.deskPerPage.replace("{n}", String(props.pageSize))}
              </span>
              <select
                className="select"
                value={props.pageSize}
                onChange={(e) => props.onPageSize(Number(e.target.value))}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {d.deskPerPage.replace("{n}", String(n))}
                  </option>
                ))}
              </select>
            </label>
            {props.pages > 1 && (
              <span className="tx-pager-btns">
                <button
                  type="button"
                  className="tx-btn"
                  disabled={props.page <= 1}
                  onClick={() => props.onPage(props.page - 1)}
                >
                  {t.transaksi.paginationPrevButton}
                </button>
                <button
                  type="button"
                  className="tx-btn"
                  disabled={props.page >= props.pages}
                  onClick={() => props.onPage(props.page + 1)}
                >
                  {t.transaksi.paginationNextButton}
                </button>
              </span>
            )}
            <span className="tx-note-inline">
              <Info aria-hidden="true" />
              {d.deskInvestNote}
            </span>
          </footer>
        )}
      </section>

      <Dialog open={trendOpen} onOpenChange={setTrendOpen}>
        <CenteredDialogContent className="min-[769px]:w-[min(760px,calc(100%-2rem))]">
          <DialogTitle>{d.deskTrendTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            {d.chartAria}
          </DialogDescription>
          <DialogBody>
            <div className="tx-trend-box">
              {props.trend ?? (
                <p className="wm-cap py-6 text-center">{d.deskTrendEmpty}</p>
              )}
            </div>
          </DialogBody>
        </CenteredDialogContent>
      </Dialog>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <CenteredDialogContent>
          <DialogTitle>{d.deskFilterButton}</DialogTitle>
          <DialogBody>
            <div className="tx-filter-dialog">
              <DateRangeFilterField
                from={props.dateFrom}
                to={props.dateTo}
                locale={locale}
                label={t.transaksi.dateRangeLabel}
                cancelLabel={locale === "en" ? "Cancel" : "Batal"}
                applyLabel={locale === "en" ? "Apply" : "Terapkan"}
                onApply={props.onRange}
              />
              <label className="tx-field">
                <span>{t.transaksi.categoryFilterFieldLabel}</span>
                <select
                  className="select"
                  value={props.categoryId}
                  onChange={(e) => props.onCategory(e.target.value)}
                >
                  <option value="">{t.transaksi.allCategoriesOption}</option>
                  {props.categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tx-field">
                <span>{t.transaksi.sortByLabel}</span>
                <select
                  className="select"
                  value={props.sortOrder}
                  aria-label={t.transaksi.sortAriaLabel}
                  onChange={(e) =>
                    props.onSort(e.target.value as "newest" | "oldest")
                  }
                >
                  <option value="newest">
                    {t.transaksi.sortLabels.newest}
                  </option>
                  <option value="oldest">
                    {t.transaksi.sortLabels.oldest}
                  </option>
                </select>
              </label>
              <div className="tx-types" role="group" aria-label={d.typeAria}>
                <button
                  type="button"
                  aria-pressed={props.filter === "kartu_kredit"}
                  onClick={() =>
                    props.onFilter(
                      props.filter === "kartu_kredit" ? "all" : "kartu_kredit",
                    )
                  }
                >
                  {t.transaksi.filterLabels.kartu_kredit}
                </button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="tx-btn" onClick={props.onReset}>
              {d.reset}
            </button>
            <button
              type="button"
              className="tx-btn tx-btn--primary"
              onClick={() => setFilterOpen(false)}
            >
              OK
            </button>
          </DialogFooter>
        </CenteredDialogContent>
      </Dialog>
    </div>
  );
}

const KIND_BADGE: Record<RowKind, string> = {
  investment: "investment",
  transfer: "transfer",
  expense: "expense",
  income: "income",
};

function DeskRow({
  tx,
  DetailDialog,
  onEdit,
  onDelete,
}: { tx: TransactionDto } & Pick<
  DesktopViewProps,
  "DetailDialog" | "onEdit" | "onDelete"
>) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const d = t.transaksi.v2;
  const [open, setOpen] = useState(false);
  const kind = rowKind(tx);
  const inv = investmentBreakdown(tx);
  const amount = parseFloat(tx.amount);
  const sign = kind === "income" ? "+" : kind === "expense" ? "-" : "";
  const label =
    kind === "investment"
      ? d.deskChipInvestment
      : kind === "transfer"
        ? t.transaksi.typeLabels.transfer
        : t.transaksi.typeLabels[kind];
  const title = inv
    ? `${inv.side === "buy" ? d.deskBuy : d.deskSell} ${inv.symbol}`
    : kind === "transfer" && tx.toAccountName
      ? (tx.description ?? t.transaksi.typeLabels.transfer)
      : (tx.description ?? tx.categoryName ?? tx.accountName ?? "—");
  const qty = inv
    ? `${inv.quantity.toLocaleString(locale === "en" ? "en-US" : "id-ID", {
        maximumFractionDigits: 8,
      })} ${inv.symbol}`
    : null;
  const accounts = [tx.accountName, tx.toAccountName]
    .filter(Boolean)
    .join(" → ");
  const role = inv
    ? inv.side === "buy"
      ? d.deskPurchase
      : d.deskSaleProceeds
    : null;
  const locked = !!tx.liabilityId || !!tx.insuranceId || tx.canModify === false;

  return (
    <div role="row" className="tx-trow" data-kind={kind}>
      <span role="cell" className="tx-time">
        {rowTime(tx)}
      </span>
      <span role="cell" className="tx-what">
        <span className="tx-row-ic" data-kind={kind} aria-hidden="true">
          {kind === "investment" ? (
            <TrendingUp />
          ) : kind === "transfer" ? (
            <ArrowLeftRight />
          ) : (
            <CategoryIcon name={tx.categoryName ?? ""} />
          )}
        </span>
        <span className="min-w-0">
          <button
            type="button"
            className="tx-title"
            onClick={() => setOpen(true)}
          >
            {title}
          </button>
          {qty && (
            <small>
              {qty}
              {inv?.side === "sell" && (
                <>
                  {" • "}
                  <Link href={`/investasi/${inv.id}`} className="tx-exec">
                    {d.deskExecDetail}
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </>
              )}
            </small>
          )}
        </span>
      </span>
      <span role="cell">
        <span className="tx-badge" data-kind={KIND_BADGE[kind]}>
          {label}
        </span>
      </span>
      <span role="cell" className="tx-acct">
        {accounts || "—"}
        {role && <small>{role}</small>}
      </span>
      <span role="cell" className={cn("tx-num wm-num")} data-kind={kind}>
        {sign}
        {money.format(amount)}
      </span>
      <span role="cell" className="tx-more">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="tx-icon-btn"
            aria-label={`${d.deskRowActions}: ${title}`}
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setOpen(true)}>
              <Eye className="size-3.5" aria-hidden="true" />
              {t.transaksi.detailDialogTitle}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={locked} onClick={() => onEdit(tx)}>
              <Pencil className="size-3.5" aria-hidden="true" />
              {t.common.edit}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={locked}
              variant="destructive"
              onClick={() => onDelete(tx.id)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
      <DetailDialog
        tx={tx}
        open={open}
        onClose={() => setOpen(false)}
        onEdit={() => {
          setOpen(false);
          onEdit(tx);
        }}
        onDelete={() => {
          setOpen(false);
          onDelete(tx.id);
        }}
      />
    </div>
  );
}
