import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type CategoryKind, type CoaDirection, Prisma } from "@prisma/client";

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
    const coaAccountId = await this.resolveCoaAccountId(
      familyGroupId,
      dto.kind,
      dto.coaAccountId,
    );
    try {
      const category = await this.prisma.category.create({
        data: {
          familyGroupId,
          name: dto.name,
          kind: dto.kind,
          color: dto.color ?? null,
          icon: dto.icon ?? null,
          isPrivate: dto.isPrivate ?? false,
          coaAccountId,
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

    const coaAccountId =
      dto.coaAccountId !== undefined
        ? await this.resolveCoaAccountId(
            familyGroupId,
            dto.kind ?? existing.kind,
            dto.coaAccountId,
          )
        : undefined;

    const updated = await this.prisma.category.update({
      where: { id, familyGroupId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
        ...(coaAccountId !== undefined && { coaAccountId }),
      },
    });
    return this.toDto(updated);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Category not found");

    // EPIC-022 A5 — `Budget.category` and `MemberCategoryAllowance.category`
    // are `onDelete: Cascade` in the schema, so a bare delete here silently
    // wiped every budget and per-member spending limit built on top of this
    // category. Count dependants first and reject with a clear message
    // naming what is attached, instead of a dialog that only warns "tidak
    // bisa dikembalikan" about the category itself.
    //
    // EPIC-022 A5 follow-up — the count and the delete used to be two plain,
    // separate `await`s: a Budget or MemberCategoryAllowance created in the
    // window between them was invisible to the guard above and then
    // silently wiped by the cascade anyway — the exact data loss this guard
    // exists to prevent, just moved into a race. Wrapping in `$transaction`
    // alone is not sufficient to close it: under the default Read
    // Committed isolation, a DELETE re-resolves its cascade targets against
    // a fresh snapshot taken at DELETE time, so a concurrent insert
    // committed between the count and the delete would still be visible to
    // (and cascaded by) the delete even inside a plain transaction.
    // Serializable isolation makes Postgres detect that write conflict and
    // abort with a retryable serialization failure instead of silently
    // cascading.
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const [budgetCount, allowanceCount] = await Promise.all([
            tx.budget.count({ where: { categoryId: id } }),
            tx.memberCategoryAllowance.count({ where: { categoryId: id } }),
          ]);

          const blockers: string[] = [];
          if (budgetCount > 0) {
            blockers.push(`${budgetCount} anggaran`);
          }
          if (allowanceCount > 0) {
            blockers.push(`${allowanceCount} batasan kategori anggota`);
          }
          if (blockers.length > 0) {
            throw new ConflictException(
              `Kategori ini dipakai ${blockers.join(" dan ")}. Hapus atau ubah dulu sebelum menghapus kategori ini.`,
            );
          }

          await tx.category.delete({ where: { id, familyGroupId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      // EPIC-022 A5 follow-up — Serializable isolation is what makes the
      // count-then-delete race above actually safe: Postgres detects a
      // conflicting concurrent write (e.g. a Budget created in the same
      // window) and aborts this transaction with a serialization failure
      // (Prisma surfaces it as P2034) rather than silently letting the
      // cascade delete it. Left unmapped, `AllExceptionsFilter` turns any
      // non-HttpException into a bare "Internal server error" 500 — trading
      // the silent data loss this guard exists to prevent for an
      // unexplained failure instead. Surface it as a retryable 409 with an
      // honest "try again" message; the caller just needs to resubmit the
      // same delete.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2034"
      ) {
        throw new ConflictException(
          "Terjadi konflik saat menghapus kategori ini karena ada perubahan data bersamaan. Coba lagi.",
        );
      }
      throw err;
    }
  }

  /**
   * Resolve the COA account for a category. When `provided`, validate it belongs
   * to this family group (tenant scope). When omitted, default to a same-group
   * account whose direction matches the kind, falling back to any account —
   * guaranteeing the NOT NULL link is always satisfiable.
   */
  private async resolveCoaAccountId(
    familyGroupId: string,
    kind: CategoryKind,
    provided?: string,
  ): Promise<string> {
    if (provided) {
      const coa = await this.prisma.coaAccount.findFirst({
        where: { id: provided, familyGroupId },
        select: { id: true, direction: true },
      });
      if (!coa) {
        throw new BadRequestException(
          "coaAccountId does not belong to this family group",
        );
      }
      // Only the DIRECT contradiction is rejected — an expense category on an
      // INCOME account, or an income category on an EXPENSE one. That pairing
      // has no reading under which it is correct, and reports group by
      // `direction`, so it silently misfiles money.
      //
      // TRANSFER is deliberately allowed for both, because the seeded chart
      // relies on it: "Cicilan KPR" and "Tabungan & Investasi" are `expense`
      // categories mapped to TRANSFER accounts (50002, 30001) — paying down
      // principal or moving cash to savings is spending from a cashflow view
      // but a balance-sheet transfer, not a P&L line. A stricter
      // "direction must equal kind" rule would reject that real data.
      const contradictory =
        (kind === "income" && coa.direction === "EXPENSE") ||
        (kind === "expense" && coa.direction === "INCOME");
      if (contradictory) {
        throw new BadRequestException(
          `A ${kind} category cannot be mapped to a ${coa.direction} COA account`,
        );
      }
      return coa.id;
    }

    const direction: CoaDirection = kind === "income" ? "INCOME" : "EXPENSE";
    const byDirection = await this.prisma.coaAccount.findFirst({
      where: { familyGroupId, direction },
      orderBy: [{ code: "asc" }],
      select: { id: true },
    });
    if (byDirection) return byDirection.id;

    const anyAccount = await this.prisma.coaAccount.findFirst({
      where: { familyGroupId },
      orderBy: [{ code: "asc" }],
      select: { id: true },
    });
    if (!anyAccount) {
      throw new BadRequestException(
        "This family group has no COA accounts; provision the chart before creating categories",
      );
    }
    return anyAccount.id;
  }

  private toDto(c: {
    id: string;
    familyGroupId: string;
    name: string;
    kind: CategoryKind;
    color: string | null;
    icon: string | null;
    isPrivate: boolean;
    coaAccountId: string;
    createdAt: Date;
  }): CategoryResponseDto {
    return {
      id: c.id,
      familyGroupId: c.familyGroupId,
      name: c.name,
      kind: c.kind,
      coaAccountId: c.coaAccountId,
      color: c.color,
      icon: c.icon,
      isPrivate: c.isPrivate,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
