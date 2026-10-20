import { randomUUID } from "crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { runSerializableWithRetry } from "../../common/utils/serializable-retry.util";
import {
  jakartaTodayYmd,
  ledgerInstant,
  ymdToDbDate,
} from "../../investments/ledger/ledger-dates";
import { normalizeLedgerInput } from "../../investments/ledger/ledger-input";
import { payloadMatches } from "../../investments/ledger/ledger-support";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";

import { applyCashLeg } from "./asset-cash";
import {
  actorViewer,
  assertWritable,
  ASSET_TX_ATTEMPTS,
  holdingStateOf,
  loadState,
  lockAsset,
  originalPayload,
  rebuildAsset,
  toTransactionDto,
  txHistoryEffective,
  writeAudit,
} from "./asset-ledger-support";

import type { AssetActor } from "./asset-ledger-support";
import type { TxClient } from "../../common/utils/serializable-retry.util";
import type { ProposedRow } from "../../investments/ledger/ledger-input";
import type { Asset, AssetTransaction } from "@prisma/client";
import type {
  AssetTransactionResultDto,
  CreateAssetTransactionInput,
  InvestmentTransactionDto,
  UpdateAssetTransactionInput,
  VoidAssetEventInput,
} from "@wealthme/contracts";

const AUDIT_ENTITY = "asset_transaction";
/** Physical assets: any non-negative quantity up to 8 decimals. */
const HOLDING = { market: null, allowFraction: true, cashAccountId: null };

/**
 * Aset A5 — buy / sell / opening on a physical asset. Each write runs in
 * one Serializable transaction (retried on P2034/P2002/40001): lock the
 * asset, replay its active ledger with the change (Investasi R1/R6 replay;
 * a sell beyond holdings at its effective point or later is a 409, never
 * clamped), move cash (asset-cash.ts), write the row and its history event,
 * rebuild quantity / cost / realized / values / status, audit. Creates are
 * idempotent per family (R7): same key + same payload → the original
 * result; a different payload → 409.
 */
