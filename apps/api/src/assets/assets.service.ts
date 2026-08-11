import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type Decimal } from "@prisma/client/runtime/library";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type {
  AssetHistoryResponseDto,
  AssetResponseDto,
} from "./dto/asset-response.dto";
import type { CreateAssetDto } from "./dto/create-asset.dto";
import type { UpdateAssetDto } from "./dto/update-asset.dto";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const MIN_RATE_PCT = -100;
const MAX_RATE_PCT = 100;

/**
 * EPIC-023 Task H1 review (HIGH fix 1): Indonesia Western Time — fixed
 * UTC+7, no daylight saving. Mirrors `wibWallClockToIso`/`wibCalendarParts`
 * in `apps/web/src/lib/laporan-period.ts` (EPIC-022 B7) and
 * `defaultMonthStartWib` in `reports.controller.ts` (EPIC-023 Task B3
 * review, fix 6) — duplicated here (not imported; `apps/web/src/lib` is a
 * protected foundation file and this package cannot depend on it anyway)
 * because this app is Rupiah/Indonesia-focused and comparing raw instants
 * is wrong for a calendar-date field like acquisitionDate: `new
 * Date("2026-08-05")` parses as UTC midnight, which is still ~7h in the
 * FUTURE relative to `Date.now()` for the first 7 hours of every WIB day
 * (9h for WIT) — rejecting a perfectly valid "today" acquisition date for a
 * chunk of every single day. DO NOT simplify this back to
 * `parsed.getTime() > Date.now()`.
 */
const WIB_UTC_OFFSET_MINUTES = 7 * 60;

/** UTC-midnight-anchored "today" in WIB wall-clock terms, for calendar-date comparisons. */
function wibTodayUtcMidnight(now: Date): Date {
  const wibNow = new Date(now.getTime() + WIB_UTC_OFFSET_MINUTES * 60_000);
  const utcMs = Date.UTC(
    wibNow.getUTCFullYear(),
    wibNow.getUTCMonth(),
    wibNow.getUTCDate(),
  );
  return new Date(utcMs);
}

/** EPIC-024 D2/US-ASSET-6: mirrors the Prisma `AssetValueChangeMode` enum. */
export type AssetValueChangeMode = "percent" | "fixed";

/**
 * Pro-rata, compute-on-read estimate of an asset's current value.
 *
 * - `mode: "percent"` (default, matches all pre-EPIC-024 assets): signed
 *   annual value-change rate (negative = depreciation, positive =
 *   appreciation). Linear approximation: currentValue × (1 + rate/100 ×
 *   yearsElapsed), floored at 0.
 * - `mode: "fixed"` (D11/US-ASSET-6): signed Rp/year delta instead of a
 *   rate — same sign convention (negative = depreciation, positive =
 *   appreciation). Linear approximation: currentValue + amount ×
 *   yearsElapsed, floored at 0.
 *
 * `since` is the asset's acquisition date when set (EPIC-023 D19/US-ASSET-4),
 * falling back to `createdAt` for legacy assets that predate the field
 * (EPIC-021 Open Design Decision #8).
 */
export function computeEstimatedValue(
  currentValue: bigint,
  ratePct: Decimal | null,
  since: Date,
  now: Date = new Date(),
  mode: AssetValueChangeMode = "percent",
  amount: bigint | null = null,
): bigint {
  const yearsElapsed =
    Math.max(now.getTime() - since.getTime(), 0) / MS_PER_YEAR;

  if (mode === "fixed") {
    if (amount == null || amount === 0n) return currentValue;
    const estimated = Math.round(
      Number(currentValue) + Number(amount) * yearsElapsed,
    );
    return BigInt(Math.max(estimated, 0));
  }

  if (!ratePct || ratePct.isZero()) return currentValue;
  const multiplier = 1 + (ratePct.toNumber() / 100) * yearsElapsed;
  const estimated = Math.round(Number(currentValue) * multiplier);
  return BigInt(Math.max(estimated, 0));
}

