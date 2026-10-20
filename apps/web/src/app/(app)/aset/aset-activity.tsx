"use client";

import { createElement } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import type {
  AssetHistoryEventDto,
  AssetLedgerDto,
  AssetOverviewRowDto,
} from "@wealthme/contracts";
import { apiFetch } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fmtDate, fmtQty, fmtTime, rowIcon, roundIdr } from "./aset-model";
import "./aset-activity.css";

/** Physical assets whose ledgers feed the feed (bounded: API throttle). */
const MAX_ASSETS = 5;
const MAX_EVENTS = 6;

interface FeedItem {
  event: AssetHistoryEventDto;
  name: string;
  href: string;
  icon: LucideIcon;
}

function orderKey(e: AssetHistoryEventDto): string {
  // A4 order: effective date, date-only before timed, then the instant.
  return `${e.effectiveDate}|${e.hasTime ? 1 : 0}|${e.effectiveAt}|${e.createdAt}`;
}

/**
 * Recent asset activity — read from each physical asset's own ledger
 * (`GET …/assets/:id/events`), never synthesised. There is no family-wide
 * activity endpoint yet, so the feed covers the top physical assets of the
 * current page and says so.
 */
export function AsetActivity({
  rows,
  familyGroupId,
  token,
}: {
  rows: AssetOverviewRowDto[];
  familyGroupId: string;
  token: string | undefined;
}) {
  const { t, locale } = useLocale();
  const c = t.aset.v3;
  const money = useMoney();
  const assets = rows
    .filter((r) => r.sourceModule === "assets")
    .slice(0, MAX_ASSETS);
  const results = useQueries({
    queries: assets.map((r) => ({
      queryKey: ["assets", familyGroupId, r.sourceId, "events"],
      enabled: Boolean(token && familyGroupId),
      staleTime: 60_000,
      queryFn: () =>
        apiFetch<AssetLedgerDto>(
          `/family-groups/${familyGroupId}/assets/${r.sourceId}/events`,
          { token },
        ),
    })),
  });
  if (!assets.length) return null;
  const isLoading = results.some((q) => q.isLoading);
  const items: FeedItem[] = results
    .flatMap((q, i) =>
      (q.data?.events ?? []).map((event) => ({
        event,
        name: assets[i]!.name,
        href: `/aset/${assets[i]!.sourceId}`,
        icon: rowIcon(assets[i]!),
      })),
    )
    .sort((a, b) => orderKey(b.event).localeCompare(orderKey(a.event)))
    .slice(0, MAX_EVENTS);

  const detail = (e: AssetHistoryEventDto): string => {
    if (e.kind === "buy" || e.kind === "sell" || e.kind === "quantity_change") {
      const unit = e.unit ? ` ${e.unit}` : "";
      return `${fmtQty(e.quantityBefore, locale)} → ${fmtQty(e.quantityAfter, locale)}${unit}`;
    }
    const to = money.formatExact(roundIdr(e.value));
    return e.valueBefore
      ? `${money.formatExact(roundIdr(e.valueBefore))} → ${to}`
      : to;
  };
  const impact = (e: AssetHistoryEventDto): { text: string; tone: string } => {
    if (e.changeIdr == null) return { text: "—", tone: "none" };
    const n = roundIdr(e.changeIdr);
    if (n === BigInt(0)) return { text: money.formatExact(n), tone: "flat" };
    const sign = n > BigInt(0) ? "+" : "−";
    return {
      text: `${sign}${money.formatExact(n < BigInt(0) ? -n : n)}`,
      tone: n > BigInt(0) ? "up" : "down",
    };
  };

  return (
    <section className="as3-card as3-activity" aria-busy={isLoading}>
      <div className="as3-section-head">
        <div>
          <h2>{c.activityTitle}</h2>
          <p>{c.activitySub}</p>
        </div>
      </div>
      {!items.length ? (
        <p className="as3-muted">{isLoading ? c.loading : c.activityEmpty}</p>
      ) : (
        <table className="as3-act">
          <thead>
            <tr>
              <th scope="col">{c.activityWhen}</th>
              <th scope="col">{c.activityAsset}</th>
              <th scope="col">{c.activityKind}</th>
              <th scope="col">{c.activityDetail}</th>
              <th scope="col" className="as3-act-num">
                {c.activityImpact}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ event: e, name, href, icon }) => {
              const imp = impact(e);
              return (
                <tr key={e.id} data-void={e.status === "void" || undefined}>
                  <td className="as3-act-when">
                    {fmtDate(e.effectiveDate, locale)}
                    <small>
                      {e.hasTime
                        ? `${fmtTime(e.effectiveAt, locale)} WIB`
                        : c.dateOnly}
                    </small>
                  </td>
                  <td className="as3-act-asset">
                    <span className="as3-act-asset-in">
                      <span className="as3-act-ic" aria-hidden="true">
                        {createElement(icon)}
                      </span>
                      <Link href={href}>{name}</Link>
                    </span>
                  </td>
                  <td className="as3-act-kind">
                    {c.activityKinds[e.kind]}
                    {e.status === "void" ? ` · ${c.voided}` : ""}
                  </td>
                  <td className="as3-act-detail">{detail(e)}</td>
                  <td className="as3-act-num" data-tone={imp.tone}>
                    <span className="sr-only">{c.activityImpact}: </span>
                    {imp.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
