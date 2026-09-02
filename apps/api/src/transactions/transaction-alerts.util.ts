import { Logger } from "@nestjs/common";

import { budgetSpendWindow } from "../common/utils/budget-period.util";
import {
  ownerNotifPrefs,
  resolveNotifPrefs,
} from "../notifications/notification-prefs";

import type { NotificationSenderPort } from "../notifications/notification-sender.port";
import type { PrismaService } from "../prisma/prisma.service";
import type { BudgetPeriod } from "@wealthme/contracts";

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
      select: {
        id: true,
        limitAmount: true,
        liabilityId: true,
        period: true,
        createdAt: true,
      },
    });
    if (!budget || budget.limitAmount <= BigInt(0)) return;

    // EPIC-022 C1/C3 — the spend window follows the budget's OWN `period`
    // (weekly/monthly/yearly), clamped to its `createdAt` (C3), instead of a
    // hardcoded calendar month — same window `BudgetsService.findAll` uses,
    // so the /anggaran page and this alert never disagree about "how over
    // budget" a category is.
    const { start, end } = budgetSpendWindow(
      budget.period as BudgetPeriod,
      budget.createdAt,
    );

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
        occurredAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const spent = agg._sum.amount ?? BigInt(0);
    const usagePct = Number((spent * BigInt(100)) / budget.limitAmount);
    if (usagePct < 80) return;

    const category = await prisma.category.findUnique({
      where: { id: categoryId, familyGroupId },
      select: { name: true },
    });
    const rawName = category?.name ?? "kategori ini";

    // C4 — fire the 80%/100% alert ONCE per budget per period, not on every
    // subsequent transaction for the rest of the period. No `Notification.
    // budgetId` column exists (adding one is a migration, out of scope for
    // C1-C9) so this matches the exact icon + category-name substring this
    // function itself writes below, scoped to the current window's start.
    // ponytail: a category name that is a substring of another category's
    // name could false-dedupe two DIFFERENT budgets' alerts; add a real
    // `budgetId` column on Notification if that collision ever matters.
    const alreadyAlerted = await prisma.notification.findFirst({
      where: {
        familyGroupId,
        icon: "💸",
        body: { contains: rawName },
        createdAt: { gte: start },
      },
    });
    if (alreadyAlerted) return;

    const owner = await prisma.member.findFirst({
      where: { familyGroupId, role: "owner" },
      include: {
        user: {
          select: { email: true, name: true, notificationPrefs: true },
        },
      },
    });
    if (!owner) return;
    if (!resolveNotifPrefs(owner.user.notificationPrefs).budget80) return;

    // The in-app notification (`prisma.notification.create` below) is
    // rendered as plain React text — never HTML — so it must use the raw
    // category name. `safeName` is HTML-escaped and stays scoped to the
    // EMAIL body only; reusing it for the in-app title/body previously made
    // "Makan & Minum" literally display as "Makan &amp; Minum" in
    // /notifikasi (found during EPIC-025 N3 fidelity audit).
    const safeName = escapeHtml(rawName);
    const subject =
      usagePct >= 100
        ? `Anggaran ${rawName} terlampaui!`
        : `Anggaran ${rawName} sudah ${usagePct}%`;
    const emailSubject =
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
        emailSubject,
        htmlBody,
      ),
      prisma.notification.create({
        data: {
          familyGroupId,
          title: subject,
          body: `Pengeluaran ${rawName} sudah ${usagePct}% dari anggaran bulan ini.`,
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
