import { Injectable } from "@nestjs/common";

import {
  accountPrivacyWhere,
  canSeePrivateItems,
  isRowScoped,
  restrictedAccountWhere,
} from "../../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CryptoService } from "../../crypto/crypto.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceNetWorthService } from "../../insurances/value/insurance-net-worth.service";
import { investmentAccessWhere } from "../../investments/investment-access";
import { dbDateToYmd } from "../../investments/ledger/ledger-dates";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentValuationService } from "../../investments/valuation/investment-valuation.service";
import {
  idrPerUnit,
  jakartaYmd,
} from "../../investments/valuation/valuation-core";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";
import { assetAccessWhere } from "../asset-access";

import { accountRow, maskAccountNumber } from "./account-rows";
import { insuranceRow } from "./insurance-rows";
import { investmentRow } from "./investment-rows";
import { D, displayFn } from "./overview-model";
import {
  assertQuery,
  countedTotal,
  isFiltered,
  paginate,
  selectRows,
  summarize,
} from "./overview-query";
import { physicalRow } from "./physical-rows";

import type { Acquisition, PreviousPrice } from "./investment-rows";
import type { BuiltRow, Decimal, RowContext } from "./overview-model";
import type { OverviewHistory } from "./physical-rows";
import type { AssetViewer } from "../asset-access";
import type { AssetsOverviewQueryDto } from "../dto/assets-overview-query.dto";
import type { AssetsOverviewDto } from "@wealthme/contracts";

export type OverviewViewer = AssetViewer;

interface PrevPriceRow extends PreviousPrice {
  investmentId: string;
}

/** First buy/opening date per holding and whether there were several. */
function acquisitions(
  rows: { ownerId: string; effectiveDate: Date }[],
): Map<string, Acquisition> {
  const out = new Map<string, Acquisition>();
  for (const r of rows) {
    const ymd = dbDateToYmd(r.effectiveDate);
    const cur = out.get(r.ownerId);
    out.set(r.ownerId, {
      date: !cur?.date || ymd < cur.date ? ymd : cur.date,
      multiple: cur !== undefined,
    });
  }
  return out;
}

/**
 * Aset A1 — GET …/assets/overview. One server-side source for the Aset page:
 * accounts under the net-worth rule (includeInNetWorth, privacy, row
 * scope), investment holdings through the shared Investasi valuation (no
 * second formula), physical assets (active, unlinked, row-scoped A7), and
 * confirmed insurance policy value through the shared S6 helper.
 * The web no longer sums anything itself.
 */
