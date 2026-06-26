import { CategoryKind, CoaDirection, TransactionType } from "@prisma/client";

/**
 * Maps a Prisma CategoryKind to a CoaDirection at report read-time.
 * No DB join — COA direction is derived from the transaction's category kind.
 */
export function categoryKindToCoaDirection(kind: CategoryKind): CoaDirection {
  return kind === CategoryKind.income
    ? CoaDirection.INCOME
    : CoaDirection.EXPENSE;
}

/**
 * Maps a Prisma TransactionType to a CoaDirection at report read-time.
 */
export function transactionTypeToCoaDirection(
  type: TransactionType,
): CoaDirection {
  if (type === TransactionType.income) return CoaDirection.INCOME;
  if (type === TransactionType.transfer) return CoaDirection.TRANSFER;
  return CoaDirection.EXPENSE;
}
