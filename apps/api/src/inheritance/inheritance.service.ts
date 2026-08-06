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
  memberUserId: string | null;
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
  assetId: string | null;
  createdAt: Date;
  updatedAt: Date;
  heirs: HeirRow[];
};

// EPIC-023 F1 (D14, US-INS-5) — live-link resolution, same reconciliation
// and mechanism as InsurancesService (Decision #9: heirs and beneficiaries
// share one shape/rule). See that file's `MemberLookup` comment for the
// full reasoning: a linked heir's `name`/`relationship` are resolved fresh
// from the CURRENT Member/User rows on every read, never from the copy
// stored on the heir row.
type MemberLookup = ReadonlyMap<
  string,
  { name: string; relationship: string | null }
>;

function toHeirDto(
  row: HeirRow,
  lookup: MemberLookup,
): InheritanceHeirResponseDto {
  const linked = row.memberUserId ? lookup.get(row.memberUserId) : undefined;
  // EPIC-023 Group F fix round (MEDIUM 8) — a `memberUserId` that no longer
  // resolves (the linked member was removed from the family) is an
  // ORPHANED link, not a live one: null it out so a consumer can tell "live
  // link, name/relationship are current" apart from "the link broke, this
  // is a frozen last-known copy". Mirrors InsurancesService.toBeneficiaryDto.
  const isOrphaned = row.memberUserId !== null && !linked;
  return {
    id: row.id,
    inheritanceAssetId: row.inheritanceAssetId,
    name: linked?.name ?? row.name,
    relationship: linked?.relationship ?? row.relationship,
    sharePercent: row.sharePercent.toString(),
    memberUserId: isOrphaned ? null : row.memberUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAssetDto(
  row: AssetRow,
  lookup: MemberLookup = new Map(),
): InheritanceAssetResponseDto {
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
    assetId: row.assetId,
    heirs: row.heirs.map((h) => toHeirDto(h, lookup)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// EPIC-021 Group D (#12) — heirs are optional (zero heirs is a valid,
// recordable state) and percentages may be partially allocated; only reject
// when the sum exceeds 100 ("belum dialokasikan" covers the remainder).
function validateSharePercent(heirs: { sharePercent: number }[]): void {
  const total = heirs.reduce((sum, h) => sum + h.sharePercent, 0);
  if (total > 100) {
    throw new BadRequestException(`Total sharePercent (${total}) exceeds 100`);
  }
}

@Injectable()
export class InheritanceService {
  constructor(private readonly prisma: PrismaService) {}

  // EPIC-021 Group D (#11) — tenant-scoped lookup so a picked assetId can
  // never belong to another family group.
  private async assertAssetInFamilyGroup(
    familyGroupId: string,
    assetId: string,
  ): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId, familyGroupId },
    });
    if (!asset) {
      throw new BadRequestException(
        "assetId does not reference an asset in this family group",
      );
    }
  }

  // TS review fix #1 — tenant-scoped lookup so a heir's optional
  // memberUserId can never reference a user from another family group.
  private async assertMemberInFamilyGroup(
    familyGroupId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.member.findFirst({
      where: { userId, familyGroupId },
    });
    if (!member) {
      throw new BadRequestException(
        "memberUserId does not reference a member of this family group",
      );
    }
  }

  private async assertHeirMembersInFamilyGroup(
    familyGroupId: string,
    heirs: { memberUserId?: string }[],
  ): Promise<void> {
    for (const heir of heirs) {
      if (heir.memberUserId) {
        await this.assertMemberInFamilyGroup(familyGroupId, heir.memberUserId);
      }
    }
  }

  // EPIC-023 F1 (D14) — batch-resolve the CURRENT name/relationship for
  // every linked `memberUserId` across a set of heir rows. Mirrors
  // InsurancesService.resolveMemberLookup.
  private async resolveMemberLookup(
    familyGroupId: string,
    memberUserIds: readonly (string | null)[],
  ): Promise<MemberLookup> {
    const ids = Array.from(
      new Set(memberUserIds.filter((id): id is string => !!id)),
    );
    if (ids.length === 0) return new Map();

    const members = await this.prisma.member.findMany({
      where: { familyGroupId, userId: { in: ids } },
      include: { user: { select: { name: true } } },
    });

    return new Map(
      members.map((m) => [
        m.userId,
        { name: m.user.name, relationship: m.relationship },
      ]),
    );
  }

  async create(
    familyGroupId: string,
    dto: CreateInheritanceAssetDto,
  ): Promise<InheritanceAssetResponseDto> {
    if (dto.heirs && dto.heirs.length > 0) {
      validateSharePercent(dto.heirs);
      await this.assertHeirMembersInFamilyGroup(familyGroupId, dto.heirs);
    }
    if (dto.assetId) {
      await this.assertAssetInFamilyGroup(familyGroupId, dto.assetId);
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
          assetId: dto.assetId ?? null,
          heirs:
            dto.heirs && dto.heirs.length > 0
              ? {
                  create: dto.heirs.map((h) => ({
                    name: h.name,
                    relationship: h.relationship,
                    sharePercent: h.sharePercent,
                    memberUserId: h.memberUserId ?? null,
                  })),
                }
              : undefined,
        },
        include: { heirs: true },
      });
      return created;
    });

    const lookup = await this.resolveMemberLookup(
      familyGroupId,
      asset.heirs.map((h) => h.memberUserId),
    );
    return toAssetDto(asset, lookup);
  }

  async findAll(familyGroupId: string): Promise<InheritanceAssetResponseDto[]> {
    const rows = await this.prisma.inheritanceAsset.findMany({
      where: { familyGroupId },
      include: { heirs: true },
      orderBy: { createdAt: "asc" },
    });
    const lookup = await this.resolveMemberLookup(
      familyGroupId,
      rows.flatMap((r) => r.heirs.map((h) => h.memberUserId)),
    );
    return rows.map((row) => toAssetDto(row, lookup));
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
    const lookup = await this.resolveMemberLookup(
      familyGroupId,
      row.heirs.map((h) => h.memberUserId),
    );
    return toAssetDto(row, lookup);
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
      await this.assertHeirMembersInFamilyGroup(familyGroupId, dto.heirs);
    }
    // TS review fix #2 — explicit `null` clears a previously picked Asset
    // link (switching back to manual entry); `undefined` leaves it untouched;
    // a non-empty string is tenant-validated before being written.
    if (dto.assetId) {
      await this.assertAssetInFamilyGroup(familyGroupId, dto.assetId);
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
          assetId: dto.assetId !== undefined ? dto.assetId : existing.assetId,
          heirs:
            dto.heirs !== undefined && dto.heirs.length > 0
              ? {
                  create: dto.heirs.map((h) => ({
                    name: h.name,
                    relationship: h.relationship,
                    sharePercent: h.sharePercent,
                    memberUserId: h.memberUserId ?? null,
                  })),
                }
              : undefined,
        },
        include: { heirs: true },
      });
    });

    const lookup = await this.resolveMemberLookup(
      familyGroupId,
      updated.heirs.map((h) => h.memberUserId),
    );
    return toAssetDto(updated, lookup);
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
    const lookup = await this.resolveMemberLookup(
      familyGroupId,
      updated.heirs.map((h) => h.memberUserId),
    );
    return toAssetDto(updated, lookup);
  }
}
