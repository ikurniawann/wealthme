import { BadRequestException, Injectable } from "@nestjs/common";

import { canSeePrivateItems } from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// Value imports: Nest DI reads these constructor types at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TransactionsService } from "../transactions/transactions.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AccountsService } from "./accounts.service";

import type { AccountResponseDto } from "./dto/account-response.dto";
import type { CreateTransactionDto } from "../transactions/dto/create-transaction.dto";
import type { ActingMember } from "../transactions/transactions.service";

export const RECONCILE_DESCRIPTION = "Penyesuaian saldo (cocokkan saldo)";

export interface ReconcileResult {
  account: AccountResponseDto;
  /** counted − recorded, IDR; "0" when the balance already matched. */
  adjustment: string;
  /** The adjustment expense waits for the head's approval; not yet checked. */
  held: boolean;
}

/**
 * "Cocokkan saldo" for cash and e-wallets. The balance only moves through
 * transactions, so a mismatch becomes one income/expense row explaining the
 * jump, and the account is stamped as checked. A held adjustment (a member
 * whose expenses need approval) leaves the stamp alone until it is posted.
 */
@Injectable()
export class AccountReconcileService {
  constructor(
    private readonly accounts: AccountsService,
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  async reconcile(
    familyGroupId: string,
    id: string,
    actualBalance: number,
    member: ActingMember | undefined,
    userId?: string,
  ): Promise<ReconcileResult> {
    const canSeePrivate = canSeePrivateItems(member?.role);
    const before = await this.accounts.findOne(
      familyGroupId,
      id,
      canSeePrivate,
      member ?? null,
      userId,
    );
    if (actualBalance < 0 && before.type !== "cash") {
      throw new BadRequestException("Saldo hanya boleh minus untuk kas tunai.");
    }
    const diff = BigInt(actualBalance) - BigInt(before.balance ?? "0");
    let held = false;
    if (diff !== 0n) {
      const abs = diff < 0n ? -diff : diff;
      const dto = {
        accountId: id,
        type: diff > 0n ? "income" : "expense",
        amount: Number(abs),
        description: RECONCILE_DESCRIPTION,
        occurredAt: new Date().toISOString(),
      } as CreateTransactionDto;
      // The counted figure IS reality: the live-overspend floor protects
      // fresh debits, not a correction down to what is actually there.
      const result = await this.transactions.create(
        familyGroupId,
        dto,
        member ?? undefined,
        { enforceBankFloor: false },
      );
      held = "held" in result;
    }
    if (!held) {
      await this.prisma.account.update({
        where: { id, familyGroupId },
        data: { lastReconciledAt: new Date() },
      });
    }
    const account = await this.accounts.findOne(
      familyGroupId,
      id,
      canSeePrivate,
      member ?? null,
      userId,
    );
    return { account, adjustment: diff.toString(), held };
  }
}
