import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { parseAssetDetails } from "@wealthme/contracts";

import { isRowScoped } from "../common/utils/privacy.util";
import {
  isValidYmd,
  jakartaTodayYmd,
  ymdToDbDate,
} from "../investments/ledger/ledger-dates";

import { writeOpeningOnCreate } from "./ledger/asset-transactions.service";

import type { AssetViewer } from "./asset-access";
import type { AssetValuationsService } from "./ledger/asset-valuations.service";
import type { TxClient } from "../common/utils/serializable-retry.util";
import type { PrismaService } from "../prisma/prisma.service";
import type { Asset } from "@prisma/client";

/**
 * Aset fields (2026-10-20) — the create-time inputs that are not plain
 * columns: Pemilik (A7 row scope), per-category specs, and the opening
 * write (cost basis + opening valuation with its date and source).
 *
 * Cost basis is NOT a new column. The aset spec (§10) already models it as
 * the opening transaction ("Kepemilikan awal"): its price per unit is the
 * weighted-average cost the ledger replays (R1), so `costBasisPerUnit`,
 * realized P/L on a later sale and unrealized P/L on the overview/detail
 * all follow from it. Harga perolehan is that opening's price; Nilai saat
 * ini is a separate valuation row. The opening never moves cash, and the
 * value is counted once (the latest row by effective order).
 */

function bad(code: string, field: string, message: string): never {
  throw new BadRequestException({
    statusCode: 400,
    error: "Bad Request",
    code,
    field,
    message,
  });
}

/**
 * A7 — who owns a new asset. A row-scoped member (dependant, operational,
 * own-rows role) records only for themselves; anyone else may pick a
 * member of THIS family or Bersama (null). Unknown/cross-family ids → 400.
 */
export async function resolveCreateOwner(
  prisma: PrismaService,
  familyGroupId: string,
  requested: string | null | undefined,
  viewer: AssetViewer | undefined,
): Promise<string | null> {
  if (viewer && isRowScoped(viewer.member)) {
    if (requested === undefined || requested === viewer.userId) {
      return viewer.userId;
    }
    throw new ForbiddenException({
      statusCode: 403,
      error: "Forbidden",
      code: "ASSET_OWNER_FORBIDDEN",
      field: "ownerUserId",
      message: "Anda hanya dapat mencatat aset atas nama sendiri.",
    });
  }
  if (!requested) return null;
  const member = await prisma.member.findUnique({
    where: { userId_familyGroupId: { userId: requested, familyGroupId } },
    select: { id: true },
  });
  if (!member) {
    bad(
      "ASSET_OWNER_INVALID",
      "ownerUserId",
      "Pemilik harus anggota keluarga ini.",
    );
  }
  return requested;
}

/** Validated specs for `type` as a JSON column value (SQL NULL when none). */
export function detailsColumn(
  type: string,
  input: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const parsed = parseAssetDetails(type, input);
  if (!parsed.ok) bad("ASSET_DETAILS_INVALID", parsed.field, parsed.message);
  return parsed.details ?? Prisma.DbNull;
}

/**
 * PATCH — new specs are validated against the resulting type. A type change
 * without new specs keeps the stored ones only if they still fit the new
 * category; otherwise they are cleared (never stored under the wrong type).
 */
export function detailsForUpdate(
  existing: Pick<Asset, "type" | "details">,
  dto: { type?: string; details?: Record<string, unknown> | null },
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  const type = dto.type ?? existing.type;
  if (dto.details !== undefined) return detailsColumn(type, dto.details);
  if (type === existing.type || existing.details === null) return undefined;
  const kept = parseAssetDetails(type, existing.details);
  return kept.ok ? (kept.details ?? Prisma.DbNull) : Prisma.DbNull;
}

