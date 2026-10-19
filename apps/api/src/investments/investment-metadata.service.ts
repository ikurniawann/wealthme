import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { findInvestmentPlatform, MARKETS } from "@wealthme/contracts";

import { resolveOwnerForActor } from "../accounts/accounts.service";
import { isRowScoped } from "../common/utils/privacy.util";
import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { investmentAccessWhere } from "./investment-access";
import { assertUsableCashAccount } from "./ledger/ledger-support";

import type { UpdateInvestmentMetadataDto } from "./dto/update-investment-metadata.dto";
import type { LedgerActor } from "./ledger/ledger-support";
import type { Prisma } from "@prisma/client";
import type { InvestmentDetails, InvestmentProduct } from "@wealthme/contracts";

/** Explicit metadata classification; never rewrites quantities or past cash legs. */
@Injectable()
export class InvestmentMetadataService {
  constructor(private readonly prisma: PrismaService) {}
  async update(
    fg: string,
    id: string,
    dto: UpdateInvestmentMetadataDto,
    actor: LedgerActor,
  ) {
    return runSerializableWithRetry(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "investments" WHERE "id" = ${id} AND "familyGroupId" = ${fg} FOR UPDATE`;
      const h = await tx.investment.findFirst({
        where: {
          id,
          familyGroupId: fg,
          AND: [investmentAccessWhere(actor, true)],
        },
      });
      if (!h) throw new NotFoundException("Investment not found");
      const typeMarket = {
        reksa_dana: "MUTUAL_FUND_ID",
        obligasi: "BOND_ID",
        emas: "GOLD",
        kripto: "CRYPTO",
        deposito: "DEPOSIT",
        lainnya: "OTHER",
      };
      if (
        h.type === "saham"
          ? !["IDX", "NASDAQ", "NYSE"].includes(dto.market)
          : typeMarket[h.type] !== dto.market
      )
        throw new BadRequestException("Pasar tidak sesuai jenis investasi.");
      const owner =
        dto.ownerUserId === undefined || dto.ownerUserId === h.ownerUserId
          ? h.ownerUserId
          : (resolveOwnerForActor(actor.member ?? undefined, dto.ownerUserId) ??
            null);
      if (
        owner &&
        !(await tx.member.findFirst({
          where: { familyGroupId: fg, userId: owner },
        }))
      )
        throw new BadRequestException("Pemilik bukan anggota keluarga ini.");
      const platformId =
        dto.platformAccountId === undefined
          ? h.platformAccountId
          : dto.platformAccountId;
      const pocketId =
        dto.cashAccountId === undefined ? h.cashAccountId : dto.cashAccountId;
      const platform = platformId
        ? await tx.platformAccount.findFirst({
            where: { id: platformId, familyGroupId: fg },
          })
        : null;
      if (platformId && !platform)
        throw new NotFoundException("Akun platform tidak ditemukan.");
      if (
        platform &&
        isRowScoped(actor.member) &&
        platform.ownerUserId !== actor.member?.userId
      ) {
        const usable = await tx.account.findFirst({
          where: {
            platformAccountId: platform.id,
            familyGroupId: fg,
            isPrivate: false,
            shares: { some: { userId: actor.member?.userId, canPost: true } },
          },
        });
        if (!usable)
          throw new ForbiddenException("Akun platform tidak dapat dipakai.");
      }
      const catalog = platform
        ? findInvestmentPlatform(platform.platformKey)
        : null;
      const product: InvestmentProduct | null =
        h.type === "lainnya"
          ? null
          : h.type === "saham"
            ? dto.market === "IDX"
              ? "saham_idx"
              : "saham_us"
            : h.type;
      if (
        catalog &&
        catalog.key !== "custom" &&
        (!product || !catalog.products.includes(product))
      )
        throw new BadRequestException("Produk tidak tersedia di platform ini.");
      if (pocketId) {
        const pocket = await tx.account.findFirst({
          where: { id: pocketId, familyGroupId: fg },
        });
        if (!platform)
          throw new BadRequestException(
            "Pilih akun platform untuk kantong dana.",
          );
        await assertUsableCashAccount(tx, pocket ?? undefined, actor, {
          currency: h.currency,
          platformAccountId: platform.id,
        });
      }
      const details = (h.details ?? {}) as InvestmentDetails;
      const name = dto.name?.trim() ?? h.name;
      if (!name) throw new BadRequestException("Nama investasi wajib diisi.");
      const updated = await tx.investment.update({
        where: { id },
        data: {
          name,
          market: dto.market,
          ownerUserId: owner,
          platformAccountId: platformId,
          cashAccountId: pocketId,
          lotSize: dto.market === "IDX" ? 100 : 1,
          allowFraction:
            dto.market === "NASDAQ" || dto.market === "NYSE"
              ? catalog?.fractionalUsShares === true
              : MARKETS[dto.market].allowFractionDefault,
          ...(dto.priceSymbol !== undefined
            ? { priceSymbol: dto.priceSymbol?.trim() || null }
            : {}),
          details: {
            ...details,
            ...(dto.manualInstrument !== undefined
              ? { manualInstrument: dto.manualInstrument }
              : {}),
          } as Prisma.InputJsonValue,
        },
      });
      if (actor.userId)
        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            familyGroupId: fg,
            entity: "Investment",
            entityId: id,
            action: "classify",
            before: {
              name: h.name,
              market: h.market,
              platformAccountId: h.platformAccountId,
              cashAccountId: h.cashAccountId,
              ownerUserId: h.ownerUserId,
              priceSymbol: h.priceSymbol,
              manualInstrument: details.manualInstrument ?? false,
            },
            after: {
              name: updated.name,
              market: updated.market,
              platformAccountId: updated.platformAccountId,
              cashAccountId: updated.cashAccountId,
              ownerUserId: updated.ownerUserId,
              priceSymbol: updated.priceSymbol,
              manualInstrument:
                dto.manualInstrument ?? details.manualInstrument ?? false,
            },
          },
        });
      return { id: updated.id };
    });
  }
}
