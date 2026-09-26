import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  runSerializableWithRetry,
  type TxClient,
} from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CryptoService } from "../crypto/crypto.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { ConfirmParticipantDto } from "./dto/confirm-participant.dto";
import type { CreateSplitBillDto } from "./dto/create-split-bill.dto";
import type { PublicSplitParticipantResponseDto } from "./dto/public-split-participant-response.dto";
import type {
  SplitBillResponseDto,
  SplitParticipantResponseDto,
} from "./dto/split-bill-response.dto";
import type { UpdatePayoutAccountDto } from "./dto/update-payout-account.dto";

type ParticipantRow = {
  id: string;
  splitBillId: string;
  name: string;
  amountOwed: bigint;
  status: string;
  shareToken: string;
  claimedAt: Date | null;
  paidAt: Date | null;
  settlementTransactionId: string | null;
  createdAt: Date;
};

type SplitBillRow = {
  id: string;
  familyGroupId: string;
  title: string;
  totalAmount: bigint;
  currency: string;
  status: string;
  notes: string | null;
  payoutAccountId: string | null;
  payoutInstructions: string | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  participants: ParticipantRow[];
};

type PayoutAccount = {
  name: string;
  institution: string | null;
  maskedNumber: string | null;
} | null;

function toParticipantDto(p: ParticipantRow): SplitParticipantResponseDto {
  return {
    id: p.id,
    splitBillId: p.splitBillId,
    name: p.name,
    amountOwed: p.amountOwed.toString(),
    status: p.status,
    shareToken: p.shareToken,
    claimedAt: p.claimedAt?.toISOString() ?? null,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function toSplitBillDto(row: SplitBillRow): SplitBillResponseDto {
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    title: row.title,
    totalAmount: row.totalAmount.toString(),
    currency: row.currency,
    status: row.status,
    notes: row.notes,
    payoutAccountId: row.payoutAccountId,
    payoutInstructions: row.payoutInstructions,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    participants: row.participants.map(toParticipantDto),
  };
}

/**
 * EPIC-023 F3 (D21) — the PUBLIC view of one participant's own share.
 * Deliberately built from ONLY this participant + this bill's non-secret
 * fields: no `familyGroupId`, no bill id, no other participant, and the
 * account fields are already display-only (name/institution/masked
 * number, never the account id or balance).
 */
function toPublicParticipantDto(
  participant: ParticipantRow,
  bill: Pick<
    SplitBillRow,
    "title" | "currency" | "payoutInstructions" | "payoutAccountId"
  >,
  account: PayoutAccount,
): PublicSplitParticipantResponseDto {
  return {
    billTitle: bill.title,
    participantName: participant.name,
    amountOwed: participant.amountOwed.toString(),
    currency: bill.currency,
    status: participant.status,
    claimedAt: participant.claimedAt?.toISOString() ?? null,
    paidAt: participant.paidAt?.toISOString() ?? null,
    payout: {
      accountName: account?.name ?? null,
      accountInstitution: account?.institution ?? null,
      accountMaskedNumber: account?.maskedNumber ?? null,
      instructions: bill.payoutInstructions,
      // EPIC-023 Group F fix round (HIGH 5) — the owner DID nominate an
      // account (bill.payoutAccountId is set), even if `resolvePayoutAccount`
      // above couldn't resolve it (e.g. the account was later deleted). The
      // recipient's page uses this to show "payment info is currently
      // unavailable" rather than the more alarming (and false) "the owner
      // never set this up".
      configured: bill.payoutAccountId !== null,
    },
  };
}

const PARTICIPANT_INCLUDE = {
  participants: { orderBy: { createdAt: "asc" as const } },
};

// Batch 2 (#2) — settlement transactions used to hardcode `categoryId: null`,
// showing a bare "—" in Transaksi's KATEGORI column for every split-bill
// payment. "Pending Reimbursement" (COA 40101, groupNum 4/Receivable) is the
// seeded system category for exactly this: money coming back in for a
// receivable, matching the `resolveSystemCategoryId` pattern already used by
// liabilities.service.ts for prepayments.
const SETTLEMENT_CATEGORY_NAME = "Pending Reimbursement";
const SETTLEMENT_COA_CODE = "40101";

@Injectable()
export class SplitBillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async create(
    familyGroupId: string,
    dto: CreateSplitBillDto,
  ): Promise<SplitBillResponseDto> {
    const sumOwed = dto.participants.reduce((s, p) => s + p.amountOwed, 0);
    if (sumOwed !== dto.totalAmount) {
      throw new BadRequestException(
        `Sum of participant amounts (${sumOwed}) must equal totalAmount (${dto.totalAmount})`,
      );
    }

    // EPIC-023 F3 (D21) — the payout account must belong to THIS family
    // group (tenant scoping), same as every other account reference in
    // this codebase (e.g. LiabilitiesService.pay()'s sourceAccountId).
    const payoutAccount = await this.prisma.account.findUnique({
      where: { id: dto.payoutAccountId, familyGroupId },
    });
    if (!payoutAccount) {
      throw new BadRequestException(
        `Payout account ${dto.payoutAccountId} not found in this family group`,
      );
    }

    const splitBill = await this.prisma.$transaction(async (tx) => {
      const bill = await tx.splitBill.create({
        data: {
          familyGroupId,
          title: dto.title,
          totalAmount: BigInt(dto.totalAmount),
          notes: dto.notes ?? null,
          payoutAccountId: dto.payoutAccountId,
          payoutInstructions: dto.payoutInstructions ?? null,
          participants: {
            create: dto.participants.map((p) => ({
              name: p.name,
              amountOwed: BigInt(p.amountOwed),
            })),
          },
        },
        include: PARTICIPANT_INCLUDE,
      });
      return bill;
    });

    return toSplitBillDto(splitBill as SplitBillRow);
  }

  async findAll(familyGroupId: string): Promise<SplitBillResponseDto[]> {
    const rows = await this.prisma.splitBill.findMany({
      where: { familyGroupId },
      include: PARTICIPANT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => toSplitBillDto(r as SplitBillRow));
  }

  async findOne(
    familyGroupId: string,
    id: string,
  ): Promise<SplitBillResponseDto> {
    const row = await this.prisma.splitBill.findUnique({
      where: { id, familyGroupId },
      include: PARTICIPANT_INCLUDE,
    });
    if (!row) throw new NotFoundException("Split bill not found");
    return toSplitBillDto(row as SplitBillRow);
  }

  /**
   * Group F (task F3) — repairs a bill whose payoutAccountId is null or
   * points at a deleted account (create() required one, but there was no
   * way to fix it afterward). Same tenant scoping as create(): the account
   * must belong to THIS family group.
   */
  async updatePayoutAccount(
    familyGroupId: string,
    id: string,
    dto: UpdatePayoutAccountDto,
  ): Promise<SplitBillResponseDto> {
    const existing = await this.prisma.splitBill.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Split bill not found");

    const payoutAccount = await this.prisma.account.findUnique({
      where: { id: dto.payoutAccountId, familyGroupId },
    });
    if (!payoutAccount) {
      throw new BadRequestException(
        `Payout account ${dto.payoutAccountId} not found in this family group`,
      );
    }

    const updated = await this.prisma.splitBill.update({
      where: { id, familyGroupId },
      data: { payoutAccountId: dto.payoutAccountId },
      include: PARTICIPANT_INCLUDE,
    });
    return toSplitBillDto(updated as SplitBillRow);
  }

  /**
   * EPIC-023 F3 (D21) — "revocable": kills every participant's share link
   * for this bill at once, without deleting the bill. Both public
   * endpoints below check `revokedAt` and answer with an honest 410 Gone.
   */
  async revoke(
    familyGroupId: string,
    id: string,
  ): Promise<SplitBillResponseDto> {
    const existing = await this.prisma.splitBill.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Split bill not found");

    const updated = await this.prisma.splitBill.update({
      where: { id, familyGroupId },
      data: { revokedAt: new Date() },
      include: PARTICIPANT_INCLUDE,
    });
    return toSplitBillDto(updated as SplitBillRow);
  }

  /**
   * EPIC-023 F3 (D21) — PUBLIC, unauthenticated: the recipient's own share,
   * identified by THEIR OWN `SplitParticipant.shareToken`, never the
   * (removed) bill-wide token. Returns only this one participant's data —
   * see `toPublicParticipantDto`'s comment for exactly what is excluded.
   */
  async getPublicParticipant(
    token: string,
  ): Promise<PublicSplitParticipantResponseDto> {
    const participant = await this.prisma.splitParticipant.findUnique({
      where: { shareToken: token },
      include: { splitBill: true },
    });
    if (!participant) {
      throw new NotFoundException("Split bill link not found");
    }
    if (participant.splitBill.revokedAt) {
      throw new GoneException(
        "Link tagihan split ini sudah dicabut oleh pemiliknya.",
      );
    }

    const account = await this.resolvePayoutAccount(participant.splitBill);
    return toPublicParticipantDto(
      participant as ParticipantRow,
      participant.splitBill,
      account,
    );
  }

  /**
   * EPIC-023 F3 (D21) — PUBLIC, unauthenticated: the "saya sudah transfer"
   * claim. Moves NO money and touches no Account/Transaction — it only
   * ever flips `pending` → `claimed` (Honest UI mandate: a claim is a
   * claim, not a payment). Idempotent: claiming an already-"claimed" link
   * again is a harmless no-op; claiming an already-"paid" one is refused
   * (nothing left to claim).
   */
  async claimParticipant(
    token: string,
  ): Promise<PublicSplitParticipantResponseDto> {
    const existing = await this.prisma.splitParticipant.findUnique({
      where: { shareToken: token },
      include: { splitBill: true },
    });
    if (!existing) {
      throw new NotFoundException("Split bill link not found");
    }
    if (existing.splitBill.revokedAt) {
      throw new GoneException(
        "Link tagihan split ini sudah dicabut oleh pemiliknya.",
      );
    }
    if (existing.status === "paid") {
      throw new ConflictException(
        "Tagihan ini sudah dikonfirmasi lunas oleh pemilik — klaim tidak diperlukan lagi.",
      );
    }

    // Atomic conditional update, not a full Serializable transaction: a
    // claim moves no money, so a race between two concurrent claim() calls
    // has no correctness consequence either way (both land on "claimed").
    // Reserve the Serializable-retry cost (see confirmParticipant below)
    // for the one path that actually posts income.
    if (existing.status === "pending") {
      await this.prisma.splitParticipant.updateMany({
        where: { id: existing.id, status: "pending" },
        data: { status: "claimed", claimedAt: new Date() },
      });
    }

    const updated = await this.prisma.splitParticipant.findUnique({
      where: { id: existing.id },
    });
    if (!updated) {
      throw new NotFoundException("Split bill link not found");
    }

    const account = await this.resolvePayoutAccount(existing.splitBill);
    return toPublicParticipantDto(
      updated as ParticipantRow,
      existing.splitBill,
      account,
    );
  }

  /**
   * EPIC-023 F3 (D21) — AUTHENTICATED (owner/spouse/member): "the owner
   * confirms, and only then does it become real income." Posts one real
   * `Transaction` (type "income") against the bill's payout account,
   * credits that account's balance, and marks the participant "paid" —
   * all inside the SAME Serializable transaction so a failure never posts
   * income without marking the participant paid, or vice versa.
   *
   * Idempotency ("confirming twice must not post income twice"): the read
   * of `participant.status` and the decision to post happen in the SAME
   * transaction as the write. Two concurrent confirm() calls both read
   * "pending"/"claimed" before either commits; Serializable isolation
   * detects the write-write conflict on the same participant/account rows
   * and aborts the loser with P2034. `runSerializableWithRetry` retries
   * the loser in a fresh transaction, which now reads the winner's
   * already-committed "paid" status and takes the no-op branch below
   * instead of posting a second Transaction.
   */
  async confirmParticipant(
    familyGroupId: string,
    splitId: string,
    participantId: string,
    dto: ConfirmParticipantDto,
  ): Promise<SplitParticipantResponseDto> {
    return runSerializableWithRetry(this.prisma, async (tx) => {
      const bill = await tx.splitBill.findUnique({
        where: { id: splitId, familyGroupId },
      });
      if (!bill) throw new NotFoundException("Split bill not found");

      const participant = await tx.splitParticipant.findUnique({
        where: { id: participantId, splitBillId: splitId },
      });
      if (!participant) throw new NotFoundException("Participant not found");

      // Idempotent no-op — see the method comment above.
      if (participant.status === "paid") {
        return toParticipantDto(participant as ParticipantRow);
      }

      if (!bill.payoutAccountId) {
        throw new BadRequestException(
          "Split bill ini belum punya rekening tujuan pembayaran — atur dulu sebelum konfirmasi.",
        );
      }
      const account = await tx.account.findUnique({
        where: { id: bill.payoutAccountId, familyGroupId },
      });
      if (!account) {
        throw new BadRequestException("Payout account not found");
      }

      const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
      const categoryId = await this.resolveSettlementCategoryId(
        tx,
        familyGroupId,
      );

      const transaction = await tx.transaction.create({
        data: {
          familyGroupId,
          accountId: account.id,
          categoryId,
          amount: participant.amountOwed,
          type: "income",
          description: `Split bill: ${bill.title} — ${participant.name}`,
          occurredAt: paidAt,
        },
      });

      await tx.account.update({
        where: { id: account.id, familyGroupId },
        data: { balance: { increment: participant.amountOwed } },
      });

      const updatedParticipant = await tx.splitParticipant.update({
        where: { id: participantId },
        data: {
          status: "paid",
          paidAt,
          settlementTransactionId: transaction.id,
        },
      });

      // Every participant paid — the bill itself is settled.
      const remaining = await tx.splitParticipant.count({
        where: { splitBillId: splitId, status: { not: "paid" } },
      });
      if (remaining === 0) {
        await tx.splitBill.update({
          where: { id: splitId },
          data: { status: "settled" },
        });
      }

      return toParticipantDto(updatedParticipant as ParticipantRow);
    });
  }

  /**
   * EPIC-023 Group F fix round (MEDIUM 7) — before F3, settling a bill
   * never posted a `Transaction`, so deleting one was always safe. Now
   * `confirmParticipant` posts real income and credits an account, and the
   * schema cascade (`SplitParticipant.splitBill onDelete: Cascade`) would
   * delete the participant row — including `settlementTransactionId`, the
   * only pointer back to that `Transaction` — leaving the posted income
   * and the credited balance permanently disconnected from any bill.
   *
   * Chose REFUSE over reverse (unlike `DonationsService.remove`, which
   * reverses its own linked transaction): a split bill can have several
   * independently-paid participants, each with its OWN transaction/account
   * credit, so a correct reversal would need to walk and undo every one —
   * more moving parts for a case that's rare in practice (you settled up,
   * why delete it?). Refusing is simpler and never risks a wrong balance.
   * Scoped to "paid" specifically (not "claimed") — a claim posts no money,
   * so deleting a bill with only pending/claimed participants orphans
   * nothing and stays allowed. The owner can still `revoke()` the links on
   * a paid bill if they want recipients locked out.
   *
   * EPIC-023 Group F final fix round (HIGH 1) — the guard used to be a
   * plain read-then-act with no transaction, isolation, or lock: it read
   * every participant as pending/claimed, then deleted. A concurrent
   * `confirmParticipant()` could commit (atomically, at Serializable
   * isolation) in the gap between that read and this `delete()`, whose
   * cascade (`SplitParticipant.splitBill onDelete: Cascade`) would then
   * destroy the just-paid participant while the posted `Transaction` and
   * credited balance survive, disconnected from any bill — exactly the
   * defect this guard exists to prevent. The check and the delete now run
   * inside the SAME Serializable transaction as `confirmParticipant`
   * (via `runSerializableWithRetry`), so the two commit atomically against
   * each other: whichever one commits first is the state the other reads.
   *
   * EPIC-023 Group F final fix round (MEDIUM 2) — `settlementTransactionId`
   * is an unenforced FK (same convention as `Donation.transactionId`): the
   * posted `Transaction` is an ordinary row, fully visible and deletable
   * from the normal transactions surface, which knows nothing about split
   * bills. If it was deleted out-of-band, the participant's "paid" status
   * is stale — refusing forever would leave the bill permanently stuck
   * with no path forward, telling the user income was posted when it no
   * longer exists. So a "paid" participant only still blocks deletion
   * while its settlementTransactionId resolves to a REAL, still-existing
   * Transaction in this family group.
   */
  async remove(familyGroupId: string, id: string): Promise<void> {
    await runSerializableWithRetry(this.prisma, async (tx) => {
      const existing = await tx.splitBill.findUnique({
        where: { id, familyGroupId },
        include: PARTICIPANT_INCLUDE,
      });
      if (!existing) throw new NotFoundException("Split bill not found");

      await this.assertNoLivePaidSettlement(
        tx,
        familyGroupId,
        existing.participants as ParticipantRow[],
      );

      await tx.splitBill.delete({ where: { id, familyGroupId } });
    });
  }

  /**
   * See the (MEDIUM 2) comment on `remove()` above for the full rationale.
   */
  private async assertNoLivePaidSettlement(
    tx: TxClient,
    familyGroupId: string,
    participants: ParticipantRow[],
  ): Promise<void> {
    const settlementIds = participants
      .filter((p) => p.status === "paid")
      .map((p) => p.settlementTransactionId)
      .filter((tid): tid is string => tid !== null);
    if (settlementIds.length === 0) return;

    const liveTransaction = await tx.transaction.findFirst({
      where: { id: { in: settlementIds }, familyGroupId },
      select: { id: true },
    });
    if (liveTransaction) {
      throw new ConflictException(
        "Split bill ini sudah punya peserta yang lunas (transaksi nyata sudah tercatat) dan tidak bisa dihapus. Gunakan 'Cabut Link' untuk menghentikan tagihan ini.",
      );
    }
  }

  /**
   * Finds (or creates) this family's "Pending Reimbursement" category, tied
   * to the seeded COA 40101 (groupNum 4/Receivable). Returns `null` — never
   * throws — when that COA isn't seeded for this family group yet, so an
   * older/incomplete family group still settles participants exactly as
   * before rather than failing confirmation over missing setup.
   */
  private async resolveSettlementCategoryId(
    tx: TxClient,
    familyGroupId: string,
  ): Promise<string | null> {
    const coaAccount = await tx.coaAccount.findFirst({
      where: { familyGroupId, code: SETTLEMENT_COA_CODE },
    });
    if (!coaAccount) return null;

    const existing = await tx.category.findFirst({
      where: { familyGroupId, name: SETTLEMENT_CATEGORY_NAME, kind: "income" },
      select: { id: true, coaAccountId: true },
    });
    if (existing) {
      return existing.coaAccountId === coaAccount.id ? existing.id : null;
    }

    const created = await tx.category.create({
      data: {
        familyGroupId,
        name: SETTLEMENT_CATEGORY_NAME,
        kind: "income",
        coaAccountId: coaAccount.id,
      },
    });
    return created.id;
  }

  /**
   * Looks up the bill's nominated payout account (unenforced FK, same
   * convention as `Donation.accountId`), scoped to the bill's OWN family
   * group as defence in depth even though both public call sites above
   * only ever reach this via a token they cannot forge.
   */
  private async resolvePayoutAccount(bill: {
    payoutAccountId: string | null;
    familyGroupId: string;
  }): Promise<PayoutAccount> {
    if (!bill.payoutAccountId) return null;
    const account = await this.prisma.account.findUnique({
      where: { id: bill.payoutAccountId, familyGroupId: bill.familyGroupId },
      select: { name: true, institution: true, maskedNumber: true },
    });
    if (!account) return null;
    // EPIC-033 p9 — the column is encrypted at rest; decrypt it here the
    // same way AccountsService.toDto does, or the payer sees a hex blob.
    return {
      ...account,
      maskedNumber: account.maskedNumber
        ? this.crypto.decrypt(account.maskedNumber)
        : null,
    };
  }
}
