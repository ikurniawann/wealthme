import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type CategoryKind, Prisma } from "@prisma/client";

import { categoryPrivacyWhere } from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CategoryResponseDto } from "./dto/category-response.dto";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    familyGroupId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    try {
      const category = await this.prisma.category.create({
        data: {
          familyGroupId,
          name: dto.name,
          kind: dto.kind,
          color: dto.color ?? null,
          icon: dto.icon ?? null,
          isPrivate: dto.isPrivate ?? false,
        },
      });
      return this.toDto(category);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          `Category "${dto.name}" already exists for this family group`,
        );
      }
      throw err;
    }
  }

  /**
   * `canSeePrivate` defaults to `true` so internal/non-member-facing callers
   * stay unfiltered — only member-facing controller calls pass `false`.
   */
  async findAll(
    familyGroupId: string,
    canSeePrivate = true,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { familyGroupId, ...categoryPrivacyWhere(canSeePrivate) },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
    return categories.map((c) => this.toDto(c));
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const existing = await this.prisma.category.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Category not found");

    const updated = await this.prisma.category.update({
      where: { id, familyGroupId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
      },
    });
    return this.toDto(updated);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Category not found");
    await this.prisma.category.delete({ where: { id, familyGroupId } });
  }

  private toDto(c: {
    id: string;
    familyGroupId: string;
    name: string;
    kind: CategoryKind;
    color: string | null;
    icon: string | null;
    isPrivate: boolean;
    createdAt: Date;
  }): CategoryResponseDto {
    return {
      id: c.id,
      familyGroupId: c.familyGroupId,
      name: c.name,
      kind: c.kind,
      color: c.color,
      icon: c.icon,
      isPrivate: c.isPrivate,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
