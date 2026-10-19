import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type PocketKind, type Role } from "@prisma/client";

import {
  accountOwnerWhere,
  accountPrivacyWhere,
  isRowScoped,
  restrictedAccountWhere,
  type ScopeSubject,
} from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CryptoService } from "../crypto/crypto.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { assertPocketLinkAllowed } from "./pocket-rules.util";

import type { AccountBankDetailDto } from "./dto/account-bank-detail.dto";
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
      `Akun "${name}" dengan nomor yang sama sudah ada di keluarga ini. Pakai nomor yang berbeda.`,
    );
  }
  return err;
}

export interface AccountActor {
  userId: string;
  role: Role;
}

const MASTER_LIKE_ROLES: ReadonlySet<Role> = new Set<Role>(["owner", "spouse"]);

/** Master/Co-Master — may set any owner and edit any account. */
export function isMasterLike(actor: AccountActor | undefined): boolean {
  return !actor || MASTER_LIKE_ROLES.has(actor.role);
}

/**
 * EPIC-033 R3 follow-up — only Master/Co-Master may create or reassign
 * accounts for someone else (or for the family). Any other role is pinned
 * to itself as owner. Shared with PlatformAccountsService so a platform
 * account and its pockets follow the exact same owner rule.
 */
export function resolveOwnerForActor(
  actor: AccountActor | undefined,
  ownerUserId: string | null | undefined,
): string | null | undefined {
  if (isMasterLike(actor)) return ownerUserId;
  if (ownerUserId === undefined || ownerUserId === actor!.userId) {
    return actor!.userId;
  }
  throw new ForbiddenException(
    "Only Master or Co-Master can set another owner on an account",
  );
}

/**
 * Relations every account read returns: the owner's and holder's display
 * names, and the share list ("Dibagikan kepada").
 */