@Injectable()
export class AssetsOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valuation: InvestmentValuationService,
    private readonly insuranceNetWorth: InsuranceNetWorthService,
    private readonly crypto: CryptoService,
  ) {}

  async overview(
    familyGroupId: string,
    query: AssetsOverviewQueryDto,
    viewer: OverviewViewer,
  ): Promise<AssetsOverviewDto> {
    assertQuery(query);
    const now = new Date();
    const displayCurrency = query.displayCurrency ?? "IDR";
    const [rows, liabilities, fx] = await Promise.all([
      this.buildRows(familyGroupId, viewer, displayCurrency, now),
      this.liabilities(familyGroupId, viewer),
      displayCurrency === "IDR"
        ? Promise.resolve(null)
        : this.valuation.valuationFx(),
    ]);
    const display = displayFn(idrPerUnit(fx, displayCurrency));
    const built = rows(display);
    const selected = selectRows(built, query);
    const filtered = isFiltered(query);
    const { page, meta } = paginate(selected, query);
    const netWorth =
      liabilities === null ? null : countedTotal(built).minus(liabilities);
    return {
      rows: page.map((r) => r.dto),
      summary: summarize({
        rows: filtered ? selected : built,
        filtered,
        netWorthIdr: netWorth,
        liabilitiesIdr: liabilities,
        valuationDate: jakartaYmd(now),
        displayCurrency,
        display,
      }),
      meta,
    };
  }

  /** Family liabilities; null for a row-scoped viewer (not theirs to net). */
  private async liabilities(
    familyGroupId: string,
    viewer: OverviewViewer,
  ): Promise<Decimal | null> {
    if (isRowScoped(viewer.member)) return null;
    const agg = await this.prisma.liability.aggregate({
      where: { familyGroupId },
      _sum: { remainingBalance: true },
    });
    return new D((agg._sum.remainingBalance ?? 0n).toString());
  }

  private async buildRows(
    familyGroupId: string,
    viewer: OverviewViewer,
    displayCurrency: string,
    now: Date,
  ): Promise<(display: RowContext["display"]) => BuiltRow[]> {
    const member = viewer.member;
    const userId = viewer.userId ?? undefined;
    const [accounts, holdings, assets, policies] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          familyGroupId,
          ...accountPrivacyWhere(canSeePrivateItems(member?.role)),
          ...restrictedAccountWhere(member, userId),
          includeInNetWorth: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.valuation.valueFamily(
        familyGroupId,
        { AND: [investmentAccessWhere({ member, userId: userId ?? null })] },
        now,
      ),
      this.prisma.asset.findMany({
        where: {
          familyGroupId,
          investmentId: null,
          ...assetAccessWhere(member, userId),
        },
        orderBy: { createdAt: "asc" },
      }),
      // Asuransi S6 — the same helper (and the same viewer rule) the
      // dashboard uses, so overview net worth equals dashboard net worth:
      // a row-scoped viewer counts only the policies they can see.
      this.insuranceNetWorth.positions(
        familyGroupId,
        isRowScoped(member)
          ? {
              userId: viewer.userId,
              role: member?.role ?? null,
              rowScoped: true,
            }
          : undefined,
      ),
    ]);
    const invIds = holdings.map((h) => h.row.id);
    const assetIds = assets.map((a) => a.id);
    const platformIds = [
      ...new Set(
        [
          ...holdings.map((h) => h.row.platformAccountId),
          ...accounts.map((a) => a.platformAccountId),
        ].filter((v): v is string => !!v),
      ),
    ];
    const ownerIds = [
      ...new Set(
        [
          ...accounts.map((a) => a.ownerUserId),
          ...holdings.map((h) => h.row.ownerUserId),
          ...assets.map((a) => a.ownerUserId),
          ...policies.map((p) => p.holderUserId),
        ].filter((v): v is string => !!v),
      ),
    ];
    const [prev, invTx, linked, platforms, users, history, assetTx] =
      await Promise.all([
        this.previousPrices(invIds),
        this.prisma.investmentTransaction.findMany({
          where: {
            investmentId: { in: invIds },
            status: "active",
            kind: { in: ["buy", "opening"] },
          },
          select: { investmentId: true, effectiveDate: true },
        }),
        this.prisma.asset.findMany({
          where: {
            familyGroupId,
            investmentId: { in: invIds },
            status: "active",
            ...assetAccessWhere(member, userId),
          },
          select: {
            id: true,
            investmentId: true,
            internalCode: true,
            custodian: true,
          },
        }),
        this.prisma.platformAccount.findMany({
          where: { familyGroupId, id: { in: platformIds } },
          select: {
            id: true,
            customName: true,
            label: true,
            platformKey: true,
          },
        }),
        this.prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true },
        }),
        this.prisma.assetHistory.findMany({
          where: { assetId: { in: assetIds }, status: "active" },
          // A4 effective order, newest first.
          orderBy: [
            { effectiveDate: "desc" },
            { hasTime: "desc" },
            { effectiveAt: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
          ],
        }),
        this.prisma.assetTransaction.findMany({
          where: {
            assetId: { in: assetIds },
            status: "active",
            kind: { in: ["buy", "opening"] },
          },
          select: { assetId: true, effectiveDate: true },
        }),
      ]);

    const platformName = new Map(
      platforms.map((p) => [p.id, p.customName ?? p.label ?? p.platformKey]),
    );
    const linkedBy = new Map(linked.map((a) => [a.investmentId!, a]));
    const invAcq = acquisitions(
      invTx.map((t) => ({
        ownerId: t.investmentId,
        effectiveDate: t.effectiveDate,
      })),
    );
    const assetAcq = acquisitions(
      assetTx.map((t) => ({
        ownerId: t.assetId,
        effectiveDate: t.effectiveDate,
      })),
    );
    const historyBy = new Map<string, OverviewHistory[]>();
    for (const h of history) {
      historyBy.set(h.assetId, [...(historyBy.get(h.assetId) ?? []), h]);
    }

    // A3 — possible duplicates are flagged for the user, never merged.
    const activeAssets = assets.filter((a) => a.status === "active");
    const dupProperty =
      accounts.some((a) => a.type === "property") &&
      activeAssets.some((a) => a.type === "properti");
    const dupGold =
      holdings.some((h) => h.row.type === "emas" && !h.row.quantity.isZero()) &&
      activeAssets.some((a) => a.type === "emas");

    const ownerNames = new Map(users.map((u) => [u.id, u.name]));
    return (display) => {
      const ctx: RowContext = { display, displayCurrency, ownerNames };
      return [
        ...accounts.map((a) =>
          accountRow(
            {
              ...a,
              // Stored encrypted: decrypt, then expose only the last digits.
              maskedNumber: maskAccountNumber(
                a.maskedNumber ? this.crypto.tryDecrypt(a.maskedNumber) : null,
              ),
              institution:
                a.institution ??
                (a.platformAccountId
                  ? (platformName.get(a.platformAccountId) ?? null)
                  : null),
            },
            ctx,
            dupProperty && a.type === "property",
          ),
        ),
        ...holdings.map((h) =>
          investmentRow(
            {
              holding: h,
              platformName: h.row.platformAccountId
                ? (platformName.get(h.row.platformAccountId) ?? null)
                : null,
              previous: prev.get(h.row.id) ?? null,
              acquisition: invAcq.get(h.row.id) ?? null,
              linkedAsset: linkedBy.get(h.row.id) ?? null,
            },
            ctx,
            dupGold && h.row.type === "emas" && !linkedBy.has(h.row.id),
          ),
        ),
        ...assets.map((a) =>
          physicalRow(
            a,
            historyBy.get(a.id) ?? [],
            assetAcq.get(a.id) ?? null,
            ctx,
            (dupProperty && a.type === "properti") ||
              (dupGold && a.type === "emas"),
          ),
        ),
        ...policies.map((p) => insuranceRow(p, ctx)),
      ];
    };
  }

  /**
   * The non-simulated price observation just before the latest one, by the
   * same effective order InvestmentValuationService uses for the latest.
   */
  private async previousPrices(
    ids: string[],
  ): Promise<Map<string, PreviousPrice>> {
    if (ids.length === 0) return new Map();
    const found = await this.prisma.$queryRaw<PrevPriceRow[]>`
      SELECT p."investmentId", p."price", p."currency", p."unitLabel",
             p."asOf", p."recordedAt"
      FROM unnest(${ids}::text[]) AS h(id)
      CROSS JOIN LATERAL (
        SELECT * FROM "investment_prices" ip
        WHERE ip."investmentId" = h.id AND ip."source" <> 'mock'
        ORDER BY COALESCE(ip."asOf", ip."recordedAt") DESC, ip."recordedAt" DESC, ip."id" DESC
        OFFSET 1 LIMIT 1
      ) p`;
    return new Map(
      found.map((p) => [p.investmentId, { ...p, price: new D(p.price) }]),
    );
  }
}
