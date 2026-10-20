import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  dbDateToYmd,
  ledgerInstant,
  ymdToDbDate,
} from "../../investments/ledger/ledger-dates";
import {
  holdingsConflict,
  round2,
} from "../../investments/ledger/ledger-support";
import { replayLedger } from "../../investments/ledger/replay";
import { viewerAssetWhere } from "../asset-access";

import { walkTimeline } from "./asset-timeline";

import type { Timeline, TimelineRow, TxStep } from "./asset-timeline";
import type { TxClient } from "../../common/utils/serializable-retry.util";
import type { LedgerActor } from "../../investments/ledger/ledger-support";
import type { LedgerRow, ReplayResult } from "../../investments/ledger/replay";
import type { AssetViewer } from "../asset-access";
import type { Asset, AssetHistory, AssetTransaction } from "@prisma/client";
import type {
  AssetHistoryEventDto,
  AssetHoldingStateDto,
  AssetTransactionDto,
} from "@wealthme/contracts";

/**
 * Aset Task 18 — shared pieces of the asset ledger (transactions) and the
 * valuation writes. Everything here runs inside the caller's Serializable
 * transaction; `rebuildAsset` is the single place that turns the stored
 * events into quantity, cost, realized P/L, per-row values, current value
 * and status.
 */

const D = Prisma.Decimal;
export const ASSET_TX_ATTEMPTS = 5;

export type AssetActor = LedgerActor;

export function actorViewer(actor: AssetActor): AssetViewer {
  return {
    member: actor.member as AssetViewer["member"],
    userId: actor.userId,
  };
}

/**
 * Loads the asset with the A7 row scope (404). `lock` and `write` take the
 * row FOR UPDATE; `check` and `write` also refuse a linked or archived
 * asset (`lock` leaves that to the caller, so an idempotent replay can
 * answer first).
 */
export async function lockAsset(
  tx: TxClient,
  familyGroupId: string,
  assetId: string,
  viewer: AssetViewer | undefined,
  mode: "read" | "check" | "lock" | "write",
): Promise<Asset> {
  if (mode === "write" || mode === "lock") {
    await tx.$queryRaw`
      SELECT "id" FROM "assets"
      WHERE "id" = ${assetId} AND "familyGroupId" = ${familyGroupId}
      FOR UPDATE`;
  }
  const asset = await tx.asset.findFirst({
    where: { id: assetId, familyGroupId, AND: [viewerAssetWhere(viewer)] },
  });
  if (!asset) throw new NotFoundException("Asset not found");
  if (mode === "check" || mode === "write") assertWritable(asset);
  return asset;
}

/** Linked → write through Investasi; archived → no new records (409). */
export function assertWritable(asset: Asset): void {
  {
    if (asset.investmentId) {
      throw new ConflictException({
        statusCode: 409,
        code: "ASSET_LINKED_TO_INVESTMENT",
        message:
          "Aset ini tertaut ke investasi. Catat beli/jual dan harga melalui halaman Investasi agar nilainya dihitung sekali.",
      });
    }
    if (asset.status === "archived") {
      throw new ConflictException({
        statusCode: 409,
        code: "ASSET_ARCHIVED",
        message: "Aset ini diarsipkan dan tidak menerima pencatatan baru.",
      });
    }
  }
}

export function txToLedgerRow(t: AssetTransaction): LedgerRow {
  const price = t.pricePerUnit ?? new D(0);
  return {
    id: t.id,
    effectiveDate: dbDateToYmd(t.effectiveDate),
    effectiveTime: t.effectiveTime,
    createdAt: t.createdAt,
    kind: t.kind,
    quantity: t.quantity,
    pricePerUnit: price,
    grossAmount: t.grossAmount ?? t.quantity.times(price),
    fee: t.fee,
    tax: t.tax,
    currency: t.currency,
    fxRate: t.fxRate,
  };
}

/** Effective fields of the history row that mirrors a transaction. */
export function txHistoryEffective(t: {
  effectiveDate: string;
  effectiveTime: string | null;
  timeZone: string | null;
}): { effectiveAt: Date; effectiveDate: Date; hasTime: boolean } {
  return {
    effectiveAt: t.effectiveTime
      ? ledgerInstant(t.effectiveDate, t.effectiveTime, t.timeZone)
      : ymdToDbDate(t.effectiveDate),
    effectiveDate: ymdToDbDate(t.effectiveDate),
    hasTime: t.effectiveTime !== null,
  };
}

export function historyToRow(h: AssetHistory): TimelineRow {
  return {
    id: h.id,
    kind: h.kind,
    value: h.value,
    effectiveAt: h.effectiveAt,
    effectiveDate: h.effectiveDate,
    hasTime: h.hasTime,
    createdAt: h.createdAt,
    pricePerUnit: h.pricePerUnit,
    currency: h.currency,
    fxRate: h.fxRate,
    assetTransactionId: h.assetTransactionId,
  };
}

export interface AssetState {
  txs: AssetTransaction[];
  history: AssetHistory[];
  hasLedger: boolean;
  replay: ReplayResult;
  steps: Map<string, TxStep>;
  costKnown: boolean;
}

