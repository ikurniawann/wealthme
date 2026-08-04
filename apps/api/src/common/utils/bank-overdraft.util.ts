import { BadRequestException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";

type TxClient = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

/**
 * EPIC-021 #22 — a `bank`-type account may never be pushed below zero by a
 * fresh, user-initiated debit. Already-negative bank rows are grandfathered
 * (never auto-corrected, never blocked from receiving credits) but must
 * not be allowed to go MORE negative: `balance - debitAmount < 0` rejects
 * both "this debit would newly cross zero" (balance >= 0 today) and
 * "this account is already negative, reject further debits" (balance < 0
 * today, so subtracting any positive amount is always < 0) with the same
 * single comparison.
 *
 * Reads the account fresh via the caller's transactional `prisma` client
 * so the check sees the live, in-transaction balance. Non-bank types
 * (`cash`, `ewallet`, `investment`, `property`) are never guarded here —
 * #21 explicitly allows cash to go negative, and this epic only scopes
 * the hard floor to bank accounts.
 *
 * EPIC-023 (review follow-up) — extracted out of `TransactionsService` so
 * `LiabilitiesService.pay()`'s source-account debit enforces the SAME
 * invariant from one definition, instead of silently bypassing it the way
 * a copy-pasted (and possibly drifting) second implementation could.
 */
export async function assertBankNotOverdrawn(
  prisma: TxClient,
  familyGroupId: string,
  accountId: string,
  debitAmount: bigint,
): Promise<void> {
  const account = await prisma.account.findUnique({
    where: { id: accountId, familyGroupId },
    select: { type: true, balance: true, name: true },
  });
  if (!account || account.type !== "bank") return;
  if (account.balance - debitAmount < BigInt(0)) {
    throw new BadRequestException(
      `Saldo rekening bank "${account.name}" tidak mencukupi untuk transaksi ini. Rekening bank tidak boleh memiliki saldo minus.`,
    );
  }
}
