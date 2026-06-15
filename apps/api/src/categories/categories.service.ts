import { ConflictException, Injectable } from "@nestjs/common";
import { type CategoryKind, Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CategoryResponseDto } from "./dto/category-response.dto";
import type { CreateCategoryDto } from "./dto/create-category.dto";

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

  async findAll(familyGroupId: string): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { familyGroupId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
    return categories.map((c) => this.toDto(c));
  }

  private toDto(c: {
    id: string;
    familyGroupId: string;
    name: string;
    kind: CategoryKind;
    color: string | null;
    icon: string | null;
    createdAt: Date;
  }): CategoryResponseDto {
    return {
      id: c.id,
      familyGroupId: c.familyGroupId,
      name: c.name,
      kind: c.kind,
      color: c.color,
      icon: c.icon,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