/**
 * Replays the asset's active transactions (R1 weighted average, R6 order —
 * the Investasi replay, unchanged) with `override` applied: rows to
 * replace/add (`upsert`) or drop (`dropId`). An invalid replay (sell beyond
 * holdings at its effective point or later) is a 409.
 */
export async function loadState(
  tx: TxClient,
  assetId: string,
  override: { upsert?: AssetTransaction; dropId?: string } = {},
  selfId?: string,
  /** `lenient` (reads): an invalid stored ledger is shown, not a 409. */
  mode: "strict" | "lenient" = "strict",
): Promise<AssetState> {
  const [all, history] = await Promise.all([
    tx.assetTransaction.findMany({ where: { assetId } }),
    tx.assetHistory.findMany({ where: { assetId, status: "active" } }),
  ]);
  let txs = all.filter(
    (t) =>
      t.status === "active" &&
      t.id !== override.dropId &&
      t.id !== override.upsert?.id,
  );
  if (override.upsert) txs = [...txs, override.upsert];
  const replay = replayLedger(txs.map(txToLedgerRow));
  if (replay.invalid && mode === "strict") {
    holdingsConflict(replay.invalid, selfId ?? "");
  }
  const byId = new Map(txs.map((t) => [t.id, t]));
  const steps = new Map<string, TxStep>();
  for (const s of replay.steps) {
    const t = byId.get(s.id)!;
    // A zero/unknown trade price (e.g. an opening with unknown cost) is
    // never a reference price.
    const price = t.pricePerUnit?.greaterThan(0) ? t.pricePerUnit : null;
    let priceIdr: Prisma.Decimal | null = null;
    if (price && t.currency === "IDR") priceIdr = price;
    else if (price && t.fxRate?.greaterThan(0))
      priceIdr = price.times(t.fxRate);
    steps.set(s.id, { quantityAfter: s.quantityAfter, priceIdr });
  }
  return {
    txs,
    history,
    hasLedger: all.length > 0 || !!override.upsert,
    replay,
    steps,
    costKnown: txs.every((t) => t.costBasisKnown),
  };
}

export function timelineOf(
  asset: Asset,
  state: AssetState,
  extra: TimelineRow[] = [],
): Timeline {
  return walkTimeline(
    [...state.history.map(historyToRow), ...extra],
    state.steps,
    asset.quantity,
    state.hasLedger,
  );
}

/**
 * Persists everything derived from the events: every active row's value /
 * value-before / quantities (a backdated buy re-prices later per-unit
 * valuations), realized P/L per sell, and the asset's quantity, weighted
 * average cost, current value (latest row by effective order) and status
 * (sold at quantity 0 after a sell; back to active when bought again).
 */
export async function rebuildAsset(
  tx: TxClient,
  asset: Asset,
): Promise<{ asset: Asset; state: AssetState; timeline: Timeline }> {
  const state = await loadState(tx, asset.id);
  const timeline = timelineOf(asset, state);
  for (const h of state.history) {
    const s = timeline.states.get(h.id);
    if (!s) continue;
    const same =
      h.value === s.value &&
      h.valueBefore === s.valueBefore &&
      decEq(h.quantityBefore, s.quantityBefore) &&
      decEq(h.quantityAfter, s.quantityAfter);
    if (same) continue;
    await tx.assetHistory.update({
      where: { id: h.id },
      data: {
        value: s.value,
        valueBefore: s.valueBefore,
        quantityBefore: s.quantityBefore,
        quantityAfter: s.quantityAfter,
      },
    });
  }
  const realized = new Map(
    state.replay.steps.map((s) => [
      s.id,
      s.realizedPnl === null ? null : round2(s.realizedPnl),
    ]),
  );
  for (const t of state.txs) {
    const next = state.costKnown ? (realized.get(t.id) ?? null) : null;
    if (!decEq(t.realizedPnl, next)) {
      await tx.assetTransaction.update({
        where: { id: t.id },
        data: { realizedPnl: next },
      });
    }
  }
  const data: Prisma.AssetUpdateInput = {};
  if (timeline.current !== null) data.currentValue = timeline.current;
  if (state.hasLedger) {
    const qty = state.replay.quantity.toDecimalPlaces(8, D.ROUND_HALF_UP);
    const avg = state.replay.avgCost.toDecimalPlaces(8, D.ROUND_HALF_UP);
    data.quantity = qty;
    data.costBasisPerUnit = !state.costKnown
      ? null
      : qty.greaterThan(0) || avg.greaterThan(0)
        ? avg
        : asset.costBasisPerUnit;
    const lastSell = [...state.replay.ordered]
      .reverse()
      .find((r) => r.kind === "sell");
    if (asset.status !== "archived") {
      if (qty.isZero() && lastSell) {
        data.status = "sold";
        data.soldAt = ledgerInstant(
          lastSell.effectiveDate,
          lastSell.effectiveTime,
          state.txs.find((t) => t.id === lastSell.id)?.timeZone ?? null,
        );
      } else if (asset.status === "sold") {
        data.status = "active";
        data.soldAt = null;
      }
    }
  }
  const updated = await tx.asset.update({ where: { id: asset.id }, data });
  return { asset: updated, state, timeline };
}

