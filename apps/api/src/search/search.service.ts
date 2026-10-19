import { Injectable } from "@nestjs/common";

import {
  restrictedAccountWhere,
  restrictedTransactionWhere,
  type ScopeSubject,
} from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { SearchResponseDto, SearchResultDto } from "@wealthme/contracts";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `viewerRole`/`viewerUserId` (EPIC-023 Task C) — a `dependant`/
   * `operational` viewer's account/transaction search results are
   * restricted to rows they own or personally recorded, same rule as every
   * other read path (see privacy.util.ts). Category results are left
   * unscoped: a category name (e.g. "Makanan") is shared taxonomy, not a
   * financial value tied to any one member.
   */
  async search(
    familyGroupId: string,
    q: string,
    viewerRole: ScopeSubject = null,
    viewerUserId?: string,
  ): Promise<SearchResponseDto> {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      return { results: [], query: trimmed };
    }

    const [accounts, categories, transactions] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          familyGroupId,
          // AND, not a spread: restrictedAccountWhere contributes its own
          // top-level OR, which a spread would let clobber the text match.
          AND: [
            {
              OR: [
                { name: { contains: trimmed, mode: "insensitive" } },
                { institution: { contains: trimmed, mode: "insensitive" } },
              ],
            },
            restrictedAccountWhere(viewerRole, viewerUserId),
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
          // Safe to spread directly (not AND-wrapped): this query has no
          // other top-level `OR`, so `restrictedTransactionWhere`'s `OR` (if
          // any) cannot clobber anything here.
          ...restrictedTransactionWhere(viewerRole, viewerUserId),
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
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
