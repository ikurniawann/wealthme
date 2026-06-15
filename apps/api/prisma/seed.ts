import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";
const FG = "seed-fg-demo";

export async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
  });

  const now = new Date();
  const daysAgo = (n: number): Date => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(10, 0, 0, 0);
    return d;
  };
  const monthsAgo = (m: number, day = 1): Date => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - m, day);
    d.setHours(10, 0, 0, 0);
    return d;
  };
  const futureDate = (days: number): Date => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };

  // ── Family Group ─────────────────────────────────────────────────────────────

  const family = await prisma.familyGroup.upsert({
    where: { id: FG },
    update: { name: "Keluarga Demo" },
    create: { id: FG, name: "Keluarga Demo" },
  });

  // ── Demo User + BaAccount ─────────────────────────────────────────────────────

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
      userId_familyGroupId: { userId: demoUser.id, familyGroupId: family.id },
    },
    update: { role: "owner" },
    create: {
      id: "seed-member-demo",
      userId: demoUser.id,
      familyGroupId: family.id,
      role: "owner",
    },
  });

  // ── Accounts ──────────────────────────────────────────────────────────────────

  const acBCA = await prisma.account.upsert({
    where: {
      familyGroupId_name: { familyGroupId: FG, name: "BCA Tahapan ···9010" },
    },
    update: { balance: 128_450_000n },
    create: {
      id: "seed-ac-bca",
      familyGroupId: FG,
      name: "BCA Tahapan ···9010",
      type: "bank",
      institution: "BCA",
      maskedNumber: "···9010",
      balance: 128_450_000n,
      currency: "IDR",
    },
  });

  const acMandiri = await prisma.account.upsert({
    where: {
      familyGroupId_name: { familyGroupId: FG, name: "Mandiri ···5586" },
    },
    update: { balance: 85_200_000n },
    create: {
      id: "seed-ac-mandiri",
      familyGroupId: FG,
      name: "Mandiri ···5586",
      type: "bank",
      institution: "Mandiri",
      maskedNumber: "···5586",
      balance: 85_200_000n,
      currency: "IDR",
    },
  });

  const acBNI = await prisma.account.upsert({
    where: { familyGroupId_name: { familyGroupId: FG, name: "BNI ···2234" } },
    update: { balance: 32_000_000n },
    create: {
      id: "seed-ac-bni",
      familyGroupId: FG,
      name: "BNI ···2234",
      type: "bank",
      institution: "BNI",
      maskedNumber: "···2234",
      balance: 32_000_000n,
      currency: "IDR",
    },
  });

  const acGoPay = await prisma.account.upsert({
    where: { familyGroupId_name: { familyGroupId: FG, name: "GoPay" } },
    update: { balance: 2_450_000n },
    create: {
      id: "seed-ac-gopay",
      familyGroupId: FG,
      name: "GoPay",
      type: "ewallet",
      institution: "Gojek",
      maskedNumber: null,
      balance: 2_450_000n,
      currency: "IDR",
    },
  });

  const acOVO = await prisma.account.upsert({
    where: { familyGroupId_name: { familyGroupId: FG, name: "OVO" } },
    update: { balance: 1_200_000n },
    create: {
      id: "seed-ac-ovo",
      familyGroupId: FG,
      name: "OVO",
      type: "ewallet",
      institution: "OVO",
      maskedNumber: null,
      balance: 1_200_000n,
      currency: "IDR",
    },
  });

  const acCash = await prisma.account.upsert({
    where: { familyGroupId_name: { familyGroupId: FG, name: "Kas Tunai" } },
    update: { balance: 3_000_000n },
    create: {
      id: "seed-ac-cash",
      familyGroupId: FG,
      name: "Kas Tunai",
      type: "cash",
      institution: null,
      maskedNumber: null,
      balance: 3_000_000n,
      currency: "IDR",
    },
  });

  // ── Categories ────────────────────────────────────────────────────────────────

  const catGaji = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Gaji",
        kind: "income",
      },
    },
    update: {},
    create: {
      id: "seed-d-cat-gaji",
      familyGroupId: FG,
      name: "Gaji",
      kind: "income",
      icon: "💼",
      color: "#22c55e",
    },
  });
  const catBonus = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Bonus",
        kind: "income",
      },
    },
    update: {},
    create: {
      id: "seed-cat-bonus",
      familyGroupId: FG,
      name: "Bonus",
      kind: "income",
      icon: "🎁",
      color: "#16a34a",
    },
  });
  const catFreelance = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Freelance",
        kind: "income",
      },
    },
    update: {},
    create: {
      id: "seed-cat-freelance",
      familyGroupId: FG,
      name: "Freelance",
      kind: "income",
      icon: "💻",
      color: "#15803d",
    },
  });
  const catInvestasi = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Hasil Investasi",
        kind: "income",
      },
    },
    update: {},
    create: {
      id: "seed-cat-investasi-in",
      familyGroupId: FG,
      name: "Hasil Investasi",
      kind: "income",
      icon: "📈",
      color: "#3b82f6",
    },
  });
  await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Lainnya Pemasukan",
        kind: "income",
      },
    },
    update: {},
    create: {
      id: "seed-cat-lain-in",
      familyGroupId: FG,
      name: "Lainnya Pemasukan",
      kind: "income",
      icon: "📦",
      color: "#6b7280",
    },
  });

  const catMakan = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Makan & Minum",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-d-cat-makan",
      familyGroupId: FG,
      name: "Makan & Minum",
      kind: "expense",
      icon: "🍜",
      color: "#f97316",
    },
  });
  const catTransport = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Transportasi",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-transport",
      familyGroupId: FG,
      name: "Transportasi",
      kind: "expense",
      icon: "🚗",
      color: "#f59e0b",
    },
  });
  const catBelanja = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Belanja",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-belanja",
      familyGroupId: FG,
      name: "Belanja",
      kind: "expense",
      icon: "🛍️",
      color: "#8b5cf6",
    },
  });
  const catTagihan = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Tagihan & Utilitas",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-tagihan",
      familyGroupId: FG,
      name: "Tagihan & Utilitas",
      kind: "expense",
      icon: "💡",
      color: "#eab308",
    },
  });
  const catKesehatan = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Kesehatan",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-kesehatan",
      familyGroupId: FG,
      name: "Kesehatan",
      kind: "expense",
      icon: "🏥",
      color: "#10b981",
    },
  });
  const catHiburan = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Hiburan",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-hiburan",
      familyGroupId: FG,
      name: "Hiburan",
      kind: "expense",
      icon: "🎬",
      color: "#06b6d4",
    },
  });
  const catPendidikan = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Pendidikan",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-pendidikan",
      familyGroupId: FG,
      name: "Pendidikan",
      kind: "expense",
      icon: "📚",
      color: "#3b82f6",
    },
  });
  const catKPR = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Cicilan KPR",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-kpr",
      familyGroupId: FG,
      name: "Cicilan KPR",
      kind: "expense",
      icon: "🏠",
      color: "#dc2626",
    },
  });
  const catInvestasiEx = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Tabungan & Investasi",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-investasi-ex",
      familyGroupId: FG,
      name: "Tabungan & Investasi",
      kind: "expense",
      icon: "💰",
      color: "#0891b2",
    },
  });
  const catLainPengeluaran = await prisma.category.upsert({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Lainnya Pengeluaran",
        kind: "expense",
      },
    },
    update: {},
    create: {
      id: "seed-cat-lain-ex",
      familyGroupId: FG,
      name: "Lainnya Pengeluaran",
      kind: "expense",
      icon: "📦",
      color: "#6b7280",
    },
  });

  // ── Transactions — 6 bulan (month 0 = current, month 5 = 5 bulan lalu) ────────

  type TxSeed = {
    id: string;
    accountId: string;
    categoryId: string;
    amount: bigint;
    type: "income" | "expense" | "transfer";
    description: string;
    occurredAt: Date;
  };

  const txSeeds: TxSeed[] = [
    // ── Bulan ini (0) ──────────────────────────────────
    {
      id: "seed-tx-gaji-m0",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji bulan ini",
      occurredAt: monthsAgo(0, 1),
    },
    {
      id: "seed-tx-kpr-m0",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(0, 5),
    },
    {
      id: "seed-tx-makan-m0a",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 380_000n,
      type: "expense",
      description: "Makan siang kantor",
      occurredAt: daysAgo(2),
    },
    {
      id: "seed-tx-transport-m0",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 220_000n,
      type: "expense",
      description: "Ojek & bensin",
      occurredAt: daysAgo(3),
    },
    {
      id: "seed-tx-tagihan-m0",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 850_000n,
      type: "expense",
      description: "Listrik, air, internet",
      occurredAt: daysAgo(5),
    },
    {
      id: "seed-tx-belanja-m0",
      accountId: acOVO.id,
      categoryId: catBelanja.id,
      amount: 650_000n,
      type: "expense",
      description: "Belanja Tokopedia",
      occurredAt: daysAgo(6),
    },
    {
      id: "seed-tx-investasi-m0",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: daysAgo(7),
    },

    // ── Bulan lalu (1) ─────────────────────────────────
    {
      id: "seed-tx-gaji-m1",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji bulan lalu",
      occurredAt: monthsAgo(1, 1),
    },
    {
      id: "seed-tx-kpr-m1",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(1, 5),
    },
    {
      id: "seed-tx-makan-m1a",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 420_000n,
      type: "expense",
      description: "Makan keluarga",
      occurredAt: monthsAgo(1, 8),
    },
    {
      id: "seed-tx-makan-m1b",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 195_000n,
      type: "expense",
      description: "Kopi & snack",
      occurredAt: monthsAgo(1, 14),
    },
    {
      id: "seed-tx-transport-m1",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 310_000n,
      type: "expense",
      description: "BBM + parkir",
      occurredAt: monthsAgo(1, 10),
    },
    {
      id: "seed-tx-tagihan-m1",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 920_000n,
      type: "expense",
      description: "Listrik, air, Telkom",
      occurredAt: monthsAgo(1, 7),
    },
    {
      id: "seed-tx-belanja-m1",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 1_350_000n,
      type: "expense",
      description: "Belanja bulanan supermarket",
      occurredAt: monthsAgo(1, 15),
    },
    {
      id: "seed-tx-hiburan-m1",
      accountId: acOVO.id,
      categoryId: catHiburan.id,
      amount: 230_000n,
      type: "expense",
      description: "Netflix + Spotify",
      occurredAt: monthsAgo(1, 2),
    },
    {
      id: "seed-tx-kesehatan-m1",
      accountId: acBNI.id,
      categoryId: catKesehatan.id,
      amount: 450_000n,
      type: "expense",
      description: "Apotik & vitamin",
      occurredAt: monthsAgo(1, 20),
    },
    {
      id: "seed-tx-investasi-m1",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(1, 5),
    },
    {
      id: "seed-tx-freelance-m1",
      accountId: acMandiri.id,
      categoryId: catFreelance.id,
      amount: 4_500_000n,
      type: "income",
      description: "Proyek desain website",
      occurredAt: monthsAgo(1, 18),
    },

    // ── 2 Bulan lalu ───────────────────────────────────
    {
      id: "seed-tx-gaji-m2",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji",
      occurredAt: monthsAgo(2, 1),
    },
    {
      id: "seed-tx-kpr-m2",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(2, 5),
    },
    {
      id: "seed-tx-bonus-m2",
      accountId: acBCA.id,
      categoryId: catBonus.id,
      amount: 5_000_000n,
      type: "income",
      description: "Bonus kuartal",
      occurredAt: monthsAgo(2, 10),
    },
    {
      id: "seed-tx-makan-m2a",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 540_000n,
      type: "expense",
      description: "Dinner keluarga",
      occurredAt: monthsAgo(2, 12),
    },
    {
      id: "seed-tx-makan-m2b",
      accountId: acCash.id,
      categoryId: catMakan.id,
      amount: 185_000n,
      type: "expense",
      description: "Sarapan & makan siang",
      occurredAt: monthsAgo(2, 20),
    },
    {
      id: "seed-tx-transport-m2",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 280_000n,
      type: "expense",
      description: "Grab + Ojek",
      occurredAt: monthsAgo(2, 8),
    },
    {
      id: "seed-tx-tagihan-m2",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 870_000n,
      type: "expense",
      description: "Listrik, air, internet",
      occurredAt: monthsAgo(2, 7),
    },
    {
      id: "seed-tx-belanja-m2",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 780_000n,
      type: "expense",
      description: "Tokopedia & Shopee",
      occurredAt: monthsAgo(2, 16),
    },
    {
      id: "seed-tx-kesehatan-m2",
      accountId: acBNI.id,
      categoryId: catKesehatan.id,
      amount: 350_000n,
      type: "expense",
      description: "Klinik umum",
      occurredAt: monthsAgo(2, 22),
    },
    {
      id: "seed-tx-investasi-m2",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(2, 5),
    },
    {
      id: "seed-tx-pendidikan-m2",
      accountId: acMandiri.id,
      categoryId: catPendidikan.id,
      amount: 750_000n,
      type: "expense",
      description: "Kursus online Udemy",
      occurredAt: monthsAgo(2, 25),
    },

    // ── 3 Bulan lalu ───────────────────────────────────
    {
      id: "seed-tx-gaji-m3",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji",
      occurredAt: monthsAgo(3, 1),
    },
    {
      id: "seed-tx-kpr-m3",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(3, 5),
    },
    {
      id: "seed-tx-makan-m3a",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 460_000n,
      type: "expense",
      description: "Makan keluarga weekend",
      occurredAt: monthsAgo(3, 9),
    },
    {
      id: "seed-tx-makan-m3b",
      accountId: acCash.id,
      categoryId: catMakan.id,
      amount: 210_000n,
      type: "expense",
      description: "Makan siang & kopi",
      occurredAt: monthsAgo(3, 18),
    },
    {
      id: "seed-tx-transport-m3",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 340_000n,
      type: "expense",
      description: "BBM + Grab",
      occurredAt: monthsAgo(3, 11),
    },
    {
      id: "seed-tx-tagihan-m3",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 890_000n,
      type: "expense",
      description: "Listrik, air, Telkom",
      occurredAt: monthsAgo(3, 7),
    },
    {
      id: "seed-tx-belanja-m3",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 1_100_000n,
      type: "expense",
      description: "Belanja bulanan",
      occurredAt: monthsAgo(3, 14),
    },
    {
      id: "seed-tx-hiburan-m3",
      accountId: acOVO.id,
      categoryId: catHiburan.id,
      amount: 650_000n,
      type: "expense",
      description: "Bioskop & makan malam",
      occurredAt: monthsAgo(3, 21),
    },
    {
      id: "seed-tx-investasi-m3",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(3, 5),
    },
    {
      id: "seed-tx-investasi-in-m3",
      accountId: acMandiri.id,
      categoryId: catInvestasi.id,
      amount: 1_200_000n,
      type: "income",
      description: "Dividen BBCA",
      occurredAt: monthsAgo(3, 15),
    },

    // ── 4 Bulan lalu ───────────────────────────────────
    {
      id: "seed-tx-gaji-m4",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji",
      occurredAt: monthsAgo(4, 1),
    },
    {
      id: "seed-tx-kpr-m4",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(4, 5),
    },
    {
      id: "seed-tx-makan-m4a",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 395_000n,
      type: "expense",
      description: "Makan keluarga",
      occurredAt: monthsAgo(4, 8),
    },
    {
      id: "seed-tx-transport-m4",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 290_000n,
      type: "expense",
      description: "Bensin + parkir",
      occurredAt: monthsAgo(4, 10),
    },
    {
      id: "seed-tx-tagihan-m4",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 830_000n,
      type: "expense",
      description: "Listrik, air, internet",
      occurredAt: monthsAgo(4, 7),
    },
    {
      id: "seed-tx-belanja-m4",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 920_000n,
      type: "expense",
      description: "Shopee + Alfamart",
      occurredAt: monthsAgo(4, 16),
    },
    {
      id: "seed-tx-kesehatan-m4",
      accountId: acBNI.id,
      categoryId: catKesehatan.id,
      amount: 850_000n,
      type: "expense",
      description: "Medical check-up",
      occurredAt: monthsAgo(4, 20),
    },
    {
      id: "seed-tx-investasi-m4",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(4, 5),
    },
    {
      id: "seed-tx-freelance-m4",
      accountId: acMandiri.id,
      categoryId: catFreelance.id,
      amount: 3_200_000n,
      type: "income",
      description: "Konsultasi IT",
      occurredAt: monthsAgo(4, 22),
    },
    {
      id: "seed-tx-pendidikan-m4",
      accountId: acBNI.id,
      categoryId: catPendidikan.id,
      amount: 500_000n,
      type: "expense",
      description: "Buku & e-book",
      occurredAt: monthsAgo(4, 25),
    },

    // ── 5 Bulan lalu ───────────────────────────────────
    {
      id: "seed-tx-gaji-m5",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji",
      occurredAt: monthsAgo(5, 1),
    },
    {
      id: "seed-tx-kpr-m5",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(5, 5),
    },
    {
      id: "seed-tx-bonus-m5",
      accountId: acBCA.id,
      categoryId: catBonus.id,
      amount: 8_000_000n,
      type: "income",
      description: "Bonus tahunan",
      occurredAt: monthsAgo(5, 10),
    },
    {
      id: "seed-tx-makan-m5a",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 510_000n,
      type: "expense",
      description: "Makan besar keluarga",
      occurredAt: monthsAgo(5, 12),
    },
    {
      id: "seed-tx-makan-m5b",
      accountId: acCash.id,
      categoryId: catMakan.id,
      amount: 175_000n,
      type: "expense",
      description: "Sarapan kantor",
      occurredAt: monthsAgo(5, 22),
    },
    {
      id: "seed-tx-transport-m5",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 260_000n,
      type: "expense",
      description: "Grab + bensin",
      occurredAt: monthsAgo(5, 9),
    },
    {
      id: "seed-tx-tagihan-m5",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 910_000n,
      type: "expense",
      description: "Listrik, air, Telkom",
      occurredAt: monthsAgo(5, 7),
    },
    {
      id: "seed-tx-belanja-m5",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 2_100_000n,
      type: "expense",
      description: "Belanja elektronik (sale)",
      occurredAt: monthsAgo(5, 14),
    },
    {
      id: "seed-tx-hiburan-m5",
      accountId: acOVO.id,
      categoryId: catHiburan.id,
      amount: 380_000n,
      type: "expense",
      description: "Konser & bioskop",
      occurredAt: monthsAgo(5, 18),
    },
    {
      id: "seed-tx-investasi-m5",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(5, 5),
    },
    {
      id: "seed-tx-lain-m5",
      accountId: acCash.id,
      categoryId: catLainPengeluaran.id,
      amount: 200_000n,
      type: "expense",
      description: "Sumbangan RT",
      occurredAt: monthsAgo(5, 25),
    },
  ];

  for (const tx of txSeeds) {
    await prisma.transaction.upsert({
      where: { id: tx.id },
      update: { occurredAt: tx.occurredAt, amount: tx.amount },
      create: {
        id: tx.id,
        familyGroupId: FG,
        accountId: tx.accountId,
        categoryId: tx.categoryId,
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        occurredAt: tx.occurredAt,
      },
    });
  }

  // ── Budgets ───────────────────────────────────────────────────────────────────

  const budgets = [
    { id: "seed-budget-makan", categoryId: catMakan.id, limit: 2_000_000n },
    {
      id: "seed-budget-transport",
      categoryId: catTransport.id,
      limit: 1_000_000n,
    },
    { id: "seed-budget-belanja", categoryId: catBelanja.id, limit: 1_500_000n },
    { id: "seed-budget-tagihan", categoryId: catTagihan.id, limit: 1_200_000n },
    {
      id: "seed-budget-kesehatan",
      categoryId: catKesehatan.id,
      limit: 1_000_000n,
    },
    { id: "seed-budget-hiburan", categoryId: catHiburan.id, limit: 800_000n },
    {
      id: "seed-budget-pendidikan",
      categoryId: catPendidikan.id,
      limit: 500_000n,
    },
    {
      id: "seed-budget-investasi",
      categoryId: catInvestasiEx.id,
      limit: 3_000_000n,
    },
  ];

  for (const b of budgets) {
    await prisma.budget.upsert({
      where: {
        familyGroupId_categoryId_period: {
          familyGroupId: FG,
          categoryId: b.categoryId,
          period: "monthly",
        },
      },
      update: { limitAmount: b.limit },
      create: {
        id: b.id,
        familyGroupId: FG,
        categoryId: b.categoryId,
        period: "monthly",
        limitAmount: b.limit,
      },
    });
  }

  // ── Goals ─────────────────────────────────────────────────────────────────────

  const goals = [
    {
      id: "seed-d-goal-dana-darurat",
      name: "Dana Darurat 6 Bulan",
      icon: "🛡️",
      target: 60_000_000n,
      current: 42_000_000n,
      status: "on_track",
      autoDebit: 2_000_000n,
      targetDate: futureDate(180),
    },
    {
      id: "seed-goal-liburan",
      name: "Liburan Jepang",
      icon: "✈️",
      target: 25_000_000n,
      current: 15_600_000n,
      status: "on_track",
      autoDebit: null,
      targetDate: futureDate(270),
    },
    {
      id: "seed-d-goal-dp-rumah",
      name: "DP Rumah Ke-2",
      icon: "🏠",
      target: 300_000_000n,
      current: 120_000_000n,
      status: "needs_boost",
      autoDebit: 5_000_000n,
      targetDate: futureDate(730),
    },
    {
      id: "seed-goal-pensiun",
      name: "Dana Pensiun",
      icon: "🏖️",
      target: 1_000_000_000n,
      current: 250_000_000n,
      status: "at_risk",
      autoDebit: null,
      targetDate: futureDate(3650),
    },
  ] as const;

  for (const g of goals) {
    await prisma.goal.upsert({
      where: { id: g.id },
      update: {
        currentAmount: g.current,
        targetAmount: g.target,
        status: g.status,
      },
      create: {
        id: g.id,
        familyGroupId: FG,
        name: g.name,
        icon: g.icon,
        targetAmount: g.target,
        currentAmount: g.current,
        status: g.status,
        autoDebitAmount: g.autoDebit,
        targetDate: g.targetDate,
      },
    });
  }

  // ── Liabilities ───────────────────────────────────────────────────────────────

  const liabilities = [
    {
      id: "seed-liab-kpr",
      name: "KPR BTN Perumahan",
      institution: "Bank BTN",
      type: "kpr",
      total: 450_000_000n,
      remaining: 320_000_000n,
      minPayment: 4_200_000n,
      rate: 7.5,
      due: futureDate(20),
    },
    {
      id: "seed-liab-cc",
      name: "Kartu Kredit BCA",
      institution: "BCA",
      type: "kartu_kredit",
      total: 15_000_000n,
      remaining: 8_500_000n,
      minPayment: 425_000n,
      rate: 2.25,
      due: futureDate(15),
    },
    {
      id: "seed-liab-car",
      name: "Kredit Kendaraan Toyota",
      institution: "Toyota Astra Finance",
      type: "kendaraan",
      total: 180_000_000n,
      remaining: 95_000_000n,
      minPayment: 3_800_000n,
      rate: 5.5,
      due: futureDate(18),
    },
  ] as const;

  for (const l of liabilities) {
    await prisma.liability.upsert({
      where: { id: l.id },
      update: { remainingBalance: l.remaining, minimumPayment: l.minPayment },
      create: {
        id: l.id,
        familyGroupId: FG,
        name: l.name,
        institution: l.institution,
        type: l.type,
        totalDebt: l.total,
        remainingBalance: l.remaining,
        minimumPayment: l.minPayment,
        interestRate: l.rate,
        dueDate: l.due,
      },
    });
  }

  // ── Assets ────────────────────────────────────────────────────────────────────

  const assetRumah = await prisma.asset.upsert({
    where: { id: "seed-asset-rumah" },
    update: { currentValue: 850_000_000n },
    create: {
      id: "seed-asset-rumah",
      familyGroupId: FG,
      name: "Rumah Depok",
      type: "properti",
      currentValue: 850_000_000n,
      notes: "Dibeli 2019, cicilan KPR aktif",
    },
  });
  const assetMobil = await prisma.asset.upsert({
    where: { id: "seed-asset-mobil" },
    update: { currentValue: 210_000_000n },
    create: {
      id: "seed-asset-mobil",
      familyGroupId: FG,
      name: "Toyota Avanza 2021",
      type: "kendaraan",
      currentValue: 210_000_000n,
      notes: "Kredit aktif",
    },
  });
  await prisma.asset.upsert({
    where: { id: "seed-asset-laptop" },
    update: { currentValue: 22_000_000n },
    create: {
      id: "seed-asset-laptop",
      familyGroupId: FG,
      name: "MacBook Pro M3",
      type: "elektronik",
      currentValue: 22_000_000n,
      notes: "Untuk kerja",
    },
  });
  const assetEmas = await prisma.asset.upsert({
    where: { id: "seed-asset-emas" },
    update: { currentValue: 45_000_000n },
    create: {
      id: "seed-asset-emas",
      familyGroupId: FG,
      name: "Emas Antam 50 gram",
      type: "perhiasan",
      currentValue: 45_000_000n,
      notes: "Disimpan di safe deposit box",
    },
  });

  // AssetHistory — 3 titik per aset untuk chart tren
  const assetHistories = [
    {
      id: "seed-ah-rumah-m3",
      assetId: assetRumah.id,
      value: 800_000_000n,
      at: monthsAgo(3),
    },
    {
      id: "seed-ah-rumah-m1",
      assetId: assetRumah.id,
      value: 825_000_000n,
      at: monthsAgo(1),
    },
    {
      id: "seed-ah-rumah-m0",
      assetId: assetRumah.id,
      value: 850_000_000n,
      at: daysAgo(0),
    },
    {
      id: "seed-ah-mobil-m3",
      assetId: assetMobil.id,
      value: 230_000_000n,
      at: monthsAgo(3),
    },
    {
      id: "seed-ah-mobil-m0",
      assetId: assetMobil.id,
      value: 210_000_000n,
      at: daysAgo(0),
    },
    {
      id: "seed-ah-emas-m3",
      assetId: assetEmas.id,
      value: 38_000_000n,
      at: monthsAgo(3),
    },
    {
      id: "seed-ah-emas-m1",
      assetId: assetEmas.id,
      value: 42_000_000n,
      at: monthsAgo(1),
    },
    {
      id: "seed-ah-emas-m0",
      assetId: assetEmas.id,
      value: 45_000_000n,
      at: daysAgo(0),
    },
  ];

  for (const ah of assetHistories) {
    await prisma.assetHistory.upsert({
      where: { id: ah.id },
      update: { value: ah.value },
      create: {
        id: ah.id,
        assetId: ah.assetId,
        value: ah.value,
        recordedAt: ah.at,
      },
    });
  }

  // ── Investments ───────────────────────────────────────────────────────────────

  const invBBCA = await prisma.investment.upsert({
    where: { id: "seed-inv-bbca" },
    update: { quantity: 1500, costBasisPerUnit: 8500 },
    create: {
      id: "seed-inv-bbca",
      familyGroupId: FG,
      ticker: "BBCA",
      name: "Bank Central Asia Tbk",
      type: "saham",
      quantity: 1500,
      costBasisPerUnit: 8500,
      currency: "IDR",
      notes: "Saham blue chip",
    },
  });
  const invTLKM = await prisma.investment.upsert({
    where: { id: "seed-inv-tlkm" },
    update: { quantity: 5000, costBasisPerUnit: 3700 },
    create: {
      id: "seed-inv-tlkm",
      familyGroupId: FG,
      ticker: "TLKM",
      name: "Telkom Indonesia Tbk",
      type: "saham",
      quantity: 5000,
      costBasisPerUnit: 3700,
      currency: "IDR",
    },
  });
  const invReksaDana = await prisma.investment.upsert({
    where: { id: "seed-inv-rd" },
    update: { quantity: 250000, costBasisPerUnit: 1850 },
    create: {
      id: "seed-inv-rd",
      familyGroupId: FG,
      ticker: "RD-MANULIFE-GROWTH",
      name: "Manulife Saham Andalan",
      type: "reksa_dana",
      quantity: 250000,
      costBasisPerUnit: 1850,
      currency: "IDR",
    },
  });

  // InvestmentPrice — harga terkini
  const invPrices = [
    {
      id: "seed-ip-bbca-m1",
      investmentId: invBBCA.id,
      price: 9200,
      at: monthsAgo(1),
    },
    {
      id: "seed-ip-bbca-m0",
      investmentId: invBBCA.id,
      price: 9450,
      at: daysAgo(1),
    },
    {
      id: "seed-ip-tlkm-m1",
      investmentId: invTLKM.id,
      price: 3850,
      at: monthsAgo(1),
    },
    {
      id: "seed-ip-tlkm-m0",
      investmentId: invTLKM.id,
      price: 3920,
      at: daysAgo(1),
    },
    {
      id: "seed-ip-rd-m1",
      investmentId: invReksaDana.id,
      price: 1920,
      at: monthsAgo(1),
    },
    {
      id: "seed-ip-rd-m0",
      investmentId: invReksaDana.id,
      price: 1975,
      at: daysAgo(1),
    },
  ];

  for (const ip of invPrices) {
    await prisma.investmentPrice.upsert({
      where: { id: ip.id },
      update: { price: ip.price },
      create: {
        id: ip.id,
        investmentId: ip.investmentId,
        price: ip.price,
        source: "seed",
        recordedAt: ip.at,
      },
    });
  }

  // ── Insurances ────────────────────────────────────────────────────────────────

  const insurances = [
    {
      id: "seed-ins-jiwa",
      name: "Asuransi Jiwa Prudential",
      provider: "Prudential",
      type: "jiwa",
      status: "aktif",
      coverage: 500_000_000n,
      premium: 850_000n,
      period: "monthly",
      renewal: futureDate(240),
      policy: "PRU-2021-00912",
    },
    {
      id: "seed-ins-kes",
      name: "BPJS Kesehatan Keluarga",
      provider: "BPJS Kesehatan",
      type: "kesehatan",
      status: "aktif",
      coverage: null,
      premium: 300_000n,
      period: "monthly",
      renewal: futureDate(365),
      policy: "BPJS-0019872341",
    },
    {
      id: "seed-ins-mob",
      name: "Asuransi Kendaraan Toyota Avanza",
      provider: "Astra Insurance",
      type: "kendaraan",
      status: "aktif",
      coverage: 210_000_000n,
      premium: 4_200_000n,
      period: "yearly",
      renewal: futureDate(180),
      policy: "AI-MOB-882341",
    },
  ] as const;

  for (const ins of insurances) {
    await prisma.insurance.upsert({
      where: { id: ins.id },
      update: { status: ins.status, premiumAmount: ins.premium },
      create: {
        id: ins.id,
        familyGroupId: FG,
        name: ins.name,
        provider: ins.provider,
        type: ins.type,
        status: ins.status,
        coverageAmount: ins.coverage,
        premiumAmount: ins.premium,
        premiumPeriod: ins.period,
        renewalDate: ins.renewal,
        policyNumber: ins.policy,
      },
    });
  }

  // ── Split Bills ───────────────────────────────────────────────────────────────

  const sb1 = await prisma.splitBill.upsert({
    where: { id: "seed-sb-makan" },
    update: {},
    create: {
      id: "seed-sb-makan",
      familyGroupId: FG,
      title: "Makan Malam Anniversary",
      totalAmount: 1_200_000n,
      status: "open",
      notes: "Restoran Plataran Jakarta",
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "seed-sbp-makan-1" },
    update: {},
    create: {
      id: "seed-sbp-makan-1",
      splitBillId: sb1.id,
      name: "Demo User",
      amountOwed: 400_000n,
      status: "paid",
      paidAt: daysAgo(3),
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "seed-sbp-makan-2" },
    update: {},
    create: {
      id: "seed-sbp-makan-2",
      splitBillId: sb1.id,
      name: "Budi Santoso",
      amountOwed: 400_000n,
      status: "pending",
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "seed-sbp-makan-3" },
    update: {},
    create: {
      id: "seed-sbp-makan-3",
      splitBillId: sb1.id,
      name: "Siti Rahayu",
      amountOwed: 400_000n,
      status: "pending",
    },
  });

  const sb2 = await prisma.splitBill.upsert({
    where: { id: "seed-sb-liburan" },
    update: {},
    create: {
      id: "seed-sb-liburan",
      familyGroupId: FG,
      title: "Liburan Bali Bareng",
      totalAmount: 8_500_000n,
      status: "settled",
      notes: "Villa + transport + makan 3 hari",
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "seed-sbp-liburan-1" },
    update: {},
    create: {
      id: "seed-sbp-liburan-1",
      splitBillId: sb2.id,
      name: "Demo User",
      amountOwed: 2_833_000n,
      status: "paid",
      paidAt: daysAgo(30),
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "seed-sbp-liburan-2" },
    update: {},
    create: {
      id: "seed-sbp-liburan-2",
      splitBillId: sb2.id,
      name: "Agus Wijaya",
      amountOwed: 2_833_000n,
      status: "paid",
      paidAt: daysAgo(28),
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "seed-sbp-liburan-3" },
    update: {},
    create: {
      id: "seed-sbp-liburan-3",
      splitBillId: sb2.id,
      name: "Rina Permata",
      amountOwed: 2_834_000n,
      status: "paid",
      paidAt: daysAgo(28),
    },
  });

  // ── Inheritance Assets ────────────────────────────────────────────────────────

  const inh1 = await prisma.inheritanceAsset.upsert({
    where: { id: "seed-inh-rumah" },
    update: {},
    create: {
      id: "seed-inh-rumah",
      familyGroupId: FG,
      name: "Rumah Depok",
      assetType: "Properti",
      estimatedValue: 850_000_000n,
      visibility: "heirs_only",
      notes: "Rumah utama keluarga. Sertifikat SHM atas nama Demo User.",
    },
  });
  await prisma.inheritanceHeir.upsert({
    where: { id: "seed-heir-1" },
    update: {},
    create: {
      id: "seed-heir-1",
      inheritanceAssetId: inh1.id,
      name: "Anak Pertama",
      relationship: "Anak Kandung",
      sharePercent: 50,
    },
  });
  await prisma.inheritanceHeir.upsert({
    where: { id: "seed-heir-2" },
    update: {},
    create: {
      id: "seed-heir-2",
      inheritanceAssetId: inh1.id,
      name: "Anak Kedua",
      relationship: "Anak Kandung",
      sharePercent: 50,
    },
  });

  await prisma.inheritanceAsset.upsert({
    where: { id: "seed-inh-tabungan" },
    update: {},
    create: {
      id: "seed-inh-tabungan",
      familyGroupId: FG,
      name: "Tabungan & Investasi",
      assetType: "Aset Keuangan",
      estimatedValue: 300_000_000n,
      visibility: "heirs_only",
      notes: "Saham BBCA, reksa dana, tabungan BCA & Mandiri.",
    },
  });

  // ── Donations ─────────────────────────────────────────────────────────────────

  const donations = [
    {
      id: "seed-don-zakat-m1",
      type: "zakat_maal",
      recipient: "Baznas",
      amount: 500_000n,
      at: monthsAgo(1, 10),
      taxDed: true,
    },
    {
      id: "seed-don-infaq-m1",
      type: "infaq",
      recipient: "Masjid Al-Ikhlas",
      amount: 200_000n,
      at: monthsAgo(1, 14),
      taxDed: false,
    },
    {
      id: "seed-don-sedekah-m2",
      type: "sedekah",
      recipient: "Panti Asuhan",
      amount: 300_000n,
      at: monthsAgo(2, 20),
      taxDed: false,
    },
    {
      id: "seed-don-wakaf-m3",
      type: "wakaf",
      recipient: "Wakaf Quran Online",
      amount: 150_000n,
      at: monthsAgo(3, 5),
      taxDed: true,
    },
  ] as const;

  for (const d of donations) {
    await prisma.donation.upsert({
      where: { id: d.id },
      update: {},
      create: {
        id: d.id,
        familyGroupId: FG,
        type: d.type,
        recipient: d.recipient,
        amount: d.amount,
        donatedAt: d.at,
        isTaxDeductible: d.taxDed,
      },
    });
  }

  // ── Tax Records ───────────────────────────────────────────────────────────────

  await prisma.taxRecord.upsert({
    where: { familyGroupId_taxYear: { familyGroupId: FG, taxYear: 2024 } },
    update: {},
    create: {
      id: "seed-tax-2024",
      familyGroupId: FG,
      taxYear: 2024,
      grossIncome: 315_200_000n,
      ptkp: 54_000_000n,
      zakatDeduction: 1_000_000n,
      netTax: 7_500_000n,
      sptStatus: "sudah_lapor",
    },
  });
  await prisma.taxRecord.upsert({
    where: { familyGroupId_taxYear: { familyGroupId: FG, taxYear: 2025 } },
    update: {},
    create: {
      id: "seed-tax-2025",
      familyGroupId: FG,
      taxYear: 2025,
      grossIncome: 320_000_000n,
      ptkp: 54_000_000n,
      zakatDeduction: 1_500_000n,
      netTax: 7_800_000n,
      sptStatus: "belum_lapor",
    },
  });

  // ── Notifications ─────────────────────────────────────────────────────────────

  const notifs = [
    {
      id: "seed-notif-1",
      title: "Cicilan KPR Jatuh Tempo",
      body: "Cicilan KPR BTN sebesar Rp 4.200.000 jatuh tempo dalam 5 hari.",
      icon: "🏠",
    },
    {
      id: "seed-notif-2",
      title: "Budget Makan & Minum 80%",
      body: "Pengeluaran makan sudah mencapai 80% dari budget Rp 2.000.000.",
      icon: "⚠️",
    },
    {
      id: "seed-notif-3",
      title: "Goal Dana Darurat On Track",
      body: "Dana darurat kamu sudah 70% dari target Rp 60.000.000.",
      icon: "🛡️",
    },
    {
      id: "seed-notif-4",
      title: "Asuransi Kendaraan Renewal",
      body: "Asuransi kendaraan akan jatuh tempo dalam 30 hari.",
      icon: "🚗",
    },
  ];

  for (const n of notifs) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: {},
      create: {
        id: n.id,
        familyGroupId: FG,
        title: n.title,
        body: n.body,
        icon: n.icon,
      },
    });
  }

  process.stdout.write(
    `\nSeed complete — demo@wealthme.id / demo1234\n` +
      `  FamilyGroup : ${family.name} (${family.id})\n` +
      `  Accounts    : BCA, Mandiri, BNI, GoPay, OVO, Kas Tunai\n` +
      `  Categories  : ${5} income + ${10} expense\n` +
      `  Transactions: ${txSeeds.length} (6 bulan)\n` +
      `  Budgets     : 8 monthly budgets\n` +
      `  Goals       : 4 (dana darurat, liburan, DP rumah, pensiun)\n` +
      `  Liabilities : KPR, kartu kredit, kredit kendaraan\n` +
      `  Assets      : rumah, mobil, laptop, emas + history\n` +
      `  Investments : BBCA, TLKM, reksa dana + harga terkini\n` +
      `  Insurances  : jiwa, kesehatan, kendaraan\n` +
      `  Split Bills : 2 (1 open, 1 settled)\n` +
      `  Inheritance : 2 aset + 2 ahli waris\n` +
      `  Donations   : 4 (zakat, infaq, sedekah, wakaf)\n` +
      `  Tax Records : 2024 (sudah lapor), 2025 (belum lapor)\n` +
      `  Notifications: 4\n`,
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