/** Stored specs as the DTO shape; anything that is not a string map → null. */
export function detailsOut(
  value: Prisma.JsonValue,
): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter(
    (e): e is [string, string] => typeof e[1] === "string",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export interface OpeningPlan {
  /** Opening (Kepemilikan awal) transaction date. */
  openingYmd: string;
  /** Opening valuation date (Nilai saat ini). */
  valuationYmd: string;
  /** True when the caller sent a valuation date (else it defaults). */
  datedByUser: boolean;
  source: string;
  /** Harga perolehan in IDR; null = not entered. */
  cost: bigint | null;
}

/**
 * Dates of the opening write. The valuation is floating date-only (no clock
 * time is invented), never in the future (Asia/Jakarta calendar), and never
 * before the acquisition — otherwise the opening's cost price would sort
 * after it and become the current value.
 */
export function planOpening(
  dto: {
    acquisitionDate?: string;
    acquisitionCost?: string;
    valuationDate?: string;
    valuationSource?: string;
  },
  todayYmd: string = jakartaTodayYmd(),
): OpeningPlan {
  const acquired = dto.acquisitionDate?.slice(0, 10);
  const valued = dto.valuationDate;
  if (valued !== undefined) {
    if (!isValidYmd(valued)) {
      bad(
        "ASSET_VALUATION_DATE_INVALID",
        "valuationDate",
        "Tanggal valuasi tidak valid.",
      );
    }
    if (valued > todayYmd) {
      bad(
        "ASSET_VALUATION_DATE_INVALID",
        "valuationDate",
        "Tanggal valuasi tidak boleh di masa depan.",
      );
    }
    if (acquired && valued < acquired) {
      bad(
        "ASSET_VALUATION_DATE_INVALID",
        "valuationDate",
        "Tanggal valuasi tidak boleh sebelum tanggal perolehan.",
      );
    }
  }
  return {
    openingYmd: acquired ?? valued ?? todayYmd,
    valuationYmd: valued ?? todayYmd,
    datedByUser: valued !== undefined,
    source: dto.valuationSource ?? "manual",
    cost: dto.acquisitionCost != null ? BigInt(dto.acquisitionCost) : null,
  };
}

/**
 * Writes the opening rows of a just-created asset and returns it rebuilt.
 *  - Harga perolehan given: an opening transaction at that cost (quantity
 *    = the per-unit quantity, or 1 for a total-valued asset) plus a
 *    valuation row at Nilai saat ini, dated/sourced as entered.
 *  - Per-unit without cost (legacy rule): the opening transaction at the
 *    value is the cost; a valuation row is added only when its date or
 *    source differs from what the opening already says.
 *  - Total without cost: one opening history row (cost unknown).
 */
export async function writeOpening(
  tx: TxClient,
  valuations: AssetValuationsService,
  asset: Asset,
  openingQty: string | null,
  plan: OpeningPlan,
  userId: string | null,
): Promise<Asset> {
  const value = asset.currentValue;
  const ledgerQty = openingQty ?? (plan.cost !== null ? "1" : null);
  if (!ledgerQty) {
    const day = ymdToDbDate(plan.valuationYmd);
    await tx.assetHistory.create({
      data: {
        assetId: asset.id,
        value,
        kind: "opening",
        effectiveAt: day,
        effectiveDate: day,
        hasTime: false,
        source: plan.source,
      },
    });
    return asset;
  }
  const opened = await writeOpeningOnCreate(
    tx,
    asset,
    {
      quantity: ledgerQty,
      valueIdr: plan.cost ?? value,
      effectiveDate: plan.openingYmd,
    },
    userId,
  );
  const sameAsOpening =
    plan.source === "manual" &&
    (!plan.datedByUser || plan.valuationYmd === plan.openingYmd);
  if (plan.cost === null && sameAsOpening) return opened;
  const day = ymdToDbDate(plan.valuationYmd);
  const perUnit = asset.valuationModel === "per_unit";
  await valuations.insert(
    tx,
    opened,
    {
      effectiveAt: day,
      effectiveDate: day,
      effectiveYmd: plan.valuationYmd,
      hasTime: false,
      timeZone: null,
      pricePerUnit: perUnit
        ? new Prisma.Decimal(value.toString())
            .dividedBy(new Prisma.Decimal(ledgerQty))
            .toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_UP)
        : null,
      amount: perUnit ? null : new Prisma.Decimal(value.toString()),
      currency: "IDR",
      fxRate: null,
      source: plan.source,
      reference: null,
      note: null,
    },
    userId,
    null,
  );
  return tx.asset.findUniqueOrThrow({ where: { id: asset.id } });
}
