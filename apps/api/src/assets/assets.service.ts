import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type {
  AssetHistoryResponseDto,
  AssetResponseDto,
} from "./dto/asset-response.dto";
import type { CreateAssetDto } from "./dto/create-asset.dto";
import type { UpdateAssetDto } from "./dto/update-asset.dto";

function toAssetDto(asset: {
  id: string;
  familyGroupId: string;
  name: string;
  type: string;
  currentValue: bigint;
  currency: string;
  notes: string | null;
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
    const asset = await this.prisma.asset.create({
      data: {
        familyGroupId,
        name: dto.name,
        type: dto.type,
        currentValue: BigInt(dto.currentValue),
        currency: dto.currency ?? "IDR",
        notes: dto.notes ?? null,
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
    const newValue =
      dto.currentValue != null
        ? BigInt(dto.currentValue)
        : existing.currentValue;

    const updated = await this.prisma.asset.update({
      where: { id, familyGroupId },
      data: {
        name: dto.name ?? existing.name,
        type: dto.type ?? existing.type,
        currentValue: newValue,
        currency: dto.currency ?? existing.currency,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
      },
    });

    if (dto.currentValue != null && newValue !== existing.currentValue) {
      await this.prisma.assetHistory.create({
        data: { assetId: id, value: newValue },
      });
    }

    return toAssetDto(updated);
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
