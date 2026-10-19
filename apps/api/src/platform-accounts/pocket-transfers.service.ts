import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxPort } from "../fx/fx.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TransactionsService } from "../transactions/transactions.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  PlatformAccountsService,
  type PlatformViewer,
} from "./platform-accounts.service";
import { heldByPocket } from "./pocket-balances";
import {
  computePocketTransferAmounts,
  needsFxSnapshot,
  type PocketTransferAmounts,
} from "./pocket-transfer-amounts";

import type { PocketTransferDto } from "./dto/pocket-transfer.dto";
import type { FxSnapshot } from "../fx/fx-snapshot";
import type { ActingMember } from "../transactions/transactions.service";
import type { Account } from "@prisma/client";
import type { PocketTransferResultDto } from "@wealthme/contracts";

export type PocketTransferDirection = "top-up" | "withdraw";

const FX_FIELD_PREFIX = "pocketTransfer";
const WITHDRAW_FEE_DESCRIPTION = "Biaya penarikan dana platform";
const TOP_UP_FEE_DESCRIPTION = "Biaya top up dana platform";

interface Legs {
  sourceId: string;
  destId: string;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/**
 * Investasi §4 — money into and out of a platform pocket. Both directions
 * are one real two-sided `transfer` written by TransactionsService.create
 * (bank floor, ownership, closed-account and balance logic stay in one
 * place); a fee is the linked admin-fee expense on the destination. Nothing
 * here ever writes income, so a top-up cannot change net worth except by
 * its fee.
 *
 * R7 — `idempotencyKey` is stored on the transfer row (`<key>:fee` on the
 * fee row). A repeat with the same key returns the original result and
 * writes nothing; a concurrent duplicate loses on the unique index, rolls
 * back entirely and is answered the same way.
 */
@Injectable()
export class PocketTransfersService {
  private readonly logger = new Logger(PocketTransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxPort,
    private readonly transactions: TransactionsService,
    private readonly platforms: PlatformAccountsService,
  ) {}

  async transfer(
    familyGroupId: string,
    platformAccountId: string,
    pocketId: string,
    direction: PocketTransferDirection,
    dto: PocketTransferDto,
    actingMember: ActingMember | undefined,
    viewer: PlatformViewer,
  ): Promise<PocketTransferResultDto> {
    const pocket = await this.platforms.loadPocket(
      familyGroupId,
      platformAccountId,
      pocketId,
    );
    const legs: Legs =
      direction === "top-up"
        ? { sourceId: dto.counterAccountId, destId: pocket.id }
        : { sourceId: pocket.id, destId: dto.counterAccountId };

    const replay = await this.findReplay(familyGroupId, dto, legs, viewer);
    if (replay) return replay;

    const counter = await this.loadCounter(familyGroupId, dto, pocket);
    const source = direction === "top-up" ? counter : pocket;
    const dest = direction === "top-up" ? pocket : counter;
    this.assertCurrency("sumber", dto.sourceCurrency, source);
    this.assertCurrency("tujuan", dto.destCurrency, dest);

    const occurredAt = new Date(dto.occurredAt);
    const amountsInput = {
      sourceAmount: dto.sourceAmount,
      sourceCurrency: dto.sourceCurrency,
      destAmount: dto.destAmount,
      destCurrency: dto.destCurrency,
      fxRate: dto.fxRate,
      fee: dto.fee,
      feeCurrency: dto.feeCurrency,
      rateDate: dto.occurredAt.slice(0, 10),
    };
    const snapshot = needsFxSnapshot(amountsInput)
      ? await this.liveSnapshot()
      : null;
    const amounts = computePocketTransferAmounts(amountsInput, snapshot);

    if (direction === "withdraw") {
      await this.assertAvailable(familyGroupId, pocket, amounts.amountIdr);
    }

    let transactionId: string;
    try {
      const created = await this.transactions.create(
        familyGroupId,
        {
          accountId: legs.sourceId,
          toAccountId: legs.destId,
          type: "transfer",
          amount: Number(amounts.amountIdr),
          ...(amounts.feeIdr > BigInt(0)
            ? { adminFee: Number(amounts.feeIdr) }
            : {}),
          description:
            dto.description?.trim() ||
            (direction === "top-up"
              ? `Top up dana ke ${pocket.name}`
              : `Tarik dana dari ${pocket.name}`),
          occurredAt: occurredAt.toISOString(),
        },
        actingMember ?? undefined,
        {
          idempotencyKey: dto.idempotencyKey,
          feeDescription:
            direction === "top-up"
              ? TOP_UP_FEE_DESCRIPTION
              : WITHDRAW_FEE_DESCRIPTION,
        },
      );
      if ("held" in created) {
        // A transfer is never held for approval; guard the type anyway.
        throw new BadRequestException("Transfer tidak dapat ditahan.");
      }
      transactionId = created.id;
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        const again = await this.findReplay(familyGroupId, dto, legs, viewer);
        if (again) return again;
      }
      throw err;
    }

