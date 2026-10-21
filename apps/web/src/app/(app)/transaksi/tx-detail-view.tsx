"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  History,
  Info,
  Paperclip,
  StickyNote,
  Wallet,
} from "lucide-react";
import type { TransactionDto } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import {
  investmentBreakdown,
  rowKind,
  type InvestmentBreakdown,
} from "./investment-row";

/** Stable display reference derived from the real date + id (no stored code exists). */
export function txReference(tx: Pick<TransactionDto, "id" | "occurredAt">) {
  const day = tx.occurredAt.slice(0, 10).replaceAll("-", "");
  return `TX-${day}-${tx.id.replaceAll("-", "").slice(0, 4).toUpperCase()}`;
}

function Collapsible({
  icon,
  label,
  aside,
  children,
}: {
  icon: ReactNode;
  label: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="txd-fold">
      <summary>
        <span className="txd-fold-ic" aria-hidden="true">
          {icon}
        </span>
        <span className="txd-fold-label">{label}</span>
        {aside && <span className="txd-fold-aside">{aside}</span>}
        <ChevronDown className="txd-fold-chev" aria-hidden="true" />
      </summary>
      <div className="txd-fold-body">{children}</div>
    </details>
  );
}

function SaleTable({ inv }: { inv: InvestmentBreakdown }) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const d = t.transaksi.v2;
  const sell = inv.side === "sell";
  const num = (n: number) =>
    n.toLocaleString(locale === "en" ? "en-US" : "id-ID", {
      maximumFractionDigits: 8,
    });
  const formula =
    inv.unitPrice !== null
      ? `${num(inv.quantity)} × ${money.format(inv.unitPrice)}${
          inv.fee ? ` ${sell ? "−" : "+"} ${money.format(inv.fee)}` : ""
        }`
      : null;
  return (
    <section>
      <h3 className="txd-h">
        {sell ? d.deskDetailSaleTitle : d.deskDetailBuyTitle}
      </h3>
      <div className="txd-table">
        <dl>
          <div>
            <dt>{sell ? d.deskDetailQtySold : d.deskDetailQtyBought}</dt>
            <dd>{`${num(inv.quantity)} ${inv.symbol}`}</dd>
          </div>
          {inv.unitPrice !== null && (
            <div>
              <dt>{d.deskDetailExecPrice}</dt>
              <dd>{`${money.format(inv.unitPrice)} / ${inv.symbol}`}</dd>
            </div>
          )}
          {inv.gross !== null && (
            <div>
              <dt>{d.deskDetailGross}</dt>
              <dd>{money.format(inv.gross)}</dd>
            </div>
          )}
          {inv.fee !== null && (
            <div>
              <dt>{d.deskDetailFee}</dt>
              <dd>{money.format(inv.fee)}</dd>
            </div>
          )}
          <div className="txd-net">
            <dt>{sell ? d.deskDetailNetProceeds : d.deskDetailTotalPaid}</dt>
            <dd>{money.format(inv.net)}</dd>
          </div>
        </dl>
        {formula && <p className="txd-formula">{formula}</p>}
      </div>
      <p className="txd-note">
        <Info aria-hidden="true" />
        <span>
          {sell ? d.deskDetailSaleNote : d.deskDetailBuyNote}
          {sell && (
            <>
              <br />
              <Link href="/laporan">
                {d.deskDetailViewPnl}
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </>
          )}
        </span>
        <Link href="/investasi" className="txd-pos">
          {`${d.deskDetailViewPosition} ${inv.symbol}`}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </p>
    </section>
  );
}

function balanceImpact(
  tx: TransactionDto,
  format: (n: number) => string,
): { label: string; value: string }[] {
  const amount = parseFloat(tx.amount);
  if (tx.type === "income")
    return [{ label: tx.accountName ?? "—", value: `+${format(amount)}` }];
  if (tx.type === "expense")
    return [{ label: tx.accountName ?? "—", value: `-${format(amount)}` }];
  return [
    { label: tx.accountName ?? "—", value: `-${format(amount)}` },
    { label: tx.toAccountName ?? "—", value: `+${format(amount)}` },
  ];
}

