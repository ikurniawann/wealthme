import { PrismaClient } from "@prisma/client";
import {
  buildReferenceItemSeed,
  defaultCoaCodeForCategory,
  GENERIC_COA_CHART,
} from "@wealthme/contracts";
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
      id: "320a230f-320e-4c1e-9ac2-24a5802bb7b5",
      email: "demo@wealthme.id",
      name: "Demo User",
      avatarInitials: "DU",
      passwordHash,
    },
  });

  await prisma.baAccount.upsert({
    where: { id: "9a9906c6-c7c3-43ae-b578-7d61a5962313" },
    update: { password: passwordHash },
    create: {
      id: "9a9906c6-c7c3-43ae-b578-7d61a5962313",
      accountId: "demo@wealthme.id",
      providerId: "credential",
      userId: demoUser.id,
      password: passwordHash,
    },
  });

  // Invalidate stale sessions so the next login embeds the correct familyGroupId.
  // Without this, existing sessions carry the old familyGroupId and all API calls return 403.
  await prisma.baSession.deleteMany({ where: { userId: demoUser.id } });

  await prisma.member.upsert({
    where: {
      userId_familyGroupId: { userId: demoUser.id, familyGroupId: family.id },
    },
    update: { role: "owner" },
    create: {
      id: "8d654752-ac4b-40c9-b73b-634f642d563c",
      userId: demoUser.id,
      familyGroupId: family.id,
      role: "owner",
    },
  });

  // ── Demo child member (dependant) ─────────────────────────────────────────────
  // The seed used to create exactly ONE member (the owner), so every
  // role-scoped surface — the reduced sidebar, /akses-saya, the IAM roster —
  // had nothing to demonstrate, and the inheritance heirs below invented two
  // children who existed nowhere else in the data. This is a real `dependant`
  // so the demo family is internally consistent, and the heir record links to
  // it by `memberUserId`.
  //
  // Signs in with USERNAME (no email), like every head-created dependant:
  //   ana_demo / demo1234 . `mustChangePassword` stays false on purpose —
  //   the forced-change flow is exercised by accounts created through
  //   POST /members/dependant, not by this ready-to-use demo login.
  const childUser = await prisma.user.upsert({
    where: { id: "6f2a1d54-9c3b-4f7e-9a10-2b8c5d4e1f03" },
    update: { name: "Ana Demo", avatarInitials: "AD" },
    create: {
      id: "6f2a1d54-9c3b-4f7e-9a10-2b8c5d4e1f03",
      // `User.email` is NOT nullable, so a username-only account still needs
      // one. Uses the same synthetic, non-routable domain the production path
      // uses (SYNTHETIC_EMAIL_DOMAIN in family-groups.service.ts) — fixed here
      // rather than randomUUID()'d so re-seeding stays idempotent.
      email: "ana-demo@members.internal.wealthme.invalid",
      emailVerified: false,
      username: "ana_demo",
      displayUsername: "ana_demo",
      name: "Ana Demo",
      avatarInitials: "AD",
      passwordHash,
    },
  });

  await prisma.baAccount.upsert({
    where: { id: "1c7e4b90-5a62-4d3f-8e11-7f0a9b2c6d54" },
    update: { password: passwordHash },
    create: {
      id: "1c7e4b90-5a62-4d3f-8e11-7f0a9b2c6d54",
      accountId: "ana_demo",
      providerId: "credential",
      userId: childUser.id,
      password: passwordHash,
    },
  });

  await prisma.baSession.deleteMany({ where: { userId: childUser.id } });

  await prisma.member.upsert({
    where: {
      userId_familyGroupId: { userId: childUser.id, familyGroupId: family.id },
    },
    update: { role: "dependant", relationship: "anak" },
    create: {
      id: "b3d8f1a2-7e45-4c96-a0b3-1d5e8c7f2a94",
      userId: childUser.id,
      familyGroupId: family.id,
      role: "dependant",
      relationship: "anak",
    },
  });

  // ── Accounts ──────────────────────────────────────────────────────────────────

  const acBCA = await prisma.account.upsert({
    where: { id: "c7c973f6-43db-48a9-a726-3466e8c7713c" },
    update: { balance: 128_450_000n },
    create: {
      id: "c7c973f6-43db-48a9-a726-3466e8c7713c",
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
    where: { id: "016b4f1e-38bb-4e34-a60e-d402f4138ef2" },
    update: { balance: 85_200_000n },
    create: {
      id: "016b4f1e-38bb-4e34-a60e-d402f4138ef2",
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
    where: { id: "42a83ca0-56a9-41e3-8d2c-9a1ab62622e5" },
    update: { balance: 32_000_000n },
    create: {
      id: "42a83ca0-56a9-41e3-8d2c-9a1ab62622e5",
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
    where: { id: "1353a88d-d8ec-4e8d-84cb-86f3a6483e76" },
    update: { balance: 2_450_000n },
    create: {
      id: "1353a88d-d8ec-4e8d-84cb-86f3a6483e76",
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
    where: { id: "fe5c0fb5-b54c-4307-ae32-82e6152f9c87" },
    update: { balance: 1_200_000n },
    create: {
      id: "fe5c0fb5-b54c-4307-ae32-82e6152f9c87",
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
    where: { id: "927b685c-df19-4e8a-a1c7-cea4db8f2230" },
    update: { balance: 3_000_000n },
    create: {
      id: "927b685c-df19-4e8a-a1c7-cea4db8f2230",
      familyGroupId: FG,
      name: "Kas Tunai",
      type: "cash",
      institution: null,
      maskedNumber: null,
      balance: 3_000_000n,
      currency: "IDR",
    },
  });

  // ── COA chart (generic starter) ─────────────────────────────────────────────
  // Seeded before categories so every category can link to a COA account in the
  // same group (EPIC-017: mandatory COA link). The richer personalized demo
  // chart is upserted further below.
  for (const c of GENERIC_COA_CHART) {
    await prisma.coaAccount.upsert({
      where: { familyGroupId_code: { familyGroupId: FG, code: c.code } },
      update: {},
      create: {
        familyGroupId: FG,
        code: c.code,
        name: c.name,
        groupNum: c.groupNum,
        direction: c.direction,
        budgetType: c.budgetType,
      },
    });
  }
  const seededCoa = await prisma.coaAccount.findMany({
    where: { familyGroupId: FG },
    select: { id: true, code: true },
  });
  const coaIdByCode = new Map(seededCoa.map((a) => [a.code, a.id]));
  const catCoa = (kind: "income" | "expense", name: string): string => {
    const id = coaIdByCode.get(defaultCoaCodeForCategory(kind, name));
    if (!id) throw new Error(`Seed: no COA account for ${kind}/${name}`);
    return id;
  };

  // ── Reference items (EPIC-024 Task J, D14/US-MD-1) ──────────────────────────
  // Same defaults real registration seeds, so the demo `/masterdata` page
  // shows real, deletable-by-owner data instead of empty groups.
  for (const item of buildReferenceItemSeed()) {
    await prisma.referenceItem.upsert({
      where: {
        familyGroupId_group_label: {
          familyGroupId: FG,
          group: item.group,
          label: item.label,
        },
      },
      update: {},
      create: { ...item, familyGroupId: FG, isSystem: true },
    });
  }

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
      id: "43bd91b8-5d97-456d-8250-39cd62c7d6c0",
      familyGroupId: FG,
      coaAccountId: catCoa("income", "Gaji"),
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
      id: "fa614ca6-2269-486f-bf60-4b1e3dee9579",
      familyGroupId: FG,
      coaAccountId: catCoa("income", "Bonus"),
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
      id: "14cb512b-a51d-4f82-9ed6-d453f73b6cc3",
      familyGroupId: FG,
      coaAccountId: catCoa("income", "Freelance"),
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
      id: "bf9a372b-9ed1-4eaf-ad3a-5ad1e40e1c7f",
      familyGroupId: FG,
      coaAccountId: catCoa("income", "Hasil Investasi"),
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
      id: "34838088-0eac-4864-8d3d-aa4c0638b1dc",
      familyGroupId: FG,
      coaAccountId: catCoa("income", "Lainnya Pemasukan"),
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
      id: "2c62d7f7-618b-4260-b69e-62034af304c6",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Makan & Minum"),
      name: "Makan & Minum",
      kind: "expense",
      icon: "🍜",
      color: "#f97316",
    },
  });
  // A demo DB seeded before this category was renamed to "Makan & Minum"
  // can still carry the old plain "Makan" row alongside it — two expense
  // categories mapped to the same COA account, confusing at pick-time and
  // splitting what should be one "Makan & Minum" total in Setup Master
  // Data/reports. Only removed when nothing references it (Transaction sets
  // categoryId to null on delete, but Budget CASCADEs — never risk taking
  // an active budget down with it); otherwise it's left in place rather
  // than silently orphaning real user data.
  const staleMakan = await prisma.category.findUnique({
    where: {
      familyGroupId_name_kind: {
        familyGroupId: FG,
        name: "Makan",
        kind: "expense",
      },
    },
    select: { id: true },
  });
  if (staleMakan) {
    const [txCount, budgetCount] = await Promise.all([
      prisma.transaction.count({ where: { categoryId: staleMakan.id } }),
      prisma.budget.count({ where: { categoryId: staleMakan.id } }),
    ]);
    if (txCount === 0 && budgetCount === 0) {
      await prisma.category.delete({ where: { id: staleMakan.id } });
    }
  }
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
      id: "57a1f917-dfe0-4804-8464-78986aa0bceb",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Transportasi"),
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
      id: "d94f2e06-4276-490a-9e24-4e45d879e755",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Belanja"),
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
      id: "8ce7929f-9eb5-429f-b12a-c2a09fefe617",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Tagihan & Utilitas"),
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
      id: "5d27e516-0506-4c08-96f4-6ef9a8a1d53c",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Kesehatan"),
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
      id: "ee9e96ee-ad43-45fd-846f-584dbf9c29e1",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Hiburan"),
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
      id: "cb31c385-996f-4edb-983c-9068ba67fcd0",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Pendidikan"),
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
      id: "bb6b5ec2-fbbc-419b-b444-216029b91194",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Cicilan KPR"),
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
      id: "f94127c4-52ce-4d5f-bb6a-73057a7d242d",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Tabungan & Investasi"),
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
      id: "18fab853-d2c9-4379-b1ca-17cca86c98e2",
      familyGroupId: FG,
      coaAccountId: catCoa("expense", "Lainnya Pengeluaran"),
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
      id: "724f9260-63ed-40e2-aca2-f19a5e116276",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji bulan ini",
      occurredAt: monthsAgo(0, 1),
    },
    {
      id: "99ad3e49-0f96-4203-9b9f-24d178a9c611",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(0, 5),
    },
    {
      id: "3c8611ab-fce5-4c33-95f8-9a3a7bb6f3d3",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 380_000n,
      type: "expense",
      description: "Makan siang kantor",
      occurredAt: daysAgo(2),
    },
    {
      id: "95e174a6-7ed4-477e-b92e-0a27b1c7a6e4",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 220_000n,
      type: "expense",
      description: "Ojek & bensin",
      occurredAt: daysAgo(3),
    },
    {
      id: "ff9c1223-d287-4c1e-b89e-5ada73ff7d73",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 850_000n,
      type: "expense",
      description: "Listrik, air, internet",
      occurredAt: daysAgo(5),
    },
    {
      id: "efb43da9-9546-4152-85c8-f903c1e9f747",
      accountId: acOVO.id,
      categoryId: catBelanja.id,
      amount: 650_000n,
      type: "expense",
      description: "Belanja Tokopedia",
      occurredAt: daysAgo(6),
    },
    {
      id: "abe158f7-919c-457c-8a70-f4c68460db43",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: daysAgo(7),
    },

    // ── Bulan lalu (1) ─────────────────────────────────
    {
      id: "55dbd453-9859-4cef-8b64-2ffa8f284973",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji bulan lalu",
      occurredAt: monthsAgo(1, 1),
    },
    {
      id: "be6d3d3b-419e-4f2d-b554-4a7933953739",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(1, 5),
    },
    {
      id: "7adf3396-46b7-4d58-99be-d774c8b7ee8d",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 420_000n,
      type: "expense",
      description: "Makan keluarga",
      occurredAt: monthsAgo(1, 8),
    },
    {
      id: "76469d2e-31a1-404c-8801-2fb601b2548f",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 195_000n,
      type: "expense",
      description: "Kopi & snack",
      occurredAt: monthsAgo(1, 14),
    },
    {
      id: "a7b70b4f-2dd0-4198-aa4a-c963185c9b83",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 310_000n,
      type: "expense",
      description: "BBM + parkir",
      occurredAt: monthsAgo(1, 10),
    },
    {
      id: "c52bc77a-41d2-4c23-81f7-a9217eb7331e",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 920_000n,
      type: "expense",
      description: "Listrik, air, Telkom",
      occurredAt: monthsAgo(1, 7),
    },
    {
      id: "297fca15-7ffe-4168-bd26-b5efb23f9e41",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 1_350_000n,
      type: "expense",
      description: "Belanja bulanan supermarket",
      occurredAt: monthsAgo(1, 15),
    },
    {
      id: "e82d1b17-1535-478f-8bbe-d451421bd95c",
      accountId: acOVO.id,
      categoryId: catHiburan.id,
      amount: 230_000n,
      type: "expense",
      description: "Netflix + Spotify",
      occurredAt: monthsAgo(1, 2),
    },
    {
      id: "4fa15e0f-d2fa-49c8-9ec1-61347117789d",
      accountId: acBNI.id,
      categoryId: catKesehatan.id,
      amount: 450_000n,
      type: "expense",
      description: "Apotik & vitamin",
      occurredAt: monthsAgo(1, 20),
    },
    {
      id: "4d80c9eb-e676-4db2-b1c7-6288bb71ddcd",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(1, 5),
    },
    {
      id: "5c6549b2-5eb8-4413-be09-cd5fc5703d83",
      accountId: acMandiri.id,
      categoryId: catFreelance.id,
      amount: 4_500_000n,
      type: "income",
      description: "Proyek desain website",
      occurredAt: monthsAgo(1, 18),
    },

    // ── 2 Bulan lalu ───────────────────────────────────
    {
      id: "826f7860-37bd-4346-be26-2255d060fb60",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji",
      occurredAt: monthsAgo(2, 1),
    },
    {
      id: "d932a60e-c2eb-47e0-beea-18f353c599ce",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(2, 5),
    },
    {
      id: "98c6aacb-d74f-4bb1-95a2-3e2c2447f08e",
      accountId: acBCA.id,
      categoryId: catBonus.id,
      amount: 5_000_000n,
      type: "income",
      description: "Bonus kuartal",
      occurredAt: monthsAgo(2, 10),
    },
    {
      id: "820878ab-2a06-4e72-aeb1-72a8978acf78",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 540_000n,
      type: "expense",
      description: "Dinner keluarga",
      occurredAt: monthsAgo(2, 12),
    },
    {
      id: "8034f8fc-84ed-4d08-8991-5afc6c7b71bb",
      accountId: acCash.id,
      categoryId: catMakan.id,
      amount: 185_000n,
      type: "expense",
      description: "Sarapan & makan siang",
      occurredAt: monthsAgo(2, 20),
    },
    {
      id: "529f321b-3bb7-4dba-ab84-fc80e85c79c6",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 280_000n,
      type: "expense",
      description: "Grab + Ojek",
      occurredAt: monthsAgo(2, 8),
    },
    {
      id: "5cdef13b-776e-43d7-b997-558d90235fe6",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 870_000n,
      type: "expense",
      description: "Listrik, air, internet",
      occurredAt: monthsAgo(2, 7),
    },
    {
      id: "6002291f-2dca-49f5-b9ff-6926e1914a12",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 780_000n,
      type: "expense",
      description: "Tokopedia & Shopee",
      occurredAt: monthsAgo(2, 16),
    },
    {
      id: "dd3b1c7d-9484-447f-839e-da56513216f5",
      accountId: acBNI.id,
      categoryId: catKesehatan.id,
      amount: 350_000n,
      type: "expense",
      description: "Klinik umum",
      occurredAt: monthsAgo(2, 22),
    },
    {
      id: "33cf0883-a0bf-4b38-a8b8-2b4970003a5d",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(2, 5),
    },
    {
      id: "466b1280-40d3-453b-a5fb-b34cfc895ea4",
      accountId: acMandiri.id,
      categoryId: catPendidikan.id,
      amount: 750_000n,
      type: "expense",
      description: "Kursus online Udemy",
      occurredAt: monthsAgo(2, 25),
    },

    // ── 3 Bulan lalu ───────────────────────────────────
    {
      id: "0ca4eb55-3fd3-46d4-acd5-3cb390380868",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji",
      occurredAt: monthsAgo(3, 1),
    },
    {
      id: "d4fc2314-f409-4768-a535-4458a6311e5c",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(3, 5),
    },
    {
      id: "1310b21f-b534-4956-80f6-7abb84a8f258",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 460_000n,
      type: "expense",
      description: "Makan keluarga weekend",
      occurredAt: monthsAgo(3, 9),
    },
    {
      id: "3d482dcb-cbb3-43a5-929d-8dadff6d7095",
      accountId: acCash.id,
      categoryId: catMakan.id,
      amount: 210_000n,
      type: "expense",
      description: "Makan siang & kopi",
      occurredAt: monthsAgo(3, 18),
    },
    {
      id: "85e1448b-b717-4d63-9cd7-847b606e9c1d",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 340_000n,
      type: "expense",
      description: "BBM + Grab",
      occurredAt: monthsAgo(3, 11),
    },
    {
      id: "decb2bb4-a488-4b0a-a7b8-b83d175cb417",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 890_000n,
      type: "expense",
      description: "Listrik, air, Telkom",
      occurredAt: monthsAgo(3, 7),
    },
    {
      id: "bedb3519-fbd4-43bf-a66f-851090bce1a0",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 1_100_000n,
      type: "expense",
      description: "Belanja bulanan",
      occurredAt: monthsAgo(3, 14),
    },
    {
      id: "09b16d12-fb15-4788-b5c1-603d1db47188",
      accountId: acOVO.id,
      categoryId: catHiburan.id,
      amount: 650_000n,
      type: "expense",
      description: "Bioskop & makan malam",
      occurredAt: monthsAgo(3, 21),
    },
    {
      id: "876efad1-3ba4-4864-96c0-cb090dbd85a4",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(3, 5),
    },
    {
      id: "c77d2584-f6ed-4d14-bb90-55caaa6a009f",
      accountId: acMandiri.id,
      categoryId: catInvestasi.id,
      amount: 1_200_000n,
      type: "income",
      description: "Dividen BBCA",
      occurredAt: monthsAgo(3, 15),
    },

    // ── 4 Bulan lalu ───────────────────────────────────
    {
      id: "9bfcd123-8bbe-476b-b5f0-2186936ec1cf",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji",
      occurredAt: monthsAgo(4, 1),
    },
    {
      id: "d864c92e-8670-4c8a-bf52-0900b85c6928",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(4, 5),
    },
    {
      id: "16891bb1-6559-4adb-9077-a95b78a7c6ab",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 395_000n,
      type: "expense",
      description: "Makan keluarga",
      occurredAt: monthsAgo(4, 8),
    },
    {
      id: "c8eec3a2-9f99-4733-a0b9-24033afb1463",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 290_000n,
      type: "expense",
      description: "Bensin + parkir",
      occurredAt: monthsAgo(4, 10),
    },
    {
      id: "5442d514-1830-4407-9291-a4d223fec795",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 830_000n,
      type: "expense",
      description: "Listrik, air, internet",
      occurredAt: monthsAgo(4, 7),
    },
    {
      id: "50cc7d97-8c04-4b98-8d22-aa0ad09729b7",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 920_000n,
      type: "expense",
      description: "Shopee + Alfamart",
      occurredAt: monthsAgo(4, 16),
    },
    {
      id: "a5bef450-68b8-438c-8f84-245176aa21b6",
      accountId: acBNI.id,
      categoryId: catKesehatan.id,
      amount: 850_000n,
      type: "expense",
      description: "Medical check-up",
      occurredAt: monthsAgo(4, 20),
    },
    {
      id: "30d65151-0c19-42b3-b93c-f2c6da4800b4",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(4, 5),
    },
    {
      id: "c800afa4-fc25-4b5d-ae4a-3f11a4d7a920",
      accountId: acMandiri.id,
      categoryId: catFreelance.id,
      amount: 3_200_000n,
      type: "income",
      description: "Konsultasi IT",
      occurredAt: monthsAgo(4, 22),
    },
    {
      id: "79350f13-70b5-49a1-8588-a6a3b494de09",
      accountId: acBNI.id,
      categoryId: catPendidikan.id,
      amount: 500_000n,
      type: "expense",
      description: "Buku & e-book",
      occurredAt: monthsAgo(4, 25),
    },

    // ── 5 Bulan lalu ───────────────────────────────────
    {
      id: "55f15b9d-d9b4-4045-9dbb-da9ba3ff75ad",
      accountId: acBCA.id,
      categoryId: catGaji.id,
      amount: 25_850_000n,
      type: "income",
      description: "Gaji",
      occurredAt: monthsAgo(5, 1),
    },
    {
      id: "7e5f00fa-0fd0-4fa6-9544-2d7e65d9a2c3",
      accountId: acBCA.id,
      categoryId: catKPR.id,
      amount: 4_200_000n,
      type: "expense",
      description: "Cicilan KPR BTN",
      occurredAt: monthsAgo(5, 5),
    },
    {
      id: "bac882ac-0289-43ef-b349-61f25c1a392c",
      accountId: acBCA.id,
      categoryId: catBonus.id,
      amount: 8_000_000n,
      type: "income",
      description: "Bonus tahunan",
      occurredAt: monthsAgo(5, 10),
    },
    {
      id: "a45826ab-b417-46b5-aedf-6ed3b5d0722f",
      accountId: acGoPay.id,
      categoryId: catMakan.id,
      amount: 510_000n,
      type: "expense",
      description: "Makan besar keluarga",
      occurredAt: monthsAgo(5, 12),
    },
    {
      id: "0c1015c4-e85d-42a9-8d92-eea8f71234da",
      accountId: acCash.id,
      categoryId: catMakan.id,
      amount: 175_000n,
      type: "expense",
      description: "Sarapan kantor",
      occurredAt: monthsAgo(5, 22),
    },
    {
      id: "54804a17-b4ef-4253-a486-0880de12755e",
      accountId: acGoPay.id,
      categoryId: catTransport.id,
      amount: 260_000n,
      type: "expense",
      description: "Grab + bensin",
      occurredAt: monthsAgo(5, 9),
    },
    {
      id: "24b44628-f24e-4748-85e2-a4be6a99b441",
      accountId: acBCA.id,
      categoryId: catTagihan.id,
      amount: 910_000n,
      type: "expense",
      description: "Listrik, air, Telkom",
      occurredAt: monthsAgo(5, 7),
    },
    {
      id: "f4ab8469-34e4-4ebc-93d1-b3bdedf647a3",
      accountId: acMandiri.id,
      categoryId: catBelanja.id,
      amount: 2_100_000n,
      type: "expense",
      description: "Belanja elektronik (sale)",
      occurredAt: monthsAgo(5, 14),
    },
    {
      id: "4bf33b1f-16c1-4e44-b412-5e6bb086e9fd",
      accountId: acOVO.id,
      categoryId: catHiburan.id,
      amount: 380_000n,
      type: "expense",
      description: "Konser & bioskop",
      occurredAt: monthsAgo(5, 18),
    },
    {
      id: "a6d5c30c-2544-401a-ae29-4d53651ea94f",
      accountId: acBCA.id,
      categoryId: catInvestasiEx.id,
      amount: 3_000_000n,
      type: "expense",
      description: "Autodebit reksa dana",
      occurredAt: monthsAgo(5, 5),
    },
    {
      id: "244c1057-4100-48f6-b6a3-1d03db679a63",
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

  // ── Bulk Transactions (500) — OPTIONAL, env SEED_BULK=1 ─────────────────
  // WARNING: NOT balance-reconciled. Enable for pagination testing only.
  // Disabling: balances will match transaction sums (for totals testing).
  // Enabling: account balances won't match (known data contradiction).
  if (process.env.SEED_BULK === "1") {
    // Data integrity: income rare (i%25===0, ~20 total), amounts deterministic,
    // distributed across accounts/categories to avoid correlation, spread across
    // 6-month window to preserve ratio analysis. Expenses dominate to match
    // existing account balances.
    const accountIds = [
      acBCA.id,
      acMandiri.id,
      acGoPay.id,
      acOVO.id,
      acCash.id,
    ];
    const expenseCats = [
      catMakan.id,
      catTransport.id,
      catTagihan.id,
      catBelanja.id,
      catHiburan.id,
    ];
    const incomeCats = [catGaji.id, catBonus.id];

    for (let i = 0; i < 500; i++) {
      const accountIdx = (i * 7) % accountIds.length; // stagger account selection
      const accountId = accountIds[accountIdx];
      const isIncome = i % 25 === 0; // rare: ~20 income, 480 expense

      let categoryId: string;
      let amount: bigint;
      let type: "income" | "expense" | "transfer";

      if (isIncome) {
        categoryId = incomeCats[(i * 13) % incomeCats.length];
        amount = BigInt(500_000 + ((i * 7919) % 1_500_000)); // 500k–2M
        type = "income";
      } else {
        categoryId = expenseCats[(i * 11) % expenseCats.length];
        amount = BigInt(50_000 + ((i * 7919) % 950_000)); // 50k–1M
        type = "expense";
      }

      const monthOffset = i % 6; // spread across 6-month window
      const dayNum = (i % 27) + 1; // 1–27 (fits any month)

      await prisma.transaction.upsert({
        where: { id: `seed-bulk-tx-${i}` },
        update: {
          accountId,
          categoryId,
          amount,
          type,
          description: `Bulk pagination test ${i}`,
          occurredAt: monthsAgo(monthOffset, dayNum),
        },
        create: {
          id: `seed-bulk-tx-${i}`,
          familyGroupId: FG,
          accountId,
          categoryId,
          amount,
          type,
          description: `Bulk pagination test ${i}`,
          occurredAt: monthsAgo(monthOffset, dayNum),
        },
      });
    }
    process.stderr.write(
      "✓ Seeded 500 bulk transactions for pagination testing (SEED_BULK=1)\n",
    );
  } else {
    process.stderr.write(
      "⊘ Bulk transactions disabled (set SEED_BULK=1 for pagination testing)\n",
    );
  }

  // ── Budgets ───────────────────────────────────────────────────────────────────

  const budgets = [
    {
      id: "b5e76a87-e61e-4844-895c-9a5359230cab",
      categoryId: catMakan.id,
      limit: 2_000_000n,
    },
    {
      id: "1550cb9a-cb0e-4a62-8665-207bdef32172",
      categoryId: catTransport.id,
      limit: 1_000_000n,
    },
    {
      id: "37d0a805-cc59-4f56-9795-d41eface6a23",
      categoryId: catBelanja.id,
      limit: 1_500_000n,
    },
    {
      id: "1d87a99e-b789-4ecc-9c51-484949e7377d",
      categoryId: catTagihan.id,
      limit: 1_200_000n,
    },
    {
      id: "5664fdbd-5195-48ee-9353-fedb450301bc",
      categoryId: catKesehatan.id,
      limit: 1_000_000n,
    },
    {
      id: "3d2af149-5784-4ffd-bbdb-3cfae5c70b35",
      categoryId: catHiburan.id,
      limit: 800_000n,
    },
    {
      id: "b884be64-3bc3-447f-a037-60dfb0758874",
      categoryId: catPendidikan.id,
      limit: 500_000n,
    },
    {
      id: "5a3908c4-847d-465f-a9b4-ab29535cfcae",
      categoryId: catInvestasiEx.id,
      limit: 3_000_000n,
    },
  ];

  // Backdated to the start of the seeded transaction history on purpose:
  // `budgetSpendWindow` clamps a budget's spend window to its own `createdAt`
  // (a budget created mid-period must not claim spend from before it existed
  // — EPIC-023 C3). Left at the default `now()`, every seeded budget was
  // younger than every seeded transaction, so /anggaran opened with all eight
  // budgets reading "Rp 0 terpakai · 0%" on a database that clearly has
  // spending in it. Set on `update` too, so re-seeding heals a demo database
  // that was created before this line.
  const budgetsCreatedAt = monthsAgo(6);

  for (const b of budgets) {
    await prisma.budget.upsert({
      where: {
        familyGroupId_categoryId_period: {
          familyGroupId: FG,
          categoryId: b.categoryId,
          period: "monthly",
        },
      },
      update: { limitAmount: b.limit, createdAt: budgetsCreatedAt },
      create: {
        id: b.id,
        familyGroupId: FG,
        categoryId: b.categoryId,
        period: "monthly",
        limitAmount: b.limit,
        createdAt: budgetsCreatedAt,
      },
    });
  }

  // ── Goals ─────────────────────────────────────────────────────────────────────

  const goals = [
    {
      id: "01322812-c0af-4846-b740-0d9ed6f32cd8",
      name: "Dana Darurat 6 Bulan",
      icon: "🛡️",
      target: 60_000_000n,
      current: 42_000_000n,
      status: "on_track",
      autoDebit: 2_000_000n,
      targetDate: futureDate(180),
    },
    {
      id: "3e363750-cb9f-4f10-8740-9b7ddda83f01",
      name: "Liburan Jepang",
      icon: "✈️",
      target: 25_000_000n,
      current: 15_600_000n,
      status: "on_track",
      autoDebit: null,
      targetDate: futureDate(270),
    },
    {
      id: "f04f350d-ec60-4694-bfb1-e71dfdbd7c50",
      name: "DP Rumah Ke-2",
      icon: "🏠",
      target: 300_000_000n,
      current: 120_000_000n,
      status: "needs_boost",
      autoDebit: 5_000_000n,
      targetDate: futureDate(730),
    },
    {
      id: "de0de591-3432-4737-bf11-30e32d4fb4de",
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
      id: "29e7a33e-8c5b-412d-b59a-1e7291837004",
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
      id: "fa7e4748-4893-48bb-9ec9-f2914b5ce1b7",
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
      id: "6b938282-5c13-477b-bb54-986bf483a5f0",
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
    where: { id: "a0bac4d3-5d21-4858-ae80-af69fb545c95" },
    update: { currentValue: 850_000_000n },
    create: {
      id: "a0bac4d3-5d21-4858-ae80-af69fb545c95",
      familyGroupId: FG,
      name: "Rumah Depok",
      type: "properti",
      currentValue: 850_000_000n,
      notes: "Dibeli 2019, cicilan KPR aktif",
    },
  });
  const assetMobil = await prisma.asset.upsert({
    where: { id: "72233bf5-ac14-4242-ba08-072008f2ad0d" },
    update: { currentValue: 210_000_000n },
    create: {
      id: "72233bf5-ac14-4242-ba08-072008f2ad0d",
      familyGroupId: FG,
      name: "Toyota Avanza 2021",
      type: "kendaraan",
      currentValue: 210_000_000n,
      notes: "Kredit aktif",
    },
  });
  await prisma.asset.upsert({
    where: { id: "95480a95-3e4f-4876-93cf-055be7af015b" },
    update: { currentValue: 22_000_000n },
    create: {
      id: "95480a95-3e4f-4876-93cf-055be7af015b",
      familyGroupId: FG,
      name: "MacBook Pro M3",
      type: "elektronik",
      currentValue: 22_000_000n,
      notes: "Untuk kerja",
    },
  });
  const assetEmas = await prisma.asset.upsert({
    where: { id: "6a5cd89f-bc1f-4f0c-addf-149e900ebf70" },
    update: { currentValue: 45_000_000n },
    create: {
      id: "6a5cd89f-bc1f-4f0c-addf-149e900ebf70",
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
      id: "1c04e715-924a-4e77-8bdf-597b480ce291",
      assetId: assetRumah.id,
      value: 800_000_000n,
      at: monthsAgo(3),
    },
    {
      id: "33d15471-b88c-4439-a2e9-86286a50272d",
      assetId: assetRumah.id,
      value: 825_000_000n,
      at: monthsAgo(1),
    },
    {
      id: "246123fb-1ca8-4335-ad4f-9ddc0c598149",
      assetId: assetRumah.id,
      value: 850_000_000n,
      at: daysAgo(0),
    },
    {
      id: "2b2da627-4eaf-4b9f-ad05-1aead9a4db35",
      assetId: assetMobil.id,
      value: 230_000_000n,
      at: monthsAgo(3),
    },
    {
      id: "80a08bc1-989e-4204-bf1d-dae96c61b004",
      assetId: assetMobil.id,
      value: 210_000_000n,
      at: daysAgo(0),
    },
    {
      id: "5be41afe-b419-40b9-a1c5-7a2d1f7cef97",
      assetId: assetEmas.id,
      value: 38_000_000n,
      at: monthsAgo(3),
    },
    {
      id: "5bcb46e2-b9dd-4d6e-b31a-91b5d6998d7a",
      assetId: assetEmas.id,
      value: 42_000_000n,
      at: monthsAgo(1),
    },
    {
      id: "3ab09cf9-5dc9-49fc-bb14-4ca77c3c9e8c",
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
    where: { id: "2e59f890-61d8-4562-b622-3f6d8610246a" },
    update: { quantity: 1500, costBasisPerUnit: 8500 },
    create: {
      id: "2e59f890-61d8-4562-b622-3f6d8610246a",
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
    where: { id: "54825c0a-49c1-4919-842e-34e28dfbb4b2" },
    update: { quantity: 5000, costBasisPerUnit: 3700 },
    create: {
      id: "54825c0a-49c1-4919-842e-34e28dfbb4b2",
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
    where: { id: "e9cff30e-5a96-44ce-a59e-7bcd2e2f1c68" },
    update: { quantity: 250000, costBasisPerUnit: 1850 },
    create: {
      id: "e9cff30e-5a96-44ce-a59e-7bcd2e2f1c68",
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
      id: "e6f9bcec-3c05-40ff-a596-c01f0d5ace47",
      investmentId: invBBCA.id,
      price: 9200,
      at: monthsAgo(1),
    },
    {
      id: "fe0f2beb-6e08-467b-b8fd-e311e51b2580",
      investmentId: invBBCA.id,
      price: 9450,
      at: daysAgo(1),
    },
    {
      id: "58589127-b2c5-453b-ba88-c1cf199aeecb",
      investmentId: invTLKM.id,
      price: 3850,
      at: monthsAgo(1),
    },
    {
      id: "0e74e5ca-f84a-4711-b757-b55f9b416dba",
      investmentId: invTLKM.id,
      price: 3920,
      at: daysAgo(1),
    },
    {
      id: "11a65d79-35cc-49b9-9296-a9809aa51e4c",
      investmentId: invReksaDana.id,
      price: 1920,
      at: monthsAgo(1),
    },
    {
      id: "4fd56556-2020-4af8-8490-56621853467b",
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
      id: "e67b4e98-3611-418e-b4e2-a0237463b3c5",
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
      id: "0553cbfe-4371-4017-9dc8-0c46258a1a3a",
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
      id: "1aa8c12f-ee47-40f6-b158-703883c683c1",
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
    where: { id: "0a1f05ec-74f5-4eb7-8968-a03c9e3ffb4e" },
    update: {},
    create: {
      id: "0a1f05ec-74f5-4eb7-8968-a03c9e3ffb4e",
      familyGroupId: FG,
      title: "Makan Malam Anniversary",
      totalAmount: 1_200_000n,
      status: "open",
      notes: "Restoran Plataran Jakarta",
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "75f9e250-bf3c-460e-8010-113135b89993" },
    update: {},
    create: {
      id: "75f9e250-bf3c-460e-8010-113135b89993",
      splitBillId: sb1.id,
      name: "Demo User",
      amountOwed: 400_000n,
      status: "paid",
      paidAt: daysAgo(3),
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "598a6c2e-de5e-4a5d-a8e0-1eed18c12dec" },
    update: {},
    create: {
      id: "598a6c2e-de5e-4a5d-a8e0-1eed18c12dec",
      splitBillId: sb1.id,
      name: "Budi Santoso",
      amountOwed: 400_000n,
      status: "pending",
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "aaf0bfa6-29a6-49e1-9c88-6e86d66dec56" },
    update: {},
    create: {
      id: "aaf0bfa6-29a6-49e1-9c88-6e86d66dec56",
      splitBillId: sb1.id,
      name: "Siti Rahayu",
      amountOwed: 400_000n,
      status: "pending",
    },
  });

  const sb2 = await prisma.splitBill.upsert({
    where: { id: "f080ad99-fd6f-4b89-8733-94f9939256b5" },
    update: {},
    create: {
      id: "f080ad99-fd6f-4b89-8733-94f9939256b5",
      familyGroupId: FG,
      title: "Liburan Bali Bareng",
      totalAmount: 8_500_000n,
      status: "settled",
      notes: "Villa + transport + makan 3 hari",
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "99fdd3ea-1df7-4b99-8400-db7774f84e3c" },
    update: {},
    create: {
      id: "99fdd3ea-1df7-4b99-8400-db7774f84e3c",
      splitBillId: sb2.id,
      name: "Demo User",
      amountOwed: 2_833_000n,
      status: "paid",
      paidAt: daysAgo(30),
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "ea4b8e64-70bf-44b5-9f26-6166c0c77d18" },
    update: {},
    create: {
      id: "ea4b8e64-70bf-44b5-9f26-6166c0c77d18",
      splitBillId: sb2.id,
      name: "Agus Wijaya",
      amountOwed: 2_833_000n,
      status: "paid",
      paidAt: daysAgo(28),
    },
  });
  await prisma.splitParticipant.upsert({
    where: { id: "8ea05393-1602-46c5-af5d-f9ef84cf5f69" },
    update: {},
    create: {
      id: "8ea05393-1602-46c5-af5d-f9ef84cf5f69",
      splitBillId: sb2.id,
      name: "Rina Permata",
      amountOwed: 2_834_000n,
      status: "paid",
      paidAt: daysAgo(28),
    },
  });

  // ── Inheritance Assets ────────────────────────────────────────────────────────

  const inh1 = await prisma.inheritanceAsset.upsert({
    where: { id: "e648ea7e-2402-4929-b21a-aeada815b8ce" },
    update: {},
    create: {
      id: "e648ea7e-2402-4929-b21a-aeada815b8ce",
      familyGroupId: FG,
      name: "Rumah Depok",
      assetType: "Properti",
      estimatedValue: 850_000_000n,
      visibility: "heirs_only",
      notes: "Rumah utama keluarga. Sertifikat SHM atas nama Demo User.",
    },
  });
  // ONE heir at 100%, linked to the real `dependant` member seeded above.
  // This used to be two invented children ("Anak Pertama"/"Anak Kedua", 50%
  // each) with `memberUserId` unset — a split that contradicted a family
  // whose roster held no children at all, and read as a bug ("the family has
  // one child, why is it 50/50?"). `memberUserId` is what ties an heir to an
  // actual member; free-text heirs remain valid for beneficiaries who have no
  // app account, which is why the column stays optional.
  await prisma.inheritanceHeir.upsert({
    where: { id: "93274005-21f6-4fd7-8ab8-8e06ddd1e68e" },
    update: {
      name: "Ana Demo",
      relationship: "Anak Kandung",
      sharePercent: 100,
      memberUserId: childUser.id,
    },
    create: {
      id: "93274005-21f6-4fd7-8ab8-8e06ddd1e68e",
      inheritanceAssetId: inh1.id,
      name: "Ana Demo",
      relationship: "Anak Kandung",
      sharePercent: 100,
      memberUserId: childUser.id,
    },
  });
  // Any OTHER heir row on this asset is stale — not just the one known
  // "aa5ca34b…" id above. A demo DB seeded before this single-heir cleanup
  // (e.g. an even older revision that additionally split the house 50/50
  // between two invented "hima"/"anak2" heirs) leaves those rows behind
  // forever, since a `deleteMany` scoped to one hardcoded id never touches
  // them: they'd keep stacking on top of "Ana Demo · 100%" — the sum of
  // sharePercent exceeding 100% while the UI still reads "Teralokasi penuh
  // (100%)", and every allocation total downstream (Warisan's own
  // "Alokasi Ahli Waris" card) overcounting by whatever those stale rows
  // add up to. Deleting by "not this asset's one intended heir" instead of
  // one specific id makes re-seeding self-healing regardless of how old the
  // database's last seed run was.
  await prisma.inheritanceHeir.deleteMany({
    where: {
      inheritanceAssetId: inh1.id,
      id: { not: "93274005-21f6-4fd7-8ab8-8e06ddd1e68e" },
    },
  });

  const inh2 = await prisma.inheritanceAsset.upsert({
    where: { id: "0d3e5b4d-b872-4e53-aad1-b1decfd6da2a" },
    update: {},
    create: {
      id: "0d3e5b4d-b872-4e53-aad1-b1decfd6da2a",
      familyGroupId: FG,
      name: "Tabungan & Investasi",
      assetType: "Aset Keuangan",
      estimatedValue: 300_000_000n,
      visibility: "heirs_only",
      notes: "Saham BBCA, reksa dana, tabungan BCA & Mandiri.",
    },
  });
  // This asset is seeded with no heirs at all — same reasoning as above:
  // clear whatever a stale pre-cleanup seed run left on it (e.g. the
  // "hima 70% / anak2 30%" split observed in a live demo whose DB predated
  // this fix), so the intended zero-heir state actually holds.
  await prisma.inheritanceHeir.deleteMany({
    where: { inheritanceAssetId: inh2.id },
  });

  // ── Donations ─────────────────────────────────────────────────────────────────

  const donations = [
    {
      id: "eee2ac76-25ca-4f7f-bdac-e90e9127a716",
      type: "zakat_maal",
      recipient: "Baznas",
      amount: 500_000n,
      at: monthsAgo(1, 10),
      taxDed: true,
    },
    {
      id: "7fbad5b5-db42-41c6-bc88-48e53d619c4c",
      type: "infaq",
      recipient: "Masjid Al-Ikhlas",
      amount: 200_000n,
      at: monthsAgo(1, 14),
      taxDed: false,
    },
    {
      id: "dac5e8a5-4b97-4555-8679-dfc6d317ab16",
      type: "sedekah",
      recipient: "Panti Asuhan",
      amount: 300_000n,
      at: monthsAgo(2, 20),
      taxDed: false,
    },
    {
      id: "fccbcaa3-e279-4f29-bc01-a172cad62031",
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
      id: "c647c1f5-63b1-4d43-94a0-6a74f361c889",
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
      id: "032e0fb7-3ec2-4430-a3d9-ac9bc216dd31",
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

  // Every figure/date below is DERIVED from the seeded liabilities, budgets,
  // goals and insurances above, so these rows can never contradict the
  // computed screens (Beranda attention card, Liabilitas, Asuransi). The
  // seeded installment is not due within 7 days and the seeded policy does not
  // renew within 30 days (apps/api/src/common/utils/due-window.util.ts), so
  // neither is worded as "segera". No spend percentage is claimed for the
  // budget: actual spend moves with the seeded transactions.
  const rupiah = (n: bigint): string =>
    `Rp ${Number(n).toLocaleString("id-ID")}`;
  const longDate = (d: Date): string =>
    d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const kpr = liabilities[0];
  const foodBudget = budgets[0]!;
  const emergencyGoal = goals[0];
  const vehicleInsurance = insurances[2];
  const emergencyPct = Math.round(
    (Number(emergencyGoal.current) / Number(emergencyGoal.target)) * 100,
  );

  const notifs = [
    {
      id: "4db0112d-dd72-46c2-a7aa-cba048db1016",
      title: "Jadwal Cicilan KPR",
      body: `Cicilan KPR BTN sebesar ${rupiah(kpr.minPayment)} jatuh tempo pada ${longDate(kpr.due)}.`,
      icon: "🏠",
    },
    {
      id: "8df32578-2c72-4832-8391-de44a3703c56",
      title: "Pantau Anggaran Makan & Minum",
      body: `Anggaran bulanan Makan & Minum kamu ${rupiah(foodBudget.limit)}. Cek pemakaiannya di halaman Anggaran.`,
      icon: "📊",
    },
    {
      id: "6c6a2b73-0de3-4e62-85f1-65318ed2e861",
      title: "Target Dana Darurat Sesuai Rencana",
      body: `Dana darurat kamu sudah ${emergencyPct}% dari target ${rupiah(emergencyGoal.target)}.`,
      icon: "🛡️",
    },
    {
      id: "3cd0c242-bb4d-4dfe-87b4-19bab6af843c",
      title: "Jadwal Perpanjangan Asuransi Kendaraan",
      body: `Asuransi kendaraan diperpanjang pada ${longDate(vehicleInsurance.renewal)}.`,
      icon: "🚗",
    },
  ];

  for (const n of notifs) {
    await prisma.notification.upsert({
      where: { id: n.id },
      // Re-seeding refreshes the demo copy so an older DB drops the
      // contradictory static wording; read state is left untouched.
      update: { title: n.title, body: n.body, icon: n.icon },
      create: {
        id: n.id,
        familyGroupId: FG,
        title: n.title,
        body: n.body,
        icon: n.icon,
      },
    });
  }

  // ── Bank Syncs (Rekonsiliasi Bank) ───────────────────────────────────────────
  // Two demo bank-statement uploads: one fully matched, one with mixed statuses.

  const bs1 = await prisma.bankSync.upsert({
    where: { id: "b0556f2e-de43-4d28-9363-218023e16f02" },
    update: { rowCount: 8 },
    create: {
      id: "b0556f2e-de43-4d28-9363-218023e16f02",
      familyGroupId: FG,
      fileName: "BCA_Rekening_Koran_Mei_2025.pdf",
      uploadedAt: monthsAgo(1, 18),
      rowCount: 8,
    },
  });

  // Entries for BCA Mei — mix of matched, suggested, unmatched
  const bs1Entries = [
    {
      id: "e07c7691-072a-4d94-b42b-f334b9d0c21e",
      date: monthsAgo(1, 1),
      description: "CR GAJI PT MAJU BERSAMA",
      amount: 25_850_000n,
      reconStatus: "matched" as const,
      matchedTxId: "55dbd453-9859-4cef-8b64-2ffa8f284973",
      suggestedTxId: null,
    },
    {
      id: "eccbbf79-d0f9-4f9c-868a-3c13d8e9aadb",
      date: monthsAgo(1, 5),
      description: "DB CICILAN KPR BTN",
      amount: -4_200_000n,
      reconStatus: "matched" as const,
      matchedTxId: "be6d3d3b-419e-4f2d-b554-4a7933953739",
      suggestedTxId: null,
    },
    {
      id: "e5ed8818-b09b-4678-8cc4-5ff74f7645e4",
      date: monthsAgo(1, 10),
      description: "DB LISTRIK AIR INTERNET",
      amount: -850_000n,
      reconStatus: "suggested" as const,
      matchedTxId: null,
      suggestedTxId: "c52bc77a-41d2-4c23-81f7-a9217eb7331e",
    },
    {
      id: "0ed98dc5-6b33-4282-97a6-2ac9c4b25294",
      date: monthsAgo(1, 12),
      description: "DB BELANJA ONLINE",
      amount: -650_000n,
      reconStatus: "suggested" as const,
      matchedTxId: null,
      suggestedTxId: "297fca15-7ffe-4168-bd26-b5efb23f9e41",
    },
    {
      id: "5362b521-48ef-4b28-b85b-0f5907442728",
      date: monthsAgo(1, 15),
      description: "DB REKSA DANA AUTODEBIT",
      amount: -3_000_000n,
      reconStatus: "matched" as const,
      matchedTxId: "4d80c9eb-e676-4db2-b1c7-6288bb71ddcd",
      suggestedTxId: null,
    },
    {
      id: "de6868f9-87fb-4cca-96a2-3e12147f1627",
      date: monthsAgo(1, 20),
      description: "CR BONUS KINERJA Q4",
      amount: 15_000_000n,
      reconStatus: "unmatched" as const,
      matchedTxId: null,
      suggestedTxId: null,
    },
    {
      id: "926e32ed-252c-4bef-8a71-2768e1dea98a",
      date: monthsAgo(1, 22),
      description: "DB TRANSFER TUJUAN LIBURAN",
      amount: -2_000_000n,
      reconStatus: "unmatched" as const,
      matchedTxId: null,
      suggestedTxId: null,
    },
    {
      id: "2960f10e-07c5-482d-8c75-347388f9d5b0",
      date: monthsAgo(1, 28),
      description: "CR FREELANCE DESAIN WEB",
      amount: 5_000_000n,
      reconStatus: "matched" as const,
      matchedTxId: "5c6549b2-5eb8-4413-be09-cd5fc5703d83",
      suggestedTxId: null,
    },
  ];

  for (const e of bs1Entries) {
    await prisma.bankSyncEntry.upsert({
      where: { id: e.id },
      update: { reconStatus: e.reconStatus, matchedTxId: e.matchedTxId },
      create: {
        id: e.id,
        bankSyncId: bs1.id,
        date: e.date,
        description: e.description,
        amount: e.amount,
        currency: "IDR",
        reconStatus: e.reconStatus,
        matchedTxId: e.matchedTxId,
        suggestedTxId: e.suggestedTxId,
      },
    });
  }

  const bs2 = await prisma.bankSync.upsert({
    where: { id: "9b2117c8-cdb3-4df3-a640-3db18642e518" },
    update: { rowCount: 5 },
    create: {
      id: "9b2117c8-cdb3-4df3-a640-3db18642e518",
      familyGroupId: FG,
      fileName: "Mandiri_Rekon_April_2025.xlsx",
      uploadedAt: monthsAgo(2, 12),
      rowCount: 5,
    },
  });

  // Entries for Mandiri April — mostly matched
  const bs2Entries = [
    {
      id: "6dd5ab72-d34c-4200-bedb-04ac3c72ed64",
      date: monthsAgo(2, 1),
      description: "CR GAJI APRIL",
      amount: 25_850_000n,
      reconStatus: "matched" as const,
      matchedTxId: "826f7860-37bd-4346-be26-2255d060fb60",
      suggestedTxId: null,
    },
    {
      id: "899e2200-f717-4f9c-8bea-ef0f695c1ab9",
      date: monthsAgo(2, 5),
      description: "DB KPR APRIL",
      amount: -4_200_000n,
      reconStatus: "matched" as const,
      matchedTxId: "d932a60e-c2eb-47e0-beea-18f353c599ce",
      suggestedTxId: null,
    },
    {
      id: "ceb3ab9d-eeec-43ea-8e43-c501f706a790",
      date: monthsAgo(2, 10),
      description: "CR BONUS APRIL",
      amount: 5_000_000n,
      reconStatus: "matched" as const,
      matchedTxId: "98c6aacb-d74f-4bb1-95a2-3e2c2447f08e",
      suggestedTxId: null,
    },
    {
      id: "e10d13cc-3201-4da5-8d51-db8c8029f3d5",
      date: monthsAgo(2, 15),
      description: "DB TAGIHAN UTILITAS",
      amount: -850_000n,
      reconStatus: "suggested" as const,
      matchedTxId: null,
      suggestedTxId: "5cdef13b-776e-43d7-b997-558d90235fe6",
    },
    {
      id: "f9f4888f-b348-4050-b853-8c7857714f4d",
      date: monthsAgo(2, 20),
      description: "DB BELANJA UMUM",
      amount: -500_000n,
      reconStatus: "unmatched" as const,
      matchedTxId: null,
      suggestedTxId: null,
    },
  ];

  for (const e of bs2Entries) {
    await prisma.bankSyncEntry.upsert({
      where: { id: e.id },
      update: { reconStatus: e.reconStatus, matchedTxId: e.matchedTxId },
      create: {
        id: e.id,
        bankSyncId: bs2.id,
        date: e.date,
        description: e.description,
        amount: e.amount,
        currency: "IDR",
        reconStatus: e.reconStatus,
        matchedTxId: e.matchedTxId,
        suggestedTxId: e.suggestedTxId,
      },
    });
  }

  // ── COA Accounts (derived from docs/COA_Updates 21 June.xlsx) ──────────────
  type CoaSeed = {
    code: string;
    name: string;
    groupNum: number;
    direction: "INCOME" | "EXPENSE" | "TRANSFER";
    budgetType: "FIXED" | "VARIABLE" | "REIMBURSEMENT" | null;
  };
  const coaSeeds: CoaSeed[] = [
    // Group 1 — Income
    {
      code: "10101",
      name: "Salary Dax",
      groupNum: 1,
      direction: "INCOME",
      budgetType: "FIXED",
    },
    {
      code: "10102",
      name: "Salary Meta",
      groupNum: 1,
      direction: "INCOME",
      budgetType: "FIXED",
    },
    {
      code: "10201",
      name: "Dividen Dax",
      groupNum: 1,
      direction: "INCOME",
      budgetType: "FIXED",
    },
    {
      code: "10202",
      name: "Dividen Meta",
      groupNum: 1,
      direction: "INCOME",
      budgetType: "VARIABLE",
    },
    {
      code: "10301",
      name: "Passive Income",
      groupNum: 1,
      direction: "INCOME",
      budgetType: "VARIABLE",
    },
    {
      code: "10401",
      name: "Other Income",
      groupNum: 1,
      direction: "INCOME",
      budgetType: "VARIABLE",
    },
    // Group 2 — Expense
    {
      code: "20101",
      name: "Household Needs",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20102",
      name: "Household Staff",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20103",
      name: "Pets",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20104",
      name: "Utilities",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20105",
      name: "Maintenance/Repair",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20201",
      name: "Dining Out",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20202",
      name: "Groceries",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20203",
      name: "Snacks & Beverages",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20204",
      name: "Online Food",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20301",
      name: "Clothing & Accessories",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20302",
      name: "Grooming & Personal Care",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20303",
      name: "Gadgets/Electronics",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20304",
      name: "Stationary",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20305",
      name: "Impulse Buying",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20401",
      name: "Treatment",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20402",
      name: "Preventive Care",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20403",
      name: "Diagnostics",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20404",
      name: "Medical Supplies & Accessories",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20501",
      name: "Fuel, Parking & Toll",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20502",
      name: "Public Transport & Ride-Hailing",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20503",
      name: "Service/Maintenance",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20504",
      name: "Vehicle Legal & Admin",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20601",
      name: "School",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20602",
      name: "Private Class",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20603",
      name: "Therapy",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20604",
      name: "Competition",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20605",
      name: "Workshop/Training",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20701",
      name: "Experiences",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20702",
      name: "Hobbies",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20703",
      name: "Sports & Supplies",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20801",
      name: "Couple Trip",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20802",
      name: "Family Trip",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20902",
      name: "Family Events",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "20903",
      name: "Seasonal Events",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "20904",
      name: "Social Events",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "21101",
      name: "Health Insurance",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "21104",
      name: "Asset & Other Insurance",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "21201",
      name: "Donation Education",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "21202",
      name: "Donation Religious/Ministry",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "21203",
      name: "Donation Research",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "21204",
      name: "Donation Social",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "21301",
      name: "Bank Charges",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "21302",
      name: "Subscription",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "21303",
      name: "Unclassified",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    // EPIC-023 A1/A2 — the interest portion of a liability payment is a real
    // expense (unlike the principal, which is a group-5 TRANSFER above).
    {
      code: "21304",
      name: "Loan Interest",
      groupNum: 2,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    // Group 3 — Wealth Allocation
    {
      code: "30101",
      name: "Bank Savings",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "30201",
      name: "Emergency Fund",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "30301",
      name: "Gold",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "30401",
      name: "Forex",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "30501",
      name: "Property",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "30601",
      name: "Business",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "30701",
      name: "Stocks",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "30702",
      name: "Crypto",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "VARIABLE",
    },
    {
      code: "30801",
      name: "Education Insurance",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "30802",
      name: "Life Insurance",
      groupNum: 3,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    // Group 4 — Account Receivable. TRANSFER, not INCOME: a receivable is a
    // claim on an asset, not revenue (EPIC-023 D23).
    {
      code: "40101",
      name: "Pending Reimbursement",
      groupNum: 4,
      direction: "TRANSFER",
      budgetType: "VARIABLE",
    },
    {
      code: "40201",
      name: "Personal Loan (to others)",
      groupNum: 4,
      direction: "TRANSFER",
      budgetType: "VARIABLE",
    },
    {
      code: "40202",
      name: "Business Receivable",
      groupNum: 4,
      direction: "TRANSFER",
      budgetType: "VARIABLE",
    },
    {
      code: "40301",
      name: "Refundable Deposit",
      groupNum: 4,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    // Group 5 — Account Payable. TRANSFER, not EXPENSE: principal repayment
    // reduces a liability, it does not consume income (EPIC-023 D23). The
    // interest portion of a payment is its own group-2 expense (code 21304).
    {
      code: "50101",
      name: "Office Snacks",
      groupNum: 5,
      direction: "TRANSFER",
      budgetType: "VARIABLE",
    },
    {
      code: "50102",
      name: "Office Supplies",
      groupNum: 5,
      direction: "TRANSFER",
      budgetType: "VARIABLE",
    },
    {
      code: "50103",
      name: "Office Gadget",
      groupNum: 5,
      direction: "TRANSFER",
      budgetType: "VARIABLE",
    },
    {
      code: "50104",
      name: "Office Subscription",
      groupNum: 5,
      direction: "TRANSFER",
      budgetType: "REIMBURSEMENT",
    },
    {
      code: "50105",
      name: "Office Equipment",
      groupNum: 5,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "50201",
      name: "Credit Card Bill",
      groupNum: 5,
      direction: "TRANSFER",
      budgetType: "VARIABLE",
    },
    {
      code: "50301",
      name: "Bank Loan",
      groupNum: 5,
      direction: "TRANSFER",
      budgetType: "FIXED",
    },
    {
      code: "50302",
      name: "Personal Debt",
      groupNum: 5,
      direction: "TRANSFER",
      budgetType: "VARIABLE",
    },
    // Group 6 — Tax
    {
      code: "60101",
      name: "PPh 21",
      groupNum: 6,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "60102",
      name: "PPh 25/29",
      groupNum: 6,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "60201",
      name: "PPh Final Dividen",
      groupNum: 6,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "60202",
      name: "PPh Bunga/Deposito",
      groupNum: 6,
      direction: "EXPENSE",
      budgetType: "VARIABLE",
    },
    {
      code: "60301",
      name: "PBB",
      groupNum: 6,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
    {
      code: "60302",
      name: "PKB",
      groupNum: 6,
      direction: "EXPENSE",
      budgetType: "FIXED",
    },
  ];
  for (const coa of coaSeeds) {
    await prisma.coaAccount.upsert({
      where: {
        familyGroupId_code: { familyGroupId: family.id, code: coa.code },
      },
      update: {
        name: coa.name,
        groupNum: coa.groupNum,
        direction: coa.direction,
        budgetType: coa.budgetType ?? null,
      },
      create: {
        familyGroupId: family.id,
        code: coa.code,
        name: coa.name,
        groupNum: coa.groupNum,
        direction: coa.direction,
        budgetType: coa.budgetType ?? null,
      },
    });
  }

  // Counted, not `coaSeeds.length`: the demo family also carries every
  // GENERIC_COA_CHART account (upserted near the top of this file), so the
  // local array alone under-reported the real chart size by ~26 accounts.
  const coaCount = await prisma.coaAccount.count({
    where: { familyGroupId: family.id },
  });

  process.stdout.write(
    `\nSeed complete — demo@wealthme.id / demo1234 · anak: ana_demo / demo1234\n` +
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
      `  Inheritance : 2 aset + 1 ahli waris (Ana Demo, 100%)\n` +
      `  Donations   : 4 (zakat, infaq, sedekah, wakaf)\n` +
      `  Tax Records : 2024 (sudah lapor), 2025 (belum lapor)\n` +
      `  Notifications: 4\n` +
      `  Bank Syncs  : 2 uploads (BCA Mei: 8 entries, Mandiri Apr: 5 entries)\n` +
      `  COA Accounts: ${coaCount} (6 grup)\n`,
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
