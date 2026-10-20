import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { runSerializableWithRetry } from "../../common/utils/serializable-retry.util";
import {
  dbDateToYmd,
  jakartaTodayYmd,
} from "../../investments/ledger/ledger-dates";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";

import {
  actorViewer,
  assertWritable,
  ASSET_TX_ATTEMPTS,
  holdingStateOf,
  loadState,
  lockAsset,
  originalPayload,
  rebuildAsset,
  timelineOf,
  toEventDto,
  userNames,
  writeAudit,
} from "./asset-ledger-support";
import { changeAt, NO_CHANGE, VALUATION_KINDS } from "./asset-timeline";
import {
  normalizeValuation,
  rowAsInput,
  sameValuation,
  totalIdr,
} from "./asset-valuation-input";

import type { AssetActor, AssetState } from "./asset-ledger-support";
import type { Timeline, TimelineRow } from "./asset-timeline";
import type { NormalizedValuation } from "./asset-valuation-input";
import type { TxClient } from "../../common/utils/serializable-retry.util";
import type { AssetViewer } from "../asset-access";
import type { Asset, AssetHistory } from "@prisma/client";
import type {
  AssetValuationInput,
  AssetValuationPreviewDto,
  AssetValuationResultDto,
  UpdateAssetValuationInput,
  VoidAssetEventInput,
} from "@wealthme/contracts";

const AUDIT_ENTITY = "asset_valuation";
const DRAFT_ID = "~draft";

/** The draft row placed into the timeline (createdAt now → after same-key rows). */
function draftRow(
  v: NormalizedValuation,
  id = DRAFT_ID,
  createdAt = new Date(),
): TimelineRow {
  return {
    id,
    kind: "valuation",
    value: totalIdr(v) ?? 0n,
    effectiveAt: v.effectiveAt,
    effectiveDate: v.effectiveDate,
    hasTime: v.hasTime,
    createdAt,
    pricePerUnit: v.pricePerUnit,
    currency: v.currency,
    fxRate: v.fxRate,
    assetTransactionId: null,
  };
}

/**
 * Aset A4/A6 + §11 — Update Nilai: preview, create (idempotent), edit and
 * void (audited, recomputed). A valuation states a value at an effective
 * time; it never moves cash, cost basis or trade prices. The asset's
 * current value is the latest row by effective order, so a backdated entry
 * is stored as history and never overrides a newer valuation.
 */
@Injectable()
export class AssetValuationsService {
  constructor(private readonly prisma: PrismaService) {}

  preview(
    familyGroupId: string,
    assetId: string,
    input: AssetValuationInput,
    viewer: AssetViewer,
  ): Promise<AssetValuationPreviewDto> {
    return this.prisma.$transaction(async (tx) => {
      const asset = await lockAsset(
        tx,
        familyGroupId,
        assetId,
        viewer,
        "check",
      );
      const v = normalizeValuation(input, asset.valuationModel);
      const state = await loadState(tx, assetId);
      const before = timelineOf(asset, state);
      const draft = draftRow(v);
      const after = timelineOf(asset, state, [draft]);
      const idx = after.ordered.findIndex((r) => r.id === DRAFT_ID);
      const s = after.states.get(DRAFT_ID)!;
      assertPriced(asset, v, s.quantityAfter);
      const change = changeAt(after, idx);
      const prev = previousValuation(after, idx);
      const newer = after.ordered
        .slice(idx + 1)
        .find((r) => VALUATION_KINDS.has(r.kind));
      const now = before.current ?? asset.currentValue;
      const next = after.current ?? s.value;
      return {
        quantity: s.quantityAfter?.toString() ?? null,
        unit: asset.unit,
        valuationModel: asset.valuationModel,
        previousValueIdr: prev
          ? after.states.get(prev.id)!.value.toString()
          : null,
        newValueIdr: s.value.toString(),
        changeIdr: change.amountIdr,
        changePercent: change.percent,
        totalImpactIdr: (next - now).toString(),
        backdated: v.effectiveYmd < jakartaTodayYmd(),
        becomesCurrent: !newer,
        newerValuationDate: newer ? dbDateToYmd(newer.effectiveDate) : null,
        comparisonDate: change.comparisonDate,
        comparisonPeriod:
          change.period === "none" ? "none" : "previous_valuation",
        currentValueIdr: now.toString(),
        currentValueAfterIdr: next.toString(),
        pricePerUnitIdr:
          v.pricePerUnit === null
            ? null
            : (v.currency === "IDR"
                ? v.pricePerUnit
                : v.pricePerUnit.times(v.fxRate!)
              ).toString(),
        currency: v.currency,
        fxRate: v.fxRate?.toString() ?? null,
      };
    });
  }

