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

const KEY_REUSED =
  "idempotencyKey ini sudah dipakai untuk transaksi dengan isi berbeda. Muat ulang formulir lalu coba lagi.";
const REPLAY_POLL_MS = 100;

type StoredConversion = {
  originalAmount: Prisma.Decimal;
  originalCurrency: string;
  idrPerUnit: Prisma.Decimal;
  rateSource: string;
};

interface StoredTransfer {
  amountIdr: bigint;
  feeIdr: bigint;
  source?: StoredConversion;
  dest?: StoredConversion;
  fee?: StoredConversion;
}

function requestIsForeign(dto: PocketTransferDto): boolean {
  const hasFee = !new Prisma.Decimal(dto.fee ?? "0").isZero();
  return (
    dto.sourceCurrency !== "IDR" ||
    dto.destCurrency !== "IDR" ||
    (hasFee && (dto.feeCurrency ?? dto.sourceCurrency) !== "IDR")
  );
}

function eqDec(a: Prisma.Decimal | bigint, b: string): boolean {
  return new Prisma.Decimal(a.toString()).eq(new Prisma.Decimal(b));
}

/**
 * R7 — does a replayed request describe the stored movement? Foreign
 * transfers compare against their fx_conversions originals (amounts,
 * currencies, actual rate); all-IDR transfers against the IDR rows.
 */
function samePayload(dto: PocketTransferDto, stored: StoredTransfer): boolean {
  const fee = dto.fee ?? "0";
  const feeZero = new Prisma.Decimal(fee).isZero();
  const feeCurrency = dto.feeCurrency ?? dto.sourceCurrency;
  if (!stored.source || !stored.dest) {
    // Stored as all-IDR: the request must be all-IDR with the same numbers.
    if (requestIsForeign(dto) || dto.fxRate !== undefined) return false;
    if (!eqDec(stored.amountIdr, dto.sourceAmount)) return false;
    if (!eqDec(stored.feeIdr, fee)) return false;
    return (
      dto.destAmount === undefined ||
      eqDec(stored.amountIdr - stored.feeIdr, dto.destAmount)
    );
  }
  const { source, dest } = stored;
  if (
    source.originalCurrency !== dto.sourceCurrency ||
    !eqDec(source.originalAmount, dto.sourceAmount) ||
    dest.originalCurrency !== dto.destCurrency ||
    (dto.destAmount !== undefined &&
      !eqDec(dest.originalAmount, dto.destAmount))
  ) {
    return false;
  }
  if (feeZero ? stored.fee !== undefined : !stored.fee) return false;
  if (
    stored.fee &&
    (stored.fee.originalCurrency !== feeCurrency ||
      !eqDec(stored.fee.originalAmount, fee))
  ) {
    return false;
  }
  const actual = [source, dest].find((c) => c.rateSource === "actual");
  if (dto.fxRate === undefined) return actual === undefined;
  return actual !== undefined && eqDec(actual.idrPerUnit, dto.fxRate);
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

    // R9 — whenever the SOURCE is a pocket (a withdrawal, or a top-up
    // funded from another pocket) it may only spend settled cash. The
    // pre-check gives the early message; `sourceFloor` re-checks under a
    // row lock inside the write so concurrent debits cannot both pass.
    const sourceFloor = source.platformAccountId
      ? await this.assertAvailable(familyGroupId, source, amounts.amountIdr)
      : undefined;

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
          ...(sourceFloor !== undefined ? { sourceFloor } : {}),
        },
      );
      if ("held" in created) {
        // A transfer is never held for approval; guard the type anyway.
        throw new BadRequestException("Transfer tidak dapat ditahan.");
      }
      transactionId = created.id;
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        const again = await this.findReplay(
          familyGroupId,
          dto,
          legs,
          viewer,
          true,
        );
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
   * §4/R9 — a pocket may not give more than its available cash (recorded −
   * unsettled proceeds). Returns the held IDR so the write re-checks it as
   * `sourceFloor` under a row lock (TransactionsService.create).
   */
  private async assertAvailable(
    familyGroupId: string,
    pocket: Account,
    amountIdr: bigint,
  ): Promise<bigint> {
    const held = await heldByPocket(this.prisma, familyGroupId, [pocket.id]);
    const heldIdr = held.get(pocket.id)?.held ?? BigInt(0);
    const available = pocket.balance - heldIdr;
    if (amountIdr > available) {
      throw new BadRequestException(
        `Dana tersedia di ${pocket.name} tidak mencukupi (tersedia Rp ${available.toString()}, dibutuhkan Rp ${amountIdr.toString()}). Dana hasil jual yang belum selesai (settlement) belum bisa dipakai.`,
      );
    }
    return heldIdr;
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
   * The key must name the SAME movement: same legs, date and native
   * amounts / currencies / fee / rate as stored (fx_conversions rows, or
   * the IDR transaction rows when nothing was foreign). Anything else is a
   * 409, never a silent 200 for a different transfer.
   *
   * `awaitConversions` (the concurrent-duplicate path): the winner writes
   * its fx_conversions rows just after its commit, so a foreign request
   * polls briefly for them before comparing.
   */
  private async findReplay(
    familyGroupId: string,
    dto: PocketTransferDto,
    legs: Legs,
    viewer: PlatformViewer,
    awaitConversions = false,
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
      tx.toAccountId !== legs.destId ||
      tx.occurredAt.getTime() !== new Date(dto.occurredAt).getTime()
    ) {
      throw new ConflictException(KEY_REUSED);
    }
    const feeRow = await this.prisma.transaction.findUnique({
      where: {
        familyGroupId_idempotencyKey: {
          familyGroupId,
          idempotencyKey: `${dto.idempotencyKey}:fee`,
        },
      },
      select: { id: true, amount: true },
    });
    let conversions = await this.loadConversions(familyGroupId, tx.id);
    const foreignRequest = requestIsForeign(dto);
    for (
      let i = 0;
      awaitConversions && foreignRequest && conversions.length === 0 && i < 5;
      i++
    ) {
      await new Promise((r) => setTimeout(r, REPLAY_POLL_MS));
      conversions = await this.loadConversions(familyGroupId, tx.id);
    }
    const feeIdr = feeRow?.amount ?? BigInt(0);
    const byField = new Map(
      conversions.map((c) => [c.field.slice(FX_FIELD_PREFIX.length + 1), c]),
    );
    if (
      !samePayload(dto, {
        amountIdr: tx.amount,
        feeIdr,
        source: byField.get("source"),
        dest: byField.get("dest"),
        fee: byField.get("fee"),
      })
    ) {
      throw new ConflictException(KEY_REUSED);
    }
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

  private loadConversions(familyGroupId: string, transactionId: string) {
    return this.prisma.fxConversion.findMany({
      where: {
        familyGroupId,
        entity: "Transaction",
        entityId: transactionId,
        field: { startsWith: `${FX_FIELD_PREFIX}.` },
      },
    });
  }
}
