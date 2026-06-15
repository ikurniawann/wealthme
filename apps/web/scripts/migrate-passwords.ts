/**
 * One-time migration: copy User.passwordHash → BaAccount (account table)
 * so existing users can log in after the NextAuth → Better Auth migration.
 *
 * Old system: NestJS stored argon2id hashes in User.passwordHash.
 * New system: Better Auth expects credentials in the `account` table
 *             with providerId = "credential" and password = argon2id hash.
 *
 * Both systems use argon2id so the hashes are directly compatible.
 *
 * Run once:
 *   npx tsx scripts/migrate-passwords.ts
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const usersWithPassword = await prisma.user.findMany({
    where: {
      passwordHash: { not: null },
    },
    select: { id: true, email: true, passwordHash: true },
  });

  console.log(`Found ${usersWithPassword.length} users with passwordHash`);

  let migrated = 0;
  let skipped = 0;

  for (const user of usersWithPassword) {
    const existing = await prisma.baAccount.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.baAccount.create({
      data: {
        id: randomUUID(),
        accountId: user.email,
        providerId: "credential",
        userId: user.id,
        password: user.passwordHash!,
      },
    });

    migrated++;
    console.log(`  migrated: ${user.email}`);
  }

  console.log(
    `\nDone: ${migrated} migrated, ${skipped} already had credentials.`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
