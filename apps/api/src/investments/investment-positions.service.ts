import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { findInvestmentPlatform, MARKETS } from "@wealthme/contracts";

import { resolveOwnerForActor } from "../accounts/accounts.service";
import { isRowScoped } from "../common/utils/privacy.util";
import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { deriveInternalCode } from "./internal-code.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentLedgerService } from "./ledger/investment-ledger.service";
import { isValidYmd } from "./ledger/ledger-dates";
import { assertUsableCashAccount } from "./ledger/ledger-support";
import { positionDetails } from "./position-details";

import type { CreatePositionDto } from "./dto/create-position.dto";
import type { LedgerActor } from "./ledger/ledger-support";
import type { InvestmentDetails, InvestmentProduct } from "@wealthme/contracts";

function stable(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(object[key])}`)
    .join(",")}}`;
}

@Injectable()
export class InvestmentPositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InvestmentLedgerService,
  ) {}
  async create(
    familyGroupId: string,
    dto: CreatePositionDto,
    actor: LedgerActor,
  ) {
    const h = dto.holding;
    if (!isValidYmd(dto.entry.effectiveDate))
      throw new BadRequestException("Tanggal posisi tidak valid.");
    const entry =
      dto.costBasisKnown === false
        ? {
            ...dto.entry,
            pricePerUnit: "0",
            grossAmount: "0",
            fee: "0",
            tax: "0",
            currency: "IDR",
            fxRate: undefined,
          }
        : dto.entry;
    if (!["buy", "opening"].includes(entry.kind))
      throw new BadRequestException(
        "Posisi baru harus pembelian atau kepemilikan awal.",
      );
    if (dto.costBasisKnown === false && entry.kind !== "opening")
      throw new BadRequestException("Harga pembelian wajib diketahui.");
    const requestedQuantity = new Prisma.Decimal(entry.quantity ?? "0");
    if (requestedQuantity.lte(0) || requestedQuantity.gt("9999999999.99999999"))
      throw new BadRequestException(
        "Kuantitas posisi di luar batas yang didukung.",
      );
    if (
      entry.kind === "buy" &&
      h.market === "IDX" &&
      !requestedQuantity.modulo(100).isZero()
    )
      throw new BadRequestException(
        "Pembelian saham IDX pasar reguler harus kelipatan 100 lembar (1 lot).",
      );
    const name = h.name.trim();
    if (!name) throw new BadRequestException("Nama investasi wajib diisi.");
    const automated =
      ["saham", "kripto"].includes(h.type) && !h.manualInstrument;
    if (automated && !h.ticker?.trim())
      throw new BadRequestException(
        "Ticker wajib untuk instrumen dengan sumber harga otomatis.",
      );
    const defaultMarket = {
      reksa_dana: "MUTUAL_FUND_ID",
      obligasi: "BOND_ID",
      emas: "GOLD",
      kripto: "CRYPTO",
      deposito: "DEPOSIT",
      lainnya: "OTHER",
    };
    if (
      h.type === "saham"
        ? !["IDX", "NASDAQ", "NYSE"].includes(h.market)
        : defaultMarket[h.type] !== h.market
    )
      throw new BadRequestException("Pasar tidak sesuai jenis investasi.");
    const owner =
      resolveOwnerForActor(actor.member ?? undefined, h.ownerUserId) ?? null;
    const details: InvestmentDetails = {
      ...positionDetails(h.type, h.details),
      manualInstrument: h.manualInstrument === true,
      costBasisKnown: dto.costBasisKnown !== false,
    };
    const identity = {
      name,
      currency: dto.entry.currency,
      ticker: h.ticker?.trim().toUpperCase() ?? null,
      type: h.type,
      market: h.market,
      ownerUserId: owner,
      platformAccountId: h.platformAccountId ?? null,
      priceSymbol: automated ? (h.priceSymbol?.trim() ?? null) : null,
      details,
    };
    return runSerializableWithRetry(this.prisma, async (tx) => {
      const existing = await tx.investmentTransaction.findUnique({
        where: {
          familyGroupId_idempotencyKey: {
            familyGroupId,
            idempotencyKey: entry.idempotencyKey,
          },
        },
        include: { investment: true },
      });
      if (existing) {
        if (
          isRowScoped(actor.member) &&
          existing.investment.ownerUserId !== actor.member?.userId
        )
          throw new ForbiddenException("Investasi ini bukan milik Anda.");
        const audit = await tx.auditLog.findFirst({
          where: {
            familyGroupId,
            entity: "investment_position",
            entityId: existing.investmentId,
            action: "create",
          },
          orderBy: { createdAt: "asc" },
        });
        const original = audit?.after as { identity?: unknown } | null;
        if (!original || stable(original.identity) !== stable(identity))
          throw new ConflictException(
            "Kunci transaksi sudah dipakai dengan rincian investasi berbeda.",
          );
        const result = await this.ledger.createWithinTransaction(
          tx,
          familyGroupId,
          existing.investmentId,
          entry,
          actor,
        );
        return { investmentId: existing.investmentId, ...result };
      }
      if (
        owner &&
        !(await tx.member.findFirst({
          where: { familyGroupId, userId: owner },
        }))
      )
        throw new BadRequestException("Pemilik bukan anggota keluarga ini.");
      const platform = h.platformAccountId
        ? await tx.platformAccount.findUnique({
            where: { id: h.platformAccountId, familyGroupId },
          })
        : null;
      if (h.platformAccountId && !platform)
        throw new NotFoundException("Akun platform tidak ditemukan.");
      const catalog = platform
        ? findInvestmentPlatform(platform.platformKey)
        : null;
      const product: InvestmentProduct =
        h.type === "saham"
          ? h.market === "IDX"
            ? "saham_idx"
            : "saham_us"
          : h.type === "lainnya"
            ? "reksa_dana"
            : h.type;
      if (
        catalog &&
        catalog.key !== "custom" &&
        (h.type === "lainnya" || !catalog.products.includes(product))
      )
        throw new BadRequestException(
          "Produk ini tidak didukung katalog platform. Gunakan platform kustom bila sesuai catatan Anda.",
        );
      if (
        platform &&
        isRowScoped(actor.member) &&
        platform.ownerUserId !== actor.member?.userId
      ) {
        const usable = entry.cashAccountId
          ? await tx.account.findFirst({
              where: {
                id: entry.cashAccountId,
                familyGroupId,
                platformAccountId: platform.id,
                isPrivate: false,
                shares: {
                  some: { userId: actor.member?.userId, canPost: true },
                },
              },
            })
          : null;
        if (!usable)
          throw new ForbiddenException(
            "Akun platform tidak dapat dipakai oleh anggota ini.",
          );
      }
      if (entry.kind === "buy" && (!platform || !entry.cashAccountId))
        throw new BadRequestException(
          "Pembelian baru wajib memilih akun platform dan kantong dana.",
        );
      if (entry.cashAccountId) {
        const account = await tx.account.findUnique({
          where: { id: entry.cashAccountId, familyGroupId },
        });
        if (!account || !platform)
          throw new BadRequestException(
            "Kantong dana harus terhubung ke akun platform yang dipilih.",
          );
        await assertUsableCashAccount(tx, account, actor, {
          currency: dto.entry.currency,
          platformAccountId: platform.id,
        });
      }
      if (
        entry.kind === "buy" &&
        new Prisma.Decimal(entry.pricePerUnit ?? "0").lte(0)
      )
        throw new BadRequestException("Harga pembelian harus lebih dari nol.");
      const allowFraction =
        h.market === "NASDAQ" || h.market === "NYSE"
          ? catalog?.fractionalUsShares === true
          : MARKETS[h.market].allowFractionDefault;
      const investment = await tx.investment.create({
        data: {
          familyGroupId,
          name,
          ticker: identity.ticker ?? deriveInternalCode(name),
          type: h.type,
          market: h.market,
          ownerUserId: owner,
          platformAccountId: platform?.id ?? null,
          cashAccountId: entry.cashAccountId ?? null,
          currency: dto.entry.currency,
          quantity: 0,
          costBasisPerUnit: 0,
          lotSize: MARKETS[h.market].lotSize,
          allowFraction,
          priceSymbol: identity.priceSymbol,
          details: details as Prisma.InputJsonValue,
          interestRatePct:
            details.deposit?.ratePct ?? details.bond?.couponRatePct ?? null,
          maturityDate:
            details.deposit?.maturityDate || details.bond?.maturityDate
              ? new Date(
                  `${details.deposit?.maturityDate ?? details.bond?.maturityDate}T00:00:00Z`,
                )
              : null,
          purchasedAt: new Date(`${entry.effectiveDate}T00:00:00+07:00`),
        },
      });
      const result = await this.ledger.createWithinTransaction(
        tx,
        familyGroupId,
        investment.id,
        entry,
        actor,
      );
      if (actor.userId)
        await tx.auditLog.create({
          data: {
            familyGroupId,
            userId: actor.userId,
            entity: "investment_position",
            entityId: investment.id,
            action: "create",
            after: {
              identity: {
                ...identity,
                details: details as Prisma.InputJsonValue,
              },
            },
          },
        });
      return { investmentId: investment.id, ...result };
    });
  }
}
