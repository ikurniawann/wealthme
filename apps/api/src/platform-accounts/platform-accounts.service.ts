import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  CUSTOM_PLATFORM_KEY,
  findInvestmentPlatform,
  type InvestmentPlatform,
  type PlatformAccountDto,
  type PlatformPocketDto,
} from "@wealthme/contracts";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  AccountsService,
  isMasterLike,
  resolveOwnerForActor,
  type AccountActor,
} from "../accounts/accounts.service";
import { areBalancesHidden } from "../common/utils/balance-visibility.util";
import {
  accountPrivacyWhere,
  canSeePrivateItems,
  isRowScoped,
  restrictedAccountWhere,
} from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CryptoService } from "../crypto/crypto.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { heldByPocket, type HeldBalance } from "./pocket-balances";

import type { CreatePlatformAccountDto } from "./dto/create-platform-account.dto";
import type { PlatformPocketItemDto } from "./dto/create-pocket.dto";
import type { UpdatePlatformAccountDto } from "./dto/update-platform-account.dto";
import type { TenantContext } from "../common/types/tenant-context";
import type {
  Account,
  PlatformAccount,
  PocketKind,
  Prisma,
} from "@prisma/client";

/** Who is reading: drives privacy, row scope and "Lihat saldo" redaction. */
export interface PlatformViewer {
  member: TenantContext["member"];
  userId?: string;
}

const POCKET_LABEL: Record<PocketKind, string> = {
  rdn: "RDN",
  crypto: "Dana Kripto",
  usd: "Dana USD",
  general: "Kas",
};

type PlatformRow = PlatformAccount & { owner: { name: string } | null };

function cleanText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t === "" ? null : t;
}

function platformName(row: { platformKey: string; customName: string | null }) {
  if (row.platformKey === CUSTOM_PLATFORM_KEY) {
    return row.customName ?? "Platform lain";
  }
  return findInvestmentPlatform(row.platformKey)?.name ?? row.platformKey;
}

/**
 * Investasi R2/§3 — a user's account at an investment platform and its cash
 * pockets. A pocket IS an `Account` (type `investment`, platformAccountId +
 * pocketKind), created through AccountsService so it follows the exact
 * owner/privacy rules of every account and is counted once in net worth via
 * the accounts sum — nothing here adds pockets to any total.
 */
@Injectable()
export class PlatformAccountsService {
  private readonly logger = new Logger(PlatformAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly accounts: AccountsService,
  ) {}

  // ── Reads ────────────────────────────────────────────────────────────────

  async findAll(
    familyGroupId: string,
    viewer: PlatformViewer,
  ): Promise<PlatformAccountDto[]> {
    return this.query(familyGroupId, viewer);
  }

  async findOne(
    familyGroupId: string,
    id: string,
    viewer: PlatformViewer,
  ): Promise<PlatformAccountDto> {
    const [row] = await this.query(familyGroupId, viewer, id);
    if (!row) throw new NotFoundException("Akun platform tidak ditemukan");
    return row;
  }

  /** One pocket as the list shows it (balances, held, holdings). */
  async findPocket(
    familyGroupId: string,
    pocketId: string,
    viewer: PlatformViewer,
  ): Promise<PlatformPocketDto> {
    const pocket = await this.prisma.account.findFirst({
      where: { id: pocketId, familyGroupId, platformAccountId: { not: null } },
    });
    if (!pocket) throw new NotFoundException("Kantong dana tidak ditemukan");
    const [held, holdings] = await Promise.all([
      heldByPocket(this.prisma, familyGroupId, [pocket.id]),
      this.holdingsByPocket(familyGroupId, [pocket.id]),
    ]);
    return this.toPocketDto(
      pocket,
      held.get(pocket.id),
      holdings.get(pocket.id) ?? 0,
      viewer,
    );
  }

  private pocketVisibleWhere(
    familyGroupId: string,
    viewer: PlatformViewer,
  ): Prisma.AccountWhereInput {
    return {
      familyGroupId,
      ...accountPrivacyWhere(canSeePrivateItems(viewer.member?.role)),
      ...restrictedAccountWhere(viewer.member, viewer.userId),
    };
  }

  /**
   * Row scope mirrors accounts: a row-scoped member sees platform accounts
   * they own, family-shared ones when granted shared accounts, and any
   * platform holding a pocket they may see (e.g. shared with them).
   */
  private platformScopeWhere(
    familyGroupId: string,
    viewer: PlatformViewer,
  ): Prisma.PlatformAccountWhereInput {
    if (!isRowScoped(viewer.member)) return { familyGroupId };
    const userId = viewer.userId ?? "";
    return {
      familyGroupId,
      OR: [
        { ownerUserId: userId },
        ...(viewer.member?.seesSharedAccounts ? [{ ownerUserId: null }] : []),
        { pockets: { some: this.pocketVisibleWhere(familyGroupId, viewer) } },
      ],
    };
  }