  create(
    familyGroupId: string,
    assetId: string,
    input: AssetValuationInput,
    actor: AssetActor,
  ): Promise<AssetValuationResultDto> {
    const key = input.idempotencyKey;
    if (!key) throw new BadRequestException("idempotencyKey wajib diisi");
    return runSerializableWithRetry(
      this.prisma,
      async (tx) => {
        const asset = await lockAsset(
          tx,
          familyGroupId,
          assetId,
          actorViewer(actor),
          "lock",
        );
        const existing = await tx.assetHistory.findUnique({
          where: { assetId_idempotencyKey: { assetId, idempotencyKey: key } },
        });
        if (existing) {
          const original =
            (await originalPayload<AssetValuationInput>(
              tx,
              AUDIT_ENTITY,
              existing.id,
            )) ?? rowAsInput(existing);
          let same = false;
          try {
            same = sameValuation(
              normalizeValuation(input, null),
              normalizeValuation(original, null),
            );
          } catch {
            same = false;
          }
          if (!same) {
            throw new ConflictException({
              statusCode: 409,
              code: "IDEMPOTENCY_KEY_REUSED",
              message:
                "idempotencyKey ini sudah dipakai untuk valuasi dengan isi berbeda. Buka ulang formulir untuk membuat kunci baru.",
            });
          }
          return this.result(tx, asset, existing.id, true);
        }
        assertWritable(asset);
        const v = normalizeValuation(input, asset.valuationModel);
        const row = await this.insert(tx, asset, v, actor.userId, key);
        await writeAudit(
          tx,
          actor,
          asset.familyGroupId,
          AUDIT_ENTITY,
          row.id,
          "create",
          null,
          {
            ...input,
            historyId: row.id,
          },
        );
        return this.result(tx, asset, row.id, false);
      },
      ASSET_TX_ATTEMPTS,
    );
  }

  /**
   * Writes one valuation row (value from the timeline at its effective
   * point) and rebuilds the asset. Shared by the legacy POST :id/history.
   */
  async insert(
    tx: TxClient,
    asset: Asset,
    v: NormalizedValuation,
    userId: string | null,
    idempotencyKey: string | null,
  ): Promise<AssetHistory> {
    const state = await loadState(tx, asset.id);
    const createdAt = new Date();
    const t = timelineOf(asset, state, [draftRow(v, DRAFT_ID, createdAt)]);
    const s = t.states.get(DRAFT_ID)!;
    assertPriced(asset, v, s.quantityAfter);
    const row = await tx.assetHistory.create({
      data: {
        assetId: asset.id,
        kind: "valuation",
        value: s.value,
        recordedAt: v.effectiveAt,
        effectiveAt: v.effectiveAt,
        effectiveDate: v.effectiveDate,
        hasTime: v.hasTime,
        timeZone: v.timeZone,
        createdAt,
        source: v.source,
        reference: v.reference,
        valuationModel: v.pricePerUnit === null ? "total" : "per_unit",
        pricePerUnit: v.pricePerUnit,
        currency: v.currency,
        fxRate: v.fxRate,
        fxRateDate: v.fxRate ? v.effectiveDate : null,
        fxSource: v.fxRate ? "user" : null,
        unit: asset.unit,
        quantityAfter: s.quantityAfter,
        recordedByUserId: userId,
        note: v.note,
        idempotencyKey,
      },
    });
    await rebuildAsset(tx, asset);
    return row;
  }

  update(
    familyGroupId: string,
    assetId: string,
    historyId: string,
    input: UpdateAssetValuationInput,
    actor: AssetActor,
  ): Promise<AssetValuationResultDto> {
    return runSerializableWithRetry(
      this.prisma,
      async (tx) => {
        const asset = await lockAsset(
          tx,
          familyGroupId,
          assetId,
          actorViewer(actor),
          "write",
        );
        const existing = await editableRow(tx, assetId, historyId);
        const merged: AssetValuationInput = { ...rowAsInput(existing) };
        for (const [k, val] of Object.entries(input)) {
          if (val !== undefined && k !== "reason" && k !== "idempotencyKey") {
            (merged as unknown as Record<string, unknown>)[k] = val;
          }
        }
        // A cleared source falls back to "manual" (never a 400 on edit).
        if (!merged.source?.trim()) merged.source = "manual";
        if (input.pricePerUnit !== undefined) merged.value = undefined;
        if (input.value !== undefined) merged.pricePerUnit = undefined;
        const v = normalizeValuation(merged, null);
        const state = await loadState(tx, asset.id);
        const others = {
          ...state,
          history: state.history.filter((h) => h.id !== existing.id),
        };
        const t = timelineOf(asset, others, [
          draftRow(v, existing.id, existing.createdAt),
        ]);
        const s = t.states.get(existing.id)!;
        assertPriced(asset, v, s.quantityAfter);
        await tx.assetHistory.update({
          where: { id: existing.id },
          data: {
            value: s.value,
            effectiveAt: v.effectiveAt,
            effectiveDate: v.effectiveDate,
            hasTime: v.hasTime,
            timeZone: v.timeZone,
            source: v.source,
            reference: v.reference,
            valuationModel: v.pricePerUnit === null ? "total" : "per_unit",
            pricePerUnit: v.pricePerUnit,
            currency: v.currency,
            fxRate: v.fxRate,
            fxRateDate: v.fxRate ? v.effectiveDate : null,
            fxSource: v.fxRate ? "user" : null,
            quantityAfter: s.quantityAfter,
            note: v.note,
          },
        });
        await rebuildAsset(tx, asset);
        const fresh = await tx.assetHistory.findUniqueOrThrow({
          where: { id: existing.id },
        });
        await writeAudit(
          tx,
          actor,
          asset.familyGroupId,
          AUDIT_ENTITY,
          existing.id,
          "edit",
          toEventDto(existing, NO_CHANGE, null),
          {
            ...toEventDto(fresh, NO_CHANGE, null),
            ...(input.reason ? { reason: input.reason } : {}),
          },
        );
        return this.result(tx, asset, existing.id, false);
      },
      ASSET_TX_ATTEMPTS,
    );
  }

