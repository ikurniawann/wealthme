"use client";
import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  FileText,
  LayoutDashboard,
  List,
  PencilLine,
  RefreshCw,
  ShoppingCart,
  UserRound,
  Wallet,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type {
  InvestmentDto,
  InvestmentTransactionDto,
  PlatformAccountDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";
import { useMoney } from "@/hooks/use-money";
import { useCanManage } from "@/hooks/use-role-permissions";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { useInvestmentInvalidation } from "../use-investment-invalidation";
import { money, quantity } from "../portfolio-model";
import type { PortfolioHistory } from "../portfolio-model";
import type { PortfolioMember } from "../portfolio-filters";
import { PortfolioChart } from "../portfolio-overview";
import { TradeForm } from "../trade-form";
import { PriceForm } from "../price-form";
import { percentPrice } from "../price-unit";
import { DetailMetadata } from "./detail-metadata";
import { DetailCalculation } from "./detail-calculation";
import { DetailTransactions } from "./detail-transactions";
import { DetailDocuments } from "./detail-documents";
import { DetailEventForm } from "./detail-events";
import "../investasi.css";
import "./detail.css";

export default function InvestmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const d = t.investasi.detail;
  const { hideBalance } = useMoney();
  const { myRole } = useMyRole();
  const { canManage } = useCanManage("Investment");
  const { data: session } = useSession();
  const fg = session?.familyGroupId;
  const token = session?.accessToken;
  const enabled = !!fg && !!token && !!id;
  const base = `/family-groups/${fg}`;
  const options = { token };
  const onSaved = useInvestmentInvalidation();
  const [tab, setTab] = useState<"summary" | "transactions" | "documents">(
    "summary",
  );
  // `?edit=1` (the list's "Ubah data" row action) opens the edit dialog.
  const searchParams = useSearchParams();
  const [action, setAction] = useState<
    "buy" | "sell" | "price" | "income" | "corporate" | "metadata" | null
  >(() => (searchParams.get("edit") === "1" ? "metadata" : null));
  const holding = useQuery({
    queryKey: ["investments-v3", fg, token, id],
    queryFn: () =>
      apiFetch<InvestmentDto>(`${base}/investments/${id}/detail`, options),
    enabled,
  });
  const rows = useQuery({
    queryKey: ["investment-activity", fg, token, id],
    queryFn: () =>
      apiFetch<InvestmentTransactionDto[]>(
        `${base}/investments/${id}/transactions`,
        options,
      ),
    enabled: enabled && !!holding.data,
  });
  const history = useQuery({
    queryKey: ["investment-value-history", fg, token, id],
    queryFn: () =>
      apiFetch<PortfolioHistory>(
        `${base}/investments/value-history?investmentId=${id}`,
        options,
      ),
    enabled: enabled && !!holding.data,
  });
  const platforms = useQuery({
    queryKey: ["platform-accounts", fg, token],
    queryFn: () =>
      apiFetch<PlatformAccountDto[]>(`${base}/platform-accounts`, options),
    enabled,
  });
  const members = useQuery({
    queryKey: ["investment-members", fg, token],
    queryFn: () => apiFetch<PortfolioMember[]>(`${base}/members`, options),
    enabled,
  });
  if (holding.isError)
    return (
      <div className="iv">
        <Link href="/investasi">← {c.title}</Link>
        <section className="iv-card iv-empty" role="alert">
          <p>{d.notFound}</p>
          <button
            className="btn btn--outline"
            onClick={() => void holding.refetch()}
          >
            {c.retry}
          </button>
        </section>
      </div>
    );
  if (!enabled || holding.isPending)
    return (
      <div className="iv">
        <p className="iv-card iv-empty" role="status">
          {c.loading}
        </p>
      </div>
    );
  const h = holding.data;
  const v = h?.valuation;
  if (!h || !v)
    return (
      <div className="iv">
        <p role="alert">{c.error}</p>
      </div>
    );
  const platform = platforms.data?.find((p) => p.id === h.platformAccountId);
  const pocket = platform?.pockets?.find((p) => p.id === h.cashAccountId);
  const owner = h.ownerUserId
    ? (members.data?.find((m) => m.userId === h.ownerUserId)?.name ?? "—")
    : c.family;
  const fmt = (
    n: string | null | undefined,
    currency = "IDR",
    digits?: number,
  ) => money(n, currency, locale, hideBalance, digits);
  const common = {
    rows: rows.data ?? [],
    valuation: v,
    fg: fg!,
    token: token!,
    canManage: !!canManage,
    onSaved,
  };
  return (
    <div className="iv iv-detail">
      <nav className="ivd-crumb" aria-label={c.title}>
        <Link href="/investasi">
          <ChevronLeft aria-hidden />
          {c.title}
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{h.ticker}</span>
      </nav>
      <header className="ivd-head">
        <div className="ivd-identity">
          <div className="ivd-title-row">
            <p className="iv-title">{h.name}</p>
            {h.ticker !== h.name && (
              <span className="iv-ticker">{h.ticker}</span>
            )}
            <span className="ivd-chip">
              {h.market ?? c.completeMarket} · {c[h.type]} · {h.currency}
            </span>
          </div>
          <p className="ivd-meta">
            <span>
              <UserRound aria-hidden />
              {c.owner}: <strong>{owner}</strong>
            </span>
            <span>
              <Wallet aria-hidden />
              {c.platform}:{" "}
              <strong>
                {platform?.label ??
                  platform?.platformName ??
                  platform?.customName ??
                  "—"}
              </strong>
              {pocket?.name ? ` · ${pocket.name}` : ""}
            </span>
          </p>
        </div>
        {canManage && (
          <div className="ivd-actions">
            <button
              className="btn btn--primary"
              onClick={() => setAction("buy")}
            >
              <ShoppingCart aria-hidden />
              {c.buy}
            </button>
            <button
              className="btn btn--outline ivd-sell"
              onClick={() => setAction("sell")}
            >
              <ShoppingCart aria-hidden />
              {c.sell}
            </button>
            {h.type !== "deposito" && (
              <button
                className="btn btn--outline"
                onClick={() => setAction("price")}
              >
                <RefreshCw aria-hidden />
                {c.updatePrice}
              </button>
            )}
            <button
              className="btn btn--outline"
              onClick={() => setAction("metadata")}
            >
              <PencilLine aria-hidden />
              {h.market ? d.editHolding : d.completeMetadata}
            </button>
          </div>
        )}
      </header>
      {!h.market && <p className="iv-notice">{d.metadataNote}</p>}
      <section className="iv-card iv-detail-kpis ivd-kpis">
        <div>
          <span>{t.investasi.forms.quantity}</span>
          <strong>{hideBalance ? "••••" : quantity(h, c, locale)}</strong>
        </div>
        <div>
          <span>{d.currentPrice}</span>
          <strong>
            {v.price
              ? percentPrice(h)
                ? hideBalance
                  ? "••••"
                  : `${v.price.value}%`
                : fmt(v.price.value, v.price.currency, 8)
              : "—"}
          </strong>
          <small>{v.price?.unitLabel ?? "—"}</small>
        </div>
        <div>
          <span>{d.marketValue}</span>
          <strong>{fmt(v.marketValueIdr)}</strong>
          <small>
            {v.basis === "cost_basis"
              ? c.costBasis
              : v.basis === "unpriced" || v.basis === "failed"
                ? c.noPrice
                : v.basis === "stale"
                  ? c.stale
                  : (v.price?.source ?? "—")}
          </small>
        </div>
        <div>
          <span>{d.remainingCost}</span>
          <strong>{fmt(v.costRemainingIdr)}</strong>
        </div>
        <div>
          <span>{d.unrealized}</span>
          <strong
            className="ivd-pnl"
            data-sign={
              hideBalance
                ? undefined
                : v.unrealizedIdr?.startsWith("-")
                  ? "down"
                  : v.unrealizedIdr && /[1-9]/.test(v.unrealizedIdr)
                    ? "up"
                    : undefined
            }
          >
            {fmt(v.unrealizedIdr)}
          </strong>
          <small>
            {hideBalance || v.unrealizedPct === null
              ? "—"
              : `${v.unrealizedPct}%`}
          </small>
        </div>
        <div>
          <span>{d.source}</span>
          <strong>{v.price?.source ?? "—"}</strong>
          <small>
            {v.price
              ? new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
                  dateStyle: "medium",
                  timeZone: "Asia/Jakarta",
                  ...(v.price.hasTime ? { timeStyle: "short" as const } : {}),
                }).format(new Date(v.price.asOf))
              : "—"}{" "}
            · Asia/Jakarta
          </small>
          {v.price?.stale && <small>{c.stale}</small>}
          {v.price?.delayed && <small>{d.delayed}</small>}
        </div>
      </section>
      <nav className="ivd-tabs" aria-label={d.identity}>
        {(["summary", "transactions", "documents"] as const).map((key) => {
          const Icon =
            key === "summary"
              ? LayoutDashboard
              : key === "transactions"
                ? List
                : FileText;
          return (
            <button
              type="button"
              key={key}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              <Icon aria-hidden />
              {d[key]}
            </button>
          );
        })}
      </nav>
      {tab === "summary" ? (
        <>
          <div className="iv-detail-grid">
            <div className="iv-detail-main">
              <PortfolioChart
                data={history.data}
                loading={history.isPending}
                error={history.isError}
              />
              {rows.isPending ? (
                <p className="iv-card" role="status">
                  {c.loading}
                </p>
              ) : rows.isError ? (
                <p className="iv-card" role="alert">
                  {c.error}
                </p>
              ) : (
                <>
                  <DetailTransactions {...common} />
                  <DetailTransactions {...common} section="sales" />
                  <DetailTransactions {...common} section="income" />
                </>
              )}
            </div>
            <DetailCalculation holding={h} valuation={v} />
          </div>
          {canManage && (
            <div className="iv-tools ivd-tools">
              <button
                className="btn btn--primary"
                onClick={() => setAction("income")}
              >
                {d.addIncome}
              </button>
              <button
                className="btn btn--outline"
                onClick={() => setAction("corporate")}
              >
                {d.corporate}
              </button>
            </div>
          )}
          {h.notes && (
            <section className="iv-card ivd-note">
              <h2>{d.note}</h2>
              <p>{h.notes}</p>
            </section>
          )}
        </>
      ) : tab === "transactions" ? (
        rows.isPending ? (
          <p role="status">{c.loading}</p>
        ) : rows.isError ? (
          <p role="alert">{c.error}</p>
        ) : (
          <DetailTransactions {...common} />
        )
      ) : (
        <DetailDocuments
          id={h.id}
          fg={fg!}
          token={token!}
          canManage={!!canManage}
        />
      )}
      {action === "metadata" && (
        <DetailMetadata
          holding={h}
          platforms={platforms.data ?? []}
          members={members.data ?? []}
          isMaster={myRole === "owner" || myRole === "spouse"}
          fg={fg!}
          token={token!}
          onSaved={onSaved}
          onClose={() => setAction(null)}
        />
      )}
      {(action === "buy" || action === "sell") && (
        <TradeForm
          initialId={h.id}
          kind={action}
          holdings={[h]}
          platforms={platforms.data ?? []}
          fg={fg!}
          token={token!}
          onSaved={onSaved}
          onClose={() => setAction(null)}
        />
      )}
      {action === "price" && (
        <PriceForm
          initialId={h.id}
          holdings={[h]}
          valuations={[v]}
          platforms={platforms.data ?? []}
          fg={fg!}
          token={token!}
          onSaved={onSaved}
          onClose={() => setAction(null)}
        />
      )}
      {(action === "income" || action === "corporate") && (
        <DetailEventForm
          holding={h}
          platforms={platforms.data ?? []}
          corporate={action === "corporate"}
          fg={fg!}
          token={token!}
          onSaved={onSaved}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}
