import { Injectable } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CategoryResponseDto } from "./dto/category-response.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(familyGroupId: string): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { familyGroupId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
    return categories.map((c) => ({
      id: c.id,
      familyGroupId: c.familyGroupId,
      name: c.name,
      kind: c.kind,
      color: c.color,
      icon: c.icon,
      createdAt: c.createdAt.toISOString(),
    }));
  }
}