@Injectable()
export class AssetTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    familyGroupId: string,
    assetId: string,
    input: CreateAssetTransactionInput,
    actor: AssetActor,
  ): Promise<AssetTransactionResultDto> {
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
        const existing = await tx.assetTransaction.findUnique({
          where: {
            familyGroupId_idempotencyKey: {
              familyGroupId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) {
          if (
            existing.assetId !== assetId ||
            existing.kind !== input.kind ||
            !(await this.samePayload(tx, existing, input))
          ) {
            throw new ConflictException({
              statusCode: 409,
              code: "IDEMPOTENCY_KEY_REUSED",
              message:
                "idempotencyKey ini sudah dipakai untuk transaksi dengan isi berbeda. Buka ulang formulir untuk membuat kunci baru.",
            });
          }
          return this.result(tx, asset, existing, true);
        }
        assertWritable(asset);
        const row = normalize(input);
        const draft = draftRow(asset, row, {
          id: randomUUID(),
          createdAt: new Date(),
          idempotencyKey: input.idempotencyKey,
          costBasisKnown:
            input.kind === "opening" ? (input.costBasisKnown ?? true) : true,
          createdByUserId: actor.userId,
        });
        await loadState(tx, assetId, { upsert: draft }, draft.id);
        const cashTransactionId = await applyCashLeg(tx, {
          familyGroupId,
          asset,
          existing: null,
          row,
          actor,
        });
        const written = await tx.assetTransaction.create({
          data: { ...draft, cashTransactionId, realizedPnl: null },
        });
        await tx.assetHistory.create({
          data: {
            assetId,
            kind: written.kind,
            value: 0n,
            ...txHistoryEffective(row),
            timeZone: row.timeZone,
            createdAt: written.createdAt,
            source: "transaction",
            valuationModel: asset.valuationModel,
            pricePerUnit: row.pricePerUnit,
            currency: row.currency,
            fxRate: row.fxRate,
            unit: asset.unit,
            assetTransactionId: written.id,
            recordedByUserId: actor.userId,
            note: row.note,
          },
        });
        const rebuilt = await rebuildAsset(tx, asset);
        const fresh = await tx.assetTransaction.findUniqueOrThrow({
          where: { id: written.id },
        });
        await writeAudit(
          tx,
          actor,
          asset.familyGroupId,
          AUDIT_ENTITY,
          written.id,
          "create",
          null,
          toTransactionDto(fresh),
        );
        return {
          replayed: false,
          transaction: toTransactionDto(fresh),
          asset: holdingStateOf(rebuilt.asset, rebuilt.state),
        };
      },
      ASSET_TX_ATTEMPTS,
    );
  }

  update(
    familyGroupId: string,
    assetId: string,
    transactionId: string,
    input: UpdateAssetTransactionInput,
    actor: AssetActor,
  ): Promise<AssetTransactionResultDto> {
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
        const existing = await findRow(tx, assetId, transactionId);
        if (existing.status === "void") {
          throw new ConflictException(
            "Transaksi yang sudah dibatalkan tidak dapat diubah",
          );
        }
        const row = normalize(mergeEdit(existing, input));
        const draft: AssetTransaction = {
          ...existing,
          ...draftRow(asset, row, {
            id: existing.id,
            createdAt: existing.createdAt,
            idempotencyKey: existing.idempotencyKey,
            costBasisKnown:
              existing.kind === "opening"
                ? (input.costBasisKnown ?? existing.costBasisKnown)
                : true,
            createdByUserId: existing.createdByUserId,
          }),
        };
        await loadState(tx, assetId, { upsert: draft }, draft.id);
        const cashTransactionId = await applyCashLeg(tx, {
          familyGroupId,
          asset,
          existing,
          row,
          actor,
        });
        const { id: _id, createdAt: _c, updatedAt: _u, ...data } = draft;
        await tx.assetTransaction.update({
          where: { id: existing.id },
          data: { ...data, cashTransactionId },
        });
        await tx.assetHistory.updateMany({
          where: { assetTransactionId: existing.id },
          data: {
            ...txHistoryEffective(row),
            timeZone: row.timeZone,
            pricePerUnit: row.pricePerUnit,
            currency: row.currency,
            fxRate: row.fxRate,
            note: row.note,
          },
        });
        return this.finish(
          tx,
          asset,
          existing,
          "edit",
          input.reason ?? null,
          actor,
        );
      },
      ASSET_TX_ATTEMPTS,
    );
  }

  void(
    familyGroupId: string,
    assetId: string,
    transactionId: string,
    input: VoidAssetEventInput,
    actor: AssetActor,
  ): Promise<AssetTransactionResultDto> {
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
        const existing = await findRow(tx, assetId, transactionId);
        // Voiding twice is a retried click, not an error.
        if (existing.status === "void")
          return this.result(tx, asset, existing, true);
        await loadState(tx, assetId, { dropId: existing.id }, existing.id);
        await applyCashLeg(tx, {
          familyGroupId,
          asset,
          existing,
          row: null,
          actor,
        });
        const now = new Date();
        const reason = input.reason ?? null;
        await tx.assetTransaction.update({
          where: { id: existing.id },
          data: {
            status: "void",
            voidedAt: now,
            voidReason: reason,
            realizedPnl: null,
            cashTransactionId: null,
          },
        });
        await tx.assetHistory.updateMany({
          where: { assetTransactionId: existing.id },
          data: { status: "void", voidedAt: now, voidReason: reason },
        });
        return this.finish(tx, asset, existing, "void", reason, actor);
      },
      ASSET_TX_ATTEMPTS,
    );
  }

  private async finish(
    tx: TxClient,
    asset: Asset,
    before: AssetTransaction,
    action: string,
    reason: string | null,
    actor: AssetActor,
  ): Promise<AssetTransactionResultDto> {
    const rebuilt = await rebuildAsset(tx, asset);
    const fresh = await tx.assetTransaction.findUniqueOrThrow({
      where: { id: before.id },
    });
    await writeAudit(
      tx,
      actor,
      asset.familyGroupId,
      AUDIT_ENTITY,
      before.id,
      action,
      toTransactionDto(before),
      {
        ...toTransactionDto(fresh),
        ...(reason ? { reason } : {}),
      },
    );
    return {
      replayed: false,
      transaction: toTransactionDto(fresh),
      asset: holdingStateOf(rebuilt.asset, rebuilt.state),
    };
  }

  private async result(
    tx: TxClient,
    asset: Asset,
    row: AssetTransaction,
    replayed: boolean,
  ): Promise<AssetTransactionResultDto> {
    const state = await loadState(tx, asset.id);
    const fresh = await tx.asset.findUniqueOrThrow({ where: { id: asset.id } });
    return {
      replayed,
      transaction: toTransactionDto(row),
      asset: holdingStateOf(fresh, state),
    };
  }

  /** R7 — compare the normalized retry with the original request (create audit). */
  private async samePayload(
    tx: TxClient,
    existing: AssetTransaction,
    input: CreateAssetTransactionInput,
  ): Promise<boolean> {
    let row: ProposedRow;
    try {
      row = normalize(input);
    } catch {
      return false;
    }
    const original =
      (await originalPayload<Record<string, unknown>>(
        tx,
        AUDIT_ENTITY,
        existing.id,
      )) ?? toTransactionDto(existing);
    return (
      payloadMatches(row, original as Partial<InvestmentTransactionDto>) &&
      (input.kind !== "opening" ||
        (input.costBasisKnown ?? true) === original.costBasisKnown)
    );
  }
}

