import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type ReferenceItemGroup } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { ReferenceItemResponseDto } from "./dto/reference-item-response.dto";

type ReferenceItemRow = {
  id: string;
  familyGroupId: string;
  group: ReferenceItemGroup;
  label: string;
  sortOrder: number;
  isSystem: boolean;
  createdAt: Date;
};

@Injectable()
export class ReferenceItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `group` narrows to one reference list (e.g. the "Bank" section on
   * `/masterdata`); omitted, every group for the family is returned.
   */
  async findAll(
    familyGroupId: string,
    group?: ReferenceItemGroup,
  ): Promise<ReferenceItemResponseDto[]> {
    const items = await this.prisma.referenceItem.findMany({
      where: { familyGroupId, ...(group ? { group } : {}) },
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });
    return items.map((i) => this.toDto(i));
  }

  /**
   * Owner-added items always land after every seeded default: `sortOrder`
   * starts at the current max + 1 within the (familyGroupId, group) pair,
   * so new items append instead of interleaving with the seed order.
   */
  async create(
    familyGroupId: string,
    group: ReferenceItemGroup,
    label: string,
  ): Promise<ReferenceItemResponseDto> {
    const trimmed = label.trim();
    const highest = await this.prisma.referenceItem.findFirst({
      where: { familyGroupId, group },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (highest?.sortOrder ?? -1) + 1;

    try {
      const created = await this.prisma.referenceItem.create({
        data: {
          familyGroupId,
          group,
          label: trimmed,
          sortOrder,
          isSystem: false,
        },
      });
      return this.toDto(created);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(`"${trimmed}" already exists in this list`);
      }
      throw err;
    }
  }

  /**
   * Seeded defaults (`isSystem: true`) are protected — the API is the only
   * "delete" affordance the client has, and letting a family delete its own
   * seeded bank/e-wallet/etc. options out from under itself with no way back
   * (no restore-defaults action exists) is the same silent-data-loss shape
   * `CategoriesService.remove`'s dependant guard exists to prevent.
   */
  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.referenceItem.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Reference item not found");
    if (existing.isSystem) {
      throw new ForbiddenException("Item bawaan sistem tidak bisa dihapus.");
    }
    await this.prisma.referenceItem.delete({ where: { id, familyGroupId } });
  }

  private toDto(item: ReferenceItemRow): ReferenceItemResponseDto {
    return {
      id: item.id,
      familyGroupId: item.familyGroupId,
      group: item.group,
      label: item.label,
      sortOrder: item.sortOrder,
      isSystem: item.isSystem,
      createdAt: item.createdAt.toISOString(),
    };
  }
}