  void(
    familyGroupId: string,
    assetId: string,
    historyId: string,
    input: VoidAssetEventInput,
    actor: AssetActor,
  ): Promise<AssetValuationResultDto> {
    return runSerializableWithRetry(
      this.prisma,
      async (tx) => {
        const asset = await lockAsset(
          tx,
          familyGroupId,
          assetId,
          actorViewer(actor),
          "write",
        );
        const existing = await editableRow(tx, assetId, historyId, true);
        if (existing.status === "void")
          return this.result(tx, asset, existing.id, true);
        const remaining = await tx.assetHistory.count({
          where: { assetId, status: "active", id: { not: existing.id } },
        });
        if (remaining === 0) {
          throw new ConflictException(
            "Ini satu-satunya nilai aset. Catat valuasi pengganti sebelum membatalkan yang ini.",
          );
        }
        await tx.assetHistory.update({
          where: { id: existing.id },
          data: {
            status: "void",
            voidedAt: new Date(),
            voidReason: input.reason ?? null,
          },
        });
        await rebuildAsset(tx, asset);
        const fresh = await tx.assetHistory.findUniqueOrThrow({
          where: { id: existing.id },
        });
        await writeAudit(
          tx,
          actor,
          asset.familyGroupId,
          AUDIT_ENTITY,
          existing.id,
          "void",
          toEventDto(existing, NO_CHANGE, null),
          toEventDto(fresh, NO_CHANGE, null),
        );
        return this.result(tx, asset, existing.id, false);
      },
      ASSET_TX_ATTEMPTS,
    );
  }

  private async result(
    tx: TxClient,
    asset: Asset,
    historyId: string,
    replayed: boolean,
  ): Promise<AssetValuationResultDto> {
    const fresh = await tx.asset.findUniqueOrThrow({ where: { id: asset.id } });
    const state = await loadState(tx, asset.id);
    const t = timelineOf(fresh, state);
    const row = await tx.assetHistory.findUniqueOrThrow({
      where: { id: historyId },
    });
    const idx = t.ordered.findIndex((r) => r.id === historyId);
    const names = await userNames(tx, [row.recordedByUserId]);
    return {
      replayed,
      event: toEventDto(
        row,
        idx < 0 ? NO_CHANGE : changeAt(t, idx),
        row.recordedByUserId ? (names.get(row.recordedByUserId) ?? null) : null,
      ),
      asset: holdingStateOf(fresh, state),
    };
  }
}

/** Only free-standing valuations; transaction rows change via their transaction. */
async function editableRow(
  tx: TxClient,
  assetId: string,
  historyId: string,
  allowVoid = false,
): Promise<AssetHistory> {
  const row = await tx.assetHistory.findFirst({
    where: { id: historyId, assetId },
  });
  if (!row) throw new NotFoundException("Riwayat nilai tidak ditemukan");
  if (row.assetTransactionId || !VALUATION_KINDS.has(row.kind)) {
    throw new ConflictException(
      "Baris ini berasal dari transaksi beli/jual. Ubah atau batalkan transaksinya.",
    );
  }
  if (row.status === "void" && !allowVoid) {
    throw new ConflictException(
      "Valuasi yang sudah dibatalkan tidak dapat diubah",
    );
  }
  return row;
}

function assertPriced(
  asset: Asset,
  v: NormalizedValuation,
  quantity: AssetState["replay"]["quantity"] | null,
): void {
  if (v.pricePerUnit !== null && quantity === null) {
    throw new BadRequestException(
      `Kuantitas ${asset.name} belum diketahui. Catat kepemilikan awal (kuantitas) dulu, atau isi nilai total.`,
    );
  }
}

/** The valuation compared against (A6), by effective order. */
function previousValuation(t: Timeline, idx: number): TimelineRow | null {
  for (let k = idx - 1; k >= 0; k--) {
    const r = t.ordered[k]!;
    if (VALUATION_KINDS.has(r.kind)) return r;
  }
  return null;
}
