import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";

export async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
  });

  // ── Family Group ────────────────────────────────────────────────────────────

  const family = await prisma.familyGroup.upsert({
    where: { id: "seed-family-arsandi" },
    update: { name: "Arsandi Family" },
    create: { id: "seed-family-arsandi", name: "Arsandi Family" },
  });

  // ── User ────────────────────────────────────────────────────────────────────

  const user = await prisma.user.upsert({
    where: { email: "irfan.arsandi@wealthme.id" },
    update: {
      name: "Irfan Arsandi",
      avatarInitials: "IA",
    },
    create: {
      id: "seed-user-irfan",
      email: "irfan.arsandi@wealthme.id",
      name: "Irfan Arsandi",
      avatarInitials: "IA",
      passwordHash,
    },
  });

  // ── Member ──────────────────────────────────────────────────────────────────

  await prisma.member.upsert({
    where: {
      userId_familyGroupId: {
        userId: user.id,
        familyGroupId: family.id,
      },
    },
    update: { role: "owner" },
    create: {
      id: "seed-member-irfan-arsandi",
      userId: user.id,
      familyGroupId: family.id,
      role: "owner",
    },
  });

  // ── Demo User (demo@wealthme.id) ─────────────────────────────────────────────
  // Required for the login page demo credentials to work with Better Auth.
  // Better Auth credential login needs: User + BaAccount(providerId=credential).

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@wealthme.id" },
    update: { name: "Demo User", avatarInitials: "DU" },
    create: {
      id: "seed-user-demo",
      email: "demo@wealthme.id",
      name: "Demo User",
      avatarInitials: "DU",
      passwordHash,
    },
  });

  await prisma.baAccount.upsert({
    where: { id: "seed-ba-demo" },
    update: { password: passwordHash },
    create: {
      id: "seed-ba-demo",
      accountId: "demo@wealthme.id",
      providerId: "credential",
      userId: demoUser.id,
      password: passwordHash,
    },
  });

  await prisma.member.upsert({
    where: {
      userId_familyGroupId: {
        userId: demoUser.id,
        familyGroupId: family.id,
      },
    },
    update: { role: "owner" },
    create: {
      id: "seed-member-demo",
      userId: demoUser.id,
      familyGroupId: family.id,
      role: "owner",
    },
  });

  // ── Accounts ─────────────────────────────────────────────────────────────────
  // Balances in rupiah (BigInt) — from SEARCH_DATA in apps/web/src/lib/data.ts

  const bcaAccount = await prisma.account.upsert({
    where: {
      familyGroupId_name: {
        familyGroupId: family.id,
        name: "BCA Tahapan ···9010",
      },
    },
    update: { balance: 128_450_000n },
    create: {
      id: "seed-account-bca",
      familyGroupId: family.id,
      name: "BCA Tahapan ···9010",
      type: "bank",
      institution: "BCA",
      maskedNumber: "···9010",
      balance: 128_450_000n,
      currency: "IDR",
    },
  });

  const mandiriAccount = await prisma.account.upsert({
    where: {
      familyGroupId_name: {
        familyGroupId: family.id,
        name: "Mandiri ···5586",
      },
    },
    update: { balance: 85_000_000n },
    create: {
      id: "seed-account-mandiri",
      familyGroupId: family.id,
      name: "Mandiri ···5586",
      type: "bank",
      institution: "Mandiri",
      maskedNumber: "···5586",
      balance: 85_000_000n,
      currency: "IDR",
    },
  });

  const gopayAccount = await prisma.account.upsert({
    where: {
      familyGroupId_name: {
        familyGroupId: family.id,
        name: "GoPay",
      },
    },
    update: { balance: 45_000_000n },
    create: {
      id: "seed-account-gopay",
      familyGroupId: family.id,
      name: "GoPay",
      type: "ewallet",
      institution: "Gojek",
      maskedNumber: null,
      balance: 45_000_000n,
      currency: "IDR",
    },
  });

  // ── Categories ───────────────────────────────────────────────────────────────

  const catGaji = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Gaji",
        kind: "income",
      },
    },
    update: {},
    create: {
      id: "seed-cat-gaji",
      familyGroupId: family.id,
      name: "Gaji",
      kind: "income",
      color: "#22c55e",
      icon: "Banknote",
    },
  });

  const catMakan = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Makan & Minum",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-makan",
      familyGroupId: family.id,
      name: "Makan & Minum",
      kind: "expense",
      color: "#f97316",
      icon: "UtensilsCrossed",
    },
  });

  const catLifestyle = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Lifestyle",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-lifestyle",
      familyGroupId: family.id,
      name: "Lifestyle",
      kind: "expense",
      color: "#a855f7",
      icon: "ShoppingBag",
    },
  });

  // ── Additional Categories ────────────────────────────────────────────────────

  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Makanan & Minuman",
        kind: "expense",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Makanan & Minuman",
      kind: "expense",
      icon: "🍜",
      color: "#EF4444",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Transportasi",
        kind: "expense",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Transportasi",
      kind: "expense",
      icon: "🚗",
      color: "#F97316",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Belanja",
        kind: "expense",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Belanja",
      kind: "expense",
      icon: "🛍️",
      color: "#8B5CF6",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Tagihan & Utilitas",
        kind: "expense",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Tagihan & Utilitas",
      kind: "expense",
      icon: "💡",
      color: "#EAB308",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Kesehatan",
        kind: "expense",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Kesehatan",
      kind: "expense",
      icon: "🏥",
      color: "#10B981",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Hiburan",
        kind: "expense",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Hiburan",
      kind: "expense",
      icon: "🎬",
      color: "#06B6D4",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Pendidikan",
        kind: "expense",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Pendidikan",
      kind: "expense",
      icon: "📚",
      color: "#3B82F6",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Lainnya Pengeluaran",
        kind: "expense",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Lainnya Pengeluaran",
      kind: "expense",
      icon: "📦",
      color: "#6B7280",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Investasi",
        kind: "income",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Investasi",
      kind: "income",
      icon: "📈",
      color: "#3B82F6",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Transfer Masuk",
        kind: "income",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Transfer Masuk",
      kind: "income",
      icon: "📥",
      color: "#8B5CF6",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: family.id,
        name: "Lainnya Pemasukan",
        kind: "income",
      },
    },
    update: {},
    create: {
      familyGroupId: family.id,
      name: "Lainnya Pemasukan",
      kind: "income",
      icon: "📦",
      color: "#6B7280",
    },
  });

  // ── Transactions ─────────────────────────────────────────────────────────────
  // Amounts in rupiah (BigInt). Dates are relative to "now" so the dashboard
  // (which only looks at the last 6 months / 30 days) always has data.
  // Monthly cashflow: income ~25_850_000, expense ~18_340_000 (from data.ts CASHFLOW).

  const now = new Date();
  const daysAgo = (n: number): Date => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(12, 0, 0, 0);
    return d;
  };

  await prisma.transaction.upsert({
    where: { id: "seed-tx-gaji-apr-2025" },
    update: { occurredAt: daysAgo(28), description: "Gaji bulanan" },
    create: {
      id: "seed-tx-gaji-apr-2025",
      familyGroupId: family.id,
      accountId: bcaAccount.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji bulanan",
      occurredAt: daysAgo(28),
    },
  });

  await prisma.transaction.upsert({
    where: { id: "seed-tx-makan-apr-2025-a" },
    update: { occurredAt: daysAgo(24) },
    create: {
      id: "seed-tx-makan-apr-2025-a",
      familyGroupId: family.id,
      accountId: gopayAccount.id,
      categoryId: catMakan.id,
      amount: 850_000n,
      type: "expense",
      description: "Makan siang & malam minggu ke-1",
      occurredAt: daysAgo(24),
    },
  });

  await prisma.transaction.upsert({
    where: { id: "seed-tx-lifestyle-apr-2025-a" },
    update: { occurredAt: daysAgo(19) },
    create: {
      id: "seed-tx-lifestyle-apr-2025-a",
      familyGroupId: family.id,
      accountId: mandiriAccount.id,
      categoryId: catLifestyle.id,
      amount: 4_580_000n,
      type: "expense",
      description: "Belanja online lifestyle",
      occurredAt: daysAgo(19),
    },
  });

  await prisma.transaction.upsert({
    where: { id: "seed-tx-makan-apr-2025-b" },
    update: { occurredAt: daysAgo(13) },
    create: {
      id: "seed-tx-makan-apr-2025-b",
      familyGroupId: family.id,
      accountId: gopayAccount.id,
      categoryId: catMakan.id,
      amount: 720_000n,
      type: "expense",
      description: "Makan minggu ke-2",
      occurredAt: daysAgo(13),
    },
  });

  await prisma.transaction.upsert({
    where: { id: "seed-tx-makan-apr-2025-c" },
    update: { occurredAt: daysAgo(7) },
    create: {
      id: "seed-tx-makan-apr-2025-c",
      familyGroupId: family.id,
      accountId: gopayAccount.id,
      categoryId: catMakan.id,
      amount: 630_000n,
      type: "expense",
      description: "Makan minggu ke-3",
      occurredAt: daysAgo(7),
    },
  });

  await prisma.transaction.upsert({
    where: { id: "seed-tx-lifestyle-apr-2025-b" },
    update: { occurredAt: daysAgo(2) },
    create: {
      id: "seed-tx-lifestyle-apr-2025-b",
      familyGroupId: family.id,
      accountId: mandiriAccount.id,
      categoryId: catLifestyle.id,
      amount: 2_400_000n,
      type: "expense",
      description: "Langganan & hiburan",
      occurredAt: daysAgo(2),
    },
  });

  // ── Goals ────────────────────────────────────────────────────────────────────
  // Amounts in rupiah (BigInt) — mirror the original demo goals.

  const goalSeeds = [
    {
      id: "seed-goal-dana-darurat",
      name: "Dana Darurat",
      icon: "🛡️",
      targetAmount: 30_000_000n,
      currentAmount: 24_000_000n,
      status: "on_track",
      autoDebitAmount: 1_000_000n,
    },
    {
      id: "seed-goal-liburan-jepang",
      name: "Liburan Jepang",
      icon: "✈️",
      targetAmount: 25_000_000n,
      currentAmount: 15_600_000n,
      status: "on_track",
      autoDebitAmount: null,
    },
    {
      id: "seed-goal-dp-rumah",
      name: "DP Rumah",
      icon: "🏠",
      targetAmount: 300_000_000n,
      currentAmount: 120_000_000n,
      status: "needs_boost",
      autoDebitAmount: 5_000_000n,
    },
    {
      id: "seed-goal-dana-pensiun",
      name: "Dana Pensiun",
      icon: "🏖️",
      targetAmount: 1_000_000_000n,
      currentAmount: 250_000_000n,
      status: "at_risk",
      autoDebitAmount: null,
    },
  ] as const;

  for (const g of goalSeeds) {
    await prisma.goal.upsert({
      where: { id: g.id },
      update: {
        currentAmount: g.currentAmount,
        targetAmount: g.targetAmount,
        status: g.status,
      },
      create: {
        id: g.id,
        familyGroupId: family.id,
        name: g.name,
        icon: g.icon,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        status: g.status,
        autoDebitAmount: g.autoDebitAmount,
        targetDate: daysAgo(-365),
      },
    });
  }

  process.stdout.write(
    `Seed complete:\n` +
      `  FamilyGroup: ${family.name} (${family.id})\n` +
      `  Users: ${user.name} <${user.email}>, ${demoUser.name} <${demoUser.email}>\n` +
      `  BaAccount: credential login seeded for demo@wealthme.id\n` +
      `  Accounts: BCA, Mandiri, GoPay\n` +
      `  Categories: Gaji, Makan & Minum, Lifestyle + full set (11 additional)\n` +
      `  Transactions: 6 records seeded (dates relative to today)\n` +
      `  Goals: ${goalSeeds.length} records seeded\n`,
  );
}

if (require.main === module) {
  main()
    .catch((err: unknown) => {
      process.stderr.write(`Seed failed: ${String(err)}\n`);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
