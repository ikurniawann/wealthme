import type { PrismaClient } from "@prisma/client";

/**
 * Each policy's latest paid dueDate, in ONE grouped query — the input to
 * dueNeedsConfirmation's "advanced by a recorded payment" exemption. A
 * voided payment is deleted, so it never counts; payments without a due
 * (legacy/reconciled) are ignored. `familyGroupId` narrows the query when
 * the caller is tenant-scoped (the reminder sweep is not).
 */
export async function findLastPaidDues(
  db: Pick<PrismaClient, "insurancePayment">,
  insuranceIds: string[],
  familyGroupId?: string,
): Promise<Map<string, Date>> {
  if (insuranceIds.length === 0) return new Map();
  const groups = await db.insurancePayment.groupBy({
    by: ["insuranceId"],
    where: {
      ...(familyGroupId ? { familyGroupId } : {}),
      insuranceId: { in: insuranceIds },
      dueDate: { not: null },
    },
    _max: { dueDate: true },
  });
  const out = new Map<string, Date>();
  for (const g of groups) {
    if (g._max.dueDate) out.set(g.insuranceId, g._max.dueDate);
  }
  return out;
}
