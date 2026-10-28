import { canSeePrivateItems, isRowScoped } from "../common/utils/privacy.util";

import type { LedgerActor } from "./ledger/ledger-support";
import type { Prisma } from "@prisma/client";

/** A holding follows its owner or its explicitly shared, nonprivate pocket. */
export function investmentAccessWhere(
  actor: LedgerActor,
  write = false,
): Prisma.InvestmentWhereInput {
  const userId = actor.member?.userId ?? "";
  // "Shared with others" OFF: only Master / Co-Master / admin_staff and the
  // holding's owner see it.
  if (!isRowScoped(actor.member)) {
    return !actor.member || canSeePrivateItems(actor.member)
      ? {}
      : { OR: [{ isPrivate: false }, { ownerUserId: userId }] };
  }
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
