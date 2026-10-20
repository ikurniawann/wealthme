import { BadRequestException } from "@nestjs/common";

import { floatingCashInstant } from "../../investments/ledger/ledger-dates";
import {
  assertUsableCashAccount,
  lockAccounts,
} from "../../investments/ledger/ledger-support";
import { cashIdr } from "../../investments/ledger/replay";

import type { AssetActor } from "./asset-ledger-support";
import type { TxClient } from "../../common/utils/serializable-retry.util";
import type { ProposedRow } from "../../investments/ledger/ledger-input";
import type { Asset, AssetTransaction } from "@prisma/client";

/**
 * Aset A5 — the cash leg of an asset buy/sell, same shape as the Investasi
 * ledger: a buy is a one-sided TRANSFER out of the paying account (an
 * allocation into the asset, never an expense), a sell a one-sided TRANSFER
 * in of the net proceeds (realized P/L lives on the asset row, not in
 * income). An opening never moves cash. Valuations never come here.
 *
 * Floor: the account rows are locked FOR UPDATE inside the caller's
 * Serializable transaction; a bank account may not go below zero (the
 * EPIC-021 #22 rule every debit already follows).
 */

interface Leg {
  accountId: string;
  /** Signed IDR effect on the account balance. */
  delta: bigint;
}

export function legOfRow(row: ProposedRow): Leg | null {
  if (!row.cashAccountId || row.kind === "opening") return null;
  const amount = cashIdr(row.netAmount, row.currency, row.fxRate);
  if (amount === null || amount === 0n) return null;
  return {
    accountId: row.cashAccountId,
    delta: row.kind === "buy" ? -amount : amount,
  };
}

async function storedLeg(
  tx: TxClient,
  t: AssetTransaction | null,
): Promise<(Leg & { cashTransactionId: string }) | null> {
  if (!t?.cashAccountId || !t.cashTransactionId) return null;
  const cash = await tx.transaction.findUnique({
    where: { id: t.cashTransactionId },
    select: { amount: true },
  });
  if (!cash) return null;
  return {
    accountId: t.cashAccountId,
    delta: t.kind === "buy" ? -cash.amount : cash.amount,
    cashTransactionId: t.cashTransactionId,
  };
}

/**
 * Moves the cash for a create / edit / void. Returns the linked cash
 * Transaction id to store on the asset row (null when nothing moves).
 */
export async function applyCashLeg(
  tx: TxClient,
  p: {
    familyGroupId: string;
    asset: Asset;
    existing: AssetTransaction | null;
    row: ProposedRow | null;
    actor: AssetActor;
  },
): Promise<string | null> {
  const oldLeg = await storedLeg(tx, p.existing);
  const newLeg = p.row ? legOfRow(p.row) : null;
  const ids = [
    ...new Set(
      [oldLeg?.accountId, newLeg?.accountId].filter((v): v is string => !!v),
    ),
  ].sort();
  const accounts = await lockAccounts(tx, p.familyGroupId, ids);
  if (newLeg) {
    await assertUsableCashAccount(
      tx,
      accounts.get(newLeg.accountId),
      p.actor,
      null,
    );
  }
  if (oldLeg && oldLeg.accountId !== newLeg?.accountId) {
    await assertUsableCashAccount(
      tx,
      accounts.get(oldLeg.accountId),
      p.actor,
      null,
    );
  }
  for (const id of ids) {
    const acc = accounts.get(id)!;
    const net =
      (newLeg?.accountId === id ? newLeg.delta : 0n) -
      (oldLeg?.accountId === id ? oldLeg.delta : 0n);
    if (net < 0n && acc.type === "bank" && acc.balance + net < 0n) {
      throw new BadRequestException(
        `Saldo rekening bank "${acc.name}" tidak mencukupi (saldo Rp ${acc.balance.toString()}, dibutuhkan Rp ${(-net).toString()}). Rekening bank tidak boleh memiliki saldo minus.`,
      );
    }
  }

  const sameLeg = oldLeg && newLeg && oldLeg.accountId === newLeg.accountId;
  if (oldLeg && !sameLeg) {
    await tx.transaction.delete({ where: { id: oldLeg.cashTransactionId } });
    await tx.account.update({
      where: { id: oldLeg.accountId, familyGroupId: p.familyGroupId },
      data: { balance: { increment: -oldLeg.delta } },
    });
  }
  if (!newLeg || !p.row) return null;

  const amount = newLeg.delta < 0n ? -newLeg.delta : newLeg.delta;
  // Floating, like every Transaction.occurredAt: lists bucket rows by the
  // UTC day, so a date-only trade must land on its own calendar date.
  const occurredAt = floatingCashInstant(
    p.row.effectiveDate,
    p.row.effectiveTime,
    p.row.timeZone,
  );
  const verb = p.row.kind === "buy" ? "Beli" : "Jual";
  const unit = p.asset.unit ? ` ${p.asset.unit}` : "";
  const description = `${verb} aset ${p.asset.name} (${p.row.quantity.toString()}${unit} @ ${p.row.pricePerUnit.toString()} ${p.row.currency})`;
  if (sameLeg) {
    await tx.transaction.update({
      where: { id: oldLeg.cashTransactionId },
      data: { amount, description, occurredAt },
    });
    if (newLeg.delta !== oldLeg.delta) {
      await tx.account.update({
        where: { id: newLeg.accountId, familyGroupId: p.familyGroupId },
        data: { balance: { increment: newLeg.delta - oldLeg.delta } },
      });
    }
    return oldLeg.cashTransactionId;
  }
  const created = await tx.transaction.create({
    data: {
      familyGroupId: p.familyGroupId,
      accountId: newLeg.delta < 0n ? newLeg.accountId : null,
      toAccountId: newLeg.delta > 0n ? newLeg.accountId : null,
      categoryId: null,
      type: "transfer",
      amount,
      description,
      occurredAt,
      createdByUserId: p.actor.userId,
    },
    select: { id: true },
  });
  await tx.account.update({
    where: { id: newLeg.accountId, familyGroupId: p.familyGroupId },
    data: { balance: { increment: newLeg.delta } },
  });
  return created.id;
}
