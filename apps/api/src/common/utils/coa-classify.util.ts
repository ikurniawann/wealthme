import { CoaDirection, type TransactionType } from "@prisma/client";

/**
 * EPIC-017 (Decision #1, REPLACE): a transaction's reporting direction comes
 * from its category's mapped COA account — every category is COA-linked
 * (Category.coaAccountId is NOT NULL). Only a category-LESS transaction (no
 * category at all) falls back to its own transaction type, the only signal
 * available.
 *
 * Shared by reports.service and dashboard.service so both screens classify
 * income / expense / transfer identically.
 */
export function txCoaDirection(tx: {
  type: TransactionType;
  category: { coaAccount: { direction: CoaDirection } } | null;
}): CoaDirection {
  if (tx.category) return tx.category.coaAccount.direction;
  if (tx.type === "income") return CoaDirection.INCOME;
  if (tx.type === "transfer") return CoaDirection.TRANSFER;
  return CoaDirection.EXPENSE;
}