    await this.recordConversions(
      familyGroupId,
      transactionId,
      amounts,
      viewer.userId ?? null,
    );
    const feeRow = await this.prisma.transaction.findUnique({
      where: {
        familyGroupId_idempotencyKey: {
          familyGroupId,
          idempotencyKey: `${dto.idempotencyKey}:fee`,
        },
      },
      select: { id: true },
    });
    return {
      replayed: false,
      transactionId,
      feeTransactionId: feeRow?.id ?? null,
      amountIdr: amounts.amountIdr.toString(),
      feeIdr: amounts.feeIdr.toString(),
      sourceAmount: amounts.sourceAmount,
      sourceCurrency: amounts.sourceCurrency,
      destAmount: amounts.destAmount,
      destCurrency: amounts.destCurrency,
      fxRate: amounts.fxRate,
      fee: amounts.fee,
      feeCurrency: amounts.feeCurrency,
      pocket: await this.platforms.findPocket(familyGroupId, pocket.id, viewer),
    };
  }

  private async loadCounter(
    familyGroupId: string,
    dto: PocketTransferDto,
    pocket: Account,
  ): Promise<Account> {
    if (dto.counterAccountId === pocket.id) {
      throw new BadRequestException(
        "Rekening asal dan tujuan tidak boleh sama.",
      );
    }
    const counter = await this.prisma.account.findFirst({
      where: { id: dto.counterAccountId, familyGroupId },
    });
    if (!counter) throw new NotFoundException("Rekening tidak ditemukan");
    if (counter.type === "property") {
      throw new BadRequestException(
        "Top up dan penarikan hanya dari/ke rekening bank, e-wallet, kas, atau kantong dana lain.",
      );
    }
    return counter;
  }

  /** §3 — never mix currencies: each side moves in its account's currency. */
  private assertCurrency(side: string, currency: string, account: Account) {
    if (account.currency !== currency) {
      throw new BadRequestException(
        `Mata uang ${side} (${currency}) tidak sama dengan mata uang ${account.name} (${account.currency}).`,
      );
    }
  }

  /**
   * §4 — a withdrawal may not take more than the pocket's available cash
   * (recorded − unsettled proceeds). Checked before the write; the source
   * debit itself runs inside TransactionsService.create's transaction.
   */
  private async assertAvailable(
    familyGroupId: string,
    pocket: Account,
    amountIdr: bigint,
  ) {
    const held = await heldByPocket(this.prisma, familyGroupId, [pocket.id]);
    const available = pocket.balance - (held.get(pocket.id)?.held ?? BigInt(0));
    if (amountIdr > available) {
      throw new BadRequestException(
        `Dana tersedia di ${pocket.name} tidak mencukupi (tersedia Rp ${available.toString()}, dibutuhkan Rp ${amountIdr.toString()}). Dana hasil jual yang belum selesai (settlement) belum bisa ditarik.`,
      );
    }
  }

  private async liveSnapshot(): Promise<FxSnapshot> {
    const snapshot = await this.fx.getSnapshot();
    // Same refusal as FxInputService: never value a write at a placeholder.
    if (snapshot.source === "indicative") {
      throw new ServiceUnavailableException({
        message:
          "fxInputs: FX rate is indicative only, not a live rate — choose IDR or try again",
        code: "FX_RATE_UNAVAILABLE",
      });
    }
    return snapshot;
  }

