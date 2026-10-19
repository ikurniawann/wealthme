import { isRowScoped } from "../common/utils/privacy.util";

import type { LedgerActor } from "./ledger/ledger-support";
import type { Prisma } from "@prisma/client";

/** A holding follows its owner or its explicitly shared, nonprivate pocket. */
export function investmentAccessWhere(
  actor: LedgerActor,
  write = false,
): Prisma.InvestmentWhereInput {
  if (!isRowScoped(actor.member)) return {};
  const userId = actor.member?.userId ?? "";
  return {
    OR: [
      { ownerUserId: userId },
      {
        cashAccount: {
          isPrivate: false,
          shares: { some: { userId, ...(write ? { canPost: true } : {}) } },
        },
      },
    ],
  };
}
