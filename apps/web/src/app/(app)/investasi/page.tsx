"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  Plus,
  RefreshCw,
  ChartNoAxesCombined,
} from "lucide-react";
import type {
  InvestmentDto,
  InvestmentPortfolioValuationDto,
  InvestmentTransactionDto,
  PlatformAccountDto,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
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
import type { InvestmentAction, PortfolioHistory } from "./portfolio-model";
import "./investasi.css";

export default function InvestasiPage() {
  const { t } = useLocale();
  const c = t.investasi.v3;
  const { data: session } = useSession();
  const token = session?.accessToken;
  const fg = session?.familyGroupId;
  const { canManage } = useCanManage("Investment");
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
    const params = new URLSearchParams(searchParams.toString());
    params.set("action", action.kind);
    if (action.investmentId) params.set("investment", action.investmentId);
    else params.delete("investment");
    window.history.pushState(null, "", `/investasi?${params}`);
  };
  return (
    <div className="iv">
      <header className="iv-header">
        <div>
          <p className="iv-title">{c.title}</p>
          <p>{c.subtitle}</p>
        </div>
        <div className="iv-header-actions">
          {canManage && (
            <>
              <button
                className="btn btn--outline"
                disabled
                title={c.futureTask}
                onClick={() => onAction({ kind: "topup" })}
              >
                <ArrowDownToLine />
                {c.topUp}
              </button>
              <button
                className="btn btn--outline"
                disabled
                title={c.futureTask}
                onClick={() => onAction({ kind: "price" })}
              >
                <RefreshCw />
                {c.updatePrice}
              </button>
              <button
                className="btn btn--primary"
                disabled
                title={c.futureTask}
                onClick={() => onAction({ kind: "add" })}
              >
                <Plus />
                {c.add}
              </button>
            </>
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
        {(["portfolio", "funds", "history"] as const).map((key) => (
          <Link
            key={key}
            href={`/investasi?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
          >
            {c[key]}
          </Link>
        ))}
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
            <div className="iv-types">
              {TYPES.map((type) => (
                <button
                  key={type}
                  className="btn btn--outline"
                  aria-pressed={filters.type === type}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      type: filters.type === type ? "" : type,
                    })
                  }
                >
                  <ChartNoAxesCombined />
                  {c[type]}
                </button>
              ))}
            </div>
          </section>
          <PortfolioActivityList
            rows={activity.data ?? []}
            loading={activity.isPending}
            error={activity.isError}
          />
        </>
      ) : tab === "funds" ? (
        <PortfolioCashPreview
          platforms={visiblePlatforms}
          onTopup={canManage ? () => onAction({ kind: "topup" }) : undefined}
        />
      ) : (
        <PortfolioActivityList
          rows={activity.data ?? []}
          loading={activity.isPending}
          error={activity.isError}
        />
      )}
    </div>
  );
}
