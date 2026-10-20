"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  History,
  ChartPie,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import type {
  AccountDto,
  InvestmentDto,
  InvestmentPortfolioValuationDto,
  InvestmentTransactionDto,
  PlatformAccountDto,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { useInvestmentInvalidation } from "./use-investment-invalidation";
import { PriceForm } from "./price-form";
import { TradeForm } from "./trade-form";
import { PositionForm } from "./position-form";
import { PlatformFunds } from "./platform-funds";
import { PocketTransfer } from "./pocket-transfer";
import { InvestmentHistory } from "./investment-history";
import { useMyRole } from "@/hooks/use-my-role";
import { PortfolioSummary } from "./portfolio-summary";
import { PortfolioFilterBar } from "./portfolio-filters";
import type { PortfolioMember } from "./portfolio-filters";
import { PortfolioTable } from "./portfolio-table";
import {
  PortfolioChart,
  PortfolioCashPreview,
  PortfolioActivityList,
  mergeActivity,
} from "./portfolio-overview";
import { INITIAL_FILTERS, TYPES, queryString } from "./portfolio-model";
import { TYPE_ICONS } from "./type-icons";
import type { InvestmentAction, PortfolioHistory } from "./portfolio-model";
import "./investasi.css";

function InvestasiContent() {
  const { t } = useLocale();
  const c = t.investasi.v3;
  const { data: session } = useSession();
  const token = session?.accessToken;
  const fg = session?.familyGroupId;
  const { canManage } = useCanManage("Investment");
  const { myRole } = useMyRole();
  const onSaved = useInvestmentInvalidation();
  const [priceOpen, setPriceOpen] = useState<{ id?: string } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState<{
    id: string;
    kind: "buy" | "sell";
  } | null>(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const searchParams = useSearchParams();
  const tab = ["portfolio", "funds", "history"].includes(
    searchParams.get("tab") ?? "",
  )
    ? searchParams.get("tab")!
    : "portfolio";
  const enabled = !!token && !!fg;
  const base = `/family-groups/${fg}`;
  const options = { token };
  const accounts = useQuery({
    queryKey: ["investment-transfer-accounts", fg, token],
    queryFn: () => apiFetch<AccountDto[]>(`${base}/accounts`, options),
    enabled,
  });
  const investments = useQuery({
    queryKey: ["investments-v3", fg, token],
    queryFn: () => apiFetch<InvestmentDto[]>(`${base}/investments`, options),
    enabled,
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
  const qs = queryString(filters);
  const valuation = useQuery({
    queryKey: ["investment-valuation", fg, token, qs],
    queryFn: () =>
      apiFetch<InvestmentPortfolioValuationDto>(
        `${base}/investments/valuation?${qs}`,
        options,
      ),
    enabled,
  });
  const history = useQuery({
    queryKey: ["investment-value-history", fg, token, qs],
    queryFn: () =>
      apiFetch<PortfolioHistory>(
        `${base}/investments/value-history?${qs}`,
        options,
      ),
    enabled,
  });
  const visibleIds = useMemo(
    () => new Set(valuation.data?.holdings.map((v) => v.investmentId)),
    [valuation.data],
  );
  const holdings = useMemo(
    () => (investments.data ?? []).filter((h) => visibleIds.has(h.id)),
    [investments.data, visibleIds],
  );
  const activity = useQuery({
    queryKey: [
      "investment-activity",
      fg,
      token,
      holdings.map((h) => h.id).join(","),
    ],
    queryFn: async () =>
      mergeActivity(
        holdings,
        await Promise.all(
          holdings.map((h) =>
            apiFetch<InvestmentTransactionDto[]>(
              `${base}/investments/${h.id}/transactions`,
              options,
            ),
          ),
        ),
      ),
    enabled: enabled && !!valuation.data && !!investments.data,
  });
  const error = investments.isError || valuation.isError || platforms.isError;
  const loading =
    !enabled ||
    investments.isPending ||
    valuation.isPending ||
    platforms.isPending;
  const visiblePlatforms = (platforms.data ?? []).filter(
    (p) =>
      (!filters.ownerUserId || p.ownerUserId === filters.ownerUserId) &&
      (!filters.platformAccountId || p.id === filters.platformAccountId),
  );
  // The action URL is the stable hand-off to the forms added in Tasks 10–13.
  const onAction = (action: InvestmentAction) => {
    if (
      (action.kind === "buy" || action.kind === "sell") &&
      action.investmentId
    ) {
      setTradeOpen({ id: action.investmentId, kind: action.kind });
      return;
    }
    if (action.kind === "price") {
      setPriceOpen({ id: action.investmentId });
      return;
    }
    if (action.kind === "add") {
      setPositionOpen(true);
      return;
    }
    if (action.kind === "topup") {
      setTransferOpen(true);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("action", action.kind);
    if (action.investmentId) params.set("investment", action.investmentId);
    else params.delete("investment");
    window.history.pushState(null, "", `/investasi?${params}`);
  };
  return (
    <div className="iv">
      <header className="iv-header">
        <div className="iv-heading">
          <p className="iv-title">{c.title}</p>
          <p>{c.subtitle}</p>
        </div>
        <div className="iv-header-side">
          {canManage && (
            <div className="iv-header-actions">
              <button
                className="btn btn--outline"
                onClick={() => onAction({ kind: "topup" })}
              >
                <ArrowDownToLine />
                {c.topUp}
              </button>
              <button
                className="btn btn--outline"
                onClick={() => onAction({ kind: "price" })}
              >
                <RefreshCw />
                {c.updatePrice}
              </button>
              <button
                className="btn btn--primary iv-add"
                onClick={() => onAction({ kind: "add" })}
              >
                <Plus />
                {c.add}
              </button>
            </div>
          )}
          <span className="iv-manual">{c.manual}</span>
        </div>
      </header>
      <PortfolioSummary
        data={!error && !loading ? valuation.data : undefined}
      />
      <PortfolioFilterBar
        value={filters}
        onChange={setFilters}
        platforms={platforms.data ?? []}
        members={members.data ?? []}
      />
      <nav className="iv-tabs" aria-label={c.title}>
        {(["portfolio", "funds", "history"] as const).map((key) => {
          const Icon = { portfolio: ChartPie, funds: Wallet, history: History }[
            key
          ];
          return (
            <Link
              key={key}
              href={`/investasi?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              {c[key]}
            </Link>
          );
        })}
      </nav>
      {error ? (
        <section className="iv-card iv-empty" role="alert">
          <p>{c.error}</p>
          <button
            className="btn btn--outline"
            onClick={() => {
              void investments.refetch();
              void valuation.refetch();
              void platforms.refetch();
            }}
          >
            {c.retry}
          </button>
        </section>
      ) : loading ? (
        <p className="iv-card iv-empty" role="status">
          {c.loading}
        </p>
      ) : tab === "portfolio" ? (
        <>
          <div className="iv-overview">
            <PortfolioChart
              data={history.data}
              loading={history.isPending}
              error={history.isError}
            />
            <PortfolioCashPreview
              platforms={visiblePlatforms}
              onTopup={
                canManage ? () => onAction({ kind: "topup" }) : undefined
              }
            />
          </div>
          <PortfolioTable
            holdings={holdings}
            valuations={valuation.data?.holdings ?? []}
            platforms={platforms.data ?? []}
            canManage={!!canManage}
            onAction={onAction}
          />
          <section className="iv-card">
            <h2>{c.typesTitle}</h2>
            <div className="iv-type-grid">
              {TYPES.map((type) => {
                const Icon = TYPE_ICONS[type];
                return (
                  <button
                    key={type}
                    className="iv-type"
                    data-type={type}
                    aria-pressed={filters.type === type}
                    onClick={() =>
                      setFilters({
                        ...filters,
                        type: filters.type === type ? "" : type,
                      })
                    }
                  >
                    <span className="iv-type-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    {c[type]}
                  </button>
                );
              })}
            </div>
          </section>
          <PortfolioActivityList
            rows={activity.data ?? []}
            loading={activity.isPending}
            error={activity.isError}
          />
        </>
      ) : tab === "funds" ? (
        <PlatformFunds
          platforms={visiblePlatforms}
          accounts={accounts.data ?? []}
          members={members.data ?? []}
          fg={fg!}
          token={token!}
          myUserId={session?.userId ?? ""}
          isMaster={myRole === "owner" || myRole === "spouse"}
          canManage={!!canManage}
          onSaved={onSaved}
        />
      ) : (
        <InvestmentHistory
          rows={activity.data ?? []}
          platforms={visiblePlatforms}
          fg={fg!}
          token={token!}
          loading={activity.isPending}
          error={activity.isError}
          canManage={!!canManage}
          onSaved={onSaved}
        />
      )}
      {priceOpen && enabled && (
        <PriceForm
          initialId={priceOpen.id}
          holdings={investments.data ?? []}
          valuations={valuation.data?.holdings ?? []}
          platforms={platforms.data ?? []}
          fg={fg!}
          token={token!}
          onClose={() => setPriceOpen(null)}
          onSaved={onSaved}
        />
      )}
      {tradeOpen && enabled && !!investments.data?.length && (
        <TradeForm
          initialId={tradeOpen.id}
          kind={tradeOpen.kind}
          holdings={investments.data}
          platforms={platforms.data ?? []}
          fg={fg!}
          token={token!}
          onClose={() => setTradeOpen(null)}
          onSaved={onSaved}
        />
      )}
      {positionOpen && enabled && (
        <PositionForm
          fg={fg!}
          token={token!}
          myUserId={session?.userId ?? ""}
          isMaster={myRole === "owner" || myRole === "spouse"}
          members={members.data ?? []}
          platforms={platforms.data ?? []}
          onClose={() => setPositionOpen(false)}
          onSaved={onSaved}
        />
      )}
      {transferOpen && enabled && (
        <PocketTransfer
          platforms={platforms.data ?? []}
          accounts={accounts.data ?? []}
          fg={fg!}
          token={token!}
          onClose={() => setTransferOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

export default function InvestasiPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p role="status">{t.investasi.v3.loading}</p>}>
      <InvestasiContent />
    </Suspense>
  );
}