function toAssetDto(asset: {
  id: string;
  familyGroupId: string;
  name: string;
  type: string;
  currentValue: bigint;
  currency: string;
  notes: string | null;
  valueChangeRatePct: Decimal | null;
  valueChangeMode: AssetValueChangeMode;
  valueChangeAmount: bigint | null;
  categoryId: string | null;
  acquisitionDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AssetResponseDto {
  return {
    id: asset.id,
    familyGroupId: asset.familyGroupId,
    name: asset.name,
    type: asset.type,
    currentValue: asset.currentValue.toString(),
    currency: asset.currency,
    notes: asset.notes,
    valueChangeRatePct: asset.valueChangeRatePct?.toString() ?? null,
    valueChangeMode: asset.valueChangeMode,
    valueChangeAmount: asset.valueChangeAmount?.toString() ?? null,
    categoryId: asset.categoryId,
    acquisitionDate: asset.acquisitionDate?.toISOString() ?? null,
    currentEstimatedValue: computeEstimatedValue(
      asset.currentValue,
      asset.valueChangeRatePct,
      asset.acquisitionDate ?? asset.createdAt,
      new Date(),
      asset.valueChangeMode,
      asset.valueChangeAmount,
    ).toString(),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function toHistoryDto(h: {
  id: string;
  assetId: string;
  value: bigint;
  recordedAt: Date;
}): AssetHistoryResponseDto {
  return {
    id: h.id,
    assetId: h.assetId,
    value: h.value.toString(),
    recordedAt: h.recordedAt.toISOString(),
  };
}

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(familyGroupId: string): Promise<AssetResponseDto[]> {
    const assets = await this.prisma.asset.findMany({
      where: { familyGroupId },
      orderBy: { createdAt: "asc" },
    });
    return assets.map(toAssetDto);
  }

  async create(
    familyGroupId: string,
    dto: CreateAssetDto,
  ): Promise<AssetResponseDto> {
    if (!/^\d+$/.test(dto.currentValue)) {
      throw new BadRequestException(
        "currentValue must be a non-negative integer string",
      );
    }
    this.assertValidRatePct(dto.valueChangeRatePct);
    this.assertValidValueChangeAmount(dto.valueChangeAmount);
    this.assertValidAcquisitionDate(dto.acquisitionDate);
    const categoryId = await this.resolveCategoryId(
      familyGroupId,
      dto.categoryId,
    );

    const asset = await this.prisma.asset.create({
      data: {
        familyGroupId,
        name: dto.name,
        type: dto.type,
        currentValue: BigInt(dto.currentValue),
        currency: dto.currency ?? "IDR",
        notes: dto.notes ?? null,
        valueChangeRatePct: dto.valueChangeRatePct ?? null,
        valueChangeMode: dto.valueChangeMode ?? "percent",
        valueChangeAmount:
          dto.valueChangeAmount != null ? BigInt(dto.valueChangeAmount) : null,
        categoryId: categoryId ?? null,
        acquisitionDate: dto.acquisitionDate
          ? new Date(dto.acquisitionDate)
          : null,
      },
    });

    await this.prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        value: asset.currentValue,
      },
    });

    return toAssetDto(asset);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateAssetDto,
  ): Promise<AssetResponseDto> {
    const existing = await this.prisma.asset.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Asset not found");
    }

    if (dto.currentValue != null && !/^\d+$/.test(dto.currentValue)) {
      throw new BadRequestException(
        "currentValue must be a non-negative integer string",
      );
    }
    this.assertValidRatePct(dto.valueChangeRatePct);
    this.assertValidValueChangeAmount(dto.valueChangeAmount);
    this.assertValidAcquisitionDate(dto.acquisitionDate);
    const newValue =
      dto.currentValue != null
        ? BigInt(dto.currentValue)
        : existing.currentValue;
    const categoryId =
      dto.categoryId !== undefined
        ? await this.resolveCategoryId(familyGroupId, dto.categoryId)
        : existing.categoryId;

    const updated = await this.prisma.asset.update({
      where: { id, familyGroupId },
      data: {
        name: dto.name ?? existing.name,
        type: dto.type ?? existing.type,
        currentValue: newValue,
        currency: dto.currency ?? existing.currency,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
        valueChangeRatePct:
          dto.valueChangeRatePct !== undefined
            ? dto.valueChangeRatePct
            : existing.valueChangeRatePct,
        valueChangeMode: dto.valueChangeMode ?? existing.valueChangeMode,
        valueChangeAmount:
          dto.valueChangeAmount !== undefined
            ? dto.valueChangeAmount != null
              ? BigInt(dto.valueChangeAmount)
              : null
            : existing.valueChangeAmount,
        categoryId: categoryId ?? null,
        acquisitionDate:
          dto.acquisitionDate !== undefined
            ? dto.acquisitionDate
              ? new Date(dto.acquisitionDate)
              : null
            : existing.acquisitionDate,
      },
    });

    if (dto.currentValue != null && newValue !== existing.currentValue) {
      await this.prisma.assetHistory.create({
        data: { assetId: id, value: newValue },
      });
    }

    return toAssetDto(updated);
  }

  /** -100..100 inclusive; class-validator only checks the string format. */
  private assertValidRatePct(value?: string): void {
    if (value == null) return;
    const n = Number(value);
    if (!Number.isFinite(n) || n < MIN_RATE_PCT || n > MAX_RATE_PCT) {
      throw new BadRequestException(
        `valueChangeRatePct must be between ${MIN_RATE_PCT} and ${MAX_RATE_PCT}`,
      );
    }
  }

  /**
   * EPIC-024 D2/US-ASSET-6: signed BigInt string, e.g. "-5000000". The DTO's
   * @Matches already rejects non-numeric strings; this only needs to guard
   * against BigInt() throwing on the shape a regex can't easily express
   * (leading zeros, `+` sign, etc. are already blocked by the DTO regex).
   */
  private assertValidValueChangeAmount(value?: string): void {
    if (value == null) return;
    try {
      BigInt(value);
    } catch {
      throw new BadRequestException(
        "valueChangeAmount must be a signed integer string, e.g. '-5000000'",
      );
    }
  }

  /**
   * EPIC-023 D19/US-ASSET-4: rejects an obviously-invalid or future
   * acquisition date instead of silently coercing it — same posture as
   * assertValidRatePct/currentValue above. class-validator's @IsDateString
   * on the DTO already blocks non-ISO strings before this runs; this catches
   * dates class-validator accepts as well-formed but that are not valid
   * business inputs (e.g. tomorrow).
   *
   * EPIC-023 Task H1 review (HIGH fix 1): "future" is judged against WIB
   * "today", not the raw `Date.now()` instant — see wibTodayUtcMidnight
   * above for why.
   */
  private assertValidAcquisitionDate(value?: string): void {
    if (value == null) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("acquisitionDate must be a valid date");
    }
    if (parsed.getTime() > wibTodayUtcMidnight(new Date()).getTime()) {
      throw new BadRequestException("acquisitionDate cannot be in the future");
    }
  }

  /** Validates categoryId belongs to this family group (tenant scope). */
  private async resolveCategoryId(
    familyGroupId: string,
    categoryId?: string,
  ): Promise<string | null> {
    if (!categoryId) return null;
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, familyGroupId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException(
        "categoryId does not belong to this family group",
      );
    }
    return category.id;
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.asset.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Asset not found");
    }
    await this.prisma.asset.delete({ where: { id, familyGroupId } });
  }

  async findHistory(
    familyGroupId: string,
    id: string,
  ): Promise<AssetHistoryResponseDto[]> {
    const asset = await this.prisma.asset.findUnique({
      where: { id, familyGroupId },
    });
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    const history = await this.prisma.assetHistory.findMany({
      where: { assetId: id },
      orderBy: { recordedAt: "asc" },
    });
    return history.map(toHistoryDto);
  }
}