  private async query(
    familyGroupId: string,
    viewer: PlatformViewer,
    id?: string,
  ): Promise<PlatformAccountDto[]> {
    const platforms = await this.prisma.platformAccount.findMany({
      where: {
        ...this.platformScopeWhere(familyGroupId, viewer),
        ...(id ? { id } : {}),
      },
      include: { owner: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (platforms.length === 0) return [];
    const platformIds = platforms.map((p) => p.id);
    const pockets = await this.prisma.account.findMany({
      where: {
        ...this.pocketVisibleWhere(familyGroupId, viewer),
        platformAccountId: { in: platformIds },
      },
      orderBy: { createdAt: "asc" },
    });
    const pocketIds = pockets.map((p) => p.id);
    const [held, holdingsByPocket, holdingsByPlatform] = await Promise.all([
      heldByPocket(this.prisma, familyGroupId, pocketIds),
      this.holdingsByPocket(familyGroupId, pocketIds),
      this.prisma.investment.groupBy({
        by: ["platformAccountId"],
        where: { familyGroupId, platformAccountId: { in: platformIds } },
        _count: { _all: true },
      }),
    ]);
    const platformHoldings = new Map(
      holdingsByPlatform.map((g) => [g.platformAccountId, g._count._all]),
    );
    return platforms.map((p) =>
      this.toDto(
        p,
        pockets
          .filter((a) => a.platformAccountId === p.id)
          .map((a) =>
            this.toPocketDto(
              a,
              held.get(a.id),
              holdingsByPocket.get(a.id) ?? 0,
              viewer,
            ),
          ),
        platformHoldings.get(p.id) ?? 0,
      ),
    );
  }

  private async holdingsByPocket(
    familyGroupId: string,
    pocketIds: string[],
  ): Promise<Map<string, number>> {
    if (pocketIds.length === 0) return new Map();
    const groups = await this.prisma.investment.groupBy({
      by: ["cashAccountId"],
      where: { familyGroupId, cashAccountId: { in: pocketIds } },
      _count: { _all: true },
    });
    return new Map(
      groups
        .filter((g) => g.cashAccountId !== null)
        .map((g) => [g.cashAccountId as string, g._count._all]),
    );
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  async create(
    familyGroupId: string,
    dto: Omit<CreatePlatformAccountDto, "fxInputs">,
    actor: AccountActor | undefined,
    viewer: PlatformViewer,
  ): Promise<PlatformAccountDto> {
    const platform = this.catalogEntry(dto.platformKey);
    const customName = cleanText(dto.customName);
    if (dto.platformKey === CUSTOM_PLATFORM_KEY && !customName) {
      throw new BadRequestException(
        "Nama platform wajib diisi untuk platform lain.",
      );
    }
    const ownerUserId = resolveOwnerForActor(actor, dto.ownerUserId) ?? null;
    if (ownerUserId) await this.assertMember(familyGroupId, ownerUserId);

    const pockets = dto.pockets ?? [];
    const seen = new Set<string>();
    for (const p of pockets) {
      const currency = this.pocketCurrency(platform, p.pocketKind, p.currency);
      const key = `${p.pocketKind}:${currency}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Kantong ${POCKET_LABEL[p.pocketKind]} ${currency} disebut dua kali.`,
        );
      }
      seen.add(key);
    }

    const row = await this.prisma.platformAccount.create({
      data: {
        familyGroupId,
        platformKey: dto.platformKey,
        customName: dto.platformKey === CUSTOM_PLATFORM_KEY ? customName : null,
        ownerUserId,
        label: cleanText(dto.label),
        accountRef: this.encryptRef(dto.accountRef),
      },
    });

    try {
      for (const p of pockets) {
        await this.createPocketRow(familyGroupId, row, platform, p, actor);
      }
    } catch (err: unknown) {
      // Compensate: the pockets created so far have no history yet.
      await this.rollbackCreate(familyGroupId, row.id);
      throw err;
    }
    return this.findOne(familyGroupId, row.id, viewer);
  }

  private async rollbackCreate(familyGroupId: string, id: string) {
    try {
      await this.prisma.$transaction([
        this.prisma.account.deleteMany({
          where: { familyGroupId, platformAccountId: id },
        }),
        this.prisma.platformAccount.delete({ where: { id } }),
      ]);
    } catch (err: unknown) {
      this.logger.error(
        `platform account ${id} rollback failed`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdatePlatformAccountDto,
    actor: AccountActor | undefined,
    viewer: PlatformViewer,
  ): Promise<PlatformAccountDto> {
    const existing = await this.loadForWrite(familyGroupId, id, actor);
    const isCustom = existing.platformKey === CUSTOM_PLATFORM_KEY;
    const data: Prisma.PlatformAccountUncheckedUpdateInput = {};

    if (dto.customName !== undefined) {
      const name = cleanText(dto.customName);
      if (isCustom && !name) {
        throw new BadRequestException(
          "Nama platform wajib diisi untuk platform lain.",
        );
      }
      if (!isCustom && name) {
        throw new BadRequestException(
          "Nama kustom hanya untuk platform lain (custom).",
        );
      }
      data.customName = name;
    }
    if (dto.label !== undefined) data.label = cleanText(dto.label);
    if (dto.accountRef !== undefined) {
      data.accountRef = this.encryptRef(dto.accountRef);
    }
    let ownerChanged = false;
    if (dto.ownerUserId !== undefined) {
      const owner = resolveOwnerForActor(actor, dto.ownerUserId) ?? null;
      if (owner) await this.assertMember(familyGroupId, owner);
      ownerChanged = owner !== existing.ownerUserId;
      data.ownerUserId = owner;
    }

    await this.prisma.$transaction([
      this.prisma.platformAccount.update({
        where: { id, familyGroupId },
        data,
      }),
      // The pockets are this platform account's cash: they follow its owner.
      ...(ownerChanged
        ? [
            this.prisma.account.updateMany({
              where: { familyGroupId, platformAccountId: id },
              data: { ownerUserId: data.ownerUserId as string | null },
            }),
          ]
        : []),
    ]);
    return this.findOne(familyGroupId, id, viewer);
  }

  async remove(
    familyGroupId: string,
    id: string,
    actor: AccountActor | undefined,
  ): Promise<void> {
    await this.loadForWrite(familyGroupId, id, actor);
    // FKs toward platform_accounts are NoAction: check first so the user
    // gets a clear 409 instead of a raw FK error.
    const [pockets, holdings] = await Promise.all([
      this.prisma.account.count({
        where: { familyGroupId, platformAccountId: id },
      }),
      this.prisma.investment.count({
        where: { familyGroupId, platformAccountId: id },
      }),
    ]);
    if (holdings > 0) {
      throw new ConflictException(
        "Akun platform ini masih memiliki aset investasi. Pindahkan atau hapus asetnya terlebih dahulu.",
      );
    }
    if (pockets > 0) {
      throw new ConflictException(
        "Akun platform ini masih memiliki kantong dana. Hapus kantong dananya terlebih dahulu.",
      );
    }
    await this.prisma.platformAccount.delete({ where: { id, familyGroupId } });
  }

  async createPocket(
    familyGroupId: string,
    platformAccountId: string,
    dto: PlatformPocketItemDto,
    actor: AccountActor | undefined,
    viewer: PlatformViewer,
  ): Promise<PlatformPocketDto> {
    const row = await this.loadForWrite(
      familyGroupId,
      platformAccountId,
      actor,
    );
    const platform = this.catalogEntry(row.platformKey);
    const currency = this.pocketCurrency(
      platform,
      dto.pocketKind,
      dto.currency,
    );
    const duplicate = await this.prisma.account.findFirst({
      where: {
        familyGroupId,
        platformAccountId,
        pocketKind: dto.pocketKind,
        currency,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `Kantong ${POCKET_LABEL[dto.pocketKind]} ${currency} sudah ada di akun platform ini.`,
      );
    }
    const pocketId = await this.createPocketRow(
      familyGroupId,
      row,
      platform,
      dto,
      actor,
    );
    return this.findPocket(familyGroupId, pocketId, viewer);
  }

  async removePocket(
    familyGroupId: string,
    platformAccountId: string,
    pocketId: string,
    actor: AccountActor | undefined,
  ): Promise<void> {
    await this.loadForWrite(familyGroupId, platformAccountId, actor);
    const pocket = await this.prisma.account.findFirst({
      where: { id: pocketId, familyGroupId, platformAccountId },
      select: { id: true },
    });
    if (!pocket) throw new NotFoundException("Kantong dana tidak ditemukan");
    // AccountsService.remove runs the pocket guard (balance, history,
    // holdings → 409) for every account linked to a platform.
    await this.accounts.remove(familyGroupId, pocketId);
  }

  /** The pocket of this platform account, for top-up / withdraw. */
  async loadPocket(
    familyGroupId: string,
    platformAccountId: string,
    pocketId: string,
  ): Promise<Account> {
    const pocket = await this.prisma.account.findFirst({
      where: { id: pocketId, familyGroupId, platformAccountId },
    });
    if (!pocket) throw new NotFoundException("Kantong dana tidak ditemukan");
    return pocket;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private catalogEntry(platformKey: string): InvestmentPlatform {
    const entry = findInvestmentPlatform(platformKey);
    if (!entry) {
      throw new BadRequestException(
        `Platform "${platformKey}" tidak ada di katalog. Pilih "Platform lain" untuk platform yang belum terdaftar.`,
      );
    }
    return entry;
  }

  /**
   * Validates the pocket kind against what the platform offers (§3: do not
   * assume every platform holds every kind of cash) and resolves the
   * pocket's native currency: usd → USD, rdn/crypto → IDR, general → any.
   */
  private pocketCurrency(
    platform: InvestmentPlatform,
    kind: PocketKind,
    currency: string | undefined,
  ): string {
    if (!platform.pockets.includes(kind)) {
      throw new BadRequestException(
        `${platform.name} tidak menyediakan kantong ${POCKET_LABEL[kind]}.`,
      );
    }
    const fixed = kind === "usd" ? "USD" : kind === "general" ? null : "IDR";
    if (fixed && currency && currency !== fixed) {
      throw new BadRequestException(
        `Kantong ${POCKET_LABEL[kind]} harus bermata uang ${fixed}.`,
      );
    }
    return fixed ?? currency ?? "IDR";
  }

  private async createPocketRow(
    familyGroupId: string,
    row: PlatformAccount,
    platform: InvestmentPlatform,
    dto: PlatformPocketItemDto,
    actor: AccountActor | undefined,
  ): Promise<string> {
    const currency = this.pocketCurrency(
      platform,
      dto.pocketKind,
      dto.currency,
    );
    const base = platformName(row);
    const label = row.label ? `${base} (${row.label})` : base;
    const created = await this.accounts.create(
      familyGroupId,
      {
        type: "investment",
        name:
          cleanText(dto.name) ??
          `${label} · ${POCKET_LABEL[dto.pocketKind]}${currency === "IDR" || dto.pocketKind === "usd" ? "" : ` ${currency}`}`,
        institution: base,
        balance: dto.balance ?? 0,
        currency,
        isPrivate: dto.isPrivate ?? false,
        ...(row.ownerUserId ? { ownerUserId: row.ownerUserId } : {}),
        platformAccountId: row.id,
        pocketKind: dto.pocketKind,
      },
      actor,
    );
    return created.id;
  }

  /**
   * Same edit rule as accounts: Master/Co-Master edit any platform account,
   * everyone else only their own.
   */
  private async loadForWrite(
    familyGroupId: string,
    id: string,
    actor: AccountActor | undefined,
  ): Promise<PlatformAccount> {
    const row = await this.prisma.platformAccount.findFirst({
      where: { id, familyGroupId },
    });
    if (!row) throw new NotFoundException("Akun platform tidak ditemukan");
    if (!isMasterLike(actor) && row.ownerUserId !== actor!.userId) {
      throw new ForbiddenException(
        "Anda hanya dapat mengubah akun platform milik Anda sendiri.",
      );
    }
    return row;
  }

  private async assertMember(familyGroupId: string, userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId_familyGroupId: { userId, familyGroupId } },
      select: { id: true },
    });
    if (!member) {
      throw new BadRequestException(
        "ownerUserId must belong to a member of this family group",
      );
    }
  }

  private encryptRef(value: string | null | undefined): string | null {
    const clean = cleanText(value);
    return clean ? this.crypto.encrypt(clean) : null;
  }

  private decryptRef(value: string | null): string | null {
    if (!value) return null;
    try {
      return this.crypto.decrypt(value);
    } catch {
      return null;
    }
  }

  private toDto(
    row: PlatformRow,
    pockets: PlatformPocketDto[],
    holdingsCount: number,
  ): PlatformAccountDto {
    return {
      id: row.id,
      familyGroupId: row.familyGroupId,
      platformKey: row.platformKey,
      customName: row.customName,
      ownerUserId: row.ownerUserId,
      ownerName: row.owner?.name ?? null,
      label: row.label,
      accountRef: this.decryptRef(row.accountRef),
      syncMode: "manual",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      platformName: platformName(row),
      pockets,
      holdingsCount,
    };
  }

  private toPocketDto(
    a: Account,
    held: HeldBalance | undefined,
    holdingsCount: number,
    viewer: PlatformViewer,
  ): PlatformPocketDto {
    const heldIdr = held?.held ?? BigInt(0);
    const hidden =
      areBalancesHidden(viewer.member) &&
      !(viewer.userId && a.ownerUserId === viewer.userId);
    return {
      id: a.id,
      name: a.name,
      pocketKind: a.pocketKind ?? "general",
      currency: a.currency,
      ownerUserId: a.ownerUserId,
      isPrivate: a.isPrivate,
      status: a.status,
      recordedBalance: hidden ? null : a.balance.toString(),
      heldBalance: hidden ? null : heldIdr.toString(),
      availableBalance: hidden ? null : (a.balance - heldIdr).toString(),
      heldIncomplete: held?.incomplete ?? false,
      holdingsCount,
      ...(hidden ? { balancesHidden: true } : {}),
    };
  }
}