/** Title shown in the panel hero (investment rows read "Jual ETH" / "Beli ETH"). */
export function useDetailTitle(tx: TransactionDto): string {
  const { t } = useLocale();
  const inv = investmentBreakdown(tx);
  if (inv) {
    const verb =
      inv.side === "sell" ? t.transaksi.v2.deskSell : t.transaksi.v2.deskBuy;
    return `${verb} ${inv.symbol}`;
  }
  return tx.description ?? tx.categoryName ?? tx.accountName ?? "—";
}

/** Hero, account card, investment table and collapsibles of the detail panel. */
export function TxDetailView({
  tx,
  attachmentCount,
  attachments,
  children,
}: {
  tx: TransactionDto;
  attachmentCount: number | null;
  attachments: ReactNode;
  /** The plain key/value rows (kategori, akun, tanggal...) for non-investment rows. */
  children?: ReactNode;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const d = t.transaksi.v2;
  const title = useDetailTitle(tx);
  const kind = rowKind(tx);
  const inv = investmentBreakdown(tx);
  const amount = parseFloat(tx.amount);
  const sign = kind === "income" ? "+" : kind === "expense" ? "-" : "";
  const when = new Date(
    `${tx.occurredAt.slice(0, 10)}T00:00:00`,
  ).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const badge = inv
    ? inv.side === "sell"
      ? d.deskDetailInvestSale
      : d.deskDetailInvestBuy
    : t.transaksi.typeLabels[tx.type];
  const amountLabel = inv
    ? inv.side === "sell"
      ? d.deskDetailNetReceived
      : d.deskDetailAmountPaid
    : null;
  const accountLabel =
    kind === "income"
      ? d.deskDetailReceivingAccount
      : kind === "expense"
        ? d.deskDetailSourceAccount
        : d.deskDetailTransferAccounts;
  const accountName =
    kind === "transfer" || inv
      ? [tx.accountName, tx.toAccountName].filter(Boolean).join(" → ")
      : (tx.accountName ?? "—");
  const subtitle = inv
    ? `${inv.symbol} • ${tx.accountName ?? tx.toAccountName ?? "—"}`
    : [tx.categoryName, tx.accountName].filter(Boolean).join(" • ");
  const note =
    tx.description && tx.description !== title && !inv ? tx.description : null;
  const impact = balanceImpact(tx, money.format);

  return (
    <>
      <div className="txd-hero" data-kind={kind}>
        <div className="txd-hero-l">
          <div className="txd-chips">
            <span className="txd-badge">{badge}</span>
            <span className="txd-status">
              <i aria-hidden="true" />
              {d.deskDetailRecorded}
            </span>
          </div>
          <p className="txd-title">{title}</p>
          {subtitle && <p className="txd-sub">{subtitle}</p>}
          <p className="txd-when">{when}</p>
        </div>
        <div className="txd-hero-r">
          {amountLabel && <small>{amountLabel}</small>}
          <b className="wm-num" data-kind={kind}>
            {sign}
            {money.format(amount)}
          </b>
        </div>
      </div>

      <section>
        <h3 className="txd-h">{accountLabel}</h3>
        <div className="txd-acct">
          <span className="txd-acct-ic" aria-hidden="true">
            <Wallet />
          </span>
          <span className="txd-acct-name">{accountName || "—"}</span>
          <Link href="/rekening" className="txd-acct-link">
            {d.deskDetailViewAccount}
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      {inv ? <SaleTable inv={inv} /> : children}

      <div className="txd-folds">
        <Collapsible icon={<Wallet />} label={d.deskDetailBalanceImpact}>
          <dl className="txd-impact">
            {impact.map((row, i) => (
              <div key={i}>
                <dt>{row.label}</dt>
                <dd className="wm-num">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Collapsible>
        <Collapsible
          icon={<Paperclip />}
          label={d.deskDetailAttachments}
          aside={
            attachmentCount !== null
              ? `${attachmentCount} ${d.deskDetailFilesSuffix}`
              : undefined
          }
        >
          {attachments}
        </Collapsible>
        <Collapsible icon={<History />} label={d.deskDetailAudit}>
          <p className="txd-audit">
            {`${d.deskDetailAuditRecorded} ${tx.createdAt
              .slice(0, 16)
              .replace("T", " ")}`}
          </p>
        </Collapsible>
        {note && (
          <Collapsible
            icon={<StickyNote />}
            label={d.deskDetailNote}
            aside={<span className="txd-note-prev">{note}</span>}
          >
            <p className="txd-audit">{note}</p>
          </Collapsible>
        )}
      </div>
    </>
  );
}