  /**
   * Cross-currency metadata (§4: source amount, destination amount, actual
   * rate, fee) on the fx_conversions table FxInputService already writes:
   * entity "Transaction", entityId = the transfer row, fields
   * `pocketTransfer.source|dest|fee`; `rateSource` "actual" marks the
   * user's own rate. Written after commit like FxInputService.record, so a
   * failure is logged and never turns a committed transfer into an error.
   */
  private async recordConversions(
    familyGroupId: string,
    transactionId: string,
    amounts: PocketTransferAmounts,
    userId: string | null,
  ) {
    if (amounts.conversions.length === 0) return;
    try {
      await this.prisma.fxConversion.createMany({
        data: amounts.conversions.map((c) => ({
          familyGroupId,
          entity: "Transaction",
          entityId: transactionId,
          field: `${FX_FIELD_PREFIX}.${c.field}`,
          originalAmount: c.originalAmount,
          originalCurrency: c.originalCurrency,
          idrAmount: c.idrAmount,
          idrPerUnit: c.idrPerUnit,
          rateDate: new Date(`${c.rateDate}T00:00:00.000Z`),
          rateSource: c.rateSource,
          rateStale: c.rateStale,
          createdByUserId: userId,
        })),
      });
    } catch (err: unknown) {
      this.logger.error(
        `fx_conversions insert failed after commit (transaction ${transactionId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * R7 replay — the original result for a used key, or null for a new key.
   * A key already used for a different movement is a 409, never a silent
   * success for the wrong transfer.
   */
  private async findReplay(
    familyGroupId: string,
    dto: PocketTransferDto,
    legs: Legs,
    viewer: PlatformViewer,
  ): Promise<PocketTransferResultDto | null> {
    const tx = await this.prisma.transaction.findUnique({
      where: {
        familyGroupId_idempotencyKey: {
          familyGroupId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (!tx) return null;
    if (
      tx.type !== "transfer" ||
      tx.accountId !== legs.sourceId ||
      tx.toAccountId !== legs.destId
    ) {
      throw new ConflictException(
        "idempotencyKey ini sudah dipakai untuk transaksi lain. Muat ulang formulir lalu coba lagi.",
      );
    }
    const [feeRow, conversions] = await Promise.all([
      this.prisma.transaction.findUnique({
        where: {
          familyGroupId_idempotencyKey: {
            familyGroupId,
            idempotencyKey: `${dto.idempotencyKey}:fee`,
          },
        },
        select: { id: true, amount: true },
      }),
      this.prisma.fxConversion.findMany({
        where: {
          familyGroupId,
          entity: "Transaction",
          entityId: tx.id,
          field: { startsWith: `${FX_FIELD_PREFIX}.` },
        },
      }),
    ]);
    const feeIdr = feeRow?.amount ?? BigInt(0);
    const byField = new Map(
      conversions.map((c) => [c.field.slice(FX_FIELD_PREFIX.length + 1), c]),
    );
    const src = byField.get("source");
    const dst = byField.get("dest");
    const fee = byField.get("fee");
    const actual = [src, dst].find((c) => c?.rateSource === "actual");
    return {
      replayed: true,
      transactionId: tx.id,
      feeTransactionId: feeRow?.id ?? null,
      amountIdr: tx.amount.toString(),
      feeIdr: feeIdr.toString(),
      sourceAmount: src ? src.originalAmount.toString() : tx.amount.toString(),
      sourceCurrency: src?.originalCurrency ?? "IDR",
      destAmount: dst
        ? dst.originalAmount.toString()
        : (tx.amount - feeIdr).toString(),
      destCurrency: dst?.originalCurrency ?? "IDR",
      fxRate: actual ? actual.idrPerUnit.toString() : null,
      fee: fee ? fee.originalAmount.toString() : feeIdr.toString(),
      feeCurrency: fee?.originalCurrency ?? src?.originalCurrency ?? "IDR",
      pocket: await this.platforms.findPocket(
        familyGroupId,
        legs.sourceId === dto.counterAccountId ? legs.destId : legs.sourceId,
        viewer,
      ),
    };
  }
}
