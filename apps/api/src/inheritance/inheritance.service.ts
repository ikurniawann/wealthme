import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateInheritanceAssetDto } from "./dto/create-inheritance-asset.dto";
import type {
  InheritanceAssetResponseDto,
  InheritanceHeirResponseDto,
} from "./dto/inheritance-asset-response.dto";
import type { UpdateInheritanceAssetDto } from "./dto/update-inheritance-asset.dto";

type HeirRow = {
  id: string;
  inheritanceAssetId: string;
  name: string;
  relationship: string;
  sharePercent: { toString(): string };
  createdAt: Date;
};

type AssetRow = {
  id: string;
  familyGroupId: string;
  name: string;
  assetType: string;
  estimatedValue: bigint;
  currency: string;
  notes: string | null;
  visibility: string;
  documentUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  heirs: HeirRow[];
};

function toHeirDto(row: HeirRow): InheritanceHeirResponseDto {
  return {
    id: row.id,
    inheritanceAssetId: row.inheritanceAssetId,
    name: row.name,
    relationship: row.relationship,
    sharePercent: row.sharePercent.toString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function toAssetDto(row: AssetRow): InheritanceAssetResponseDto {
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    name: row.name,
    assetType: row.assetType,
    estimatedValue: row.estimatedValue.toString(),
    currency: row.currency,
    notes: row.notes,
    visibility: row.visibility,
    documentUrl: row.documentUrl,
    heirs: row.heirs.map(toHeirDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateSharePercent(heirs: { sharePercent: number }[]): void {
  const total = heirs.reduce((sum, h) => sum + h.sharePercent, 0);
  if (total > 100) {
    throw new BadRequestException(`Total sharePercent (${total}) exceeds 100`);
  }
}

@Injectable()
export class InheritanceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    familyGroupId: string,
    dto: CreateInheritanceAssetDto,
  ): Promise<InheritanceAssetResponseDto> {
    if (dto.heirs && dto.heirs.length > 0) {
      validateSharePercent(dto.heirs);
    }

    const asset = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inheritanceAsset.create({
        data: {
          familyGroupId,
          name: dto.name,
          assetType: dto.assetType,
          estimatedValue: BigInt(dto.estimatedValue),
          currency: dto.currency ?? "IDR",
          notes: dto.notes ?? null,
          visibility: dto.visibility ?? "heirs_only",
          heirs:
            dto.heirs && dto.heirs.length > 0
              ? {
                  create: dto.heirs.map((h) => ({
                    name: h.name,
                    relationship: h.relationship,
                    sharePercent: h.sharePercent,
                  })),
                }
              : undefined,
        },
        include: { heirs: true },
      });
      return created;
    });

    return toAssetDto(asset);
  }

  async findAll(familyGroupId: string): Promise<InheritanceAssetResponseDto[]> {
    const rows = await this.prisma.inheritanceAsset.findMany({
      where: { familyGroupId },
      include: { heirs: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toAssetDto);
  }

  async findOne(
    familyGroupId: string,
    id: string,
  ): Promise<InheritanceAssetResponseDto> {
    const row = await this.prisma.inheritanceAsset.findUnique({
      where: { id, familyGroupId },
      include: { heirs: true },
    });
    if (!row) {
      throw new NotFoundException("Inheritance asset not found");
    }
    return toAssetDto(row);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateInheritanceAssetDto,
  ): Promise<InheritanceAssetResponseDto> {
    const existing = await this.prisma.inheritanceAsset.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Inheritance asset not found");
    }

    if (dto.heirs && dto.heirs.length > 0) {
      validateSharePercent(dto.heirs);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.heirs !== undefined) {
        await tx.inheritanceHeir.deleteMany({
          where: { inheritanceAssetId: id },
        });
      }

      return tx.inheritanceAsset.update({
        where: { id, familyGroupId },
        data: {
          name: dto.name ?? existing.name,
          assetType: dto.assetType ?? existing.assetType,
          estimatedValue:
            dto.estimatedValue !== undefined
              ? BigInt(dto.estimatedValue)
              : existing.estimatedValue,
          currency: dto.currency ?? existing.currency,
          notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
          visibility: dto.visibility ?? existing.visibility,
          heirs:
            dto.heirs !== undefined && dto.heirs.length > 0
              ? {
                  create: dto.heirs.map((h) => ({
                    name: h.name,
                    relationship: h.relationship,
                    sharePercent: h.sharePercent,
                  })),
                }
              : undefined,
        },
        include: { heirs: true },
      });
    });

    return toAssetDto(updated);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.inheritanceAsset.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Inheritance asset not found");
    }
    await this.prisma.inheritanceAsset.delete({ where: { id, familyGroupId } });
  }

  async updateDocumentUrl(
    familyGroupId: string,
    id: string,
    url: string,
  ): Promise<InheritanceAssetResponseDto> {
    const existing = await this.prisma.inheritanceAsset.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Inheritance asset not found");
    }
    const updated = await this.prisma.inheritanceAsset.update({
      where: { id, familyGroupId },
      data: { documentUrl: url },
      include: { heirs: true },
    });
    return toAssetDto(updated);
  }
}