/**
 * Aset create — a per-unit asset entered with a quantity starts with a real
 * opening transaction (quantity × price = the entered value), never an
 * opening at quantity 0 that later prices to Rp0. Runs inside the caller's
 * transaction on the asset it just created (no cash leg, no lock needed).
 */
export async function writeOpeningOnCreate(
  tx: TxClient,
  asset: Asset,
  opening: { quantity: string; valueIdr: bigint; effectiveDate: string },
  userId: string | null,
): Promise<Asset> {
  const qty = new Prisma.Decimal(opening.quantity);
  const price = new Prisma.Decimal(opening.valueIdr.toString())
    .dividedBy(qty)
    .toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_UP);
  const row = normalize({
    kind: "opening",
    idempotencyKey: randomUUID(),
    quantity: qty.toString(),
    pricePerUnit: price.toString(),
    currency: "IDR",
    effectiveDate: opening.effectiveDate,
    effectiveTime: null,
    timeZone: null,
  });
  const draft = draftRow(asset, row, {
    id: randomUUID(),
    createdAt: new Date(),
    idempotencyKey: randomUUID(),
    costBasisKnown: true,
    createdByUserId: userId,
  });
  const written = await tx.assetTransaction.create({
    data: { ...draft, cashTransactionId: null, realizedPnl: null },
  });
  await tx.assetHistory.create({
    data: {
      assetId: asset.id,
      kind: "opening",
      value: 0n,
      ...txHistoryEffective(row),
      timeZone: row.timeZone,
      createdAt: written.createdAt,
      source: "transaction",
      valuationModel: asset.valuationModel,
      pricePerUnit: row.pricePerUnit,
      currency: row.currency,
      fxRate: row.fxRate,
      unit: asset.unit,
      assetTransactionId: written.id,
      recordedByUserId: userId,
      note: null,
    },
  });
  return (await rebuildAsset(tx, asset)).asset;
}

