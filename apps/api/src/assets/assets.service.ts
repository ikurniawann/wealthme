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
 * Pro-rata, compute-on-read estimate of an asset's current value given a
 * signed annual value-change rate (negative = depreciation, positive =
 * appreciation). Linear approximation: currentValue × (1 + rate/100 ×
 * yearsElapsed), floored at 0. Asset has no purchase/acquisition date field,
 * so elapsed time is measured from `createdAt` (EPIC-021 Open Design
 * Decision #8).
 */
export function computeEstimatedValue(
  currentValue: bigint,
  ratePct: Decimal | null,
  since: Date,
  now: Date = new Date(),
): bigint {
  if (!ratePct || ratePct.isZero()) return currentValue;
  const yearsElapsed =
    Math.max(now.getTime() - since.getTime(), 0) / MS_PER_YEAR;
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
  categoryId: string | null;
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
    categoryId: asset.categoryId,
    currentEstimatedValue: computeEstimatedValue(
      asset.currentValue,
      asset.valueChangeRatePct,
      asset.createdAt,
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
        categoryId: categoryId ?? null,
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
        categoryId: categoryId ?? null,
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
