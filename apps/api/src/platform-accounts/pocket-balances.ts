import { Prisma } from "@prisma/client";

import type { PrismaService } from "../prisma/prisma.service";

const D = Prisma.Decimal;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Today's Asia/Jakarta calendar date as a UTC-midnight Date (a `@db.Date`). */
export function jakartaToday(now: Date = new Date()): Date {
  const iso = new Date(now.getTime() + JAKARTA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

export interface HeldBalance {
  /** IDR not yet settled (R9 "dana tertahan"). */
  held: bigint;
  /** True when a foreign unsettled row had no fxRate to value it in IDR. */
  incomplete: boolean;
}

/**
 * Investasi R9 — proceeds of an active `sell` that credited a pocket but
 * whose `settlementDate` is after today are recorded yet not available.
 * Values are IDR: an IDR row's netAmount as is; a foreign row's netAmount ×
 * its fxRate (IDR per unit). A foreign row without fxRate cannot be valued
 * and flags the result `incomplete` instead of being guessed.
 *
 * Task 7's replay engine owns the full ledger; this is the read-side figure
 * the pocket list and the withdrawal guard share.
 */
export async function heldByPocket(
  prisma: PrismaService,
  familyGroupId: string,
  pocketIds: string[],
  now: Date = new Date(),
): Promise<Map<string, HeldBalance>> {
  const out = new Map<string, HeldBalance>();
  if (pocketIds.length === 0) return out;
  const rows = await prisma.investmentTransaction.findMany({
    where: {
      familyGroupId,
      cashAccountId: { in: pocketIds },
      kind: "sell",
      status: "active",
      settlementDate: { gt: jakartaToday(now) },
    },
    select: {
      cashAccountId: true,
      netAmount: true,
      currency: true,
      fxRate: true,
    },
  });
  for (const r of rows) {
    if (!r.cashAccountId) continue;
    const prev = out.get(r.cashAccountId) ?? {
      held: BigInt(0),
      incomplete: false,
    };
    let idr: Prisma.Decimal | null = null;
    if (r.currency === "IDR") idr = new D(r.netAmount);
    else if (r.fxRate) idr = new D(r.netAmount).mul(r.fxRate);
    out.set(r.cashAccountId, {
      held:
        idr === null
          ? prev.held
          : prev.held +
            BigInt(idr.toDecimalPlaces(0, D.ROUND_HALF_UP).toFixed(0)),
      incomplete: prev.incomplete || idr === null,
    });
  }
  return out;
}
