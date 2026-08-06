import { Logger } from "@nestjs/common";

import {
  ownerNotifPrefs,
  resolveNotifPrefs,
} from "../notifications/notification-prefs";

import type { NotificationSenderPort } from "../notifications/notification-sender.port";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * EPIC-023 group E retry (HIGH 3) — extracted from `TransactionsService` so
 * `LiabilitiesService.purchase()` can fire the SAME notifications, budget
 * alert, and cash-flow alert every other expense-shaped write already gets,
 * instead of silently skipping all four (the original defect: a card
 * purchase raised no owner notification, no budget alert, and recorded no
 * `createdByUserId`). Kept as plain functions (not methods) so both services
 * depend on one definition without one importing the other's private
 * methods.
 */

const logger = new Logger("TransactionAlerts");

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Mirrors the pre-extraction `TransactionsService.checkBudgetAlert`. */
export async function checkBudgetAlert(
  prisma: PrismaService,
  notificationSender: NotificationSenderPort,
  familyGroupId: string,
  categoryId: string,
): Promise<void> {
  try {
    const budget = await prisma.budget.findFirst({
      where: { familyGroupId, categoryId },
      select: { id: true, limitAmount: true, liabilityId: true },
    });
    if (!budget || budget.limitAmount <= BigInt(0)) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // H5 (group E retry round 4) — a liability's OWN principal budget line
    // (`Budget.liabilityId` set, HIGH 4/E2) posts its spend as `type:
    // "transfer"` (E1 — a principal payment moves cash into paying down
    // debt, not a P&L expense; `BudgetsService.findAll` sums it the SAME
    // way, C5). Hardcoding `type: "expense"` here always summed 0 for such
    // a line, however over-budget it actually was, so it could never raise
    // an 80%/100% alert — the budget PAGE and the ALERT system disagreed
    // about what spend counted. An insurance premium line is unaffected —
    // it always posts as `type: "expense"`, same as every ordinary budget.
    const spendType = budget.liabilityId ? "transfer" : "expense";
    const agg = await prisma.transaction.aggregate({
      where: {
        familyGroupId,
        categoryId,
        type: spendType,
        occurredAt: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    });

    const spent = agg._sum.amount ?? BigInt(0);
    const usagePct = Number((spent * BigInt(100)) / budget.limitAmount);
    if (usagePct < 80) return;

    const [owner, category] = await Promise.all([
      prisma.member.findFirst({
        where: { familyGroupId, role: "owner" },
        include: {
          user: {
            select: { email: true, name: true, notificationPrefs: true },
          },
        },
      }),
      prisma.category.findUnique({
        where: { id: categoryId, familyGroupId },
        select: { name: true },
      }),
    ]);
    if (!owner) return;
    if (!resolveNotifPrefs(owner.user.notificationPrefs).budget80) return;

    const safeName = escapeHtml(category?.name ?? "kategori ini");
    const subject =
      usagePct >= 100
        ? `Anggaran ${safeName} terlampaui!`
        : `Anggaran ${safeName} sudah ${usagePct}%`;
    const htmlBody = `<p>Halo ${escapeHtml(owner.user.name)},</p>
<p>Pengeluaran untuk <strong>${safeName}</strong> bulan ini telah mencapai <strong>${usagePct}%</strong> dari anggaran.</p>
<p>Segera tinjau anggaran Anda di WealthMe.</p>`;

    await Promise.all([
      notificationSender.sendEmail(
        owner.user.email,
        owner.user.name,
        subject,
        htmlBody,
      ),
      prisma.notification.create({
        data: {
          familyGroupId,
          title: subject,
          body: `Pengeluaran ${safeName} sudah ${usagePct}% dari anggaran bulan ini.`,
          icon: "💸",
        },
      }),
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Budget alert skipped: ${msg}`);
  }
}

/** Mirrors the pre-extraction `TransactionsService.checkCashFlowAlert`. */
export async function checkCashFlowAlert(
  prisma: PrismaService,
  familyGroupId: string,
): Promise<void> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          familyGroupId,
          type: "income",
          occurredAt: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          familyGroupId,
          type: "expense",
          occurredAt: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
    ]);

    const income = incomeAgg._sum.amount ?? BigInt(0);
    const expense = expenseAgg._sum.amount ?? BigInt(0);

    if (income <= BigInt(0)) return;

    const usagePct = Number((expense * BigInt(100)) / income);
    if (usagePct < 80) return;

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const existing = await prisma.notification.findFirst({
      where: { familyGroupId, icon: "⚠️", createdAt: { gte: today } },
    });
    if (existing) return;

    const title =
      usagePct >= 100
        ? "Pengeluaran Melebihi Pemasukan!"
        : `Pengeluaran Bulan Ini Sudah ${usagePct}%`;
    const body =
      usagePct >= 100
        ? `Pengeluaran bulan ini sudah ${usagePct}% dari total pemasukan. Kurangi pengeluaran segera.`
        : `Pengeluaran bulan ini sudah ${usagePct}% dari total pemasukan. Pantau pengeluaranmu.`;

    await prisma.notification.create({
      data: { familyGroupId, title, body, icon: "⚠️" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Cash flow alert skipped: ${msg}`);
  }
}

/** Mirrors the pre-extraction `TransactionsService.notifyTransaction`. */
export async function notifyTransaction(
  prisma: PrismaService,
  familyGroupId: string,
  type: string,
  amount: bigint,
  tx: { category: { name: string } | null; account: { name: string } | null },
  bigThreshold: bigint = BigInt(5_000_000),
): Promise<void> {
  try {
    const isIncome = type === "income";
    const isExpense = type === "expense";
    if (!isIncome && !isExpense) return;

    const prefs = await ownerNotifPrefs(prisma, familyGroupId);
    const isBig = amount >= bigThreshold;
    const wantByType = isIncome ? prefs.txnIn : prefs.txnOut;
    if (!wantByType && !(isBig && prefs.txnBig)) return;

    const label = isIncome ? "Transaksi masuk" : "Transaksi keluar";
    const catName = tx.category?.name ?? "Tanpa kategori";
    await prisma.notification.create({
      data: {
        familyGroupId,
        title: isBig ? `${label} besar` : label,
        body: `${label} Rp ${amount.toString()} — ${catName}`,
        icon: isIncome ? "📥" : "📤",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Transaction notification skipped: ${msg}`);
  }
}