export const ACCOUNT_INCLUDE = {
  owner: { select: { name: true } },
  holder: { select: { name: true } },
  shares: {
    select: { userId: true, canPost: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.AccountInclude;

type AccountRow = Prisma.AccountGetPayload<{ include: typeof ACCOUNT_INCLUDE }>;

/** yyyy-mm-dd → a UTC midnight Date for a `@db.Date` column; null clears. */
function toDbDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

function fromDbDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Trims a free-text field; an empty string clears it like `null`. */
function cleanText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
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
        // A row-scoped viewer's own scope (owned + shared with them) is the
        // whole lens; the me/family filter only narrows unrestricted roles.
        ...(isRowScoped(viewerRole)
          ? {}
          : accountOwnerWhere(ownerFilter, requestingUserId)),
        ...restrictedAccountWhere(viewerRole, requestingUserId),
      },
      include: ACCOUNT_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    const activity = await this.lastActivityByAccount(
      familyGroupId,
      accounts.map((a) => a.id),
    );
    return accounts.map((a) => this.toDto(a, activity.get(a.id) ?? null));
  }

  /**
   * Rekening v3 — latest transaction date (either leg of a transfer) per
   * account, so the page can flag an account drifting toward dormancy.
   */
  private async lastActivityByAccount(
    familyGroupId: string,
    ids: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (ids.length === 0) return out;
    const [sources, destinations] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ["accountId"],
        where: { familyGroupId, accountId: { in: ids } },
        _max: { occurredAt: true },
      }),
      this.prisma.transaction.groupBy({
        by: ["toAccountId"],
        where: { familyGroupId, toAccountId: { in: ids } },
        _max: { occurredAt: true },
      }),
    ]);
    const note = (id: string | null, at: Date | null) => {
      if (!id || !at) return;
      const iso = at.toISOString().slice(0, 10);
      const prev = out.get(id);
      if (!prev || iso > prev) out.set(id, iso);
    };
    for (const r of sources) note(r.accountId, r._max.occurredAt);
    for (const r of destinations) note(r.toAccountId, r._max.occurredAt);
    return out;
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
      include: ACCOUNT_INCLUDE,
    });
    if (!account) {
      throw new NotFoundException("Account not found");
    }
    return this.toDto(account);
  }

  /**
   * EPIC-033 R3 follow-up — only Master/Co-Master may create or reassign
   * accounts for someone else (or for the family). Any other role is pinned
   * to itself as owner: a child could previously open "Tambah Rekening" and
   * pick any family member (or "Keluarga") as Pemilik.
   */
  private assertOwnerAllowedFor(
    actor: AccountActor | undefined,
    ownerUserId: string | null | undefined,
  ): string | null | undefined {
    return resolveOwnerForActor(actor, ownerUserId);
  }

  /**
   * Investasi R2 — a pocket link (platformAccountId + pocketKind) is only
   * valid on an `investment` account. A pocketKind without a platform
   * account means nothing; a link without a kind defaults to "general".
   * Whenever a link is created or any of its inputs (platform, kind,
   * currency, type) changes, the shared pocket rules run: same family,
   * owner rule, catalog kind, kind → currency, one pocket per
   * (kind, currency). Returns the link columns plus the resolved currency.
   */
  private async pocketLinkData(
    familyGroupId: string,
    input: {
      type: string;
      platformAccountId: string | undefined;
      pocketKind: PocketKind | undefined;
      currency: string | undefined;
      typeChanged: boolean;
    },
    actor: AccountActor | undefined,
    existing?: {
      id: string;
      platformAccountId: string | null;
      pocketKind: PocketKind | null;
      currency: string;
    },
  ): Promise<{
    platformAccountId?: string;
    pocketKind?: PocketKind;
    currency?: string;
  }> {
    const linkedTo =
      input.platformAccountId ?? existing?.platformAccountId ?? null;
    if (input.pocketKind !== undefined && !linkedTo) {
      throw new BadRequestException(
        "pocketKind hanya berlaku untuk kantong dana yang terhubung ke akun platform (platformAccountId).",
      );
    }
    if (!linkedTo) return {};
    if (input.type !== "investment") {
      throw new BadRequestException(
        "Kantong dana platform harus bertipe investment.",
      );
    }
    const touched =
      !existing ||
      input.platformAccountId !== undefined ||
      input.pocketKind !== undefined ||
      input.currency !== undefined ||
      input.typeChanged;
    if (!touched) return {};
    const pocketKind =
      input.pocketKind ?? existing?.pocketKind ?? ("general" as PocketKind);
    const currency = await assertPocketLinkAllowed(this.prisma, {
      familyGroupId,
      platformAccountId: linkedTo,
      pocketKind,
      currency: input.currency ?? existing?.currency,
      actor,
      excludeAccountId: existing?.id,
    });
    return { platformAccountId: linkedTo, pocketKind, currency };
  }

  /**
   * Investasi R2 — a pocket is the cash leg of the investment ledger:
   * Investment.cashAccountId and InvestmentTransaction.cashAccountId are
   * SetNull, so deleting a pocket that still has history or holdings would
   * silently orphan them. Refuse with a clear 409 instead. Shared by
   * DELETE /accounts/:id and DELETE /platform-accounts/:id/pockets/:pocketId.
   */
  async assertPocketDeletable(
    familyGroupId: string,
    account: { id: string; balance: bigint },
  ): Promise<void> {
    if (account.balance !== BigInt(0)) {
      throw new ConflictException(
        "Kantong dana ini masih memiliki saldo. Tarik atau pindahkan dananya hingga saldo nol sebelum menghapus.",
      );
    }
    const [cashTx, investTx, holdings] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          familyGroupId,
          OR: [{ accountId: account.id }, { toAccountId: account.id }],
        },
      }),
      this.prisma.investmentTransaction.count({
        where: { familyGroupId, cashAccountId: account.id },
      }),
      this.prisma.investment.count({
        where: { familyGroupId, cashAccountId: account.id },
      }),
    ]);
    if (holdings > 0) {
      throw new ConflictException(
        "Kantong dana ini masih terhubung ke aset investasi. Pindahkan atau hapus aset tersebut terlebih dahulu.",
      );
    }
    if (cashTx > 0 || investTx > 0) {
      throw new ConflictException(
        "Kantong dana ini sudah memiliki riwayat transaksi, jadi tidak bisa dihapus. Ubah statusnya menjadi ditutup bila tidak dipakai lagi.",
      );
    }
  }

  async create(
    familyGroupId: string,
    dto: CreateAccountDto,
    actor?: AccountActor,
  ): Promise<AccountResponseDto> {
    const ownerUserId = this.assertOwnerAllowedFor(actor, dto.ownerUserId);
    if (ownerUserId) {
      await this.assertOwnerIsFamilyMember(familyGroupId, ownerUserId);
    }

    await this.assertNoDuplicateNumber(
      familyGroupId,
      dto.type,
      dto.institution ?? null,
      dto.maskedNumber,
      dto.currency ?? "IDR",
    );

    const detail = await this.bankDetailData(familyGroupId, dto);
    const pocketLink = await this.pocketLinkData(
      familyGroupId,
      {
        type: dto.type,
        platformAccountId: dto.platformAccountId,
        pocketKind: dto.pocketKind,
        currency: dto.currency,
        typeChanged: false,
      },
      actor,
    );
    const shares = await this.normalizeShares(
      familyGroupId,
      dto.shares,
      actor,
      ownerUserId ?? null,
    );

    try {
      const account = await this.prisma.account.create({
        data: {
          ...(detail as Prisma.AccountUncheckedCreateInput),
          ...pocketLink,
          familyGroupId,
          name: dto.name,
          type: dto.type,
          institution: dto.institution ?? null,
          maskedNumber: dto.maskedNumber
            ? this.crypto.encrypt(dto.maskedNumber)
            : null,
          balance: BigInt(dto.balance),
          currency: pocketLink.currency ?? dto.currency ?? "IDR",
          isPrivate: dto.isPrivate ?? false,
          ownerUserId: ownerUserId ?? null,
          // The first balance is the opening balance; from here on only
          // transactions move `balance`.
          openingBalance: BigInt(dto.balance),
          openingBalanceDate:
            toDbDate(dto.openingBalanceDate) ??
            toDbDate(new Date().toISOString().slice(0, 10)),
          ...(shares && shares.length > 0
            ? { shares: { create: shares } }
            : {}),
        },
        include: ACCOUNT_INCLUDE,
      });
      return this.toDto(account);
    } catch (err: unknown) {
      throw mapDuplicateAccountName(err, dto.name);
    }
  }

  /**
   * Account identity is provider + number. maskedNumber is encrypted with a
   * random IV, so the DB unique index can never see two equal numbers — the
   * duplicate check has to decrypt and compare here.
   */
  private async assertNoDuplicateNumber(
    familyGroupId: string,
    type: string,
    institution: string | null,
    maskedNumber: string | null | undefined,
    currency: string,
    excludeId?: string,
  ): Promise<void> {
    const digits = (maskedNumber ?? "").replace(/\D/g, "");
    if (!digits) return;
    const siblings = await this.prisma.account.findMany({
      where: {
        familyGroupId,
        type: type as never,
        institution,
        maskedNumber: { not: null },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { maskedNumber: true, name: true, currency: true },
    });
    for (const sib of siblings) {
      // A multi-currency account is one passbook number with one row per
      // currency (Rekening v3), so the same number in another currency is
      // not a duplicate.
      if ((sib.currency ?? "IDR") !== currency) continue;
      let plain = "";
      try {
        plain = this.crypto.decrypt(sib.maskedNumber as string);
      } catch {
        continue;
      }
      if (plain.replace(/\D/g, "") === digits) {
        throw new ConflictException(
          `${institution ?? sib.name} dengan nomor ini sudah terdaftar di keluarga ini.`,
        );
      }
    }
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateAccountDto,
    actor?: AccountActor,
  ): Promise<AccountResponseDto> {
    const existing = await this.prisma.account.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Account not found");
    }
    if (
      actor &&
      !MASTER_LIKE_ROLES.has(actor.role) &&
      existing.ownerUserId !== actor.userId
    ) {
      throw new ForbiddenException("You can only edit your own accounts");
    }
    const ownerUserId = this.assertOwnerAllowedFor(actor, dto.ownerUserId);

    // `undefined` = leave ownership unchanged; `null` = explicit clear back
    // to family-shared; any other string = reassign (validated below against
    // Member so an owner can never point an account at a cross-tenant or
    // non-member user id).
    if (ownerUserId) {
      await this.assertOwnerIsFamilyMember(familyGroupId, ownerUserId);
    }

    if (dto.maskedNumber !== undefined || dto.institution !== undefined) {
      let currentNumber: string | null = null;
      if (dto.maskedNumber === undefined && existing.maskedNumber) {
        try {
          currentNumber = this.crypto.decrypt(existing.maskedNumber);
        } catch {
          currentNumber = null;
        }
      }
      await this.assertNoDuplicateNumber(
        familyGroupId,
        dto.type ?? existing.type,
        dto.institution !== undefined ? dto.institution : existing.institution,
        dto.maskedNumber !== undefined ? dto.maskedNumber : currentNumber,
        dto.currency ?? existing.currency,
        id,
      );
    }

    const detail = await this.bankDetailData(familyGroupId, dto, id);
    const pocketLink = await this.pocketLinkData(
      familyGroupId,
      {
        type: dto.type ?? existing.type,
        platformAccountId: dto.platformAccountId,
        pocketKind: dto.pocketKind,
        currency: dto.currency,
        typeChanged: dto.type !== undefined && dto.type !== existing.type,
      },
      actor,
      existing,
    );
    const shares = await this.normalizeShares(
      familyGroupId,
      dto.shares,
      actor,
      ownerUserId !== undefined ? ownerUserId : existing.ownerUserId,
    );

    try {
      const updated = await this.prisma.account.update({
        where: { id, familyGroupId },
        data: {
          ...detail,
          ...pocketLink,
          // A private account is visible only to Master/Co-Master, so
          // making it private also ends every share on it.
          ...(dto.isPrivate === true
            ? { shares: { deleteMany: {} } }
            : shares !== undefined && {
                shares: { deleteMany: {}, create: shares },
              }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.institution !== undefined && {
            institution: dto.institution,
          }),
          ...(dto.maskedNumber !== undefined && {
            maskedNumber: this.crypto.encrypt(dto.maskedNumber),
          }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(pocketLink.currency !== undefined && {
            currency: pocketLink.currency,
          }),
          ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
          ...(ownerUserId !== undefined && { ownerUserId }),
        },
        include: ACCOUNT_INCLUDE,
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
    field = "ownerUserId",
  ): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { userId_familyGroupId: { userId: ownerUserId, familyGroupId } },
      select: { id: true },
    });
    if (!member) {
      throw new BadRequestException(
        `${field} must belong to a member of this family group`,
      );
    }
  }

  /**
   * Rekening v3 — validates and maps the banking detail into Prisma data,
   * keeping only the keys the DTO actually carries (so a partial PATCH
   * leaves every other column untouched). Member references must belong to
   * this family; a payout account must be another account of this family.
   */
  private async bankDetailData(
    familyGroupId: string,
    dto: AccountBankDetailDto,
    selfId?: string,
  ): Promise<Prisma.AccountUncheckedUpdateInput> {
    const data: Prisma.AccountUncheckedUpdateInput = {};

    if (dto.country) data.country = dto.country.toUpperCase();
    if (dto.institutionKind !== undefined)
      data.institutionKind = dto.institutionKind;
    if (dto.isSharia !== undefined) data.isSharia = dto.isSharia;
    if (dto.bankCode !== undefined) data.bankCode = cleanText(dto.bankCode);
    if (dto.swiftCode !== undefined)
      data.swiftCode = dto.swiftCode ? dto.swiftCode.toUpperCase() : null;
    if (dto.routingCode !== undefined)
      data.routingCode = cleanText(dto.routingCode);
    if (dto.routingCodeKind !== undefined)
      data.routingCodeKind = dto.routingCodeKind;
    if (dto.productKind !== undefined) data.productKind = dto.productKind;
    if (dto.productName !== undefined)
      data.productName = cleanText(dto.productName);
    if (dto.ownershipForm !== undefined) data.ownershipForm = dto.ownershipForm;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.openingBalanceDate !== undefined)
      data.openingBalanceDate = toDbDate(dto.openingBalanceDate);
    if (dto.interestRate !== undefined)
      data.interestRate =
        dto.interestRate === null ? null : new Prisma.Decimal(dto.interestRate);
    if (dto.shariaContract !== undefined)
      data.shariaContract = dto.shariaContract;
    if (dto.branch !== undefined) data.branch = cleanText(dto.branch);
    if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;
    if (dto.notes !== undefined) data.notes = cleanText(dto.notes);
    if (dto.reportInTaxReturn !== undefined)
      data.reportInTaxReturn = dto.reportInTaxReturn;
    if (dto.storageLocation !== undefined)
      data.storageLocation = cleanText(dto.storageLocation);
    if (dto.includeInNetWorth !== undefined)
      data.includeInNetWorth = dto.includeInNetWorth;
    if (dto.depositNumber !== undefined) {
      const bilyet = cleanText(dto.depositNumber);
      data.depositNumber = bilyet ? this.crypto.encrypt(bilyet) : null;
    }
    if (dto.placementDate !== undefined)
      data.placementDate = toDbDate(dto.placementDate);
    if (dto.tenorMonths !== undefined) data.tenorMonths = dto.tenorMonths;
    if (dto.interestPayout !== undefined)
      data.interestPayout = dto.interestPayout;
    if (dto.maturityInstruction !== undefined)
      data.maturityInstruction = dto.maturityInstruction;
    if (dto.maturityReminder !== undefined)
      data.maturityReminder = dto.maturityReminder;

    // "Atas nama": a member OR typed text, never both — the member wins.
    if (dto.holderUserId) {
      await this.assertOwnerIsFamilyMember(
        familyGroupId,
        dto.holderUserId,
        "holderUserId",
      );
      data.holderUserId = dto.holderUserId;
      data.holderName = null;
    } else if (dto.holderName !== undefined || dto.holderUserId === null) {
      data.holderUserId = null;
      if (dto.holderName !== undefined)
        data.holderName = cleanText(dto.holderName);
    }

    if (dto.beneficiaryUserId) {
      await this.assertOwnerIsFamilyMember(
        familyGroupId,
        dto.beneficiaryUserId,
        "beneficiaryUserId",
      );
      data.beneficiaryUserId = dto.beneficiaryUserId;
      data.beneficiaryName = null;
    } else if (
      dto.beneficiaryName !== undefined ||
      dto.beneficiaryUserId === null
    ) {
      data.beneficiaryUserId = null;
      if (dto.beneficiaryName !== undefined)
        data.beneficiaryName = cleanText(dto.beneficiaryName);
    }

    if (dto.payoutAccountId) {
      if (dto.payoutAccountId === selfId) {
        throw new BadRequestException(
          "payoutAccountId cannot be the account itself",
        );
      }
      const payout = await this.prisma.account.findFirst({
        where: { id: dto.payoutAccountId, familyGroupId },
        select: { id: true },
      });
      if (!payout) {
        throw new BadRequestException(
          "payoutAccountId must be an account of this family group",
        );
      }
      data.payoutAccountId = dto.payoutAccountId;
    } else if (dto.payoutAccountId === null) {
      data.payoutAccountId = null;
    }

    return data;
  }

  /**
   * Rekening v3 — "Dibagikan kepada". Only Master/Co-Master may set who an
   * account is shared with (a member could otherwise grant themselves
   * posting rights). Deduplicates, drops the owner (who already has full
   * access), and requires every user to be a member of this family.
   * `undefined` = leave the stored list unchanged.
   */
  private async normalizeShares(
    familyGroupId: string,
    shares: AccountBankDetailDto["shares"],
    actor: AccountActor | undefined,
    ownerUserId: string | null,
  ): Promise<Array<{ userId: string; canPost: boolean }> | undefined> {
    if (shares === undefined) return undefined;
    if (actor && !MASTER_LIKE_ROLES.has(actor.role)) {
      throw new ForbiddenException(
        "Only Master or Co-Master can share an account",
      );
    }
    const byUser = new Map<string, boolean>();
    for (const share of shares) {
      if (share.userId === ownerUserId) continue;
      byUser.set(share.userId, share.canPost);
    }
    const userIds = [...byUser.keys()];
    if (userIds.length > 0) {
      const members = await this.prisma.member.findMany({
        where: { familyGroupId, userId: { in: userIds } },
        select: { userId: true },
      });
      if (members.length !== userIds.length) {
        throw new BadRequestException(
          "shares must only name members of this family group",
        );
      }
    }
    return userIds.map((userId) => ({
      userId,
      canPost: byUser.get(userId) ?? false,
    }));
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.account.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Account not found");
    }
    if (existing.platformAccountId) {
      await this.assertPocketDeletable(familyGroupId, existing);
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

  /**
   * Accepts the full row (ACCOUNT_INCLUDE) but tolerates older partial rows:
   * every Rekening v3 field falls back to its column default.
   */
  private toDto(
    account: Pick<
      AccountRow,
      | "id"
      | "familyGroupId"
      | "name"
      | "type"
      | "institution"
      | "maskedNumber"
      | "balance"
      | "currency"
      | "isPrivate"
      | "ownerUserId"
      | "createdAt"
      | "updatedAt"
    > &
      Partial<AccountRow> & { owner?: { name: string } | null },
    lastActivityAt: string | null = null,
  ): AccountResponseDto {
    const decryptOrNull = (value: string | null | undefined) =>
      value ? this.crypto.decrypt(value) : null;
    return {
      id: account.id,
      familyGroupId: account.familyGroupId,
      name: account.name,
      type: account.type as AccountResponseDto["type"],
      institution: account.institution,
      maskedNumber: decryptOrNull(account.maskedNumber),
      balance: account.balance.toString(),
      currency: account.currency,
      isPrivate: account.isPrivate,
      ownerUserId: account.ownerUserId,
      ownerName: account.owner?.name ?? null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      country: account.country ?? "ID",
      institutionKind: account.institutionKind ?? null,
      isSharia: account.isSharia ?? false,
      bankCode: account.bankCode ?? null,
      swiftCode: account.swiftCode ?? null,
      routingCode: account.routingCode ?? null,
      routingCodeKind: account.routingCodeKind ?? null,
      productKind: account.productKind ?? null,
      productName: account.productName ?? null,
      holderUserId: account.holderUserId ?? null,
      holderName: account.holder?.name ?? account.holderName ?? null,
      ownershipForm: account.ownershipForm ?? "individual",
      status: account.status ?? "active",
      openingBalance:
        account.openingBalance === null || account.openingBalance === undefined
          ? null
          : account.openingBalance.toString(),
      openingBalanceDate: fromDbDate(account.openingBalanceDate),
      interestRate:
        account.interestRate === null || account.interestRate === undefined
          ? null
          : Number(account.interestRate),
      shariaContract: account.shariaContract ?? null,
      branch: account.branch ?? null,
      isPrimary: account.isPrimary ?? false,
      notes: account.notes ?? null,
      reportInTaxReturn: account.reportInTaxReturn ?? false,
      storageLocation: account.storageLocation ?? null,
      includeInNetWorth: account.includeInNetWorth ?? true,
      lastReconciledAt: account.lastReconciledAt
        ? account.lastReconciledAt.toISOString()
        : null,
      platformAccountId: account.platformAccountId ?? null,
      pocketKind: account.pocketKind ?? null,
      beneficiaryUserId: account.beneficiaryUserId ?? null,
      beneficiaryName: account.beneficiaryName ?? null,
      depositNumber: decryptOrNull(account.depositNumber),
      placementDate: fromDbDate(account.placementDate),
      tenorMonths: account.tenorMonths ?? null,
      interestPayout: account.interestPayout ?? null,
      maturityInstruction: account.maturityInstruction ?? null,
      payoutAccountId: account.payoutAccountId ?? null,
      maturityReminder: account.maturityReminder ?? false,
      shares: (account.shares ?? []).map((sh) => ({
        userId: sh.userId,
        name: sh.user.name,
        canPost: sh.canPost,
      })),
      lastActivityAt,
    };
  }
}
