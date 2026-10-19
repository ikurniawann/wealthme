"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowLeftRight,
  Banknote,
  Eye,
  EyeOff,
  Info,
  Plus,
  Wallet,
} from "lucide-react";
import type { FxRatesResponse } from "@wealthme/contracts";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fill } from "@/i18n/rekening-v3";

import type { KasRow, KasTotals } from "./kas-model";
import type { KasKind } from "./kas-form-state";

export const MASK = "••••";

export function KasHeader({
  canManage,
  onTransfer,
  onAdd,
}: {
  canManage: boolean;
  onTransfer: () => void;
  onAdd: (kind: KasKind) => void;
}) {
  const { t } = useLocale();
  const c = t.dana.v3.page;
  const f = t.dana.v3.form;
  return (
    <header className="kw-head">
      <div className="kw-head-text">
        <p className="kw-title">{c.title}</p>
        <p className="kw-sub">{c.subtitle}</p>
      </div>
      {canManage && (
        <div className="kw-head-actions">
          <button type="button" className="kw-btn" onClick={onTransfer}>
            <ArrowLeftRight aria-hidden="true" /> {c.transfer}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button type="button" className="kw-btn" data-primary="" />
              }
            >
              <Plus aria-hidden="true" /> {c.addAccount}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="kw-addmenu">
              <DropdownMenuItem onClick={() => onAdd("cash")}>
                <span className="kw-addmenu-ic" data-kind="cash">
                  <Banknote aria-hidden="true" />
                </span>
                <span className="kw-addmenu-txt">
                  <b>{c.addCash}</b>
                  <small>{f.addCashSub}</small>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAdd("ewallet")}>
                <span className="kw-addmenu-ic" data-kind="ewallet">
                  <Wallet aria-hidden="true" />
                </span>
                <span className="kw-addmenu-txt">
                  <b>{c.addEwallet}</b>
                  <small>{f.addWalletSub}</small>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
}

function rateDateLabel(iso: string, locale: "id" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function KasSummary({
  rows,
  totals,
  rates,
  hidden,
  onToggleHidden,
  loading,
  error = false,
}: {
  rows: readonly KasRow[];
  totals: KasTotals;
  rates: FxRatesResponse | undefined;
  hidden: boolean;
  onToggleHidden: () => void;
  loading: boolean;
  /** Accounts failed to load: show "—", never a made-up Rp 0. */
  error?: boolean;
}) {
  const { t, locale } = useLocale();
  const c = t.dana.v3.page;
  const money = useMoney();
  const allIdr = rows.every((r) => r.currency === "IDR");
  const unknown = loading || error;
  const blank = loading ? "…" : "—";
  const show = (n: number) =>
    unknown ? blank : hidden ? MASK : money.format(n);
  const count = (n: number) => (unknown ? blank : fill(c.accountsN, { n }));
  const rateNote =
    allIdr || !rates?.rateDate
      ? c.rateNoteNone
      : fill(c.rateNote, { date: rateDateLabel(rates.rateDate, locale) });

  return (
    <section
      className="kw-card kw-summary"
      aria-label={c.totalIn.replace("{cur}", money.currency)}
    >
      <div className="kw-sum-main">
        <p className="kw-sum-label">
          {fill(c.totalIn, { cur: money.currency })}
          <button
            type="button"
            className="kw-eye"
            aria-label={hidden ? c.showBalance : c.hideBalance}
            onClick={onToggleHidden}
          >
            {hidden ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </button>
        </p>
        <p className="kw-sum-total wm-num">{show(totals.total)}</p>
        <p className="kw-sum-meta">
          {unknown
            ? blank
            : fill(c.accountsCurrencies, {
                n: rows.length,
                c: totals.currencies,
              })}
        </p>
      </div>
      <div className="kw-stat">
        <span className="kw-stat-ic" data-kind="cash" aria-hidden="true">
          <Banknote />
        </span>
        <div>
          <p className="kw-stat-label">{c.cash}</p>
          <p className="kw-stat-val wm-num">{show(totals.cash)}</p>
          <p className="kw-stat-n">{count(totals.cashCount)}</p>
        </div>
      </div>
      <div className="kw-stat">
        <span className="kw-stat-ic" data-kind="ewallet" aria-hidden="true">
          <Wallet />
        </span>
        <div>
          <p className="kw-stat-label">{c.ewallet}</p>
          <p className="kw-stat-val wm-num">{show(totals.ewallet)}</p>
          <p className="kw-stat-n">{count(totals.ewalletCount)}</p>
        </div>
      </div>
      <div className="kw-rate">
        <Info aria-hidden="true" />
        <div>
          <p>{rateNote}</p>
          <Link href="/akun" className="kw-link">
            {c.viewRates} <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