function decEq(a: Prisma.Decimal | null, b: Prisma.Decimal | null): boolean {
  return a === null ? b === null : b !== null && a.equals(b);
}

export function holdingStateOf(
  asset: Asset,
  state: AssetState,
): AssetHoldingStateDto {
  const sells = state.replay.steps.filter((s) => s.kind === "sell");
  return {
    id: asset.id,
    quantity: asset.quantity?.toString() ?? null,
    unit: asset.unit,
    costBasisPerUnit:
      state.costKnown && asset.costBasisPerUnit
        ? asset.costBasisPerUnit.toString()
        : null,
    costBasisKnown: state.costKnown,
    realizedPnlIdr:
      state.costKnown && sells.length > 0
        ? round2(
            sells.reduce((s, x) => s.plus(x.realizedPnl ?? 0), new D(0)),
          ).toString()
        : null,
    status: asset.status,
    currentValueIdr: asset.currentValue.toString(),
    valuationModel: asset.valuationModel,
  };
}

export function toTransactionDto(t: AssetTransaction): AssetTransactionDto {
  return {
    id: t.id,
    assetId: t.assetId,
    familyGroupId: t.familyGroupId,
    kind: t.kind,
    status: t.status,
    quantity: t.quantity.toString(),
    pricePerUnit: t.pricePerUnit?.toString() ?? null,
    grossAmount: t.grossAmount?.toString() ?? null,
    fee: t.fee.toString(),
    tax: t.tax.toString(),
    netAmount: t.netAmount?.toString() ?? null,
    currency: t.currency,
    fxRate: t.fxRate?.toString() ?? null,
    costBasisKnown: t.costBasisKnown,
    realizedPnlIdr: t.realizedPnl?.toString() ?? null,
    effectiveDate: dbDateToYmd(t.effectiveDate),
    effectiveTime: t.effectiveTime,
    timeZone: t.timeZone,
    cashAccountId: t.cashAccountId,
    cashTransactionId: t.cashTransactionId,
    idempotencyKey: t.idempotencyKey,
    note: t.note,
    createdByUserId: t.createdByUserId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    voidedAt: t.voidedAt?.toISOString() ?? null,
    voidReason: t.voidReason,
  };
}

export function toEventDto(
  h: AssetHistory,
  change: { amountIdr: string | null; percent: number | null },
  recordedByName: string | null,
): AssetHistoryEventDto {
  return {
    id: h.id,
    assetId: h.assetId,
    value: h.value.toString(),
    effectiveAt: h.effectiveAt.toISOString(),
    effectiveDate: dbDateToYmd(h.effectiveDate),
    hasTime: h.hasTime,
    timeZone: h.timeZone,
    recordedAt: h.recordedAt.toISOString(),
    createdAt: h.createdAt.toISOString(),
    kind: h.kind,
    source: h.source,
    reference: h.reference,
    status: h.status,
    valuationModel: h.valuationModel,
    pricePerUnit: h.pricePerUnit?.toString() ?? null,
    currency: h.currency,
    fxRate: h.fxRate?.toString() ?? null,
    fxRateDate: h.fxRateDate ? dbDateToYmd(h.fxRateDate) : null,
    fxSource: h.fxSource,
    quantityBefore: h.quantityBefore?.toString() ?? null,
    quantityAfter: h.quantityAfter?.toString() ?? null,
    unit: h.unit,
    valueBefore: h.valueBefore?.toString() ?? null,
    changeIdr: change.amountIdr,
    changePercent: change.percent,
    recordedByUserId: h.recordedByUserId,
    recordedByName,
    note: h.note,
    assetTransactionId: h.assetTransactionId,
    voidedAt: h.voidedAt?.toISOString() ?? null,
    voidReason: h.voidReason,
  };
}

export async function userNames(
  tx: TxClient,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (unique.length === 0) return new Map();
  const users = await tx.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function writeAudit(
  tx: TxClient,
  actor: AssetActor,
  familyGroupId: string,
  entity: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  if (!actor.userId) return;
  await tx.auditLog.create({
    data: {
      userId: actor.userId,
      familyGroupId,
      entity,
      entityId,
      action,
      before:
        before === null || before === undefined
          ? undefined
          : (before as Prisma.InputJsonValue),
      after:
        after === null || after === undefined
          ? undefined
          : (after as Prisma.InputJsonValue),
    },
  });
}

/** The `create` audit payload of an idempotent write (the original request). */
export async function originalPayload<T>(
  tx: TxClient,
  entity: string,
  entityId: string,
): Promise<T | null> {
  const audit = await tx.auditLog.findFirst({
    where: { entity, entityId, action: "create" },
    orderBy: { createdAt: "asc" },
    select: { after: true },
  });
  return (audit?.after as T | null) ?? null;
}
