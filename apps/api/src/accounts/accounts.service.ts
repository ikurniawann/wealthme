import { Injectable, NotFoundException } from "@nestjs/common";

import { accountPrivacyWhere } from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CryptoService } from "../crypto/crypto.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { AccountResponseDto } from "./dto/account-response.dto";
import type { CreateAccountDto } from "./dto/create-account.dto";
import type { UpdateAccountDto } from "./dto/update-account.dto";

@Injectable()
export class AccountsService {
  constructor(
    private readonly crypto: CryptoService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * `canSeePrivate` defaults to `true` so internal/non-member-facing callers
   * stay unfiltered — only member-facing controller calls pass `false`.
   */
  async findAll(
    familyGroupId: string,
    canSeePrivate = true,
  ): Promise<AccountResponseDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: { familyGroupId, ...accountPrivacyWhere(canSeePrivate) },
      orderBy: { createdAt: "asc" },
    });
    return accounts.map((a) => this.toDto(a));
  }

  async findOne(
    familyGroupId: string,
    id: string,
    canSeePrivate = true,
  ): Promise<AccountResponseDto> {
    const account = await this.prisma.account.findUnique({
      // Privacy fragment first: id/familyGroupId are fixed literals that
      // must win the merge, keeping this a `AccountWhereUniqueInput` (id
      // typed as `string`, not a Prisma filter) instead of the broader
      // `AccountWhereInput` shape `accountPrivacyWhere` uses.
      where: { ...accountPrivacyWhere(canSeePrivate), id, familyGroupId },
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
        maskedNumber: dto.maskedNumber
          ? this.crypto.encrypt(dto.maskedNumber)
          : null,
        balance: BigInt(dto.balance),
        currency: dto.currency ?? "IDR",
        isPrivate: dto.isPrivate ?? false,
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
      where: { id, familyGroupId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.institution !== undefined && { institution: dto.institution }),
        ...(dto.maskedNumber !== undefined && {
          maskedNumber: this.crypto.encrypt(dto.maskedNumber),
        }),
        ...(dto.balance !== undefined && { balance: BigInt(dto.balance) }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
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
    // Donation.accountId/transactionId have no DB foreign key (a donation must
    // survive its transaction being reclassified), so deleting an account
    // would otherwise leave a dangling reference once the cascade removes the
    // linked transaction below. Clear the link but keep the donation's own
    // amount/date/recipient as historical record.
    await this.prisma.$transaction([
      this.prisma.donation.updateMany({
        where: { familyGroupId, accountId: id },
        data: { accountId: null, transactionId: null },
      }),
      this.prisma.account.delete({ where: { id, familyGroupId } }),
    ]);
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
    isPrivate: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AccountResponseDto {
    return {
      id: account.id,
      familyGroupId: account.familyGroupId,
      name: account.name,
      type: account.type as AccountResponseDto["type"],
      institution: account.institution,
      maskedNumber: account.maskedNumber
        ? this.crypto.decrypt(account.maskedNumber)
        : null,
      balance: account.balance.toString(),
      currency: account.currency,
      isPrivate: account.isPrivate,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
