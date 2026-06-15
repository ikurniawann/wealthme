import { randomUUID } from "crypto";

import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();
const EMAIL = "andrsrjld28@gmail.com";
const NEW_PASSWORD = "heisenberg";

async function main() {
  const hash = await argon2.hash(NEW_PASSWORD, { type: argon2.argon2id });
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.log("User not found:", EMAIL);
    return;
  }
  const updated = await prisma.baAccount.updateMany({
    where: { userId: user.id, providerId: "credential" },
    data: { password: hash },
  });
  if (updated.count === 0) {
    await prisma.baAccount.create({
      data: {
        id: randomUUID(),
        accountId: EMAIL,
        providerId: "credential",
        userId: user.id,
        password: hash,
      },
    });
    console.log("Created BaAccount with new password for", EMAIL);
  } else {
    console.log("Password reset for", EMAIL);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
