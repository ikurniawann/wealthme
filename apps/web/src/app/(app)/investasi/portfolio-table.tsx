"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type {
  InvestmentDto,
  InvestmentValuationDto,
  PlatformAccountDto,
} from "@wealthme/contracts";
import { compareDecimal, money, quantity } from "./portfolio-model";
import type { InvestmentAction } from "./portfolio-model";

export function PortfolioTable({
  holdings,
  valuations,
  platforms,
  canManage,
  onAction,
}: {
  holdings: InvestmentDto[];
  valuations: InvestmentValuationDto[];
  platforms: PlatformAccountDto[];
  canManage: boolean;
  onAction: (action: InvestmentAction) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const { hideBalance } = useMoney();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("valueHigh");
  const [page, setPage] = useState(1);
  const valueById = new Map(valuations.map((v) => [v.investmentId, v]));
  const visible = useMemo(
    () =>
      holdings
        .filter((h) =>
          `${h.name} ${h.ticker}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : (sort === "valueLow" ? 1 : -1) *
              compareDecimal(
                a.valuation?.marketValueIdr ?? null,
                b.valuation?.marketValueIdr ?? null,
              ),
        ),
    [holdings, search, sort],
  );
  const pages = Math.max(1, Math.ceil(visible.length / 20));
  const current = Math.min(page, pages);
  const rows = visible.slice((current - 1) * 20, current * 20);
  return (
    <section className="iv-card">
      <div className="iv-section-head">
        <h2>
          {c.portfolio} ({visible.length})
        </h2>
        <div className="iv-tools">
          <label className="iv-search">
            <Search aria-hidden="true" />
            <input
              className="input"
              aria-label={c.search}
              placeholder={c.search}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="field">
            <span className="sr-only">{c.sort}</span>
            <select
              className="select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="valueHigh">{c.valueHigh}</option>
              <option value="valueLow">{c.valueLow}</option>
              <option value="name">{c.name}</option>
            </select>
          </label>
        </div>
      </div>
      {!rows.length ? (
        <p className="iv-empty">{holdings.length ? c.noResults : c.empty}</p>
      ) : (
        <div className="iv-table-wrap">
          <table className="iv-table">
            <thead>
              <tr>
                {[
                  c.instrument,
                  c.platform,
                  c.holdings,
                  c.average,
                  c.price,
                  c.value,
                  c.pnl,
                  c.actions,
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const v = valueById.get(h.id) ?? h.valuation;
                const p = platforms.find((p) => p.id === h.platformAccountId);
                const pocket = p?.pockets?.find(
                  (p) => p.id === h.cashAccountId,
                );
                const fmt = (s: string | null | undefined, cur = "IDR") =>
                  money(s, cur, locale, hideBalance);
                return (
                  <tr key={h.id}>
                    <td data-label={c.instrument}>
                      <div className="iv-instrument">
                        <span className="iv-instrument-mark" aria-hidden="true">
                          {h.ticker.slice(0, 3)}
                        </span>
                        <div>
                          <strong>{h.ticker}</strong>
                          <span>{h.name}</span>
                          <small>
                            {v?.market ?? h.market ?? c.completeMarket} ·{" "}
                            {c[h.type]}
                          </small>
                          {h.market == null && (
                            <small>{c.completeMarket}</small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td data-label={c.platform}>
                      {p?.label ??
                        p?.platformName ??
                        p?.customName ??
                        c.unassigned}
                      <small>{pocket?.name ?? "—"}</small>
                    </td>
                    <td data-label={c.holdings}>
                      {hideBalance ? "••••" : quantity(h, c, locale)}
                    </td>
                    <td data-label={c.average}>
                      {money(
                        h.details?.costBasisKnown === false
                          ? null
                          : h.costBasisPerUnit,
                        "IDR",
                        locale,
                        hideBalance,
                        2,
                      )}
                      <small>IDR · {c.perUnit}</small>
                    </td>
                    <td data-label={c.price}>
                      {money(
                        v?.price?.value,
                        v?.price?.currency ?? "IDR",
                        locale,
                        hideBalance,
                        8,
                      )}
                      <small>
                        {v?.price
                          ? `${v.price.source} · ${new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(v.price.asOf))}`
                          : v?.basis === "cost_basis"
                            ? c.costBasis
                            : c.noPrice}
                      </small>
                      {v?.price?.stale && (
                        <small>
                          {c.stale} · {v.price.ageDays} {c.days}
                        </small>
                      )}
                    </td>
                    <td data-label={c.value}>
                      {fmt(
                        v?.display?.marketValue ??
                          (v?.display ? null : v?.marketValueIdr),
                        v?.display?.currency ?? "IDR",
                      )}
                      {v?.valuationFx && (
                        <small>
                          {v.valuationFx.idrPerUnit} IDR/
                          {v.valuationFx.currency} · {v.valuationFx.rateDate}
                        </small>
                      )}
                    </td>
                    <td data-label={c.pnl}>
                      {v?.unrealizedIdr &&
                      Number(v.unrealizedIdr) > 0 &&
                      !hideBalance
                        ? "+"
                        : ""}
                      {fmt(
                        v?.display?.unrealized ??
                          (v?.display ? null : v?.unrealizedIdr),
                        v?.display?.currency ?? "IDR",
                      )}
                      <small>
                        {hideBalance || v?.unrealizedPct == null
                          ? "—"
                          : `${v.unrealizedPct > 0 ? "+" : ""}${v.unrealizedPct}%`}
                      </small>
                    </td>
                    <td>
                      <div className="iv-row-actions">
                        <Link
                          className="btn btn--outline btn--sm"
                          href={`/investasi/${h.id}`}
                        >
                          {c.detail}
                        </Link>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="btn btn--outline btn--icon"
                              aria-label={`${c.actions}: ${h.name}`}
                            >
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuGroup>
                                {(["buy", "sell", "price"] as const).map(
                                  (kind) => (
                                    <DropdownMenuItem
                                      key={kind}
                                      disabled
                                      title={c.futureTask}
                                      onClick={() =>
                                        onAction({ kind, investmentId: h.id })
                                      }
                                    >
                                      {kind === "price"
                                        ? c.updatePrice
                                        : c[kind]}
                                    </DropdownMenuItem>
                                  ),
                                )}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <nav className="iv-pagination" aria-label={c.page}>
        <button
          className="btn btn--outline"
          disabled={current <= 1}
          onClick={() => setPage(current - 1)}
        >
          {c.previous}
        </button>
        <span>
          {c.page} {current} / {pages}
        </span>
        <button
          className="btn btn--outline"
          disabled={current >= pages}
          onClick={() => setPage(current + 1)}
        >
          {c.next}
        </button>
      </nav>
    </section>
  );
}
