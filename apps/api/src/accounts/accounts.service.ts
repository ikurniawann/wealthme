import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  accountOwnerWhere,
  accountPrivacyWhere,
  restrictedAccountWhere,
  type ScopeSubject,
} from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CryptoService } from "../crypto/crypto.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { AccountResponseDto } from "./dto/account-response.dto";
import type { CreateAccountDto } from "./dto/create-account.dto";
import type { AccountOwnerFilter } from "./dto/list-accounts-query.dto";
import type { UpdateAccountDto } from "./dto/update-account.dto";

/**
 * `Account` has a unique index on `(familyGroupId, name)`, so saving a second
 * account under a name the family already uses raises Prisma P2002. Nothing
 * mapped it, and `AllExceptionsFilter` flattens every non-`HttpException` to a
 * bare "Internal server error", so the user saw a 500 behind a generic "Gagal
 * menyimpan" toast with no way to tell that the name was the problem.
 * Reproduced live on DEV: the second `POST /accounts` with a duplicate name
 * returned 500 `Internal server error`, API log
 * `Unique constraint failed on the fields: (familyGroupId, name)`.
 *
 * Returns the error to throw so both `create` and `update` map it identically;
 * any other Prisma code is passed through untouched.
 */
function mapDuplicateAccountName(err: unknown, name: string): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    return new ConflictException(
      `Nama "${name}" sudah dipakai akun lain di keluarga ini. Pakai nama yang berbeda.`,
    );
  }
  return err;
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly crypto: CryptoService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * `canSeePrivate` defaults to `true` so internal/non-member-facing callers
   * stay unfiltered — only member-facing controller calls pass `false`.
   * `viewerRole`/`requestingUserId` (EPIC-023 Task C) narrow a `dependant`/
   * `operational` viewer to accounts they own — `restrictedAccountWhere` is
   * spread AFTER `accountOwnerWhere` so it wins the `ownerUserId` key: a
   * row-scoped role's own account is all they ever see, regardless of what
   * `?owner=family` (or any other value) asks for.
   */
  async findAll(
    familyGroupId: string,
    canSeePrivate = true,
    ownerFilter?: AccountOwnerFilter,
    requestingUserId?: string,
    viewerRole: ScopeSubject = null,
  ): Promise<AccountResponseDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: {
        familyGroupId,
        ...accountPrivacyWhere(canSeePrivate),
        ...accountOwnerWhere(ownerFilter, requestingUserId),
        ...restrictedAccountWhere(viewerRole, requestingUserId),
      },
      include: { owner: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return accounts.map((a) => this.toDto(a));
  }

  async findOne(
    familyGroupId: string,
    id: string,
    canSeePrivate = true,
    viewerRole: ScopeSubject = null,
    requestingUserId?: string,
  ): Promise<AccountResponseDto> {
    const account = await this.prisma.account.findUnique({
      // Privacy fragment first: id/familyGroupId are fixed literals that
      // must win the merge, keeping this a `AccountWhereUniqueInput` (id
      // typed as `string`, not a Prisma filter) instead of the broader
      // `AccountWhereInput` shape `accountPrivacyWhere` uses.
      where: {
        ...accountPrivacyWhere(canSeePrivate),
        ...restrictedAccountWhere(viewerRole, requestingUserId),
        id,
        familyGroupId,
      },
      include: { owner: { select: { name: true } } },
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
    if (dto.ownerUserId) {
      await this.assertOwnerIsFamilyMember(familyGroupId, dto.ownerUserId);
    }

    try {
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
          ownerUserId: dto.ownerUserId ?? null,
        },
        include: { owner: { select: { name: true } } },
      });
      return this.toDto(account);
    } catch (err: unknown) {
      throw mapDuplicateAccountName(err, dto.name);
    }
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

    // `undefined` = leave ownership unchanged; `null` = explicit clear back
    // to family-shared; any other string = reassign (validated below against
    // Member so an owner can never point an account at a cross-tenant or
    // non-member user id).
    if (dto.ownerUserId) {
      await this.assertOwnerIsFamilyMember(familyGroupId, dto.ownerUserId);
    }

    try {
      const updated = await this.prisma.account.update({
        where: { id, familyGroupId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.institution !== undefined && {
            institution: dto.institution,
          }),
          ...(dto.maskedNumber !== undefined && {
            maskedNumber: this.crypto.encrypt(dto.maskedNumber),
          }),
          ...(dto.balance !== undefined && { balance: BigInt(dto.balance) }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
          ...(dto.ownerUserId !== undefined && {
            ownerUserId: dto.ownerUserId,
          }),
        },
        include: { owner: { select: { name: true } } },
      });
      return this.toDto(updated);
    } catch (err: unknown) {
      throw mapDuplicateAccountName(err, dto.name ?? existing.name);
    }
  }

  /**
   * EPIC-019 Task A — an account's owner must be a Member of the SAME family
   * group; rejects cross-tenant user ids and users who exist but never
   * joined this family (a plain `User.findUnique` would miss both cases).
   */
  private async assertOwnerIsFamilyMember(
    familyGroupId: string,
    ownerUserId: string,
  ): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { userId_familyGroupId: { userId: ownerUserId, familyGroupId } },
      select: { id: true },
    });
    if (!member) {
      throw new BadRequestException(
        "ownerUserId must belong to a member of this family group",
      );
    }
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.account.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Account not found");
    }

    // EPIC-021 Group B — an account that is the SOURCE of a real two-sided
    // transfer (toAccountId not null) cannot be deleted: Transaction.accountId
    // is onDelete: Cascade, so deleting this account would cascade-delete
    // that transfer row while the DESTINATION account's already-applied
    // balance credit is never reversed (the DB cascade is a raw row delete,
    // it never runs applyTransferBalanceDelta) — leaving the destination
    // with a credit backed by no transaction. Reject up front instead of
    // corrupting a balance the user doesn't own the account for.
    const sourceOfTransferCount = await this.prisma.transaction.count({
      where: { familyGroupId, accountId: id, toAccountId: { not: null } },
    });
    if (sourceOfTransferCount > 0) {
      throw new ConflictException(
        "Akun ini adalah sumber dari transaksi transfer ke akun lain. Hapus atau ubah transaksi transfer tersebut terlebih dahulu sebelum menghapus akun ini.",
      );
    }

    try {
      // Donation.accountId/transactionId have no DB foreign key (a donation
      // must survive its transaction being reclassified), so deleting an
      // account would otherwise leave a dangling reference once the cascade
      // removes the linked transaction below. Clear the link but keep the
      // donation's own amount/date/recipient as historical record.
      await this.prisma.$transaction([
        this.prisma.donation.updateMany({
          where: { familyGroupId, accountId: id },
          data: { accountId: null, transactionId: null },
        }),
        this.prisma.account.delete({ where: { id, familyGroupId } }),
      ]);
    } catch (err: unknown) {
      // This account is the DESTINATION of one or more transfers —
      // Transaction.toAccountId is onDelete: Restrict (protects transfer
      // history), so Postgres raises P2003 here. Surface a clean 4xx instead
      // of letting the raw Prisma error bubble up as an unhandled 500.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        throw new ConflictException(
          "Akun ini adalah tujuan dari satu atau lebih transaksi transfer. Hapus atau ubah transaksi transfer tersebut terlebih dahulu sebelum menghapus akun ini.",
        );
      }
      throw err;
    }
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
    ownerUserId: string | null;
    owner?: { name: string } | null;
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
      ownerUserId: account.ownerUserId,
      ownerName: account.owner?.name ?? null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
