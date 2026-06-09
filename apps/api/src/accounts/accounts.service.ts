import { Injectable, NotFoundException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { AccountResponseDto } from "./dto/account-response.dto";
import type { CreateAccountDto } from "./dto/create-account.dto";
import type { UpdateAccountDto } from "./dto/update-account.dto";

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(familyGroupId: string): Promise<AccountResponseDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: { familyGroupId },
      orderBy: { createdAt: "asc" },
    });
    return accounts.map((a) => this.toDto(a));
  }

  async findOne(
    familyGroupId: string,
    id: string,
  ): Promise<AccountResponseDto> {
    const account = await this.prisma.account.findUnique({
      where: { id, familyGroupId },
    });
    if (!account) {
      throw new NotFoundException("Account not found");
    }
    return this.toDto(account);
  }

  async create(
    familyGroupId: string,
    dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.prisma.account.create({
      data: {
        familyGroupId,
        name: dto.name,
        type: dto.type,
        institution: dto.institution ?? null,
        maskedNumber: dto.maskedNumber ?? null,
        balance: BigInt(dto.balance),
        currency: dto.currency ?? "IDR",
      },
    });
    return this.toDto(account);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const existing = await this.prisma.account.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Account not found");
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.institution !== undefined && { institution: dto.institution }),
        ...(dto.maskedNumber !== undefined && {
          maskedNumber: dto.maskedNumber,
        }),
        ...(dto.balance !== undefined && { balance: BigInt(dto.balance) }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
      },
    });
    return this.toDto(updated);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.account.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Account not found");
    }
    await this.prisma.account.delete({ where: { id } });
  }

  private toDto(account: {
    id: string;
    familyGroupId: string;
    name: string;
    type: string;
    institution: string | null;
    maskedNumber: string | null;
    balance: bigint;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
  }): AccountResponseDto {
    return {
      id: account.id,
      familyGroupId: account.familyGroupId,
      name: account.name,
      type: account.type as AccountResponseDto["type"],
      institution: account.institution,
      maskedNumber: account.maskedNumber,
      balance: account.balance.toString(),
      currency: account.currency,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
