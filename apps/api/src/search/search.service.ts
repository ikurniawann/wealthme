import { Injectable } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { SearchResponseDto, SearchResultDto } from "@wealthme/contracts";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(familyGroupId: string, q: string): Promise<SearchResponseDto> {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      return { results: [], query: trimmed };
    }

    const [accounts, categories, transactions] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          familyGroupId,
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            { institution: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      this.prisma.category.findMany({
        where: {
          familyGroupId,
          name: { contains: trimmed, mode: "insensitive" },
        },
        take: 5,
      }),
      this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          description: { contains: trimmed, mode: "insensitive" },
        },
        take: 5,
      }),
    ]);

    const accountResults: SearchResultDto[] = accounts.map((a) => ({
      type: "account",
      id: a.id,
      label: a.name,
      sub: a.institution ?? a.type,
      href: "/rekening",
      icon: "Landmark",
    }));

    const categoryResults: SearchResultDto[] = categories.map((c) => ({
      type: "category",
      id: c.id,
      label: c.name,
      sub: c.kind,
      href: "/transaksi",
      icon: "ReceiptText",
    }));

    const transactionResults: SearchResultDto[] = transactions.map((t) => ({
      type: "transaction",
      id: t.id,
      label: t.description ?? "Transaksi",
      sub: `${t.type} · ${new Date(t.occurredAt).toLocaleDateString("id-ID")}`,
      href: "/transaksi",
      icon: "ArrowUpDown",
    }));

    return {
      results: [...accountResults, ...categoryResults, ...transactionResults],
      query: trimmed,
    };
  }
}
