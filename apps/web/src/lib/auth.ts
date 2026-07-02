import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import argon2 from "argon2";

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

            await tx.category.createMany({
              data: DEFAULT_CATEGORIES.map((c) => ({
                ...c,
                familyGroupId: fg.id,
              })),
            });

            await tx.account.create({
              data: {
                familyGroupId: fg.id,
                name: "Akun Utama",
                type: "bank",
                balance: BigInt(0),
              },
            });
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // Most-recent membership wins so a freshly accepted invitation
          // becomes the active group on the next sign-in.
          // ponytail: newest-first heuristic; add a group switcher when
          // multi-group users need manual control.
          const member = await prisma.member.findFirst({
            where: { userId: session.userId },
            orderBy: { createdAt: "desc" },
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
});
