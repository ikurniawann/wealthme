import { Inject, Injectable, NotFoundException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { OCR_PORT, type OcrPort, type OcrResult } from "./ocr/ocr.port";

import type { CreateTransactionDto } from "./dto/create-transaction.dto";
import type { ListTransactionsQueryDto } from "./dto/list-transactions-query.dto";
import type {
  TransactionListResponseDto,
  TransactionResponseDto,
  TransactionSummaryDto,
} from "./dto/transaction-response.dto";
import type { UpdateTransactionDto } from "./dto/update-transaction.dto";
import type { TransactionType } from "@prisma/client";

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OCR_PORT) private readonly ocrPort: OcrPort,
  ) {}

  async findAll(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildWhere(familyGroupId, query);

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const summary = await this.computeSummary(familyGroupId, query);

    return {
      data: transactions.map(this.toDto),
      meta: { total, page, limit },
      summary,
    };
  }

  async findOne(
    familyGroupId: string,
    id: string,
  ): Promise<TransactionResponseDto> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id, familyGroupId },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
    return this.toDto(tx);
  }

  async create(
    familyGroupId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId, familyGroupId },
    });
    if (!account)
      throw new NotFoundException(`Account ${dto.accountId} not found`);

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId, familyGroupId },
      });
      if (!category)
        throw new NotFoundException(`Category ${dto.categoryId} not found`);
    }

    const created = await this.prisma.$transaction(async (prisma) => {
      const tx = await prisma.transaction.create({
        data: {
          familyGroupId,
          accountId: dto.accountId,
          categoryId: dto.categoryId ?? null,
          amount: BigInt(dto.amount),
          type: dto.type,
          description: dto.description ?? null,
          occurredAt: new Date(dto.occurredAt),
        },
      });

      await this.applyBalanceDelta(
        prisma,
        familyGroupId,
        dto.type,
        dto.accountId,
        BigInt(dto.amount),
        "add",
      );

      return tx;
    });

    return this.toDto(created);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.prisma.transaction.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Transaction not found");

    if (dto.accountId) {
      const acct = await this.prisma.account.findUnique({
        where: { id: dto.accountId, familyGroupId },
      });
      if (!acct)
        throw new NotFoundException(`Account ${dto.accountId} not found`);
    }
    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({
        where: { id: dto.categoryId, familyGroupId },
      });
      if (!cat)
        throw new NotFoundException(`Category ${dto.categoryId} not found`);
    }

    const updated = await this.prisma.$transaction(async (prisma) => {
      const amountChanged =
        dto.amount !== undefined && BigInt(dto.amount) !== existing.amount;
      const typeChanged = dto.type !== undefined && dto.type !== existing.type;
      const accountChanged =
        dto.accountId !== undefined && dto.accountId !== existing.accountId;

      if (amountChanged || typeChanged || accountChanged) {
        await this.applyBalanceDelta(
          prisma,
          familyGroupId,
          existing.type,
          existing.accountId,
          existing.amount,
          "revert",
        );

        const newType = dto.type ?? existing.type;
        const newAccountId = dto.accountId ?? existing.accountId;
        const newAmount =
          dto.amount !== undefined ? BigInt(dto.amount) : existing.amount;
        await this.applyBalanceDelta(
          prisma,
          familyGroupId,
          newType,
          newAccountId,
          newAmount,
          "add",
        );
      }

      return prisma.transaction.update({
        where: { id },
        data: {
          ...(dto.accountId !== undefined && { accountId: dto.accountId }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.amount !== undefined && { amount: BigInt(dto.amount) }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.occurredAt !== undefined && {
            occurredAt: new Date(dto.occurredAt),
          }),
        },
      });
    });

    return this.toDto(updated);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.transaction.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Transaction not found");

    await this.prisma.$transaction(async (prisma) => {
      await this.applyBalanceDelta(
        prisma,
        familyGroupId,
        existing.type,
        existing.accountId,
        existing.amount,
        "revert",
      );
      await prisma.transaction.delete({ where: { id } });
    });
  }

  async getSummary(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
  ): Promise<TransactionSummaryDto> {
    return this.computeSummary(familyGroupId, query);
  }

  async scanReceipt(imageBase64: string): Promise<OcrResult> {
    return this.ocrPort.extractTransaction(imageBase64);
  }

  private buildWhere(familyGroupId: string, query: ListTransactionsQueryDto) {
    return {
      familyGroupId,
      ...(query.type && { type: query.type }),
      ...(query.accountId && { accountId: query.accountId }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...((query.from ?? query.to) && {
        occurredAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
    };
  }

  private async computeSummary(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
  ): Promise<TransactionSummaryDto> {
    const where = this.buildWhere(familyGroupId, query);

    const [incomeAgg, expenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...where, type: "income" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, type: "expense" },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = incomeAgg._sum.amount ?? BigInt(0);
    const totalExpense = expenseAgg._sum.amount ?? BigInt(0);
    const netBalance = totalIncome - totalExpense;

    return {
      totalIncome: totalIncome.toString(),
      totalExpense: totalExpense.toString(),
      netBalance: netBalance.toString(),
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
    };
  }

  private async applyBalanceDelta(
    prisma: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
    familyGroupId: string,
    type: TransactionType,
    accountId: string,
    amount: bigint,
    direction: "add" | "revert",
  ): Promise<void> {
    const sign = direction === "add" ? BigInt(1) : BigInt(-1);

    if (type === "income") {
      await prisma.account.update({
        where: { id: accountId, familyGroupId },
        data: { balance: { increment: amount * sign } },
      });
    } else {
      await prisma.account.update({
        where: { id: accountId, familyGroupId },
        data: { balance: { increment: -amount * sign } },
      });
    }
  }

  private toDto(tx: {
    id: string;
    familyGroupId: string;
    accountId: string;
    categoryId: string | null;
    amount: bigint;
    type: TransactionType;
    description: string | null;
    occurredAt: Date;
    createdAt: Date;
  }): TransactionResponseDto {
    return {
      id: tx.id,
      familyGroupId: tx.familyGroupId,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      amount: tx.amount.toString(),
      type: tx.type,
      description: tx.description,
      occurredAt: tx.occurredAt.toISOString(),
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
