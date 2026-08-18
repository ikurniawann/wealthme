import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import argon2 from "argon2";
import {
  GENERIC_COA_CHART,
  buildReferenceItemSeed,
  defaultCoaCodeForCategory,
} from "@wealthme/contracts";

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: "Gaji", kind: "income" as const, icon: "💰" },
  { name: "Investasi", kind: "income" as const, icon: "📈" },
  { name: "Transfer Masuk", kind: "income" as const, icon: "📥" },
  { name: "Lainnya Pemasukan", kind: "income" as const, icon: "➕" },
  { name: "Makanan & Minuman", kind: "expense" as const, icon: "🍽️" },
  { name: "Transportasi", kind: "expense" as const, icon: "🚗" },
  { name: "Belanja", kind: "expense" as const, icon: "🛒" },
  { name: "Kesehatan", kind: "expense" as const, icon: "🏥" },
  { name: "Hiburan", kind: "expense" as const, icon: "🎮" },
  { name: "Tagihan & Utilitas", kind: "expense" as const, icon: "💡" },
  { name: "Pendidikan", kind: "expense" as const, icon: "📚" },
  { name: "Lainnya Pengeluaran", kind: "expense" as const, icon: "➖" },
];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ],
  emailAndPassword: {
    enabled: true,
    password: {
      hash: (password) => argon2.hash(password, { type: argon2.argon2id }),
      verify: ({ hash, password }) =>
        argon2.verify(hash, password).catch(() => false),
    },
    sendResetPassword: async ({ user, url }) => {
      console.log(`[reset-password] URL for ${user.email}: ${url}`);
      const apiKey = process.env.SENDGRID_API_KEY;
      const fromEmail =
        process.env.NOTIFICATION_FROM_EMAIL ?? "noreply@wealthme.id";
      if (!apiKey) return;
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: user.email, name: user.name }] }],
          from: { email: fromEmail, name: "WealthMe" },
          subject: "Reset Password WealthMe",
          content: [
            {
              type: "text/html",
              value: `<p>Halo ${user.name},</p><p>Klik link berikut untuk mereset password Anda:</p><p><a href="${url}">${url}</a></p><p>Link ini berlaku selama 1 jam.</p>`,
            },
          ],
        }),
      }).catch(console.error);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  session: {
    modelName: "baSession",
    additionalFields: {
      familyGroupId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  account: {
    modelName: "baAccount",
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const initials = user.name
            .split(" ")
            .slice(0, 2)
            .map((w: string) => w[0]?.toUpperCase() ?? "")
            .join("");

          await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.user.update({
              where: { id: user.id },
              data: { avatarInitials: initials },
            });

            const fg = await tx.familyGroup.create({
              data: { name: `${user.name}'s Family` },
            });

            await tx.member.create({
              data: { userId: user.id, familyGroupId: fg.id, role: "owner" },
            });

            // EPIC-017: provision the generic COA chart, then COA-link the
            // default categories (Category.coaAccountId is NOT NULL).
            await tx.coaAccount.createMany({
              data: GENERIC_COA_CHART.map((c) => ({
                familyGroupId: fg.id,
                code: c.code,
                name: c.name,
                groupNum: c.groupNum,
                direction: c.direction,
                budgetType: c.budgetType,
              })),
            });
            const coaAccounts = await tx.coaAccount.findMany({
              where: { familyGroupId: fg.id },
              select: { id: true, code: true },
            });
            const coaIdByCode = new Map(coaAccounts.map((a) => [a.code, a.id]));

            await tx.category.createMany({
              data: DEFAULT_CATEGORIES.map((c) => {
                const code = defaultCoaCodeForCategory(c.kind, c.name);
                const coaAccountId = coaIdByCode.get(code);
                if (!coaAccountId) {
                  throw new Error(
                    `Missing COA account "${code}" during registration`,
                  );
                }
                return { ...c, familyGroupId: fg.id, coaAccountId };
              }),
            });

            // EPIC-024 A6 (D5, US-REK-1) — "Akun Utama" auto-create at
            // registration REMOVED: a new user starts with zero accounts
            // and adds their own, so their ledger contains only accounts
            // that exist in real life. Existing "Akun Utama" rows from
            // before this change are left untouched (no migration).

            // EPIC-024 Task J (D14, US-MD-1) — mirrors the API-side
            // auth.service.ts register() seeding so a user created through
            // this Better-Auth hook (email/password + Google sign-in) gets
            // the same real reference-list defaults, not just users created
            // via the NestJS /auth/register endpoint.
            await tx.referenceItem.createMany({
              data: buildReferenceItemSeed().map((item) => ({
                ...item,
                familyGroupId: fg.id,
                isSystem: true,
              })),
            });
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // EPIC-024 A3 (Evidence #1) — unified to `createdAt: asc` (OLDEST
          // membership wins), matching family-groups.service.ts#findMine and
          // auth.service.ts#getMe/getProfileDetail/updateProfile. Was
          // `desc` (newest-first): a wife who registered herself (own
          // auto-created group) and was later added as a member/co-master
          // to her husband's group had TWO memberships, and this "most
          // recent wins" heuristic landed every session on her OWN
          // near-empty group instead of the shared family's. A user's
          // FIRST family group — normally created at their own
          // registration — is the stable, deterministic "home" group; a
          // later invite/add should never silently switch it.
          // EPIC-027 A7 (security gate, CRITICAL) — reviewed foundation change
          // to a protected `lib/*` file. This is a SEPARATE Prisma client (the
          // better-auth adapter's), so the API's member-soft-delete extension
          // never applies here. Without `deletedAt: null` a removed member's
          // stale membership would still stamp a familyGroupId onto every new
          // session, handing them back the group they were removed from.
          const member = await prisma.member.findFirst({
            where: { userId: session.userId, deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: { familyGroupId: true },
          });
          return {
            data: {
              ...session,
              familyGroupId: member?.familyGroupId ?? null,
            },
          };
        },
      },
    },
  },
  // EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — head-created dependant/
  // operational members sign in by username, not email (they have no real
  // email). Field names/defaults verified against the installed plugin's
  // own schema (see User.username/displayUsername in prisma/schema.prisma).
  plugins: [username()],
});
