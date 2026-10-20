import { ConflictException } from "@nestjs/common";

import { findCashViolations } from "../investments/ledger/cash-timeline";
import { floatingKeyParts } from "../investments/ledger/ledger-dates";
import { loadCashTimeline } from "../investments/ledger/ledger-support";
import { formatLedgerPoint } from "../investments/ledger/replay";

import type { TxClient } from "../common/utils/serializable-retry.util";

/** Runs after both cash legs/fee, inside the same Serializable transaction.
 * Reject a backdated withdrawal that invalidates a later trade even when
 * today's available balance alone would have allowed it.
 */
export async function assertPocketTransferTimeline(
  tx: TxClient,
  familyGroupId: string,
  transactionId: string,
): Promise<void> {
  const transfer = await tx.transaction.findUniqueOrThrow({
    where: { id: transactionId, familyGroupId },
  });
  const fee = transfer.idempotencyKey
    ? await tx.transaction.findFirst({
        where: {
          familyGroupId,
          idempotencyKey: `${transfer.idempotencyKey}:fee`,
        },
      })
    : null;
  const from = {
    ...floatingKeyParts(transfer.occurredAt),
    createdAt: transfer.createdAt,
    id: transfer.id,
  };
  const ids = [
    ...new Set(
      [transfer.accountId, transfer.toAccountId].filter(
        (id): id is string => id !== null,
      ),
    ),
  ];
  const removed = new Set([transactionId, ...(fee ? [fee.id] : [])]);
  for (const accountId of ids) {
    const account = await tx.account.findUniqueOrThrow({
      where: { id: accountId, familyGroupId },
    });
    const recorded = await loadCashTimeline(tx, familyGroupId, accountId, from);
    const inserted = recorded.movements.filter((m) => removed.has(m.id));
    const delta = inserted.reduce((sum, m) => sum + m.delta, BigInt(0));
    // Parent and its fee are one atomic cash event, not two arbitrary UUID
    // sort positions (Postgres now() can give both the same createdAt).
    const after = {
      ...recorded,
      movements: [
        ...recorded.movements.filter((m) => !removed.has(m.id)),
        { id: transactionId, key: from, delta, transactionId },
      ],
    };
    const before = {
      ...after,
      movements: after.movements.filter((m) => !removed.has(m.id)),
    };
    const violations = findCashViolations({
      balanceNow: account.balance - delta,
      before,
      after,
      from,
    });
    const first = violations[0];
    if (first)
      throw new ConflictException({
        statusCode: 409,
        code:
          first.movement.id === transactionId
            ? "INSUFFICIENT_FUNDS"
            : "HISTORY_CONFLICT",
        message:
          "Transfer ini membuat dana tersedia negatif pada tanggal efektif atau transaksi berikutnya. Lengkapi riwayat dana atau koreksi tanggal/jumlahnya.",
        at: formatLedgerPoint(first.movement.key),
        needed: (first.movement.delta < BigInt(0)
          ? -first.movement.delta
          : BigInt(0)
        ).toString(),
        available: first.availableBefore.toString(),
        unit: "IDR",
        conflicts: violations.map((v) => ({
          transactionId: v.movement.transactionId,
          date: formatLedgerPoint(v.movement.key),
          reason: v.description,
        })),
      });
  }
}