function normalize(input: CreateAssetTransactionInput): ProposedRow {
  if (input.kind !== "opening" && !input.cashAccountId) {
    throw new BadRequestException(
      input.kind === "buy"
        ? "Pilih rekening sumber dana pembelian. Untuk aset yang sudah dimiliki sebelumnya, catat sebagai kepemilikan awal."
        : "Pilih rekening tujuan hasil penjualan.",
    );
  }
  if (
    input.effectiveTime &&
    ledgerInstant(
      input.effectiveDate,
      input.effectiveTime,
      input.timeZone ?? null,
    ).getTime() >
      Date.now() + 60_000
  ) {
    throw new BadRequestException("Waktu efektif tidak boleh di masa depan");
  }
  return normalizeLedgerInput(
    {
      ...input,
      cashAccountId: input.cashAccountId ?? null,
      settlementDate: null,
    },
    HOLDING,
    jakartaTodayYmd(),
  );
}

function mergeEdit(
  t: AssetTransaction,
  input: UpdateAssetTransactionInput,
): CreateAssetTransactionInput {
  const pick = <K extends keyof UpdateAssetTransactionInput>(
    k: K,
    fallback: string | null,
  ) => (input[k] !== undefined ? input[k] : fallback) as string | null;
  const quantityChanged =
    input.quantity !== undefined || input.pricePerUnit !== undefined;
  return {
    kind: t.kind,
    idempotencyKey: t.idempotencyKey,
    quantity: pick("quantity", t.quantity.toString())!,
    pricePerUnit:
      pick("pricePerUnit", t.pricePerUnit?.toString() ?? null) ?? undefined,
    // A changed quantity/price recomputes gross unless a gross is sent.
    grossAmount:
      input.grossAmount ??
      (quantityChanged ? undefined : (t.grossAmount?.toString() ?? undefined)),
    fee: pick("fee", t.fee.toString()) ?? undefined,
    tax: pick("tax", t.tax.toString()) ?? undefined,
    currency: input.currency ?? t.currency,
    fxRate:
      input.fxRate !== undefined
        ? input.fxRate
        : (t.fxRate?.toString() ?? null),
    costBasisKnown: input.costBasisKnown ?? t.costBasisKnown,
    effectiveDate:
      input.effectiveDate ?? t.effectiveDate.toISOString().slice(0, 10),
    effectiveTime:
      input.effectiveTime !== undefined ? input.effectiveTime : t.effectiveTime,
    timeZone: input.timeZone !== undefined ? input.timeZone : t.timeZone,
    cashAccountId:
      input.cashAccountId !== undefined ? input.cashAccountId : t.cashAccountId,
    note: input.note !== undefined ? input.note : t.note,
  };
}

function draftRow(
  asset: Asset,
  row: ProposedRow,
  meta: {
    id: string;
    createdAt: Date;
    idempotencyKey: string;
    costBasisKnown: boolean;
    createdByUserId: string | null;
  },
): AssetTransaction {
  return {
    ...meta,
    assetId: asset.id,
    // Always the loaded asset's family, never the caller's.
    familyGroupId: asset.familyGroupId,
    kind: row.kind as AssetTransaction["kind"],
    status: "active",
    quantity: row.quantity,
    pricePerUnit: row.pricePerUnit,
    grossAmount: row.grossAmount,
    fee: row.fee,
    tax: row.tax,
    netAmount: row.netAmount,
    currency: row.currency,
    fxRate: row.fxRate,
    realizedPnl: null,
    effectiveDate: ymdToDbDate(row.effectiveDate),
    effectiveTime: row.effectiveTime,
    timeZone: row.timeZone,
    cashAccountId: row.cashAccountId,
    cashTransactionId: null,
    note: row.note,
    updatedAt: meta.createdAt,
    voidedAt: null,
    voidReason: null,
  };
}

async function findRow(
  tx: TxClient,
  assetId: string,
  transactionId: string,
): Promise<AssetTransaction> {
  const row = await tx.assetTransaction.findFirst({
    where: { id: transactionId, assetId },
  });
  if (!row) throw new NotFoundException("Transaksi aset tidak ditemukan");
  return row;
}
